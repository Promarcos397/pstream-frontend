import axios from 'axios';
import { REQUESTS } from '../constants';
import { Movie, TMDBResponse } from '../types';
import { getMovieImages, getExternalIds, prefetchStream, getMovieDetails } from './api';

/**
 * HeroEngine v3 — "Session-Stable, Time-Aware"
 *
 * Fixes over v2:
 *  1. STABILITY   — Hero is locked in sessionStorage for the whole browser session
 *                   (max TTL 4h). Refresh no longer changes the hero.
 *  2. TIME-OF-DAY — Five time-slot pools (morning/afternoon/evening/late_night/night_owl)
 *                   so the hero theme matches the ambient mood of when you're watching.
 *  3. CONNECTED   — getTimeSlot(), getSeason(), getCurrentHoliday() are shared with
 *                   useDynamicManifest so the hero and the row manifest always agree
 *                   on context. HeroEngine re-evaluates the time slot once per hour
 *                   bucket (not on every refresh) so there's no jarring mid-session flip.
 *  4. LOGO GUARANTEE — unchanged: tries up to 5 candidates before falling back.
 */

export interface HeroPackage {
  movie: Movie;
  logoUrl?: string;
  isReady: boolean;
  pageType: string;
  timeSlot: TimeSlot;
}

// ─── Shared context types (mirrored from useDynamicManifest) ─────────────────
export type TimeSlot  = 'morning' | 'afternoon' | 'evening' | 'late_night' | 'night_owl';
export type Season    = 'spring'  | 'summer'    | 'autumn'  | 'winter';
export type Holiday   = 'halloween' | 'christmas' | 'valentines' | 'new_year' | 'easter' | 'summer_break' | null;

export function getTimeSlot(): TimeSlot {
  const h = new Date().getHours();
  if (h >= 6  && h < 12) return 'morning';
  if (h >= 12 && h < 17) return 'afternoon';
  if (h >= 17 && h < 22) return 'evening';
  if (h >= 22 || h < 4)  return 'late_night';
  return 'night_owl'; // 4–6 AM
}

export function getSeason(): Season {
  const m = new Date().getMonth();
  if (m >= 2 && m <= 4)  return 'spring';
  if (m >= 5 && m <= 7)  return 'summer';
  if (m >= 8 && m <= 10) return 'autumn';
  return 'winter';
}

export function getCurrentHoliday(): Holiday {
  const now   = new Date();
  const month = now.getMonth() + 1;
  const day   = now.getDate();
  if ((month === 10 && day >= 25) || (month === 11 && day === 1)) return 'halloween';
  if (month === 12 && day >= 20)                                   return 'christmas';
  if (month === 1  && day === 1)                                   return 'christmas';
  if (month === 1  && day >= 2 && day <= 8)                        return 'new_year';
  if (month === 2  && day >= 10 && day <= 16)                      return 'valentines';
  if (month === 3  && day >= 28)                                   return 'easter';
  if (month === 4  && day <= 5)                                    return 'easter';
  if ((month === 7 && day >= 20) || month === 8 || (month === 9 && day <= 5)) return 'summer_break';
  return null;
}

// ─── Session-storage cache ────────────────────────────────────────────────────

const SESSION_KEY = 'pstream_hero_v3';
const SESSION_TTL = 4 * 60 * 60 * 1000; // 4 hours

interface CachedHeroEntry {
  ts: number;
  hourBucket: number;       // which 1-hour bucket this was fetched in
  movie: Movie;
  logoUrl?: string;
  pageType: string;
  timeSlot: TimeSlot;
}
interface SessionCache {
  [cacheKey: string]: CachedHeroEntry;
}

function loadSessionCache(): SessionCache {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveSessionCache(cache: SessionCache): void {
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(cache)); } catch { /* quota */ }
}

function hourBucket(): number {
  const now = new Date();
  // Bucket = day-of-year × 24 + hour  →  changes once per hour maximum
  const start = new Date(now.getFullYear(), 0, 0);
  const doy   = Math.floor((now.getTime() - start.getTime()) / 86_400_000);
  return doy * 24 + now.getHours();
}

