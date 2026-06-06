import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { REQUESTS } from '../constants';
import { Movie } from '../types';
import HeroCarousel from '../components/HeroCarousel';
import Row from '../components/Row';
import TopTenRow from '../components/TopTenRow';
import { useGlobalContext } from '../context/GlobalContext';
import { useDynamicManifest } from '../hooks/useDynamicManifest';
import ManifestSkeleton from '../components/ManifestSkeleton';
import HeroSkeleton from '../components/HeroSkeleton';
import { motion, AnimatePresence } from 'framer-motion';
import CategorySubNav, { Genre } from '../components/CategorySubNav';
import { HOME_MOBILE_GENRES, resolveGenreId } from '../data/pageGenres';
import { HeroEngine } from '../services/HeroEngine';

interface PageProps {
  onSelectMovie: (movie: Movie, time?: number, videoId?: string) => void;
  onPlay: (movie: Movie) => void;
  seekTime?: number;
  onViewAll?: (rowKey: string, fetchUrl: string, title: string) => void;
}

const getDailyHash = (): number => {
  const day = new Date().toDateString();
  let h = 0;
  for (let i = 0; i < day.length; i++) h = (h * 31 + day.charCodeAt(i)) | 0;
  return Math.abs(h);
};

const HomePage: React.FC<PageProps> = ({ onSelectMovie, onPlay, seekTime, onViewAll }) => {
  const { isAppReady } = useGlobalContext();
  const { t } = useTranslation();
  const [selectedGenre, setSelectedGenre] = useState<Genre | null>(null);

  const { rows, isLoading } = useDynamicManifest('home', selectedGenre?.id, selectedGenre?.name);

  useEffect(() => {
    if (selectedGenre?.id != null) {
      HeroEngine.invalidateGenreHero('home', selectedGenre.id);
    } else {
      HeroEngine.invalidateGenreHero('home');
    }
  }, [selectedGenre?.id]);

  const heroFetchUrl = selectedGenre
    ? (getDailyHash() % 2 === 0
        ? REQUESTS.fetchByGenre('tv', resolveGenreId('tv', selectedGenre.id), 'popularity.desc')
        : REQUESTS.fetchByGenre('movie', resolveGenreId('movie', selectedGenre.id), 'popularity.desc'))
    : REQUESTS.fetchPopular;

  const showSkeleton = !isAppReady || isLoading;

  return (
    <div className="relative">
      <CategorySubNav
        title={t('nav.home', { defaultValue: 'Home' })}
        genres={HOME_MOBILE_GENRES}
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
            {!isAppReady && (
              <div className="absolute inset-0 opacity-0 pointer-events-none overflow-hidden" aria-hidden>
                <HeroCarousel
                  key="home-bootstrap"
                  onSelect={onSelectMovie}
                  onPlay={onPlay}
                  fetchUrl={REQUESTS.fetchPopular}
                  seekTime={seekTime}
                  pageType="home"
                />
              </div>
            )}
            <HeroSkeleton />
            <main className="relative z-10 pb-12 -mt-8 sm:-mt-14 md:-mt-20 space-y-4 md:space-y-6 px-4 md:px-14 lg:px-16 pt-4 md:pt-10">
              <ManifestSkeleton count={6} />
            </main>
          </motion.div>
        )}
      </AnimatePresence>

      <div className={`transition-opacity duration-300 ${showSkeleton ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        <HeroCarousel
          key={`home-${selectedGenre?.id || 'all'}`}
          onSelect={onSelectMovie}
          onPlay={onPlay}
          fetchUrl={heroFetchUrl}
          seekTime={seekTime}
          pageType="home"
          genreId={selectedGenre?.id}
        />
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
      </div>
    </div>
  );
};

export default HomePage;
