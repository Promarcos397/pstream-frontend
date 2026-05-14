import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { Movie } from '../types';
import MovieCard from '../components/MovieCard';
import { fetchData } from '../services/api';
import { REQUESTS } from '../constants';
import { CaretLeftIcon, CaretDownIcon } from '@phosphor-icons/react';

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
    
    // On first load, fetch 3 pages in parallel to fill the grid
    const pagesToFetch = reset ? [1, 2, 3] : [pageNum];
    const results = await Promise.all(
      pagesToFetch.map(p => fetchData(`${fetchUrl}${sep}page=${p}`))
    );
    
    const raw: Movie[] = results.flatMap((res: any) =>
      Array.isArray(res) ? res : (res?.results ?? [])
    );

    // Deduplicate within the batch
    const seen = new Set<number>();
    const filtered = raw.filter((m: Movie) => {
      if (seen.has(Number(m.id))) return false;
      seen.add(Number(m.id));
      return (
        (m.backdrop_path || m.poster_path) &&
        (!m.vote_count || m.vote_count >= MIN_VOTE_COUNT)
      );
    });

    setItems(prev => {
      if (reset) return filtered;
      const prevSeen = new Set(prev.map(m => m.id));
      return [...prev, ...filtered.filter(m => !prevSeen.has(m.id))];
    });

    // If we got less than 15 even after 3 pages, there simply isn't more
    setHasMore(filtered.length >= 15);
    
    // Next "load more" starts at page 4
    if (reset) setPage(3);

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
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-2 gap-y-6">
            {Array.from({ length: 24 }).map((_, i) => (
              <div key={i} className="aspect-video bg-[#1e1e1e] rounded-sm overflow-hidden relative border border-white/[0.04]">
                <div
                  className="absolute inset-0 -translate-x-full animate-[shimmer_1.8s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/[0.05] to-transparent"
                  style={{ animationDelay: `${(i % 6) * 0.1}s` }}
                />
                <div className="absolute inset-0 bg-gradient-to-b from-[#252525] via-[#1e1e1e] to-[#181818]" />
                <div className="absolute bottom-3 left-3 space-y-1.5">
                  <div className="h-2 bg-white/[0.08] rounded-full" style={{ width: `${40 + (i % 5) * 18}px` }} />
                  <div className="h-1.5 bg-white/[0.05] rounded-full" style={{ width: `${28 + (i % 3) * 10}px` }} />
                </div>
              </div>
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
                  title="Load more"
                  className="w-11 h-11 rounded-full border border-white/20 bg-[#2a2a2a] hover:border-white/50 hover:bg-[#3a3a3a] flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95 group/btn"
                >
                  <CaretDownIcon size={20} className="text-white/60 group-hover/btn:text-white transition-colors" />
                </button>
              </div>
            )}

            {isLoadingMore && (
              <div className="flex justify-center mt-10">
                <div className="relative w-9 h-9">
                  <div className="absolute inset-0 rounded-full border-2 border-white/10" />
                  <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-white/60 animate-spin" />
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default BrowseGridPage;
