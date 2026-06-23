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

// ─── Content Blacklist (NSFW & Sensitive Content) ───────────────────────────
export const BLACKLIST = {
  hard: {
    ids: new Set<number>([
      397194,  // Le Clitoris
      34267,   // Africa Blood and Guts
      1076935, // Money Shot: The Pornhub Story
      315486,  // Hot Girls Wanted
      234190,  // X-Rated: The Greatest Adult Movies of All Time
      20,      // Bowling for Columbine
      302696   // Shadow banned by user
    ]),
    keywords: [
      'pornhub',
      'pornstar',
      'clitoris',
      'orgasm',
      'deep throat',
      'after porn ends',
      'blood and guts',
      'blood & guts',
      'hot girls wanted',
      'x-rated',
      'adult movie',
      'africa addio',
      'columbine',
      'sex, lures & videotape',
      'inside deep throat',
      'the pornantulas',
      'after porn',
      'voyeur',
      'kamasutra',
      'kama sutra',
      'erotica',
      'nudist',
      'nudism',
      'playboy',
      'penthouse',
      'sadomasochism',
      'bdsm',
      'softcore',
      'hardcore porn',
      'porno',
      'pornography'
    ]
  },
  soft: {
    ids: new Set<number>([
      95897,   // Overflow
      78501,   // Sweet Punishment: I'm the Guard's Personal Pet
      241002,  // Adam's Sweet Agony
      1057265, // Peddi
      259872   // Shadow banned by user
    ]),
    keywords: [
      'overflow',
      'sweet punishment',
      "adam's sweet agony",
      "adams sweet agony",
      'peddi'
    ]
  }
};

export function isBlacklisted(item: any, type: 'hard' | 'soft' | 'any' = 'any'): boolean {
  if (!item) return false;
  
  // Hard blacklist adult flag check
  if (item.adult === true && (type === 'hard' || type === 'any')) {
    return true;
  }

  const id = Number(item.id);
  const title = (item.title || item.name || '').toLowerCase();
  const origTitle = (item.original_title || item.original_name || '').toLowerCase();

  const matchesKeywords = (keywords: string[]) =>
    keywords.some(kw => title.includes(kw) || origTitle.includes(kw));

  if (type === 'hard' || type === 'any') {
    if (BLACKLIST.hard.ids.has(id)) return true;
    if (matchesKeywords(BLACKLIST.hard.keywords)) return true;
  }
  if (type === 'soft' || type === 'any') {
    if (BLACKLIST.soft.ids.has(id)) return true;
    if (matchesKeywords(BLACKLIST.soft.keywords)) return true;
  }
  return false;
}




// ─── Axios instance ───────────────────────────────────────────────────────────

let _lang = 'en-US';

export function setTmdbLanguage(lang: string) {
  _lang = lang;
}

const tmdb: AxiosInstance = axios.create({ baseURL: TMDB_BASE_URL });

