import { useMemo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Movie } from '../types';
import { useGlobalContext } from '../context/GlobalContext';
import { REQUESTS } from '../constants';
import { getWatchData } from '../components/MovieCardBadges';
import {
  buildHomeGenreManifest,
  buildMovieSubpageManifest,
  buildTvSubpageManifest,
} from './genreManifestBuilder';
import { HeroEngine } from '../services/HeroEngine';
import { isUrlCached, fetchData } from '../services/api';

// Re-export context helpers from HeroEngine so both systems share the same logic
export { getTimeSlot, getSeason, getCurrentHoliday } from '../services/HeroEngine';

export interface SmartRow {
  key: string;
  title: string;
  fetchUrl?: string;
  data?: Movie[];
  type?: 'standard' | 'top10';
}

// ─── Deterministic Helpers ────────────────────────────────────────────────────

const getDailyHash = (): number => {
  const now = new Date();
  const dateStr = now.toDateString();
  const segment = Math.floor(now.getHours() / 4); // Shuffles every 4 hours
  const key = `${dateStr}_segment_${segment}`;
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return Math.abs(h);
};

const makeUrlSig = (url: string): string => {
  try {
    const [base, qs = ''] = url.split('?');
    const params = qs.split('&').filter(Boolean).sort();
    return base + '?' + params.join('&');
  } catch { return url; }
};

// Cache to track which page/genre combinations have already been visited to skip skeletons on revisit
const visitedCache = new Set<string>();

// Deterministic in-place shuffle using a numeric seed
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    // LCG-style permutation — deterministic for the same seed
    const j = Math.abs((seed * (i + 1) * 2654435761) | 0) % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// CW: random position 1–3; my-list: fixed row 5; top10: random after row 7, not last; total: 22–26
function capAndShuffle(rows: SmartRow[], hash: number): SmartRow[] {
  const cwRow     = rows.find(r => r.key === 'continue-watching');
  const myListRow = rows.find(r => r.key === 'my-list');
  const top10     = rows.filter(r => r.type === 'top10');
  const rest      = rows.filter(r => r.key !== 'continue-watching' && r.key !== 'my-list' && r.type !== 'top10');
  const shuffled  = seededShuffle(rest, hash);

  // Total rows: 22–26 (use high bits of hash to avoid correlation with the shuffle seed)
  const total  = 22 + ((hash >>> 16) % 5);
  const budget = total - (cwRow ? 1 : 0) - (myListRow ? 1 : 0) - top10.length;
  let base: SmartRow[] = shuffled.slice(0, Math.max(0, budget));

  // Insert CW at row 1, 2, or 3 (index 0, 1, or 2)
  if (cwRow) {
    const at = Math.min((hash >> 2) % 3, base.length);
    base = [...base.slice(0, at), cwRow, ...base.slice(at)];
  }

  // Insert my-list at row 5 (index 4)
  if (myListRow) {
    const at = Math.min(4, base.length);
    base = [...base.slice(0, at), myListRow, ...base.slice(at)];
  }

  // Insert each top10 row randomly: after row 7 (index ≥ 6), but not at the very last slot
  for (let i = 0; i < top10.length; i++) {
    const minAt = Math.min(6, base.length);
    const maxAt = Math.max(minAt, base.length - 1); // one before the end
    const range = maxAt - minAt;
    const at    = range <= 0 ? minAt : minAt + (Math.abs((hash * (i + 9) * 1664525) | 0) % (range + 1));
    base = [...base.slice(0, at), top10[i], ...base.slice(at)];
  }

  return base;
}