// ─── User-data accessor ───────────────────────────────────────────────────────
type UserDataAccessor = () => {
  continueWatching?: Movie[];
  myList?: Movie[];
  likedMovies?: Record<string, { genre_ids?: number[]; rating?: string; movie?: Movie }>;
};
let _getUserData: UserDataAccessor = () => ({});
export function registerHeroUserDataAccessor(fn: UserDataAccessor) { _getUserData = fn; }

// ─── Pool item type ───────────────────────────────────────────────────────────
type HeroPoolItem = {
  url: () => string;
  label: string;
  preferGenres?: number[];
};

// ─── Time-slotted pools ───────────────────────────────────────────────────────
// Each time slot gets a mood-appropriate pool. The engine picks from the right
// slot for the current hour, so the hero always feels contextually relevant.

const HOME_POOLS: Record<TimeSlot, HeroPoolItem[]> = {
  morning: [
    { url: () => REQUESTS.fetchDocumentaries,            label: 'Morning Documentary',      preferGenres: [99] },
    { url: () => REQUESTS.fetchComedyMovies,             label: 'Feel-Good Morning Film',   preferGenres: [35] },
    { url: () => REQUESTS.fetchTopRated,                 label: 'All-Time Greats',          preferGenres: [18, 12] },
    { url: () => REQUESTS.fetchFamiliarFavorites,        label: 'Fan Favourites',           preferGenres: [28, 12] },
    { url: () => REQUESTS.fetchLoveTheseMovies,          label: 'Critically Loved',         preferGenres: [18] },
    { url: () => REQUESTS.fetchBoredomBustersMovies,     label: 'Easy Morning Watch',       preferGenres: [35, 12] },
  ],
  afternoon: [
    { url: () => REQUESTS.fetchExcitingMovies,           label: 'Blockbuster Action',       preferGenres: [28, 878] },
    { url: () => REQUESTS.fetchPopular,                  label: 'What Everyone Is Watching',preferGenres: [28, 35] },
    { url: () => REQUESTS.fetchActionMovies,             label: 'Action Films',             preferGenres: [28] },
    { url: () => REQUESTS.fetchSciFiMovies,              label: 'Sci-Fi Spectacles',        preferGenres: [878] },
    { url: () => REQUESTS.fetchBoredomBustersTV,         label: 'Gripping Series',          preferGenres: [80, 10765] },
    { url: () => REQUESTS.fetchFamiliarFavoritesMovies,  label: 'Crowd-Pleasers',           preferGenres: [28, 12] },
  ],
  evening: [
    { url: () => REQUESTS.fetchCriticallyAcclaimedDrama, label: 'Evening Drama',            preferGenres: [18] },
    { url: () => REQUESTS.fetchAwardWinningSeries,       label: 'Award-Winning Series',     preferGenres: [18, 10765] },
    { url: () => REQUESTS.fetchLoveTheseTV,              label: 'Must-Watch TV',            preferGenres: [18, 80] },
    { url: () => REQUESTS.fetchBoredomBustersTV,         label: 'Tonight\'s Binge Pick',    preferGenres: [80, 10765] },
    { url: () => REQUESTS.fetchLoveTheseMovies,          label: 'Critically Loved Film',    preferGenres: [18, 53] },
    { url: () => REQUESTS.fetchImaginativeSeries,        label: 'Imaginative Series',       preferGenres: [10765] },
  ],
  late_night: [
    { url: () => REQUESTS.fetchHorrorMovies,             label: 'Late Night Horror',        preferGenres: [27] },
    { url: () => REQUESTS.fetchSciFiMovies,              label: 'After Dark Sci-Fi',        preferGenres: [878] },
    { url: () => REQUESTS.fetchImaginativeSeries,        label: 'Mind-Bending Series',      preferGenres: [10765, 9648] },
    { url: () => REQUESTS.fetchCrimeTV,                  label: 'Late Night Crime',         preferGenres: [80, 53] },
    { url: () => REQUESTS.fetchExcitingMovies,           label: 'High-Stakes Thriller',     preferGenres: [53, 28] },
    { url: () => REQUESTS.fetchExcitingSeriesTV,         label: 'Edge-of-Seat Series',      preferGenres: [80, 10765] },
  ],
  night_owl: [
    { url: () => REQUESTS.fetchTopRated,                 label: 'Undiscovered Classics',    preferGenres: [18, 80] },
    { url: () => REQUESTS.fetchLoveTheseTV,              label: 'Night Owl TV',             preferGenres: [18, 10765] },
    { url: () => REQUESTS.fetchHorrorMovies,             label: 'Night Terror',             preferGenres: [27] },
    { url: () => REQUESTS.fetchSciFiMovies,              label: 'Deep Space Night',         preferGenres: [878] },
    { url: () => REQUESTS.fetchImaginativeSeries,        label: 'Strange Hours Viewing',    preferGenres: [10765, 9648] },
  ],
};

