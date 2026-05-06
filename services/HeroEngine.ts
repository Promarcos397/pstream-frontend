import axios from 'axios';
import { REQUESTS } from '../constants';
import { Movie, TMDBResponse } from '../types';
import { getMovieImages, getExternalIds, prefetchStream, getMovieDetails } from './api';

/**
 * HeroEngine v2 — "Curated Daily"
 *
 * Goals:
 *  1. Pick from a large, diverse pool of TMDB endpoints — not just "trending".
 *  2. Rotate deterministically by day so it always changes but never looks random.
 *  3. Bias toward genres the user has actually watched/liked when profile data is available.
 *  4. Apply the same philosophy to movie and tv hero pages (not just home).
 */

export interface HeroPackage {
  movie: Movie;
  logoUrl?: string;
  isReady: boolean;
  pageType: string;
}

// ─── User-data accessor ───────────────────────────────────────────────────────
// HeroEngine doesn't live inside React, so we pull user data via a simple
// callback that App / GlobalContext can register.  Falls back to no bias.
type UserDataAccessor = () => {
  continueWatching?: Movie[];
  myList?: Movie[];
  likedMovies?: Record<string, { genre_ids?: number[] }>;
};
let _getUserData: UserDataAccessor = () => ({});
export function registerHeroUserDataAccessor(fn: UserDataAccessor) {
  _getUserData = fn;
}

// ─── Endpoint pools ───────────────────────────────────────────────────────────
type HeroPoolItem = {
  url: () => string;
  label: string;
  preferGenres?: number[];
};

/**
 * Home pool — mixed movies + TV, curated for variety and cinematic feel.
 * Each entry: { url, label, preferGenres? }
 * preferGenres: if the user watches these genre IDs, this slot gets a weight boost.
 */
const HOME_POOL: HeroPoolItem[] = [
  { url: () => REQUESTS.fetchLoveTheseMovies,          label: 'Critically Loved Movies',     preferGenres: [18, 80] },
  { url: () => REQUESTS.fetchAwardWinningSeries,       label: 'Award-Winning Series',         preferGenres: [18, 10765] },
  { url: () => REQUESTS.fetchExcitingMovies,           label: 'Blockbuster Action',           preferGenres: [28, 878] },
  { url: () => REQUESTS.fetchBoredomBustersTV,         label: 'Gripping Series',              preferGenres: [80, 10765] },
  { url: () => REQUESTS.fetchCriticallyAcclaimedDrama, label: 'Acclaimed Drama',              preferGenres: [18] },
  { url: () => REQUESTS.fetchSciFiMovies,              label: 'Sci-Fi Spectacles',            preferGenres: [878] },
  { url: () => REQUESTS.fetchImaginativeSeries,        label: 'Imaginative Shows',            preferGenres: [10765, 10759] },
  { url: () => REQUESTS.fetchHorrorMovies,             label: 'Cult Horror',                  preferGenres: [27] },
  { url: () => REQUESTS.fetchTopRated,                 label: 'All-Time Greats',              preferGenres: [18, 80, 28] },
  { url: () => REQUESTS.fetchLoveTheseTV,              label: 'Must-Watch TV',                preferGenres: [18, 10765] },
  { url: () => REQUESTS.fetchComedyMovies,             label: 'Comedy Gold',                  preferGenres: [35] },
  { url: () => REQUESTS.fetchFamiliarFavorites,        label: 'Fan Favourites',               preferGenres: [28, 12, 878] },
];

const MOVIE_POOL: HeroPoolItem[] = [
  { url: () => REQUESTS.fetchLoveTheseMovies,          label: 'Critically Loved' },
  { url: () => REQUESTS.fetchExcitingMovies,           label: 'High-Octane' },
  { url: () => REQUESTS.fetchSciFiMovies,              label: 'Sci-Fi' },
  { url: () => REQUESTS.fetchHorrorMovies,             label: 'Horror' },
  { url: () => REQUESTS.fetchActionMovies,             label: 'Action' },
  { url: () => REQUESTS.fetchComedyMovies,             label: 'Comedy' },
  { url: () => REQUESTS.fetchRomanceMovies,            label: 'Romance' },
  { url: () => REQUESTS.fetchDocumentaries,            label: 'Documentary' },
  { url: () => REQUESTS.fetchTopRated,                 label: 'All-Time Greats' },
  { url: () => REQUESTS.fetchBoredomBustersMovies,     label: 'Crowd-Pleasers' },
  { url: () => REQUESTS.fetchFamiliarFavoritesMovies,  label: 'Fan Favourites' },
  { url: () => REQUESTS.fetchUpcoming,                 label: 'Coming Soon' },
];

