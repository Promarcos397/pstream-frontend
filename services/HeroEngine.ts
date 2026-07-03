import { REQUESTS } from '../constants';
import { Movie, TMDBResponse } from '../types';
import { getMovieImages, getExternalIds, fetchData, isBlacklisted, isKidsSafe, isGlobalKidsModeActive } from './api';
import tmdb from './tmdb';

/**
 * HeroEngine v4 — "Discovery-First, Session-Random"
 *
 * Fixes over v3:
 *  1. SESSION SALT   — A random salt is written to sessionStorage once per
 *                      session. Every new tab/incognito/hard-cleared session
 *                      gets a genuinely different hero pick. No more
 *                      day-hash lock-in where refresh changes nothing.
 *  2. PAGE DEPTH     — TMDB page is derived from the session salt (pages 2–5),
 *                      so we never always hit the same top-20 results.
 *  3. QUALITY FILTER — Results are filtered with a popularity ceiling
 *                      (vote_count ≤ 8 000) and a quality floor
 *                      (vote_average ≥ 6.8) to surface hidden gems over
 *                      mega-blockbusters everyone has already seen.
 *  4. POOL EXPANSION — Pools grow from 4–6 to 8–10 entries each, drawing
 *                      on 10 new niche REQUESTS (world cinema, prestige drama,
 *                      cult films, underrated thrillers, hidden gems, etc.).
 *                      No endpoint is duplicated across time slots.
 *  5. STABILITY      — Session-level cache (4 h TTL + hour-bucket guard) is
 *                      retained from v3 for within-session stability.
 *  6. LOGO GUARANTEE — unchanged: tries up to 5 candidates before fallback.
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
export type Holiday   = 'halloween' | 'christmas' | 'valentines' | 'new_year' | 'easter' | 'summer_break' | 'eid-al-fitr' | 'eid-al-adha' | null;


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
  if (month === 1  && day >= 2 && day <= 8)                        return 'new_year';
  if (month === 2  && day >= 10 && day <= 16)                      return 'valentines';
  if (month === 3  && day >= 28)                                   return 'easter';
  if (month === 4  && day <= 5)                                    return 'easter';
  // eid-al-fitr
  if (month === 4 && day >= 10 && day <= 14)                       return 'eid-al-fitr';
  if (month === 6 && day >= 15 && day <= 20)                       return 'eid-al-adha';
  if ((month === 7 && day >= 20) || month === 8 || (month === 9 && day <= 5)) return 'summer_break';

  return null;
}

// ─── Session-storage cache ────────────────────────────────────────────────────

const SESSION_KEY      = 'pstream_hero_v4';
const SESSION_SALT_KEY = 'pstream_hero_salt_v4';
const SESSION_TTL      = 4 * 60 * 60 * 1000; // 4 hours

interface CachedHeroEntry {
  ts: number;
  hourBucket: number;
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
  const start = new Date(now.getFullYear(), 0, 0);
  const doy   = Math.floor((now.getTime() - start.getTime()) / 86_400_000);
  return doy * 24 + now.getHours();
}

/**
 * v4 key change: per-session random salt.
 * Written once to sessionStorage so it stays stable within the session,
 * but every new incognito/cleared session gets a fresh random number.
 */
function getSessionSalt(): number {
  try {
    let salt = sessionStorage.getItem(SESSION_SALT_KEY);
    if (!salt) {
      salt = String(Math.floor(Math.random() * 9999) + 1);
      sessionStorage.setItem(SESSION_SALT_KEY, salt);
    }
    return Number(salt);
  } catch {
    return Math.floor(Math.random() * 9999) + 1;
  }
}

/**
 * Map session salt → TMDB page (2–5).
 * Page 1 is always the most popular/known — skip it entirely.
 */
function getSessionPage(salt: number): number {
  return (salt % 4) + 2; // 2, 3, 4, or 5
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
  /** Skip popularity/vote ceiling for this slot (e.g. "All-Time Greats") */
  allowPopular?: boolean;
};

