import React from 'react';
import { useTranslation } from 'react-i18next';
import { Movie } from '../types';
import { useNavigate } from 'react-router-dom';
import MovieCard from '../components/MovieCard';
import { SearchMode } from '../hooks/useSearch';
import ExploreSuggestions from '../components/ExploreSuggestions';
import { triggerSearch } from '../utils/search';

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
  const navigate = useNavigate();

  // Removed aggressive localized prefetching for search results

  return (
    <div className="pt-[calc(5rem+env(safe-area-inset-top))] md:pt-28 px-6 md:px-14 lg:px-20 pb-12 min-h-screen">

      <div className="mb-8">
        <ExploreSuggestions 
        label={t('search.moreToExplore', { defaultValue: 'More to explore:' })}
        // Skip the first 8 results to avoid repeating what's already visible in the top row
        items={results.slice(8, 20).map(m => m.title || m.name || '').filter(Boolean)}
        onItemClick={(title) => triggerSearch(navigate, title)}
      />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-3 gap-y-6 animate-pulse">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="aspect-video bg-[#222] rounded-sm border border-white/5 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-[shimmer_1.5s_infinite]" />
            </div>
          ))}
        </div>
      ) : results.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-3 gap-y-6">
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
