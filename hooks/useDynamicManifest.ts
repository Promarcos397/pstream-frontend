import { useMemo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  MICRO_GENRES, DAY_STREAMS,
  GENRES,
  TIME_STREAMS, SEASON_STREAMS, HOLIDAY_STREAMS, ADJACENT_GENRES,
} from '../data/genres';
import { Movie } from '../types';
import { useGlobalContext } from '../context/GlobalContext';
import { REQUESTS } from '../constants';
import { getWatchData } from '../components/MovieCardBadges';

// Re-export context helpers from HeroEngine so both systems share the same logic
export { getTimeSlot, getSeason, getCurrentHoliday } from '../services/HeroEngine';
import { getTimeSlot, getSeason, getCurrentHoliday } from '../services/HeroEngine';

export interface SmartRow {
  key: string;
  title: string;
  fetchUrl?: string;
  data?: Movie[];
  type?: 'standard' | 'top10';
}

// ─── Deterministic Helpers ────────────────────────────────────────────────────

const getDailyHash = (): number => {
  const day = new Date().toDateString();
  let h = 0;
  for (let i = 0; i < day.length; i++) h = (h * 31 + day.charCodeAt(i)) | 0;
  return Math.abs(h);
};

const getDayOfWeek = (): string =>
  new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date());

const seededPick = <T,>(arr: T[], n: number, seed: number): T[] => {
  if (arr.length <= n) return [...arr];
  const indices = new Set<number>();
  let s = seed;
  while (indices.size < n) {
    s = (s * 16807 + 37) % 2147483647;
    indices.add(Math.abs(s) % arr.length);
  }
  return [...indices].map(i => arr[i]);
};

// ─── URL Signature Deduplicator ───────────────────────────────────────────────
// Strips pagination (page=N) from URL sig comparison, so page=1 and page=2 of
// the same sort are considered DIFFERENT (they return different 20-item chunks).
// But two rows with identical base params + identical page → duplicate → skip.

const makeUrlSig = (url: string): string => {
  try {
    // Normalise: sort query params for stable comparison, but KEEP page=
    const [base, qs = ''] = url.split('?');
    const params = qs.split('&').filter(Boolean).sort();
    return base + '?' + params.join('&');
  } catch { return url; }
};

// ─── Genre-Specific Keyword Rows ──────────────────────────────────────────────
// These produce rows that are genuinely different because they use TMDB keyword
// filters (with_keywords) which narrow to very specific sub-genres.

const GENRE_KEYWORD_ROWS: Record<number, { name: string; keywords: string; extra?: string }[]> = {
  // Crime (80)
  80: [
    { name: 'Heist Films Worth Planning For',   keywords: '9715',   extra: '&sort_by=vote_average.desc&vote_count.gte=300' },
    { name: 'Serial Killer Thrillers',           keywords: '10084',  extra: '&sort_by=popularity.desc' },
    { name: 'Courtroom Drama',                   keywords: '10596',  extra: '&sort_by=vote_average.desc&vote_count.gte=200' },
    { name: 'Organised Crime Sagas',             keywords: '6074',   extra: '&sort_by=vote_count.desc' },
  ],
  // Thriller (53)
  53: [
    { name: 'Psychological Thrillers',           keywords: '9799',   extra: '&sort_by=vote_average.desc&vote_count.gte=500' },
    { name: 'Espionage & Spy Thrillers',         keywords: '9882',   extra: '&sort_by=popularity.desc' },
  ],
  // Horror (27)
  27: [
    { name: 'Supernatural Horror',               keywords: '10090',  extra: '&sort_by=popularity.desc' },
    { name: 'Creature Feature Classics',         keywords: '9882',   extra: '&sort_by=vote_count.desc' },
    { name: 'Slasher Films',                     keywords: '186325', extra: '&sort_by=vote_average.desc&vote_count.gte=200' },
  ],
  // Action (28)
  28: [
    { name: 'Martial Arts Spectacles',           keywords: '1983',   extra: '&sort_by=popularity.desc' },
    { name: 'Military Action Films',             keywords: '1706',   extra: '&sort_by=vote_average.desc&vote_count.gte=300' },
  ],
  // Sci-Fi (878)
  878: [
    { name: 'Time Travel Stories',               keywords: '4379',   extra: '&sort_by=vote_average.desc&vote_count.gte=300' },
    { name: 'Dystopian Futures',                 keywords: '1562',   extra: '&sort_by=popularity.desc' },
    { name: 'Space Exploration',                 keywords: '9882',   extra: '&sort_by=vote_count.desc' },
  ],
  // Drama (18)
  18: [
    { name: 'Based on a True Story',             keywords: '10683',  extra: '&sort_by=vote_average.desc&vote_count.gte=500' },
    { name: 'Family Drama Worth Your Time',       keywords: '4430',   extra: '&sort_by=popularity.desc' },
  ],
  // Romance (10749)
  10749: [
    { name: 'Forbidden Romance',                 keywords: '14564',  extra: '&sort_by=vote_average.desc&vote_count.gte=200' },
    { name: 'Romantic Comedies That Stick',      keywords: '9799',   extra: '&sort_by=popularity.desc' },
  ],
  // Animation (16)
  16: [
    { name: 'Anime That Crosses Over',           keywords: '210024', extra: '&sort_by=popularity.desc' },
    { name: 'Animation for Grown-Ups',           keywords: '10683',  extra: '&sort_by=vote_average.desc&vote_count.gte=300' },
  ],
  // Documentary (99)
  99: [
    { name: 'True Crime Docs',                   keywords: '10084',  extra: '&sort_by=popularity.desc' },
    { name: 'Nature & Wildlife Docs',            keywords: '11170',  extra: '&sort_by=vote_average.desc&vote_count.gte=100' },
    { name: 'Music Documentary',                 keywords: '1954',   extra: '&sort_by=vote_count.desc' },
  ],
  // TV Action & Adventure (10759)
  10759: [
    { name: 'Superhero Series',                  keywords: '9715',   extra: '&sort_by=popularity.desc' },
    { name: 'Survival Series',                   keywords: '10683',  extra: '&sort_by=vote_average.desc&vote_count.gte=200' },
  ],
  // TV Sci-Fi & Fantasy (10765)
  10765: [
    { name: 'Alternate Universe Series',         keywords: '4379',   extra: '&sort_by=popularity.desc' },
    { name: 'Epic Fantasy Series',               keywords: '1562',   extra: '&sort_by=vote_average.desc&vote_count.gte=200' },
  ],
  // Mystery (9648)
  9648: [
    { name: 'Whodunit Mysteries',                keywords: '10596',  extra: '&sort_by=vote_average.desc&vote_count.gte=200' },
    { name: 'Detective Series Worth Obsessing Over', keywords: '10084', extra: '&sort_by=popularity.desc' },
  ],
};

