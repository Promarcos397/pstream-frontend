import { useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { REQUESTS, MICRO_GENRES, DAY_STREAMS, MicroGenreEntry, GENRES } from '../constants';
import { Movie } from '../types';
import { useGlobalContext } from '../context/GlobalContext';

export interface SmartRow {
  key: string;
  title: string;
  fetchUrl?: string;
  data?: Movie[];
  type?: 'standard' | 'top10';
}

const getDailyHash = (): number => {
  const day = new Date().toDateString();
  let h = 0;
  for (let i = 0; i < day.length; i++) h = (h * 31 + day.charCodeAt(i)) | 0;
  return Math.abs(h);
};

const getDayOfWeek = (): string => {
  return new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date());
};

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

export const useDynamicManifest = (pageType: 'home' | 'movie' | 'tv' | 'new_popular', selectedGenreId?: number) => {
  const { t } = useTranslation();
  const { continueWatching, myList, getLikedMovies, clearSeenIds } = useGlobalContext();

  // Clear deduplication memory whenever the main filter changes
  useEffect(() => {
    clearSeenIds();
  }, [pageType, selectedGenreId, clearSeenIds]);

  return useMemo<SmartRow[]>(() => {
    const manifest: SmartRow[] = [];
    const hash = getDailyHash();
    const day = getDayOfWeek();

    // 1. === THE "COMFORT" POUCH (Always Top Priority) ===
    if (continueWatching.length > 0) {
      // Comfort Zone: Filter continue watching by genre if selected
      const filteredHistory = selectedGenreId 
        ? continueWatching.filter(m => m.genre_ids?.includes(selectedGenreId))
        : continueWatching;

      if (filteredHistory.length > 0) {
        manifest.push({ 
          key: 'continue-watching', 
          title: t('rows.continueWatchingUser', { defaultValue: 'Continue watching for you' }), 
          data: filteredHistory 
        });
      }
    }

    if (myList.length > 0) {
      manifest.push({ key: 'my-list', title: t('rows.myList', { defaultValue: 'My List' }), data: myList });
    }

    // 2. === THE "MOMENTUM" POUCH (New & Popular Specific) ===
    if (pageType === 'new_popular') {
      manifest.push({ key: 'top10-overall', title: t('rows.top10Overall', { defaultValue: 'Global Top 10 Today' }), fetchUrl: REQUESTS.fetchTrending, type: 'top10' });
      manifest.push({ key: 'new-releases', title: t('rows.newReleases', { defaultValue: 'Newly Added to the Collection' }), fetchUrl: REQUESTS.fetchNewReleases });
      
      // Momentum Logic: Discover Page 2 for upcoming to show things people haven't seen in the main hero
      manifest.push({ key: 'worth-wait', title: t('rows.worthWait', { defaultValue: 'Worth the Wait' }), fetchUrl: REQUESTS.fetchUpcoming + '&page=2' });
      
      // Rising Stars: High rating but lower popularity (Discovery)
      manifest.push({ key: 'rising-stars', title: t('rows.risingStars', { defaultValue: 'Rising Stars' }), fetchUrl: REQUESTS.fetchByGenre('movie', 28, 'vote_average.desc') + '&vote_count.gte=100&vote_count.lte=1000' });
    }

    // 3. === THE "GENRE TINT" (If Genre Selected) ===
    if (selectedGenreId) {
      const mainGenreName = t(`genres.${selectedGenreId}`, { defaultValue: GENRES[selectedGenreId] || 'Category' });
      
      // Core Genre Hooks
      manifest.push({
        key: `trending-${selectedGenreId}`,
        title: t('rows.trendingGenre', { genre: mainGenreName, defaultValue: `Trending ${mainGenreName}` }),
        fetchUrl: REQUESTS.fetchByGenre(pageType as 'movie' | 'tv', selectedGenreId, 'popularity.desc')
      });

      manifest.push({
        key: `acclaimed-${selectedGenreId}`,
        title: t('rows.criticallyAcclaimedGenre', { genre: mainGenreName, defaultValue: `Critically Acclaimed ${mainGenreName}` }),
        fetchUrl: REQUESTS.fetchByGenre(pageType as 'movie' | 'tv', selectedGenreId, 'vote_average.desc') + '&vote_count.gte=500'
      });

      // Offset Discovery: "The Deep Dive"
      manifest.push({
        key: `deep-dive-${selectedGenreId}-p3`,
        title: t('rows.deepDiscovery', { genre: mainGenreName, defaultValue: `${mainGenreName} Hidden Gems` }),
        fetchUrl: REQUESTS.fetchByGenre(pageType as 'movie' | 'tv', selectedGenreId, 'popularity.desc') + '&page=3'
      });

      // Sub-genre MIX Logic (Bag selection based on selected genre)
      const subMicros = MICRO_GENRES.filter(m => 
        (pageType === 'home' || m.type === pageType) && 
        m.genres.split(',').includes(String(selectedGenreId))
      );
      
      subMicros.forEach((sm, i) => {
        manifest.push({
          key: `sub-micro-${selectedGenreId}-${i}`,
          title: sm.name,
          fetchUrl: REQUESTS.fetchMicroGenre(sm.type, sm.genres, sm.extra)
        });
      });

      // ABUNDANCE FILL: If we still have fewer than 20 rows, we recursively fill with "Deep Page" shifts
      // This ensures the site feels infinite even for niche genres.
      const currentCount = manifest.length;
      if (currentCount < 20) {
        for (let i = 1; i <= (20 - currentCount); i++) {
          const page = 4 + i;
          manifest.push({
            key: `infinite-fill-${selectedGenreId}-${page}`,
            title: t('rows.moreMoreToWatch', { defaultValue: `More ${mainGenreName} to Watch` }),
            fetchUrl: REQUESTS.fetchByGenre(pageType as 'movie' | 'tv', selectedGenreId, 'popularity.desc') + `&page=${page}`
          });
        }
      }

      return manifest;
    }

    // 4. === THE "CHOCOLATE BAG" SELECTION (Standard Hubs) ===
    
    // Day/Theme Row
    const themed = DAY_STREAMS[day];
    if (themed && (pageType === 'home' || themed.type === pageType)) {
      manifest.push({
        key: `day-theme-${day}`,
        title: themed.name,
        fetchUrl: REQUESTS.fetchMicroGenre(themed.type, themed.genres, themed.extra)
      });
    }

    // Pick 25 random chocolates from the master bag
    const pool = MICRO_GENRES.filter(m => pageType === 'home' ? true : m.type === pageType);
    const randomChocolates = seededPick(pool, 25, hash);
    
    randomChocolates.forEach((m, i) => {
      let extra = m.extra || '';
      if (!extra.includes('page=') && i > 8) {
        extra += `&page=${Math.floor(i / 5) + 1}`; // Automatically scale page depth (2, 3, 4...)
      }

      manifest.push({
        key: `pouch-${i}`,
        title: m.name,
        fetchUrl: REQUESTS.fetchMicroGenre(m.type, m.genres, extra)
      });
    });

    // 5. === THE "STAPLE" FOOTER (Netflix-style Big Rows) ===
    const top10Key = pageType === 'tv' || (pageType === 'home' && hash % 2 === 0) ? 'top10-tv' : 'top10-movies';
    const top10Title = top10Key === 'top10-tv' ? t('rows.top10TV', { defaultValue: 'Top 10 Series Today' }) : t('rows.top10Movies', { defaultValue: 'Top 10 Movies Today' });
    const top10Url = top10Key === 'top10-tv' ? REQUESTS.fetchTrendingTV : REQUESTS.fetchTrendingMovies;

    manifest.splice(Math.min(manifest.length, 5), 0, {
      key: top10Key,
      title: top10Title,
      fetchUrl: top10Url,
      type: 'top10'
    });

    return manifest;
  }, [pageType, selectedGenreId, continueWatching, myList, getLikedMovies, t]);
};
