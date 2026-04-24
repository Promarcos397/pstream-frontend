import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { Movie } from '../types';
import { fetchData, getMovieImages } from '../services/api';
import { REQUESTS } from '../constants';
import { CaretLeftIcon, PlusIcon, CheckIcon } from '@phosphor-icons/react';
import { MaturityBadge } from '../components/MovieCardBadges';
import { useGlobalContext } from '../context/GlobalContext';

const TMDB_IMG = 'https://image.tmdb.org/t/p';

interface BrowseGridPageProps {
  onSelectMovie: (movie: Movie, time?: number, videoId?: string) => void;
  onPlay?: (movie: Movie) => void;
}

/* ── Per-card component — backdrop image + logo overlay ─────────────── */

interface GridCardProps {
  movie: Movie;
  onSelect: (movie: Movie) => void;
}

const GridCard: React.FC<GridCardProps> = ({ movie, onSelect }) => {
  const { myList, toggleList } = useGlobalContext();

  // Logo: null=loading, ''=not found, '/path'=found
  const [logoPath, setLogoPath] = useState<string | null>(null);
  const [logoFailed, setLogoFailed] = useState(false);
  const [logoLoading, setLogoLoading] = useState(true);

  const isAdded = !!myList.find(m => m.id === movie.id);
  const mediaType = (movie.media_type || (movie.title ? 'movie' : 'tv')) as 'movie' | 'tv';
  const title = movie.title || movie.name || '';
  const year = (movie.release_date || movie.first_air_date)?.substring(0, 4) || '';

  const backdrop = movie.backdrop_path
    ? `${TMDB_IMG}/w780${movie.backdrop_path}`
    : movie.poster_path
    ? `${TMDB_IMG}/w500${movie.poster_path}`
    : null;

  useEffect(() => {
    let cancelled = false;
    setLogoPath(null);
    setLogoFailed(false);
    setLogoLoading(true);
    getMovieImages(movie.id, mediaType)
      .then(images => {
        if (cancelled) return;
        const logo = images?.logos?.find(
          (l: any) => l.iso_639_1 === 'en' || l.iso_639_1 === null
        );
        setLogoPath(logo ? `${TMDB_IMG}/w300${logo.file_path}` : '');
      })
      .catch(() => { if (!cancelled) setLogoPath(''); })
      .finally(() => { if (!cancelled) setLogoLoading(false); });
    return () => { cancelled = true; };
  }, [movie.id, mediaType]);

  const hasLogo = !logoLoading && logoPath && !logoFailed;
  const noLogo  = !logoLoading && (!logoPath || logoFailed);

  return (
    <div
      className="group relative bg-[#1f1f1f] rounded-sm overflow-hidden cursor-pointer shadow-md hover:shadow-xl hover:scale-[1.03] transition-all duration-200"
      onClick={() => onSelect(movie)}
    >
      {/* 16:9 backdrop */}
      <div className="relative aspect-video overflow-hidden bg-[#141414]">
        {backdrop ? (
          <img
            src={backdrop}
            alt={title}
            loading="lazy"
            className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity duration-300"
          />
        ) : (
          <div className="w-full h-full bg-[#222] flex items-center justify-center">
            <span className="text-gray-600 text-xs">{title}</span>
          </div>
        )}

        {/* Gradient for readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent pointer-events-none" />

        {/* Title logo / text — anchored bottom-left */}
        <div className="absolute bottom-2 left-2 right-10 max-w-[80%]">
          {logoLoading && (
            <div className="h-7 w-20 rounded bg-white/10 animate-pulse" />
          )}
          {hasLogo && (
            <img
              src={logoPath!}
              alt={title}
              className="h-8 max-w-full object-contain object-left-bottom drop-shadow-lg"
              style={{ maxHeight: '36px' }}
              onError={() => setLogoFailed(true)}
            />
          )}
          {noLogo && (
            <p className="text-white text-xs font-bold leading-tight line-clamp-2 drop-shadow">
              {title}
            </p>
          )}
        </div>

        {/* +List button — top-right, revealed on hover */}
        <button
          onClick={(e) => { e.stopPropagation(); toggleList(movie); }}
          title={isAdded ? 'Remove from My List' : 'Add to My List'}
          className={`absolute top-2 right-2 w-6 h-6 rounded-full border-2 flex items-center justify-center
            transition-all duration-150 hover:scale-110 active:scale-95
            opacity-0 group-hover:opacity-100
            ${isAdded
              ? 'border-white bg-white/15 text-white'
              : 'border-gray-400 text-gray-300 hover:border-white hover:text-white'
            }`}
        >
          {isAdded ? <CheckIcon size={10} weight="bold" /> : <PlusIcon size={10} weight="bold" />}
        </button>
      </div>

      {/* Card footer — maturity + year */}
      <div className="flex items-center gap-2 px-2 py-1.5">
        <MaturityBadge adult={movie.adult} voteAverage={movie.vote_average} size="sm" />
        <span className="border border-gray-600 px-1 text-[8px] text-gray-400 font-bold rounded-[2px] leading-none py-px">
          HD
        </span>
        {year && <span className="text-gray-500 text-[11px]">{year}</span>}
      </div>
    </div>
  );
};