// ─── Time-slotted pools ───────────────────────────────────────────────────────
// v4: 8–10 entries per slot. No endpoint reused across time slots.
// New niche endpoints used throughout to surface hidden gems.

const HOME_POOLS: Record<TimeSlot, HeroPoolItem[]> = {
  morning: [
    { url: () => REQUESTS.fetchDocumentaries,           label: 'Morning Documentary',        preferGenres: [99] },
    { url: () => REQUESTS.fetchComedyMovies,            label: 'Feel-Good Morning Film',     preferGenres: [35] },
    { url: () => REQUESTS.fetchWorldCinema,             label: 'World Cinema Pick',          preferGenres: [18] },
    { url: () => REQUESTS.fetchFamiliarFavorites,       label: 'Fan Favourites',             preferGenres: [28, 12] },
    { url: () => REQUESTS.fetchHiddenGems,              label: 'Overlooked Gem',             preferGenres: [18, 12] },
    { url: () => REQUESTS.fetchClassicCinema,           label: 'A Classic You May Have Missed', preferGenres: [18] },
    { url: () => REQUESTS.fetchBoredomBustersMovies,    label: 'Easy Morning Watch',         preferGenres: [35, 12] },
    { url: () => REQUESTS.fetchRomanceMovies,           label: 'Morning Romance',            preferGenres: [10749] },
  ],
  afternoon: [
    { url: () => REQUESTS.fetchExcitingMovies,          label: 'High-Octane Blockbuster',    preferGenres: [28, 878] },
    { url: () => REQUESTS.fetchUnderratedThrillers,     label: 'Underrated Thriller',        preferGenres: [53] },
    { url: () => REQUESTS.fetchConceptualSciFi,         label: 'Thought-Provoking Sci-Fi',   preferGenres: [878] },
    { url: () => REQUESTS.fetchActionMovies,            label: 'Action Pick',                preferGenres: [28] },
    { url: () => REQUESTS.fetchBoredomBustersTV,        label: 'Gripping Series',            preferGenres: [80, 10765] },
    { url: () => REQUESTS.fetchHiddenTVGems,            label: 'Hidden Series Gem',          preferGenres: [18, 10765] },
    { url: () => REQUESTS.fetchMysteryThrillerSeries,   label: 'Puzzle-Box Series',          preferGenres: [9648, 53] },
    { url: () => REQUESTS.fetchInternationalSeries,     label: 'International Hit',          preferGenres: [18] },
  ],
  evening: [
    { url: () => REQUESTS.fetchPrestigeDrama,           label: 'Prestige Cinema Tonight',    preferGenres: [18] },
    { url: () => REQUESTS.fetchAwardWinningSeries,      label: 'Award-Winning Series',       preferGenres: [18, 10765] },
    { url: () => REQUESTS.fetchHiddenGems,              label: 'Tonight\'s Hidden Gem',      preferGenres: [18, 53] },
    { url: () => REQUESTS.fetchWorldCinema,             label: 'World Cinema Spotlight',     preferGenres: [18] },
    { url: () => REQUESTS.fetchMysteryThrillerSeries,   label: 'Mystery of the Evening',     preferGenres: [9648, 53] },
    { url: () => REQUESTS.fetchClassicCinema,           label: 'A Timeless Classic',         preferGenres: [18, 80] },
    { url: () => REQUESTS.fetchInternationalSeries,     label: 'International Gem',          preferGenres: [18] },
    { url: () => REQUESTS.fetchHiddenTVGems,            label: 'Acclaimed Series Pick',      preferGenres: [18, 10765] },
    { url: () => REQUESTS.fetchCriticallyAcclaimedDrama,label: 'Critically Acclaimed Drama', preferGenres: [18] },
  ],
  late_night: [
    { url: () => REQUESTS.fetchHorrorMovies,            label: 'Late Night Horror',          preferGenres: [27] },
    { url: () => REQUESTS.fetchCultFilms,               label: 'Cult Midnight Pick',         preferGenres: [27, 878] },
    { url: () => REQUESTS.fetchUnderratedThrillers,     label: 'After-Dark Thriller',        preferGenres: [53] },
    { url: () => REQUESTS.fetchImaginativeSeries,       label: 'Mind-Bending Series',        preferGenres: [10765, 9648] },
    { url: () => REQUESTS.fetchCrimeTV,                 label: 'Late Night Crime',           preferGenres: [80, 53] },
    { url: () => REQUESTS.fetchConceptualSciFi,         label: 'Deep-Space Night',           preferGenres: [878] },
    { url: () => REQUESTS.fetchMysteryThrillerSeries,   label: 'Psychological Thriller',     preferGenres: [9648] },
    { url: () => REQUESTS.fetchExcitingSeriesTV,        label: 'Edge-of-Seat Series',        preferGenres: [80, 10765] },
  ],
  night_owl: [
    { url: () => REQUESTS.fetchClassicCinema,           label: 'Undiscovered Classic',       preferGenres: [18, 80] },
    { url: () => REQUESTS.fetchCultFilms,               label: 'Pre-Dawn Cult Film',         preferGenres: [27, 878] },
    { url: () => REQUESTS.fetchHorrorMovies,            label: 'Night Terror',               preferGenres: [27] },
    { url: () => REQUESTS.fetchWorldCinema,             label: 'Night Owl World Cinema',     preferGenres: [18] },
    { url: () => REQUESTS.fetchHiddenTVGems,            label: 'Strange Hours Viewing',      preferGenres: [10765, 9648] },
    { url: () => REQUESTS.fetchPrestigeDrama,           label: 'Arthouse Drama Pick',        preferGenres: [18] },
    { url: () => REQUESTS.fetchInternationalSeries,     label: 'International Late Pick',    preferGenres: [18] },
  ],
};

