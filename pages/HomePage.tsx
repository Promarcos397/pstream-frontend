import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { REQUESTS, MICRO_GENRES } from '../constants';
import { Movie } from '../types';
import HeroCarousel from '../components/HeroCarousel';
import Row from '../components/Row';
import { useGlobalContext } from '../context/GlobalContext';
import { prefetchStream } from '../services/api';

interface PageProps {
  onSelectMovie: (movie: Movie, time?: number, videoId?: string) => void;
  onPlay: (movie: Movie) => void;
  seekTime?: number;
}

// --- Helpers ---
const getMediaType = (m: Movie): 'movie' | 'tv' =>
  (m.media_type || (m.title ? 'movie' : 'tv')) as 'movie' | 'tv';

/** Date-seeded hash for daily rotation — same output all day, changes at midnight */
const getDailyHash = (): number => {
  const day = new Date().toDateString();
  let h = 0;
  for (let i = 0; i < day.length; i++) h = (h * 31 + day.charCodeAt(i)) | 0;
  return Math.abs(h);
};

/** Pick N unique items from an array using a seed for determinism */
const seededPick = <T,>(arr: T[], n: number, seed: number): T[] => {
  if (arr.length <= n) return [...arr];
  const indices = new Set<number>();
  let s = seed;
  while (indices.size < n) {
    s = (s * 16807 + 37) % 2147483647; // LCG PRNG
    indices.add(Math.abs(s) % arr.length);
  }
  return [...indices].map(i => arr[i]);
};

// RowConfig type for the manifest
interface SmartRow {
  key: string;
  title: string;
  fetchUrl?: string;
  data?: Movie[];
}

