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
import type { Movie } from '../types';

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

// ─── Kids Mode Content Filter ────────────────────────────────────────────────
// TMDB genre ids that skew mature. Any of these on an item disqualifies it
// from a Kids profile regardless of what else is tagged.
const KIDS_UNSAFE_GENRE_IDS = new Set<number>([
  27,    // Horror
  53,    // Thriller
  80,    // Crime
  10752, // War (movie)
  10768, // War & Politics (tv)
  9648,  // Mystery
  10749, // Romance
  10763, // News (tv)
  10766, // Soap (tv)
  10767, // Talk (tv)
  37,    // Western
]);

// At least one of these must be present — a positive "this is generally
// family-appropriate" signal — since list endpoints don't expose certification.
const KIDS_FRIENDLY_GENRE_IDS = new Set<number>([
  10751, // Kids & Family (movie)
  10762, // Kids (tv)
  16,    // Animation
  12,    // Adventure (movie)
  10759, // Action & Adventure (tv)
  35,    // Comedy
  14,    // Fantasy
  10765, // Sci-Fi & Fantasy (tv)
  10402, // Music & Musicals
  99,    // Documentary
]);

/** Pure genre-safety check — does not consult global kids-mode state. */
export function isKidsSafe(item: any): boolean {
  if (!item || item.adult === true) return false;
  const genreIds: number[] = item.genre_ids || item.genres?.map((g: any) => g.id) || [];
  if (genreIds.length === 0) return false; // fail closed — can't verify safety
  if (genreIds.some((id) => KIDS_UNSAFE_GENRE_IDS.has(id))) return false;
  return genreIds.some((id) => KIDS_FRIENDLY_GENRE_IDS.has(id));
}

let _kidsModeActive = false;
/** Called reactively whenever the active profile's isKids flag changes. */
export function setGlobalKidsMode(active: boolean) {
  _kidsModeActive = active;
}
export function isGlobalKidsModeActive(): boolean {
  return _kidsModeActive;
}