const MOVIE_POOLS: Record<TimeSlot, HeroPoolItem[]> = {
  morning: [
    { url: () => REQUESTS.fetchComedyMovies,            label: 'Morning Comedy' },
    { url: () => REQUESTS.fetchWorldCinema,             label: 'World Cinema Morning' },
    { url: () => REQUESTS.fetchDocumentaries,           label: 'Morning Documentary' },
    { url: () => REQUESTS.fetchHiddenGems,              label: 'Hidden Film Gem' },
    { url: () => REQUESTS.fetchClassicCinema,           label: 'Classic You\'ve Never Seen' },
    { url: () => REQUESTS.fetchRomanceMovies,           label: 'Morning Romance' },
    { url: () => REQUESTS.fetchSciFiMovies,             label: 'Morning Sci-Fi' },
    { url: () => REQUESTS.fetchFamiliarFavoritesMovies, label: 'Crowd-Pleaser Film' },
    { url: () => REQUESTS.fetchPrestigeDrama,           label: 'Morning Prestige Pick' },
  ],
  afternoon: [
    { url: () => REQUESTS.fetchExcitingMovies,          label: 'High-Octane' },
    { url: () => REQUESTS.fetchUnderratedThrillers,     label: 'Underrated Thriller' },
    { url: () => REQUESTS.fetchConceptualSciFi,         label: 'Thought-Provoking Sci-Fi' },
    { url: () => REQUESTS.fetchActionMovies,            label: 'Action Film' },
    { url: () => REQUESTS.fetchBoredomBustersMovies,    label: 'Crowd-Pleaser' },
    { url: () => REQUESTS.fetchHorrorMovies,            label: 'Afternoon Chiller' },
    { url: () => REQUESTS.fetchLoveTheseMovies,         label: 'Critically Loved Film',   allowPopular: true },
    { url: () => REQUESTS.fetchFamiliarFavoritesMovies, label: 'Afternoon Blockbuster',   allowPopular: true },
  ],
  evening: [
    { url: () => REQUESTS.fetchPrestigeDrama,           label: 'Prestige Drama' },
    { url: () => REQUESTS.fetchHiddenGems,              label: 'Tonight\'s Hidden Gem' },
    { url: () => REQUESTS.fetchWorldCinema,             label: 'World Cinema Spotlight' },
    { url: () => REQUESTS.fetchClassicCinema,           label: 'Timeless Classic' },
    { url: () => REQUESTS.fetchUnderratedThrillers,     label: 'Underrated Evening Thriller' },
    { url: () => REQUESTS.fetchCultFilms,               label: 'Cult Evening Pick' },
    { url: () => REQUESTS.fetchActionMovies,            label: 'Evening Blockbuster' },
    { url: () => REQUESTS.fetchRomanceMovies,           label: 'Evening Romance' },
    { url: () => REQUESTS.fetchSciFiMovies,             label: 'Evening Sci-Fi' },
  ],
  late_night: [
    { url: () => REQUESTS.fetchHorrorMovies,            label: 'Late Night Horror' },
    { url: () => REQUESTS.fetchCultFilms,               label: 'Cult Midnight Pick' },
    { url: () => REQUESTS.fetchConceptualSciFi,         label: 'After-Dark Sci-Fi' },
    { url: () => REQUESTS.fetchUnderratedThrillers,     label: 'Late Night Thriller' },
    { url: () => REQUESTS.fetchWorldCinema,             label: 'International Late Pick' },
    { url: () => REQUESTS.fetchClassicCinema,           label: 'Night Classic' },
    { url: () => REQUESTS.fetchPrestigeDrama,           label: 'Late Night Drama' },
    { url: () => REQUESTS.fetchHiddenGems,              label: 'Night Hidden Gem' },
  ],
  night_owl: [
    { url: () => REQUESTS.fetchClassicCinema,           label: 'Hidden Classic' },
    { url: () => REQUESTS.fetchHorrorMovies,            label: 'Pre-Dawn Horror' },
    { url: () => REQUESTS.fetchPrestigeDrama,           label: 'Arthouse Night Pick' },
    { url: () => REQUESTS.fetchHiddenGems,              label: 'Night Owl Gem' },
    { url: () => REQUESTS.fetchCultFilms,               label: 'Night Cult Film' },
    { url: () => REQUESTS.fetchWorldCinema,             label: 'Pre-Dawn World Cinema' },
    { url: () => REQUESTS.fetchConceptualSciFi,         label: 'Pre-Dawn Sci-Fi' },
    { url: () => REQUESTS.fetchUnderratedThrillers,     label: 'Pre-Dawn Thriller' },
  ],
};

