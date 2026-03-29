import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { CaretRightIcon, CaretLeftIcon } from '@phosphor-icons/react';
import { Movie } from '../types';
import { fetchData } from '../services/api';

interface TopTenRowProps {
  title: string;
  fetchUrl?: string;
  data?: Movie[];
  onSelect: (movie: Movie) => void;
}

const TopTenRow: React.FC<TopTenRowProps> = ({ title, fetchUrl, data, onSelect }) => {
  const { t } = useTranslation();
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const rowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (data) {
      setMovies(data.slice(0, 10));
      setLoading(false);
      return;
    }

    if (fetchUrl) {
      const loadData = async () => {
        setLoading(true);
        try {
          const results = await fetchData(fetchUrl);
          setMovies(results.slice(0, 10)); // Take top 10
        } catch (e) {
          console.error("Top 10 fetch failed", e);
        } finally {
          setLoading(false);
        }
      };
      loadData();
    }
  }, [fetchUrl, data]);

  const scroll = (direction: 'left' | 'right') => {
    if (rowRef.current) {
      const { clientWidth } = rowRef.current;
      const scrollAmount = clientWidth * 0.75;

      if (direction === 'left') {
        rowRef.current.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
      } else {
        rowRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
      }
    }
  };

  if (!loading && movies.length === 0) return null;

  return (
    <div className="group relative my-4 md:my-6 space-y-2 z-10 hover:z-50 transition-all duration-300">
      <h2 className="px-6 md:px-14 lg:px-20 text-sm sm:text-base md:text-lg font-bold text-[#e5e5e5] hover:text-white transition cursor-pointer flex items-center group/title w-fit">
        {title}
        <span className="text-xs text-cyan-500 ml-2 opacity-0 group-hover/title:opacity-100 transition-opacity duration-300 flex items-center font-semibold">
          {t('rows.exploreAll')} <CaretRightIcon size={14} className="ml-1" />
        </span>
      </h2>

      <div className="relative group/row">
        {/* Hover Hit Box */}
        <div className="absolute inset-x-0 top-0 bottom-0 z-0 pointer-events-auto bg-transparent" />

        {/* Left Button - Height matched to cards */}
        <div
          className={`absolute top-1/2 -translate-y-1/2 left-0 z-50 
            h-[120px] sm:h-[150px] md:h-[180px] lg:h-[210px] 
            w-10 md:w-16 lg:w-20 bg-black/50 hover:bg-black/70 cursor-pointer flex items-center justify-center transition-all duration-300 rounded-r-md pointer-events-none ${loading ? 'opacity-0' : 'opacity-0 group-hover/row:opacity-100 group-hover/row:pointer-events-auto'}`}
          onClick={() => scroll('left')}
        >
          <CaretLeftIcon size={48} className="text-white hover:scale-125 transition drop-shadow-lg" />
        </div>

        {/* Scroll Container */}
        <div
          ref={rowRef}
          className="flex overflow-x-scroll scrollbar-hide space-x-0 py-10 -my-10 px-6 md:px-14 lg:px-20 w-full items-center pointer-events-auto relative z-10 scroll-smooth"
        >
          {loading
            ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="relative flex-none h-[120px] w-[140px] sm:h-[150px] sm:w-[180px] md:h-[180px] md:w-[210px] lg:h-[210px] lg:w-[240px] mr-4 flex items-end">
                {/* Number Skeleton */}
                <div className="h-full w-[30%] bg-transparent flex items-end justify-center pb-2">
                  <div className="h-[60%] w-[60%] bg-[#222] rounded skew-y-6 opacity-30"></div>
                </div>
                {/* Image Skeleton */}
                <div className="h-full w-[70%] bg-[#222] rounded-sm border border-white/5 animate-pulse relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-[shimmer_1.5s_infinite]" />
                </div>
              </div>
            ))
            : movies.map((movie, index) => (
              <div
                key={movie.id}
                className="relative flex-none 
                h-[100px] w-[120px] 
                sm:h-[130px] sm:w-[150px] 
                md:h-[150px] md:w-[170px] 
                lg:h-[180px] lg:w-[200px] 
                cursor-pointer transition-transform duration-300 hover:scale-105 hover:z-40 flex items-end 
                mr-4 sm:mr-6
                pointer-events-auto"
                onClick={() => onSelect(movie)}
              >
                {/* The Number - Now properly positioned to heavily underlap */}
                <div className="absolute left-[-5%] bottom-0 h-full w-[60%] flex items-end justify-start z-0 pointer-events-none pb-0">
                  <svg
                    viewBox="0 0 100 170"
                    className="h-[120%] w-auto drop-shadow-[4px_0_10px_rgba(0,0,0,0.8)] -ml-2 mb-[-5px]"
                    preserveAspectRatio="xMidYMax meet"
                  >
                    <text
                      x="40"
                      y="160"
                      textAnchor="middle"
                      fill="#000000"
                      stroke="#808080"
                      strokeWidth="3.5"
                      strokeLinejoin="round"
                      fontSize="170"
                      fontWeight="900"
                      fontFamily="Arial, sans-serif"
                      letterSpacing={index === 9 ? "-15" : "-5"}
                    >
                      {index + 1}
                    </text>
                  </svg>
                </div>

                {/* The Poster - Pushed to the right and over the number */}
                <img
                  src={movie.poster_path?.startsWith('http') || movie.poster_path?.startsWith('comic://')
                    ? movie.poster_path
                    : `https://image.tmdb.org/t/p/w500${movie.poster_path}`}
                  className="absolute right-0 bottom-0 h-full w-[60%] md:w-[55%] object-cover object-top rounded-sm shadow-[0_0_15px_rgba(0,0,0,0.5)] z-10"
                  alt={movie.title || movie.name}
                  loading="lazy"
                  draggable={false}
                />
              </div>
            ))}
        </div>

        {/* Right Button - Height matched to cards */}
        <div
          className={`absolute top-1/2 -translate-y-1/2 right-0 z-50 
            h-[120px] sm:h-[150px] md:h-[180px] lg:h-[210px] 
            w-10 md:w-16 lg:w-20 bg-black/50 hover:bg-black/70 cursor-pointer flex items-center justify-center transition-all duration-300 rounded-l-md pointer-events-none ${loading ? 'opacity-0' : 'opacity-0 group-hover/row:opacity-100 group-hover/row:pointer-events-auto'}`}
          onClick={() => scroll('right')}
        >
          <CaretRightIcon size={48} className="text-white hover:scale-125 transition drop-shadow-lg" />
        </div>
      </div>
    </div>
  );
};

export default TopTenRow;