/** Applies the live kids filter only when kids mode is currently active. */
function applyKidsFilter<T>(items: T[]): T[] {
  return _kidsModeActive ? items.filter((item) => isKidsSafe(item)) : items;
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

// Limit concurrent TMDB fetches so we never burst past rate limits and the
// first visible rows always get their slots before off-screen rows do.
class _Semaphore {
  private q: Array<() => void> = [];
  private active = 0;
  constructor(private limit: number) {}
  acquire(): Promise<void> {
    return new Promise(resolve => {
      if (this.active < this.limit) { this.active++; resolve(); }
      else this.q.push(resolve);
    });
  }
  release() {
    this.active--;
    const next = this.q.shift();
    if (next) { this.active++; next(); }
  }
}
const _sem = new _Semaphore(6);

export const getCachedMovieImages = (id: number | string, type: 'movie' | 'tv') => {
  const url = `/${type}/${id}/images`;
  return _dataCache.get(url) || null;
};

export const isUrlCached = (url: string): boolean => {
  return _dataCache.has(url);
};

export const getCachedData = (url: string): any => {
  return _dataCache.get(url) ?? null;
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
  const appendKey = type === 'movie' ? 'release_dates' : 'content_ratings';
  const url = `/${type}/${id}?append=${appendKey}`;
  if (_dataCache.has(url)) return _dataCache.get(url);
  if (_pending.has(url)) return _pending.get(url);

  const promise = (async () => {
    try {
      const { data } = await tmdb.get(`/${type}/${id}`, { params: { append_to_response: appendKey } });
      if (isBlacklisted(data, 'hard')) {
        console.warn(`[TMDB] Details request blocked for blacklisted content: ${id}`);
        return null;
      }

      let certification: string | undefined;
      if (type === 'movie' && data.release_dates?.results) {
        const regions: any[] = data.release_dates.results;
        const pick = (iso: string) => regions.find((r) => r.iso_3166_1 === iso);
        const region = pick('GB') || pick('US');
        if (region?.release_dates?.length) {
          const dates: any[] = region.release_dates;
          const certEntry = dates.find((d: any) => d.type === 3 && d.certification) || dates.find((d: any) => d.certification);
          const cert = certEntry?.certification;
          if (cert) certification = cert;
          const descriptors: string[] = (certEntry?.descriptors?.length ? certEntry.descriptors : null)
            ?? dates.find((d: any) => (d.descriptors as any[])?.length)?.descriptors
            ?? [];
          if (descriptors.length) {
            data.content_descriptors = descriptors;
            console.log(`[TMDB] Descriptors for ${type}/${id}:`, descriptors);
          }
        }
      } else if (type === 'tv' && data.content_ratings?.results) {
        const regions: any[] = data.content_ratings.results;
        const pick = (iso: string) => regions.find((r) => r.iso_3166_1 === iso);
        certification = pick('GB')?.rating || pick('US')?.rating;
      }

      if (certification) data.certification = certification;
      _dataCache.set(url, data);
      return data;
    } catch (e) {
      console.error(`[TMDB] Details ${type}/${id}:`, e);
      return null;
    } finally {
      _pending.delete(url);
    }
  })();

  _pending.set(url, promise);
  return promise;
};

export const getMovieVideos = async (id: number | string, type: 'movie' | 'tv') => {
  const url = `/${type}/${id}/videos`;
  if (_dataCache.has(url)) return _dataCache.get(url);
  if (_pending.has(url)) return _pending.get(url);
  const promise = (async () => {
    try {
      const { data } = await tmdb.get(url);
      _dataCache.set(url, data);
      return data;
    } catch (e) {
      console.error(`[TMDB] Videos ${type}/${id}:`, e);
      return null;
    } finally {
      _pending.delete(url);
    }
  })();
  _pending.set(url, promise);
  return promise;
};


export const getMovieCredits = async (id: number | string, type: 'movie' | 'tv') => {
  const url = `/${type}/${id}/credits`;
  if (_dataCache.has(url)) return _dataCache.get(url);
  if (_pending.has(url)) return _pending.get(url);

  const promise = (async () => {
    try {
      const { data } = await tmdb.get(url);
      const cast = data.cast || [];
      _dataCache.set(url, cast);
      return cast;
    } catch (e) {
      console.error(`[TMDB] Credits ${type}/${id}:`, e);
      return [];
    } finally {
      _pending.delete(url);
    }
  })();

  _pending.set(url, promise);
  return promise;
};

export const getSeasonDetails = async (id: number | string, seasonNumber: number) => {
  const url = `/tv/${id}/season/${seasonNumber}`;
  if (_dataCache.has(url)) return _dataCache.get(url);
  try {
    const { data } = await tmdb.get(url);
    _dataCache.set(url, data);
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

const _getRecommendationsRaw = async (id: number | string, type: 'movie' | 'tv') => {
  const url = `/${type}/${id}/recommendations`;
  if (_dataCache.has(url)) return _dataCache.get(url);
  if (_pending.has(url)) return _pending.get(url);

  const promise = (async () => {
    try {
      const { data } = await tmdb.get(url);
      const results = (data.results || []).filter((item: any) => !isBlacklisted(item, 'any'));
      _dataCache.set(url, results);
      return results;
    } catch (e) {
      console.error(`[TMDB] Recommendations ${type}/${id}:`, e);
      return [];
    } finally {
      _pending.delete(url);
    }
  })();

  _pending.set(url, promise);
  return promise;
};

export const getRecommendations = async (id: number | string, type: 'movie' | 'tv'): Promise<Movie[]> => {
  const results = await _getRecommendationsRaw(id, type);
  return applyKidsFilter<Movie>(results);
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

    return applyKidsFilter(finalResults);
  } catch (e) {
    console.error('[TMDB] Search error:', e);
    return [];
  }
};

// Cache/dedup layer only ever stores the blacklist-filtered (not kids-filtered)
// results, so switching profiles never serves a stale, wrongly-scoped array —
// the kids filter is re-applied fresh on every read in `fetchData` below.
const _fetchDataRaw = async (url: string) => {
  if (_dataCache.has(url)) return _dataCache.get(url);
  if (_pending.has(url)) return _pending.get(url);

  const promise = (async () => {
    await _sem.acquire();
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
      _sem.release();
      _pending.delete(url);
    }
  })();

  _pending.set(url, promise);
  return promise;
};

export const fetchData = async (url: string): Promise<Movie[]> => {
  const results = await _fetchDataRaw(url);
  // Explicit <Movie> pins the element type — _fetchDataRaw is `any`, and an
  // implicit generic call would otherwise infer `unknown[]` at every callsite.
  return applyKidsFilter<Movie>(results);
};

export default tmdb;
