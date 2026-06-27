import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence } from 'framer-motion';
import { useGlobalContext } from '../context/GlobalContext';
import { useUIStore } from '../store/useUIStore';
import { LOGO_SIZE } from '../constants';
import { getMovieImages } from '../services/api';
import { Movie } from '../types';
import { BadgeOverlay } from './MovieCardBadges';
import { preloadTrailer } from '../hooks/useTrailer';
import MovieCardTouch from './MovieCardTouch';
import { useIsMobile } from '../hooks/useIsMobile';
import { getOptimizedImageUrl } from '../utils/deviceHelper';
import { getIsScrolling, getIsPointerFast } from '../utils/scrollState';
import { usePrefersHover } from '../hooks/usePrefersHover';
import { useIsInTheaters } from '../hooks/useIsInTheaters';
import MovieCardPopup from './MovieCardPopup';

export { DoubleThumbsUpIcon, RatingIcon } from './MovieCardRating';

const _logoCache = new Map<string, string>();

function getBadgeInfo(
  movie: Movie,
  top10TV: number[] | undefined,
  top10Movies: number[] | undefined,
) {
  const isTV = movie.media_type === 'tv' || (!movie.media_type && !movie.title);
  const id = Number(movie.id);

  if (isTV && top10TV?.includes(id)) return { text: 'Top 10', type: 'top' };
  if (!isTV && top10Movies?.includes(id)) return { text: 'Top 10', type: 'top' };

  const dateStr = movie.release_date || movie.first_air_date;
  if (dateStr) {
    const diffDays = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000);
    if (diffDays > 0 && diffDays <= 30) return { text: 'Coming Soon', type: 'upcoming' };
    if (diffDays >= -45 && diffDays <= 0) return { text: isTV ? 'New Episodes' : 'Recently Added', type: 'new' };
  }

  return null;
}

interface MovieCardProps {
  movie: Movie;
  onSelect: (movie: Movie, time?: number, videoId?: string) => void;
  onPlay?: (movie: Movie) => void;
  isGrid?: boolean;
  preload?: boolean;
  neighbors?: Movie[];
}

