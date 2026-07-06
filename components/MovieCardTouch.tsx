import React, { useState, useRef, useMemo } from 'react';
import { PlayIcon, InfoIcon, DotsThreeVerticalIcon } from '@phosphor-icons/react';
import { useGlobalContext } from '../context/GlobalContext';
import { Movie } from '../types';
import { BadgeOverlay, ProgressIndicator, getWatchData } from './MovieCardBadges';
import { getOptimizedImageUrl } from '../utils/deviceHelper';
// removing tablet and ipad styles and sidebar

interface MovieCardTouchProps {
  movie: Movie;
  onSelect: (movie: Movie, time?: number, videoId?: string) => void;
  onPlay?: (movie: Movie) => void;
  isGrid?: boolean;
  continueWatching?: boolean;
  onOpenOptions?: (movie: Movie) => void;
}

const MovieCardTouch: React.FC<MovieCardTouchProps> = ({ movie, onSelect, onPlay, isGrid = false, continueWatching = false, onOpenOptions }) => {
  const {
    getVideoState, getLastWatchedEpisode,
    top10TV, top10Movies
  } = useGlobalContext();
  const [imgFailed, setImgFailed] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
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
  const { pct } = useMemo(
    () => getWatchData(movie, getLastWatchedEpisode, getVideoState),
    [movie, getLastWatchedEpisode, getVideoState]
  );

  if (!imageSrc) return null;

  const savedState = getVideoState(movie.id);

  const handleTap = () => {
    const rawRect = cardRef.current?.getBoundingClientRect();
    if (rawRect) (window as any).__last_card_rect = rawRect;
    if (continueWatching && onPlay) {
      onPlay(movie);
    } else {
      onSelect(movie, savedState?.time ?? 0, savedState?.videoId);
    }
  };

  const cardWidthClass = isGrid
    ? 'w-full'
    : 'flex-none w-[calc((100vw-3rem)/3.2)] sm:w-[calc((100vw-5rem)/3.8)]';

  return (
    <div className={continueWatching ? cardWidthClass : undefined}>
      <div
        ref={cardRef}
        className={`relative select-none bg-zinc-900 shadow-md transition-transform duration-200 active:scale-95 overflow-hidden rounded-lg
          ${continueWatching ? 'w-full aspect-[2/3] cursor-pointer' : `${cardWidthClass} aspect-[2/3] cursor-pointer`}`}
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
          style={{ opacity: imgLoaded ? 1 : 0, transition: 'opacity 0.2s ease-out' }}
          loading="lazy"
          decoding="async"
          draggable={false}
          onLoad={() => setImgLoaded(true)}
          onError={() => setImgFailed(true)}
        />

        <BadgeOverlay badge={badge} isBook={isBook} />

        {continueWatching ? (
          pct > 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-14 h-14 rounded-full bg-black/45 border-2 border-white flex items-center justify-center">
                <PlayIcon size={24} weight="fill" className="text-white ml-0.5" />
              </div>
            </div>
          )
        ) : (
          <ProgressIndicator
            movie={movie}
            getLastWatchedEpisode={getLastWatchedEpisode}
            getVideoState={getVideoState}
          />
        )}
      </div>

      {continueWatching && (
        <>
          <div className="h-[3px] bg-[#4d4d4d] mt-1.5 rounded-full overflow-hidden">
            <div className="h-full bg-[#e50914]" style={{ width: `${pct}%` }} />
          </div>
          <div className="flex items-center justify-center gap-4 py-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSelect(movie, savedState?.time ?? 0, savedState?.videoId);
              }}
              className="text-white/85 active:scale-90 transition-transform p-1"
              aria-label="Info"
            >
              <InfoIcon size={20} />
            </button>
            <div className="w-px h-4 bg-white/25" />
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenOptions?.(movie);
              }}
              className="text-white/85 active:scale-90 transition-transform p-1"
              aria-label="More options"
            >
              <DotsThreeVerticalIcon size={20} weight="bold" />
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default React.memo(MovieCardTouch);