const MOVIE_POOLS: Record<TimeSlot, HeroPoolItem[]> = {
  morning:    [
    { url: () => REQUESTS.fetchComedyMovies,            label: 'Morning Comedy' },
    { url: () => REQUESTS.fetchTopRated,                label: 'All-Time Great Films' },
    { url: () => REQUESTS.fetchDocumentaries,           label: 'Morning Documentary' },
    { url: () => REQUESTS.fetchLoveTheseMovies,         label: 'Critically Loved' },
  ],
  afternoon:  [
    { url: () => REQUESTS.fetchExcitingMovies,          label: 'High-Octane' },
    { url: () => REQUESTS.fetchActionMovies,            label: 'Action Films' },
    { url: () => REQUESTS.fetchSciFiMovies,             label: 'Sci-Fi' },
    { url: () => REQUESTS.fetchBoredomBustersMovies,    label: 'Crowd-Pleasers' },
  ],
  evening:    [
    { url: () => REQUESTS.fetchLoveTheseMovies,         label: 'Evening Drama' },
    { url: () => REQUESTS.fetchTopRated,                label: 'All-Time Greats' },
    { url: () => REQUESTS.fetchRomanceMovies,           label: 'Evening Romance' },
    { url: () => REQUESTS.fetchFamiliarFavoritesMovies, label: 'Fan Favourites' },
  ],
  late_night: [
    { url: () => REQUESTS.fetchHorrorMovies,            label: 'Late Night Horror' },
    { url: () => REQUESTS.fetchSciFiMovies,             label: 'After Dark Sci-Fi' },
    { url: () => REQUESTS.fetchExcitingMovies,          label: 'Late Night Thrills' },
    { url: () => REQUESTS.fetchTopRated,                label: 'Cult Classics' },
  ],
  night_owl:  [
    { url: () => REQUESTS.fetchTopRated,                label: 'Hidden Film Gems' },
    { url: () => REQUESTS.fetchHorrorMovies,            label: 'Pre-Dawn Horror' },
    { url: () => REQUESTS.fetchSciFiMovies,             label: 'Night Vision Sci-Fi' },
    { url: () => REQUESTS.fetchLoveTheseMovies,         label: 'Arthouse Picks' },
  ],
};

const TV_POOLS: Record<TimeSlot, HeroPoolItem[]> = {
  morning:    [
    { url: () => REQUESTS.fetchComedyTV,                label: 'Morning Comedy Series' },
    { url: () => REQUESTS.fetchAwardWinningSeries,      label: 'Award Winners' },
    { url: () => REQUESTS.fetchDocumentaries,           label: 'Morning Docs' },
    { url: () => REQUESTS.fetchLoveTheseTV,             label: 'Must-Watch TV' },
  ],
  afternoon:  [
    { url: () => REQUESTS.fetchBoredomBustersTV,        label: 'Binge-Worthy' },
    { url: () => REQUESTS.fetchActionTV,                label: 'Action TV' },
    { url: () => REQUESTS.fetchImaginativeSeries,       label: 'Genre-Bending' },
    { url: () => REQUESTS.fetchExcitingSeriesTV,        label: 'High-Stakes Series' },
  ],
  evening:    [
    { url: () => REQUESTS.fetchAwardWinningSeries,      label: 'Award-Winning Series' },
    { url: () => REQUESTS.fetchCriticallyAcclaimedDrama,label: 'Prestige Drama' },
    { url: () => REQUESTS.fetchCrimeTV,                 label: 'Crime & Thriller' },
    { url: () => REQUESTS.fetchDramaTV,                 label: 'Evening Drama' },
  ],
  late_night: [
    { url: () => REQUESTS.fetchCrimeTV,                 label: 'Late Night Crime' },
    { url: () => REQUESTS.fetchImaginativeSeries,       label: 'After Dark Sci-Fi' },
    { url: () => REQUESTS.fetchBoredomBustersTV,        label: 'Can\'t Stop Watching' },
    { url: () => REQUESTS.fetchExcitingSeriesTV,        label: 'Edge-of-Seat Series' },
  ],
  night_owl:  [
    { url: () => REQUESTS.fetchLoveTheseTV,             label: 'Night Owl TV' },
    { url: () => REQUESTS.fetchCrimeTV,                 label: 'Pre-Dawn Crime' },
    { url: () => REQUESTS.fetchImaginativeSeries,       label: 'Strange Hours Series' },
    { url: () => REQUESTS.fetchAwardWinningSeries,      label: 'Overlooked Gems' },
  ],
};

