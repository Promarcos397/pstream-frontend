import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, animate } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useNavigate, Link } from 'react-router-dom';
import {
  CaretRightIcon, CaretLeftIcon, PlayIcon, CheckIcon, PlusIcon,
  ThumbsUpIcon, ThumbsDownIcon, HeartIcon, CaretDownIcon,
  BookOpenIcon, TicketIcon, ArrowCounterClockwiseIcon,
  SpeakerSlashIcon, SpeakerHighIcon, XIcon
} from '@phosphor-icons/react';
import { useGlobalContext } from '../context/GlobalContext';
import { useIsInTheaters } from '../hooks/useIsInTheaters';
import CinemaPlayButton from './CinemaPlayButton';
import { GENRES, LOGO_SIZE } from '../constants';
import { getMovieImages, fetchData } from '../services/api';
import { Movie } from '../types';
import { preloadTrailer } from '../hooks/useTrailer';
import { TrailerPlayer } from './TrailerPlayer';
import {
  MaturityBadge, BadgeOverlay, HoverProgressBar,
  getWatchData, ProgressIndicator
} from './MovieCardBadges';
import { useIsMobile } from '../hooks/useIsMobile';
import TopTenRowMobile from './TopTenRowMobile';
import { useIsScrolling } from '../utils/scrollState';
import TooltipWrapper from './TooltipWrapper';

// ─── Shared pointer-type hook (same logic as MovieCard) ────────────────────────
// IMPORTANT: Only flip to touch-mode when a touch pointer is used AND screen is narrow.
// A touch laptop at 1440px wide must stay in hover/desktop mode.
type _PHListener = (v: boolean) => void;
const _phSubs = new Set<_PHListener>();
let _prefersHover = typeof window !== 'undefined' ? window.matchMedia('(hover: hover)').matches : true;

if (typeof window !== 'undefined') {
  window.addEventListener('pointermove', (e: PointerEvent) => {
    const isTouchInput = e.pointerType === 'touch' || e.pointerType === 'pen';
    const isNarrowScreen = window.innerWidth < 768;
    const next = !(isTouchInput && isNarrowScreen);
    if (next !== _prefersHover) { _prefersHover = next; _phSubs.forEach(f => f(next)); }
  }, { passive: true });
  window.addEventListener('mousedown', () => {
    if (!_prefersHover) { _prefersHover = true; _phSubs.forEach(f => f(true)); }
  }, { passive: true });
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

// ─── Rating Pill (copied from MovieCard) ────────────────────────────────────
type MovieRating = 'like' | 'dislike' | 'love';

export const DoubleThumbsUpIcon: React.FC<{ size?: number; weight?: 'fill' | 'bold'; className?: string; maskColor?: string }> = ({ 
  size = 22, 
  weight = 'bold', 
  className = '',
  maskColor = '#2f2f2f'
}) => {
  const offset = size * 0.35;
  const maskId = React.useId ? React.useId() : `love-mask-${Math.random().toString(36).substr(2, 9)}`;
  const safeMaskId = maskId.replace(/:/g, '_');

  return (
    <div 
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: size + offset, height: size + offset }}
    >
      <svg 
        width={size + offset} 
        height={size + offset} 
        viewBox={`0 0 ${size + offset} ${size + offset}`}
        className="absolute inset-0 w-full h-full pointer-events-none"
      >
        <defs>
          <mask id={safeMaskId}>
            {/* White background: keeps back icon visible */}
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            
            {/* Black silhouette of front icon to cut it out */}
            <g transform={`translate(0, ${offset})`} fill="black" stroke="black" strokeWidth={3} strokeLinejoin="round" strokeLinecap="round">
              <ThumbsUpIcon size={size} weight="fill" />
            </g>
          </mask>
        </defs>

        {/* Draw the back icon, masked by the front icon's cutout */}
        <g mask={`url(#${safeMaskId})`}>
          <g transform={`translate(${offset}, 0)`}>
            <ThumbsUpIcon size={size} weight={weight} />
          </g>
        </g>
      </svg>

      {/* Front icon sits on top of the SVG, aligned with the mask cutout */}
      <div 
        className="absolute"
        style={{
          left: 0,
          top: offset,
          width: size,
          height: size,
        }}
      >
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
        <RatingIcon rating={option} size={20} weight={isActive ? 'fill' : 'bold'} maskColor={maskColor} />
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
        className={`border rounded-full w-10 h-10 flex items-center justify-center transition-colors duration-150 cursor-pointer text-white
          ${rating
            ? 'border-white bg-white/15'
            : 'border-white/40 bg-zinc-900/40 backdrop-blur-md hover:bg-white/10 hover:border-white'
          }`}
        title={t('common.rateTitle')}
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
                   onClick={() => {
                     onRate(r);
                   }}
                 />
               );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};


