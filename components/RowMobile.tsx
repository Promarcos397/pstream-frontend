import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Movie } from '../types';
import { fetchData } from '../services/api';
import { useGlobalContext } from '../context/GlobalContext';
import MovieCardTouch from './MovieCardTouch';
// removing tablet and ipad styles and sidebar

interface RowMobileProps {
  title: string;
  fetchUrl?: string;
  data?: Movie[];
  onSelect: (movie: Movie) => void;
  onPlay?: (movie: Movie) => void;
  rowKey?: string;
  index?: number;
}

const RowMobile: React.FC<RowMobileProps> = ({
  title,
  fetchUrl,
  data,
  onSelect,
  onPlay,
  rowKey,
  index = 0
}) => {
  const { pageSeenIds, registerSeenIds } = useGlobalContext();
  const [movies, setMovies] = useState<Movie[]>([]);
  const [initialLoad, setInitialLoad] = useState(!data && !!fetchUrl);
  const [isHidden, setIsHidden] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<HTMLDivElement>(null);
  const [isInView, setIsInView] = useState(!!data || index < 4);

  // Viewport Observer for Lazy Loading
  useEffect(() => {
    if (data || index < 4) {
      setIsInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setIsInView(true); },
      { rootMargin: '1200px' } // Load far in advance to prevent scroll lag
    );
    if (viewRef.current) observer.observe(viewRef.current);
    return () => observer.disconnect();
  }, [data, index]);

  const isTV = useMemo(() => {
    if (!fetchUrl) return false;
    return fetchUrl.includes('/tv') || fetchUrl.includes('/trending/tv');
  }, [fetchUrl]);

  const MIN_FEED_VOTE_COUNT = useMemo(() => {
    return isTV ? 10 : 30;
  }, [isTV]);

  // Initial Data Load
  useEffect(() => {
    if (data) {
      setMovies(data);
      setInitialLoad(false);
      return;
    }

    if (!isInView) return;

    if (fetchUrl) {
      let isMounted = true;
      setMovies([]);
      setInitialLoad(true);
      setIsHidden(false);

      const loadRowData = async () => {
        try {
          if (!isMounted) return;

          let gatheredMovies: Movie[] = [];
          let currentPage = 1;
          let keepFetching = true;

          // Loop up to 3 pages to compile at least 5 unique, valid movies on mobile
          while (keepFetching && gatheredMovies.length < 5 && currentPage <= 3) {
            let targetUrl = fetchUrl;
            if (currentPage > 1) {
              if (targetUrl.includes('page=')) {
                targetUrl = targetUrl.replace(/page=\d+/, `page=${currentPage}`);
              } else {
                const separator = targetUrl.includes('?') ? '&' : '?';
                targetUrl = `${targetUrl}${separator}page=${currentPage}`;
              }
            }

            const results = await fetchData(targetUrl);
            if (!isMounted) break;

            if (!results || results.length === 0) {
              keepFetching = false;
              break;
            }

            const isGenreRow = rowKey?.startsWith('home-genre-');

            const filtered = results.filter((m: Movie) => {
              const hasImage = m.poster_path || m.backdrop_path;
              // Bypass global pageSeenIds check ONLY for category/genre rows
              const notSeen = isGenreRow ? true : !pageSeenIds.includes(Number(m.id));
              const hasMinVotes = !m.vote_count || m.vote_count >= MIN_FEED_VOTE_COUNT;
              return hasImage && notSeen && hasMinVotes;
            });

            filtered.forEach((item: Movie) => {
              if (!gatheredMovies.some(g => g.id === item.id)) {
                gatheredMovies.push(item);
              }
            });

            currentPage++;
          }

          if (!isMounted) return;

          // Strided Tier Shuffle Algorithm with high tier size K
          const stridedTierShuffle = (array: Movie[], tierSize: number = 15): Movie[] => {
            const result: Movie[] = [];
            for (let i = 0; i < array.length; i += tierSize) {
              const tier = array.slice(i, i + tierSize);
              for (let j = tier.length - 1; j > 0; j--) {
                const k = Math.floor(Math.random() * (j + 1));
                [tier[j], tier[k]] = [tier[k], tier[j]];
              }
              result.push(...tier);
            }
            return result;
          };

          if (gatheredMovies.length < 3) {
            setIsHidden(true);
          } else {
            const finalMovies = stridedTierShuffle(gatheredMovies);
            setMovies(finalMovies);
            registerSeenIds(finalMovies.map((m: Movie) => Number(m.id)));
          }
        } catch (error) {
          console.error("Error loading mobile row data:", error);
          if (isMounted) setIsHidden(true);
        } finally {
          if (isMounted) setInitialLoad(false);
        }
      };
      loadRowData();
      return () => { isMounted = false; };
    }
  }, [fetchUrl, data, isInView, MIN_FEED_VOTE_COUNT]);

  if (isHidden) return null;
  if (!initialLoad && movies.length === 0) return null;

  return (
    <motion.div
      ref={viewRef}
      initial={{ opacity: 0, y: 15 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ 
        duration: 0.6, 
        delay: Math.min(index * 0.08, 0.3),
        ease: [0.16, 1, 0.3, 1] 
      }}
      className="group relative my-5 sm:my-6 space-y-1.5 z-10"
    >
      <div className="flex items-center justify-between px-6 sm:px-10">
        <h2 className="text-[20px] sm:text-[22px] font-bold text-[#e5e5e5] tracking-wide">
          {title}
        </h2>
      </div>

      <div className="relative">
        <div
          ref={scrollRef}
          className="row-scroll-strip flex overflow-x-scroll scrollbar-hide w-full pointer-events-auto relative z-10 py-1"
          style={{
            WebkitOverflowScrolling: 'touch',
            overscrollBehaviorX: 'contain',
            touchAction: 'pan-x pan-y',
          }}
        >
          <div className="flex-none w-6 sm:w-10 h-full pointer-events-none" />

          {initialLoad
            ? Array.from({ length: 8 }).map((_, i) => (
                <div 
                  key={i} 
                  className="flex-none w-[calc((100vw-3rem)/3.2)] sm:w-[calc((100vw-5rem)/3.8)] aspect-[2/3] bg-zinc-800 rounded-lg overflow-hidden border border-white/[0.04] mr-2 relative"
                >
                  <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.8s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/[0.05] to-transparent" style={{ animationDelay: `${i * 0.08}s` }} />
                  <div className="absolute inset-0 bg-gradient-to-b from-[#252525] via-[#1e1e1e] to-[#181818]" />
                </div>
              ))
            : movies.map((movie, idx) => (
                <div key={`${movie.id}-${idx}`} className="mr-2">
                  <MovieCardTouch movie={movie} onSelect={onSelect} onPlay={onPlay} />
                </div>
              ))
          }

          <div className="flex-none w-6 sm:w-10 h-full pointer-events-none" />
        </div>
      </div>
    </motion.div>
  );
};

export default React.memo(RowMobile);
