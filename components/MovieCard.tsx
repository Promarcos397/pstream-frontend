import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { useIsInTheaters } from '../hooks/useIsInTheaters';
import CinemaPlayButton from './CinemaPlayButton';
import { SpeakerSlashIcon, SpeakerHighIcon, PlayIcon, CheckIcon, PlusIcon, ThumbsUpIcon, ThumbsDownIcon, HeartIcon, CaretDownIcon, BookOpenIcon, TicketIcon, ArrowCounterClockwiseIcon, XIcon } from '@phosphor-icons/react';
import { useGlobalContext } from '../context/GlobalContext';
import { GENRES, LOGO_SIZE } from '../constants';
import { getMovieImages } from '../services/api';
import { Movie } from '../types';
import { TrailerPlayer } from './TrailerPlayer';
import { MaturityBadge, BadgeOverlay, HoverProgressBar, getWatchData } from './MovieCardBadges';
import { searchTrailerWithMeta } from '../services/YouTubeService';
import { preloadTrailer } from '../hooks/useTrailer';
import MovieCardTouch from './MovieCardTouch';
import { useIsMobile } from '../hooks/useIsMobile';
import { getOptimizedImageUrl } from '../utils/deviceHelper';
import { useIsScrolling } from '../utils/scrollState';
import TooltipWrapper from './TooltipWrapper';

// ─── Module-level logo cache ─────────────────────────────────────────────────
// Persists across component mounts/unmounts within a page session so logos are
// never re-fetched after the first successful load.
const _logoCache = new Map<string, string>();

// ─── Runtime pointer-type tracker ────────────────────────────────────────────
// Tracks the LAST actual pointer device used (mouse vs touch/pen).
// IMPORTANT: We only flip to touch-mode if we're also on a small screen.
// A touch laptop at 1440px wide should always stay in hover/desktop mode.
type _PHListener = (v: boolean) => void;
const _phSubs = new Set<_PHListener>();
let _prefersHover = typeof window !== 'undefined' ? window.matchMedia('(hover: hover)').matches : true;