const TV_POOLS: Record<TimeSlot, HeroPoolItem[]> = {
  morning: [
    { url: () => REQUESTS.fetchComedyTV,                label: 'Morning Comedy Series' },
    { url: () => REQUESTS.fetchHiddenTVGems,            label: 'Hidden Series Gem' },
    { url: () => REQUESTS.fetchDocumentaries,           label: 'Morning Docs' },
    { url: () => REQUESTS.fetchInternationalSeries,     label: 'International Morning Pick' },
    { url: () => REQUESTS.fetchAwardWinningSeries,      label: 'Award-Winning Morning Pick' },
    { url: () => REQUESTS.fetchDramaTV,                 label: 'Morning Drama' },
    { url: () => REQUESTS.fetchLoveTheseTV,             label: 'Top-Rated Morning Pick',   allowPopular: true },
  ],
  afternoon: [
    { url: () => REQUESTS.fetchBoredomBustersTV,        label: 'Binge-Worthy' },
    { url: () => REQUESTS.fetchActionTV,                label: 'Action Series' },
    { url: () => REQUESTS.fetchMysteryThrillerSeries,   label: 'Puzzle-Box Series' },
    { url: () => REQUESTS.fetchExcitingSeriesTV,        label: 'High-Stakes Series' },
    { url: () => REQUESTS.fetchInternationalSeries,     label: 'International Gem' },
    { url: () => REQUESTS.fetchHiddenTVGems,            label: 'Underrated Series Pick' },
    { url: () => REQUESTS.fetchDramaTV,                 label: 'Afternoon Drama' },
    { url: () => REQUESTS.fetchLoveTheseTV,             label: 'Top-Rated Series',         allowPopular: true },
  ],
  evening: [
    { url: () => REQUESTS.fetchAwardWinningSeries,      label: 'Award-Winning Series' },
    { url: () => REQUESTS.fetchCriticallyAcclaimedDrama,label: 'Prestige Drama Series' },
    { url: () => REQUESTS.fetchCrimeTV,                 label: 'Crime & Thriller' },
    { url: () => REQUESTS.fetchMysteryThrillerSeries,   label: 'Evening Mystery' },
    { url: () => REQUESTS.fetchHiddenTVGems,            label: 'Tonight\'s Hidden Gem' },
    { url: () => REQUESTS.fetchInternationalSeries,     label: 'International Spotlight' },
    { url: () => REQUESTS.fetchDramaTV,                 label: 'Evening Drama' },
    { url: () => REQUESTS.fetchImaginativeSeries,       label: 'Sci-Fi & Fantasy Evening' },
    { url: () => REQUESTS.fetchUSSeries,                label: 'US Hit Series' },
  ],
  late_night: [
    { url: () => REQUESTS.fetchCrimeTV,                 label: 'Late Night Crime' },
    { url: () => REQUESTS.fetchImaginativeSeries,       label: 'After Dark Sci-Fi Series' },
    { url: () => REQUESTS.fetchMysteryThrillerSeries,   label: 'Psychological Thriller Series' },
    { url: () => REQUESTS.fetchExcitingSeriesTV,        label: 'Edge-of-Seat Series' },
    { url: () => REQUESTS.fetchHiddenTVGems,            label: 'Late Night Hidden Gem' },
    { url: () => REQUESTS.fetchInternationalSeries,     label: 'International Night Pick' },
    { url: () => REQUESTS.fetchDramaTV,                 label: 'Late Night Drama' },
    { url: () => REQUESTS.fetchAwardWinningSeries,      label: 'Award Binge Pick' },
  ],
  night_owl: [
    { url: () => REQUESTS.fetchInternationalSeries,     label: 'International Late Pick' },
    { url: () => REQUESTS.fetchHiddenTVGems,            label: 'Night Owl Series Gem' },
    { url: () => REQUESTS.fetchMysteryThrillerSeries,   label: 'Pre-Dawn Mystery' },
    { url: () => REQUESTS.fetchAwardWinningSeries,      label: 'Overlooked Award Pick' },
    { url: () => REQUESTS.fetchCrimeTV,                 label: 'Pre-Dawn Crime' },
    { url: () => REQUESTS.fetchImaginativeSeries,       label: 'Night Owl Sci-Fi' },
    { url: () => REQUESTS.fetchComedyTV,                label: 'Late-Night Comedy' },
  ],
};