const HomePage: React.FC<PageProps> = ({ onSelectMovie, onPlay, seekTime }) => {
  const { myList, continueWatching, getLikedMovies } = useGlobalContext();
  const { t } = useTranslation();

  // Build the entire row manifest once on mount + when user data changes
  const rows = useMemo<SmartRow[]>(() => {
    const manifest: SmartRow[] = [];
    const hash = getDailyHash();
    const likedEntries = getLikedMovies();

    // Gather all user-engaged genre IDs for "Top Picks"
    const allEngaged = [...continueWatching, ...myList];
    const genreCounts: Record<number, number> = {};
    allEngaged.forEach(m => {
      m.genre_ids?.forEach(id => {
        genreCounts[id] = (genreCounts[id] || 0) + 1;
      });
    });
    const topGenres = Object.entries(genreCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 2)
      .map(([id]) => id);

    // Select 6 daily micro-genres from the 22-entry library
    const dailyMicros = seededPick(MICRO_GENRES, 6, hash);

    // --- ROW 1: Continue Watching ---
    if (continueWatching.length > 0) {
      manifest.push({
        key: 'continue-watching',
        title: t('rows.continueWatchingUser'),
        data: continueWatching,
      });
    }

    // --- ROW 2: Top Picks / We think you'll love these ---
    if (topGenres.length > 0) {
      manifest.push({
        key: 'top-picks',
        title: t('rows.topPicksUser'),
        fetchUrl: REQUESTS.fetchTopPicks('movie', topGenres.join(',')),
      });
    } else {
      manifest.push({
        key: 'top-picks-fallback',
        title: t('rows.weThinkYoullLove'),
        fetchUrl: REQUESTS.fetchTopRated,
      });
    }

    // --- ROW 3: More like [most recent watch] ---
    if (continueWatching.length > 0) {
      const seed = continueWatching[0];
      manifest.push({
        key: `more-like-${seed.id}`,
        title: t('rows.moreLike', { title: seed.title || seed.name }),
        fetchUrl: REQUESTS.fetchSimilar(getMediaType(seed), seed.id),
      });
    }

    // --- ROW 4: Micro-Genre A ---
    if (dailyMicros[0]) {
      const mg = dailyMicros[0];
      manifest.push({
        key: `micro-0`,
        title: t(`genres.${mg.genres.split(',')[0]}`, { defaultValue: mg.name }),
        fetchUrl: REQUESTS.fetchMicroGenre(mg.type, mg.genres, mg.extra),
      });
    }

    // --- ROW 5: Your Next Watch (from a different seed than row 3) ---
    if (continueWatching.length > 1) {
      const seed = continueWatching[Math.min(1, continueWatching.length - 1)];
      manifest.push({
        key: `next-watch-${seed.id}`,
        title: t('rows.yourNextWatch'),
        fetchUrl: REQUESTS.fetchRecommendations(getMediaType(seed), seed.id),
      });
    }

    // --- ROW 6: My List ---
    if (myList.length > 0) {
      manifest.push({
        key: 'my-list',
        title: t('rows.myList'),
        data: myList,
      });
    }

    // --- ROW 7: Micro-Genre B ---
    if (dailyMicros[1]) {
      const mg = dailyMicros[1];
      manifest.push({
        key: `micro-1`,
        title: t(`genres.${mg.genres.split(',')[0]}`, { defaultValue: mg.name }),
        fetchUrl: REQUESTS.fetchMicroGenre(mg.type, mg.genres, mg.extra),
      });
    }

    // --- ROW 8: Because you added [X] to your List ---
    if (myList.length > 0) {
      const seed = myList[hash % myList.length];
      manifest.push({
        key: `because-added-${seed.id}`,
        title: t('rows.becauseYouAdded', { title: seed.title || seed.name }),
        fetchUrl: REQUESTS.fetchRecommendations(getMediaType(seed), seed.id),
      });
    }

    // --- ROW 9: Micro-Genre C ---
    if (dailyMicros[2]) {
      const mg = dailyMicros[2];
      manifest.push({
        key: `micro-2`,
        title: t(`genres.${mg.genres.split(',')[0]}`, { defaultValue: mg.name }),
        fetchUrl: REQUESTS.fetchMicroGenre(mg.type, mg.genres, mg.extra),
      });
    }

    // --- ROW 10: Award-winning Bingeworthy Series ---
    manifest.push({
      key: 'award-winning',
      title: t('rows.awardWinningSeries'),
      fetchUrl: REQUESTS.fetchAwardWinningSeries,
    });

    // --- ROW 11: Because you watched [2nd item from continueWatching] ---
    if (continueWatching.length > 2) {
      const seed = continueWatching[2];
      manifest.push({
        key: `because-watched-${seed.id}`,
        title: t('rows.becauseYouWatched', { title: seed.title || seed.name }),
        fetchUrl: REQUESTS.fetchRecommendations(getMediaType(seed), seed.id),
      });
    }

    // --- ROW 12: Micro-Genre D ---
    if (dailyMicros[3]) {
      const mg = dailyMicros[3];
      manifest.push({
        key: `micro-3`,
        title: t(`genres.${mg.genres.split(',')[0]}`, { defaultValue: mg.name }),
        fetchUrl: REQUESTS.fetchMicroGenre(mg.type, mg.genres, mg.extra),
      });
    }

    // --- ROW 13: New on Netflix ---
    manifest.push({
      key: 'new-on-netflix',
      title: t('rows.newOnNetflix'),
      fetchUrl: REQUESTS.fetchNewReleases,
    });

    // --- ROW 14: Because you liked [X] ---
    if (likedEntries.length > 0) {
      const seed = likedEntries[hash % likedEntries.length].movie;
      manifest.push({
        key: `because-liked-${seed.id}`,
        title: t('rows.becauseYouLiked', { title: seed.title || seed.name }),
        fetchUrl: REQUESTS.fetchSimilar(getMediaType(seed), seed.id),
      });
    }

    // --- ROW 15: Familiar Favourite Series ---
    manifest.push({
      key: 'familiar-favorites',
      title: t('rows.familiarFavorites'),
      fetchUrl: REQUESTS.fetchFamiliarFavorites,
    });

    // --- ROW 16: Micro-Genre E ---
    if (dailyMicros[4]) {
      const mg = dailyMicros[4];
      manifest.push({
        key: `micro-4`,
        title: t(`genres.${mg.genres.split(',')[0]}`, { defaultValue: mg.name }),
        fetchUrl: REQUESTS.fetchMicroGenre(mg.type, mg.genres, mg.extra),
      });
    }

    // --- ROW 17: Because you watched [3rd item] ---
    if (continueWatching.length > 4) {
      const seed = continueWatching[4];
      manifest.push({
        key: `because-watched-2-${seed.id}`,
        title: t('rows.becauseYouWatched', { title: seed.title || seed.name }),
        fetchUrl: REQUESTS.fetchSimilar(getMediaType(seed), seed.id),
      });
    }

    // --- ROW 18: Micro-Genre F ---
    if (dailyMicros[5]) {
      const mg = dailyMicros[5];
      manifest.push({
        key: `micro-5`,
        title: t(`genres.${mg.genres.split(',')[0]}`, { defaultValue: mg.name }),
        fetchUrl: REQUESTS.fetchMicroGenre(mg.type, mg.genres, mg.extra),
      });
    }

    // --- ROW 19: Critically Acclaimed Drama Series ---
    manifest.push({
      key: 'critically-acclaimed',
      title: t('rows.criticallyAcclaimedDrama'),
      fetchUrl: REQUESTS.fetchCriticallyAcclaimedDrama,
    });

    // --- ROW 20: Imaginative Series ---
    manifest.push({
      key: 'imaginative',
      title: t('rows.imaginativeSeries'),
      fetchUrl: REQUESTS.fetchImaginativeSeries,
    });

    // --- ROW 21: Because you liked [2nd liked] ---
    if (likedEntries.length > 1) {
      const seed = likedEntries[(hash + 1) % likedEntries.length].movie;
      manifest.push({
        key: `because-liked-2-${seed.id}`,
        title: t('rows.becauseYouLiked', { title: seed.title || seed.name }),
        fetchUrl: REQUESTS.fetchRecommendations(getMediaType(seed), seed.id),
      });
    }

    return manifest;
  }, [continueWatching, myList, getLikedMovies, t]);

  // --- SMART PRELOADING ENGINE ---
  useEffect(() => {
    // 1. Prefetch Top 2 Continue Watching (High Accuracy)
    if (continueWatching.length > 0) {
      continueWatching.slice(0, 2).forEach((movie, i) => {
        const type = getMediaType(movie);
        const releaseDate = movie.release_date || movie.first_air_date;
        const year = releaseDate ? new Date(releaseDate).getFullYear() : undefined;
        
        // Staggered delay: 2s and 4s after landing
        setTimeout(() => {
          prefetchStream(movie.title || movie.name || '', year, String(movie.id), type);
        }, 2000 + (i * 2000));
      });
    }

    // 2. Prefetch My List items (Medium Accuracy)
    if (myList.length > 0) {
      const topList = myList.slice(0, 1);
      topList.forEach((movie) => {
        const type = getMediaType(movie);
        const releaseDate = movie.release_date || movie.first_air_date;
        const year = releaseDate ? new Date(releaseDate).getFullYear() : undefined;
        setTimeout(() => {
          prefetchStream(movie.title || movie.name || '', year, String(movie.id), type);
        }, 6000);
      });
    }
  }, [continueWatching, myList]);

  return (
    <>
      <HeroCarousel
        key="home"
        onSelect={onSelectMovie}
        onPlay={onPlay}
        fetchUrl={REQUESTS.fetchPopular}
        seekTime={seekTime}
      />
      <main className="relative z-10 pb-12 -mt-12 sm:-mt-20 md:-mt-28 space-y-4 md:space-y-6">
        {rows.map(row => (
          <Row
            key={row.key}
            title={row.title}
            fetchUrl={row.fetchUrl}
            data={row.data}
            onSelect={onSelectMovie}
            onPlay={onPlay}
          />
        ))}
      </main>
    </>
  );
};

export default HomePage;