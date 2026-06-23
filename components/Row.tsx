import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { CaretRightIcon, CaretLeftIcon } from '@phosphor-icons/react';
import { animate } from 'framer-motion';
import { Movie, RowProps } from '../types';
import MovieCard from './MovieCard';
import { fetchData, isUrlCached, getMovieImages } from '../services/api';
import { useGlobalContext } from '../context/GlobalContext';
import { SHADOW_BANNED_IDS } from '../constants';
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

  const isPersonalizedRow = useMemo(() =>
    !!(rowKey?.includes('personal') || rowKey?.includes('watched') || rowKey?.includes('liked')),
  [rowKey]);

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
  const [isInView, setIsInView] = useState(!!data || index < 6);
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
    if (data || index < 6) {
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
      setInitialLoad(!isUrlCached(fetchUrl));
      setIsHidden(false);

      const buildPageUrl = (n: number) => {
        if (n === 1) return fetchUrl;
        return fetchUrl.includes('page=')
          ? fetchUrl.replace(/page=\d+/, `page=${n}`)
          : `${fetchUrl}${fetchUrl.includes('?') ? '&' : '?'}page=${n}`;
      };

      const filterBatch = (results: Movie[]): Movie[] =>
        results.filter((m: Movie) => {
          const hasImage = m.backdrop_path || m.poster_path;
          const hasMinVotes = !m.vote_count || m.vote_count >= MIN_FEED_VOTE_COUNT;
          const isNotDuplicate = !pageSeenIds.includes(Number(m.id));
          const isNotBanned = !SHADOW_BANNED_IDS.has(Number(m.id));
          return hasImage && hasMinVotes && isNotDuplicate && isNotBanned;
        });

      const qualityTrim = (arr: Movie[]): Movie[] => {
        if (!isPersonalizedRow || arr.length <= 4) return arr;
        const scores = arr.map(m => (m.vote_average || 0) * Math.log10((m.vote_count || 0) + 10));
        const sorted = [...scores].sort((a, b) => a - b);
        const cutoff = sorted[Math.floor(sorted.length * 0.3)];
        return arr.filter((_, i) => scores[i] >= cutoff);
      };

      // Strided Tier Shuffle: randomises within tiers to preserve quality gradient
      const stridedTierShuffle = (array: Movie[], baseTierSize = 15): Movie[] => {
        const result: Movie[] = [];
        const dynamicTierSize = baseTierSize + Math.floor(Math.random() * 12) - 3;
        for (let i = 0; i < array.length; i += dynamicTierSize) {
          const tier = array.slice(i, i + dynamicTierSize);
          for (let j = tier.length - 1; j > 0; j--) {
            const k = Math.floor(Math.random() * (j + 1));
            [tier[j], tier[k]] = [tier[k], tier[j]];
          }
          result.push(...tier);
        }
        return result;
      };

      const loadRowData = async () => {
        try {
          if (!isMounted) return;

          // Phase 1: fetch pages 1+2 in parallel → show content immediately
          const [r1, r2] = await Promise.all([
            fetchData(buildPageUrl(1)),
            fetchData(buildPageUrl(2)),
          ]);
          if (!isMounted) return;

          const initial = qualityTrim(filterBatch([...(r1 || []), ...(r2 || [])]));

          if (initial.length < 3) {
            setIsHidden(true);
            setInitialLoad(false);
            return;
          }

          const gatheredIds = new Set<number | string>(initial.map(m => m.id));
          const firstFrame = stridedTierShuffle(initial);
          setMovies(firstFrame);
          setInitialLoad(false);
          registerSeenIds(firstFrame.map(m => Number(m.id)));

          // Check logos for the first viewport-worth of cards and push logo-less ones past the visible area
          const LOGO_CHECK = Math.min(firstFrame.length, 10);
          Promise.all(
            firstFrame.slice(0, LOGO_CHECK).map(async m => {
              const mt = (m.media_type || (m.title ? 'movie' : 'tv')) as 'movie' | 'tv';
              const data = await getMovieImages(String(m.id), mt);
              const hasLogo = !!(data?.logos?.find((l: any) => l.iso_639_1 === 'en' || l.iso_639_1 === null));
              return { id: String(m.id), hasLogo };
            })
          ).then(results => {
            if (!isMounted) return;
            const noLogoIds = new Set(results.filter(r => !r.hasLogo).map(r => r.id));
            if (noLogoIds.size === 0) return;
            setMovies(prev => {
              const withLogo = prev.filter(m => !noLogoIds.has(String(m.id)));
              const noLogo   = prev.filter(m =>  noLogoIds.has(String(m.id)));
              return [...withLogo, ...noLogo];
            });
          }).catch(() => {});

          // Phase 2: append pages 3–8 in the background, no re-shuffle
          let gathered = [...initial];
          for (let p = 3; gathered.length < 120 && p <= 8; p++) {
            const results = await fetchData(buildPageUrl(p));
            if (!isMounted) return;
            if (!results || results.length === 0) break;

            const fresh = filterBatch(results).filter(m => !gatheredIds.has(m.id));
            if (fresh.length > 0) {
              fresh.forEach(m => gatheredIds.add(m.id));
              gathered.push(...fresh);
              setMovies(prev => [...prev, ...fresh]);
              registerSeenIds(fresh.map(m => Number(m.id)));
            }
          }
        } catch (error) {
          console.error('Error loading row data:', error);
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
      initial={{ opacity: 0, y: 6 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{
        duration: 0.4,
        delay: Math.min(index * 0.06, 0.25),
        ease: [0.16, 1, 0.3, 1]
      }}
      className="group relative my-3 md:my-4 space-y-1 z-10"
    >
      {/* Row Title */}
      <div className="flex items-center justify-between px-[var(--app-x)]">
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
          <div className="flex-none h-full pointer-events-none" style={{ width: 'var(--app-x)' }} />

          {initialLoad
            ? Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="movie-card-container relative flex-none w-[calc((100vw-3rem)/2.3)] sm:w-[calc((100vw-3rem)/3.3)] md:w-[calc((100vw-3.5rem)/4.3)] lg:w-[calc((100vw-4rem)/6.6)] aspect-[7/4.20] bg-[#1e1e1e] rounded-sm overflow-hidden border border-white/[0.04] pointer-events-auto mr-0.5 md:mr-1 lg:mr-1.5">
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
                      className="movie-card-container relative pointer-events-auto mr-0.5 md:mr-1 lg:mr-1.5 overflow-visible"
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
          <div className="flex-none h-full pointer-events-none" style={{ width: 'var(--app-x)' }} />
        </div>

        {/* Arrows — desktop only, hidden if not enough content to loop */}
        {!isMobile && shouldLoop && (
          <>
            <div
              className={`absolute top-0 bottom-0 left-0 z-[1000] w-6 md:w-14 lg:w-16 items-center justify-center cursor-pointer
                bg-transparent hover:bg-[#141414]/70 flex group/arrow-left
                transition-[opacity,background-color] duration-200 rounded-r-sm
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
                transition-[opacity,background-color] duration-200 pointer-events-none rounded-l-sm
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