// ─── Layout constants ────────────────────────────────────────────────────────
const SIZES = {
  card: "h-[130px] w-[195px] sm:h-[140px] sm:w-[210px] md:h-[150px] md:w-[210px] lg:h-[160px] lg:w-[220px]",
  button: "h-[130px] sm:h-[140px] md:h-[150px] lg:h-[160px]",
};

// ─── Rank Number ────────────────────────────────────────────────────────────
// 1-9: tall, narrow-ish, hugging the left edge.
// 10: smaller overall, digits squished together with negative letter-spacing,
//     container bleeds wider so the "0" peeks past the poster on the right.
const RankNumber: React.FC<{ index: number }> = ({ index }) => {
  const isTen = index === 9;
  return (
    <div
      className={`absolute ${isTen ? 'left-[24px]' : 'left-[22px]'} bottom-[-6px] h-[122px] sm:h-[152px] md:h-[122%] z-0 pointer-events-none overflow-visible`}
      style={{ width: isTen ? '112%' : '88%' }}
    >
      <svg
        viewBox={isTen ? "0 0 280 210" : "0 0 200 210"}
        className="h-full w-auto"
        preserveAspectRatio="none"
        style={{ overflow: 'visible' }}
      >
        <g
          transform={isTen ? "scale(1.25, 1.08)" : "scale(1.5, 1.12)"}
          style={{ transformOrigin: isTen ? "130px 205px" : "70px 205px" }}
        >
          {/* Outer Outline Stroke — very white, thinner */}
          <text
            x="8"
            y="195"
            textAnchor="start"
            dominantBaseline="auto"
            fill="none"
            stroke="rgba(255,255,255,0.90)"
            strokeWidth="6"
            strokeLinejoin="round"
            fontSize={isTen ? "155" : "165"}
            fontWeight="900"
            fontFamily="'Inter', sans-serif"
            letterSpacing={isTen ? "-25" : "-8"}
          >
            {index + 1}
          </text>
          {/* Main Body — solid black fill */}
          <text
            x="8"
            y="195"
            textAnchor="start"
            dominantBaseline="auto"
            fill="#0a0a0a"
            stroke="#0a0a0a"
            strokeWidth="4"
            strokeLinejoin="round"
            fontSize={isTen ? "155" : "165"}
            fontWeight="900"
            fontFamily="'Inter', sans-serif"
            letterSpacing={isTen ? "-25" : "-8"}
          >
            {index + 1}
          </text>
        </g>
      </svg>
    </div>
  );
};