// ─── useDynamicManifest ───────────────────────────────────────────────────────
export const useDynamicManifest = (
  pageType: 'home' | 'movie' | 'tv' | 'new_popular',
  selectedGenreId?: number,
  selectedGenreName?: string,
) => {
  const { t } = useTranslation();
  const {
    continueWatching, myList, user,
    getLikedMovies, clearSeenIds,
    getVideoState, getLastWatchedEpisode,
  } = useGlobalContext();

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

    const hash = getDailyHash();
    const year = new Date().getFullYear();

    // ── 1. COMFORT ROWS ───────────────────────────────────────────────────────
    let continueWatchingRow: SmartRow | null = null;
    let myListRow: SmartRow | null = null;

    if (continueWatching.length > 0) {
      const activelyWatching = continueWatching.filter(m => {
        const wd = getWatchData(m, getLastWatchedEpisode, getVideoState);
        return wd.pct >= 1 && wd.pct < 92;
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
      // Full pool — everything shuffled together daily
      const npPool: SmartRow[] = [
        { key: 'top10-movies', title: 'Top 10 Films in the UK Today',  fetchUrl: REQUESTS.fetchTrendingMovies, type: 'top10' },
        { key: 'top10-tv',     title: 'Top 10 Series in the UK Today', fetchUrl: REQUESTS.fetchTrendingTV,     type: 'top10' },
        { key: 'new-releases',  title: 'Newly Added to the Collection',           fetchUrl: REQUESTS.fetchNewReleases },
        { key: 'worth-wait',    title: 'Worth the Wait',                           fetchUrl: REQUESTS.fetchUpcoming + '&page=2' },
        { key: 'rising-stars',  title: 'Rising Stars: Under the Radar',            fetchUrl: REQUESTS.fetchByGenre('movie', 28, 'vote_average.desc', '&vote_count.gte=25&vote_count.lte=250') },
        { key: 'new-this-year', title: `The Best of ${year} So Far`,               fetchUrl: REQUESTS.fetchByGenre('movie', 18, 'vote_average.desc', `&release_date.gte=${year}-01-01&vote_count.gte=12`) },
        { key: 'new-tv-year',   title: 'New Series Everyone Is Watching',          fetchUrl: REQUESTS.fetchByGenre('tv', 18, 'vote_average.desc', `&first_air_date.gte=${year}-01-01&vote_count.gte=8`) },
        { key: 'internet-buzz', title: "The Shows the Internet Can't Stop Talking About", fetchUrl: REQUESTS.fetchTrendingTV + '&page=2' },
        { key: 'films-buzz',    title: 'The Films Everyone Is Discussing',         fetchUrl: REQUESTS.fetchTrendingMovies + '&page=2' },
        { key: 'np-upcoming',   title: 'Coming to the Collection Soon',            fetchUrl: REQUESTS.fetchUpcoming },
        { key: 'np-acclaimed',  title: 'New and Acclaimed',                        fetchUrl: REQUESTS.fetchByGenre('movie', 18, 'vote_average.desc', `&release_date.gte=${year - 1}-01-01&vote_count.gte=80`) },
        { key: 'np-series-new', title: 'Series Picking Up Steam',                  fetchUrl: REQUESTS.fetchByGenre('tv', 10765, 'popularity.desc', `&first_air_date.gte=${year - 1}-01-01`) },
        { key: 'np-drama-new',  title: 'New Dramas With Something to Say',         fetchUrl: REQUESTS.fetchByGenre('tv', 18, 'popularity.desc', `&first_air_date.gte=${year}-01-01`) },
        { key: 'np-hidden',     title: 'Flying Under the Radar',                   fetchUrl: REQUESTS.fetchByGenre('movie', 18, 'vote_average.desc', '&vote_count.gte=25&vote_count.lte=200') },
        { key: 'np-intl',       title: 'International Discoveries',                fetchUrl: REQUESTS.fetchByGenre('movie', 18, 'popularity.desc') + '&without_original_language=en' },
      ];

      // Genre spotlight pool — 1 or 2 appear daily, picked by hash
      const spotlightPool: SmartRow[] = [
        { key: 'spot-action',    title: 'Top in Action',       fetchUrl: REQUESTS.fetchByGenre('movie', 28, 'popularity.desc') },
        { key: 'spot-comedy',    title: 'Top in Comedy',       fetchUrl: REQUESTS.fetchByGenre('movie', 35, 'popularity.desc') },
        { key: 'spot-thriller',  title: 'Top in Thriller',     fetchUrl: REQUESTS.fetchByGenre('movie', 53, 'popularity.desc') },
        { key: 'spot-horror',    title: 'Top in Horror',       fetchUrl: REQUESTS.fetchByGenre('movie', 27, 'popularity.desc') },
        { key: 'spot-scifi',     title: 'Top in Sci-Fi',       fetchUrl: REQUESTS.fetchByGenre('movie', 878, 'popularity.desc') },
        { key: 'spot-crime',     title: 'Top in Crime',        fetchUrl: REQUESTS.fetchByGenre('movie', 80, 'popularity.desc') },
        { key: 'spot-animation', title: 'Top in Animation',    fetchUrl: REQUESTS.fetchByGenre('tv', 16, 'popularity.desc') },
        { key: 'spot-romance',   title: 'Top in Romance',      fetchUrl: REQUESTS.fetchByGenre('movie', 10749, 'popularity.desc') },
        { key: 'spot-adventure', title: 'Top in Adventure',    fetchUrl: REQUESTS.fetchByGenre('movie', 12, 'popularity.desc') },
        { key: 'spot-mystery',   title: 'Top in Mystery',      fetchUrl: REQUESTS.fetchByGenre('movie', 9648, 'popularity.desc') },
        { key: 'spot-fantasy',   title: 'Top in Fantasy',      fetchUrl: REQUESTS.fetchByGenre('movie', 14, 'popularity.desc') },
        { key: 'spot-drama-tv',  title: 'Top Drama Series',    fetchUrl: REQUESTS.fetchByGenre('tv', 18, 'popularity.desc') },
      ];

      // Shuffle everything daily
      const shuffled = seededShuffle(npPool, hash);

      // Pick 1 spotlight most days, 2 on roughly every third day
      const spotCount = (hash % 3 === 0) ? 2 : 1;
      const pickedSpotlights = seededShuffle(spotlightPool, hash ^ 0x9e3779b9).slice(0, spotCount);

      // Insert spotlights at varied positions within the shuffled pool
      const result = [...shuffled];
      const pos1 = 2 + (hash % 3);
      result.splice(Math.min(pos1, result.length), 0, pickedSpotlights[0]);
      if (spotCount === 2) {
        const pos2 = 8 + ((hash >> 4) % 3);
        result.splice(Math.min(pos2, result.length), 0, pickedSpotlights[1]);
      }

      return result;
    }

    // ── 3. DYNAMIC HOME MANIFEST & PERSONALIZATION ENGINE ─────────────────────
    if (pageType === 'home') {
      buildHomeGenreManifest({
        manifest,
        selectedGenreId,
        selectedGenreName,
        usedUrls,
        hash,
        year,
        addRow,
        continueWatching,
        myList,
        likedEntries: getLikedMovies(),
        continueWatchingRow,
        myListRow,
      });

      return capAndShuffle(manifest, hash);
    }

    // ── 4. MOVIE SUBPAGE PERSONALIZATION ENGINE ───────────────────────────────
    if (pageType === 'movie') {
      buildMovieSubpageManifest({
        manifest,
        selectedGenreId,
        selectedGenreName,
        usedUrls,
        hash,
        year,
        addRow,
        continueWatching,
        myList,
        likedEntries: getLikedMovies(),
        continueWatchingRow,
        myListRow,
      });

      return capAndShuffle(manifest, hash);
    }

    // ── 5. TV SUBPAGE PERSONALIZATION ENGINE ──────────────────────────────────
    if (pageType === 'tv') {
      buildTvSubpageManifest({
        manifest,
        selectedGenreId,
        selectedGenreName,
        usedUrls,
        hash,
        year,
        addRow,
        continueWatching,
        myList,
        likedEntries: getLikedMovies(),
        continueWatchingRow,
        myListRow,
      });

      return capAndShuffle(manifest, hash);
    }

    return manifest;
  }, [pageType, selectedGenreId, selectedGenreName, continueWatching, myList, user, getLikedMovies, t]);

  // Prefetch ALL rows (page 1 + page 2) at manifest-build time so Row components
  // join in-flight requests instead of starting new ones when they mount.
  // Also kick off background hero fetches for all page types so switching pages is instant.
  useEffect(() => {
    rows.forEach(row => {
      if (!row.fetchUrl) return;
      fetchData(row.fetchUrl);
      const p2 = row.fetchUrl.includes('page=')
        ? row.fetchUrl.replace(/page=\d+/, 'page=2')
        : `${row.fetchUrl}${row.fetchUrl.includes('?') ? '&' : '?'}page=2`;
      fetchData(p2);
    });
    HeroEngine.prefetchAll();
  }, [rows]);

  const cacheKey = `${pageType}-${selectedGenreId || 'all'}`;
  const alreadyVisited = useMemo(() => visitedCache.has(cacheKey), [cacheKey]);

  // Synchronously verify if hero and the first 3 rows' API responses are already cached
  const isDataCached = useMemo(() => {
    // 1. Check if Hero is cached
    const heroCacheKey = selectedGenreId ? `${pageType}_${selectedGenreId}` : pageType;
    const heroCached = HeroEngine.getCachedHero(heroCacheKey);
    if (!heroCached) return false;

    // 2. Check if first 3 rows with fetchUrls are cached
    const rowsWithUrls = rows.filter(r => r.fetchUrl);
    const checkCount = Math.min(rowsWithUrls.length, 3);
    for (let i = 0; i < checkCount; i++) {
      if (!isUrlCached(rowsWithUrls[i].fetchUrl!)) {
        return false;
      }
    }
    return true;
  }, [rows, pageType, selectedGenreId]);

  const skipSkeleton = alreadyVisited || isDataCached;

  // Track last committed cacheKey in state so isLoading is true SYNCHRONOUSLY when
  // the genre changes — prevents a one-frame flash of stale rows before the effect fires.
  const [committedCacheKey, setCommittedCacheKey] = useState<string>(cacheKey);
  const [rawLoading, setRawLoading] = useState<boolean>(!skipSkeleton);

  // isLoading is true when either the key hasn't been committed yet OR raw loading flag is set
  const isLoading = committedCacheKey !== cacheKey || rawLoading;

  useEffect(() => {
    clearSeenIds();
    if (!skipSkeleton) {
      setRawLoading(true);
      const timer = setTimeout(() => {
        visitedCache.add(cacheKey);
        setCommittedCacheKey(cacheKey);
        setRawLoading(false);
      }, 400);
      return () => clearTimeout(timer);
    } else {
      visitedCache.add(cacheKey);
      setCommittedCacheKey(cacheKey);
      setRawLoading(false);
    }
  }, [pageType, selectedGenreId, clearSeenIds, cacheKey, skipSkeleton]);

  return { rows, isLoading };
};