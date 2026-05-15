import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, animate } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useNavigate, Link } from 'react-router-dom';
import {
  CaretRightIcon, CaretLeftIcon, PlayIcon, CheckIcon, PlusIcon,
  ThumbsUpIcon, ThumbsDownIcon, HeartIcon, CaretDownIcon,
  BookOpenIcon, TicketIcon, ArrowCounterClockwiseIcon,
  SpeakerSlashIcon, SpeakerHighIcon
} from '@phosphor-icons/react';
import { useGlobalContext } from '../context/GlobalContext';
import { useIsInTheaters } from '../hooks/useIsInTheaters';
import { GENRES, LOGO_SIZE } from '../constants';
import { getMovieImages, fetchData } from '../services/api';
import { Movie } from '../types';
import { TrailerPlayer } from './TrailerPlayer';
import {
  MaturityBadge, BadgeOverlay, HoverProgressBar,
  getWatchData, ProgressIndicator
} from './MovieCardBadges';

// ─── Shared pointer-type hook (same logic as MovieCard) ─────────────────────
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

// ─── Rating Pill (copied from MovieCard) ────────────────────────────────────
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


// ─── Layout constants ────────────────────────────────────────────────────────
const SIZES = {
  card: "h-[100px] w-[160px] sm:h-[125px] sm:w-[185px] md:h-[150px] md:w-[210px] lg:h-[160px] lg:w-[220px]",
  button: "h-[100px] sm:h-[125px] md:h-[150px] lg:h-[160px]",
};