// ─── TopTenCard (base rank layout + full MovieCard hover popup) ─────────────
const TopTenCard: React.FC<{
  movie: Movie;
  index: number;
  onSelect: (movie: Movie, time?: number, videoId?: string) => void;
  preload?: boolean;
  neighbors?: Movie[];
}> = ({ movie, index, onSelect, preload = false, neighbors }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const prefersHover = usePrefersHover();

  const {
    myList, toggleList, rateMovie, getMovieRating, getVideoState,
    updateVideoState, getEpisodeProgress, getLastWatchedEpisode,
    top10TV, top10Movies, activeVideoId, setActiveVideoId,
    activePopupId, setActivePopupId,
    globalMute, setGlobalMute, clearVideoState, settings
  } = useGlobalContext();
  const isScrolling = useIsScrolling();

  const [isHovered, setIsHovered] = useState(false);
  const [hoveredRect, setHoveredRect] = useState<DOMRect | null>(null);
  const [hoverPosition, setHoverPosition] = useState<'center' | 'left' | 'right'>('center');

  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [imgFailed, setImgFailed] = useState(false);
  const [logoDim, setLogoDim] = useState<{ ratio: number; isSquare: boolean }>({ ratio: 1.5, isSquare: false });
  const [logoFaded, setLogoFaded] = useState(false);

  const [isHoverVideoReady, setIsHoverVideoReady] = useState(false);
  const [isActuallyPlaying, setIsActuallyPlaying] = useState(false);
  const [hasVideoEnded, setHasVideoEnded] = useState(false);
  const [replayCount, setReplayCount] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  const isCinemaOnly = useIsInTheaters(movie);
  const timerRef = useRef<any>(null);
  const leaveTimerRef = useRef<any>(null);
  const closeTimerRef = useRef<any>(null);
  const neighborsTimerRef = useRef<any>(null);
  const preloadTimerRef = useRef<any>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const cardPlayerRef = useRef<any>(null);
  const cardTrailerTimeRef = useRef<number>(0);

  const isBook = ['series', 'comic', 'manga', 'local'].includes(movie.media_type || '');
  const isAdded = myList.some(m => String(m.id) === String(movie.id));
  const isTen = index === 9;

  // Intersection Observer for lazy logo fetch
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

  // Fetch logo
  useEffect(() => {
    if (!isVisible) return;
    let isMounted = true;
    const fetchLogo = async () => {
      try {
        const mediaType = (movie.media_type || (movie.title ? 'movie' : 'tv')) as 'movie' | 'tv';
        const data = await getMovieImages(String(movie.id), mediaType);
        if (!isMounted) return;
        if (data?.logos) {
          const logo = data.logos.find((l: any) => l.iso_639_1 === 'en' || l.iso_639_1 === null);
          if (logo) setLogoUrl(`https://image.tmdb.org/t/p/${LOGO_SIZE}${logo.file_path}`);
        }
      } catch (e) { /* silent */ }
    };
    fetchLogo();
    return () => { isMounted = false; };
  }, [isVisible, movie.id, movie.media_type, movie.title]);

  useEffect(() => {
    if (preload && settings.autoplayPreviews) {
      const t = setTimeout(() => {
        preloadTrailer(movie);
      }, 1000 + (Number(movie.id) % 5) * 200);
      return () => clearTimeout(t);
    }
  }, [preload, movie, settings.autoplayPreviews]);

  // Logo fade-out once trailer plays
  useEffect(() => {
    if (isActuallyPlaying && !hasVideoEnded) {
      const t = setTimeout(() => setLogoFaded(true), 3500);
      return () => clearTimeout(t);
    } else {
      setLogoFaded(false);
    }
  }, [isActuallyPlaying, hasVideoEnded]);

  // Unify Popup logic via Context (replaces module singleton)
  useEffect(() => {
    const myId = `card-${movie.id}`;
    if (activePopupId && isHovered && (activePopupId !== myId || activePopupId.startsWith('modal-'))) {
      setIsHovered(false);
      setHoveredRect(null);
      setIsHoverVideoReady(false);
    }
  }, [activePopupId, movie.id, isHovered]);

  // Force close if another video (e.g. Hero, Modal) takes control
  useEffect(() => {
    const myId = `card-${movie.id}`;
    if (activeVideoId && isHovered && (activeVideoId !== myId || activeVideoId.startsWith('modal-'))) {
      setIsHovered(false);
      setHoveredRect(null);
    }
  }, [activeVideoId, movie.id, isHovered]);

  // Collapse popup on scroll / blur / tab-hide
  useEffect(() => {
    if (!isHovered) return;
    const collapse = () => {
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
      if (preloadTimerRef.current) { clearTimeout(preloadTimerRef.current); preloadTimerRef.current = null; }
      if (neighborsTimerRef.current) { clearTimeout(neighborsTimerRef.current); neighborsTimerRef.current = null; }
      setIsHovered(false);
      setHoveredRect(null);
      setIsHoverVideoReady(false);
      const myId = `card-${movie.id}`;
      if (activePopupId === myId) setActivePopupId(null);
    };
    window.addEventListener('scroll', collapse, { passive: true });
    window.addEventListener('blur', collapse);
    const onVis = () => { if (document.visibilityState === 'hidden') collapse(); };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('scroll', collapse);
      window.removeEventListener('blur', collapse);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [isHovered]);

  const handleLogoLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = e.currentTarget;
    const ratio = naturalWidth / naturalHeight;
    setLogoDim({ ratio, isSquare: ratio < 1.35 });
  };

  const getBadgeInfo = () => {
    const isTV = movie.media_type === 'tv' || (!movie.media_type && !movie.title);
    const movieIdNum = Number(movie.id);
    if (isTV && top10TV?.includes(movieIdNum)) return { text: 'Top 10', type: 'top' };
    if (!isTV && top10Movies?.includes(movieIdNum)) return { text: 'Top 10', type: 'top' };

    const dateStr = movie.release_date || movie.first_air_date;
    const now = new Date();
    if (dateStr) {
      const releaseDate = new Date(dateStr);
      const diffTime = releaseDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays > 0 && diffDays <= 30) return { text: 'Coming Soon', type: 'upcoming' };
      if (diffDays >= -45 && diffDays <= 0) {
        return { text: isTV ? 'New Episodes' : 'Recently Added', type: 'new' };
      }
    }
    return null;
  };

  const badge = getBadgeInfo();

  const getGenreNames = () => {
    if (!movie.genre_ids) return [];
    return movie.genre_ids
      .map(id => t(`genres.${id}`, { defaultValue: GENRES[id] }))
      .filter(Boolean)
      .slice(0, 3);
  };

  const handleOpenModal = (e?: React.MouseEvent) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    if (preloadTimerRef.current) { clearTimeout(preloadTimerRef.current); preloadTimerRef.current = null; }
    if (neighborsTimerRef.current) { clearTimeout(neighborsTimerRef.current); neighborsTimerRef.current = null; }
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
    if (rawRect) (window as any).__last_card_rect = rawRect;

    // Pass trailer time if playing, otherwise fall back to movie watch progress
    const timeToPass = trailerT > 0 ? trailerT : (savedState?.time || 0);
    onSelect(movie, timeToPass || undefined, savedState?.videoId || undefined);
  };

  const getPopupFixedStyle = (): React.CSSProperties => {
    if (!hoveredRect) return { display: 'none' };
    const POPUP_W = 342;
    const TOP_OFFSET = -88;
    let left: number;
    if (hoverPosition === 'left') {
      let targetLeft = hoveredRect.left;
      if (window.innerWidth >= 1024) {
        targetLeft -= 32; // align to normal row's 64px padding
      } else if (window.innerWidth >= 768) {
        // already aligned
      } else {
        targetLeft -= 8; // align to normal row's 24px padding
      }
      left = targetLeft;
    }
    else if (hoverPosition === 'right') left = hoveredRect.right - POPUP_W;
    else left = hoveredRect.left + hoveredRect.width / 2 - POPUP_W / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - POPUP_W - 8));
    return {
      position: 'fixed',
      top: hoveredRect.top + TOP_OFFSET,
      left: left,
      width: POPUP_W,
      zIndex: 9999,
    };
  };

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

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isScrolling || isHovered || timerRef.current) return;
    handlePointerEnter(e);
  };

  useEffect(() => {
    if (isScrolling && timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
    }
  }, [isScrolling]);

  // Handle "Snap-to-Hover" when scrolling stops
  useEffect(() => {
    if (!isScrolling && !isHovered && prefersHover && cardRef.current) {
        if (cardRef.current.matches(':hover')) {
            const mockEvent = { pointerType: 'mouse', clientX: 0, clientY: 0 } as any;
            handlePointerEnter(mockEvent);
        }
    }
  }, [isScrolling, isHovered, prefersHover]);

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

    if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
    leaveTimerRef.current = setTimeout(() => {
      const myId = `card-${movie.id}`;
      if (activeVideoId === myId) setActiveVideoId(null);
    }, 400);
  };

  const posterSrc = (movie.poster_path?.startsWith('http') || movie.poster_path?.startsWith('comic://'))
    ? movie.poster_path
    : `https://image.tmdb.org/t/p/w500${movie.poster_path}`;

  const imageSrc = (movie.poster_path?.startsWith('http') || movie.backdrop_path?.startsWith('http') || movie.poster_path?.startsWith('comic://') || movie.backdrop_path?.startsWith('comic://'))
    ? (movie.backdrop_path || movie.poster_path)
    : `https://image.tmdb.org/t/p/w500${movie.backdrop_path || movie.poster_path}`;

  return (
    <div
      ref={cardRef}
      data-card
      className={`relative flex-none ${SIZES.card} mr-0 cursor-pointer flex items-end pointer-events-auto select-none z-10`}
      style={prefersHover ? { touchAction: 'none' } : undefined}
      onPointerEnter={prefersHover ? handlePointerEnter : undefined}
      onPointerLeave={prefersHover ? handlePointerLeave : undefined}
      onPointerMove={prefersHover ? handlePointerMove : undefined}
      onClick={handleOpenModal}
    >
      <RankNumber index={index} />

      {/* Poster + Badges */}
      <div className={`absolute right-[12px] bottom-0 h-full z-10 rounded-sm overflow-hidden shadow-[0_0_15px_rgba(0,0,0,0.5)] ${isTen ? 'w-[42%]' : 'w-[46%]'}`}>
        <img
          src={posterSrc}
          className="w-full h-full object-cover object-top"
          alt={movie.title || movie.name}
          loading="lazy"
          draggable={false}
        />
        <BadgeOverlay badge={badge} isBook={isBook} />
      </div>

      {/* Progress bar hidden per user request
      <ProgressIndicator
        movie={movie}
        getLastWatchedEpisode={getLastWatchedEpisode}
        getVideoState={getVideoState}
      />
      */}

      {/* ─── Hover Popup (portal) ─────────────────────────────────────────── */}
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
                stiffness: 380,
                damping: 34,
                mass: 0.75,
                opacity: { duration: 0.12 }
              }}
              style={{
                ...getPopupFixedStyle(),
                willChange: 'transform, opacity',
                transformOrigin: hoverPosition === 'left' ? 'top left' : hoverPosition === 'right' ? 'top right' : 'top center',
              }}
            >
              {/* Media Container */}
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
                    className="w-full h-full object-cover backdrop-pop object-[50%_30%]"
                    alt="preview"
                  />
                )}

                {/* Mute / Replay */}
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
                    className="absolute bottom-4 right-4 w-9 h-9 rounded-full border border-white/40 bg-zinc-900/40 backdrop-blur-md flex items-center justify-center transition-all duration-300 hover:bg-white/10 hover:border-white z-50 pointer-events-auto cursor-pointer shadow-lg"
                  >
                    {hasVideoEnded
                      ? <ArrowCounterClockwiseIcon size={24} className="text-white" />
                      : globalMute ? <SpeakerSlashIcon size={24} className="text-white" /> : <SpeakerHighIcon size={18} className="text-white" />
                    }
                  </button>
                )}

                <div className="absolute inset-x-0 bottom-0 h-7 bg-gradient-to-t from-[#181818]/70 to-transparent z-10 pointer-events-none" />

                {/* Logo / Title overlay inside media */}
                <div className={`absolute bottom-3 left-4 right-12 pointer-events-none z-20 transition-opacity duration-1000 ${logoFaded ? 'opacity-0' : 'opacity-100'}`}>
                  {logoUrl && !imgFailed ? (
                    <div className="relative inline-flex items-end max-w-[260px]">
                      <img
                        src={logoUrl}
                        aria-hidden
                        className={`absolute w-auto max-w-[260px] object-contain origin-bottom-left ${logoDim.isSquare ? 'h-14 md:h-20' : 'h-10 md:h-12'}`}
                        style={{ filter: 'blur(4px) brightness(0) opacity(0.8)', transform: 'translate(1px, 2px) scale(1.01)', zIndex: 0 }}
                      />
                      <img
                        src={logoUrl}
                        aria-hidden
                        className={`absolute w-auto max-w-[260px] object-contain origin-bottom-left ${logoDim.isSquare ? 'h-14 md:h-20' : 'h-10 md:h-12'}`}
                        style={{ filter: 'blur(20px) brightness(0) opacity(0.5)', transform: 'translate(2px, 4px) scale(1.06)', zIndex: 0 }}
                      />
                      <img
                        src={logoUrl}
                        alt={movie.title || movie.name}
                        className={`relative w-auto max-w-[260px] object-contain origin-bottom-left transition-all duration-300 z-[1] ${logoDim.isSquare ? 'h-14 md:h-20' : 'h-10 md:h-12'}`}
                        onError={() => setImgFailed(true)}
                      />
                    </div>
                  ) : (
                    <h4 className="text-white font-leaner text-4xl line-clamp-2 drop-shadow-md tracking-wide text-center mb-2 leading-none">
                      {movie.title || movie.name}
                    </h4>
                  )}
                </div>
              </div>

              {/* Info Section */}
              <div className="px-4 pt-6 pb-5 space-y-4 bg-[#181818]">
                {/* Action Buttons */}
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
                      onRate={(r) => rateMovie(movie, r)}
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

                {/* Metadata */}
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

                {/* Genres or Progress */}
                {getWatchData(movie, getLastWatchedEpisode, getVideoState).pct > 0 ? (
                  <div className="pt-0.5 pb-1">
                    <HoverProgressBar movie={movie} getLastWatchedEpisode={getLastWatchedEpisode} getVideoState={getVideoState} />
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-y-0.5 text-[12.5px] font-medium">
                    {getGenreNames().map((genreName, idx, arr) => {
                      if (!genreName) return null;
                      const genreId = movie.genre_ids?.[idx];
                      const isTV = movie.media_type === 'tv' || (!movie.media_type && !movie.title);
                      return (
                        <span key={genreId ?? idx} className="flex items-center">
                          <span
                            className="text-gray-400 hover:text-white cursor-pointer transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePointerLeave();
                              navigate(`/browse/genre-${genreId}?title=${encodeURIComponent(genreName)}&url=${encodeURIComponent(`/discover/${isTV ? 'tv' : 'movie'}?with_genres=${genreId}&sort_by=popularity.desc`)}`);
                            }}
                          >
                            {genreName}
                          </span>
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

// ─── TopTenRow ───────────────────────────────────────────────────────────────
interface TopTenRowProps {
  title: string;
  fetchUrl?: string;
  data?: Movie[];
  onSelect: (movie: Movie, time?: number, videoId?: string) => void;
  index?: number;
}

const TopTenRow: React.FC<TopTenRowProps> = ({ title, fetchUrl, data, onSelect, index = 0 }) => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const viewRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollState, setScrollState] = useState({ left: false, right: false });
  const [isInView, setIsInView] = useState(!!data || index < 4);

  // Viewport Observer for Lazy Loading
  useEffect(() => {
    if (data || index < 4) {
      setIsInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setIsInView(true); },
      { rootMargin: '1200px' } // Load far in advance to prevent scroll lag
    );
    if (viewRef.current) observer.observe(viewRef.current);
    return () => observer.disconnect();
  }, [data, index]);

  useEffect(() => {
    if (data) {
      setMovies(data.slice(0, 10));
      setLoading(false);
      return;
    }
    if (!isInView) return;

    if (fetchUrl) {
      const loadData = async () => {
        setLoading(true);
        try {
          const results = await fetchData(fetchUrl);
          setMovies(results.slice(0, 10));
        } catch (e) {
          console.error('Top 10 fetch failed', e);
        } finally {
          setLoading(false);
        }
      };
      loadData();
    }
  }, [fetchUrl, data, isInView]);

  const updateScrollState = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setScrollState({
      left: scrollLeft > 5,
      right: scrollLeft + clientWidth < scrollWidth - 5,
    });
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateScrollState();
    el.addEventListener('scroll', updateScrollState, { passive: true });
    window.addEventListener('resize', updateScrollState);
    return () => {
      el.removeEventListener('scroll', updateScrollState);
      window.removeEventListener('resize', updateScrollState);
    };
  }, [movies, loading]);

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const container = scrollRef.current;
    const firstCard = container.querySelector('[data-card]') as HTMLElement | null;
    if (!firstCard) return;

    const style = window.getComputedStyle(firstCard);
    const width = firstCard.offsetWidth;
    const margin = parseFloat(style.marginRight) || 0;
    const step = width + margin;

    const visibleWidth = container.clientWidth;
    const V = Math.max(1, Math.floor(visibleWidth / step));

    // Two-Step Set Logic: 
    // Step 1: Scroll by (V - 2) to reach the "overlap" point (e.g., Card 5).
    // Step 2: Scroll by the remainder (SetLength - Step 1) to hit Card 1 perfectly.
    const S1 = Math.max(1, V - 2);
    const S2 = Math.max(1, movies.length - S1);

    // Detect current position in the 10-card cycle
    const currentPos = Math.round(container.scrollLeft / step) % movies.length;

    let scrollCount = V; // Fallback
    if (direction === 'right') {
      // If we are at Card 1 (0), move to Card 5 (S1)
      if (currentPos === 0) scrollCount = S1;
      // If we are at Card 5 (S1), move to next Card 1 (SetLength)
      else if (currentPos === S1) scrollCount = S2;
    } else {
      // Backwards logic:
      // If at Card 1 (0), jump back to Card 5 (S1)
      if (currentPos === 0) scrollCount = S2;
      // If at Card 5 (S1), jump back to Card 1 (0)
      else if (currentPos === S1) scrollCount = S1;
    }

    const amount = scrollCount * step;

    const oneSetWidth = movies.length * step;
    let rawTarget = direction === 'right'
      ? container.scrollLeft + amount
      : container.scrollLeft - amount;

    // --- Infinity Warping Logic ---
    if (direction === 'left' && rawTarget < 0) {
      container.scrollLeft += oneSetWidth;
      rawTarget += oneSetWidth;
    }
    else if (direction === 'right' && rawTarget > oneSetWidth * 2) {
      container.scrollLeft -= oneSetWidth;
      rawTarget -= oneSetWidth;
    }

    // Snap to nearest card boundary to eliminate 0.5% drift
    const target = Math.round(rawTarget / step) * step;

    animate(container.scrollLeft, target, {
      type: "spring",
      stiffness: 100,
      damping: 20,
      onUpdate: (val) => {
        container.scrollLeft = val;
      }
    });
  };

  const hasEngagedInfinite = useRef(false);

  const handleManualScroll = () => {
    if (!scrollRef.current || movies.length === 0) return;
    const container = scrollRef.current;
    const firstCard = container.querySelector('[data-card]') as HTMLElement | null;
    if (!firstCard) return;

    const style = window.getComputedStyle(firstCard);
    const width = firstCard.offsetWidth;
    const margin = parseFloat(style.marginRight) || 0;
    const step = width + margin;
    const oneSetWidth = movies.length * step;

    if (!hasEngagedInfinite.current) {
        if (container.scrollLeft >= oneSetWidth * 0.8) {
            hasEngagedInfinite.current = true;
        }
    }

    if (container.scrollLeft > oneSetWidth * 1.5) {
      container.scrollLeft -= oneSetWidth;
    } else if (hasEngagedInfinite.current && container.scrollLeft < oneSetWidth / 2) {
      container.scrollLeft += oneSetWidth;
    }

    updateScrollState(); // Update button visibility states if needed
  };

  // Reset infinite engagement on fetch URL change
  useEffect(() => {
    hasEngagedInfinite.current = false;
  }, [fetchUrl]);

  if (isMobile) {
    return (
      <TopTenRowMobile
        title={title}
        fetchUrl={fetchUrl}
        data={data}
        onSelect={onSelect}
        index={index}
      />
    );
  }

  if (!loading && movies.length === 0) return null;

  const btnBase =
    `absolute top-1/2 -translate-y-1/2 z-50 ${SIZES.button} w-12 md:w-16 lg:w-20 ` +
    `bg-black/50 hover:bg-black/70 cursor-pointer flex items-center justify-center ` +
    `transition-[opacity,background-color] duration-200 opacity-0 pointer-events-none`;

  return (
    <motion.div
      ref={viewRef}
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ 
        duration: 0.8, 
        delay: Math.min(index * 0.1, 0.4), 
        ease: [0.16, 1, 0.3, 1] 
      }}
      className="group relative my-4 md:my-6 space-y-2 z-10 hover:z-50 transition-all duration-300"
    >
      <h2 className="pl-4 md:pl-10 lg:pl-16 pr-6 md:pr-14 lg:pr-20 text-[20px] sm:text-[22px] md:text-lg font-bold text-[#e5e5e5] hover:text-white transition cursor-pointer flex items-center group/title w-fit">
        {title}
        <span className="text-xs text-cyan-500 ml-2 opacity-0 group-hover/title:opacity-100 transition-opacity duration-300 flex items-center font-semibold">
          {t('rows.exploreAll')} <CaretRightIcon size={14} className="ml-1" />
        </span>
      </h2>

      <div className="relative group/row">
        {/* Left Button */}
        <div
          className={`${btnBase} left-0 rounded-r-md ${scrollState.left ? 'group-hover/row:opacity-100 group-hover/row:pointer-events-auto' : ''}`}
          onClick={() => scroll('left')}
        >
          <CaretLeftIcon size={64} weight="bold" className="text-white" />
        </div>

        {/* Scroll Container */}
        <div
          ref={scrollRef}
          onScroll={handleManualScroll}
          className="flex overflow-x-scroll scrollbar-hide space-x-0 py-10 -my-10 pl-8 md:pl-14 lg:pl-24 pr-6 md:pr-14 lg:pr-20 w-full items-center pointer-events-auto relative z-10"
        >
          {loading
            ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} data-card className={`relative flex-none ${SIZES.card} mr-1 sm:mr-2 md:mr-2 flex items-end`}>
                {/* Number skeleton */}
                <div className="absolute left-[-5px] bottom-[-4px] h-[110%] w-[90%] flex items-end justify-start pointer-events-none">
                  <div className="h-[85%] w-[65%] bg-[#222] rounded-sm opacity-40 skew-x-[-6deg]" />
                </div>
                {/* Poster skeleton */}
                <div className="absolute right-0 bottom-0 h-full w-[46%] bg-[#222] rounded-sm border border-white/5 overflow-hidden shadow-[0_0_15px_rgba(0,0,0,0.3)]">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-[shimmer_1.5s_infinite]" />
                </div>
              </div>
            ))
            : (() => {
                const tripleList = [...movies, ...movies, ...movies];
                return tripleList.map((movie, index) => {
                  const totalCount = tripleList.length;
                  const leftIdx = (index - 1 + totalCount) % totalCount;
                  const rightIdx = (index + 1) % totalCount;
                  const neighbors = [tripleList[leftIdx], tripleList[rightIdx]];

                  return (
                    <TopTenCard
                      key={`${movie.id}-${index}`}
                      movie={movie}
                      index={index % movies.length}
                      onSelect={onSelect}
                      preload={index % movies.length < 5}
                      neighbors={neighbors}
                    />
                  );
                });
              })()}
        </div>

        {/* Right Button */}
        <div
          className={`${btnBase} right-0 rounded-l-md group-hover/row:opacity-100 group-hover/row:pointer-events-auto`}
          onClick={() => scroll('right')}
        >
          <CaretRightIcon size={64} weight="bold" className="text-white" />
        </div>
      </div>
    </motion.div>
  );
};

export default React.memo(TopTenRow);