const MovieCard: React.FC<MovieCardProps> = ({ movie, onSelect, onPlay, isGrid = false, preload = false, neighbors }) => {
  const prefersHover = usePrefersHover();
  const isMobile = useIsMobile();
  const isCinemaOnly = useIsInTheaters(movie);

  const {
    getVideoState, getEpisodeProgress, getLastWatchedEpisode,
    top10TV, top10Movies,
    settings,
  } = useGlobalContext();

  const activeVideoId = useUIStore(s => s.activeVideoId);
  const setActiveVideoId = useUIStore(s => s.setActiveVideoId);
  const activePopupId = useUIStore(s => s.activePopupId);
  const setActivePopupId = useUIStore(s => s.setActivePopupId);

  const [isHovered, setIsHovered] = useState(false);
  const isHoveredRef = useRef(false);
  useEffect(() => { isHoveredRef.current = isHovered; }, [isHovered]);

  const [hoverPosition, setHoverPosition] = useState<'center' | 'left' | 'right'>('center');
  const [hoveredRect, setHoveredRect] = useState<DOMRect | null>(null);
  const [initialScroll, setInitialScroll] = useState({ x: 0, y: 0 }); // NEW: Lock the scroll coords

  const [replayCount, setReplayCount] = useState(0);
  const [isActuallyPlaying, setIsActuallyPlaying] = useState(false);
  const [hasVideoEnded, setHasVideoEnded] = useState(false);
  const [logoFaded, setLogoFaded] = useState(false);

  useEffect(() => {
    if (isActuallyPlaying && !hasVideoEnded) {
      const t = setTimeout(() => setLogoFaded(true), 3500);
      return () => clearTimeout(t);
    }
    setLogoFaded(false);
  }, [isActuallyPlaying, hasVideoEnded]);

  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [imgFailed, setImgFailed] = useState(false);
  const [logoDim, setLogoDim] = useState<{ ratio: number; isSquare: boolean }>({ ratio: 1.5, isSquare: false });
  const handleLogoLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = e.currentTarget;
    const ratio = naturalWidth / naturalHeight;
    setLogoDim({ ratio, isSquare: ratio < 1.35 });
  };

  const [imageLoaded, setImageLoaded] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  const cardRef = useRef<HTMLDivElement>(null);
  const posterRef = useRef<HTMLImageElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const hoverPositionRef = useRef<'center' | 'left' | 'right'>('center');
  const cardPlayerRef = useRef<any>(null);
  const cardTrailerTimeRef = useRef<number>(0);
  const closeTimerRef = useRef<any>(null);
  const showTimerRef = useRef<any>(null);
  const neighborsTimerRef = useRef<any>(null);
  const preloadTimerRef = useRef<any>(null);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);
  const touchDidScroll = useRef(false);
  const SCROLL_THRESHOLD = 8;

  const myCardId = `card-${movie.id}`;

  const isBook = ['series', 'comic', 'manga', 'local'].includes(movie.media_type || '');
  const badge = getBadgeInfo(movie, top10TV, top10Movies);
  const imageSrc = getOptimizedImageUrl(movie.backdrop_path || movie.poster_path, 'backdrop', isMobile);

  useEffect(() => {
    if (!cardRef.current) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) { setIsVisible(true); observer.disconnect(); }
    }, { rootMargin: '200px' });
    observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible) return;
    const cacheKey = `${movie.id}-${movie.media_type || (movie.title ? 'movie' : 'tv')}`;
    if (_logoCache.has(cacheKey)) { setLogoUrl(_logoCache.get(cacheKey)!); return; }
    if (typeof movie.id === 'string' && movie.id.startsWith('dim')) { setLogoUrl(movie.image_url || ''); return; }
    let isMounted = true;
    (async () => {
      try {
        const mediaType = (movie.media_type || (movie.title ? 'movie' : 'tv')) as 'movie' | 'tv';
        const data = await getMovieImages(String(movie.id), mediaType);
        if (!isMounted) return;
        const logo = data?.logos?.find((l: any) => l.iso_639_1 === 'en' || l.iso_639_1 === null);
        const url = logo ? `https://image.tmdb.org/t/p/${LOGO_SIZE}${logo.file_path}` : '';
        _logoCache.set(cacheKey, url);
        setLogoUrl(url);
      } catch {}
    })();
    return () => { isMounted = false; };
  }, [isVisible, movie.id, movie.media_type, movie.title, movie.image_url]);

  useEffect(() => {
    if (preload && settings.autoplayPreviews) {
      const t = setTimeout(() => preloadTrailer(movie), 1000 + (Number(movie.id) % 5) * 200);
      return () => clearTimeout(t);
    }
  }, [preload, movie, settings.autoplayPreviews]);

  useEffect(() => {
    if (activePopupId && activePopupId !== myCardId && isHovered) {
      setIsHovered(false);
      setHoveredRect(null);
    }
  }, [activePopupId, myCardId, isHovered]);

  useEffect(() => {
    if (activeVideoId && isHovered && (activeVideoId !== myCardId || activeVideoId.startsWith('modal-'))) {
      setIsHovered(false);
      setHoveredRect(null);
    }
  }, [activeVideoId, myCardId, isHovered]);

  useEffect(() => {
    if (!isHovered) return;
    const collapse = () => {
      if (showTimerRef.current) { clearTimeout(showTimerRef.current); showTimerRef.current = null; }
      if (closeTimerRef.current) { clearTimeout(closeTimerRef.current); closeTimerRef.current = null; }
      setIsHovered(false);
      setHoveredRect(null);
      setIsActuallyPlaying(false);
      if (activePopupId === myCardId) setActivePopupId(null);
      if (activeVideoId === myCardId) setActiveVideoId(null);
    };
    window.addEventListener('blur', collapse);
    const onVisibility = () => { if (document.visibilityState === 'hidden') collapse(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('blur', collapse);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [isHovered, activePopupId, activeVideoId, myCardId, setActivePopupId, setActiveVideoId]);

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
    return () => { el.removeEventListener('touchstart', onStart); el.removeEventListener('touchmove', onMove); };
  }, []);

  useEffect(() => {
    if (posterRef.current?.complete) setImageLoaded(true);
  }, [imageSrc]);

  const handleCancelClose = useCallback(() => {
    if (closeTimerRef.current) { clearTimeout(closeTimerRef.current); closeTimerRef.current = null; }
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (showTimerRef.current) { clearTimeout(showTimerRef.current); showTimerRef.current = null; }
    if (preloadTimerRef.current) { clearTimeout(preloadTimerRef.current); preloadTimerRef.current = null; }
    if (neighborsTimerRef.current) { clearTimeout(neighborsTimerRef.current); neighborsTimerRef.current = null; }
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => {
      setIsHovered(false);
      setHoveredRect(null);
      setIsActuallyPlaying(false);
      if (activePopupId === myCardId) setActivePopupId(null);
      if (activeVideoId === myCardId) setActiveVideoId(null);
    }, 0);
  }, [activePopupId, activeVideoId, myCardId, setActivePopupId, setActiveVideoId]);

  const handleMouseEnter = useCallback(() => {
    if (!prefersHover || getIsScrolling() || getIsPointerFast()) return;
    if (closeTimerRef.current) { clearTimeout(closeTimerRef.current); closeTimerRef.current = null; }

    if (settings.autoplayPreviews) {
      preloadTrailer(movie);
      if (neighbors && neighbors.length > 0) {
        if (neighborsTimerRef.current) clearTimeout(neighborsTimerRef.current);
        neighborsTimerRef.current = setTimeout(() => {
          neighbors.forEach(n => { if (n) preloadTrailer(n); });
        }, 100);
      }
    }

    if (showTimerRef.current) return;
    if (isHoveredRef.current) return; 
    
    const delay = 20;

    showTimerRef.current = setTimeout(() => {
      showTimerRef.current = null;
      if (getIsScrolling() || getIsPointerFast()) return;
      const rect = cardRef.current?.getBoundingClientRect();
      if (!rect) return;

      const EDGE_BUFFER = 120;
      let pos: 'center' | 'left' | 'right' = 'center';
      if (rect.left < EDGE_BUFFER) pos = 'left';
      else if (window.innerWidth - rect.right < EDGE_BUFFER) pos = 'right';

      hoverPositionRef.current = pos;
      setHoverPosition(pos);
      setHoveredRect(rect);
      
      // LOCK THE SCROLL COORDINATES HERE!
      setInitialScroll({ x: window.scrollX, y: window.scrollY });
      
      setIsHovered(true);
      setActivePopupId(myCardId);
      setActiveVideoId(myCardId);
    }, delay);
  }, [prefersHover, settings.autoplayPreviews, movie, neighbors, myCardId, setActivePopupId, setActiveVideoId]);

  // When scroll ends, open this card if it's now under the stationary pointer
  useEffect(() => {
    const onSettled = (e: any) => {
      if (e.detail?.element !== cardRef.current) return;
      if (!prefersHover || isHoveredRef.current) return;
      handleMouseEnter();
    };
    window.addEventListener('pstream:scroll-settled', onSettled);
    return () => window.removeEventListener('pstream:scroll-settled', onSettled);
  }, [myCardId, prefersHover, handleMouseEnter]);

  if (isMobile) {
    return <MovieCardTouch movie={movie} onSelect={onSelect} onPlay={onPlay} isGrid={isGrid} />;
  }

  const handleOpenModal = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    if (closeTimerRef.current) { clearTimeout(closeTimerRef.current); closeTimerRef.current = null; }
    setIsHovered(false);
    setHoveredRect(null);
    if (activePopupId === myCardId) setActivePopupId(null);
    if (activeVideoId === myCardId) setActiveVideoId(null);

    let trailerT = cardTrailerTimeRef.current;
    try {
      if (cardPlayerRef.current?.getCurrentTime) trailerT = cardPlayerRef.current.getCurrentTime() || trailerT;
    } catch {}

    const savedState = getVideoState(movie.id);
    const rawRect = cardRef.current?.getBoundingClientRect();
    if (rawRect) (window as any).__last_card_rect = rawRect;

    const timeToPass = trailerT > 0 ? trailerT : (savedState?.time || 0);
    onSelect(movie, timeToPass || undefined, savedState?.videoId || undefined);
  };

  const renderProgressBar = () => {
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
      <div className="absolute pointer-events-none z-20" style={{ top: 'calc(100% + 5px)', left: '25%', right: '25%' }}>
        <div className="h-[2.5px] w-full" style={{ background: '#808080', borderRadius: 0 }}>
          <div className="h-full transition-all duration-300" style={{ width: `${pct}%`, background: '#e50914', borderRadius: 0 }} />
        </div>
      </div>
    );
  };

  return (
    <div
      ref={cardRef}
      data-card="true"
      data-card-id={myCardId}
      className={`relative z-10 group group/card select-none
        ${isHovered && prefersHover ? 'z-[9]' : 'z-10'}
        ${isGrid
          ? 'w-full aspect-video cursor-pointer'
          : 'flex-none h-[128px] aspect-video cursor-pointer'
        }`}
      style={prefersHover ? { touchAction: 'none' } : undefined}
      onMouseEnter={prefersHover ? handleMouseEnter : undefined}
      onMouseLeave={prefersHover ? handleMouseLeave : undefined}
      onClick={(e) => {
        if (touchDidScroll.current) { touchDidScroll.current = false; return; }
        handleOpenModal(e);
      }}
    >
      <div className="w-full h-full relative rounded-sm overflow-hidden movie-card-glow">
        <img
          ref={posterRef}
          src={imageSrc}
          onLoad={() => setImageLoaded(true)}
          className={`w-full h-full object-cover rounded-sm backdrop-pop ${isBook && !isGrid ? 'object-[50%_30%]' : 'object-center'}`}
          style={{ opacity: imageLoaded ? 1 : 0, transition: 'opacity 0.25s ease-out' }}
          alt={movie.name || movie.title}
          loading={preload ? 'eager' : 'lazy'}
          decoding="async"
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
                    style={{ filter: 'blur(4px) brightness(0) opacity(0.8)', transform: 'translate(1px, 2px) scale(1.01)', zIndex: 0 }}
                  />
                  <img
                    src={logoUrl}
                    aria-hidden
                    className={`absolute w-auto object-contain ${logoDim.isSquare ? 'max-h-16' : 'max-h-11'}`}
                    style={{ filter: 'blur(20px) brightness(0) opacity(0.5)', transform: 'scale(1.05)', zIndex: 0 }}
                  />
                  <img
                    src={logoUrl}
                    alt={movie.title || movie.name}
                    onLoad={handleLogoLoad}
                    className={`relative w-auto object-contain z-[1] ${logoDim.isSquare ? 'max-h-16' : 'max-h-11'}`}
                    style={{ filter: 'drop-shadow(0 12px 25px rgba(0,0,0,0.5)) drop-shadow(0 4px 5px rgba(0,0,0,0.35))' }}
                    decoding="async"
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

      {!isHovered && renderProgressBar()}

      {createPortal(
        <AnimatePresence>
          {isHovered && prefersHover && hoveredRect && (
            <MovieCardPopup
              ref={popupRef}
              movie={movie}
              hoveredRect={hoveredRect}
              hoverPosition={hoverPosition}
              initialScroll={initialScroll}
              imageSrc={imageSrc}
              logoUrl={logoUrl ?? ''}
              logoDim={logoDim}
              logoFaded={logoFaded}
              imgFailed={imgFailed}
              setImgFailed={setImgFailed}
              isBook={isBook}
              isCinemaOnly={isCinemaOnly}
              isActuallyPlaying={isActuallyPlaying}
              setIsActuallyPlaying={setIsActuallyPlaying}
              hasVideoEnded={hasVideoEnded}
              setHasVideoEnded={setHasVideoEnded}
              replayCount={replayCount}
              setReplayCount={setReplayCount}
              cardPlayerRef={cardPlayerRef}
              cardTrailerTimeRef={cardTrailerTimeRef}
              onOpenModal={handleOpenModal}
              onMouseLeave={handleMouseLeave}
              onMouseEnter={handleCancelClose}
            />
          )}
        </AnimatePresence>,
        document.getElementById('popup-root') ?? document.body,
      )}
    </div>
  );
};

export default React.memo(MovieCard);