import { useState, useEffect, useRef } from 'react';
import { Movie } from '../types';
import { searchMovies } from '../services/api';

const CACHE_DURATION = 1000 * 60 * 5; // 5 minutes
const MIN_VOTE_COUNT = 100; // Filter out obscure content with low votes
const BLACKLISTED_GENRES = [99]; // 99 = Documentary

interface CacheEntry {
  timestamp: number;
  data: Movie[];
}

export type SearchMode = 'multi' | 'comic';

export const useSearch = () => {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<SearchMode>('multi');
  const [results, setResults] = useState<Movie[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Simple in-memory cache
  // Key: "query-mode"
  const cache = useRef<Map<string, CacheEntry>>(new Map());

  useEffect(() => {
    const trimmedQuery = query.trim();

    // 1. Reset if empty
    if (trimmedQuery.length === 0) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    // 2. Minimum length check
    if (trimmedQuery.length < 2) {
      return;
    }

    setIsLoading(true);
    setError(null);

    // 3. Check Cache
    const cacheKey = `${trimmedQuery.toLowerCase()}-${mode}`;
    const cached = cache.current.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < CACHE_DURATION)) {
      setResults(cached.data);
      setIsLoading(false);
      return;
    }

    // 4. Debounce & Fetch
    const timeoutId = setTimeout(async () => {
      try {
        const processedResults: Movie[] = [];
        const seenIds = new Set<number | string>();

        if (mode === 'comic') {
          // --- COMIC SEARCH (Supabase Cloud Series) ---
          const electron = (window as any).electron;
          if (electron?.cloud?.getSeries) {
            const res = await electron.cloud.getSeries();
            if (res.success && res.data) {
              // Filter series by title match
              const searchLower = trimmedQuery.toLowerCase();
              const filtered = res.data.filter((series: any) =>
                series.title?.toLowerCase().includes(searchLower)
              );

              filtered.forEach((series: any) => {
                if (!seenIds.has(series.id)) {
                  seenIds.add(series.id);
                  processedResults.push({
                    id: series.id,
                    title: series.title,
                    name: series.title,
                    overview: series.description || '',
                    poster_path: series.cover_google_id ? `comic://image?id=${series.cover_google_id}` : null,
                    backdrop_path: series.cover_google_id ? `comic://image?id=${series.cover_google_id}` : null,
                    media_type: 'series',
                    vote_average: 9.0,
                    popularity: series.issue_count || 1
                  } as Movie);
                }
              });
            }
          }
        } else {
          // --- TMDB SEARCH ---
          const rawResults = await searchMovies(trimmedQuery);

          // Helper: Check if item passes quality filters
          const passesQualityFilters = (item: Movie): boolean => {
            if (!item.backdrop_path && !item.poster_path) return false;
            if (item.vote_count !== undefined && item.vote_count < MIN_VOTE_COUNT) return false;
            if (item.genre_ids && item.genre_ids.some(id => BLACKLISTED_GENRES.includes(id))) {
              if (!trimmedQuery.toLowerCase().includes('documentary')) return false;
            }
            return true;
          };

          rawResults.forEach((item) => {
            if (item.media_type === 'person' && item.known_for) {
              item.known_for.forEach((work) => {
                if (!seenIds.has(work.id) && passesQualityFilters(work)) {
                  seenIds.add(work.id);
                  processedResults.push(work);
                }
              });
            } else if (item.media_type !== 'person') {
              if (!seenIds.has(item.id) && passesQualityFilters(item)) {
                seenIds.add(item.id);
                processedResults.push(item);
              }
            }
          });

          // Sort by popularity
          processedResults.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
        }

        // 5. Update Cache
        cache.current.set(cacheKey, {
          timestamp: Date.now(),
          data: processedResults
        });

        setResults(processedResults);
      } catch (err) {
        console.error("Search failed", err);
        setError("Failed to fetch results.");
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 400);

    return () => clearTimeout(timeoutId);
  }, [query, mode]);

  const clearSearch = () => setQuery('');

  return { query, setQuery, mode, setMode, results, isLoading, error, clearSearch };
};

export default useSearch;
