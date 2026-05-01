import React from 'react';
import { useTranslation } from 'react-i18next';
import { Movie } from '../types';
import MovieCard from '../components/MovieCard';
import { prefetchStream } from '../services/api';
import { SearchMode } from '../hooks/useSearch';

interface SearchResultsPageProps {
  query: string;
  results: Movie[];
  onSelectMovie: (movie: Movie) => void;
  onPlay?: (movie: Movie) => void;
  isLoading: boolean;
  mode: SearchMode;
  setMode: (mode: SearchMode) => void;
}

const SearchResultsPage: React.FC<SearchResultsPageProps> = ({ query, results, onSelectMovie, onPlay, isLoading, mode, setMode }) => {
  const { t } = useTranslation();

  // Smart Preloading: When results are ready and we aren't loading, pre-warm the cache for top 3 hits
  React.useEffect(() => {
    if (!isLoading && results.length > 0 && mode !== 'comic') {
      const topResults = results.filter(r => r.backdrop_path).slice(0, 3);
      topResults.forEach((movie, index) => {
        const type = movie.media_type || (movie.title ? 'movie' : 'tv');
        const releaseDate = movie.release_date || movie.first_air_date;
        const year = releaseDate ? new Date(releaseDate).getFullYear() : undefined;
        
        // Staggered prefetch to avoid CPU spikes
        setTimeout(() => {
          prefetchStream(movie.title || movie.name || '', year, String(movie.id), type as any);
        }, index * 1000);
      });
    }
  }, [results, isLoading, mode]);

  return (
    <div className="pt-[calc(5rem+env(safe-area-inset-top))] md:pt-28 px-6 md:px-14 lg:px-20 pb-12 min-h-screen">
      <div className="flex items-center justify-between mb-8">
        <div className="text-gray-500 text-sm">
          {t('search.explore')} <span className="text-white">"{query}"</span>
        </div>


      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-x-4 gap-y-8 animate-pulse">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="aspect-video bg-[#222] rounded-sm border border-white/5 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-[shimmer_1.5s_infinite]" />
            </div>
          ))}
        </div>
      ) : results.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-x-4 gap-y-8">
          {results.map(movie => (
            movie.backdrop_path && (
              <MovieCard key={movie.id} movie={movie} onSelect={onSelectMovie} onPlay={onPlay} isGrid={true} />
            )
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center mt-20 text-center">
          <div className="text-xl text-white mb-2">{t('search.noMatches', { query })}</div>
          <div className="text-gray-400 text-sm">{t('search.suggestions')}</div>
          <ul className="text-gray-400 text-sm list-disc list-inside mt-2 text-left">
            <li>{t('search.tip1')}</li>
            <li>{t('search.tip2')}</li>
            <li>{t('search.tip3')}</li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default SearchResultsPage;
