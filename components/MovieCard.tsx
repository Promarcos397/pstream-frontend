import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { SpeakerSlashIcon, SpeakerHighIcon, PlayIcon, CheckIcon, PlusIcon, ThumbsUpIcon, ThumbsDownIcon, HeartIcon, CaretDownIcon, BookOpenIcon, TicketIcon } from '@phosphor-icons/react';
import { useYouTubePlayer } from '../hooks/useYouTubePlayer';
import { useIsInTheaters } from '../hooks/useIsInTheaters';
import { useNavigate, Link } from 'react-router-dom';
import YouTube from 'react-youtube';
import { useGlobalContext } from '../context/GlobalContext';
import { GENRES, LOGO_SIZE } from '../constants';
import { getMovieImages, prefetchStream, getExternalIds, getMovieDetails, fetchTrailers } from '../services/api';
import { Movie } from '../types';
import { searchTrailersWithFallback } from '../services/YouTubeService';
import { MaturityBadge, BadgeOverlay, ProgressIndicator, HoverProgressBar } from './MovieCardBadges';
import { triggerSearch } from '../utils/search';
import { useYouTubeCaptions } from '../hooks/useYouTubeCaptions';
import { useSubtitleStyle } from '../hooks/useSubtitleStyle';

// ─── Runtime pointer-type tracker ────────────────────────────────────────────
// Replaces the old load-time IS_TOUCH_DEVICE sniff.
//
// Instead of asking "does this device have a touchscreen?" at startup (which
// permanently breaks iPad+mouse, Surface, etc.), we watch the actual pointer
// events the browser fires and update live:
//
//   phone / tablet finger   → touchstart fires  → prefersHover = false
//   desktop / laptop mouse  → pointermove fires  → prefersHover = true
//   iPad + Magic Mouse      → pointermove fires  → prefersHover = true (switches mid-session)
//   Surface pen → finger    → touchstart fires   → prefersHover = false (switches back)
//
// One module-level listener drives all mounted cards via a subscriber set,
// so there is exactly one pointermove listener on the page regardless of how
// many cards are rendered.
type _PHListener = (v: boolean) => void;
const _phSubs = new Set<_PHListener>();
let _prefersHover = false;

if (typeof window !== 'undefined') {
  window.addEventListener('pointermove', (e: PointerEvent) => {
    const next = e.pointerType === 'mouse';
    if (next !== _prefersHover) { _prefersHover = next; _phSubs.forEach(f => f(next)); }
  }, { passive: true });
  // mousedown catches the first click before any pointermove has fired
  window.addEventListener('mousedown', () => {
    if (!_prefersHover) { _prefersHover = true; _phSubs.forEach(f => f(true)); }
  }, { passive: true });
  // touchstart immediately disables hover so the browser owns the gesture fully
  window.addEventListener('touchstart', () => {
    if (_prefersHover) { _prefersHover = false; _phSubs.forEach(f => f(false)); }
  }, { passive: true });
}

function usePrefersHover(): boolean {
  const [val, setVal] = useState(_prefersHover);
  useEffect(() => {
    setVal(_prefersHover); // sync in case it changed between render and mount
    _phSubs.add(setVal);
    return () => { _phSubs.delete(setVal); };
  }, []);
  return val;
}
// ─────────────────────────────────────────────────────────────────────────────

// Module-level registry — only ONE popup open at a time.
// When card B's 300ms timer fires, it calls this to immediately close card A.
let activePopupClose: (() => void) | null = null;


interface MovieCardProps {
  movie: Movie;
  onSelect: (movie: Movie, time?: number, videoId?: string) => void;
  onPlay?: (movie: Movie) => void;
  isGrid?: boolean;
}