// ─── Rank Number ────────────────────────────────────────────────────────────
// 1-9: tall, narrow-ish, hugging the left edge.
// 10: smaller overall, digits squished together with negative letter-spacing,
//     container bleeds wider so the "0" peeks past the poster on the right.
const RankNumber: React.FC<{ index: number }> = ({ index }) => {
  const isTen = index === 9;
  return (
    <div
      className={`absolute ${isTen ? 'left-[24px]' : 'left-[22px]'} bottom-[-6px] h-[122%] z-0 pointer-events-none overflow-visible`}
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
          transform-origin={isTen ? "130 205" : "70 205"}
        >
          {/* Outer Outline Stroke */}
          <text
            x="8"
            y="195"
            textAnchor="start"
            dominantBaseline="auto"
            fill="none"
            stroke="#595959"
            strokeWidth="10"
            strokeLinejoin="round"
            fontSize={isTen ? "175" : "185"}
            fontWeight="900"
            fontFamily="'Inter', sans-serif"
            letterSpacing={isTen ? "-25" : "-8"}
          >
            {index + 1}
          </text>
          {/* Main Body with Inner Thickening Stroke */}
          <text
            x="8"
            y="195"
            textAnchor="start"
            dominantBaseline="auto"
            fill="#000000"
            stroke="#000000"
            strokeWidth="6"
            strokeLinejoin="round"
            fontSize={isTen ? "175" : "185"}
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
}> = ({ movie, index, onSelect }) => {
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
  const cardRef = useRef<HTMLDivElement>(null);

  const isBook = ['series', 'comic', 'manga', 'local'].includes(movie.media_type || '');
  const isAdded = myList.find(m => m.id === movie.id);
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
    if (activePopupId && activePopupId !== myId && isHovered) {
      setIsHovered(false);
      setHoveredRect(null);
      setIsHoverVideoReady(false);
    }
  }, [activePopupId, movie.id, isHovered]);

  // Force close if another video (e.g. Hero) takes control
  useEffect(() => {
    const myId = `card-${movie.id}`;
    if (activeVideoId && activeVideoId !== myId && isHovered && activeVideoId.indexOf('modal') === -1) {
      setIsHovered(false);
      setHoveredRect(null);
    }
  }, [activeVideoId, movie.id, isHovered]);

  // Collapse popup on scroll / blur / tab-hide
  useEffect(() => {
    if (!isHovered) return;
    const collapse = () => {
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
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
    setIsHovered(false);
    setHoveredRect(null);
    const myId = `card-${movie.id}`;
    if (activePopupId === myId) setActivePopupId(null);
    if (activeVideoId === myId) setActiveVideoId(null);

    const savedState = getVideoState(movie.id);
    const rawRect = cardRef.current?.getBoundingClientRect();
    if (rawRect) (window as any).__last_card_rect = rawRect;
    onSelect(movie, savedState?.time || 0, savedState?.videoId || undefined);
  };

  const getPopupFixedStyle = (): React.CSSProperties => {
    if (!hoveredRect) return { display: 'none' };
    const POPUP_W = 342;
    const TOP_OFFSET = -88;
    let left: number;
    if (hoverPosition === 'left') left = hoveredRect.left;
    else if (hoverPosition === 'right') left = hoveredRect.right - POPUP_W;
    else left = hoveredRect.left + hoveredRect.width / 2 - POPUP_W / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - POPUP_W - 8));
    return {
      position: 'fixed',
      top: hoveredRect.top + TOP_OFFSET,
      left,
      width: POPUP_W,
      zIndex: 9999,
    };
  };

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

    timerRef.current = setTimeout(() => {
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
    }, 500);
  };

  const handlePointerLeave = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    const myId = `card-${movie.id}`;
    if (activePopupId === myId) setActivePopupId(null);
    if (activeVideoId === myId) setActiveVideoId(null);

    setIsHovered(false);
    setHoveredRect(null);
    setIsHoverVideoReady(false);
    setIsActuallyPlaying(false);
  };

  const posterSrc = (movie.poster_path?.startsWith('http') || movie.poster_path?.startsWith('comic://'))
    ? movie.poster_path
    : `https://image.tmdb.org/t/p/w780${movie.poster_path}`;

  const imageSrc = (movie.poster_path?.startsWith('http') || movie.backdrop_path?.startsWith('http') || movie.poster_path?.startsWith('comic://') || movie.backdrop_path?.startsWith('comic://'))
    ? (movie.backdrop_path || movie.poster_path)
    : `https://image.tmdb.org/t/p/w1280${movie.backdrop_path || movie.poster_path}`;

  return (
    <div
      ref={cardRef}
      data-card
      className={`relative flex-none ${SIZES.card} mr-0 cursor-pointer flex items-end pointer-events-auto select-none z-10`}
      style={prefersHover ? { touchAction: 'none' } : undefined}
      onPointerEnter={prefersHover ? handlePointerEnter : undefined}
      onPointerLeave={prefersHover ? handlePointerLeave : undefined}
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

      {/* Progress bar */}
      <ProgressIndicator
        movie={movie}
        getLastWatchedEpisode={getLastWatchedEpisode}
        getVideoState={getVideoState}
      />

      {/* ─── Hover Popup (portal) ─────────────────────────────────────────── */}
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
              {/* Media Container */}
              <div className="relative w-full h-[200px] bg-[#141414] overflow-hidden rounded-t-md" onClick={handleOpenModal}>
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
                    className="w-full h-full object-cover backdrop-pop object-[50%_30%]"
                    alt="preview"
                  />
                )}

                {/* Mute / Replay */}
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

                {/* Logo / Title overlay inside media */}
                <div className={`absolute bottom-3 left-4 right-12 pointer-events-none z-20 transition-opacity duration-1000 ${logoFaded ? 'opacity-0' : 'opacity-100'}`}>
                  {logoUrl && !imgFailed ? (
                    <div className="relative inline-flex items-end">
                      <img
                        src={logoUrl}
                        aria-hidden
                        className={`absolute w-auto object-contain origin-bottom-left ${logoDim.isSquare ? 'h-14 md:h-20' : 'h-10 md:h-12'}`}
                        style={{ filter: 'blur(4px) brightness(0) opacity(0.8)', transform: 'translate(1px, 2px) scale(1.01)', zIndex: 0 }}
                      />
                      <img
                        src={logoUrl}
                        aria-hidden
                        className={`absolute w-auto object-contain origin-bottom-left ${logoDim.isSquare ? 'h-14 md:h-20' : 'h-10 md:h-12'}`}
                        style={{ filter: 'blur(20px) brightness(0) opacity(0.5)', transform: 'translate(2px, 4px) scale(1.06)', zIndex: 0 }}
                      />
                      <img
                        src={logoUrl}
                        alt={movie.title || movie.name}
                        className={`relative w-auto object-contain origin-bottom-left transition-all duration-300 z-[1] ${logoDim.isSquare ? 'h-14 md:h-20' : 'h-10 md:h-12'}`}
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
                      onRate={(r) => rateMovie(movie, r)}
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
}

const TopTenRow: React.FC<TopTenRowProps> = ({ title, fetchUrl, data, onSelect }) => {
  const { t } = useTranslation();
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const rowRef = useRef<HTMLDivElement>(null);
  const [scrollState, setScrollState] = useState({ left: false, right: false });

  useEffect(() => {
    if (data) {
      setMovies(data.slice(0, 10));
      setLoading(false);
      return;
    }
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
  }, [fetchUrl, data]);

  const updateScrollState = () => {
    if (!rowRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = rowRef.current;
    setScrollState({
      left: scrollLeft > 5,
      right: scrollLeft + clientWidth < scrollWidth - 5,
    });
  };

  useEffect(() => {
    const el = rowRef.current;
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
    if (!rowRef.current) return;
    const container = rowRef.current;
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

  const handleManualScroll = () => {
    if (!rowRef.current || movies.length === 0) return;
    const container = rowRef.current;
    const firstCard = container.querySelector('[data-card]') as HTMLElement | null;
    if (!firstCard) return;

    const style = window.getComputedStyle(firstCard);
    const width = firstCard.offsetWidth;
    const margin = parseFloat(style.marginRight) || 0;
    const step = width + margin;
    const oneSetWidth = movies.length * step;

    if (container.scrollLeft > oneSetWidth * 2) {
      container.scrollLeft -= oneSetWidth;
    } else if (container.scrollLeft < 0) {
      container.scrollLeft += oneSetWidth;
    }

    updateScrollState(); // Update button visibility states if needed
  };

  if (!loading && movies.length === 0) return null;

  const btnBase =
    `absolute top-1/2 -translate-y-1/2 z-50 ${SIZES.button} w-12 md:w-16 lg:w-20 ` +
    `bg-black/50 hover:bg-black/70 cursor-pointer flex items-center justify-center ` +
    `transition-all duration-300 opacity-0 pointer-events-none`;

  return (
    <div className="group relative my-4 md:my-6 space-y-2 z-10 hover:z-50 transition-all duration-300">
      <h2 className="pl-4 md:pl-10 lg:pl-16 pr-6 md:pr-14 lg:pr-20 text-sm sm:text-base md:text-lg font-bold text-[#e5e5e5] hover:text-white transition cursor-pointer flex items-center group/title w-fit">
        {title}
        <span className="text-xs text-cyan-500 ml-2 opacity-0 group-hover/title:opacity-100 transition-opacity duration-300 flex items-center font-semibold">
          {t('rows.exploreAll')} <CaretRightIcon size={14} className="ml-1" />
        </span>
      </h2>

      <div className="relative group/row">
        {/* Left Button */}
        <div
          className={`${btnBase} left-0 rounded-r-md group-hover/row:opacity-100 group-hover/row:pointer-events-auto`}
          onClick={() => scroll('left')}
        >
          <CaretLeftIcon size={64} weight="bold" className="text-white" />
        </div>

        {/* Scroll Container */}
        <div
          ref={rowRef}
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
            : [...movies, ...movies, ...movies].map((movie, index) => (
              <TopTenCard key={`${movie.id}-${index}`} movie={movie} index={index % movies.length} onSelect={onSelect} />
            ))}
        </div>

        {/* Right Button */}
        <div
          className={`${btnBase} right-0 rounded-l-md group-hover/row:opacity-100 group-hover/row:pointer-events-auto`}
          onClick={() => scroll('right')}
        >
          <CaretRightIcon size={64} weight="bold" className="text-white" />
        </div>
      </div>
    </div>
  );
};

export default TopTenRow;