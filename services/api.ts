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

  if (imageCache.has(cacheKey)) return imageCache.get(cacheKey);
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
        await new Promise(r => setTimeout(r, 500));
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
    return response.data;
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

export const fetchData = async (url: string) => {
  try {
    const response = await api.get<TMDBResponse>(url);
    return response.data.results;
  } catch (error) {
    console.error("Fetch error", error);
    return [];
  }
};

/**
 * Fetch YouTube trailer IDs for a given movie or TV show.
 *
 * Uses original_title (always English from TMDB) to avoid localized-title mismatches.
 * Delegates entirely to YouTubeService's scoring logic — results come back sorted by
 * relevance + quality score, so index [0] is always the best available candidate.
 * No TMDB video fallback — TMDB trailer data is unreliable for this use case.
 */
export const fetchTrailers = async (id: number | string, type: 'movie' | 'tv'): Promise<string[]> => {
  try {
    const details = await getMovieDetails(id, type);
    if (!details) return [];

    // Always use original_title (English) — localized titles produce poor YouTube results
    const title = details.original_title || details.original_name || details.title || details.name || '';
    const releaseDate = details.release_date || details.first_air_date;
    const year = releaseDate ? new Date(releaseDate).getFullYear().toString() : undefined;
    const company = details.production_companies?.[0]?.name;

    const { searchTrailersWithFallback } = await import('./YouTubeService');

    // Request more candidates so the scorer has a real pool to rank from.
    // The best-scored result will be index [0] — no position swapping needed.
    const trailers = await searchTrailersWithFallback({
      title,
      year,
      company,
      type
    }, 8);

    return trailers;

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
 */
export const getStream = async (
  title: string,
  type: 'movie' | 'tv',
  year?: number,
  season: number = 1,
  episode: number = 1,
  tmdbId?: string,
  imdbId?: string,
  bustCache = false
) => {
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
    // ?force=1 tells the backend to skip Redis and run a fresh provider race.
    // Used after a 403/410 when we know the cached URL is dead.
    if (bustCache) params.set('force', '1');

    const logLabel = bustCache ? '[GigaEngine] 🔥 Force-fresh stream (busting Redis)...' : '[GigaEngine] Requesting stream (Giga Backend)...';
    console.log(logLabel);
    const response = await axios.get(`${GIGA_BACKEND_URL}/api/stream?${params.toString()}`, {
        timeout: 30000
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
 *    - Calls backend /api/stream to prime Redis cache + keep HF Space warm.
 *    - Does NOT store in local streamCache (tokens may expire before user clicks).
 *    - Run at most once per TMDB ID per session.
 *
 * 2. HOT mode (hover/InfoModal/90%-of-current-video triggers):
 *    - Intentionally a no-op — all providers use IP-locked tokens (2-5min TTL).
 *    - Caching via background prefetch always serves stale tokens at play time.
 *    - 'warm' fires the request to keep HF Space alive + prime Redis so the
 *      user's actual play request returns in ~1-2s.
 */
const warmedSet = new Set<string>();
const PREFETCH_COOLDOWN_MS = 3 * 60 * 1000;
const PREFETCH_MIN_INTERVAL_MS = 700;
const PREFETCH_MAX_CONCURRENCY = 2;
const PREFETCH_QUEUE_LIMIT = 40;
const prefetchLastQueuedAt = new Map<string, number>();
const prefetchQueue: Array<{ key: string; run: () => Promise<void>; priority: number }> = [];
let prefetchActive = 0;
let prefetchLastStart = 0;
let prefetchPumpTimer: ReturnType<typeof setTimeout> | null = null;

function enqueuePrefetchTask(key: string, priority: number, run: () => Promise<void>) {
  if (prefetchQueue.some(task => task.key === key)) return;
  if (prefetchQueue.length >= PREFETCH_QUEUE_LIMIT) return;
  prefetchQueue.push({ key, priority, run });
  prefetchQueue.sort((a, b) => b.priority - a.priority);
  pumpPrefetchQueue();
}

function pumpPrefetchQueue() {
  if (prefetchActive >= PREFETCH_MAX_CONCURRENCY) return;
  if (prefetchQueue.length === 0) return;
  if (prefetchPumpTimer) return;

  const elapsed = Date.now() - prefetchLastStart;
  const wait = Math.max(0, PREFETCH_MIN_INTERVAL_MS - elapsed);

  prefetchPumpTimer = setTimeout(async () => {
    prefetchPumpTimer = null;
    if (prefetchActive >= PREFETCH_MAX_CONCURRENCY) return;
    const next = prefetchQueue.shift();
    if (!next) return;

    prefetchActive += 1;
    prefetchLastStart = Date.now();
    try {
      await next.run();
    } finally {
      prefetchActive = Math.max(0, prefetchActive - 1);
      pumpPrefetchQueue();
    }
  }, wait);
}

export const prefetchStream = async (
  title: string,
  year: number | undefined,
  tmdbId: string,
  type: 'movie' | 'tv',
  season: number = 1,
  episode: number = 1,
  imdbId?: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _mode: 'warm' | 'hot' = 'warm'
): Promise<void> => {
  if (!tmdbId) return;

  const key = `${tmdbId}-${type}-${season}-${episode}`;
  const now = Date.now();
  const lastQueuedAt = prefetchLastQueuedAt.get(key) || 0;
  if (now - lastQueuedAt < PREFETCH_COOLDOWN_MS) return;
  prefetchLastQueuedAt.set(key, now);
  if (warmedSet.has(key)) return;

  const params = new URLSearchParams({
    tmdbId, type,
    season: season.toString(),
    episode: episode.toString(),
    title: title || '',
    year: year ? year.toString() : '',
    imdbId: imdbId || ''
  });

  const priority = _mode === 'hot' ? 3 : 1;
  enqueuePrefetchTask(key, priority, async () => {
    warmedSet.add(key);
    await fetch(`${GIGA_BACKEND_URL}/api/stream?${params.toString()}`, { signal: AbortSignal.timeout(25000) })
      .catch(() => { /* silent — prefetch failures never affect UX */ });
    console.log(`[Prefetch] 🔥 Warming HF cache for: ${title} (${type})`);
  });
};

/**
 * Batch warm-prefetch for history/watchlist items.
 * Staggers requests by 1.5s to avoid hammering HF.
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
  queue.forEach((item) => {
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