type MovieRating = 'like' | 'dislike' | 'love';
const RatingPill: React.FC<{ rating: MovieRating | undefined; onRate: (r: MovieRating) => void }> = ({ rating, onRate }) => {
  const [expanded, setExpanded] = useState(false);
  const CurrentIcon = rating === 'love' ? HeartIcon : rating === 'dislike' ? ThumbsDownIcon : ThumbsUpIcon;
  return (
    <div
      className="relative flex items-center"
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
    >
      <div
        className={`flex items-center gap-1 overflow-hidden transition-all duration-200 border-2 rounded-full bg-[#2a2a2a]/80
          ${expanded ? 'border-white/60 px-2 gap-2' : 'border-gray-500 justify-center w-8 h-8 md:w-9 md:h-9'}`}
        style={{ height: expanded ? 36 : undefined }}
      >
        {expanded ? (
          <>
            {(['love', 'like', 'dislike'] as MovieRating[]).map(r => {
              const Icon = r === 'love' ? HeartIcon : r === 'like' ? ThumbsUpIcon : ThumbsDownIcon;
              const isActive = rating === r;
              return (
                <button
                  key={r}
                  onClick={(e) => { e.stopPropagation(); onRate(r); setExpanded(false); }}
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-150 hover:scale-125 flex-shrink-0
                    ${isActive ? 'text-white' : 'text-white/60 hover:text-white'}`}
                  title={r.charAt(0).toUpperCase() + r.slice(1)}
                >
                  <Icon size={16} weight={isActive ? 'fill' : 'bold'} />
                </button>
              );
            })}
          </>
        ) : (
          <CurrentIcon size={16} weight={rating ? 'fill' : 'bold'} className={rating ? 'text-white' : 'text-white'} />
        )}
      </div>
    </div>
  );
};

const MovieCard: React.FC<MovieCardProps> = ({ movie, onSelect, onPlay, isGrid = false }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const prefersHover = usePrefersHover();
  const {
    myList, toggleList, rateMovie, getMovieRating, getVideoState,
    updateVideoState, getEpisodeProgress, getLastWatchedEpisode,
    top10TV, top10Movies, activeVideoId, setActiveVideoId,
    globalMute, setGlobalMute
  } = useGlobalContext();
  const [isHovered, setIsHovered] = useState(false);
  const [isPrimed, setIsPrimed] = useState(false); // Immediate visual feedback
  const [isHoverVideoReady, setIsHoverVideoReady] = useState(false); // backdrop→video gate
  const hoverSyncRef = React.useRef<NodeJS.Timeout | null>(null);
  const { trailerUrl, setTrailerUrl, playerRef, handleMuteToggle } = useYouTubePlayer();
  // We use our local context destructured vars to avoid any stale closures
  const isMuted = globalMute;
  const setIsMuted = setGlobalMute;
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [imgFailed, setImgFailed] = useState(false);
  const isCinemaOnly = useIsInTheaters(movie);
  const [lastSyncTime, setLastSyncTime] = useState(0);
  const currentPreviewVideoId = trailerUrl || null;
  const previewCaptionsPlaying = isHovered && isHoverVideoReady;
  const { overlayStyleCompact, lang, enabled: subtitlesEnabled } = useSubtitleStyle();
  const { activeCue } = useYouTubeCaptions(playerRef, currentPreviewVideoId, previewCaptionsPlaying, lang);

  // Touch scroll detection via native (passive) listeners added in useEffect.
  // Native passive listeners never block scrolling — React synthetic onTouchStart
  // can delay scroll commit even when marked passive, so we avoid it entirely.
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);
  const touchDidScroll = useRef(false);
  const SCROLL_THRESHOLD = 8;

  // --- 4. Bidirectional Sync Layer: Modal -> Card ---
  useEffect(() => {
    // When the global video claim is released (activeVideoId === null),
    // and this card is still hovered/alive, we check if we need to catch up
    if (isHovered && playerRef.current && activeVideoId === null && trailerUrl) {
      const savedState = getVideoState(movie.id);
      if (savedState && savedState.time > 0 && savedState.videoId === trailerUrl) {
        // Sync if the difference is meaningful (> 1s) to avoid unnecessary jitter
        const currentTime = playerRef.current.getCurrentTime();
        if (Math.abs(currentTime - savedState.time) > 1) {
          playerRef.current.seekTo(savedState.time, true);
        }
      }
    }
  }, [activeVideoId, isHovered, trailerUrl, movie.id, getVideoState]);


  // 'center' | 'left' | 'right' - determines expansion direction
  const [hoverPosition, setHoverPosition] = useState<'center' | 'left' | 'right'>('center');
  // Captured card rect at the moment hover fires — used for fixed popup positioning
  const [hoveredRect, setHoveredRect] = useState<DOMRect | null>(null);

  const isAdded = myList.find(m => m.id === movie.id);
  const timerRef = useRef<any>(null);
  const leaveTimerRef = useRef<any>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // --- Dynamic Badge Logic (strict thresholds to reduce clutter) ---
  const getBadgeInfo = () => {
    const isTV = movie.media_type === 'tv' || (!movie.media_type && !movie.title);
    const movieIdNum = Number(movie.id);

    // Sync with New & Popular Top 10 Lists
    if (isTV && top10TV?.includes(movieIdNum)) {
      return { text: 'Top 10', type: 'top' };
    }
    if (!isTV && top10Movies?.includes(movieIdNum)) {
      return { text: 'Top 10', type: 'top' };
    }

    const dateStr = movie.release_date || movie.first_air_date;
    const now = new Date();

    // Check release recency
    if (dateStr) {
      const releaseDate = new Date(dateStr);
      const diffTime = releaseDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      // Coming soon (within next 30 days)
      if (diffDays > 0 && diffDays <= 30) {
        return { text: 'Coming Soon', type: 'upcoming' };
      }

      // Recently added (within last 45 days)
      if (diffDays >= -45 && diffDays <= 0) {
        return {
          text: isTV ? 'New Episodes' : 'Recently Added',
          type: 'new'
        };
      }
    }

    return null;
  };

  const badge = getBadgeInfo();

  const [isVisible, setIsVisible] = useState(false);

  // Intersection Observer for Lazy Logo Fetching
  useEffect(() => {
    if (!cardRef.current) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        setIsVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: '200px' });
    observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, []);

  // Adaptive Logo Engine
  const [logoDim, setLogoDim] = useState<{ ratio: number; isSquare: boolean }>({ ratio: 1.5, isSquare: false });
  const handleLogoLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = e.currentTarget;
    const ratio = naturalWidth / naturalHeight;
    setLogoDim({ ratio, isSquare: ratio < 1.35 });
  };

  // Fetch Logo only when visible
  useEffect(() => {
    if (!isVisible) return;
    let isMounted = true;
    const fetchLogo = async () => {
      try {
        const mediaType = (movie.media_type || (movie.title ? 'movie' : 'tv')) as 'movie' | 'tv';
        const data = await getMovieImages(String(movie.id), mediaType);

        if (!isMounted) return;

        if (data && data.logos) {
          const logo = data.logos.find((l: any) => l.iso_639_1 === 'en' || l.iso_639_1 === null);
          if (logo) {
            setLogoUrl(`https://image.tmdb.org/t/p/${LOGO_SIZE}${logo.file_path}`);
          }
        }
      } catch (e) { }
    };

    fetchLogo();
    return () => { isMounted = false; };
  }, [isVisible, movie.id, movie.media_type, movie.title]);

  // Collapse popup immediately when page scrolls (popup is fixed, card moves)
  useEffect(() => {
    if (!isHovered) return;
    const collapse = () => {
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
      setIsHovered(false);
      setHoveredRect(null);
      setTrailerUrl(null);
      setIsHoverVideoReady(false);
      activePopupClose = null;
    };
    window.addEventListener('scroll', collapse, { passive: true });
    // Alt-tab / app-switch: collapse immediately when window loses focus
    window.addEventListener('blur', collapse);
    // Tab visibility: collapse if tab goes hidden
    const onVisibility = () => { if (document.visibilityState === 'hidden') collapse(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('scroll', collapse);
      window.removeEventListener('blur', collapse);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [isHovered]);

  // Native passive touch listeners for scroll-vs-tap detection.
  // Registered via useEffect so they are guaranteed passive — the browser
  // never waits on them before committing a scroll gesture.
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const onStart = (e: TouchEvent) => {
      touchStartPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      touchDidScroll.current = false;
    };
    const onMove = (e: TouchEvent) => {
      if (!touchStartPos.current) return;
      const dx = Math.abs(e.touches[0].clientX - touchStartPos.current.x);
      const dy = Math.abs(e.touches[0].clientY - touchStartPos.current.y);
      if (dx > SCROLL_THRESHOLD || dy > SCROLL_THRESHOLD) touchDidScroll.current = true;
    };
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
    };
  }, []);


  // Prefetch stream on hover — pointer events only, never on touch
  // Replaced with onPointerEnter for precise pointer-type detection
  const handlePointerEnter = (e: React.PointerEvent) => {
    // Only process when the user is genuinely on mouse/trackpad input
    if (!prefersHover) return;
    if (e.pointerType === 'touch' || e.pointerType === 'pen') return;

    const mediaType = (movie.media_type || (movie.title ? 'movie' : 'tv')) as 'movie' | 'tv';
    const dateStr = movie.release_date || movie.first_air_date;
    const yearString = dateStr ? dateStr.split('-')[0] : '';

    // Determine screen position for smart popup alignment
    if (cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect();
      const EDGE_BUFFER = 160;
      let currentPos: 'center' | 'left' | 'right' = 'center';
      if (rect.left < EDGE_BUFFER) currentPos = 'left';
      else if (window.innerWidth - rect.right < EDGE_BUFFER) currentPos = 'right';
      setHoverPosition(currentPos);
    }

    // Instant pre-fetch: trailer lookup (TMDB-provided keys take priority)
    if (!trailerUrl && !isBook && movie.id) {
      const savedVideoId = getVideoState(movie.id)?.videoId;
      if (savedVideoId) {
        setTrailerUrl(savedVideoId);
      } else {
        fetchTrailers(movie.id, mediaType).then(keys => {
          if (keys && keys.length > 0) {
            setTrailerUrl(keys[0]);
            updateVideoState(movie.id, 0, keys[0]);
          }
        }).catch(() => { });
      }
    }

    // Cancel any in-flight leave timer so fast re-enters don't flicker
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    // 300ms intent delay before expanding
    timerRef.current = setTimeout(() => {
      // Close any other currently-open popup first (one-at-a-time guarantee)
      if (activePopupClose) {
        activePopupClose();
        activePopupClose = null;
      }
      const rect = cardRef.current?.getBoundingClientRect() ?? null;
      setHoveredRect(rect);
      setIsHovered(true);
      setActiveVideoId(String(movie.id));
      // Register this card's teardown so another card can close us
      activePopupClose = () => {
        setIsHovered(false);
        setHoveredRect(null);
        setTrailerUrl(null);
        setIsHoverVideoReady(false);
      };
      const year = yearString ? parseInt(yearString) : undefined;
      if (year) {
        prefetchStream(movie.title || movie.name || '', year, String(movie.id), mediaType, 1, 1);
      }
    }, 200);
  };

  // handlePointerMove intentionally removed — no zone restriction needed.
  // Leave event handles all collapse logic.

  const handlePointerLeave = () => {
    // Cancel the enter timer immediately — no popup if user just grazed the card
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    // Deregister from global singleton if we were the active popup
    activePopupClose = null;

    // Save trailer progress before collapsing
    if (isHovered && playerRef.current && trailerUrl) {
      try {
        const currentTime = playerRef.current?.getCurrentTime?.() || 0;
        updateVideoState(movie.id, currentTime, trailerUrl);
      } catch (_) { }
    }

    setIsHovered(false);
    setHoveredRect(null);
    setTrailerUrl(null);
    setActiveVideoId(prev => prev === String(movie.id) ? null : prev);
    setIsHoverVideoReady(false);
    if (hoverSyncRef.current) clearInterval(hoverSyncRef.current);
  };

  const getGenreNames = () => {
    if (!movie.genre_ids) return [];
    return movie.genre_ids.map(id => t(`genres.${id}`, { defaultValue: GENRES[id] })).filter(Boolean).slice(0, 3);
  };

  // Computes position:fixed coordinates for the popup.
  // position:fixed bypasses ALL parent overflow clipping (overflow-x:scroll, etc.)
  // so no py-52 hack is needed on the Row strip.
  const getPopupFixedStyle = (): React.CSSProperties => {
    if (!hoveredRect) return { display: 'none' };
    const POPUP_W = 265;
    const TOP_OFFSET = -72; // ← TUNE THIS: more negative = popup higher above the card
    let left: number;
    if (hoverPosition === 'left') {
      left = hoveredRect.left;
    } else if (hoverPosition === 'right') {
      left = hoveredRect.right - POPUP_W;
    } else {
      left = hoveredRect.left + hoveredRect.width / 2 - POPUP_W / 2;
    }
    left = Math.max(8, Math.min(left, window.innerWidth - POPUP_W - 8));
    return {
      position: 'fixed',
      top: hoveredRect.top + TOP_OFFSET,
      left,
      width: POPUP_W,
      zIndex: 9999,
    };
  };

  // Handler that saves state to context before opening modal
  const handleOpenModal = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    // Collapse the hover popup immediately.
    // Without this, the mouse stays inside the card's hit area after InfoModal opens,
    // so isHovered never flips and the portal popup hangs over the modal.
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    setIsHovered(false);
    setHoveredRect(null);
    activePopupClose = null;

    const currentTime = playerRef.current && typeof playerRef.current.getCurrentTime === 'function'
      ? playerRef.current.getCurrentTime()
      : 0;

    const finalTrailerUrl = trailerUrl || getVideoState(movie.id)?.videoId;

    // Store the raw DOMRect BEFORE calling onSelect so InfoModal mounts with it ready.
    // InfoModal reads .left + .top (DOMRect properties, not .x/.y plain object).
    const rawRect = cardRef.current?.getBoundingClientRect();
    if (rawRect) {
      (window as any).__last_card_rect = rawRect;
    }

    if (finalTrailerUrl) {
      updateVideoState(movie.id, currentTime, finalTrailerUrl);
    }
    onSelect(movie, currentTime, finalTrailerUrl);
  };

  const handleDirectPlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    const currentTime = playerRef.current?.getCurrentTime?.() || 0;
    if (trailerUrl) {
      updateVideoState(movie.id, currentTime, trailerUrl);
    }

    if (onPlay) {
      onPlay(movie);
    } else {
      const type = movie.media_type === 'tv' || (!movie.media_type && !movie.title) ? 'tv' : 'movie';
      navigate(`/watch/${type}/${movie.id}`);
    }
  };

  const isBook = ['series', 'comic', 'manga', 'local'].includes(movie.media_type || '');

  const imageSrc = (movie.poster_path?.startsWith('http') || movie.backdrop_path?.startsWith('http') || movie.poster_path?.startsWith('comic://') || movie.backdrop_path?.startsWith('comic://'))
    ? (movie.backdrop_path || movie.poster_path)
    : `https://image.tmdb.org/t/p/w780${movie.backdrop_path || movie.poster_path}`;

  const posterSrc = (movie.poster_path?.startsWith('http') || movie.poster_path?.startsWith('comic://'))
    ? movie.poster_path
    : `https://image.tmdb.org/t/p/w780${movie.poster_path}`;

  return (
    <div
      ref={cardRef}
      className={`relative z-10 group/card select-none
        ${isHovered && prefersHover ? 'z-[999]' : 'z-10'}
        ${isGrid
          ? 'w-full aspect-video cursor-pointer'
          : 'flex-none w-[calc((100vw-3rem)/2.3)] sm:w-[calc((100vw-3rem)/3.3)] md:w-[calc((100vw-3.5rem)/4.3)] lg:w-[calc((100vw-4rem)/6.6)] aspect-[7/4.32] cursor-pointer'
        }`}
      style={prefersHover ? { touchAction: 'none' } : undefined}
      onPointerEnter={prefersHover ? handlePointerEnter : undefined}
      onPointerLeave={prefersHover ? handlePointerLeave : undefined}
      onClick={(e) => {
        // On touch: suppress if the finger moved (scroll gesture), not a tap
        if (touchDidScroll.current) { touchDidScroll.current = false; return; }
        handleOpenModal(e);
      }}
    >
      <div className="w-full h-full relative rounded-sm overflow-hidden movie-card-glow">
        <img
          src={imageSrc}
          className={`w-full h-full object-cover rounded-sm backdrop-pop ${isBook && !isGrid ? 'object-[50%_30%]' : 'object-center'}`}
          alt={movie.name || movie.title}
          loading="lazy"
          draggable={false}
        />

        {/* Gradient overlay in grid mode for logo readability */}
        {isGrid && (
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent pointer-events-none rounded-sm" />
        )}

        {/* Base Title Overlay — logo or text title, no gradient */}
        {!isHovered && (
          <>
            <div className="absolute inset-x-0 bottom-0 flex items-end justify-center pb-3 px-3">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={movie.title || movie.name}
                  onLoad={handleLogoLoad}
                  className={`w-auto object-contain drop-shadow-[0_8px_18px_rgba(0,0,0,0.72)] transition-all duration-300 ${logoDim.isSquare ? 'max-h-16' : 'max-h-11'}`}
                  draggable={false}
                />
              ) : (
                <h3 className={`text-white font-leaner text-center tracking-wide leading-tight drop-shadow-[0_3px_9px_rgba(0,0,0,0.85)] line-clamp-3 mb-2 w-full px-1 ${isBook ? 'text-2xl' : 'text-xl'}`}>
                  {movie.title || movie.name}
                </h3>
              )}
            </div>

            {/* Dynamic Badges on Base Card */}
            <BadgeOverlay badge={badge} isBook={isBook} />
          </>
        )}
      </div>

      {/* Flat progress bar — floats BELOW the card with visible gap, no overflow clipping */}
      {!isHovered && (() => {
        const state = getVideoState(movie.id);
        const lastEp = getLastWatchedEpisode(movie.id);
        const isTV = movie.media_type === 'tv' || (!movie.media_type && !movie.title);
        let pct = 0;
        if (!isTV && state?.time && state?.duration) {
          pct = Math.min(100, (state.time / state.duration) * 100);
        } else if (isTV && lastEp) {
          const epProg = getEpisodeProgress(movie.id, lastEp.season, lastEp.episode);
          if (epProg?.duration) pct = Math.min(100, (epProg.time / epProg.duration) * 100);
        }
        if (pct < 2) return null;

        return (
          // 4px tall, floats 6px below card, 10% horizontal inset for visibility
          <div
            className="absolute pointer-events-none z-20"
            style={{ top: 'calc(100% + 6px)', left: '10%', right: '10%' }}
          >
            <div className="h-[4px] w-full bg-white/25" style={{ borderRadius: 2 }}>
              <div
                className="h-full bg-[#e50914] transition-all duration-300"
                style={{ width: `${pct}%`, borderRadius: 2 }}
              />
            </div>
          </div>
        );
      })()}

      {/* Hover Popup — rendered into document.body via portal.
           Bypasses ALL ancestor stacking contexts and overflow clipping.
           position:fixed + z-9999 is now truly global. */}
      {createPortal(
        <AnimatePresence>
          {isHovered && prefersHover && hoveredRect && (
            <motion.div
              className="bg-[#141414] rounded-md movie-card-glow overflow-hidden ring-1 ring-zinc-700/50 shadow-[0_8px_40px_rgba(0,0,0,0.85)]"
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, y: 8, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.97 }}
              transition={{ duration: 0.18, ease: [0.25, 0.46, 0.45, 0.94] }}
              style={{
                ...getPopupFixedStyle(),
                willChange: 'transform, opacity',
                transformOrigin: hoverPosition === 'left' ? 'top left' : hoverPosition === 'right' ? 'top right' : 'top center',
              }}
            >
              {/* Media Container — taller to avoid info section getting cut */}
              <div className="relative h-[155px] md:h-[172px] bg-[#141414] overflow-hidden rounded-t-md" onClick={handleOpenModal}>

                {(trailerUrl && !isBook) ? (
                  <>
                    {/* Backdrop stays visible until trailer is actually playing */}
                    <img
                      src={imageSrc}
                      className={`absolute inset-0 w-full h-full object-cover backdrop-pop transition-opacity duration-500 ${isHoverVideoReady ? 'opacity-0' : 'opacity-100'}`}
                      alt="preview"
                    />
                    <div className={`absolute inset-0 transition-opacity duration-700 ${isHoverVideoReady ? 'opacity-100' : 'opacity-0'}`}>
                      <div className="absolute top-[40%] left-1/2 w-[200%] h-[200%] -translate-x-1/2 -translate-y-1/2 pointer-events-none">
                        <YouTube
                          videoId={trailerUrl}
                          opts={{
                            height: '100%',
                            width: '100%',
                            playerVars: {
                              autoplay: 1,
                              controls: 0,
                              modestbranding: 1,
                              loop: 1,
                              playlist: trailerUrl,
                              disablekb: 1,
                              fs: 0,
                              rel: 0,
                              iv_load_policy: 3,
                              cc_load_policy: 0,
                              start: 5,
                            }
                          }}
                          onReady={(e) => {
                            playerRef.current = e.target;
                            if (isMuted) {
                              e.target.mute();
                            } else {
                              e.target.unMute();
                            }

                            // Seamless sync: continue from where InfoModal or Hero left off
                            const savedState = getVideoState(movie.id);
                            if (savedState && savedState.time > 0 && savedState.videoId === trailerUrl) {
                              e.target.seekTo(savedState.time, true);
                            }
                          }}
                          onStateChange={(e) => {
                            const YT_PLAYING = 1;
                            const YT_PAUSED = 2;

                            // Mark video as ready only when actually playing
                            if (e.data === YT_PLAYING && !isHoverVideoReady) {
                              setIsHoverVideoReady(true);
                            }

                            // Save progress every 1s to GlobalContext
                            if (e.data === YT_PLAYING) {
                              if (hoverSyncRef.current) clearInterval(hoverSyncRef.current);
                              hoverSyncRef.current = setInterval(() => {
                                try {
                                  const time = playerRef.current?.getCurrentTime?.();
                                  if (time > 0 && trailerUrl) {
                                    updateVideoState(movie.id, time, trailerUrl);
                                  }
                                } catch (_) { }
                              }, 1000);
                            }

                            if (e.data === YT_PAUSED) {
                              if (hoverSyncRef.current) clearInterval(hoverSyncRef.current);
                            }
                          }}
                          onError={(e) => {
                            console.warn("YouTube blocked playback:", e);
                            setTrailerUrl("");
                            setIsHoverVideoReady(false);
                          }}
                          onEnd={(e) => {
                            e.target.seekTo(0);
                            e.target.playVideo();
                          }}
                          className="w-full h-full object-cover"
                        />
                        {/* Transparent shield — covers YouTube's native pause/play overlay */}
                        <div className="absolute inset-0 z-[1] pointer-events-none" />
                      </div>
                    </div>
                    {/* YouTube caption overlay — driven by useSubtitleStyle (settings-synced) */}
                    {subtitlesEnabled && activeCue && (
                      <div style={overlayStyleCompact}>
                        {activeCue}
                      </div>
                    )}
                  </>
                ) : (
                  <img
                    src={imageSrc}
                    className={`w-full h-full object-cover backdrop-pop ${isBook ? 'object-[50%_30%]' : 'object-center'}`}
                    alt="preview"
                  />
                )}
                {activeCue && trailerUrl && !isBook && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '8%',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      zIndex: 20,
                      pointerEvents: 'none',
                      textAlign: 'center',
                      maxWidth: '88%',
                      padding: '4px 10px',
                      background: 'rgba(0,0,0,0.72)',
                      borderRadius: '6px',
                      color: '#ffffff',
                      fontFamily: "'Inter', sans-serif",
                      fontSize: 'clamp(11px, 1.4vw, 14px)',
                      fontWeight: 500,
                      lineHeight: 1.35,
                      letterSpacing: '0.01em',
                      textShadow: '0 1px 3px rgba(0,0,0,0.9)',
                      transition: 'opacity 0.15s ease',
                    }}
                  >
                    {activeCue}
                  </div>
                )}

                {/* Mute Button - Hide for books */}
                {trailerUrl && !isBook && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setIsMuted(!isMuted); }}

                    className="absolute bottom-4 right-4 w-9 h-9 rounded-full border border-white/40 bg-zinc-900/40 backdrop-blur-md flex items-center justify-center transition-all duration-300 hover:bg-white/10 hover:scale-110 hover:border-white z-50 pointer-events-auto cursor-pointer shadow-lg"
                  >
                    {isMuted ? <SpeakerSlashIcon size={18} className="text-white" /> : <SpeakerHighIcon size={18} className="text-white" />}
                  </button>
                )}

                <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[#181818] to-transparent z-10 pointer-events-none" />

                <div className="absolute bottom-3 left-4 right-12 pointer-events-none z-20">
                  {logoUrl && !imgFailed ? (
                    <img
                      src={logoUrl}
                      alt={movie.title || movie.name}
                      className={`w-auto object-contain origin-bottom-left drop-shadow-2xl transition-all duration-300 ${logoDim.isSquare ? 'h-14 md:h-20' : 'h-10 md:h-12'}`}
                      onError={() => setImgFailed(true)}
                    />
                  ) : (
                    <h4 className="text-white font-leaner text-4xl line-clamp-2 drop-shadow-md tracking-wide text-center mb-2 leading-none">{movie.title || movie.name}</h4>
                  )}
                </div>
              </div>

              {/* Netflix-style hover progress bar: flat, red, '11 of 43m' */}
              <HoverProgressBar movie={movie} getLastWatchedEpisode={getLastWatchedEpisode} getVideoState={getVideoState} />

              {/* Info Section */}
              <div className="px-3 pt-2.5 pb-4 space-y-3 bg-[#181818]">

                {/* Action Buttons Row */}
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    {/* Play/Read/Theater Button */}
                    {isCinemaOnly && !isBook ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleOpenModal(); }}
                        className="bg-[#6d6d6e] text-white rounded-full w-8 h-8 md:w-9 md:h-9 flex items-center justify-center hover:bg-neutral-500 transition active:scale-95"
                        title="In Theaters"
                      >
                        <TicketIcon size={18} weight="bold" />
                      </button>
                    ) : (
                      <Link
                        to={`/watch/${movie.media_type === 'tv' || (!movie.media_type && !movie.title) ? 'tv' : 'movie'}/${movie.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="bg-white text-black rounded-full w-8 h-8 md:w-9 md:h-9 flex items-center justify-center hover:bg-neutral-200 transition active:scale-95 shadow-md hover:scale-110 duration-200"
                        title={isBook ? "Read Now" : "Play"}
                      >
                        {isBook ? <BookOpenIcon size={18} weight="fill" /> : <PlayIcon size={22} weight="fill" className="ml-0.5" />}
                      </Link>
                    )}
                    {/* Add to List — subtle animation on state change */}
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleList(movie); }}
                      className={`border-2 rounded-full w-8 h-8 md:w-9 md:h-9 flex items-center justify-center text-white transition-all duration-200 hover:scale-110 active:scale-90
                      ${isAdded ? 'border-white bg-white/10 shadow-[0_0_8px_rgba(255,255,255,0.25)]' : 'border-gray-500 bg-[#2a2a2a]/80 hover:border-white'}`}
                      title={isAdded ? 'Remove from My List' : 'Add to My List'}
                    >
                      {isAdded ? <CheckIcon size={16} weight="bold" /> : <PlusIcon size={16} weight="bold" />}
                    </button>
                    {/* Rate — Love / Like / Dislike pill */}
                    <RatingPill
                      rating={getMovieRating(movie.id)}
                      onRate={(r) => { rateMovie(movie, r); }}
                    />
                  </div>

                  {/* More Info - Chevron Down */}
                  <button
                    onClick={handleOpenModal}
                    className="border-2 border-gray-500 bg-[#2a2a2a]/80 rounded-full w-8 h-8 md:w-9 md:h-9 flex items-center justify-center hover:border-white hover:scale-110 transition-all duration-200 text-white"
                    title="More Info"
                  >
                    <CaretDownIcon size={18} weight="bold" />
                  </button>
                </div>

                {/* Metadata Row */}
                <div className="flex items-center flex-wrap gap-1.5 text-[13px] font-medium">
                  {/* Maturity Rating Badge — from MovieCardBadges */}
                  <MaturityBadge adult={movie.adult} voteAverage={movie.vote_average} />

                  {/* Runtime or Season count */}
                  <span className="text-white/70">
                    {isBook ? (movie.media_type === 'series' ? 'Series' : 'Comic') :
                      movie.media_type === 'tv'
                        ? (() => { const n = Math.max(1, Math.ceil((movie.vote_count || 10) / 500)); return `${n} ${n === 1 ? 'Season' : 'Seasons'}`; })()
                        : movie.runtime ? `${Math.floor(movie.runtime / 60)}h ${movie.runtime % 60}m`
                          : `${Math.floor((movie.popularity || 100) / 10 + 80)}m`
                    }
                  </span>

                  {!isBook && <span className="border border-gray-500 text-gray-400 px-1 py-[0.5px] text-[9px] rounded-[2px]">HD</span>}
                </div>

                {/* Genres Row — clickable, dispatches search */}
                <div className="flex flex-wrap items-center gap-y-0.5 text-[12.5px] font-medium">
                  {getGenreNames().map((genre, idx) => (
                    <span key={idx} className="flex items-center">
                      <span
                        className="text-white/75 hover:text-[#e50914] cursor-pointer transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePointerLeave();
                          triggerSearch(navigate, genre);
                        }}
                      >{genre}</span>
                      {idx < getGenreNames().length - 1 && <span className="text-gray-500 mx-1.5 text-[8px] leading-none">•</span>}
                    </span>
                  ))}
                </div>

              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
};

export default React.memo(MovieCard);