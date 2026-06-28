import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useGlobalContext } from '../context/GlobalContext';
import { Movie } from '../types';
import { fetchData } from '../services/api';
import { BadgeOverlay, ProgressIndicator } from './MovieCardBadges';
// removing tablet and ipad styles and sidebar

// ─── Rank Number ────────────────────────────────────────────────────────────
const RankNumber: React.FC<{ index: number }> = ({ index }) => {
  const isTen = index === 9;
  return (
    <div
      className={`absolute ${isTen ? 'left-[-8px]' : 'left-[8px]'} bottom-[-6px] ${isTen ? 'h-[110px] sm:h-[135px]' : 'h-[124px] sm:h-[152px]'} z-0 pointer-events-none overflow-visible`}
      style={{ width: isTen ? '112%' : '88%' }}
    >
      <svg
        viewBox={isTen ? "0 0 280 210" : "0 0 200 210"}
        className="h-full w-auto"
        preserveAspectRatio="none"
        style={{ overflow: 'visible' }}
      >
        <g
          transform={isTen ? "scale(1.0, 1.08)" : "scale(1.15, 1.12)"}
          style={{ transformOrigin: isTen ? "130px 205px" : "70px 205px" }}
        >
          <text
            x="8"
            y="195"
            textAnchor="start"
            dominantBaseline="auto"
            fill="none"
            stroke="#595959"
            strokeWidth="10"
            strokeLinejoin="round"
            fontSize={isTen ? "175" : "185"}
            fontWeight="900"
            fontFamily="'Inter', sans-serif"
            letterSpacing={isTen ? "-25" : "-8"}
          >
            {index + 1}
          </text>
          <text
            x="8"
            y="195"
            textAnchor="start"
            dominantBaseline="auto"
            fill="#000000"
            stroke="#000000"
            strokeWidth="6"
            strokeLinejoin="round"
            fontSize={isTen ? "175" : "185"}
            fontWeight="900"
            fontFamily="'Inter', sans-serif"
            letterSpacing={isTen ? "-25" : "-8"}
          >
            {index + 1}
          </text>
        </g>
      </svg>
    </div>
  );
};

// ─── TopTenCardTouch ────────────────────────────────────────────────────────
interface TopTenCardTouchProps {
  movie: Movie;
  index: number;
  onSelect: (movie: Movie, time?: number, videoId?: string) => void;
}

const TopTenCardTouch: React.FC<TopTenCardTouchProps> = ({ movie, index, onSelect }) => {
  const {
    getVideoState, getLastWatchedEpisode,
    top10TV, top10Movies
  } = useGlobalContext();

  const cardRef = useRef<HTMLDivElement>(null);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);
  const touchDidScroll = useRef(false);
  const SCROLL_THRESHOLD = 8;

  const isBook = ['series', 'comic', 'manga', 'local'].includes(movie.media_type || '');
  const isTen = index === 9;

  const posterSrc = useMemo(() => {
    if (!movie.poster_path) return null;
    return (movie.poster_path.startsWith('http') || movie.poster_path.startsWith('comic://'))
      ? movie.poster_path
      : `https://image.tmdb.org/t/p/w342${movie.poster_path}`;
  }, [movie.poster_path]);

  const fallbackSrc = useMemo(() => {
    if (!movie.backdrop_path) return null;
    return (movie.backdrop_path.startsWith('http') || movie.backdrop_path.startsWith('comic://'))
      ? movie.backdrop_path
      : `https://image.tmdb.org/t/p/w342${movie.backdrop_path}`;
  }, [movie.backdrop_path]);

  const imageSrc = posterSrc || fallbackSrc;

  const getBadgeInfo = () => {
    const isTV = movie.media_type === 'tv' || (!movie.media_type && !movie.title);
    const movieIdNum = Number(movie.id);

    if (isTV && top10TV?.includes(movieIdNum)) return { text: 'Top 10', type: 'top' };
    if (!isTV && top10Movies?.includes(movieIdNum)) return { text: 'Top 10', type: 'top' };

    const dateStr = movie.release_date || movie.first_air_date;
    const now = new Date();

    if (dateStr) {
      const releaseDate = new Date(dateStr);
      const diffTime = releaseDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays > 0 && diffDays <= 30) return { text: 'Coming Soon', type: 'upcoming' };
      if (diffDays >= -45 && diffDays <= 0) {
        return { text: isTV ? 'New Episodes' : 'Recently Added', type: 'new' };
      }
    }
    return null;
  };

  const badge = useMemo(() => getBadgeInfo(), [movie, top10TV, top10Movies]);

  if (!imageSrc) return null;

  const handleTap = () => {
    const savedState = getVideoState(movie.id);
    const rawRect = cardRef.current?.getBoundingClientRect();
    if (rawRect) (window as any).__last_card_rect = rawRect;
    onSelect(movie, savedState?.time ?? 0, savedState?.videoId);
  };

  const cardWidthClass = isTen ? "w-[155px] sm:w-[195px]" : "w-[215px] sm:w-[260px]";
  const posterWidthClass = isTen ? "w-[99px] sm:w-[120px]" : "w-[46%]";
  const posterRightClass = isTen ? "right-[12px] sm:right-[16px]" : "right-[70px] sm:right-[78px]";

  return (
    <div
      ref={cardRef}
      className={`relative flex-none h-[160px] ${cardWidthClass} sm:h-[200px] mr-0 cursor-pointer flex items-end pointer-events-auto select-none z-10`}
      onTouchStart={(e) => {
        touchStartPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        touchDidScroll.current = false;
      }}
      onTouchMove={(e) => {
        if (touchStartPos.current) {
          const dx = Math.abs(e.touches[0].clientX - touchStartPos.current.x);
          const dy = Math.abs(e.touches[0].clientY - touchStartPos.current.y);
          if (dx > SCROLL_THRESHOLD || dy > SCROLL_THRESHOLD) touchDidScroll.current = true;
        }
      }}
      onClick={() => {
        if (touchDidScroll.current) { touchDidScroll.current = false; return; }
        handleTap();
      }}
    >
      <RankNumber index={index} />

      {/* Poster + Badges */}
      <div className={`absolute ${posterRightClass} bottom-0 h-full z-10 rounded-sm overflow-hidden shadow-[0_0_15px_rgba(0,0,0,0.5)] ${posterWidthClass}`}>
        <img
          src={imageSrc}
          className="w-full h-full object-cover object-top"
          alt={movie.title || movie.name}
          loading="lazy"
          draggable={false}
        />
        <BadgeOverlay badge={badge} isBook={isBook} />
      </div>

    </div>
  );
};