/* ── Page ────────────────────────────────────────────────────────────── */

const BrowseGridPage: React.FC<BrowseGridPageProps> = ({ onSelectMovie }) => {
  const { rowKey } = useParams<{ rowKey: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [items, setItems]             = useState<Movie[]>([]);
  const [loading, setLoading]         = useState(true);
  const [page, setPage]               = useState(1);
  const [hasMore, setHasMore]         = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const title    = searchParams.get('title') || formatRowKey(rowKey || '');
  const fetchUrl = searchParams.get('url')   || getFetchUrlForKey(rowKey || '');

  function formatRowKey(key: string) {
    return key.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }

  function getFetchUrlForKey(key: string): string {
    const keyMap: Record<string, string> = {
      'trending':    REQUESTS.fetchTrending,
      'top-picks':   REQUESTS.fetchTopRated,
      'new-popular': REQUESTS.fetchTrendingTV,
      'popular':     REQUESTS.fetchPopular,
      'action':      REQUESTS.fetchActionMovies,
      'drama':       REQUESTS.fetchDramaTV,
      'crime':       REQUESTS.fetchCrimeTV,
    };
    return keyMap[key] || REQUESTS.fetchPopular;
  }

  const MIN_VOTE_COUNT = 50;

  const loadPage = useCallback(async (pageNum: number, reset = false) => {
    if (!fetchUrl) return;
    pageNum === 1 ? setLoading(true) : setIsLoadingMore(true);

    try {
      const sep = fetchUrl.includes('?') ? '&' : '?';
      const res = await fetchData(`${fetchUrl}${sep}page=${pageNum}`) as any;
      const raw: Movie[] = Array.isArray(res) ? res : (res?.results ?? []);

      const filtered = raw.filter((m: Movie) =>
        m.backdrop_path &&                                     // backdrop required
        (!m.vote_count || m.vote_count >= MIN_VOTE_COUNT)
      );

      setItems(prev => {
        if (reset) return filtered;
        const seen = new Set(prev.map(m => m.id));
        return [...prev, ...filtered.filter(m => !seen.has(m.id))];
      });
      setHasMore(filtered.length >= 15);
    } catch (e) {
      console.error('[BrowseGridPage] fetch error', e);
    }

    setLoading(false);
    setIsLoadingMore(false);
  }, [fetchUrl]);

  useEffect(() => {
    setPage(1);
    setItems([]);
    loadPage(1, true);
  }, [rowKey, fetchUrl]);

  const handleLoadMore = () => {
    const next = page + 1;
    setPage(next);
    loadPage(next);
  };

  return (
    <div className="bg-[#141414] min-h-screen pb-16 pt-[calc(4rem+env(safe-area-inset-top))] md:pt-28">
      <div className="px-4 md:px-10 lg:px-14 pt-4">

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-full border border-white/20 flex items-center justify-center text-white/70 hover:border-white hover:text-white transition-colors bg-[#1a1a1a] shrink-0"
            aria-label="Go back"
          >
            <CaretLeftIcon size={18} weight="bold" />
          </button>
          <h1 className="text-white font-bold text-xl md:text-3xl tracking-tight">{title}</h1>
        </div>

        {/* Loading skeleton */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 md:gap-3 animate-pulse">
            {Array.from({ length: 18 }).map((_, i) => (
              <div key={i} className="aspect-video bg-[#222] rounded-sm" />
            ))}
          </div>
        ) : (
          <>
            {items.length === 0 ? (
              <div className="flex items-center justify-center mt-24 text-white/40 text-lg">
                Nothing to show here yet.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 md:gap-3">
                {items.map(movie => (
                  <GridCard key={movie.id} movie={movie} onSelect={onSelectMovie} />
                ))}
              </div>
            )}

            {hasMore && !isLoadingMore && items.length > 0 && (
              <div className="flex justify-center mt-10">
                <button
                  onClick={handleLoadMore}
                  className="px-8 py-3 bg-[#e50914] text-white text-sm font-bold rounded hover:bg-[#f40612] transition-colors active:scale-95"
                >
                  Load More
                </button>
              </div>
            )}

            {isLoadingMore && (
              <div className="flex justify-center mt-10">
                <div className="w-7 h-7 border-2 border-[#e50914] border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default BrowseGridPage;