if (typeof window !== 'undefined') {
  // Only switch to touch mode when a touch pointer moves AND the screen is narrow
  window.addEventListener('pointermove', (e: PointerEvent) => {
    const isTouchInput = e.pointerType === 'touch' || e.pointerType === 'pen';
    const isNarrowScreen = window.innerWidth < 768;
    const next = !(isTouchInput && isNarrowScreen);
    if (next !== _prefersHover) { _prefersHover = next; _phSubs.forEach(f => f(next)); }
  }, { passive: true });
  // A real mouse click always means hover-capable
  window.addEventListener('mousedown', () => {
    if (!_prefersHover) { _prefersHover = true; _phSubs.forEach(f => f(true)); }
  }, { passive: true });
  // Resize: re-evaluate when screen width changes (e.g. window resize on a laptop)
  window.addEventListener('resize', () => {
    const next = window.innerWidth >= 768 ? true : window.matchMedia('(hover: hover)').matches;
    if (next !== _prefersHover) { _prefersHover = next; _phSubs.forEach(f => f(next)); }
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
  preload?: boolean;
  neighbors?: Movie[];
}



type MovieRating = 'like' | 'dislike' | 'love';

export const DoubleThumbsUpIcon: React.FC<{ size?: number; weight?: 'fill' | 'bold'; className?: string; maskColor?: string }> = ({
  size = 22,
  weight = 'bold',
  className = '',
  maskColor = '#2f2f2f'
}) => {
  const offsetX = Math.round(size * 0.38);
  const offsetY = Math.round(size * 0.32);
  const biteR   = Math.round(size * 0.44); // radius of the separator circle

  return (
    <div
      className={`relative inline-flex ${className}`}
      style={{ width: size + offsetX, height: size + offsetY }}
    >
      {/* Bottom thumb — lower right, sits behind everything (z=1) */}
      <div className="absolute" style={{ left: offsetX, top: offsetY, zIndex: 1 }}>
        <ThumbsUpIcon size={size} weight={weight} />
      </div>

      {/* Separator circle in button background color — bites into bottom thumb (z=2) */}
      <div
        className="absolute rounded-full"
        style={{
          width:  biteR * 2,
          height: biteR * 2,
          left:   offsetX - biteR + 4,
          top:    offsetY - biteR + 5,
          background: maskColor,
          transition: 'background-color 0.15s',
          zIndex: 2,
        }}
      />

      {/* Top thumb — upper left, in front of everything (z=3) */}
      <div className="absolute" style={{ left: 0, top: 0, zIndex: 3 }}>
        <ThumbsUpIcon size={size} weight={weight} />
      </div>
    </div>
  );
};

export const RatingIcon: React.FC<{ rating: MovieRating | undefined; size?: number; weight?: 'fill' | 'bold'; className?: string; maskColor?: string }> = ({
  rating,
  size = 22,
  weight = 'bold',
  className = '',
  maskColor = '#2f2f2f'
}) => {
  if (rating === 'love') {
    return <DoubleThumbsUpIcon size={size} weight={weight} className={className} maskColor={maskColor} />;
  }
  if (rating === 'dislike') {
    return <ThumbsDownIcon size={size} weight={weight} className={className} />;
  }
  return <ThumbsUpIcon size={size} weight={weight} className={className} />;
};

const RatingPillOption: React.FC<{
  option: MovieRating;
  isActive: boolean;
  tooltipText: string;
  onClick: () => void;
  maskColor?: string;
}> = ({ option, isActive, tooltipText, onClick, maskColor = '#2f2f2f' }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className="relative flex items-center justify-center"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <AnimatePresence>
        {isHovered && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.9, x: '-50%' }}
            animate={{ opacity: 1, y: 0, scale: 1, x: '-50%' }}
            exit={{ opacity: 0, y: 2, scale: 0.95, x: '-50%' }}
            transition={{ duration: 0.1 }}
            className="absolute bottom-full left-1/2 mb-3 flex flex-col items-center z-[110] pointer-events-none"
            style={{ transformOrigin: 'bottom center' }}
          >
            {/* Tooltip Box */}
            <div className="bg-[#e6e6e6] text-[#141414] text-[15px] font-extrabold px-5 py-3 rounded-[1px] shadow-[0_8px_24px_rgba(0,0,0,0.5)] whitespace-nowrap leading-none select-none">
              {tooltipText}
            </div>
            {/* Tooltip Arrow */}
            <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-[#e6e6e6] -mt-[1px]" />
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={onClick}
        className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors duration-150 hover:bg-white/10 flex-shrink-0 text-white
          ${isActive ? 'bg-white/15' : ''}`}
        title={tooltipText}
      >
        <RatingIcon rating={option} size={20} weight={isActive ? 'fill' : 'bold'} maskColor={isHovered ? '#414141' : maskColor} />
      </button>
    </div>
  );
};

const RatingPill: React.FC<{ rating: MovieRating | undefined; onRate: (r: MovieRating) => void }> = ({ rating, onRate }) => {
  const [expanded, setExpanded] = useState(false);
  const { t } = useTranslation();

  return (
    <div
      className="relative flex items-center"
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
    >
      <button
        type="button"
        className="border border-white/40 rounded-full w-10 h-10 flex items-center justify-center transition-colors duration-150 cursor-pointer text-white bg-zinc-900/40 backdrop-blur-md hover:bg-white/10 hover:border-white"
      >
        <RatingIcon rating={rating} size={20} weight={rating ? 'fill' : 'bold'} className="text-white" maskColor={expanded ? '#414141' : '#2a2a2a'} />
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, scaleX: 0, x: '-50%', y: '-50%' }}
            animate={{ opacity: 1, scaleX: 1, x: '-50%', y: '-50%' }}
            exit={{ opacity: 0, scaleX: 0, x: '-50%', y: '-50%' }}
            transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
            className="absolute top-1/2 left-1/2 bg-[#2f2f2f] rounded-full px-5 py-2.5 flex items-center justify-center gap-x-3.5 shadow-[0_12px_24px_rgba(0,0,0,0.85)] border border-white/10 z-[100]"
            style={{ transformOrigin: 'center center', originX: 0.5 }}
            onClick={(e) => e.stopPropagation()}
          >
            {(['dislike', 'like', 'love'] as MovieRating[]).map(r => {
               const tooltipText = r === 'love' 
                 ? t('infoModal.loveThis', { defaultValue: 'Love this!' }) 
                 : r === 'like' 
                   ? t('infoModal.iLikeThis', { defaultValue: 'I like this' }) 
                   : t('infoModal.notForMe', { defaultValue: 'Not for me' });
               return (
                 <RatingPillOption
                   key={r}
                   option={r}
                   isActive={rating === r}
                   tooltipText={tooltipText}
                   onClick={() => { onRate(r); }}
                 />
               );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const MovieCard: React.FC<MovieCardProps> = ({ movie, onSelect, onPlay, isGrid = false, preload = false, neighbors }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const prefersHover = usePrefersHover();
  const isMobile = useIsMobile();

  const {
    myList, toggleList, rateMovie, getMovieRating, getVideoState,
    updateVideoState, getEpisodeProgress, getLastWatchedEpisode,
    top10TV, top10Movies, activeVideoId, setActiveVideoId,
    activePopupId, setActivePopupId,
    globalMute, setGlobalMute, clearVideoState, settings
  } = useGlobalContext();
  const isScrolling = useIsScrolling();
  const [isHovered, setIsHovered] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [imgFailed, setImgFailed] = useState(false);
  const isCinemaOnly = useIsInTheaters(movie);
  const [replayCount, setReplayCount] = useState(0);
  const [isHoverVideoReady, setIsHoverVideoReady] = useState(false);
  const [isActuallyPlaying, setIsActuallyPlaying] = useState(false);
  const [hasVideoEnded, setHasVideoEnded] = useState(false);
  const [logoFaded, setLogoFaded] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

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

  const isAdded = myList.some(m => String(m.id) === String(movie.id));
  const timerRef = useRef<any>(null);
  const closeTimerRef = useRef<any>(null);
  const neighborsTimerRef = useRef<any>(null);
  const preloadTimerRef = useRef<any>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const posterRef = useRef<HTMLImageElement>(null);
  const cardPlayerRef = useRef<any>(null);
  const cardTrailerTimeRef = useRef<number>(0);



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
    const cacheKey = `${movie.id}-${movie.media_type || (movie.title ? 'movie' : 'tv')}`;
    // Return cached logo instantly — no network request needed
    if (_logoCache.has(cacheKey)) {
      setLogoUrl(_logoCache.get(cacheKey)!);
      return;
    }
    if (typeof movie.id === 'string' && movie.id.startsWith('dim')) {
      setLogoUrl(movie.image_url || '');
      return;
    }
    let isMounted = true;
    const fetchLogo = async () => {
      try {
        const mediaType = (movie.media_type || (movie.title ? 'movie' : 'tv')) as 'movie' | 'tv';
        const data = await getMovieImages(String(movie.id), mediaType);
        if (!isMounted) return;
        if (data && data.logos) {
          const logo = data.logos.find((l: any) => l.iso_639_1 === 'en' || l.iso_639_1 === null);
          if (logo) {
            const url = `https://image.tmdb.org/t/p/${LOGO_SIZE}${logo.file_path}`;
            _logoCache.set(cacheKey, url);
            setLogoUrl(url);
          } else {
            // Cache empty string so we don't re-fetch for cards with no logo
            _logoCache.set(cacheKey, '');
          }
        }
      } catch (e) { }
    };
    fetchLogo();
    return () => { isMounted = false; };
  }, [isVisible, movie.id, movie.media_type, movie.title, movie.image_url]);

  useEffect(() => {
    if (preload && settings.autoplayPreviews) {
      const t = setTimeout(() => {
        preloadTrailer(movie);
      }, 1000 + (Number(movie.id) % 5) * 200); // staggered to prevent visual/network spikes
      return () => clearTimeout(t);
    }
  }, [preload, movie, settings.autoplayPreviews]);

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
    if (activeVideoId && isHovered && (activeVideoId !== myId || activeVideoId.startsWith('modal-'))) {
      setIsHovered(false);
      setHoveredRect(null);
    }
  }, [activeVideoId, movie.id, isHovered]);

  useEffect(() => {
    if (!isScrolling && prefersHover && cardRef.current) {
      if (cardRef.current.matches(':hover') && !isHovered) {
        const mockEvent = { pointerType: 'mouse', clientX: 0, clientY: 0 } as any;
        handlePointerEnter(mockEvent);
      }
    }
  }, [isScrolling, prefersHover, isHovered]);

  useEffect(() => {
    if (!isHovered) return;
    const collapse = () => {
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
      if (closeTimerRef.current) { clearTimeout(closeTimerRef.current); closeTimerRef.current = null; }
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

  const imageSrc = getOptimizedImageUrl(movie.backdrop_path || movie.poster_path, 'backdrop', isMobile);
  const posterSrc = getOptimizedImageUrl(movie.poster_path, 'poster', isMobile);

  // Handle cached images for smooth reveal
  useEffect(() => {
    if (posterRef.current?.complete) {
      setImageLoaded(true);
    }
  }, [imageSrc]);

  // On mobile-width screens always use the touch card.
  // On wider screens (tablet+, desktop) always use the desktop card with hover popup — 
  // even on touch laptops. prefersHover only controls the popup, not the card variant.
  if (isMobile) {
    return <MovieCardTouch movie={movie} onSelect={onSelect} onPlay={onPlay} isGrid={isGrid} />;
  }

  const SHOW_DELAY = 200; 
  const handlePointerEnter = (e: React.PointerEvent) => {
    if (!prefersHover || isScrolling) return;
    if (e.pointerType === 'touch' || e.pointerType === 'pen') return;

    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }

    // Hover intent delay: Wait 80ms before we actually trigger preload
    if (settings.autoplayPreviews) {
      if (preloadTimerRef.current) clearTimeout(preloadTimerRef.current);
      preloadTimerRef.current = setTimeout(() => {
        preloadTrailer(movie);

        // Debounce neighbor preloading (150ms after hover intent is confirmed)
        if (neighbors && neighbors.length > 0) {
          if (neighborsTimerRef.current) clearTimeout(neighborsTimerRef.current);
          neighborsTimerRef.current = setTimeout(() => {
            neighbors.forEach(neighbor => {
              if (neighbor) {
                preloadTrailer(neighbor);
              }
            });
          }, 150);
        }
      }, 80);
    }

    if (cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect();
      const EDGE_BUFFER = 120;
      let currentPos: 'center' | 'left' | 'right' = 'center';
      if (rect.left < EDGE_BUFFER) currentPos = 'left';
      else if (window.innerWidth - rect.right < EDGE_BUFFER) currentPos = 'right';
      setHoverPosition(currentPos);
    }

    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    // ── STAGE: SHOW ──────────────────────────────────────────────────────
    const showDelay = SHOW_DELAY;
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

    timerRef.current = showTimer;
  };

  const handlePointerLeave = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (preloadTimerRef.current) {
      clearTimeout(preloadTimerRef.current);
      preloadTimerRef.current = null;
    }
    if (neighborsTimerRef.current) {
      clearTimeout(neighborsTimerRef.current);
      neighborsTimerRef.current = null;
    }

    // Delay closing of hover (200ms) to allow grace period
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => {
      setIsHovered(false);
      setHoveredRect(null);
      setIsHoverVideoReady(false);
      setIsActuallyPlaying(false);

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
      left: left,
      width: POPUP_W,
      zIndex: 9999,
    };
  };

  const handleOpenModal = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    if (closeTimerRef.current) { clearTimeout(closeTimerRef.current); closeTimerRef.current = null; }
    setIsHovered(false);
    setHoveredRect(null);
    const myId = `card-${movie.id}`;
    if (activePopupId === myId) setActivePopupId(null);
    if (activeVideoId === myId) setActiveVideoId(null);

    // Capture current trailer time from the card hover player
    let trailerT = cardTrailerTimeRef.current;
    try {
      if (cardPlayerRef.current && typeof cardPlayerRef.current.getCurrentTime === 'function') {
        trailerT = cardPlayerRef.current.getCurrentTime() || trailerT;
      }
    } catch {}

    const savedState = getVideoState(movie.id);
    const rawRect = cardRef.current?.getBoundingClientRect();
    if (rawRect) {
      (window as any).__last_card_rect = rawRect;
    }

    // Pass trailer time if playing, otherwise fall back to movie watch progress
    const timeToPass = trailerT > 0 ? trailerT : (savedState?.time || 0);
    onSelect(movie, timeToPass || undefined, savedState?.videoId || undefined);
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


  return (
    <div
      ref={cardRef}
      className={`relative z-10 group group/card select-none
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
        <motion.img
          ref={posterRef}
          src={imageSrc}
          initial={{ opacity: 0 }}
          animate={{ opacity: imageLoaded ? 1 : 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          onLoad={() => setImageLoaded(true)}
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
            style={{ top: 'calc(100% + 5px)', left: '25%', right: '25%' }}
          >
            <div className="h-[4px] w-full" style={{ background: '#808080', borderRadius: 0 }}>
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
              initial={{ opacity: 0, y: 12, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.95 }}
              transition={{
                type: 'spring',
                stiffness: 450,
                damping: 32,
                mass: 0.8,
                opacity: { duration: 0.15 }
              }}
              style={{
                ...getPopupFixedStyle(),
                willChange: 'transform, opacity',
                transformOrigin: hoverPosition === 'left' ? 'top left' : hoverPosition === 'right' ? 'top right' : 'top center',
              }}
            >
              <div className="relative w-full h-[200px] bg-[#141414] overflow-hidden rounded-t-md" onClick={handleOpenModal}>

                {(!isBook && settings.autoplayPreviews) ? (
                  <>
                    <img
                      src={imageSrc}
                      className={`absolute inset-0 w-full h-full object-cover backdrop-pop transition-opacity duration-300 scale-[1.05] ${isActuallyPlaying ? 'opacity-0' : 'opacity-100'}`}
                      alt="preview"
                    />
                    <div className={`absolute inset-0 transition-opacity duration-300 overflow-hidden ${isActuallyPlaying ? 'opacity-100' : 'opacity-0'}`}>
                      <TrailerPlayer
                        key={`card-player-${replayCount}`}
                        movie={movie}
                        variant="card"
                        cropFactor={1.35}
                        onReady={() => setIsHoverVideoReady(true)}
                        onPlay={() => setIsActuallyPlaying(true)}
                        onPlayerReady={(p) => { cardPlayerRef.current = p; }}
                        onTimeUpdate={(t) => { cardTrailerTimeRef.current = t; }}
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

                {!isBook && settings.autoplayPreviews && (
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
                    className="absolute bottom-4 right-4 w-10 h-10 rounded-full border border-white/40 bg-zinc-900/40 backdrop-blur-md flex items-center justify-center transition-colors duration-150 hover:bg-white/10 hover:border-white z-50 pointer-events-auto cursor-pointer shadow-lg"
                  >
                    {hasVideoEnded
                      ? <ArrowCounterClockwiseIcon size={20} weight="bold" className="text-white" />
                      : globalMute ? <SpeakerSlashIcon size={20} className="text-white" /> : <SpeakerHighIcon size={18} className="text-white" />
                    }
                  </button>
                )}

                <div className="absolute inset-x-0 bottom-0 h-7 bg-gradient-to-t from-[#181818]/70 to-transparent z-10 pointer-events-none" />

                <div className={`absolute bottom-3 left-4 right-12 pointer-events-none z-20 transition-opacity duration-1000 ${logoFaded ? 'opacity-0' : 'opacity-100'}`}>
                  {logoUrl && !imgFailed ? (
                    <div className="relative inline-flex items-end max-w-[260px]">
                      <img
                        src={logoUrl}
                        aria-hidden
                        className={`absolute w-auto max-w-[260px] object-contain origin-bottom-left ${logoDim.isSquare ? 'h-14 md:h-20' : 'h-10 md:h-12'}`}
                        style={{
                          filter: 'blur(4px) brightness(0) opacity(0.8)',
                          transform: 'translate(1px, 2px) scale(1.01)',
                          zIndex: 0,
                        }}
                      />
                      <img
                        src={logoUrl}
                        aria-hidden
                        className={`absolute w-auto max-w-[260px] object-contain origin-bottom-left ${logoDim.isSquare ? 'h-14 md:h-20' : 'h-10 md:h-12'}`}
                        style={{
                          filter: 'blur(20px) brightness(0) opacity(0.5)',
                          transform: 'translate(2px, 4px) scale(1.06)',
                          zIndex: 0,
                        }}
                      />
                      <img
                        src={logoUrl}
                        alt={movie.title || movie.name}
                        className={`relative w-auto max-w-[260px] object-contain origin-bottom-left transition-all duration-300 z-[1] ${logoDim.isSquare ? 'h-14 md:h-20' : 'h-10 md:h-12'}`}
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
                  <div className="flex items-center gap-2.5">
                    {isBook ? (
                      <TooltipWrapper label={t('common.readNow')}>
                        <Link
                          to={`/watch/${movie.media_type === 'tv' || (!movie.media_type && !movie.title) ? 'tv' : 'movie'}/${movie.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="bg-white text-black rounded-full w-10 h-10 flex items-center justify-center hover:bg-neutral-200 transition shadow-md duration-200"
                        >
                          <BookOpenIcon size={24} weight="fill" />
                        </Link>
                      </TooltipWrapper>
                    ) : (
                      <CinemaPlayButton
                        movie={movie}
                        variant="circular"
                        isCinemaOnly={isCinemaOnly}
                      />
                    )}

                    <TooltipWrapper label={isAdded ? t('modal.removeFromList') : t('modal.addToList')}>
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleList(movie); }}
                        className={`border rounded-full w-10 h-10 flex items-center justify-center transition-colors duration-150 text-white
                          ${isAdded
                            ? 'border-white bg-white/15'
                            : 'border-white/40 bg-zinc-900/40 backdrop-blur-md hover:bg-white/10 hover:border-white'
                          }`}
                      >
                        {isAdded ? <CheckIcon size={24} weight="bold" /> : <PlusIcon size={24} weight="bold" />}
                      </button>
                    </TooltipWrapper>

                    <RatingPill
                      rating={getMovieRating(movie.id)}
                      onRate={(r) => { rateMovie(movie, r); }}
                    />

                    {getWatchData(movie, getLastWatchedEpisode, getVideoState).pct > 0 && (
                      <TooltipWrapper label={t('common.removeContinue')}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            clearVideoState(movie.id);
                            handlePointerLeave();
                          }}
                          className="border rounded-full w-10 h-10 flex items-center justify-center border-white/40 bg-zinc-900/40 backdrop-blur-md hover:bg-white/10 hover:border-white transition-colors duration-150 text-white"
                        >
                          <XIcon size={20} weight="bold" />
                        </button>
                      </TooltipWrapper>
                    )}
                  </div>

                  <TooltipWrapper label={t('hero.moreInfo')}>
                    <button
                      onClick={handleOpenModal}
                      className="border rounded-full w-10 h-10 flex items-center justify-center border-white/40 bg-zinc-900/40 backdrop-blur-md hover:bg-white/10 hover:border-white transition-colors duration-150 text-white"
                    >
                      <CaretDownIcon size={22} weight="bold" />
                    </button>
                  </TooltipWrapper>
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
                            className="text-gray-400 hover:text-white cursor-pointer transition-colors"
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