// ─── Genre name lookup ────────────────────────────────────────────────────────

const GENRE_NAMES: Record<number, string> = {
  28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy', 80: 'Crime',
  99: 'Documentary', 18: 'Drama', 10751: 'Family', 14: 'Fantasy', 36: 'History',
  27: 'Horror', 10402: 'Music', 9648: 'Mystery', 10749: 'Romance', 878: 'Science Fiction',
  53: 'Thriller', 10752: 'War', 37: 'Western',
  // TV genres
  10759: 'Action & Adventure', 10765: 'Sci-Fi & Fantasy', 10768: 'War & Politics',
  10764: 'Reality', 10763: 'News', 10766: 'Soap', 10767: 'Talk', 10762: 'Kids',
};

// ─── Helper: splice a Top-10 row ──────────────────────────────────────────────
const insertTop10 = (
  manifest: SmartRow[],
  key: string,
  title: string,
  fetchUrl: string,
  preferredIndex: number,
) => {
  manifest.splice(Math.min(manifest.length, preferredIndex), 0, {
    key, title, fetchUrl, type: 'top10',
  });
};

// ─── useDynamicManifest ───────────────────────────────────────────────────────
export const useDynamicManifest = (
  pageType: 'home' | 'movie' | 'tv' | 'new_popular',
  selectedGenreId?: number,
) => {
  const { t } = useTranslation();
  const {
    continueWatching, myList, user,
    getLikedMovies, clearSeenIds,
    getVideoState, getLastWatchedEpisode,
  } = useGlobalContext();

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    clearSeenIds();
    // Premium transition delay: ensures skeleton is visible long enough to be useful
    setIsLoading(true);
    const timer = setTimeout(() => setIsLoading(false), 400);
    return () => clearTimeout(timer);
  }, [pageType, selectedGenreId, clearSeenIds]);

  const rows = useMemo<SmartRow[]>(() => {
    const manifest: SmartRow[] = [];
    const usedUrls = new Set<string>(); // URL-signature dedup registry

    const addRow = (row: SmartRow): boolean => {
      if (row.fetchUrl) {
        const sig = makeUrlSig(row.fetchUrl);
        if (usedUrls.has(sig)) return false;
        usedUrls.add(sig);
      }
      manifest.push(row);
      return true;
    };

    const hash    = getDailyHash();
    const day     = getDayOfWeek();
    const tod     = getTimeSlot();
    const season  = getSeason();
    const holiday = getCurrentHoliday();
    const year    = new Date().getFullYear();

    // ── 1. COMFORT ROWS ───────────────────────────────────────────────────────
    let continueWatchingRow: SmartRow | null = null;
    let myListRow: SmartRow | null = null;

    if (continueWatching.length > 0) {
      const activelyWatching = continueWatching.filter(m => {
        const wd = getWatchData(m, getLastWatchedEpisode, getVideoState);
        return wd.pct >= 5;
      });
      const filtered = selectedGenreId
        ? activelyWatching.filter(m => m.genre_ids?.includes(selectedGenreId))
        : activelyWatching;
      if (filtered.length > 0) {
        const title = user?.display_name
          ? t('rows.continueWatchingUser', { name: user.display_name, defaultValue: `Here's Where You Left Off, ${user.display_name}` })
          : t('rows.continueWatching', { defaultValue: "Here's Where You Left Off" });
        continueWatchingRow = { key: 'continue-watching', title, data: filtered };
      }
    }

    if (myList.length > 0) {
      let filteredList = myList;
      if (pageType === 'tv')    filteredList = myList.filter(m => m.media_type === 'tv' || (!m.media_type && !m.title));
      if (pageType === 'movie') filteredList = myList.filter(m => m.media_type === 'movie' || (!m.media_type && !!m.title));
      if (selectedGenreId)      filteredList = filteredList.filter(m => m.genre_ids?.includes(selectedGenreId));
      if (filteredList.length > 0)
        myListRow = { key: 'my-list', title: t('rows.myList', { defaultValue: 'My List' }), data: filteredList };
    }

    // ── 2. NEW & POPULAR PAGE ─────────────────────────────────────────────────
    if (pageType === 'new_popular') {
      manifest.push({ key: 'top10-movies',   title: 'Top 10 Films in the UK Today',     fetchUrl: REQUESTS.fetchTrendingMovies,  type: 'top10' });
      manifest.push({ key: 'top10-tv',       title: 'Top 10 Series in the UK Today',    fetchUrl: REQUESTS.fetchTrendingTV,      type: 'top10' });
      manifest.push({ key: 'new-releases',   title: 'Newly Added to the Collection',    fetchUrl: REQUESTS.fetchNewReleases });
      manifest.push({ key: 'worth-wait',     title: 'Worth the Wait',                   fetchUrl: REQUESTS.fetchUpcoming + '&page=2' });
      manifest.push({ key: 'rising-stars',   title: 'Rising Stars: Under the Radar',    fetchUrl: REQUESTS.fetchByGenre('movie', 28, 'vote_average.desc') + '&vote_count.gte=100&vote_count.lte=1000' });
      manifest.push({ key: 'new-this-year',  title: `The Best of ${year} So Far`,        fetchUrl: REQUESTS.fetchByGenre('movie', 18, 'vote_average.desc') + `&release_date.gte=${year}-01-01&vote_count.gte=50` });
      manifest.push({ key: 'new-tv-year',    title: `New Series Everyone Is Watching`,  fetchUrl: REQUESTS.fetchByGenre('tv', 18, 'vote_average.desc') + `&first_air_date.gte=${year}-01-01&vote_count.gte=30` });
      manifest.push({ key: 'internet-buzz',  title: "The Shows the Internet Can't Stop Talking About", fetchUrl: REQUESTS.fetchTrendingTV + '&page=2' });
      manifest.push({ key: 'films-buzz',     title: 'The Films Everyone Is Discussing', fetchUrl: REQUESTS.fetchTrendingMovies + '&page=2' });
      manifest.push({ key: 'np-upcoming',    title: 'Coming to the Collection Soon',    fetchUrl: REQUESTS.fetchUpcoming });
      manifest.push({ key: 'np-acclaimed',   title: 'New and Acclaimed',                fetchUrl: REQUESTS.fetchByGenre('movie', 18, 'vote_average.desc') + `&release_date.gte=${year - 1}-01-01&vote_count.gte=300` });
      manifest.push({ key: 'np-series-new',  title: 'Series Picking Up Steam',          fetchUrl: REQUESTS.fetchByGenre('tv', 10765, 'popularity.desc') + `&first_air_date.gte=${year - 1}-01-01` });
      manifest.push({ key: 'np-drama-new',   title: 'New Dramas With Something to Say', fetchUrl: REQUESTS.fetchByGenre('tv', 18, 'popularity.desc') + `&first_air_date.gte=${year}-01-01` });
      manifest.push({ key: 'np-hidden',      title: 'Flying Under the Radar',           fetchUrl: REQUESTS.fetchByGenre('movie', 18, 'vote_average.desc') + '&vote_count.gte=100&vote_count.lte=800' });
      manifest.push({ key: 'np-intl',        title: 'International Discoveries',        fetchUrl: REQUESTS.fetchByGenre('movie', 18, 'popularity.desc') + '&without_original_language=en' });
      return manifest;
    }

    // ── 3. GENRE-FILTERED VIEWS ───────────────────────────────────────────────
    if (selectedGenreId) {
      const mainGenreName = GENRE_NAMES[selectedGenreId] ?? GENRES[selectedGenreId] ?? 'Content';
      const mediaType     = pageType as 'movie' | 'tv';

      // Helper: build a row with URL-sig dedup built in
      const gRow = (key: string, title: string, sort: string, extra = ''): SmartRow | null => {
        const url = REQUESTS.fetchByGenre(mediaType, selectedGenreId, sort) + extra;
        const sig = makeUrlSig(url);
        if (usedUrls.has(sig)) return null;
        usedUrls.add(sig);
        return { key, title, fetchUrl: url };
      };

      // ── Tier 1: Top-10 & Trending ──────────────────────────────────────────
      const top10GRow: SmartRow = {
        key:      `top10-genre-${selectedGenreId}`,
        title:    `Top 10 ${mainGenreName} Right Now`,
        fetchUrl: REQUESTS.fetchByGenre(mediaType, selectedGenreId, 'popularity.desc'),
        type:     'top10',
      };
      usedUrls.add(makeUrlSig(top10GRow.fetchUrl!));
      manifest.push(top10GRow);

      // ── Tier 2: Dimension-based rows (guaranteed unique URLs via page + sort) ─
      const dimensionRows: (SmartRow | null)[] = [
        gRow(`genre-p2-${selectedGenreId}`,       `More ${mainGenreName} to Discover`,              'popularity.desc', '&page=2'),
        gRow(`genre-acclaimed-${selectedGenreId}`, `The Best ${mainGenreName} Ever Made`,            'vote_average.desc', '&vote_count.gte=2000'),
        gRow(`genre-cult-${selectedGenreId}`,      `${mainGenreName} With a Cult Following`,         'vote_count.desc', ''),
        gRow(`genre-hidden-${selectedGenreId}`,    `Hidden ${mainGenreName} Gems`,                   'vote_average.desc', '&vote_count.gte=150&vote_count.lte=1500'),
        gRow(`genre-2020s-${selectedGenreId}`,     `Best ${mainGenreName} of the 2020s`,             'vote_average.desc', '&release_date.gte=2020-01-01&vote_count.gte=100'),
        gRow(`genre-2010s-${selectedGenreId}`,     `${mainGenreName} That Defined the 2010s`,        'vote_average.desc', '&release_date.gte=2010-01-01&release_date.lte=2019-12-31&vote_count.gte=500'),
        gRow(`genre-classics-${selectedGenreId}`,  `${mainGenreName} Classics`,                      'vote_average.desc', '&release_date.lte=2009-12-31&vote_count.gte=1000'),
        gRow(`genre-intl-${selectedGenreId}`,      `International ${mainGenreName}`,                 'popularity.desc', '&without_original_language=en'),
        gRow(`genre-british-${selectedGenreId}`,   `British ${mainGenreName}`,                       'popularity.desc', '&with_origin_country=GB'),
        gRow(`genre-korean-${selectedGenreId}`,    `Korean ${mainGenreName}`,                        'popularity.desc', '&with_origin_country=KR'),
        gRow(`genre-recent-${selectedGenreId}`,    `Brand New ${mainGenreName}`,                     pageType === 'tv' ? 'first_air_date.desc' : 'release_date.desc', '&vote_count.gte=20'),
        gRow(`genre-deep3-${selectedGenreId}`,     `${mainGenreName}: Deeper Cuts`,                  'popularity.desc', '&page=3'),
        gRow(`genre-deep4-${selectedGenreId}`,     `More ${mainGenreName} You\'ll Love`,             'popularity.desc', '&page=4'),
        gRow(`genre-legends-${selectedGenreId}`,   `${mainGenreName}: The All-Time Greats`,          'vote_count.desc', '&vote_average.gte=7.5'),
        gRow(`genre-sleeper-${selectedGenreId}`,   `Sleeper Hits: ${mainGenreName} Nobody Talks About`, 'vote_average.desc', '&vote_count.gte=80&vote_count.lte=500'),
        gRow(`genre-modern-${selectedGenreId}`,    `Modern ${mainGenreName} Worth Your Time`,        'vote_average.desc', '&release_date.gte=2018-01-01&vote_count.gte=300'),
        gRow(`genre-year-${selectedGenreId}`,      `Best ${mainGenreName} of ${year}`,               'vote_average.desc', `&release_date.gte=${year}-01-01&vote_count.gte=30`),
      ];

      dimensionRows.forEach(r => r && manifest.push(r));

      // ── Tier 3: Genre-specific keyword rows (truly different content) ────────
      const keywordRows = GENRE_KEYWORD_ROWS[selectedGenreId] || [];
      keywordRows.forEach((kr, i) => {
        const url = REQUESTS.fetchByGenre(mediaType, selectedGenreId, 'popularity.desc')
          + `&with_keywords=${kr.keywords}` + (kr.extra || '');
        const sig = makeUrlSig(url);
        if (!usedUrls.has(sig)) {
          usedUrls.add(sig);
          manifest.push({ key: `kw-${selectedGenreId}-${i}`, title: kr.name, fetchUrl: url });
        }
      });

      // ── Tier 4: Adjacent micro-genre rows ────────────────────────────────────
      // Genres adjacent to the selected one can appear (at low density) so
      // e.g. Drama filter still sees some Mystery and Crime micro-rows — but never Action.
      const adjacentIds  = ADJACENT_GENRES[selectedGenreId] || [];
      const relevantMicro = MICRO_GENRES.filter(m => {
        if (pageType !== 'home' && m.type !== pageType) return false;
        const mIds = m.genres.split(',').map(Number).filter(Boolean);
        return mIds.includes(selectedGenreId) || adjacentIds.some(a => mIds.includes(a));
      });
      // Primary genre micro-rows: up to 6
      const primaryMicro = relevantMicro.filter(m => {
        const mIds = m.genres.split(',').map(Number).filter(Boolean);
        return mIds.includes(selectedGenreId);
      });
      const adjacentMicro = relevantMicro.filter(m => {
        const mIds = m.genres.split(',').map(Number).filter(Boolean);
        return !mIds.includes(selectedGenreId) && adjacentIds.some(a => mIds.includes(a));
      });

      const microPrimary  = seededPick(primaryMicro, 6, hash + selectedGenreId);
      const microAdjacent = seededPick(adjacentMicro, 3, hash + selectedGenreId + 1);

      [...microPrimary, ...microAdjacent].forEach((m, i) => {
        const url = REQUESTS.fetchMicroGenre(m.type, m.genres, m.extra);
        const sig = makeUrlSig(url);
        if (!usedUrls.has(sig)) {
          usedUrls.add(sig);
          manifest.push({ key: `micro-genre-${selectedGenreId}-${i}`, title: m.name, fetchUrl: url });
        }
      });

      // ── Safety fill: ensure at least 18 rows ──────────────────────────────
      for (let i = 0; manifest.length < 18; i++) {
        const url = REQUESTS.fetchByGenre(mediaType, selectedGenreId, 'popularity.desc') + `&page=${8 + i}`;
        const sig = makeUrlSig(url);
        if (!usedUrls.has(sig)) {
          usedUrls.add(sig);
          manifest.push({ key: `fill-${selectedGenreId}-${i}`, title: `Discover More ${mainGenreName}`, fetchUrl: url });
        } else { break; } // avoid infinite loop
      }

      // Inject a Top-10 row mid-way through for visual rhythm
      insertTop10(
        manifest,
        `top10-mid-${selectedGenreId}`,
        `Top 10 ${mainGenreName} Series Right Now`,
        REQUESTS.fetchByGenre('tv', selectedGenreId, 'popularity.desc') + '&page=2',
        Math.min(manifest.length, 8),
      );

      return manifest;
    }

    // ── 4. STANDARD HUBS ─────────────────────────────────────────────────────

    // 4a. Holiday rows (highest contextual priority)
    if (holiday && HOLIDAY_STREAMS[holiday]) {
      const holidayRows = HOLIDAY_STREAMS[holiday];
      const picked = seededPick(
        holidayRows.filter(m => pageType === 'home' || m.type === pageType),
        Math.min(2, holidayRows.length),
        hash,
      );
      picked.forEach((m, i) => {
        const url = REQUESTS.fetchMicroGenre(m.type, m.genres, m.extra);
        addRow({ key: `holiday-${holiday}-${i}`, title: m.name, fetchUrl: url });
      });
    }

    // 4b. Time-of-day row
    if (TIME_STREAMS[tod]) {
      const todRows = TIME_STREAMS[tod].filter(m => pageType === 'home' || m.type === pageType);
      if (todRows.length > 0) {
        const picked = todRows[hash % todRows.length];
        addRow({ key: `tod-${tod}`, title: picked.name, fetchUrl: REQUESTS.fetchMicroGenre(picked.type, picked.genres, picked.extra) });
      }
    }

    // 4c. Day-of-week themed row
    const themed = DAY_STREAMS[day];
    if (themed && (pageType === 'home' || themed.type === pageType)) {
      let finalName   = themed.name;
      let finalGenres = themed.genres;
      if (themed.name.includes('|')) {
        const names         = themed.name.split('|');
        const genreSegments = themed.genres.split('|');
        const idx           = hash % names.length;
        finalName           = names[idx]         || names[0];
        finalGenres         = genreSegments[idx] || genreSegments[0] || themed.genres;
      }
      addRow({ key: `day-theme-${day}`, title: finalName, fetchUrl: REQUESTS.fetchMicroGenre(themed.type, finalGenres, themed.extra) });
    }

    // 4d. Seasonal rows (1–2)
    if (SEASON_STREAMS[season]) {
      const seasonRows = SEASON_STREAMS[season].filter(m => pageType === 'home' || m.type === pageType);
      seededPick(seasonRows, Math.min(2, seasonRows.length), hash + 7).forEach((m, i) => {
        addRow({ key: `season-${season}-${i}`, title: m.name, fetchUrl: REQUESTS.fetchMicroGenre(m.type, m.genres, m.extra) });
      });
    }

    // 4e. Page-type specific curated rows (home / movie / tv / new_popular)
    if (pageType === 'home') {
      addRow({ key: 'home-trending-all', title: 'Trending Now',               fetchUrl: REQUESTS.fetchTrending });
      addRow({ key: 'home-nf-originals', title: 'Netflix Originals',          fetchUrl: REQUESTS.fetchNetflixOriginals });
      addRow({ key: 'home-loved-movies', title: 'Critically Loved Films',     fetchUrl: REQUESTS.fetchLoveTheseMovies });
      addRow({ key: 'home-award-series', title: 'Award-Winning Series',       fetchUrl: REQUESTS.fetchAwardWinningSeries });
      addRow({ key: 'home-exciting',     title: 'High-Octane Action',         fetchUrl: REQUESTS.fetchExcitingMovies });
      addRow({ key: 'home-scifi',        title: 'Sci-Fi Worlds to Get Lost In', fetchUrl: REQUESTS.fetchSciFiMovies });
      addRow({ key: 'home-comedy',       title: 'Laugh-Out-Loud Comedies',    fetchUrl: REQUESTS.fetchComedyMovies });
      addRow({ key: 'home-binge-tv',     title: 'Impossible to Watch Just One Episode', fetchUrl: REQUESTS.fetchBoredomBustersTV });
      addRow({ key: 'home-drama',        title: 'Drama That Makes You Think', fetchUrl: REQUESTS.fetchCriticallyAcclaimedDrama });
      addRow({ key: 'home-crime',        title: 'Crime That Keeps You Guessing', fetchUrl: REQUESTS.fetchCrimeTV });
      addRow({ key: 'home-intl',         title: 'International Discoveries',  fetchUrl: REQUESTS.fetchByGenre('movie', 18, 'popularity.desc') + '&without_original_language=en' });
      addRow({ key: 'home-horror',       title: 'Horror for the Brave',       fetchUrl: REQUESTS.fetchHorrorMovies });
      addRow({ key: 'home-familiar',     title: 'Fan Favourites',             fetchUrl: REQUESTS.fetchFamiliarFavorites });
      addRow({ key: 'home-loved-tv',     title: 'Must-Watch Television',      fetchUrl: REQUESTS.fetchLoveTheseTV });
      addRow({ key: 'home-imaginative',  title: 'Genre-Bending Series',       fetchUrl: REQUESTS.fetchImaginativeSeries });
      addRow({ key: 'home-romance',      title: 'Romance Worth Staying Up For', fetchUrl: REQUESTS.fetchRomanceMovies });
      addRow({ key: 'home-toprated',     title: 'The All-Time Greats',        fetchUrl: REQUESTS.fetchTopRated });
      addRow({ key: 'home-us-series',    title: 'US Series Worth Your Time',  fetchUrl: REQUESTS.fetchUSSeries });
      addRow({ key: 'home-docs',         title: 'Documentaries That Change How You See the World', fetchUrl: REQUESTS.fetchDocumentaries });
      addRow({ key: 'home-family',       title: 'Family Nights Done Right',   fetchUrl: REQUESTS.fetchByGenre('movie', 10751, 'popularity.desc') });
      addRow({ key: 'home-exciting-tv',  title: 'High-Stakes Series',         fetchUrl: REQUESTS.fetchExcitingSeriesTV });
      addRow({ key: 'home-action-tv',    title: 'Action-Packed TV',           fetchUrl: REQUESTS.fetchActionTV });
      addRow({ key: 'home-korean',       title: 'K-Drama Fever',              fetchUrl: REQUESTS.fetchByGenre('tv', 18, 'popularity.desc') + '&with_origin_country=KR' });
      addRow({ key: 'home-anime',        title: 'Anime Worth the Hype',       fetchUrl: REQUESTS.fetchByGenre('tv', 16, 'popularity.desc') + '&with_origin_country=JP' });
    }

    if (pageType === 'movie') {
      addRow({ key: 'mv-trending',    title: 'Trending Films Right Now',         fetchUrl: REQUESTS.fetchTrendingMovies });
      addRow({ key: 'mv-exciting',    title: 'High-Octane Action Films',         fetchUrl: REQUESTS.fetchExcitingMovies });
      addRow({ key: 'mv-toprated',    title: 'The Films That Stood the Test of Time', fetchUrl: REQUESTS.fetchTopRated });
      addRow({ key: 'mv-scifi',       title: 'Sci-Fi Worlds to Get Lost In',     fetchUrl: REQUESTS.fetchSciFiMovies });
      addRow({ key: 'mv-drama',       title: 'Dramas That Leave a Mark',         fetchUrl: REQUESTS.fetchLoveTheseMovies });
      addRow({ key: 'mv-horror',      title: 'Horror That Haunts You',           fetchUrl: REQUESTS.fetchHorrorMovies });
      addRow({ key: 'mv-comedy',      title: 'Comedies You\'ll Actually Laugh At', fetchUrl: REQUESTS.fetchComedyMovies });
      addRow({ key: 'mv-romance',     title: 'Romance Done Right',               fetchUrl: REQUESTS.fetchRomanceMovies });
      addRow({ key: 'mv-action',      title: 'Pure Adrenaline',                  fetchUrl: REQUESTS.fetchActionMovies });
      addRow({ key: 'mv-docs',        title: 'Documentaries Worth Your Evening', fetchUrl: REQUESTS.fetchDocumentaries });
      addRow({ key: 'mv-buster',      title: 'Films for When You Can\'t Decide', fetchUrl: REQUESTS.fetchBoredomBustersMovies });
      addRow({ key: 'mv-fav',         title: 'Crowd Favourites',                 fetchUrl: REQUESTS.fetchFamiliarFavoritesMovies });
      addRow({ key: 'mv-intl',        title: 'International Cinema Worth Seeking Out', fetchUrl: REQUESTS.fetchByGenre('movie', 18, 'popularity.desc') + '&without_original_language=en' });
      addRow({ key: 'mv-animation',   title: 'Animation That Isn\'t Just for Kids', fetchUrl: REQUESTS.fetchByGenre('movie', 16, 'vote_average.desc') + '&vote_count.gte=500' });
      addRow({ key: 'mv-history',     title: 'History Brought to Life',          fetchUrl: REQUESTS.fetchByGenre('movie', 36, 'vote_average.desc') + '&vote_count.gte=300' });
      addRow({ key: 'mv-thriller',    title: 'Thrillers to Watch with the Lights On', fetchUrl: REQUESTS.fetchByGenre('movie', 53, 'popularity.desc') });
      addRow({ key: 'mv-family',      title: 'Family Films Everyone Enjoys',     fetchUrl: REQUESTS.fetchByGenre('movie', 10751, 'popularity.desc') });
      addRow({ key: 'mv-hidden',      title: 'Films Flying Under the Radar',     fetchUrl: REQUESTS.fetchByGenre('movie', 18, 'vote_average.desc') + '&vote_count.gte=100&vote_count.lte=1000' });
      addRow({ key: 'mv-korean',      title: 'Korean Cinema at Its Best',        fetchUrl: REQUESTS.fetchByGenre('movie', 18, 'popularity.desc') + '&with_origin_country=KR' });
      addRow({ key: 'mv-upcoming',    title: 'Coming Soon to the Collection',    fetchUrl: REQUESTS.fetchUpcoming });
      addRow({ key: 'mv-year',        title: `The Best Films of ${year}`,        fetchUrl: REQUESTS.fetchByGenre('movie', 18, 'vote_average.desc') + `&release_date.gte=${year}-01-01&vote_count.gte=50` });
      addRow({ key: 'mv-classics',    title: 'The Untouchable Film Classics',    fetchUrl: REQUESTS.fetchByGenre('movie', 18, 'vote_average.desc') + '&release_date.lte=2000-01-01&vote_count.gte=2000' });
    }

    if (pageType === 'tv') {
      addRow({ key: 'tv-trending',    title: 'Trending Series Right Now',        fetchUrl: REQUESTS.fetchTrendingTV });
      addRow({ key: 'tv-originals',   title: 'Netflix Originals',                fetchUrl: REQUESTS.fetchNetflixOriginals });
      addRow({ key: 'tv-award',       title: 'Award-Winning Series',             fetchUrl: REQUESTS.fetchAwardWinningSeries });
      addRow({ key: 'tv-crime',       title: 'Crime Series That Keep You Guessing', fetchUrl: REQUESTS.fetchCrimeTV });
      addRow({ key: 'tv-drama',       title: 'Drama Series With Depth',          fetchUrl: REQUESTS.fetchDramaTV });
      addRow({ key: 'tv-action',      title: 'Action & Adventure Series',        fetchUrl: REQUESTS.fetchActionTV });
      addRow({ key: 'tv-comedy',      title: 'Comedies That Never Get Old',      fetchUrl: REQUESTS.fetchComedyTV });
      addRow({ key: 'tv-binge',       title: 'Impossible to Watch Just One Episode', fetchUrl: REQUESTS.fetchBoredomBustersTV });
      addRow({ key: 'tv-scifi',       title: 'Sci-Fi & Fantasy Worlds',          fetchUrl: REQUESTS.fetchImaginativeSeries });
      addRow({ key: 'tv-loved',       title: 'Loved by Critics & Audiences Alike', fetchUrl: REQUESTS.fetchLoveTheseTV });
      addRow({ key: 'tv-reality',     title: 'Reality TV Worth Watching',        fetchUrl: REQUESTS.fetchRealityTV });
      addRow({ key: 'tv-us',          title: 'US Series Dominating Right Now',   fetchUrl: REQUESTS.fetchUSSeries });
      addRow({ key: 'tv-exciting',    title: 'High-Stakes Series',               fetchUrl: REQUESTS.fetchExcitingSeriesTV });
      addRow({ key: 'tv-docs',        title: 'Documentary Series That Change Minds', fetchUrl: REQUESTS.fetchDocumentaries });
      addRow({ key: 'tv-korean',      title: 'K-Drama: Where to Start',          fetchUrl: REQUESTS.fetchByGenre('tv', 18, 'popularity.desc') + '&with_origin_country=KR' });
      addRow({ key: 'tv-british',     title: 'British Series Worth the Accent',  fetchUrl: REQUESTS.fetchByGenre('tv', 18, 'popularity.desc') + '&with_origin_country=GB' });
      addRow({ key: 'tv-anime',       title: 'Anime Series Worth the Hype',      fetchUrl: REQUESTS.fetchByGenre('tv', 16, 'popularity.desc') + '&with_origin_country=JP' });
      addRow({ key: 'tv-family',      title: 'Family Series for All Ages',       fetchUrl: REQUESTS.fetchByGenre('tv', 10751, 'popularity.desc') });
      addRow({ key: 'tv-mystery',     title: 'Mystery Series: Every Episode a Puzzle', fetchUrl: REQUESTS.fetchByGenre('tv', 9648, 'popularity.desc') });
      addRow({ key: 'tv-hidden',      title: 'Hidden Gems: Series Nobody Told You About', fetchUrl: REQUESTS.fetchByGenre('tv', 18, 'vote_average.desc') + '&vote_count.gte=100&vote_count.lte=1000' });
      addRow({ key: 'tv-longrun',     title: 'Long-Running Series Worth Starting', fetchUrl: REQUESTS.fetchByGenre('tv', 18, 'vote_count.desc') + '&vote_average.gte=7' });
      addRow({ key: 'tv-limited',     title: 'Limited Series: One Weekend, Done', fetchUrl: REQUESTS.fetchByGenre('tv', 18, 'vote_average.desc') + '&vote_count.gte=200&page=2' });
      addRow({ key: 'tv-scifi2',      title: 'Sci-Fi Series That Make You Think', fetchUrl: REQUESTS.fetchByGenre('tv', 10765, 'vote_average.desc') + '&vote_count.gte=300' });
    }

    // 4f. Random micro-genre pool ("chocolate bag") — deduped against everything above
    const mediaPool    = MICRO_GENRES.filter(m => pageType === 'home' ? true : m.type === pageType);
    const alreadyAdded = new Set(manifest.map(r => r.title));
    const dedupedPool  = mediaPool.filter(m => !alreadyAdded.has(m.name));
    const chocolates   = seededPick(dedupedPool, 22, hash);

    chocolates.forEach((m, i) => {
      let extra = m.extra || '';
      if (!extra.includes('page=') && i > 8) extra += `&page=${Math.floor(i / 5) + 2}`;
      addRow({ key: `pouch-${i}`, title: m.name, fetchUrl: REQUESTS.fetchMicroGenre(m.type, m.genres, extra) });
    });

    // ── 5. TOP-10 ROW INJECTION ───────────────────────────────────────────────
    const top10Key    = pageType === 'tv' || (pageType === 'home' && hash % 2 === 0) ? 'top10-tv' : 'top10-movies';
    const top10Title  = top10Key === 'top10-tv' ? 'Top 10 Series in the UK Today' : 'Top 10 Films in the UK Today';
    const top10Url    = top10Key === 'top10-tv' ? REQUESTS.fetchTrendingTV : REQUESTS.fetchTrendingMovies;
    insertTop10(manifest, top10Key, top10Title, top10Url, Math.min(manifest.length, 4));

    // Secondary Top-10 (opposite type)
    const sec     = top10Key === 'top10-tv' ? { key: 'top10-movies-2', title: 'Top 10 Films in the UK Today', url: REQUESTS.fetchTrendingMovies } : { key: 'top10-tv-2', title: 'Top 10 Series in the UK Today', url: REQUESTS.fetchTrendingTV };
    insertTop10(manifest, sec.key, sec.title, sec.url, Math.min(manifest.length, 13));


    // ── 6. COMFORT ROWS INJECTION ─────────────────────────────────────────────
    if (continueWatchingRow) {
      const targetIndex = (continueWatchingRow.data?.length ?? 0) > 5 ? hash % 2 : (hash % 3) + 1;
      manifest.splice(Math.min(manifest.length, targetIndex), 0, continueWatchingRow);
    }
    if (myListRow) {
      const targetIndex = (myListRow.data?.length ?? 0) > 5 ? (hash + 1) % 2 : ((hash + 1) % 3) + 1;
      manifest.splice(Math.min(manifest.length, targetIndex), 0, myListRow);
    }

    return manifest;
  }, [pageType, selectedGenreId, continueWatching, myList, user, getLikedMovies, t]);

  return { rows, isLoading };
};