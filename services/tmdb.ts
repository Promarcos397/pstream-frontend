/**
 * services/tmdb.ts
 * ─────────────────
 * Single source of truth for all TMDB API communication.
 *
 * Key improvements over the original api.ts:
 *  - API key is read from env (VITE_TMDB_API_KEY), never hardcoded.
 *  - Key rotation: set VITE_TMDB_API_KEYS=key1,key2,... for multi-key fallback.
 *  - Language injected via interceptor (same as before).
 *  - All TMDB fetch functions live here — nothing else.
 */

import axios, { AxiosInstance } from 'axios';

// ─── Config ───────────────────────────────────────────────────────────────────

export const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

// Key rotation support: VITE_TMDB_API_KEYS takes priority (comma-separated).
// Falls back to single VITE_TMDB_API_KEY, then empty string.
const _keysRaw = (import.meta as any).env?.VITE_TMDB_API_KEYS || '';
const _keys: string[] = _keysRaw
  ? _keysRaw.split(',').map((k: string) => k.trim()).filter(Boolean)
  : [(import.meta as any).env?.VITE_TMDB_API_KEY || ''];

let _keyIdx = 0;
const _failedKeys = new Set<number>();
let _allExhaustedUntil = 0;

function getKey(): string {
  return _keys[_keyIdx] || '';
}

function rotateKey(): boolean {
  _failedKeys.add(_keyIdx);
  for (let i = 0; i < _keys.length; i++) {
    const next = (_keyIdx + 1 + i) % _keys.length;
    if (!_failedKeys.has(next)) {
      _keyIdx = next;
      console.warn(`[TMDB] Rotated to key index ${_keyIdx}`);
      return true;
    }
  }
  _allExhaustedUntil = Date.now() + 15 * 60 * 1000; // 15 min cooldown
  console.error('[TMDB] All API keys exhausted!');
  return false;
}

// ─── Axios instance ───────────────────────────────────────────────────────────

let _lang = 'en-US';

export function setTmdbLanguage(lang: string) {
  _lang = lang;
}

const tmdb: AxiosInstance = axios.create({ baseURL: TMDB_BASE_URL });

tmdb.interceptors.request.use((config) => {
  // Only inject api_key/language if not already present
  // (prevents duplicate params when callers already include them in the URL)
  config.params = {
    api_key:  getKey(),
    language: _lang,
    ...config.params,  // caller params WIN — they can override language per-call
  };
  return config;
});

tmdb.interceptors.response.use(
  (res) => res,
  async (err) => {
    const status = err.response?.status;
    // Key exhausted — rotate to next key and retry once
    if ((status === 401 || status === 403 || status === 429) && _keys.length > 1) {
      if (rotateKey()) return tmdb.request(err.config);
    }
    // 502/503 from TMDB — transient gateway error, retry once after 500ms
    if ((status === 502 || status === 503) && !err.config._retried502) {
      err.config._retried502 = true;
      await new Promise(r => setTimeout(r, 500));
      return tmdb.request(err.config);
    }
    return Promise.reject(err);
  }
);

// ─── In-flight dedup + image cache ───────────────────────────────────────────

const _imageCache = new Map<string, any>();
const _pending    = new Map<string, Promise<any>>();

// ─── Fetch functions ──────────────────────────────────────────────────────────

export const getMovieImages = async (id: number | string, type: 'movie' | 'tv') => {
  const key = `${type}_${id}`;
  if (_imageCache.has(key)) return _imageCache.get(key);
  if (_pending.has(key))    return _pending.get(key);

  const req = (async () => {
    for (let retries = 2; retries >= 0; retries--) {
      try {
        const { data } = await tmdb.get(`/${type}/${id}/images`, {
          params: { include_image_language: 'en,null' },
        });
        _imageCache.set(key, data);
        return data;
      } catch (e) {
        if (retries === 0) { console.error(`[TMDB] Images ${type}/${id}:`, e); return null; }
        await new Promise(r => setTimeout(r, 500));
      }
    }
    return null;
  })();

  _pending.set(key, req);
  const result = await req;
  _pending.delete(key);
  return result;
};

export const getMovieDetails = async (id: number | string, type: 'movie' | 'tv') => {
  try {
    const { data } = await tmdb.get(`/${type}/${id}`);
    return data;
  } catch (e) {
    console.error(`[TMDB] Details ${type}/${id}:`, e);
    return null;
  }
};

export const getMovieCredits = async (id: number | string, type: 'movie' | 'tv') => {
  try {
    const { data } = await tmdb.get(`/${type}/${id}/credits`);
    return data.cast || [];
  } catch (e) {
    console.error(`[TMDB] Credits ${type}/${id}:`, e);
    return [];
  }
};

export const getSeasonDetails = async (id: number | string, seasonNumber: number) => {
  try {
    const { data } = await tmdb.get(`/tv/${id}/season/${seasonNumber}`);
    return data;
  } catch (e) {
    console.error(`[TMDB] Season ${seasonNumber} tv/${id}:`, e);
    return null;
  }
};

export const getExternalIds = async (id: number | string, type: 'movie' | 'tv') => {
  try {
    const { data } = await tmdb.get(`/${type}/${id}/external_ids`);
    return data;
  } catch (e) {
    console.error(`[TMDB] ExternalIds ${type}/${id}:`, e);
    return null;
  }
};

export const getRecommendations = async (id: number | string, type: 'movie' | 'tv') => {
  try {
    const { data } = await tmdb.get(`/${type}/${id}/recommendations`);
    return data.results || [];
  } catch (e) {
    console.error(`[TMDB] Recommendations ${type}/${id}:`, e);
    return [];
  }
};

export const getReleaseDates = async (id: number | string, type: 'movie' | 'tv') => {
  try {
    const { data } = await tmdb.get(`/${type}/${id}/release_dates`);
    return data.results || [];
  } catch (e) {
    console.error(`[TMDB] ReleaseDates ${type}/${id}:`, e);
    return [];
  }
};

export const searchMovies = async (query: string) => {
  try {
    const { data } = await tmdb.get('/search/multi', {
      params: { query, include_adult: false },
    });
    return data.results || [];
  } catch (e) {
    console.error('[TMDB] Search error:', e);
    return [];
  }
};

export const fetchData = async (url: string) => {
  try {
    const { data } = await tmdb.get(url);
    return data.results || [];
  } catch (e) {
    console.error('[TMDB] fetchData error:', e);
    return [];
  }
};

export default tmdb;
