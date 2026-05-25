import React, { useState, useRef, useMemo } from 'react';
import { useGlobalContext } from '../context/GlobalContext';
import { Movie } from '../types';
import { BadgeOverlay, ProgressIndicator } from './MovieCardBadges';
import { getOptimizedImageUrl } from '../utils/deviceHelper';

interface MovieCardTouchProps {
  movie: Movie;
  onSelect: (movie: Movie, time?: number, videoId?: string) => void;
  onPlay?: (movie: Movie) => void;
  isGrid?: boolean;
}

const MovieCardTouch: React.FC<MovieCardTouchProps> = ({ movie, onSelect, onPlay, isGrid = false }) => {
  const {
    getVideoState, getLastWatchedEpisode,
    top10TV, top10Movies
  } = useGlobalContext();
  const [imgFailed, setImgFailed] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const touchStartPos = useRef<{ x: number; y: number } | null>(null);
  const touchDidScroll = useRef(false);
  const SCROLL_THRESHOLD = 8;

  const isBook = ['series', 'comic', 'manga', 'local'].includes(movie.media_type || '');

  const posterSrc = useMemo(() => {
    return getOptimizedImageUrl(movie.poster_path, 'poster', true) || null;
  }, [movie.poster_path]);

  const backdropSrc = useMemo(() => {
    return getOptimizedImageUrl(movie.backdrop_path, 'backdrop', true) || null;
  }, [movie.backdrop_path]);

  const imageSrc = imgFailed ? backdropSrc || posterSrc : posterSrc || backdropSrc;

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

  const badge = useMemo(() => getBadgeInfo(), [movie, top10TV, top10Movies]);

  if (!imageSrc) return null;

  const handleTap = () => {
    const savedState = getVideoState(movie.id);
    const rawRect = cardRef.current?.getBoundingClientRect();
    if (rawRect) (window as any).__last_card_rect = rawRect;
    onSelect(movie, savedState?.time ?? 0, savedState?.videoId);
  };

  return (
    <div
      ref={cardRef}
      className={`relative select-none bg-zinc-900 border border-white/[0.04] shadow-md transition-transform duration-200 active:scale-95 overflow-hidden rounded-lg
        ${isGrid
          ? 'w-full aspect-[2/3] cursor-pointer'
          : 'flex-none w-[calc((100vw-3rem)/3.2)] sm:w-[calc((100vw-3rem)/4.3)] md:w-[calc((100vw-3.5rem)/5.3)] lg:w-[calc((100vw-4rem)/6.7)] aspect-[2/3] cursor-pointer'
        }`}
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
        handleTap();
      }}
    >
      <img
        src={imageSrc}
        alt={movie.title || movie.name}
        className="w-full h-full object-cover select-none"
        loading="lazy"
        draggable={false}
        onError={() => setImgFailed(true)}
      />

      <BadgeOverlay badge={badge} isBook={isBook} />

      <ProgressIndicator
        movie={movie}
        getLastWatchedEpisode={getLastWatchedEpisode}
        getVideoState={getVideoState}
      />
    </div>
  );
};

export default React.memo(MovieCardTouch);