const TV_POOL: HeroPoolItem[] = [
  { url: () => REQUESTS.fetchAwardWinningSeries,       label: 'Award Winners' },
  { url: () => REQUESTS.fetchLoveTheseTV,              label: 'Must-Watch TV' },
  { url: () => REQUESTS.fetchBoredomBustersTV,         label: 'Binge-Worthy' },
  { url: () => REQUESTS.fetchImaginativeSeries,        label: 'Genre-Bending' },
  { url: () => REQUESTS.fetchCriticallyAcclaimedDrama, label: 'Critically Acclaimed' },
  { url: () => REQUESTS.fetchActionTV,                 label: 'Action TV' },
  { url: () => REQUESTS.fetchComedyTV,                 label: 'Comedy TV' },
  { url: () => REQUESTS.fetchDramaTV,                  label: 'Drama' },
  { url: () => REQUESTS.fetchCrimeTV,                  label: 'Crime & Thriller' },
  { url: () => REQUESTS.fetchUSSeries,                 label: 'US Originals' },
  { url: () => REQUESTS.fetchFamiliarFavoritesTV,      label: 'Fan Favourites' },
  { url: () => REQUESTS.fetchExcitingSeriesTV,         label: 'High-Stakes Series' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Fast, deterministic hash of a string → integer */
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(31, h) + s.charCodeAt(i) | 0;
  }
  return Math.abs(h);
}

/** Day-of-year (1-365) — changes once per day */
function dayOfYear(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  return Math.floor((now.getTime() - start.getTime()) / 86_400_000);
}

/**
 * Extract the top-3 genre IDs the user watches most, from their history/list/likes.
 * Returns [] if no user data available.
 */
function getUserTopGenres(): number[] {
  const { continueWatching = [], myList = [], likedMovies = {} } = _getUserData();

  const tally = new Map<number, number>();
  const add = (genreIds: number[] | undefined, weight: number) => {
    (genreIds || []).forEach(gid => tally.set(gid, (tally.get(gid) || 0) + weight));
  };

  // History carries more weight than wishlist; liked carries highest weight
  continueWatching.forEach(m => add(m.genre_ids, 2));
  myList.forEach(m => add(m.genre_ids, 1));
  Object.values(likedMovies).forEach(entry => add(entry.genre_ids, 3));

  return [...tally.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([gid]) => gid);
}

/**
 * Pick a pool slot for today, applying personalization weight if available.
 *
 * Algorithm:
 *  - Base slot: dayOfYear hashed into pool size (deterministic daily rotation)
 *  - Personalization: if the base slot's preferGenres don't match user's top genres,
 *    look ±2 slots for a better match. If found within range, shift to it.
 *  - This keeps the selection stable per day while favouring user taste.
 */
function pickPoolSlot(
  pool: HeroPoolItem[],
  pageType: string,
  userTopGenres: number[]
): HeroPoolItem {
  const n = pool.length;
  // Base index: stable for the day, unique per page
  const baseIdx = hashStr(dayOfYear() + '_' + pageType) % n;

  if (userTopGenres.length === 0) return pool[baseIdx];

  // Score slots in a ±3 window around the base
  const window = [-3, -2, -1, 0, 1, 2, 3];
  let bestSlot = pool[baseIdx];
  let bestScore = -1;

  for (const offset of window) {
    const idx = ((baseIdx + offset) % n + n) % n;
    const slot = pool[idx];
    const overlap = (slot.preferGenres || []).filter(g => userTopGenres.includes(g)).length;
    // Weight: more overlap = better. Earlier in window = slightly preferred (stability).
    const score = overlap * 10 - Math.abs(offset);
    if (score > bestScore) {
      bestScore = score;
      bestSlot = slot;
    }
  }

  return bestSlot;
}

// ─── Engine ───────────────────────────────────────────────────────────────────

class HeroEngineService {
  private lockedHeroes: Map<string, HeroPackage> = new Map();
  private isInitializing: Set<string> = new Set();
  private listeners: Set<(pageType: string, hero: HeroPackage) => void> = new Set();