// ─── TopTenRowMobile ────────────────────────────────────────────────────────
interface TopTenRowMobileProps {
  title: string;
  fetchUrl?: string;
  data?: Movie[];
  onSelect: (movie: Movie, time?: number, videoId?: string) => void;
  index?: number;
}

const TopTenRowMobile: React.FC<TopTenRowMobileProps> = ({
  title,
  fetchUrl,
  data,
  onSelect,
  index = 0
}) => {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const viewRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isInView, setIsInView] = useState(!!data || index < 4);

  // Intersection Observer for lazy loading
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

  // Load Top 10 data
  useEffect(() => {
    if (data) {
      setMovies(data.slice(0, 10));
      setLoading(false);
      return;
    }
    if (!isInView) return;

    if (fetchUrl) {
      const loadData = async () => {
        setLoading(true);
        try {
          const results = await fetchData(fetchUrl);
          setMovies((results || []).slice(0, 10));
        } catch (e) {
          console.error('Top 10 mobile fetch failed', e);
        } finally {
          setLoading(false);
        }
      };
      loadData();
    }
  }, [fetchUrl, data, isInView]);

  if (!loading && movies.length === 0) return null;

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
      className="group relative my-5 sm:my-6 space-y-2.5 z-10"
    >
      <div className="flex items-center justify-between px-6 sm:px-10">
        <h2 className="text-[20px] sm:text-[22px] font-bold text-[#e5e5e5] tracking-wide">
          {title}
        </h2>
      </div>

      <div className="relative">
        <div
          ref={scrollRef}
          className="row-scroll-strip flex overflow-x-scroll scrollbar-hide w-full pointer-events-auto relative z-10 py-2 -my-2"
          style={{
            WebkitOverflowScrolling: 'touch',
            overscrollBehaviorX: 'contain',
            touchAction: 'pan-x pan-y',
          }}
        >
          {/* Initial Spacer */}
          <div className="flex-none w-3 sm:w-6 h-full pointer-events-none" />

          {loading
            ? Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="relative flex-none h-[160px] w-[215px] sm:h-[200px] sm:w-[260px] -mr-14 flex items-end">
                  <div className="absolute left-[-5px] bottom-[-4px] h-[110%] w-[90%] flex items-end justify-start pointer-events-none">
                    <div className="h-[85%] w-[65%] bg-[#222] rounded-sm opacity-40 skew-x-[-6deg]" />
                  </div>
                  <div className="absolute right-0 bottom-0 h-full w-[46%] bg-[#222] rounded-sm border border-white/5 overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-[shimmer_1.5s_infinite]" />
                  </div>
                </div>
              ))
            : movies.map((movie, idx) => (
                <div key={`${movie.id}-${idx}`} className="-mr-14">
                  <TopTenCardTouch movie={movie} index={idx} onSelect={onSelect} />
                </div>
              ))
          }

          {/* End Spacer */}
          <div className="flex-none w-6 sm:w-10 h-full pointer-events-none" />
        </div>
      </div>
    </motion.div>
  );
};

export default React.memo(TopTenRowMobile);
