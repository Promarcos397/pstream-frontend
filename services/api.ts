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

    // Always use original_title (English) for YouTube search — localized titles
    // produce poor results or miss trailers entirely. original_title is always
    // available in TMDB regardless of the API language setting.
    const title = details.original_title || details.original_name || details.title || details.name || '';
    const releaseDate = details.release_date || details.first_air_date;
    const year = releaseDate ? new Date(releaseDate).getFullYear().toString() : undefined;
    const company = details.production_companies?.[0]?.name;

    // We dynamically import the YouTube service to avoid circular dependency
    // if api.ts is imported inside YouTubeService.
    const { searchTrailersWithFallback } = await import('./YouTubeService');
    
    // Request 3 results: index[0]=highest-viewed (older SD), index[1]=quality reupload (4K)
    // This is the strategy: pick [1] or [2] for better quality per user requirement.
    const customTrailers = await searchTrailersWithFallback({
      title,
      year,
      company,
      type
    }, 3);

    // Return [result[1], result[0], ...rest] — prefer 2nd result (quality reupload)
    // then fall back to 1st if only one result exists
    if (customTrailers.length >= 2) {
        return [customTrailers[1], customTrailers[0], ...customTrailers.slice(2)];
    }
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

/**
 * Smart Stream Pre-fetcher — v2 (2026-04)
 *
 * Strategy: Two modes depending on trigger:
 *
 * 1. WARM mode (list/history batch prefetch):
 *    - Just calls the backend /api/stream, which primes the Redis cache and warms the HF Space.
 *    - Does NOT store the result in the local streamCache (tokens may expire before user clicks).
 *    - Run at most once per TMDB ID per session.
 *
 * 2. HOT mode (hover/InfoModal/90%-of-current-video triggers):
 *    - Fetches AND caches in streamCache for 4 minutes (240s).
 *    - Only runs for providers with long-lived CDN tokens (AutoEmbed, VidZee, 2Embed, VidLink).
 *    - VixSrc tokens (~15min) and VidSrc (~10min) are borderline safe within 4min window.
 *    - On actual Play: cache hit returns instantly; if expired, falls back to fresh fetch.
 *
 * Short-lived token providers (VixSrc) won't poison the cache because the 4min TTL means
 * the url will have expired before the VideoPlayer's 403 retry logic kicks in.
 */

// Track which TMDB IDs we've already warmed this session (avoid redundant calls)
const warmedSet = new Set<string>();

export const prefetchStream = async (
  title: string,
  year: number | undefined,
  tmdbId: string,
  type: 'movie' | 'tv',
  season: number = 1,
  episode: number = 1,
  imdbId?: string,
  mode: 'warm' | 'hot' = 'warm'
): Promise<void> => {
  if (!tmdbId) return;

  const key = `${tmdbId}-${type}-${season}-${episode}`;

  // WARM mode: only hit backend once per session per item
  if (mode === 'warm') {
    if (warmedSet.has(key)) return;
    warmedSet.add(key);
    // Fire-and-forget: just warm the Space + Redis cache, don't await result
    const params = new URLSearchParams({ tmdbId, type, season: season.toString(), episode: episode.toString(), title: title || '', year: year ? year.toString() : '', imdbId: imdbId || '' });
    fetch(`${GIGA_BACKEND_URL}/api/stream?${params.toString()}`, { signal: AbortSignal.timeout(25000) })
      .catch(() => { /* ignore — prefetch failures are silent */ });
    console.log(`[Prefetch] 🔥 Warming HF cache for: ${title} (${type})`);
    return;
  }

  // HOT mode: fetch + cache result for VideoPlayer instant load
  const { streamCache } = await import('../utils/streamCache');
  const cacheKey = { title: title || String(tmdbId), tmdbId, type, season, episode };
  if (streamCache.get(cacheKey)) {
    console.log(`[Prefetch] ✅ Already hot-cached: ${title}`);
    return;
  }

  try {
    const params = new URLSearchParams({ tmdbId, type, season: season.toString(), episode: episode.toString(), title: title || '', year: year ? year.toString() : '', imdbId: imdbId || '' });
    const resp = await fetch(`${GIGA_BACKEND_URL}/api/stream?${params.toString()}`, { signal: AbortSignal.timeout(20000) });
    if (!resp.ok) return;
    const data = await resp.json();
    if (data?.sources?.length && !data.sources.every((s: any) => s.isEmbed)) {
      // Only cache if provider is known to have long-lived tokens (not just 15s VixSrc kind)
      const provider = (data.provider || '').toLowerCase();
      const isShortLived = provider.includes('vixsrc');
      if (!isShortLived) {
        streamCache.set(cacheKey, data); // uses internal CACHE_TTL_MS
        console.log(`[Prefetch] 🚀 HOT cached: ${title} via ${data.provider}`);
      } else {
        console.log(`[Prefetch] ⚠️ Skipping cache for short-lived provider: ${data.provider}`);
      }
    }
  } catch {
    // silent — prefetch failures never affect UX
  }
};

/**
 * Batch warm-prefetch for history/watchlist items.
 * Staggers requests by 1.5s to avoid hammering HF.
 * Call this from App.tsx after user data loads.
 *
 * @param items - Array of {tmdbId, type, title, year, season, episode}
 * @param maxItems - Max items to prefetch (default: 6 — last 3 watched + last 3 in list)
 */
export const schedulePrefetchQueue = (items: Array<{
  tmdbId: string;
  type: 'movie' | 'tv';
  title: string;
  year?: number;
  season?: number;
  episode?: number;
  imdbId?: string;
}>, maxItems = 6): void => {
  const queue = items.slice(0, maxItems);
  queue.forEach((item, i) => {
    setTimeout(() => {
      prefetchStream(
        item.title,
        item.year,
        item.tmdbId,
        item.type,
        item.season || 1,
        item.episode || 1,
        item.imdbId,
        'warm'
      );
    }, i * 1500); // stagger: 0ms, 1.5s, 3s, 4.5s, 6s, 7.5s
  });
  console.log(`[Prefetch] 📋 Queued ${queue.length} warm prefetches`);
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