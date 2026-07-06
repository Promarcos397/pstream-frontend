import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { REQUESTS } from '../constants';
import { Movie } from '../types';
import HeroCarousel from '../components/HeroCarousel';
import Row from '../components/Row';
import TopTenRow from '../components/TopTenRow';
import { useDynamicManifest } from '../hooks/useDynamicManifest';
import ManifestSkeleton from '../components/ManifestSkeleton';
import HeroSkeleton from '../components/HeroSkeleton';
import { motion, AnimatePresence } from 'framer-motion';
import CategorySubNav, { Genre } from '../components/CategorySubNav';
import { HOME_MOBILE_GENRES, resolveGenreId, isTvOnlyGenreId, isMovieOnlyGenreId } from '../data/pageGenres';
import { HeroEngine } from '../services/HeroEngine';
import { useGlobalContext } from '../context/GlobalContext';
import { kidsHeroUrl } from '../hooks/kidsManifestBuilder';

interface PageProps {
  onSelectMovie: (movie: Movie, time?: number, videoId?: string) => void;
  onPlay: (movie: Movie) => void;
  seekTime?: number;
  onViewAll?: (rowKey: string, fetchUrl: string, title: string) => void;
}

const getDailyHash = (): number => {
  const now = new Date();
  const dateStr = now.toDateString();
  const segment = Math.floor(now.getHours() / 4); // Shuffles every 4 hours
  const key = `${dateStr}_segment_${segment}`;
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return Math.abs(h);
};

const HomePage: React.FC<PageProps> = ({ onSelectMovie, onPlay, seekTime, onViewAll }) => {
  const { t } = useTranslation();
  const { isKidsMode } = useGlobalContext();
  const [selectedGenre, setSelectedGenre] = useState<Genre | null>(null);

  const { rows, isLoading } = useDynamicManifest('home', selectedGenre?.id, selectedGenre?.name);

  useEffect(() => {
    if (selectedGenre?.id != null) {
      HeroEngine.invalidateGenreHero('home', selectedGenre.id);
    } else {
      HeroEngine.invalidateGenreHero('home');
    }
  }, [selectedGenre?.id]);

  // Kids mode never resolves the hero through HOME_MOBILE_GENRES (those are
  // real adult TMDB genre ids with no kids-safe equivalent on Home yet) and
  // never falls back to REQUESTS.fetchPopular — that's a raw all-audiences
  // "popular movies" feed (Interstellar, etc.) with no kids filtering at the
  // source. Kids mode always rotates through the validated kids catalog.
  const heroFetchUrl = isKidsMode
    ? (getDailyHash() % 2 === 0 ? kidsHeroUrl('tv') : kidsHeroUrl('movie'))
    : selectedGenre
    ? (isTvOnlyGenreId(selectedGenre.id) ? REQUESTS.fetchByGenre('tv', resolveGenreId('tv', selectedGenre.id), 'popularity.desc')
        : isMovieOnlyGenreId(selectedGenre.id) ? REQUESTS.fetchByGenre('movie', resolveGenreId('movie', selectedGenre.id), 'popularity.desc')
        : (getDailyHash() % 2 === 0
            ? REQUESTS.fetchByGenre('tv', resolveGenreId('tv', selectedGenre.id), 'popularity.desc')
            : REQUESTS.fetchByGenre('movie', resolveGenreId('movie', selectedGenre.id), 'popularity.desc')))
    : REQUESTS.fetchPopular;

  const showSkeleton = isLoading;

  return (
    <div className="relative">
      <CategorySubNav
        title={t('nav.home', { defaultValue: 'Home' })}
        genres={isKidsMode ? [] : HOME_MOBILE_GENRES}
        selectedGenre={selectedGenre}
        onGenreSelect={setSelectedGenre}
        hideGenresOnDesktop
      />

      <AnimatePresence initial={false}>
        {showSkeleton && (
          <motion.div
            key="skeletons"
            className="absolute inset-0 z-[100] bg-black md:bg-[#141414] pointer-events-none"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <HeroSkeleton />
            <main className="relative z-10 pb-12 -mt-2 sm:-mt-4 md:-mt-6 space-y-4 md:space-y-6 px-[var(--app-x)] pt-4 md:pt-10">
              <ManifestSkeleton count={6} />
            </main>
          </motion.div>
        )}
      </AnimatePresence>

      <div className={`transition-opacity duration-300 ${showSkeleton ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        <HeroCarousel
          key={`home-${isKidsMode ? 'kids-' : ''}${selectedGenre?.id || 'all'}`}
          onSelect={onSelectMovie}
          onPlay={onPlay}
          fetchUrl={heroFetchUrl}
          seekTime={seekTime}
          pageType="home"
          genreId={selectedGenre?.id}
        />
        <main className="relative z-10 pb-12 -mt-2 sm:-mt-4 md:-mt-6 space-y-4 md:space-y-6">
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
      </div>
    </div>
  );
};

export default HomePage;
