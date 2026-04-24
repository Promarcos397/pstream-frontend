import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { Movie } from '../types';
import MovieCard from '../components/MovieCard';
import { fetchData } from '../services/api';
import { REQUESTS } from '../constants';
import { CaretLeftIcon } from '@phosphor-icons/react';

interface BrowseGridPageProps {
  onSelectMovie: (movie: Movie, time?: number, videoId?: string) => void;
  onPlay?: (movie: Movie) => void;
}

/**
 * Full-page grid view for a row's content.
 * URL: /browse/:rowKey?url=<fetchUrl>&title=<rowTitle>
 *
 * Rendered inside the main Layout (has Navbar). Uses MovieCard for consistency.
 */
const BrowseGridPage: React.FC<BrowseGridPageProps> = ({ onSelectMovie, onPlay }) => {
  const { rowKey } = useParams<{ rowKey: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [items, setItems] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Title from query param or formatted rowKey
  const title = searchParams.get('title') || formatRowKey(rowKey || '');
  const fetchUrl = searchParams.get('url') || getFetchUrlForKey(rowKey || '');

  function formatRowKey(key: string): string {
    return key
      .split('-')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
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
    if (pageNum === 1) setLoading(true);
    else setIsLoadingMore(true);

    try {
      const separator = fetchUrl.includes('?') ? '&' : '?';
      const url = `${fetchUrl}${separator}page=${pageNum}`;
      const res = await fetchData(url) as any;
      const raw: Movie[] = Array.isArray(res) ? res : (res?.results ?? []);

      // Filter out low-quality entries (same threshold as Row)
      const filtered = raw.filter((m: Movie) =>
        (m.backdrop_path || m.poster_path) &&
        (!m.vote_count || m.vote_count >= MIN_VOTE_COUNT)
      );

      if (reset) {
        setItems(filtered);
      } else {
        setItems(prev => {
          const seen = new Set(prev.map(m => m.id));
          return [...prev, ...filtered.filter(m => !seen.has(m.id))];
        });
      }
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
    const nextPage = page + 1;
    setPage(nextPage);
    loadPage(nextPage);
  };

  return (
    // pt accounts for the fixed Navbar (~68px) and adds breathing room
    <div className="bg-[#141414] min-h-screen pb-16 pt-[calc(4rem+env(safe-area-inset-top))] md:pt-28">
      <div className="px-6 md:px-14 lg:px-16 pt-4">

        {/* Header with back button */}
        <div className="flex items-center gap-3 mb-8">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-full border border-white/20 flex items-center justify-center text-white/70 hover:border-white hover:text-white transition-colors bg-[#1a1a1a]"
            aria-label="Go back"
          >
            <CaretLeftIcon size={18} weight="bold" />
          </button>
          <h1 className="text-white font-bold text-xl md:text-3xl tracking-tight">{title}</h1>
        </div>

        {/* Loading skeleton — matches MovieCard aspect */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-2 gap-y-8 animate-pulse">
            {Array.from({ length: 18 }).map((_, i) => (
              <div key={i} className="aspect-[7/5] bg-[#222] rounded-sm overflow-hidden border border-white/5 relative">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-[shimmer_1.5s_infinite]" />
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* Grid — MovieCard handles its own sizing when isGrid=true */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-2 gap-y-8">
              {items.map(movie => (
                <MovieCard
                  key={movie.id}
                  movie={movie}
                  onSelect={onSelectMovie}
                  onPlay={onPlay}
                  isGrid={true}
                />
              ))}
            </div>

            {items.length === 0 && !loading && (
              <div className="flex flex-col items-center justify-center mt-24 text-center opacity-50">
                <div className="text-lg text-white">Nothing to show here yet.</div>
              </div>
            )}

            {/* Load more */}
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
