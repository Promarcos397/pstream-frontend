import { useMemo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Movie } from '../types';
import { useGlobalContext } from '../context/GlobalContext';
import { REQUESTS } from '../constants';
import { resolveGenreId } from '../data/pageGenres';
import { getWatchData } from '../components/MovieCardBadges';
import {
  buildHomeGenreManifest,
  buildMovieSubpageManifest,
  buildTvSubpageManifest,
} from './genreManifestBuilder';
import { buildKidsManifest } from './kidsManifestBuilder';
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

/** Personalized rows must never fall out of the daily budget slice. */
const isPersonalRow = (r: SmartRow) =>
  r.key.includes('-personal-') || r.key.startsWith('top-picks');

// CW: random position 1–3; my-list: fixed row 5; personalized rows guaranteed
// at a 3/7/11/15… rhythm; taste-matched rows favored for the budget cut;
// top10: random after row 7, not last; total: 22–26
function capAndShuffle(rows: SmartRow[], hash: number, tasteNames: string[] = []): SmartRow[] {
  const cwRow     = rows.find(r => r.key === 'continue-watching');
  const myListRow = rows.find(r => r.key === 'my-list');
  const top10     = rows.filter(r => r.type === 'top10');
  const personal  = rows.filter(r => r.key !== 'continue-watching' && r.key !== 'my-list' && r.type !== 'top10' && isPersonalRow(r));
  const rest      = rows.filter(r => r.key !== 'continue-watching' && r.key !== 'my-list' && r.type !== 'top10' && !isPersonalRow(r));
  const shuffled  = seededShuffle(rest, hash);

  // Total rows: 22–26 (use high bits of hash to avoid correlation with the shuffle seed)
  const total  = 22 + ((hash >>> 16) % 5);
  const budget = total - (cwRow ? 1 : 0) - (myListRow ? 1 : 0) - top10.length - personal.length;

  // Taste boost: up to a third of the budget goes to rows matching the
  // profile's top genres, so the daily cut always reflects actual taste
  // instead of pure chance.
  let picked: SmartRow[];
  if (tasteNames.length > 0 && budget > 0) {
    const matchesTaste = (r: SmartRow) => tasteNames.some(n => r.title.includes(n));
    const boosted   = shuffled.filter(matchesTaste);
    const unboosted = shuffled.filter(r => !matchesTaste(r));
    const boostKeep = boosted.slice(0, Math.min(boosted.length, Math.max(1, Math.floor(budget / 3))));
    picked = [...boostKeep, ...unboosted.slice(0, Math.max(0, budget - boostKeep.length))];
    if (picked.length < budget) {
      picked = [...picked, ...boosted.slice(boostKeep.length, boostKeep.length + (budget - picked.length))];
    }
    picked = seededShuffle(picked, hash ^ 0x51ed);
  } else {
    picked = shuffled.slice(0, Math.max(0, budget));
  }

  let base: SmartRow[] = picked;

  // Personalized rows land on a Netflix-like rhythm: rows 4, 8, 12, 16…
  personal.forEach((row, i) => {
    const at = Math.min(3 + i * 4, base.length);
    base = [...base.slice(0, at), row, ...base.slice(at)];
  });

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

// Genre-id → title-substring matchers used by the taste boost. Substrings are
// deliberately loose ("Comed" hits Comedy/Comedies, "Animat" hits
// Animated/Animation) so row titles written in natural language still match.
const TASTE_MATCHERS: Record<number, string[]> = {
  28: ['Action'], 12: ['Adventure'], 16: ['Anime', 'Animat'], 35: ['Comed'],
  80: ['Crime', 'Heist'], 99: ['Documentar'], 18: ['Drama'], 10751: ['Family'],
  14: ['Fantasy', 'Magic'], 36: ['Histor'], 27: ['Horror', 'Scary', 'Fright'],
  10402: ['Music'], 9648: ['Myster'], 10749: ['Roman', 'Love'],
  878: ['Sci-Fi', 'Science Fiction', 'Space'], 53: ['Thriller'], 10752: ['War'],
  37: ['Western'], 10759: ['Action'], 10765: ['Sci-Fi', 'Fantasy'],
  10764: ['Reality'], 10762: ['Kids', 'Family'],
};

// ─── useDynamicManifest ───────────────────────────────────────────────────────
export const useDynamicManifest = (
  pageType: 'home' | 'movie' | 'tv' | 'new_popular',
  selectedGenreId?: number,
  selectedGenreName?: string,
) => {
  const { t } = useTranslation();
  const {
    continueWatching, myList, user, activeProfile, isKidsMode,
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
    const likedEntries = getLikedMovies();

    // ── 0. TASTE PROFILE ──────────────────────────────────────────────────────
    // Weighted genre scoring across everything the profile has touched:
    // loves > likes > continue watching > my list. Drives the "Top Picks for
    // {name}" row and biases the daily row cut toward the profile's taste.
    const tasteScores: Record<number, number> = {};
    const bumpTaste = (ids: number[] | undefined, w: number) =>
      ids?.forEach(id => { tasteScores[id] = (tasteScores[id] || 0) + w; });
    continueWatching.forEach(m => bumpTaste(m.genre_ids, 2));
    myList.forEach(m => bumpTaste(m.genre_ids, 1));
    likedEntries.forEach(e => bumpTaste(e.movie?.genre_ids, e.rating === 'love' ? 4 : 3));
    const topTaste = Object.entries(tasteScores)
      .map(([id, score]) => ({ id: Number(id), score }))
      .filter(tst => TASTE_MATCHERS[tst.id])
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
    const tasteNames = topTaste.flatMap(tst => TASTE_MATCHERS[tst.id]);

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
        // Netflix titles this row per profile ("Continue watching for Julian").
        const watcherName = activeProfile?.name || user?.display_name;
        const title = watcherName
          ? t('rows.continueWatchingUser', { name: watcherName, defaultValue: `Here's Where You Left Off, ${watcherName}` })
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

    // ── KIDS MODE ─────────────────────────────────────────────────────────────
    // The standard pools are adult-leaning and get emptied by the kids content
    // filter (blank Series/Films pages). Serve a dedicated kids catalog instead.
    if (isKidsMode) {
      return buildKidsManifest(pageType, {
        year, continueWatchingRow, myListRow, selectedGenreId, selectedGenreName,
        hash, continueWatching, profileName: activeProfile?.name,
      });
    }

    // "Top Picks for {name}" — Netflix's signature taste row, built from the
    // profile's strongest genre with a high quality floor. Guaranteed placement
    // via capAndShuffle's personalized-row rhythm.
    let topPicksRow: SmartRow | null = null;
    if (topTaste.length > 0 && user && pageType !== 'new_popular') {
      const media: 'movie' | 'tv' =
        pageType === 'tv' ? 'tv' : pageType === 'movie' ? 'movie' : (hash % 2 === 0 ? 'movie' : 'tv');
      const resolvedId = resolveGenreId(media, topTaste[0].id);
      const pickName = activeProfile?.name || user?.display_name;
      topPicksRow = {
        key: 'top-picks-profile',
        title: pickName
          ? t('rows.topPicksFor', { name: pickName, defaultValue: `Top Picks for ${pickName}` })
          : t('rows.topPicks', { defaultValue: 'Top Picks for You' }),
        fetchUrl: REQUESTS.fetchByGenre(media, resolvedId, 'popularity.desc', '&vote_count.gte=200'),
      };
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

      // Separate top10 rows so they can be placed independently (avoid adjacency)
      const top10Rows = npPool.filter(r => r.type === 'top10');
      const nonTop10  = npPool.filter(r => r.type !== 'top10');

      // Shuffle only the non-top10 rows
      const shuffled = seededShuffle(nonTop10, hash);

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

      // Insert each top10 row into its own slice so they're never adjacent.
      // top10Rows[0] → first half, top10Rows[1] → second half.
      for (let i = 0; i < top10Rows.length; i++) {
        const sliceStart = Math.floor(i * result.length / top10Rows.length);
        const sliceEnd   = Math.floor((i + 1) * result.length / top10Rows.length);
        const range      = Math.max(1, sliceEnd - sliceStart);
        const at         = sliceStart + (Math.abs((hash * (i + 7) * 1664525) | 0) % range);
        result.splice(at, 0, top10Rows[i]);
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
        likedEntries,
        continueWatchingRow,
        myListRow,
      });

      if (topPicksRow) manifest.push(topPicksRow);
      return capAndShuffle(manifest, hash, tasteNames);
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
        likedEntries,
        continueWatchingRow,
        myListRow,
      });

      if (topPicksRow) manifest.push(topPicksRow);
      return capAndShuffle(manifest, hash, tasteNames);
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
        likedEntries,
        continueWatchingRow,
        myListRow,
      });

      if (topPicksRow) manifest.push(topPicksRow);
      return capAndShuffle(manifest, hash, tasteNames);
    }

    return manifest;
  }, [pageType, selectedGenreId, selectedGenreName, continueWatching, myList, user, activeProfile, isKidsMode, getLikedMovies, t]);

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

  const cacheKey = `${isKidsMode ? 'kids-' : ''}${pageType}-${selectedGenreId || 'all'}`;
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