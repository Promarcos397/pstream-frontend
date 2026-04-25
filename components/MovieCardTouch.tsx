/**
 * MovieCardTouch.tsx
 *
 * Touch-only variant of MovieCard. Zero hover code, zero pointer listeners,
 * zero timers, zero YouTube player. The browser owns all gestures completely
 * so vertical page scrolling is never interrupted.
 *
 * Used by Row.tsx when prefersHover === false (finger/stylus input).
 * When the user picks up a mouse mid-session, Row switches back to MovieCard.
 */

import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, Link } from 'react-router-dom';
import { PlayIcon, CheckIcon, PlusIcon, ThumbsUpIcon, ThumbsDownIcon, HeartIcon, CaretDownIcon, BookOpenIcon, TicketIcon } from '@phosphor-icons/react';
import { useGlobalContext } from '../context/GlobalContext';
import { GENRES, LOGO_SIZE } from '../constants';
import { getMovieImages } from '../services/api';
import { Movie } from '../types';
import { useIsInTheaters } from '../hooks/useIsInTheaters';
import { MaturityBadge, BadgeOverlay, ProgressIndicator } from './MovieCardBadges';
import { triggerSearch } from '../utils/search';

type MovieRating = 'like' | 'dislike' | 'love';

interface MovieCardTouchProps {
  movie: Movie;
  onSelect: (movie: Movie, time?: number, videoId?: string) => void;
  onPlay?: (movie: Movie) => void;
  isGrid?: boolean;
}

const MovieCardTouch: React.FC<MovieCardTouchProps> = ({ movie, onSelect, onPlay, isGrid = false }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    myList, toggleList, rateMovie, getMovieRating, getVideoState,
    getEpisodeProgress, getLastWatchedEpisode, top10TV, top10Movies,
  } = useGlobalContext();

  const isCinemaOnly = useIsInTheaters(movie);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [imgFailed, setImgFailed] = useState(false);
  const [logoDim, setLogoDim] = useState<{ ratio: number; isSquare: boolean }>({ ratio: 1.5, isSquare: false });
  const [isVisible, setIsVisible] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Scroll detection — suppresses tap-to-open if the finger moved first
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);
  const touchDidScroll = useRef(false);
  const SCROLL_THRESHOLD = 8;

  const isAdded = myList.find(m => m.id === movie.id);
  const isBook = ['series', 'comic', 'manga', 'local'].includes(movie.media_type || '');

  const imageSrc = (movie.poster_path?.startsWith('http') || movie.backdrop_path?.startsWith('http') || movie.poster_path?.startsWith('comic://') || movie.backdrop_path?.startsWith('comic://'))
    ? (movie.backdrop_path || movie.poster_path)
    : `https://image.tmdb.org/t/p/w780${movie.backdrop_path || movie.poster_path}`;

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

  // Fetch logo when visible
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
      } catch (_) {}
    };
    fetchLogo();
    return () => { isMounted = false; };
  }, [isVisible, movie.id, movie.media_type, movie.title]);

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
    if (dateStr) {
      const releaseDate = new Date(dateStr);
      const diffDays = Math.ceil((releaseDate.getTime() - Date.now()) / 86400000);
      if (diffDays > 0 && diffDays <= 30) return { text: 'Coming Soon', type: 'upcoming' };
      if (diffDays >= -45 && diffDays <= 0) return { text: isTV ? 'New Episodes' : 'Recently Added', type: 'new' };
    }
    return null;
  };

  const badge = getBadgeInfo();

  const getGenreNames = () => {
    if (!movie.genre_ids) return [];
    return movie.genre_ids.map(id => t(`genres.${id}`, { defaultValue: GENRES[id] })).filter(Boolean).slice(0, 3);
  };

  const handleOpenModal = () => {
    const savedState = getVideoState(movie.id);
    const rawRect = cardRef.current?.getBoundingClientRect();
    if (rawRect) (window as any).__last_card_rect = rawRect;
    onSelect(movie, savedState?.time ?? 0, savedState?.videoId);
  };

  // Progress bar (same logic as MovieCard, no hover dependency)
  const renderProgress = () => {
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
      <div className="absolute pointer-events-none z-20" style={{ top: 'calc(100% + 8px)', left: '20%', right: '20%' }}>
        <div className="h-[3px] w-full bg-white/20" style={{ borderRadius: 0 }}>
          <div className="h-full bg-[#e50914] transition-all duration-300" style={{ width: `${pct}%`, borderRadius: 0 }} />
        </div>
      </div>
    );
  };

  return (
    <div
      ref={cardRef}
      className={`relative z-10 group/card select-none
        ${isGrid
          ? 'w-full aspect-video cursor-pointer'
          : 'flex-none w-[calc((100vw-3rem)/2.3)] sm:w-[calc((100vw-3rem)/3.3)] md:w-[calc((100vw-3.5rem)/4.3)] lg:w-[calc((100vw-4rem)/6.6)] aspect-[7/4.32] cursor-pointer'
        }`}
      // No touchAction override — browser owns everything, scroll is never blocked
      onTouchStart={(e) => {
        touchStartPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        touchDidScroll.current = false;
      }}
      onTouchMove={(e) => {
        if (touchStartPos.current) {
          const dx = Math.abs(e.touches[0].clientX - touchStartPos.current.x);
          const dy = Math.abs(e.touches[0].clientY - touchStartPos.current.y);
          if (dx > SCROLL_THRESHOLD || dy > SCROLL_THRESHOLD) touchDidScroll.current = true;
        }
      }}
      onClick={() => {
        if (touchDidScroll.current) { touchDidScroll.current = false; return; }
        handleOpenModal();
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

        <div className="absolute inset-x-0 bottom-0 flex items-end justify-center pb-3 px-3">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={movie.title || movie.name}
              onLoad={handleLogoLoad}
              className={`w-auto object-contain drop-shadow-2xl transition-all duration-300 ${logoDim.isSquare ? 'max-h-16' : 'max-h-11'}`}
              draggable={false}
            />
          ) : (
            <h3 className={`text-white font-leaner text-center tracking-wide leading-tight drop-shadow-md line-clamp-3 mb-2 w-full px-1 ${isBook ? 'text-2xl' : 'text-xl'}`}>
              {movie.title || movie.name}
            </h3>
          )}
        </div>

        <BadgeOverlay badge={badge} isBook={isBook} />
      </div>

      {renderProgress()}
    </div>
  );
};

export default React.memo(MovieCardTouch);