// Holiday overrides — if it's Halloween, Christmas etc. these pools take priority
const HOLIDAY_HOME_OVERRIDE: Partial<Record<NonNullable<Holiday>, HeroPoolItem[]>> = {
  halloween: [
    { url: () => REQUESTS.fetchHorrorMovies, label: 'Halloween Night Horror', preferGenres: [27] },
    { url: () => REQUESTS.fetchImaginativeSeries, label: 'Halloween Series', preferGenres: [10765, 27] },
  ],
  christmas: [
    { url: () => REQUESTS.fetchComedyMovies, label: 'Christmas Comedy', preferGenres: [35] },
    { url: () => REQUESTS.fetchFamiliarFavorites, label: 'Christmas Family Film', preferGenres: [10751] },
  ],
  valentines: [
    { url: () => REQUESTS.fetchRomanceMovies, label: 'Valentine\'s Romance', preferGenres: [10749] },
    { url: () => REQUESTS.fetchComedyMovies,  label: 'Valentine\'s Night Comedy', preferGenres: [35, 10749] },
  ],
  summer_break: [
    { url: () => REQUESTS.fetchExcitingMovies,   label: 'Summer Blockbuster', preferGenres: [28, 12] },
    { url: () => REQUESTS.fetchBoredomBustersTV, label: 'Summer Binge Series', preferGenres: [10765, 28] },
  ],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = Math.imul(31, h) + s.charCodeAt(i) | 0;
  return Math.abs(h);
}

/**
 * Day-of-year — changes once per day, deterministic within the day.
 * Used for within-pool rotation so every day brings a different hero default.
 */
function dayOfYear(): number {
  const now   = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  return Math.floor((now.getTime() - start.getTime()) / 86_400_000);
}

function getUserTopGenres(): number[] {
  const { continueWatching = [], myList = [], likedMovies = {} } = _getUserData();
  const tally = new Map<number, number>();
  const add = (gids: number[] | undefined, w: number) =>
    (gids || []).forEach(g => tally.set(g, (tally.get(g) || 0) + w));
  continueWatching.forEach(m => add(m.genre_ids, 2));
  myList.forEach(m => add(m.genre_ids, 1));
  Object.values(likedMovies).forEach((entry: any) => {
    add(entry.movie?.genre_ids || entry.genre_ids, entry.rating === 'dislike' ? -3 : 3);
  });
  return [...tally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([g]) => g);
}

/**
 * Pick the best pool item for today, biased toward user's top genres.
 * Uses ±3 window around the daily-rotated base index.
 */
function pickPoolSlot(pool: HeroPoolItem[], pageType: string, userTopGenres: number[]): HeroPoolItem {
  const n       = pool.length;
  const baseIdx = hashStr(dayOfYear() + '_' + pageType) % n;
  if (userTopGenres.length === 0 || n <= 1) return pool[baseIdx];
  const window = [-3, -2, -1, 0, 1, 2, 3];
  let bestSlot  = pool[baseIdx];
  let bestScore = -1;
  for (const offset of window) {
    const idx     = ((baseIdx + offset) % n + n) % n;
    const slot    = pool[idx];
    const overlap = (slot.preferGenres || []).filter(g => userTopGenres.includes(g)).length;
    const score   = overlap * 10 - Math.abs(offset);
    if (score > bestScore) { bestScore = score; bestSlot = slot; }
  }
  return bestSlot;
}

// ─── Engine ───────────────────────────────────────────────────────────────────

