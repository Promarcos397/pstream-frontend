import React, { useState, useEffect } from 'react';
import { PlayIcon } from '@phosphor-icons/react';
import { Movie } from '../types';
import { getMovieImages, getCachedMovieImages } from '../services/api';

interface MediaListItemProps {
  movie: Movie;
  onSelect: (m: Movie) => void;
  onPlay?: (m: Movie) => void;
}

const detectMediaType = (m: Movie): 'tv' | 'movie' => {
  if (m.media_type === 'tv') return 'tv';
  if (m.media_type === 'movie') return 'movie';
  return m.name && !m.title ? 'tv' : 'movie';
};

const MediaListItem: React.FC<MediaListItemProps> = React.memo(({ movie, onSelect, onPlay }) => {
  const mediaType = detectMediaType(movie);
  const title = movie.title || movie.name || '';

  const backdropUrl = movie.backdrop_path
    ? `https://image.tmdb.org/t/p/w300${movie.backdrop_path}`
    : movie.poster_path
      ? `https://image.tmdb.org/t/p/w154${movie.poster_path}`
      : null;

  const [logoUrl, setLogoUrl] = useState<string | null | ''>(() => {
    const cached = getCachedMovieImages(String(movie.id), mediaType);
    if (!cached) return null;
    const logo = cached.logos?.find((l: any) => l.iso_639_1 === 'en' || !l.iso_639_1);
    return logo ? `https://image.tmdb.org/t/p/w185${logo.file_path}` : '';
  });

  useEffect(() => {
    if (logoUrl !== null) return;
    getMovieImages(String(movie.id), mediaType).then((data: any) => {
      const logo = data?.logos?.find((l: any) => l.iso_639_1 === 'en' || !l.iso_639_1);
      setLogoUrl(logo ? `https://image.tmdb.org/t/p/w185${logo.file_path}` : '');
    });
  }, [movie.id, mediaType, logoUrl]);

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 active:bg-white/[0.04] transition-colors"
      onClick={() => onSelect(movie)}
    >
      {/* Backdrop + logo */}
      <div className="relative w-[148px] h-[83px] rounded-[7px] overflow-hidden flex-shrink-0 bg-[#1c1c1c]">
        {backdropUrl && (
          <img
            src={backdropUrl}
            alt={title}
            className="w-full h-full object-cover"
            loading="lazy"
            decoding="async"
          />
        )}
        {logoUrl && (
          <div className="absolute inset-0 flex items-end justify-center pb-2 px-2">
            <img
              src={logoUrl}
              alt={title}
              className="max-w-[85%] max-h-[52%] object-contain drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]"
              loading="lazy"
              decoding="async"
            />
          </div>
        )}
      </div>

      {/* Title */}
      <p className="flex-1 min-w-0 text-white font-semibold text-[17px] leading-snug line-clamp-2">
        {title}
      </p>

      {/* Hollow play button */}
      <button
        className="w-[48px] h-[48px] rounded-full border-[2px] border-white flex items-center justify-center flex-shrink-0 active:scale-90 transition-transform"
        onClick={e => { e.stopPropagation(); onPlay?.(movie); }}
        aria-label={`Play ${title}`}
      >
        <PlayIcon size={26} weight="fill" className="text-white ml-[2px]" />
      </button>
    </div>
  );
});

export default MediaListItem;
