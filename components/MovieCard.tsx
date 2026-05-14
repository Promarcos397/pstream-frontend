import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { useIsInTheaters } from '../hooks/useIsInTheaters';
import { SpeakerSlashIcon, SpeakerHighIcon, PlayIcon, CheckIcon, PlusIcon, ThumbsUpIcon, ThumbsDownIcon, HeartIcon, CaretDownIcon, BookOpenIcon, TicketIcon, ArrowCounterClockwiseIcon } from '@phosphor-icons/react';
import { useGlobalContext } from '../context/GlobalContext';
import { GENRES, LOGO_SIZE } from '../constants';
import { getMovieImages } from '../services/api';
import { Movie } from '../types';
import { TrailerPlayer } from './TrailerPlayer';
import {MaturityBadge, BadgeOverlay, HoverProgressBar, getWatchData} from './MovieCardBadges';
import { searchTrailerWithMeta } from '../services/YouTubeService';

// ─── Runtime pointer-type tracker ────────────────────────────────────────────
type _PHListener = (v: boolean) => void;
const _phSubs = new Set<_PHListener>();
let _prefersHover = false;

if (typeof window !== 'undefined') {
  window.addEventListener('pointermove', (e: PointerEvent) => {
    const next = e.pointerType === 'mouse';
    if (next !== _prefersHover) { _prefersHover = next; _phSubs.forEach(f => f(next)); }
  }, { passive: true });
  window.addEventListener('mousedown', () => {
    if (!_prefersHover) { _prefersHover = true; _phSubs.forEach(f => f(true)); }
  }, { passive: true });
  window.addEventListener('touchstart', () => {
    if (_prefersHover) { _prefersHover = false; _phSubs.forEach(f => f(false)); }
  }, { passive: true });
}

