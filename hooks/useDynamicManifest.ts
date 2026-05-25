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
  const day = new Date().toDateString();
  let h = 0;
  for (let i = 0; i < day.length; i++) h = (h * 31 + day.charCodeAt(i)) | 0;
  return Math.abs(h);
};

const makeUrlSig = (url: string): string => {
  try {
    const [base, qs = ''] = url.split('?');
    const params = qs.split('&').filter(Boolean).sort();
    return base + '?' + params.join('&');
  } catch { return url; }
};

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

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    clearSeenIds();
    setIsLoading(true);
    const timer = setTimeout(() => setIsLoading(false), 180);
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
      manifest.push({ key: 'top10-movies',   title: 'Top 10 Films in the UK Today',     fetchUrl: REQUESTS.fetchTrendingMovies,  type: 'top10' });
      manifest.push({ key: 'top10-tv',       title: 'Top 10 Series in the UK Today',    fetchUrl: REQUESTS.fetchTrendingTV,      type: 'top10' });
      manifest.push({ key: 'new-releases',   title: 'Newly Added to the Collection',    fetchUrl: REQUESTS.fetchNewReleases });
      manifest.push({ key: 'worth-wait',     title: 'Worth the Wait',                   fetchUrl: REQUESTS.fetchUpcoming + '&page=2' });
      manifest.push({ key: 'rising-stars',   title: 'Rising Stars: Under the Radar',    fetchUrl: REQUESTS.fetchByGenre('movie', 28, 'vote_average.desc', '&vote_count.gte=100&vote_count.lte=1000') });
      manifest.push({ key: 'new-this-year',  title: `The Best of ${year} So Far`,        fetchUrl: REQUESTS.fetchByGenre('movie', 18, 'vote_average.desc', `&release_date.gte=${year}-01-01&vote_count.gte=50`) });
      manifest.push({ key: 'new-tv-year',    title: `New Series Everyone Is Watching`,  fetchUrl: REQUESTS.fetchByGenre('tv', 18, 'vote_average.desc', `&first_air_date.gte=${year}-01-01&vote_count.gte=30`) });
      manifest.push({ key: 'internet-buzz',  title: "The Shows the Internet Can't Stop Talking About", fetchUrl: REQUESTS.fetchTrendingTV + '&page=2' });
      manifest.push({ key: 'films-buzz',     title: 'The Films Everyone Is Discussing', fetchUrl: REQUESTS.fetchTrendingMovies + '&page=2' });
      manifest.push({ key: 'np-upcoming',    title: 'Coming to the Collection Soon',    fetchUrl: REQUESTS.fetchUpcoming });
      manifest.push({ key: 'np-acclaimed',   title: 'New and Acclaimed',                fetchUrl: REQUESTS.fetchByGenre('movie', 18, 'vote_average.desc', `&release_date.gte=${year - 1}-01-01&vote_count.gte=300`) });
      manifest.push({ key: 'np-series-new',  title: 'Series Picking Up Steam',          fetchUrl: REQUESTS.fetchByGenre('tv', 10765, 'popularity.desc', `&first_air_date.gte=${year - 1}-01-01`) });
      manifest.push({ key: 'np-drama-new',   title: 'New Dramas With Something to Say', fetchUrl: REQUESTS.fetchByGenre('tv', 18, 'popularity.desc', `&first_air_date.gte=${year}-01-01`) });
      manifest.push({ key: 'np-hidden',      title: 'Flying Under the Radar',           fetchUrl: REQUESTS.fetchByGenre('movie', 18, 'vote_average.desc', '&vote_count.gte=100&vote_count.lte=800') });
      manifest.push({ key: 'np-intl',        title: 'International Discoveries',        fetchUrl: REQUESTS.fetchByGenre('movie', 18, 'popularity.desc') + '&without_original_language=en' });
      return manifest;
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

      return manifest;
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

      return manifest;
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

      return manifest;
    }

    return manifest;
  }, [pageType, selectedGenreId, selectedGenreName, continueWatching, myList, user, getLikedMovies, t]);

  return { rows, isLoading };
};