import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useNavigate, Link } from 'react-router-dom';
import { useIsInTheaters } from '../hooks/useIsInTheaters';
import { SpeakerSlashIcon, SpeakerHighIcon, PlayIcon, CheckIcon, PlusIcon, ThumbsUpIcon, ThumbsDownIcon, HeartIcon, CaretDownIcon, BookOpenIcon, TicketIcon, ArrowCounterClockwiseIcon } from '@phosphor-icons/react';
import { useGlobalContext } from '../context/GlobalContext';
import { GENRES, LOGO_SIZE } from '../constants';
import { getMovieImages, prefetchStream, getExternalIds, getMovieDetails } from '../services/api';
import { Movie } from '../types';
import { TrailerPlayer } from './TrailerPlayer';
import {MaturityBadge, BadgeOverlay, HoverProgressBar, getWatchData} from './MovieCardBadges';

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
        className={`flex items-center gap-1 overflow-hidden transition-all duration-300 border-2 rounded-full bg-[#2a2a2a]/90 backdrop-blur-md shadow-lg
          ${expanded ? 'border-white/80 px-4 gap-5' : 'border-gray-500 justify-center w-10 h-10 md:w-11 md:h-11'}`}
        style={{ height: expanded ? 42 : undefined }}
      >
        {expanded ? (
          <>
            {(['love', 'like', 'dislike'] as MovieRating[]).map(r => {
              const Icon = r === 'love' ? HeartIcon : r === 'like' ? ThumbsUpIcon : ThumbsDownIcon;
              const isActive = rating === r;
              const color = r === 'love' ? 'text-red-500' : r === 'like' ? 'text-blue-400' : 'text-gray-400';
              return (
                <button
                  key={r}
                  onClick={(e) => { e.stopPropagation(); onRate(r); setExpanded(false); }}
                  className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-125 flex-shrink-0
                    ${isActive ? color : 'text-white/60 hover:text-white'}`}
                  title={r.charAt(0).toUpperCase() + r.slice(1)}
                >
                  <Icon size={26} weight={isActive ? 'fill' : 'bold'} />
                </button>
              );
            })}
          </>
        ) : (
          <CurrentIcon 
            size={24} 
            weight={rating ? 'fill' : 'bold'} 
            className={rating === 'love' ? 'text-red-500' : rating === 'like' ? 'text-blue-400' : rating === 'dislike' ? 'text-gray-400' : 'text-white'} 
          />
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
    globalMute, setGlobalMute, clearVideoState
  } = useGlobalContext();
  const [isHovered, setIsHovered] = useState(false);
  const [isPrimed, setIsPrimed] = useState(false); // Immediate visual feedback
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [imgFailed, setImgFailed] = useState(false);
  const isCinemaOnly = useIsInTheaters(movie);
  const [replayCount, setReplayCount] = useState(0);
  const [isHoverVideoReady, setIsHoverVideoReady] = useState(false);
  const [hasVideoEnded, setHasVideoEnded] = useState(false);
  const [logoFaded, setLogoFaded] = useState(false);

  useEffect(() => {
    if (isHoverVideoReady && !hasVideoEnded) {
      const t = setTimeout(() => setLogoFaded(true), 3500);
      return () => clearTimeout(t);
    } else {
      setLogoFaded(false);
    }
  }, [isHoverVideoReady, hasVideoEnded]);

  // Touch scroll detection via native (passive) listeners added in useEffect.
  // Native passive listeners never block scrolling — React synthetic onTouchStart
  // can delay scroll commit even when marked passive, so we avoid it entirely.
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);
  const touchDidScroll = useRef(false);
  const SCROLL_THRESHOLD = 8;

  // Bi-directional sync is now handled natively by TrailerPlayer.

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

    const year = yearString ? parseInt(yearString) : undefined;
    const mediaType = (movie.media_type === 'tv' ? 'tv' : 'movie') as 'movie' | 'tv';
    
    // Prefetch disabled on hover to prevent aggressive background requests
    // if (year) {
    //   prefetchStream(movie.title || movie.name || '', year, String(movie.id), mediaType, 1, 1);
    // }

    // Cancel any in-flight leave timer so fast re-enters don't flicker
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    // 260ms intent delay — slightly more forgiving than 200ms to filter fast pass-throughs
    timerRef.current = setTimeout(() => {
      // Velocity guard: if pointer moved quickly (> 1.8 px/ms avg) since enter,
      // the user is likely sweeping across cards, not deliberately hovering.
      // We skip the popup and let the next slow hover trigger it instead.
      const rect = cardRef.current?.getBoundingClientRect();
      if (!rect) return;
      const dx = e.clientX - rect.left - rect.width / 2;
      const dy = e.clientY - rect.top - rect.height / 2;
      // If cursor entered from far outside center, it's a fast sweep — bail
      if (Math.sqrt(dx * dx + dy * dy) > rect.width * 0.7) return;

      // Close any other currently-open popup first (one-at-a-time guarantee)
      if (activePopupClose) {
        activePopupClose();
        activePopupClose = null;
      }
      setHoveredRect(rect);
      setIsHovered(true);
      setActiveVideoId(`card-${movie.id}`);
      // Register this card's teardown so another card can close us
      activePopupClose = () => {
        setIsHovered(false);
        setHoveredRect(null);
        setIsHoverVideoReady(false);
      };
      // Removed prefetchStream here to prevent aggressive backend calls on hover
    }, 500);
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

    setIsHovered(false);
    setHoveredRect(null);
    setActiveVideoId(prev => prev === `card-${movie.id}` ? null : prev);
    setIsHoverVideoReady(false);
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
    const POPUP_W = 336;
    const TOP_OFFSET = -88; // ← TUNE THIS: more negative = popup higher above the card
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

    // Final state sync happens inside handleOpenModal now uses GlobalContext
    const finalTrailerUrl = getVideoState(movie.id)?.videoId;

    // Store the raw DOMRect BEFORE calling onSelect so InfoModal mounts with it ready.
    // InfoModal reads .left + .top (DOMRect properties, not .x/.y plain object).
    const rawRect = cardRef.current?.getBoundingClientRect();
    if (rawRect) {
      (window as any).__last_card_rect = rawRect;
    }

    const savedState = getVideoState(movie.id);
    onSelect(movie, savedState?.time || 0, savedState?.videoId || undefined);
  };

  const handleDirectPlay = (e: React.MouseEvent) => {
    e.stopPropagation();

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
    : `https://image.tmdb.org/t/p/w1280${movie.backdrop_path || movie.poster_path}`;

  const posterSrc = (movie.poster_path?.startsWith('http') || movie.poster_path?.startsWith('comic://'))
    ? movie.poster_path
    : `https://image.tmdb.org/t/p/w1280${movie.poster_path}`;

  return (
    <div
      ref={cardRef}
      className={`relative z-10 group/card select-none
        ${isHovered && prefersHover ? 'z-[999]' : 'z-10'}
        ${isGrid
          ? 'w-full aspect-video cursor-pointer'
          : 'flex-none w-[calc((100vw-3rem)/2.3)] sm:w-[calc((100vw-3rem)/3.3)] md:w-[calc((100vw-3.5rem)/4.3)] lg:w-[calc((100vw-4rem)/6.6)] aspect-[7/4.20] cursor-pointer'
        }`}
      style={prefersHover ? { touchAction: 'none' } : undefined}
      onPointerEnter={prefersHover ? handlePointerEnter : undefined}
      onPointerLeave={prefersHover ? handlePointerLeave : undefined}
      onClick={(e) => {
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
                  className={`w-auto object-contain transition-all duration-300 ${logoDim.isSquare ? 'max-h-16' : 'max-h-11'}`}
                  style={{
                    filter: 'drop-shadow(0 12px 25px rgba(0,0,0,0.5)) drop-shadow(0 4px 5px rgba(0,0,0,0.35))',
                  }}
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
          // Floating bar — sits in the 14px padding zone the Row adds when progress exists
          <div
            className="absolute pointer-events-none z-20"
            style={{ top: 'calc(100% + 4px)', left: '10%', right: '10%' }}
          >
            <div className="h-[4px] w-full" style={{ background: 'rgba(200,200,200,0.28)', borderRadius: 0 }}>
              <div
                className="h-full transition-all duration-300"
                style={{ width: `${pct}%`, background: '#e50914', borderRadius: 0 }}
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
              className="bg-[#141414] rounded-md movie-card-glow overflow-hidden ring-1 ring-zinc-700/50 shadow-[0_2px_20px_rgba(0,0,0,0.65)]"
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
              <div className="relative w-[336px] h-[189px] bg-[#141414] overflow-hidden rounded-t-md" onClick={handleOpenModal}>

                {(!isBook) ? (
                  <>
                    <img
                      src={imageSrc}
                      className={`absolute inset-0 w-full h-full object-cover backdrop-pop transition-opacity duration-500 scale-[1.05] ${isHoverVideoReady ? 'opacity-0' : 'opacity-100'}`}
                      alt="preview"
                    />
                    <div className={`absolute inset-0 transition-opacity duration-700 overflow-hidden ${isHoverVideoReady ? 'opacity-100' : 'opacity-0'}`}>
                        <TrailerPlayer 
                            key={`card-player-${replayCount}`}
                            movie={movie} 
                            variant="card"
                            onReady={() => setIsHoverVideoReady(true)}
                            onEnded={() => {
                                setIsHoverVideoReady(false);
                                setHasVideoEnded(true);
                            }}
                            onErrored={() => setIsHoverVideoReady(false)}
                        />
                    </div>
                  </>
                ) : (
                  <img
                    src={imageSrc}
                    className={`w-full h-full object-cover backdrop-pop object-[50%_30%]`}
                    alt="preview"
                  />
                )}

                {/* Mute Button - Hide for books */}
                {!isBook && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (hasVideoEnded) {
                        clearVideoState(movie.id);
                        setHasVideoEnded(false);
                        setIsHoverVideoReady(true);
                        setReplayCount(c => c + 1);
                      } else {
                        setGlobalMute(!globalMute);
                      }
                    }}
                    className="absolute bottom-4 right-4 w-9 h-9 rounded-full border border-white/40 bg-zinc-900/40 backdrop-blur-md flex items-center justify-center transition-all duration-300 hover:bg-white/10 hover:scale-110 hover:border-white z-50 pointer-events-auto cursor-pointer shadow-lg"
                  >
                    {hasVideoEnded
                      ? <ArrowCounterClockwiseIcon size={24} className="text-white" />
                      : globalMute ? <SpeakerSlashIcon size={24} className="text-white" /> : <SpeakerHighIcon size={18} className="text-white" />
                    }
                  </button>
                )}

                <div className="absolute inset-x-0 bottom-0 h-7 bg-gradient-to-t from-[#181818]/70 to-transparent z-10 pointer-events-none" />

                <div className={`absolute bottom-3 left-4 right-12 pointer-events-none z-20 transition-opacity duration-1000 ${logoFaded ? 'opacity-0' : 'opacity-100'}`}>
                  {logoUrl && !imgFailed ? (
                    <div className="relative inline-flex items-end">
                      {/* Blurred shadow copy — creates a perfectly logo-shaped dark halo.
                          Works against any background (white snow, dark sky, etc). */}
                      {/* Multi-layer premium shadow copy */}
                      <img
                        src={logoUrl}
                        aria-hidden
                        className={`absolute w-auto object-contain origin-bottom-left ${logoDim.isSquare ? 'h-14 md:h-20' : 'h-10 md:h-12'}`}
                        style={{
                          filter: 'blur(4px) brightness(0) opacity(0.8)',
                          transform: 'translate(1px, 2px) scale(1.01)',
                          zIndex: 0,
                        }}
                      />
                      <img
                        src={logoUrl}
                        aria-hidden
                        className={`absolute w-auto object-contain origin-bottom-left ${logoDim.isSquare ? 'h-14 md:h-20' : 'h-10 md:h-12'}`}
                        style={{
                          filter: 'blur(20px) brightness(0) opacity(0.5)',
                          transform: 'translate(2px, 4px) scale(1.06)',
                          zIndex: 0,
                        }}
                      />
                      <img
                        src={logoUrl}
                        alt={movie.title || movie.name}
                        className={`relative w-auto object-contain origin-bottom-left transition-all duration-300 z-[1] ${logoDim.isSquare ? 'h-14 md:h-20' : 'h-10 md:h-12'}`}
                        onError={() => setImgFailed(true)}
                      />
                    </div>
                  ) : (
                    <h4 className="text-white font-leaner text-4xl line-clamp-2 drop-shadow-md tracking-wide text-center mb-2 leading-none">{movie.title || movie.name}</h4>
                  )}
                </div>
              </div>



              {/* Info Section */}
              <div className="px-4 pt-6 pb-5 space-y-4 bg-[#181818]">
                {/* Action Buttons Row */}
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-4">
                    {/* Play/Read/Theater Button */}
                    {isCinemaOnly && !isBook ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleOpenModal(); }}
                        className="bg-[#6d6d6e] text-white rounded-full w-10 h-10 md:w-11 md:h-11 flex items-center justify-center hover:bg-neutral-500 transition active:scale-95 shadow-lg"
                        title="In Theaters"
                      >
                        <TicketIcon size={22} weight="bold" />
                      </button>
                    ) : (
                      <Link
                        to={`/watch/${movie.media_type === 'tv' || (!movie.media_type && !movie.title) ? 'tv' : 'movie'}/${movie.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="bg-white text-black rounded-full w-10 h-10 md:w-11 md:h-11 flex items-center justify-center hover:bg-neutral-200 transition active:scale-95 shadow-md hover:scale-110 duration-200"
                        title={isBook ? "Read Now" : "Play"}
                      >
                        {isBook ? <BookOpenIcon size={24} weight="fill" /> : <PlayIcon size={28} weight="fill" className="ml-0.5" />}
                      </Link>
                    )}
                    {/* Add to List — subtle animation on state change */}
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleList(movie); }}
                      className={`border-2 rounded-full w-10 h-10 md:w-11 md:h-11 flex items-center justify-center text-white transition-all duration-200 hover:scale-110 active:scale-90
                      ${isAdded ? 'border-white bg-white/10 shadow-[0_0_8px_rgba(255,255,255,0.25)]' : 'border-gray-500 bg-[#2a2a2a]/80 hover:border-white'}`}
                      title={isAdded ? 'Remove from My List' : 'Add to My List'}
                    >
                      {isAdded ? <CheckIcon size={28} weight="bold" /> : <PlusIcon size={28} weight="bold" />}
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
                    className="border-2 border-gray-500 bg-[#2a2a2a]/80 rounded-full w-10 h-10 md:w-11 md:h-11 flex items-center justify-center hover:border-white hover:scale-110 transition-all duration-200 text-white"
                    title="More Info"
                  >
                    <CaretDownIcon size={24} weight="bold" />
                  </button>
                </div>

                {/* Metadata Row */}
                <div className="flex items-center flex-wrap gap-1.5 text-[13px] font-medium">
                  {/* Maturity Rating Badge — from MovieCardBadges */}
                  <MaturityBadge adult={movie.adult} voteAverage={movie.vote_average} />

                  {/* Runtime or Season count */}
                  {(() => {
                    if (isBook) return <span className="text-white/70">{movie.media_type === 'series' ? 'Series' : 'Comic'}</span>;
                    const isTV = movie.media_type === 'tv' || (!movie.media_type && !movie.title);
                    if (isTV) {
                      const s = movie.number_of_seasons;
                      return <span className="text-white/70">{s ? `${s} ${s === 1 ? 'Season' : 'Seasons'}` : 'TV Series'}</span>;
                    }
                    if (!movie.runtime) return null; // no fake duration for movies
                    const h = Math.floor(movie.runtime / 60);
                    const m = movie.runtime % 60;
                    const label = h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ''}` : `${m}m`;
                    return <span className="text-white/70">{label}</span>;
                  })()}

                  {!isBook && <span className="border border-gray-300 text-gray-200 px-1 py-[2px] text-[14px] font-bold rounded-[2px] ml-3">HD</span>}
                </div>

                {/* Genres Row or Progress Bar */}
                {getWatchData(movie, getLastWatchedEpisode, getVideoState).pct > 0 ? (
                  <div className="pt-0.5 pb-1">
                    <HoverProgressBar movie={movie} getLastWatchedEpisode={getLastWatchedEpisode} getVideoState={getVideoState} />
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-y-0.5 text-[12.5px] font-medium">
                    {movie.genre_ids?.slice(0, 3).map((genreId, idx, arr) => {
                      const genreName = t(`genres.${genreId}`, { defaultValue: GENRES[genreId] });
                      if (!genreName) return null;
                      const isTV = movie.media_type === 'tv' || (!movie.media_type && !movie.title);
                      return (
                        <span key={genreId} className="flex items-center">
                          <span
                            className="text-grey-400 hover:text-white cursor-pointer transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePointerLeave();
                              navigate(`/browse/genre-${genreId}?title=${encodeURIComponent(genreName)}&url=${encodeURIComponent(`/discover/${isTV ? 'tv' : 'movie'}?with_genres=${genreId}&sort_by=popularity.desc`)}`);
                            }}
                          >{genreName}</span>
                          {idx < arr.length - 1 && <span className="text-gray-500 mx-1.5 text-[16px] leading-none">•</span>}
                        </span>
                      );
                    })}
                  </div>
                )}

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