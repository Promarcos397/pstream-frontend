import axios from 'axios';
import { API_KEY, BASE_URL } from '../constants';
import { VideoResponse, TMDBResponse, VideoResult, StreamResult } from '../types';
import { streamCache } from '../utils/streamCache';

// Create API instance
const api = axios.create({
  baseURL: BASE_URL,
  params: {
    api_key: API_KEY,
  },
});

// Giga Engine Backend URL
const GIGA_BACKEND_URL = import.meta.env.VITE_GIGA_BACKEND_URL || 'https://ibrahimar397-pstream-giga.hf.space';

// Current language (defaults to en-US, updated from settings)
let currentLanguage = 'en-US';

// Set API language - call this when language setting changes
export const setApiLanguage = (language: string) => {
  currentLanguage = language;
};

// Interceptor to add language to all requests
api.interceptors.request.use((config) => {
  config.params = {
    ...config.params,
    language: currentLanguage,
  };
  return config;
});

// --- Intelligent Caching & Deduplication Layer ---
const imageCache: Map<string, any> = new Map();
const pendingImageRequests: Map<string, Promise<any>> = new Map();

export const getMovieImages = async (id: number | string, type: 'movie' | 'tv') => {
  const cacheKey = `${type}_${id}`;

  // 1. Return from memory cache if hits
  if (imageCache.has(cacheKey)) return imageCache.get(cacheKey);

  // 2. Deduplicate: Use pending promise if already fetching
  if (pendingImageRequests.has(cacheKey)) return pendingImageRequests.get(cacheKey);

  const request = (async () => {
    let retries = 2;
    while (retries >= 0) {
      try {
        const response = await api.get(`/${type}/${id}/images`, {
          params: { include_image_language: 'en,null' }
        });
        const results = response.data;
        imageCache.set(cacheKey, results);
        return results;
      } catch (error) {
        if (retries === 0) {
          console.error(`Error fetching images for ${type} ${id} (Final):`, error);
          return null;
        }
        retries--;
        await new Promise(r => setTimeout(r, 500)); // Wait 500ms before retry
      }
    }
    return null;
  })();

  pendingImageRequests.set(cacheKey, request);
  return request;
};

export const getMovieCredits = async (id: number | string, type: 'movie' | 'tv') => {
  try {
    const response = await api.get(`/${type}/${id}/credits`);
    return response.data.cast || [];
  } catch (error) {
    console.error(`Error fetching credits for ${type} ${id}:`, error);
    return [];
  }
};

export const getMovieDetails = async (id: number | string, type: 'movie' | 'tv') => {
  try {
    const response = await api.get(`/${type}/${id}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching details for ${type} ${id}:`, error);
    return null;
  }
};

export const getSeasonDetails = async (id: number | string, seasonNumber: number) => {
  try {
    const response = await api.get(`/tv/${id}/season/${seasonNumber}`);
    return response.data;  // Return full object with .episodes property
  } catch (error) {
    console.error(`Error fetching season ${seasonNumber} for tv ${id}:`, error);
    return null;
  }
};

export const getExternalIds = async (id: number | string, type: 'movie' | 'tv') => {
  try {
    const response = await api.get(`/${type}/${id}/external_ids`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching external IDs for ${type} ${id}:`, error);
    return null;
  }
};

export const getRecommendations = async (id: number | string, type: 'movie' | 'tv') => {
  try {
    const response = await api.get<TMDBResponse>(`/${type}/${id}/recommendations`);
    return response.data.results;
  } catch (error) {
    console.error(`Error fetching recommendations for ${type} ${id}:`, error);
    return [];
  }
};

export const searchMovies = async (query: string) => {
  try {
    const response = await api.get<TMDBResponse>('/search/multi', {
      params: {
        query,
        include_adult: false
      }
    });
    return response.data.results;
  } catch (error) {
    console.error("Search error", error);
    return [];
  }
};

// Generic fetcher that can handle full URLs (axios ignores baseURL if url is absolute)
export const fetchData = async (url: string) => {
  try {
    const response = await api.get<TMDBResponse>(url);
    return response.data.results;
  } catch (error) {
    console.error("Fetch error", error);
    return [];
  }
}

/**
 * Fetches a list of available YouTube videos for a given movie or TV show,
 * sorted by priority:
 * 1. Type: Trailer
 * 2. Type: Teaser
 * 3. Type: Clip
 * 4. Type: Featurette
 * 5. Other types
 * 
 * Returns an array of YouTube keys.
 */
export const fetchTrailers = async (id: number | string, type: 'movie' | 'tv'): Promise<string[]> => {
  try {
    const details = await getMovieDetails(id, type);
    if (!details) return [];

    const title = details.title || details.name || '';
    const releaseDate = details.release_date || details.first_air_date;
    const year = releaseDate ? new Date(releaseDate).getFullYear().toString() : undefined;
    const company = details.production_companies?.[0]?.name;

    // We dynamically import the YouTube service to avoid circular dependency
    // if api.ts is imported inside YouTubeService.
    const { searchTrailersWithFallback } = await import('./YouTubeService');
    
    // User requested custom precision query on all surfaces
    const customTrailers = await searchTrailersWithFallback({
      title,
      year,
      company,
      type
    }, 1);

    return customTrailers;
  } catch (error) {
    console.error("Error in fetchTrailers:", error);
    return [];
  }
};

// Deprecated: Wraps fetchTrailers for backward compatibility (returns first result)
export const fetchTrailer = async (id: number | string, type: 'movie' | 'tv'): Promise<string | null> => {
  const trailers = await fetchTrailers(id, type);
  return trailers.length > 0 ? trailers[0] : null;
};

/**
 * Fetch a stream for a given movie or TV show.
 * Detects if it's running in Electron (using direct scraper) or Web (using server API).
 */
export const getStream = async (title: string, type: 'movie' | 'tv', year?: number, season: number = 1, episode: number = 1, tmdbId?: string, imdbId?: string) => {
  try {
    const params = new URLSearchParams({
      tmdbId: tmdbId || '',
      type,
      season: season.toString(),
      episode: episode.toString(),
      imdbId: imdbId || '',
      title: title || '',
      year: year ? year.toString() : ''
    });

    console.log(`[GigaEngine] Requesting stream (Giga Backend)...`);
    const response = await axios.get(`${GIGA_BACKEND_URL}/api/stream?${params.toString()}`, {
        timeout: 30000  // 30s max — HF Space cold start can take ~15-20s
    });
    return response.data;
  } catch (error: any) {
    console.error(`[GigaEngine] Ultimate resolution failure: ${error.message}`);
    throw error;
  }
};

// PREFETCH DISABLED: 
// Pre-fetching resolves the direct M3U8 URL and saves it in streamCache.
// However, providers like VidLink and VidZee use highly volatile, time-sensitive tokens.
// If we prefetch the stream 3 minutes before the user actually clicks 'Play', the token
// will have already expired, throwing a 403 Forbidden error and forcing a re-fetch anyway.
// Since the backend now uses `fastRace` (resolving in < 1 second), prefetching is unnecessary.
export const prefetchStream = async (title: string, year: number | undefined, tmdbId: string, type: 'movie' | 'tv', season: number = 1, episode: number = 1, imdbId?: string) => {
  // no-op to prevent 403 cache poisoning
  return;
};

export const getReleaseDates = async (id: number | string, type: 'movie' | 'tv') => {
  try {
    const response = await api.get(`/${type}/${id}/release_dates`);
    return response.data.results || [];
  } catch (error) {
    console.error(`Error fetching release dates for ${type} ${id}:`, error);
    return [];
  }
};

export default api;