  async getHero(pageType: string, fetchUrl?: string, genreId?: number): Promise<HeroPackage | null> {
    const cacheKey = genreId ? `${pageType}_${genreId}` : pageType;

    if (this.lockedHeroes.has(cacheKey)) return this.lockedHeroes.get(cacheKey)!;
    if (this.isInitializing.has(cacheKey)) return null;

    this.isInitializing.add(cacheKey);

    try {
      let url: string;
      let slotLabel = '';

      if (genreId) {
        // Genre-specific hero (called from genre browse pages) — use provided URL
        url = fetchUrl || REQUESTS.fetchByGenre(pageType as 'movie' | 'tv', genreId);
        slotLabel = `Genre ${genreId}`;
      } else if (fetchUrl) {
        url = fetchUrl;
        slotLabel = 'Custom';
      } else {
        // ── Core personalised selection ───────────────────────────────────
        const userTopGenres = getUserTopGenres();

        const pool =
          pageType === 'movie' ? MOVIE_POOL :
          pageType === 'tv'    ? TV_POOL    :
                                 HOME_POOL;

        const slot = pickPoolSlot(pool, pageType, userTopGenres);
        url = slot.url();
        slotLabel = slot.label;
      }

      console.log(`[HeroEngine] Curating "${slotLabel}" for ${cacheKey}...`);

      const response = await axios.get<TMDBResponse>(url);
      const results = (response.data.results || []).filter(m => m.backdrop_path);

      if (results.length === 0) throw new Error(`No results for "${slotLabel}"`);

      // Pick a result within the endpoint — use a per-result daily hash so
      // we don't always pick #0 from the same trending list.
      const resultIdx = hashStr(dayOfYear() + '_result_' + cacheKey) % results.length;
      const selectedMovie = results[resultIdx];
      const mediaType = (selectedMovie.media_type || (selectedMovie.title ? 'movie' : 'tv')) as 'movie' | 'tv';

      const [images, externals] = await Promise.all([
        getMovieImages(selectedMovie.id, mediaType),
        getExternalIds(selectedMovie.id, mediaType),
      ]);

      const logo = images?.logos?.find((l: any) => l.iso_639_1 === 'en' || l.iso_639_1 === null);
      const logoUrl = logo ? `https://image.tmdb.org/t/p/w500${logo.file_path}` : undefined;
      const movieWithExtras = { ...selectedMovie, imdb_id: externals?.imdb_id };

      const heroPackage: HeroPackage = {
        movie: movieWithExtras,
        logoUrl,
        isReady: true,
        pageType,
      };

      this.lockedHeroes.set(cacheKey, heroPackage);
      this.isInitializing.delete(cacheKey);
      this.listeners.forEach(cb => cb(pageType, heroPackage));

      // Warm-prefetch the stream so clicking Play is instant
      const title = movieWithExtras.title || movieWithExtras.name || '';
      const releaseDate = movieWithExtras.release_date || movieWithExtras.first_air_date;
      prefetchStream(
        title,
        releaseDate ? new Date(releaseDate).getFullYear() : undefined,
        String(movieWithExtras.id),
        mediaType,
        1, 1,
        movieWithExtras.imdb_id
      );

      return heroPackage;
    } catch (e) {
      console.error(`[HeroEngine] Failed for ${cacheKey}:`, e);
      this.isInitializing.delete(cacheKey);
      return null;
    }
  }

  /** Pre-fetch heroes for all core pages so tab switches are instant */
  async prepareAllHeroes() {
    console.log('[HeroEngine] Warming up engines...');
    ['home', 'movie', 'tv'].forEach(p => this.getHero(p));
  }

  subscribe(callback: (pageType: string, hero: HeroPackage) => void) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  getCachedHero(pageType: string): HeroPackage | undefined {
    return this.lockedHeroes.get(pageType);
  }

  /** Call this after user data loads so personalization applies immediately */
  invalidateAndRefresh(pageTypes: string[] = ['home', 'movie', 'tv']) {
    pageTypes.forEach(p => {
      this.lockedHeroes.delete(p);
      this.isInitializing.delete(p);
      this.getHero(p);
    });
  }
}

export const HeroEngine = new HeroEngineService();