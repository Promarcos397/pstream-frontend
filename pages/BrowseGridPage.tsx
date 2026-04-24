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
 * Uses MovieCard with isGrid=true — same card as the rows but with
 * 16:9 backdrop instead of poster, hover popup, trailer preview, etc.
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

  const title = searchParams.get('title') || formatRowKey(rowKey || '');
  const fetchUrl = searchParams.get('url') || getFetchUrlForKey(rowKey || '');

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
        (m.backdrop_path || m.poster_path) &&
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

        {/* Loading skeleton — 16:9 aspect to match MovieCard isGrid */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-2 gap-y-10 animate-pulse">
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
              /* gap-y-10 gives space beneath each card for the hover popup overflow */
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-2 gap-y-10">
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
