import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { CaretRightIcon, CaretLeftIcon } from '@phosphor-icons/react';
import { animate } from 'framer-motion';
import { Movie, RowProps } from '../types';
import MovieCard from './MovieCard';
import { fetchData } from '../services/api';
import { useGlobalContext } from '../context/GlobalContext';
import { useIsMobile } from '../hooks/useIsMobile';
import { getWatchData } from './MovieCardBadges';
import RowMobile from './RowMobile';

import { motion } from 'framer-motion';

const Row: React.FC<RowProps & { index?: number }> = ({ title, fetchUrl, data, onSelect, onPlay, rowKey, onViewAll, index = 0 }) => {
  const { t } = useTranslation();
  const { pageSeenIds, registerSeenIds, videoStates, getVideoState, getLastWatchedEpisode } = useGlobalContext();
  const isMobile = useIsMobile();

  // Minimum vote count to show in any feed — filters out obscure/fan-made content.
  // Slightly lenient vs search (100) since row context is curated by TMDB sort.
  const isTV = useMemo(() => {
    if (!fetchUrl) return false;
    return fetchUrl.includes('/tv') || fetchUrl.includes('/trending/tv');
  }, [fetchUrl]);

  const MIN_FEED_VOTE_COUNT = useMemo(() => {
    return isTV ? 10 : 30;
  }, [isTV]);

  const handleViewAll = () => {
    if (onViewAll && rowKey && fetchUrl) {
      onViewAll(rowKey, fetchUrl, title);
    }
  };
  const canViewAll = !!(onViewAll && rowKey && fetchUrl);
  // Start movies as empty unless data is provided
  const [movies, setMovies] = useState<Movie[]>([]);
  const [initialLoad, setInitialLoad] = useState(!data && !!fetchUrl);
  const [isHidden, setIsHidden] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false); // Add this line
  const [isFetching, setIsFetching] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // Determine if any card in this row has a progress bar so we can add
  // paddingBottom ONLY to rows that need it (avoids wasted space in other rows).
  // Uses getVideoState (movies) and getLastWatchedEpisode (TV shows) from context.
  const hasAnyProgress = useMemo(() => movies.some(movie => {
    return getWatchData(movie, getLastWatchedEpisode, getVideoState).pct > 0;
  }), [movies, videoStates, getLastWatchedEpisode, getVideoState]);

  const viewRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isInView, setIsInView] = useState(!!data || index < 4);
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);

  // Sync window width for threshold calculation
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Infinity Loop Thresholds: 6 (Desktop), 5 (Tablet), 3 (Mobile)
  const shouldLoop = useMemo(() => {
    if (movies.length === 0) return false;
    if (windowWidth >= 1024) return movies.length >= 6;
    if (windowWidth >= 768)  return movies.length >= 5;
    return movies.length >= 3;
  }, [movies.length, windowWidth]);

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
      setPage(1);
      setHasMore(true);
      setInitialLoad(true);
      setIsHidden(false);

      if (scrollRef.current) {
        // We do not reset scrollLeft to 0 here because it breaks the infinite loop offset.
      }

      const loadRowData = async () => {
        try {
          if (!isMounted) return;

          let gatheredMovies: Movie[] = [];
          let currentPage = 1;
          let keepFetching = true;

          // Loop up to 4 pages to compile a rich, deep set of movies for the row
          while (keepFetching && gatheredMovies.length < 60 && currentPage <= 4) {
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
              const hasImage = m.backdrop_path || m.poster_path;
              const hasMinVotes = !m.vote_count || m.vote_count >= MIN_FEED_VOTE_COUNT;
              // Dynamic No-Repetition Rule
              const isNotDuplicate = isGenreRow ? true : !pageSeenIds.includes(Number(m.id));
              
              return hasImage && hasMinVotes && isNotDuplicate;
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
            setIsHidden(true); // Don't show sparse, awkward rows
          } else {
            const finalMovies = stridedTierShuffle(gatheredMovies);
            setMovies(finalMovies);
            registerSeenIds(finalMovies.map((m: Movie) => Number(m.id)));
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
  }, [fetchUrl, data, isInView]);

  const hasEngagedInfinite = useRef(false);

  // Reset infinite engagement on fetch URL change
  useEffect(() => {
    hasEngagedInfinite.current = false;
  }, [fetchUrl]);

  if (isMobile) {
    return (
      <RowMobile
        title={title}
        fetchUrl={fetchUrl}
        data={data}
        onSelect={onSelect}
        onPlay={onPlay}
        rowKey={rowKey}
        index={index}
      />
    );
  }

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
          const uniqueNew = newMovies.filter((m: Movie) =>
            !existingIds.has(m.id) && (!m.vote_count || m.vote_count >= MIN_FEED_VOTE_COUNT)
          );

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

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const container = scrollRef.current;
    const cards = container.querySelectorAll('.movie-card-container');
    if (cards.length === 0) return;

    const firstCard = cards[0] as HTMLElement;
    const style = window.getComputedStyle(firstCard);
    const marginRight = parseFloat(style.marginRight) || 0;
    const step = firstCard.offsetWidth + marginRight;

    const visibleWidth = container.clientWidth;
    const visibleCardsCount = Math.floor(visibleWidth / step);
    const amount = Math.max(1, visibleCardsCount) * step;

    const oneSetWidth = movies.length * step;
    let rawTarget = direction === 'right'
      ? container.scrollLeft + amount
      : container.scrollLeft - amount;

    // --- Infinity Warping Logic ---
    if (shouldLoop) {
      if (direction === 'left' && rawTarget < 0) {
        container.scrollLeft += oneSetWidth;
        rawTarget += oneSetWidth;
      }
      else if (direction === 'right' && rawTarget > oneSetWidth * 2) {
        container.scrollLeft -= oneSetWidth;
        rawTarget -= oneSetWidth;
      }
    }

    // Snap to nearest card
    const target = Math.round(rawTarget / step) * step;

    animate(container.scrollLeft, target, {
      type: "spring",
      stiffness: 100,
      damping: 20,
      onUpdate: (val) => {
        container.scrollLeft = val;
      }
    });
  };

  const handleManualScroll = () => {
    if (!scrollRef.current) return;

    const container = scrollRef.current;

    // Toggle left arrow visibility based on scroll position
    setIsScrolled(container.scrollLeft > 0);

    if (!shouldLoop || movies.length === 0) return;

    const firstCard = container.querySelector('.movie-card-container') as HTMLElement | null;
    if (!firstCard) return;

    const style = window.getComputedStyle(firstCard);
    const marginRight = parseFloat(style.marginRight) || 0;
    const step = firstCard.offsetWidth + marginRight;
    const oneSetWidth = movies.length * step;

    if (!hasEngagedInfinite.current) {
       if (container.scrollLeft >= oneSetWidth * 0.8) {
           hasEngagedInfinite.current = true;
       }
    }

    if (container.scrollLeft > oneSetWidth * 1.5) {
      container.scrollLeft -= oneSetWidth;
    } else if (hasEngagedInfinite.current && container.scrollLeft < oneSetWidth / 2) {
      container.scrollLeft += oneSetWidth;
    }
  };

  if (isHidden) return null;
  if (!initialLoad && movies.length === 0) return null;

  return (
    <motion.div
      ref={viewRef}
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ 
        duration: 0.8, 
        delay: Math.min(index * 0.1, 0.4), // Stagger delay, capped for deep rows
        ease: [0.16, 1, 0.3, 1] 
      }}
      className="group relative my-3 md:my-4 space-y-1 z-10"
    >
      {/* Row Title */}
      <div className="flex items-center justify-between px-6 md:px-14 lg:px-16">
        <h2
          className={`text-sm sm:text-base md:text-lg font-bold text-[#e5e5e5] hover:text-white transition cursor-pointer flex items-center group/title w-fit tracking-wide ${canViewAll ? 'hover:text-white' : ''}`}
          onClick={canViewAll ? handleViewAll : undefined}
        >
          {title}
          {/* Show "Explore All" on desktop when view-all is wired */}
          {!isMobile && canViewAll && (
            <span className="text-xs text-cyan-500 ml-2 opacity-0 group-hover/title:opacity-100 transition-opacity duration-300 flex items-center font-semibold">
              {t('rows.exploreAll')} <CaretRightIcon size={14} className="ml-1" />
            </span>
          )}
        </h2>
        {/* Pagination indicator dashes — desktop only */}
        {!isMobile && !initialLoad && movies.length > 6 && (
          <div className="flex items-center gap-[1.5px] opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            {Array.from({ length: Math.min(Math.ceil(movies.length / 6), 8) }).map((_, i) => (
              <div key={i} className={`h-[1.5px] w-4 rounded-full transition-colors duration-200 ${i === 0 ? 'bg-white/90' : 'bg-white/20'}`} />
            ))}
          </div>
        )}
      </div>      {/* Row Content — full width to allow left-side peek */}
      <div className="relative group/row row-scroll-outer">

        {/* Scroll Container */}
        <div
          ref={scrollRef}
          onScroll={handleManualScroll}
          className={`row-scroll-strip flex overflow-x-scroll scrollbar-hide w-full pointer-events-auto relative z-10`}
          style={{
            WebkitOverflowScrolling: 'touch',
            overscrollBehaviorX: 'contain',
            touchAction: 'pan-x pan-y',
            paddingBottom: hasAnyProgress ? '8px' : '0px',
          }}
        >
          {/* Initial Spacer — aligns first card with title while allowing left peek when scrolled */}
          <div className="flex-none w-6 md:w-14 lg:w-16 h-full pointer-events-none" />

          {initialLoad
            ? Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="movie-card-container relative flex-none w-[calc((100vw-3rem)/2.3)] sm:w-[calc((100vw-3rem)/3.3)] md:w-[calc((100vw-3.5rem)/4.3)] lg:w-[calc((100vw-4rem)/6.6)] aspect-[7/4.20] bg-[#1e1e1e] rounded-sm overflow-hidden border border-white/[0.04] pointer-events-auto mr-1 md:mr-1.5 lg:mr-2">
                <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.8s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/[0.05] to-transparent" style={{ animationDelay: `${i * 0.08}s` }} />
                <div className="absolute inset-0 bg-gradient-to-b from-[#252525] via-[#1e1e1e] to-[#181818]" />
                <div className="absolute bottom-4 left-3 space-y-2">
                  <div className="h-2.5 bg-white/[0.08] rounded-full" style={{ width: `${48 + (i % 4) * 16}px` }} />
                  <div className="h-1.5 bg-white/[0.05] rounded-full" style={{ width: `${32 + (i % 3) * 12}px` }} />
                </div>
              </div>
            ))
            : (() => {
                const listSource = shouldLoop ? [...movies, ...movies, ...movies] : movies;
                return listSource.map((movie, idx) => {
                  if (!movie.backdrop_path && !movie.poster_path) return null;
                  const leftNeighbor = idx > 0 ? listSource[idx - 1] : null;
                  const rightNeighbor = idx < listSource.length - 1 ? listSource[idx + 1] : null;
                  return (
                    <div
                      key={`${movie.id}-${idx}`}
                      className="movie-card-container relative pointer-events-auto mr-1 md:mr-1.5 lg:mr-2 overflow-visible"
                      style={{ zIndex: 'auto' }}
                    >
                      <MovieCard 
                        movie={movie} 
                        onSelect={onSelect} 
                        onPlay={onPlay} 
                        preload={movies.indexOf(movie) < 5} 
                        neighbors={[leftNeighbor, rightNeighbor].filter(Boolean) as Movie[]}
                      />
                    </div>
                  );
                });
              })()
          }

          {/* End Spacer — ensures the last card doesn't hit the right edge too abruptly */}
          <div className="flex-none w-6 md:w-14 lg:w-16 h-full pointer-events-none" />
        </div>

        {/* Arrows — desktop only, hidden if not enough content to loop */}
        {!isMobile && shouldLoop && (
          <>
            <div
              className={`absolute top-0 bottom-0 left-0 z-[1000] w-6 md:w-14 lg:w-16 items-center justify-center cursor-pointer
                bg-transparent hover:bg-[#141414]/70 flex group/arrow-left
                transition-opacity duration-300 rounded-r-sm
                ${(!isScrolled || initialLoad)
                  ? 'opacity-0 pointer-events-none'
                  : 'opacity-0 pointer-events-none group-hover/row:opacity-100 group-hover/row:pointer-events-auto'
                }`}
              onClick={() => scroll('left')}
            >
              <CaretLeftIcon size={76} weight="bold" className="text-white drop-shadow-lg" />
            </div>
            <div
              className={`absolute top-0 bottom-0 right-0 z-[1000] w-6 md:w-14 lg:w-16 items-center justify-center cursor-pointer
                bg-transparent hover:bg-[#141414]/70 flex group/arrow-right
                transition-opacity duration-300 pointer-events-none rounded-l-sm
                ${initialLoad ? 'opacity-0' : 'opacity-0 group-hover/row:opacity-100 group-hover/row:pointer-events-auto'}`}
              onClick={() => scroll('right')}
            >
              <CaretRightIcon size={76} weight="bold" className="text-white drop-shadow-lg" />
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
};

export default React.memo(Row);