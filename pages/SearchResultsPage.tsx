import React from 'react';
import { useTranslation } from 'react-i18next';
import { Movie } from '../types';
import { useNavigate } from 'react-router-dom';
import MovieCard from '../components/MovieCard';
import { useIsMobile } from '../hooks/useIsMobile';
import { SearchMode } from '../hooks/useSearch';
import ExploreSuggestions from '../components/ExploreSuggestions';
import { triggerSearch } from '../utils/search';
import MediaListItem from '../components/MediaListItem';

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
  const isMobile = useIsMobile();

  const suggestions = React.useMemo(() => {
    if (!results || results.length === 0) return [];
    
    const candidates: { text: string; popularity: number; type: 'title' | 'person' | 'keyword' }[] = [];
    const seenTexts = new Set<string>();
    const queryCleaned = query.trim().toLowerCase();

    const addCandidate = (text: string, popularity: number, type: 'title' | 'person' | 'keyword') => {
      if (!text) return;
      
      // Smart cleaning: remove years, "The Movie", "(TV Series)", "Season X", "Vol X", etc.
      let clean = text
        .replace(/\s*[([{(](movie|tv series|short|video|series|film|season\s*\d+|vol(ume)?\s*\d+|part\s*\d+)[)\]}]/gi, '')
        .replace(/\s+:\s+the\s+movie\s*$/gi, '')
        .replace(/\s+-\s+the\s+series\s*$/gi, '')
        .replace(/\s*[([]?\d{4}[)\]]?\s*$/, '')
        .trim();

      // Clean multiple spaces
      clean = clean.replace(/\s+/g, ' ');

      if (clean.length < 2 || clean.length > 35) return;

      const lower = clean.toLowerCase();
      
      // Do not suggest the exact query
      if (lower === queryCleaned) return;

      // Avoid duplicates
      if (seenTexts.has(lower)) return;
      seenTexts.add(lower);

      candidates.push({ text: clean, popularity, type });
    };

    // 1. Process Movie and TV titles, and Actors
    results.forEach(movie => {
      const popularity = movie.popularity || 0;
      if (movie.media_type === 'person') {
        // Only suggest person if popularity is substantial
        if (popularity > 1.5) {
          addCandidate(movie.name || '', popularity, 'person');
        }
      } else {
        const title = movie.title || movie.name || '';
        addCandidate(title, popularity, 'title');
        
        // 2. Smart Sub-Phrase / Keyword extraction from titles
        const splitters = [':', '-', '('];
        for (const splitter of splitters) {
          const idx = title.indexOf(splitter);
          if (idx > 0) {
            const part = title.slice(0, idx).trim();
            if (part.toLowerCase().includes(queryCleaned) && part.length > queryCleaned.length) {
              addCandidate(part, popularity * 1.1, 'keyword'); // boost clean bases
            }
          }
        }
      }
    });

    // 3. Post-processing: Filter out suggestions that are substrings of other more popular suggestions.
    candidates.sort((a, b) => b.popularity - a.popularity);

    const filteredSuggestions: string[] = [];
    candidates.forEach(cand => {
      const isRedundant = filteredSuggestions.some(existing => {
        const existingLower = existing.toLowerCase();
        const candLower = cand.text.toLowerCase();
        // If one is a prefix of another or vice versa, collapse to the shorter, more general one
        if (candLower.startsWith(existingLower) || existingLower.startsWith(candLower)) {
          return true;
        }
        return false;
      });

      if (!isRedundant) {
        filteredSuggestions.push(cand.text);
      }
    });

    return filteredSuggestions.slice(0, 12);
  }, [results, query]);

  if (query.trim().length === 0) {
    return (
      <div className="pt-[calc(6rem+env(safe-area-inset-top))] md:pt-28 px-6 md:px-14 lg:px-20 pb-12 min-h-screen bg-black md:bg-[#121212]" />
    );
  }

  // Removed aggressive localized prefetching for search results

  return (
    <div className={`pt-[calc(5rem+env(safe-area-inset-top))] md:pt-28 pb-12 min-h-screen bg-black md:bg-transparent ${isMobile ? '' : 'px-6 md:px-14 lg:px-20 sm:pl-[calc(72px+1.5rem)]'}`}>

      {!isMobile && (
        <div className="mb-8">
          <ExploreSuggestions
            label={t('search.moreToExplore', { defaultValue: 'More to explore:' })}
            items={suggestions}
            onItemClick={(title) => triggerSearch(navigate, title)}
          />
        </div>
      )}

      {isLoading ? (
        isMobile ? (
          /* Mobile skeleton — horizontal list items */
          <div className="animate-pulse">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <div className="w-[148px] h-[83px] rounded-[7px] bg-[#1c1c1c] flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-white/[0.08] rounded-full w-3/4" />
                  <div className="h-2.5 bg-white/[0.05] rounded-full w-1/2" />
                </div>
                <div className="w-[48px] h-[48px] rounded-full border-[2px] border-white/20 flex-shrink-0" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-2.5 gap-y-4 animate-pulse">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="aspect-video bg-[#1e1e1e] rounded-sm overflow-hidden relative border border-white/[0.04]">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-[shimmer_1.5s_infinite]" style={{ animationDelay: `${(i % 6) * 0.1}s` }} />
                <div className="absolute inset-0 bg-gradient-to-b from-[#252525] via-[#1e1e1e] to-[#181818]" />
                <div className="absolute bottom-3 left-3 space-y-1.5">
                  <div className="h-2 bg-white/[0.08] rounded-full" style={{ width: `${40 + (i % 5) * 18}px` }} />
                  <div className="h-1.5 bg-white/[0.05] rounded-full" style={{ width: `${28 + (i % 3) * 10}px` }} />
                </div>
              </div>
            ))}
          </div>
        )
      ) : results.length > 0 ? (
        isMobile ? (
          /* Mobile — list layout matching My List design */
          <div className="animate-fadeIn">
            {results.map(movie => {
              if (!movie.backdrop_path && !movie.poster_path) return null;
              return (
                <MediaListItem
                  key={movie.id}
                  movie={movie}
                  onSelect={onSelectMovie}
                  onPlay={onPlay}
                />
              );
            })}
            <div className="mt-8 px-4">
              <ExploreSuggestions
                label={t('search.moreToExplore', { defaultValue: 'More to explore:' })}
                items={suggestions}
                onItemClick={(title) => triggerSearch(navigate, title)}
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-2.5 gap-y-4">
            {results.map(movie => {
              if (!movie.backdrop_path && !movie.poster_path) return null;
              return <MovieCard key={movie.id} movie={movie} onSelect={onSelectMovie} onPlay={onPlay} isGrid={true} />;
            })}
          </div>
        )
      ) : (
        <div className={`flex flex-col items-center justify-center mt-20 text-center ${isMobile ? 'px-6' : ''}`}>
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