class HeroEngineService {
  /** In-memory map — rebuilt from sessionStorage on first getHero() call */
  private live: Map<string, HeroPackage> = new Map();
  private isInitializing: Set<string>    = new Set();
  private listeners: Set<(pageType: string, hero: HeroPackage) => void> = new Set();
  private sessionCache: SessionCache     = {};
  private cacheLoaded                    = false;

  private ensureCacheLoaded() {
    if (this.cacheLoaded) return;
    this.sessionCache = loadSessionCache();
    this.cacheLoaded  = true;
  }

  /**
   * Try to rehydrate a hero from sessionStorage.
   * Entry is valid if:
   *   - It exists
   *   - It's less than SESSION_TTL old
   *   - It was fetched in the same 1-hour bucket (so time-slot changes still take effect
   *     when you cross e.g. 17:00 from afternoon → evening)
   */
  private fromCache(cacheKey: string): HeroPackage | null {
    this.ensureCacheLoaded();
    const entry = this.sessionCache[cacheKey];
    if (!entry) return null;
    const now = Date.now();
    const validAge  = now - entry.ts < SESSION_TTL;
    const sameHour  = entry.hourBucket === hourBucket();
    if (validAge && sameHour) {
      return { movie: entry.movie, logoUrl: entry.logoUrl, isReady: true, pageType: entry.pageType, timeSlot: entry.timeSlot };
    }
    // Stale — evict
    delete this.sessionCache[cacheKey];
    saveSessionCache(this.sessionCache);
    return null;
  }

  private toCache(cacheKey: string, pkg: HeroPackage) {
    this.ensureCacheLoaded();
    this.sessionCache[cacheKey] = {
      ts:         Date.now(),
      hourBucket: hourBucket(),
      movie:      pkg.movie,
      logoUrl:    pkg.logoUrl,
      pageType:   pkg.pageType,
      timeSlot:   pkg.timeSlot,
    };
    saveSessionCache(this.sessionCache);
  }