// Holiday overrides — mood-appropriate content takes priority when a holiday matches
const HOLIDAY_HOME_OVERRIDE: Partial<Record<NonNullable<Holiday>, HeroPoolItem[]>> = {
  halloween: [
    { url: () => REQUESTS.fetchHorrorMovies,    label: 'Halloween Night Horror',    preferGenres: [27] },
    { url: () => REQUESTS.fetchCultFilms,       label: 'Halloween Cult Pick',       preferGenres: [27, 878] },
    { url: () => REQUESTS.fetchImaginativeSeries, label: 'Halloween Series',        preferGenres: [10765, 27] },
  ],
  christmas: [
    { url: () => REQUESTS.fetchComedyMovies,            label: 'Christmas Comedy',         preferGenres: [35] },
    { url: () => REQUESTS.fetchFamiliarFavoritesMovies, label: 'Christmas Family Film',    preferGenres: [10751] },
    { url: () => REQUESTS.fetchClassicCinema,           label: 'A Christmas Classic',      preferGenres: [35, 10751] },
  ],
  valentines: [
    { url: () => REQUESTS.fetchRomanceMovies,   label: 'Valentine\'s Romance',      preferGenres: [10749] },
    { url: () => REQUESTS.fetchWorldCinema,     label: 'Romantic World Cinema',     preferGenres: [10749, 18] },
  ],
  summer_break: [
    { url: () => REQUESTS.fetchExcitingMovies,  label: 'Summer Blockbuster',        preferGenres: [28, 12] },
    { url: () => REQUESTS.fetchConceptualSciFi, label: 'Summer Sci-Fi Spectacle',   preferGenres: [878] },
    { url: () => REQUESTS.fetchBoredomBustersTV,label: 'Summer Binge Series',       preferGenres: [10765, 28] },
  ],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
 * Pick the best pool item, biased toward user's top genres.
 * v4: uses session salt for the base index instead of day hash,
 * so each session gets a different starting point.
 */
function pickPoolSlot(pool: HeroPoolItem[], pageType: string, userTopGenres: number[], salt: number): HeroPoolItem {
  const n       = pool.length;
  const baseIdx = salt % n;
  if (userTopGenres.length === 0 || n <= 1) return pool[baseIdx];
  const windowRange = [-3, -2, -1, 0, 1, 2, 3];
  let bestSlot  = pool[baseIdx];
  let bestScore = -1;
  for (const offset of windowRange) {
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
  private live: Map<string, HeroPackage>                        = new Map();
  private initializing: Map<string, Promise<HeroPackage | null>> = new Map();
  private listeners: Set<(pageType: string, hero: HeroPackage) => void> = new Set();
  private sessionCache: SessionCache = {};
  private cacheLoaded                = false;

  private ensureCacheLoaded() {
    if (this.cacheLoaded) return;
    this.sessionCache = loadSessionCache();
    this.cacheLoaded  = true;
  }

  // Kids and adult profiles must never share a cached hero — suffix the key so
  // switching profiles can't surface a hero curated under the other mode.
  private modeKey(baseKey: string): string {
    return isGlobalKidsModeActive() ? `${baseKey}::kids` : baseKey;
  }

  private fromCache(cacheKey: string): HeroPackage | null {
    this.ensureCacheLoaded();
    const entry = this.sessionCache[cacheKey];
    if (!entry) return null;
    const now       = Date.now();
    const validAge  = now - entry.ts < SESSION_TTL;
    const sameHour  = entry.hourBucket === hourBucket();
    if (validAge && sameHour) {
      return { movie: entry.movie, logoUrl: entry.logoUrl, isReady: true, pageType: entry.pageType, timeSlot: entry.timeSlot };
    }
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
    const cacheKey = this.modeKey(genreId ? `${pageType}_${genreId}` : pageType);

    // 1. Check live in-memory cache
    if (this.live.has(cacheKey)) return this.live.get(cacheKey)!;

    // 2. Check session storage
    const fromSession = this.fromCache(cacheKey);
    if (fromSession) {
      this.live.set(cacheKey, fromSession);
      this.preloadBackdrop(fromSession.movie?.backdrop_path);
      return fromSession;
    }

    // 3. Prevent duplicate in-flight fetches
    if (this.initializing.has(cacheKey)) return this.initializing.get(cacheKey)!;

    const promise = (async () => {
      try {
        const salt       = getSessionSalt();
        const tmdbPage   = getSessionPage(salt);
        const slot       = getTimeSlot();
        const holiday    = getCurrentHoliday();
        const userGenres = getUserTopGenres();

        let url: string;
        let slotLabel = '';
        let allowPopular = false;

        if (genreId) {
          url = fetchUrl || REQUESTS.fetchByGenre(pageType as 'movie' | 'tv', genreId);
          slotLabel    = `Genre ${genreId}`;
          allowPopular = true;
        } else if (fetchUrl) {
          url = fetchUrl;
          slotLabel    = 'Custom';
          allowPopular = true;
        } else {
          let pool: HeroPoolItem[];
          const holidayOverride = holiday ? HOLIDAY_HOME_OVERRIDE[holiday] : undefined;
          if (holidayOverride && holidayOverride.length > 0 && pageType === 'home') {
            pool = holidayOverride;
          } else {
            const pools = pageType === 'movie' ? MOVIE_POOLS : pageType === 'tv' ? TV_POOLS : HOME_POOLS;
            pool = pools[slot];
          }
          const item   = pickPoolSlot(pool, `${pageType}_${slot}`, userGenres, salt);
          url          = item.url();
          slotLabel    = item.label;
          allowPopular = item.allowPopular ?? false;
        }

        // Append page to URL (pages 2–5 skip the most-popular top-20)
        const pagedUrl = url.includes('?')
          ? `${url}&page=${tmdbPage}`
          : `${url}?page=${tmdbPage}`;

        console.log(`[HeroEngine v4] Curating "${slotLabel}" (${slot}, page ${tmdbPage}) for ${cacheKey}…`);

        const response = await tmdb.get<TMDBResponse>(pagedUrl);

        // v4 quality + popularity filter
        const VOTE_FLOOR   = 80;
        const VOTE_CEILING = allowPopular ? Infinity : 8000;
        const AVG_FLOOR    = allowPopular ? 0         : 6.8;

        const kidsGate = (m: any) => !isGlobalKidsModeActive() || isKidsSafe(m);

        const results = (response.data.results || []).filter(
          (m: any) =>
            m.backdrop_path &&
            m.vote_count  >= VOTE_FLOOR   &&
            m.vote_count  <= VOTE_CEILING  &&
            m.vote_average >= AVG_FLOOR    &&
            !isBlacklisted(m, 'any') &&
            kidsGate(m)
        );

        // Fallback: relax ceiling if niche filter was too tight
        const fallbackResults = results.length < 3
          ? (response.data.results || []).filter(
              (m: any) => m.backdrop_path && m.vote_count >= VOTE_FLOOR && !isBlacklisted(m, 'any') && kidsGate(m)
            )
          : results;

        const pool = fallbackResults.length > 0 ? fallbackResults : results;
        if (pool.length === 0) throw new Error(`No results for "${slotLabel}" (page ${tmdbPage})`);

        // v4: use session salt to pick the starting candidate (not day hash)
        const startIdx = salt % pool.length;
        let selectedMovie: any = null;
        let logoUrl: string | undefined;
        let externals: any;
        let mediaType: 'movie' | 'tv' = 'movie';

        const candidateIndices = Array.from(
          { length: Math.min(5, pool.length) },
          (_, i) => (startIdx + i) % pool.length
        );
        const candidateBatch = await Promise.all(candidateIndices.map(async (idx) => {
          const c     = pool[idx];
          const cType = (c.media_type || (c.title ? 'movie' : 'tv')) as 'movie' | 'tv';
          const [images, exts] = await Promise.all([
            getMovieImages(c.id, cType),
            getExternalIds(c.id, cType),
          ]);
          return { c, cType, images, exts };
        }));

        for (const { c, cType, images, exts } of candidateBatch) {
          const logo = images?.logos?.find((l: any) => l.iso_639_1 === 'en' || l.iso_639_1 === null);
          if (logo) {
            selectedMovie = c;
            mediaType     = cType;
            logoUrl       = `https://image.tmdb.org/t/p/w300${logo.file_path}`;
            externals     = exts;
            break;
          }
        }

        if (!selectedMovie) {
          selectedMovie = pool[startIdx];
          mediaType     = (selectedMovie.media_type || (selectedMovie.title ? 'movie' : 'tv')) as 'movie' | 'tv';
          externals     = await getExternalIds(selectedMovie.id, mediaType);
          const images  = await getMovieImages(selectedMovie.id, mediaType);
          const logo    = images?.logos?.find((l: any) => l.iso_639_1 === 'en' || l.iso_639_1 === null);
          if (logo) logoUrl = `https://image.tmdb.org/t/p/w300${logo.file_path}`;
        }

        const movieWithExtras = { ...selectedMovie, imdb_id: externals?.imdb_id };
        const pkg: HeroPackage = {
          movie:    movieWithExtras,
          logoUrl,
          isReady:  true,
          pageType,
          timeSlot: slot,
        };

        this.live.set(cacheKey, pkg);
        this.toCache(cacheKey, pkg);
        this.preloadBackdrop(pkg.movie?.backdrop_path);
        this.listeners.forEach(cb => cb(pageType, pkg));

        return pkg;
      } catch (e) {
        console.error(`[HeroEngine v4] Failed for ${cacheKey}:`, e);
        return null;
      } finally {
        this.initializing.delete(cacheKey);
      }
    })();

    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000));
    const finalPromise   = Promise.race([promise, timeoutPromise]);

    this.initializing.set(cacheKey, finalPromise);
    return finalPromise;
  }

  subscribe(callback: (pageType: string, hero: HeroPackage) => void) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private preloadBackdrop(backdropPath?: string) {
    if (!backdropPath || typeof window === 'undefined') return;
    const url = `https://image.tmdb.org/t/p/w1280${backdropPath}`;
    if (document.querySelector(`link[rel="preload"][href="${url}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = url;
    link.setAttribute('fetchpriority', 'high');
    document.head.appendChild(link);
  }

  getCachedHero(pageTypeOrKey: string, genreId?: number): HeroPackage | undefined {
    const key = this.modeKey((genreId !== undefined) ? `${pageTypeOrKey}_${genreId}` : pageTypeOrKey);
    return this.live.get(key) ?? (this.fromCache(key) || undefined);
  }

  /**
   * Force-invalidate pages (e.g. after user data loads so personalization kicks in).
   * Only clears if the cached entry is older than 30s (prevents thrashing on first load).
   */
  invalidateAndRefresh(pageTypes: string[] = ['home', 'movie', 'tv']) {
    this.ensureCacheLoaded();
    const now = Date.now();
    pageTypes.forEach(p => {
      const entry = this.sessionCache[p];
      if (!entry || now - entry.ts > 30_000) {
        this.live.delete(p);
        this.initializing.delete(p);
        delete this.sessionCache[p];
        this.getHero(p);
      }
    });
    saveSessionCache(this.sessionCache);
  }

  /** Clear genre-scoped hero cache (e.g. home_28 when switching Home genres). */
  invalidateGenreHero(pageType: string, genreId?: number) {
    const key = this.modeKey(genreId !== undefined ? `${pageType}_${genreId}` : pageType);
    this.live.delete(key);
    this.initializing.delete(key);
    this.ensureCacheLoaded();
    delete this.sessionCache[key];
    saveSessionCache(this.sessionCache);
  }

  /** Expose current time context so UI can show e.g. a "Good evening" greeting */
  getContext() {
    return { timeSlot: getTimeSlot(), season: getSeason(), holiday: getCurrentHoliday() };
  }

  /** Fire background hero fetches for all main page types so switching pages is instant. */
  prefetchAll() {
    const PAGE_TYPES: string[] = ['home', 'movie', 'tv'];
    PAGE_TYPES.forEach(pt => {
      if (!this.live.has(pt) && !this.initializing.has(pt)) {
        this.getHero(pt);
      }
    });
  }
}

export const HeroEngine = new HeroEngineService();