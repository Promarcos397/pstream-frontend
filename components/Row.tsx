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

import { motion } from 'framer-motion';

const Row: React.FC<RowProps & { index?: number }> = ({ title, fetchUrl, data, onSelect, onPlay, rowKey, onViewAll, index = 0 }) => {
  const { t } = useTranslation();
  const { pageSeenIds, registerSeenIds, videoStates, getVideoState, getLastWatchedEpisode } = useGlobalContext();
  const isMobile = useIsMobile();

  // Minimum vote count to show in any feed — filters out obscure/fan-made content.
  // Slightly lenient vs search (100) since row context is curated by TMDB sort.
  const MIN_FEED_VOTE_COUNT = 50;

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
  const [isInView, setIsInView] = useState(false);

  // Viewport Observer for Lazy Loading
  useEffect(() => {
    if (data) {
      setIsInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setIsInView(true); },
      { rootMargin: '400px' } // Load slightly before it comes into view
    );
    if (viewRef.current) observer.observe(viewRef.current);
    return () => observer.disconnect();
  }, [data]);

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
        scrollRef.current.scrollLeft = 0;
      }

      const loadRowData = async () => {
        try {

          if (!isMounted) return;

          const results = await fetchData(fetchUrl);
          if (!isMounted) return;

          // Deduplicate based on global context and filter out missing images + low-quality content
          const uniqueNew = results.filter((m: Movie) => {
            const hasImage = m.backdrop_path || m.poster_path;
            const notSeen = !pageSeenIds.includes(Number(m.id));
            const hasMinVotes = !m.vote_count || m.vote_count >= MIN_FEED_VOTE_COUNT;
            return hasImage && notSeen && hasMinVotes;
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
  }, [fetchUrl, data, isInView]);

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
    if (direction === 'left' && rawTarget < 0) {
      container.scrollLeft += oneSetWidth;
      rawTarget += oneSetWidth;
    }
    else if (direction === 'right' && rawTarget > oneSetWidth * 2) {
      container.scrollLeft -= oneSetWidth;
      rawTarget -= oneSetWidth;
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
    if (!scrollRef.current || movies.length === 0) return;
    const container = scrollRef.current;
    const firstCard = container.querySelector('.movie-card-container') as HTMLElement | null;
    if (!firstCard) return;

    const style = window.getComputedStyle(firstCard);
    const marginRight = parseFloat(style.marginRight) || 0;
    const step = firstCard.offsetWidth + marginRight;
    const oneSetWidth = movies.length * step;

    if (container.scrollLeft > oneSetWidth * 2) {
      container.scrollLeft -= oneSetWidth;
    } else if (container.scrollLeft < 0) {
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
      </div>

      {/* Row Content — no overflow-hidden so modal scale works */}
      <div className="relative group/row row-scroll-outer pl-6 md:pl-14 lg:pl-16">
        {/* Scroll Container */}
        <div
          ref={scrollRef}
          onScroll={handleManualScroll}
          className={`row-scroll-strip flex overflow-x-scroll scrollbar-hide w-full pointer-events-auto relative z-10`}
          style={{
            WebkitOverflowScrolling: 'touch',
            overscrollBehaviorX: 'contain',
            // Prevent synthetic mouse events from touch scroll on iOS
            touchAction: 'pan-x pan-y',  // allow both axes — never block vertical page scroll
            // Extra bottom padding ONLY when this row has cards with progress bars.
            // overflow-x:scroll implicitly clips overflow-y, which hides the floating
            // progress bar that sits 6px below each card. This padding makes room for it.
            paddingBottom: hasAnyProgress ? '8px' : '0px',
          }}
        >

          {/* Infinite row: No static spacers needed anymore as cards loop */}

          {initialLoad
            ? Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="movie-card-container relative flex-none w-[calc((100vw-3rem)/2.5)] sm:w-[calc((100vw-3rem)/4.3)] md:w-[calc((100vw-3.5rem)/5.3)] lg:w-[calc((100vw-4rem)/6.7)] aspect-[7/5] bg-[#1e1e1e] rounded-sm overflow-hidden border border-white/[0.04] pointer-events-auto mr-1 md:mr-1.5 lg:mr-2">
                {/* Shimmer sweep */}
                <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.8s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/[0.05] to-transparent" style={{ animationDelay: `${i * 0.08}s` }} />
                {/* Fake image area top gradient */}
                <div className="absolute inset-0 bg-gradient-to-b from-[#252525] via-[#1e1e1e] to-[#181818]" />
                {/* Fake logo placeholder */}
                <div className="absolute bottom-4 left-3 space-y-2">
                  <div className="h-2.5 bg-white/[0.08] rounded-full" style={{ width: `${48 + (i % 4) * 16}px` }} />
                  <div className="h-1.5 bg-white/[0.05] rounded-full" style={{ width: `${32 + (i % 3) * 12}px` }} />
                </div>
              </div>
            ))
            : [...movies, ...movies, ...movies].map((movie, idx) => (movie.backdrop_path || movie.poster_path) && (
              <div
                key={`${movie.id}-${idx}`}
                className="movie-card-container relative pointer-events-auto mr-1 md:mr-1.5 lg:mr-2 overflow-visible"
                style={{ zIndex: 'auto' }}
              >
                <MovieCard movie={movie} onSelect={onSelect} onPlay={onPlay} />
              </div>
            ))
          }

          {/* Infinite row: No static spacers needed anymore as cards loop */}
        </div>

        {/* Arrows — desktop only */}
        {!isMobile && (
          <>
            <div
              className={`absolute top-0 bottom-0 left-0 z-[1000] w-6 md:w-14 lg:w-16 items-center justify-center cursor-pointer
                bg-transparent hover:bg-[#141414]/70 flex
                transition-opacity duration-300 pointer-events-none rounded-r-sm
                ${initialLoad ? 'opacity-0' : 'opacity-0 group-hover/row:opacity-100 group-hover/row:pointer-events-auto'}`}
              onClick={() => scroll('left')}
            >
              <CaretLeftIcon size={76} weight="bold" className="text-white drop-shadow-lg" />
            </div>
            <div
              className={`absolute top-0 bottom-0 right-0 z-[1000] w-6 md:w-14 lg:w-16 items-center justify-center cursor-pointer
                bg-transparent hover:bg-[#141414]/70 flex
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

export default Row;