  async getHero(pageType: string, fetchUrl?: string, genreId?: number): Promise<HeroPackage | null> {
    const cacheKey = genreId ? `${pageType}_${genreId}` : pageType;

    // 1. Check live in-memory cache (fastest)
    if (this.live.has(cacheKey)) return this.live.get(cacheKey)!;

    // 2. Check session storage (survives refresh)
    const fromSession = this.fromCache(cacheKey);
    if (fromSession) {
      this.live.set(cacheKey, fromSession);
      return fromSession;
    }

    // 3. Prevent duplicate fetches
    if (this.isInitializing.has(cacheKey)) return null;
    this.isInitializing.add(cacheKey);

    try {
      const slot      = getTimeSlot();
      const holiday   = getCurrentHoliday();
      const userGenres = getUserTopGenres();

      let url: string;
      let slotLabel   = '';

      if (genreId) {
        url       = fetchUrl || REQUESTS.fetchByGenre(pageType as 'movie' | 'tv', genreId);
        slotLabel = `Genre ${genreId}`;
      } else if (fetchUrl) {
        url       = fetchUrl;
        slotLabel = 'Custom';
      } else {
        // ── Context-aware pool selection ─────────────────────────────────
        // Priority: holiday override → time-slotted pool → personalization
        let pool: HeroPoolItem[];

        const holidayOverride = holiday ? HOLIDAY_HOME_OVERRIDE[holiday] : undefined;
        if (holidayOverride && holidayOverride.length > 0 && pageType === 'home') {
          pool = holidayOverride;
        } else {
          const pools =
            pageType === 'movie' ? MOVIE_POOLS :
            pageType === 'tv'    ? TV_POOLS    :
                                   HOME_POOLS;
          pool = pools[slot];
        }

        const item = pickPoolSlot(pool, `${pageType}_${slot}`, userGenres);
        url        = item.url();
        slotLabel  = item.label;
      }

      console.log(`[HeroEngine v3] Curating "${slotLabel}" (${slot}) for ${cacheKey}…`);

      const response = await axios.get<TMDBResponse>(url);
      const results  = (response.data.results || []).filter(
        (m: any) => m.backdrop_path && m.vote_count >= 200,
      );

      if (results.length === 0) throw new Error(`No results for "${slotLabel}"`);

      // Pick a stable starting index: day + cacheKey hash so every page/slot is different
      const startIdx = hashStr(dayOfYear() + '_' + cacheKey) % results.length;

      let selectedMovie: any  = null;
      let logoUrl: string | undefined;
      let externals: any;
      let mediaType: 'movie' | 'tv' = 'movie';

      // Logo Guarantee: try up to 5 candidates, pick the first with an EN logo
      for (let attempt = 0; attempt < Math.min(5, results.length); attempt++) {
        const idx       = (startIdx + attempt) % results.length;
        const candidate = results[idx];
        const cType     = (candidate.media_type || (candidate.title ? 'movie' : 'tv')) as 'movie' | 'tv';

        const [images, exts] = await Promise.all([
          getMovieImages(candidate.id, cType),
          getExternalIds(candidate.id, cType),
        ]);

        const logo = images?.logos?.find((l: any) => l.iso_639_1 === 'en' || l.iso_639_1 === null);
        if (logo) {
          selectedMovie  = candidate;
          mediaType      = cType;
          logoUrl        = `https://image.tmdb.org/t/p/w500${logo.file_path}`;
          externals      = exts;
          break;
        }
      }

      // Hard fallback if no logo found after 5 attempts
      if (!selectedMovie) {
        selectedMovie  = results[startIdx];
        mediaType      = (selectedMovie.media_type || (selectedMovie.title ? 'movie' : 'tv')) as 'movie' | 'tv';
        externals      = await getExternalIds(selectedMovie.id, mediaType);
        const images   = await getMovieImages(selectedMovie.id, mediaType);
        const logo     = images?.logos?.find((l: any) => l.iso_639_1 === 'en' || l.iso_639_1 === null);
        if (logo) logoUrl = `https://image.tmdb.org/t/p/w500${logo.file_path}`;
      }

      const movieWithExtras = { ...selectedMovie, imdb_id: externals?.imdb_id };

      const pkg: HeroPackage = {
        movie:     movieWithExtras,
        logoUrl,
        isReady:   true,
        pageType,
        timeSlot:  slot,
      };

      // Persist to live map + sessionStorage
      this.live.set(cacheKey, pkg);
      this.toCache(cacheKey, pkg);
      this.isInitializing.delete(cacheKey);
      this.listeners.forEach(cb => cb(pageType, pkg));

      // Warm-prefetch the stream so clicking Play is instant
      const title       = movieWithExtras.title || movieWithExtras.name || '';
      const releaseDate = movieWithExtras.release_date || movieWithExtras.first_air_date;
      prefetchStream(
        title,
        releaseDate ? new Date(releaseDate).getFullYear() : undefined,
        String(movieWithExtras.id),
        mediaType,
        1, 1,
        movieWithExtras.imdb_id,
      );

      return pkg;
    } catch (e) {
      console.error(`[HeroEngine v3] Failed for ${cacheKey}:`, e);
      this.isInitializing.delete(cacheKey);
      return null;
    }
  }

  async prepareAllHeroes() {
    console.log('[HeroEngine v3] Warming up engines…');
    // Stagger slightly to avoid hammering TMDB simultaneously
    await this.getHero('home');
    setTimeout(() => this.getHero('movie'), 300);
    setTimeout(() => this.getHero('tv'),    600);
  }

  subscribe(callback: (pageType: string, hero: HeroPackage) => void) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  getCachedHero(pageType: string, genreId?: number): HeroPackage | undefined {
    const key = genreId ? `${pageType}_${genreId}` : pageType;
    return this.live.get(key) ?? (this.fromCache(key) || undefined);
  }

  /**
   * Force-invalidate specific pages (e.g. after user data loads so personalization kicks in).
   * Only clears if the cached entry is older than 30s (prevents thrashing on first load).
   */
  invalidateAndRefresh(pageTypes: string[] = ['home', 'movie', 'tv']) {
    this.ensureCacheLoaded();
    const now = Date.now();
    pageTypes.forEach(p => {
      const entry = this.sessionCache[p];
      if (!entry || now - entry.ts > 30_000) {
        this.live.delete(p);
        this.isInitializing.delete(p);
        delete this.sessionCache[p];
        this.getHero(p);
      }
    });
    saveSessionCache(this.sessionCache);
  }

  /** Expose current time context so UI can show e.g. a "Good evening" greeting */
  getContext() {
    return { timeSlot: getTimeSlot(), season: getSeason(), holiday: getCurrentHoliday() };
  }
}

export const HeroEngine = new HeroEngineService();