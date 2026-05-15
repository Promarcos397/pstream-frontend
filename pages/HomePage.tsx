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
import ManifestSkeleton from '../components/ManifestSkeleton';
import HeroSkeleton from '../components/HeroSkeleton';
import { motion, AnimatePresence } from 'framer-motion';

interface PageProps {
  onSelectMovie: (movie: Movie, time?: number, videoId?: string) => void;
  onPlay: (movie: Movie) => void;
  seekTime?: number;
  onViewAll?: (rowKey: string, fetchUrl: string, title: string) => void;
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

const HomePage: React.FC<PageProps> = ({ onSelectMovie, onPlay, seekTime, onViewAll }) => {
  const { myList, continueWatching, getLikedMovies, isAppReady } = useGlobalContext();
  const { t } = useTranslation();

  const { rows, isLoading } = useDynamicManifest('home');

  // --- SMART PRELOADING ENGINE ---
  // Removed: We now use the global usePrefetchQueue hook instead of aggressive localized prefetching.

  return (
    <div className="relative">
      {/* 
        HeroCarousel must be rendered even when !isAppReady because it's the component 
        responsible for setting isAppReady = true once its assets are loaded. 
      */}
      <HeroCarousel
        key="home"
        onSelect={onSelectMovie}
        onPlay={onPlay}
        fetchUrl={REQUESTS.fetchPopular}
        seekTime={seekTime}
        pageType="home"
      />

      <AnimatePresence>
        {(!isAppReady || isLoading) ? (
          <motion.div
            key="skeletons"
            className="absolute inset-0 z-[100] bg-[#141414]"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          >
             <main className="relative z-10 pb-12 mt-[45vh] space-y-4 md:space-y-6 px-4 md:px-14 lg:px-16">
                <ManifestSkeleton count={6} />
             </main>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <motion.div
        key="content"
        initial={{ opacity: 0 }}
        animate={{ opacity: isAppReady ? 1 : 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <main className="relative z-10 pb-12 -mt-8 sm:-mt-14 md:-mt-20 space-y-4 md:space-y-6">
          {rows.map((row, index) => (
            row.type === 'top10' ? (
              <TopTenRow
                key={row.key}
                index={index}
                title={row.title}
                fetchUrl={row.fetchUrl}
                onSelect={onSelectMovie}
              />
            ) : (
              <Row
                key={row.key}
                index={index}
                title={row.title}
                fetchUrl={row.fetchUrl}
                data={row.data}
                onSelect={onSelectMovie}
                onPlay={onPlay}
                rowKey={row.key}
                onViewAll={onViewAll}
              />
            )
          ))}
        </main>
      </motion.div>
    </div>
  );
};

export default HomePage;