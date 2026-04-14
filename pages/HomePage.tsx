import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { REQUESTS, MICRO_GENRES } from '../constants';
import { Movie } from '../types';
import HeroCarousel from '../components/HeroCarousel';
import Row from '../components/Row';
import TopTenRow from '../components/TopTenRow';
import { useGlobalContext } from '../context/GlobalContext';
import { prefetchStream } from '../services/api';
import { useDynamicManifest } from '../hooks/useDynamicManifest';

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

  const rows = useDynamicManifest('home');

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
        pageType="home"
      />
      {/* THEME_TOGGLE: ROW_POSITION - Adjust negative margin to move rows up/down relative to Hero */}
      <main className="relative z-10 pb-12 -mt-8 sm:-mt-14 md:-mt-20 space-y-4 md:space-y-6">
        {rows.map(row => (
          row.type === 'top10' ? (
            <TopTenRow
              key={row.key}
              title={row.title}
              fetchUrl={row.fetchUrl}
              onSelect={onSelectMovie}
            />
          ) : (
            <Row
              key={row.key}
              title={row.title}
              fetchUrl={row.fetchUrl}
              data={row.data}
              onSelect={onSelectMovie}
              onPlay={onPlay}
            />
          )
        ))}
      </main>
    </>
  );
};

export default HomePage;