tmdb.interceptors.request.use((config) => {
  // Only inject api_key/language if they aren't already hardcoded in the URL string
  const url = config.url || '';
  const hasApiKey = url.includes('api_key=');
  const hasLang   = url.includes('language=');

  config.params = {
    ...(!hasApiKey && { api_key: getKey() }),
    ...(!hasLang   && { language: _lang }),
    include_adult: false,
    ...config.params,  // caller params WIN — they can override language per-call
  };

  // Merge duplicates in the URL since TMDB 400s if multiple identical keys exist
  if (config.url && config.url.includes('?')) {
    try {
      const [base, qs] = config.url.split('?');
      const params = new URLSearchParams(qs);
      
      const genres = params.getAll('with_genres');
      if (genres.length > 1) {
        params.delete('with_genres');
        params.set('with_genres', genres.join(','));
      }
      const keywords = params.getAll('with_keywords');
      if (keywords.length > 1) {
        params.delete('with_keywords');
        params.set('with_keywords', keywords.join(','));
      }
      const countries = params.getAll('with_origin_country');
      if (countries.length > 1) {
        params.delete('with_origin_country');
        params.set('with_origin_country', countries.join(','));
      }
      
      config.url = `${base}?${params.toString()}`;
    } catch (e) {
      console.warn('[TMDB] URLSearchParams parse error', e);
    }
  }

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
const _dataCache  = new Map<string, any>();

export const getCachedMovieImages = (id: number | string, type: 'movie' | 'tv') => {
  const url = `/${type}/${id}/images`;
  return _dataCache.get(url) || null;
};

export const isUrlCached = (url: string): boolean => {
  return _dataCache.has(url);
};

// ─── Fetch functions ──────────────────────────────────────────────────────────

export const getMovieImages = async (id: number | string, type: 'movie' | 'tv') => {
  const url = `/${type}/${id}/images`;
  if (_dataCache.has(url)) return _dataCache.get(url);
  try {
    const { data } = await tmdb.get(url, {
      params: { include_image_language: 'en,null' }
    });
    _dataCache.set(url, data);
    return data;
  } catch (e) {
    console.error(`[TMDB] Images ${type}/${id}:`, e);
    return null;
  }
};

export const getMovieDetails = async (id: number | string, type: 'movie' | 'tv') => {
  try {
    const appendKey = type === 'movie' ? 'release_dates' : 'content_ratings';
    const { data } = await tmdb.get(`/${type}/${id}`, { params: { append_to_response: appendKey } });
    if (isBlacklisted(data, 'hard')) {
      console.warn(`[TMDB] Details request blocked for blacklisted content: ${id}`);
      return null;
    }

    // Extract certification — prefer GB (BBFC), fall back to US
    let certification: string | undefined;
    if (type === 'movie' && data.release_dates?.results) {
      const regions: any[] = data.release_dates.results;
      const pick = (iso: string) => regions.find((r) => r.iso_3166_1 === iso);
      const region = pick('GB') || pick('US');
      if (region?.release_dates?.length) {
        const dates: any[] = region.release_dates;
        // Prefer theatrical (type 3), then any entry with a cert
        const cert = (dates.find((d) => d.type === 3 && d.certification) || dates.find((d) => d.certification))?.certification;
        if (cert) certification = cert;
      }
    } else if (type === 'tv' && data.content_ratings?.results) {
      const regions: any[] = data.content_ratings.results;
      const pick = (iso: string) => regions.find((r) => r.iso_3166_1 === iso);
      certification = pick('GB')?.rating || pick('US')?.rating;
    }

    if (certification) data.certification = certification;
    return data;
  } catch (e) {
    console.error(`[TMDB] Details ${type}/${id}:`, e);
    return null;
  }
};

export const getMovieVideos = async (id: number | string, type: 'movie' | 'tv') => {
  const url = `/${type}/${id}/videos`;
  if (_dataCache.has(url)) return _dataCache.get(url);
  try {
    const { data } = await tmdb.get(url);
    _dataCache.set(url, data);
    return data;
  } catch (e) {
    console.error(`[TMDB] Videos ${type}/${id}:`, e);
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
  const url = `/${type}/${id}/external_ids`;
  if (_dataCache.has(url)) return _dataCache.get(url);
  try {
    const { data } = await tmdb.get(url);
    _dataCache.set(url, data);
    return data;
  } catch (e) {
    console.error(`[TMDB] ExternalIds ${type}/${id}:`, e);
    return null;
  }
};

export const getRecommendations = async (id: number | string, type: 'movie' | 'tv') => {
  try {
    const { data } = await tmdb.get(`/${type}/${id}/recommendations`);
    const results = data.results || [];
    return results.filter((item: any) => !isBlacklisted(item, 'any'));
  } catch (e) {
    console.error(`[TMDB] Recommendations ${type}/${id}:`, e);
    return [];
  }
};

export const getMovieKeywords = async (id: number | string, type: 'movie' | 'tv') => {
  try {
    const url = `/${type}/${id}/keywords`;
    const { data } = await tmdb.get(url);
    // TV results are in .results, Movie results are in .keywords
    return type === 'movie' ? (data.keywords || []) : (data.results || []);
  } catch (e) {
    console.error(`[TMDB] Keywords ${type}/${id}:`, e);
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
    // Triple-Threat Search: Query Multi, Movie, and TV endpoints simultaneously
    const [multiRes, movieRes, tvRes] = await Promise.all([
      tmdb.get('/search/multi', { params: { query, include_adult: false } }).catch(() => ({ data: { results: [] } })),
      tmdb.get('/search/movie', { params: { query, include_adult: false } }).catch(() => ({ data: { results: [] } })),
      tmdb.get('/search/tv', { params: { query, include_adult: false } }).catch(() => ({ data: { results: [] } })),
    ]);

    // Merge and deduplicate
    const allResults = [
      ...(multiRes.data.results || []),
      ...(movieRes.data.results || []),
      ...(tvRes.data.results || [])
    ];

    const uniqueMap = new Map<string, any>();
    allResults.forEach(item => {
      if (!item || isBlacklisted(item, 'hard')) return;
      const mediaType = item.media_type || (item.title ? 'movie' : 'tv');
      // Normalize media_type back onto the item if missing
      if (!item.media_type) {
        item.media_type = mediaType;
      }
      const key = `${mediaType}-${item.id}`;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, item);
      }
    });

    // Group by title (case-insensitive) to filter out duplicate names
    const titleGroups = new Map<string, any[]>();
    uniqueMap.forEach(item => {
      const title = (item.name || item.title || '').trim().toLowerCase();
      if (!titleGroups.has(title)) {
        titleGroups.set(title, []);
      }
      titleGroups.get(title)!.push(item);
    });

    const finalResults: any[] = [];
    titleGroups.forEach(group => {
      if (group.length === 1) {
        finalResults.push(group[0]);
      } else {
        // Find item with highest popularity
        let bestItem = group[0];
        group.forEach(item => {
          if ((item.popularity || 0) > (bestItem.popularity || 0)) {
            bestItem = item;
          }
        });
        
        group.forEach(item => {
          if (item === bestItem) {
            finalResults.push(item);
          } else if (item.vote_count !== undefined && item.vote_count >= 100) {
            finalResults.push(item);
          }
        });
      }
    });

    return finalResults;
  } catch (e) {
    console.error('[TMDB] Search error:', e);
    return [];
  }
};

export const fetchData = async (url: string) => {
  if (_dataCache.has(url)) return _dataCache.get(url);
  if (_pending.has(url)) return _pending.get(url);

  const promise = (async () => {
    try {
      const { data } = await tmdb.get(url);
      const results = data.results || [];
      const filteredResults = results.filter((item: any) => !isBlacklisted(item, 'any'));
      _dataCache.set(url, filteredResults);
      return filteredResults;
    } catch (e) {
      console.error('[TMDB] fetchData error:', e);
      return [];
    } finally {
      _pending.delete(url);
    }
  })();

  _pending.set(url, promise);
  return promise;
};

export default tmdb;
