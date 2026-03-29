import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { CaretRightIcon, CaretLeftIcon } from '@phosphor-icons/react';
import { Movie, RowProps } from '../types';
import MovieCard from './MovieCard';
import { fetchData } from '../services/api';
import { useGlobalContext } from '../context/GlobalContext';

const Row: React.FC<RowProps> = ({ title, fetchUrl, data, onSelect, onPlay }) => {
  const { t } = useTranslation();
  const { pageSeenIds, registerSeenIds } = useGlobalContext();
  
  // Start movies as empty unless data is provided
  const [movies, setMovies] = useState<Movie[]>([]);
  const [initialLoad, setInitialLoad] = useState(!data && !!fetchUrl);
  const [isHidden, setIsHidden] = useState(false);
  
  const [isFetching, setIsFetching] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const rowRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  // Initial Data Load
  useEffect(() => {
    if (data) {
      setMovies(data);
      setInitialLoad(false);
      return;
    }

    if (fetchUrl) {
      let isMounted = true;
      setMovies([]);
      setPage(1);
      setHasMore(true);
      setInitialLoad(true);
      setIsHidden(false);
      
      if (rowRef.current) {
        rowRef.current.scrollLeft = 0;
      }

      const loadRowData = async () => {
        try {
          // Priority Network QoS: Staggered delay for high Hero bandwidth pipe
          await new Promise(resolve => setTimeout(resolve, 250));
          if (!isMounted) return;

          const results = await fetchData(fetchUrl);
          if (!isMounted) return;

          // Deduplicate based on global context and filter out missing images
          const uniqueNew = results.filter((m: Movie) => {
             const hasImage = m.backdrop_path || m.poster_path;
             const notSeen = !pageSeenIds.includes(Number(m.id));
             return hasImage && notSeen;
          });

          if (uniqueNew.length < 5) {
             setIsHidden(true); // Don't show sparse, awkward rows
          } else {
             setMovies(uniqueNew);
             registerSeenIds(uniqueNew.map((m: Movie) => Number(m.id)));
          }
        } catch (error) {
          console.error("Error loading row data:", error);
          if (isMounted) setIsHidden(true);
        } finally {
          if (isMounted) setInitialLoad(false);
        }
      };
      loadRowData();
      return () => { isMounted = false; };
    }
  }, [fetchUrl, data]);

  // Load More Function
  const loadMore = async () => {
    if (isFetching || !hasMore || !fetchUrl) return;

    setIsFetching(true);
    const nextPage = page + 1;

    let url = fetchUrl;
    if (url.includes('page=')) {
      url = url.replace(/page=\d+/, `page=${nextPage}`);
    } else {
      const separator = url.includes('?') ? '&' : '?';
      url = `${url}${separator}page=${nextPage}`;
    }

    try {
      const newMovies = await fetchData(url);

      if (newMovies && newMovies.length > 0) {
        setMovies(prev => {
          const existingIds = new Set(prev.map(m => m.id));
          const uniqueNew = newMovies.filter(m => !existingIds.has(m.id));

          if (uniqueNew.length === 0) {
            setHasMore(false);
            return prev;
          }
          return [...prev, ...uniqueNew];
        });
        setPage(nextPage);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error("Error loading more pages:", error);
      setHasMore(false);
    } finally {
      setIsFetching(false);
    }
  };

  const getScrollMetrics = () => {
    if (!rowRef.current) return null;

    const container = rowRef.current;
    const cards = container.querySelectorAll('.movie-card-container');
    if (cards.length === 0) return null;

    const firstCard = cards[0] as HTMLElement;
    const style = window.getComputedStyle(firstCard);
    const marginRight = parseFloat(style.marginRight) || 0;

    const totalCardWidth = firstCard.offsetWidth + marginRight;
    const visibleWidth = container.clientWidth;

    const visibleCardsCount = Math.floor(visibleWidth / totalCardWidth);
    const cardsToScroll = Math.max(1, visibleCardsCount);
    return cardsToScroll * totalCardWidth;
  };

  const scroll = (direction: 'left' | 'right') => {
    if (rowRef.current) {
      const scrollAmount = getScrollMetrics();
      if (!scrollAmount) return;

      if (direction === 'left') {
        rowRef.current.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
      } else {
        rowRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
      }
    }
  };

  if (isHidden) return null;
  if (!initialLoad && movies.length === 0) return null;

  return (
    <div
      className="group relative my-3 md:my-4 space-y-1 z-10 hover:z-50 transition-all duration-300"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Row Title */}
      <div className="flex items-center justify-between px-6 md:px-14 lg:px-16">
        <h2 className="text-sm sm:text-base md:text-lg font-bold text-[#e5e5e5] hover:text-white transition cursor-pointer flex items-center group/title w-fit tracking-wide">
          {title}
          <span className="text-xs text-cyan-500 ml-2 opacity-0 group-hover/title:opacity-100 transition-opacity duration-300 flex items-center font-semibold">
            {t('rows.exploreAll')} <CaretRightIcon size={14} className="ml-1" />
          </span>
        </h2>
        {/* Pagination indicator dashes */}
        {!initialLoad && movies.length > 6 && (
          <div className="flex items-center gap-[1.5px] opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            {Array.from({ length: Math.min(Math.ceil(movies.length / 6), 8) }).map((_, i) => (
              <div key={i} className={`h-[1.5px] w-4 rounded-full transition-colors duration-200 ${i === 0 ? 'bg-white/90' : 'bg-white/20'}`} />
            ))}
          </div>
        )}
      </div>

      {/* Row Content — no overflow-hidden so modal scale works */}
      <div className="relative group/row">
        {/* Scroll Container */}
        <div
          ref={rowRef}
          className="flex overflow-x-scroll scrollbar-hide py-32 -my-32 w-full pointer-events-auto relative z-10 scroll-smooth"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {/* Left spacer mimicking exact padding without scroll-padding limitations */}
          <div className="flex-none w-6 md:w-14 lg:w-16 pointer-events-none"></div>

          {initialLoad
            ? Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="movie-card-container relative flex-none w-[calc((100vw-3rem)/2.5)] sm:w-[calc((100vw-3rem)/4.3)] md:w-[calc((100vw-3.5rem)/5.3)] lg:w-[calc((100vw-4rem)/6.7)] aspect-[7/5] bg-[#222] rounded-sm overflow-hidden border border-white/5 pointer-events-auto mr-1 md:mr-1.5 lg:mr-2">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full animate-[shimmer_1.5s_infinite]" />
                <div className="absolute bottom-3 left-3 right-3 space-y-2 opacity-50">
                  <div className="h-2 bg-gray-600 rounded w-3/4"></div>
                  <div className="h-2 bg-gray-600 rounded w-1/2"></div>
                </div>
              </div>
            ))
            : movies.slice(0, 36).map((movie) => (movie.backdrop_path || movie.poster_path) && (
              <div key={movie.id} className="movie-card-container pointer-events-auto mr-1 md:mr-1.5 lg:mr-2">
                <MovieCard movie={movie} onSelect={onSelect} onPlay={onPlay} />
              </div>
            ))
          }

          {/* Right spacer for symmetrical scrolling ending */}
          <div className="flex-none w-6 md:w-14 lg:w-16 pointer-events-none"></div>
        </div>

        {/* Left Arrow — matches exact height of cards (top-32, bottom-32 because of py-32 container padding) and width of spacer */}
        <div
          className={`absolute top-32 bottom-32 left-0 z-50 w-6 md:w-14 lg:w-16 items-center justify-center cursor-pointer
            bg-transparent hover:bg-[#141414]/80 flex
            transition-all duration-300 pointer-events-none rounded-r-md
            ${initialLoad ? 'opacity-0' : 'opacity-0 group-hover/row:opacity-100 group-hover/row:pointer-events-auto'}`}
          onClick={() => scroll('left')}
        >
          <CaretLeftIcon size={36} className="text-white hover:scale-125 transition drop-shadow-lg" />
        </div>

        {/* Right Arrow — limits height exactly to the image and width to the padding spacer */}
        <div
          className={`absolute top-32 bottom-32 right-0 z-50 w-6 md:w-14 lg:w-16 items-center justify-center cursor-pointer
            bg-transparent hover:bg-[#141414]/80 flex
            transition-all duration-300 pointer-events-none rounded-l-md
            ${initialLoad ? 'opacity-0' : 'opacity-0 group-hover/row:opacity-100 group-hover/row:pointer-events-auto'}`}
          onClick={() => scroll('right')}
        >
          <CaretRightIcon size={36} className="text-white hover:scale-125 transition drop-shadow-lg" />
        </div>
      </div>
    </div>
  );
};

export default Row;