function usePrefersHover(): boolean {
  const [val, setVal] = useState(_prefersHover);
  useEffect(() => {
    setVal(_prefersHover);
    _phSubs.add(setVal);
    return () => { _phSubs.delete(setVal); };
  }, []);
  return val;
}
// ─────────────────────────────────────────────────────────────────────────────



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
    activePopupId, setActivePopupId,
    globalMute, setGlobalMute, clearVideoState
  } = useGlobalContext();
  const [isHovered, setIsHovered] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [imgFailed, setImgFailed] = useState(false);
  const isCinemaOnly = useIsInTheaters(movie);
  const [replayCount, setReplayCount] = useState(0);
  const [isHoverVideoReady, setIsHoverVideoReady] = useState(false);
  const [isActuallyPlaying, setIsActuallyPlaying] = useState(false);
  const [hasVideoEnded, setHasVideoEnded] = useState(false);
  const [logoFaded, setLogoFaded] = useState(false);

  useEffect(() => {
    if (isActuallyPlaying && !hasVideoEnded) {
      const t = setTimeout(() => setLogoFaded(true), 3500);
      return () => clearTimeout(t);
    } else {
      setLogoFaded(false);
    }
  }, [isActuallyPlaying, hasVideoEnded]);

  const touchStartPos = useRef<{ x: number; y: number } | null>(null);
  const touchDidScroll = useRef(false);
  const SCROLL_THRESHOLD = 8;

  const [hoverPosition, setHoverPosition] = useState<'center' | 'left' | 'right'>('center');
  const [hoveredRect, setHoveredRect] = useState<DOMRect | null>(null);

  const isAdded = myList.find(m => m.id === movie.id);
  const timerRef = useRef<any>(null);
  const leaveTimerRef = useRef<any>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const getBadgeInfo = () => {
    const isTV = movie.media_type === 'tv' || (!movie.media_type && !movie.title);
    const movieIdNum = Number(movie.id);

    if (isTV && top10TV?.includes(movieIdNum)) {
      return { text: 'Top 10', type: 'top' };
    }
    if (!isTV && top10Movies?.includes(movieIdNum)) {
      return { text: 'Top 10', type: 'top' };
    }

    const dateStr = movie.release_date || movie.first_air_date;
    const now = new Date();

    if (dateStr) {
      const releaseDate = new Date(dateStr);
      const diffTime = releaseDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays > 0 && diffDays <= 30) {
        return { text: 'Coming Soon', type: 'upcoming' };
      }

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

  const [logoDim, setLogoDim] = useState<{ ratio: number; isSquare: boolean }>({ ratio: 1.5, isSquare: false });
  const handleLogoLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = e.currentTarget;
    const ratio = naturalWidth / naturalHeight;
    setLogoDim({ ratio, isSquare: ratio < 1.35 });
  };

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

  useEffect(() => {
    const myId = `card-${movie.id}`;
    if (activePopupId && activePopupId !== myId && isHovered) {
      setIsHovered(false);
      setHoveredRect(null);
      setIsHoverVideoReady(false);
    }
  }, [activePopupId, movie.id, isHovered]);

  useEffect(() => {
    const myId = `card-${movie.id}`;
    if (activeVideoId && activeVideoId !== myId && isHovered && activeVideoId.indexOf('modal') === -1) {
      setIsHovered(false);
      setHoveredRect(null);
    }
  }, [activeVideoId, movie.id, isHovered]);

  useEffect(() => {
    if (!isHovered) return;
    const collapse = () => {
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
      if (leaveTimerRef.current) { clearTimeout(leaveTimerRef.current); leaveTimerRef.current = null; }
      setIsHovered(false);
      setHoveredRect(null);
      setIsHoverVideoReady(false);
      setIsActuallyPlaying(false);
      const myId = `card-${movie.id}`;
      if (activePopupId === myId) setActivePopupId(null);
      if (activeVideoId === myId) setActiveVideoId(null);
    };
    window.addEventListener('scroll', collapse, { passive: true });
    window.addEventListener('blur', collapse);
    const onVisibility = () => { if (document.visibilityState === 'hidden') collapse(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('scroll', collapse);
      window.removeEventListener('blur', collapse);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [isHovered]);

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


  // ─── TWO-STAGE HOVER PIPELINE ─────────────────────────────────────────────
  // Stage 1 (PRIME): At ~300ms we pre-fetch the trailer so the YouTube API
  // search is already warm by the time the popup appears.
  // Stage 2 (SHOW): At ~800ms the popup appears and TrailerPlayer mounts
  // with videoId already known — playback starts almost instantly.
  // ──────────────────────────────────────────────────────────────────────────

  const PRIME_DELAY = 300;      // ms: start warming the trailer cache
  const SHOW_DELAY = 800;       // ms: reveal popup (must be > PRIME_DELAY)

  const handlePointerEnter = (e: React.PointerEvent) => {
    if (!prefersHover) return;
    if (e.pointerType === 'touch' || e.pointerType === 'pen') return;

    if (cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect();
      const EDGE_BUFFER = 160;
      let currentPos: 'center' | 'left' | 'right' = 'center';
      if (rect.left < EDGE_BUFFER) currentPos = 'left';
      else if (window.innerWidth - rect.right < EDGE_BUFFER) currentPos = 'right';
      setHoverPosition(currentPos);
    }
    
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    const anotherCardIsActive = activeVideoId && 
        activeVideoId.startsWith('card-') && 
        activeVideoId !== `card-${movie.id}`;

    // ── STAGE 1: PRIME ─────────────────────────────────────────────────────
    // If another card is playing, the user is actively browsing — we can
    // afford to prime even faster because they're clearly in "trailer mode".
    const primeDelay = anotherCardIsActive ? 80 : PRIME_DELAY;
    const primeTimer = setTimeout(() => {
      // Warm the trailer cache in the background. This calls YouTubeService
      // which caches the result globally. When TrailerPlayer mounts at SHOW
      // time, useTrailer will hit the cache instantly.
      const title = movie.original_title || movie.original_name || movie.title || movie.name || '';
      const year = (movie.release_date || movie.first_air_date || '').slice(0, 4);
      const type = movie.media_type || (movie.title ? 'movie' : 'tv');
      const isAnimation = movie.genre_ids?.includes(16) || movie.genres?.some(g => g.id === 16);
      const isAnime = isAnimation && movie.original_language === 'ja';
      
      if (title) {
        searchTrailerWithMeta({ title, year, type: type as 'movie' | 'tv', isAnime })
          .then(result => {
            if (result) {
              // Proactively cache so useTrailer sees it immediately
              updateVideoState(movie.id, 0, result.videoId);
            }
          })
          .catch(() => { /* silent — TrailerPlayer will retry if needed */ });
      }
    }, primeDelay);

    // ── STAGE 2: SHOW ──────────────────────────────────────────────────────
    const showDelay = anotherCardIsActive ? 180 : SHOW_DELAY;
    const showTimer = setTimeout(() => {
      const rect = cardRef.current?.getBoundingClientRect();
      if (!rect) return;
      const dx = e.clientX - rect.left - rect.width / 2;
      const dy = e.clientY - rect.top - rect.height / 2;
      if (Math.sqrt(dx * dx + dy * dy) > rect.width * 0.7) return;

      setHoveredRect(rect);
      setIsHovered(true);
      const myId = `card-${movie.id}`;
      setActivePopupId(myId);
      setActiveVideoId(myId);
    }, showDelay);

    // Store both timers so we can cancel either on leave
    timerRef.current = { primeTimer, showTimer, clear: () => {
      clearTimeout(primeTimer);
      clearTimeout(showTimer);
    }};
  };

  const handlePointerLeave = () => {
    if (timerRef.current) {
      // Cancel both PRIME and SHOW timers
      timerRef.current.clear();
      timerRef.current = null;
    }

    // Hide popup immediately for visual cleanliness
    setIsHovered(false);
    setHoveredRect(null);
    setIsHoverVideoReady(false);
    setIsActuallyPlaying(false);

    // Grace period before killing audio — allows seamless handoff to another
    // card if the user is moving directly from one card to another.
    if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
    leaveTimerRef.current = setTimeout(() => {
        const myId = `card-${movie.id}`;
        if (activePopupId === myId) setActivePopupId(null);
        if (activeVideoId === myId) setActiveVideoId(null);
    }, 200);
  };

  const getGenreNames = () => {
    if (!movie.genre_ids) return [];
    return movie.genre_ids.map(id => t(`genres.${id}`, { defaultValue: GENRES[id] })).filter(Boolean).slice(0, 3);
  };

  const getPopupFixedStyle = (): React.CSSProperties => {
    if (!hoveredRect) return { display: 'none' };
    const POPUP_W = 342;
    const TOP_OFFSET = -88;
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

  const handleOpenModal = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (timerRef.current) { timerRef.current.clear(); timerRef.current = null; }
    if (leaveTimerRef.current) { clearTimeout(leaveTimerRef.current); leaveTimerRef.current = null; }
    setIsHovered(false);
    setHoveredRect(null);
    const myId = `card-${movie.id}`;
    if (activePopupId === myId) setActivePopupId(null);
    if (activeVideoId === myId) setActiveVideoId(null);

    const savedState = getVideoState(movie.id);
    const rawRect = cardRef.current?.getBoundingClientRect();
    if (rawRect) {
      (window as any).__last_card_rect = rawRect;
    }

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

        {isGrid && (
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent pointer-events-none rounded-sm" />
        )}

        {!isHovered && (
          <>
            <div className="absolute inset-x-0 bottom-0 flex items-end justify-center pb-3 px-3">
              {logoUrl ? (
                <div className="relative inline-flex items-center justify-center">
                  <img
                    src={logoUrl}
                    aria-hidden
                    className={`absolute w-auto object-contain ${logoDim.isSquare ? 'max-h-16' : 'max-h-11'}`}
                    style={{
                      filter: 'blur(4px) brightness(0) opacity(0.8)',
                      transform: 'translate(1px, 2px) scale(1.01)',
                      zIndex: 0,
                    }}
                  />
                  <img
                    src={logoUrl}
                    aria-hidden
                    className={`absolute w-auto object-contain ${logoDim.isSquare ? 'max-h-16' : 'max-h-11'}`}
                    style={{
                      filter: 'blur(20px) brightness(0) opacity(0.5)',
                      transform: 'scale(1.05)',
                      zIndex: 0,
                    }}
                  />
                  <img
                    src={logoUrl}
                    alt={movie.title || movie.name}
                    onLoad={handleLogoLoad}
                    className={`relative w-auto object-contain transition-all duration-300 z-[1] ${logoDim.isSquare ? 'max-h-16' : 'max-h-11'}`}
                    style={{
                      filter: 'drop-shadow(0 12px 25px rgba(0,0,0,0.5)) drop-shadow(0 4px 5px rgba(0,0,0,0.35))'
                    }}
                    draggable={false}
                  />
                </div>
              ) : (
                <h3 className={`text-white font-leaner text-center tracking-wide leading-tight drop-shadow-[0_3px_9px_rgba(0,0,0,0.85)] line-clamp-3 mb-2 w-full px-1 ${isBook ? 'text-2xl' : 'text-xl'}`}>
                  {movie.title || movie.name}
                </h3>
              )}
            </div>

            <BadgeOverlay badge={badge} isBook={isBook} />
          </>
        )}
      </div>

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
              <div className="relative w-[400px] h-[200px] bg-[#141414] overflow-hidden rounded-t-md" onClick={handleOpenModal}>

                {(!isBook) ? (
                  <>
                    <img
                      src={imageSrc}
                      className={`absolute inset-0 w-full h-full object-cover backdrop-pop transition-opacity duration-500 scale-[1.05] ${isActuallyPlaying ? 'opacity-0' : 'opacity-100'}`}
                      alt="preview"
                    />
                    <div className={`absolute inset-0 transition-opacity duration-700 overflow-hidden ${isActuallyPlaying ? 'opacity-100' : 'opacity-0'}`}>
                        <TrailerPlayer 
                            key={`card-player-${replayCount}`}
                            movie={movie} 
                            variant="card"
                            cropFactor={1.35}
                            onReady={() => setIsHoverVideoReady(true)}
                            onPlay={() => setIsActuallyPlaying(true)}
                            onEnded={() => {
                                setIsHoverVideoReady(false);
                                setIsActuallyPlaying(false);
                                setHasVideoEnded(true);
                            }}
                            onErrored={() => {
                                setIsHoverVideoReady(false);
                                setIsActuallyPlaying(false);
                            }}
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

              <div className="px-4 pt-6 pb-5 space-y-4 bg-[#181818]">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-4">
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

                    <button
                      onClick={(e) => { e.stopPropagation(); toggleList(movie); }}
                      className={`border-2 rounded-full w-10 h-10 md:w-11 md:h-11 flex items-center justify-center text-white transition-all duration-200 hover:scale-110 active:scale-90
                      ${isAdded ? 'border-white bg-white/10 shadow-[0_0_8px_rgba(255,255,255,0.25)]' : 'border-gray-500 bg-[#2a2a2a]/80 hover:border-white'}`}
                      title={isAdded ? 'Remove from My List' : 'Add to My List'}
                    >
                      {isAdded ? <CheckIcon size={28} weight="bold" /> : <PlusIcon size={28} weight="bold" />}
                    </button>

                    <RatingPill
                      rating={getMovieRating(movie.id)}
                      onRate={(r) => { rateMovie(movie, r); }}
                    />
                  </div>

                  <button
                    onClick={handleOpenModal}
                    className="border-2 border-gray-500 bg-[#2a2a2a]/80 rounded-full w-10 h-10 md:w-11 md:h-11 flex items-center justify-center hover:border-white hover:scale-110 transition-all duration-200 text-white"
                    title="More Info"
                  >
                    <CaretDownIcon size={24} weight="bold" />
                  </button>
                </div>

                <div className="flex items-center flex-wrap gap-1.5 text-[13px] font-medium">
                  <MaturityBadge adult={movie.adult} voteAverage={movie.vote_average} />

                  {(() => {
                    if (isBook) return <span className="text-white/70">{movie.media_type === 'series' ? 'Series' : 'Comic'}</span>;
                    const isTV = movie.media_type === 'tv' || (!movie.media_type && !movie.title);
                    if (isTV) {
                      const s = movie.number_of_seasons;
                      return <span className="text-white/70">{s ? `${s} ${s === 1 ? 'Season' : 'Seasons'}` : 'TV Series'}</span>;
                    }
                    if (!movie.runtime) return null;
                    const h = Math.floor(movie.runtime / 60);
                    const m = movie.runtime % 60;
                    const label = h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ''}` : `${m}m`;
                    return <span className="text-white/70">{label}</span>;
                  })()}

                  {!isBook && <span className="border border-gray-300 text-gray-200 px-1 py-[2px] text-[14px] font-bold rounded-[2px] ml-3">HD</span>}
                </div>

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