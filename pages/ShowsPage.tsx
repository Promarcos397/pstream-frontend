import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
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
import { TV_GENRES } from '../data/pageGenres';
import { useGlobalContext } from '../context/GlobalContext';
import { HeroEngine } from '../services/HeroEngine';

interface PageProps {
  onSelectMovie: (movie: Movie, time?: number, videoId?: string) => void;
  onPlay: (movie: Movie) => void;
  onViewAll?: (rowKey: string, fetchUrl: string, title: string) => void;
}

const ShowsPage: React.FC<PageProps> = ({ onSelectMovie, onPlay, onViewAll }) => {
  const { t } = useTranslation();
  const { isAppReady } = useGlobalContext();
  const location = useLocation();
  const stateGenre = location.state?.genre as Genre | null;
  const [selectedGenre, setSelectedGenre] = useState<Genre | null>(stateGenre || null);
  const { rows, isLoading } = useDynamicManifest('tv', selectedGenre?.id, selectedGenre?.name);

  useEffect(() => {
    if (selectedGenre?.id != null) {
      HeroEngine.invalidateGenreHero('tv', selectedGenre.id);
    } else {
      HeroEngine.invalidateGenreHero('tv');
    }
  }, [selectedGenre?.id]);

  return (
    <div className="relative">
        <CategorySubNav
          title={t('nav.shows', { defaultValue: 'Series' })}
          genres={TV_GENRES}
          selectedGenre={selectedGenre}
          onGenreSelect={setSelectedGenre}
        />
        <AnimatePresence initial={false}>
        {(!isAppReady || isLoading) && (
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
                   key="shows-bootstrap"
                   onSelect={onSelectMovie}
                   onPlay={onPlay}
                   fetchUrl={selectedGenre ? REQUESTS.fetchByGenre('tv', selectedGenre.id, 'popularity.desc') : REQUESTS.fetchTrendingTV}
                   genreId={selectedGenre?.id}
                   pageType="tv"
                 />
               </div>
             )}
             <HeroSkeleton />
             <main className="relative z-10 pb-12 -mt-8 sm:-mt-14 md:-mt-20 space-y-4 md:space-y-6 px-4 md:px-14 lg:px-16 pt-4 md:pt-10">
                <ManifestSkeleton count={8} />
             </main>
          </motion.div>
        )}
      </AnimatePresence>

      <div className={`transition-opacity duration-300 ${(!isAppReady || isLoading) ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        <HeroCarousel
          key={`shows-${selectedGenre?.id || 'all'}`}
          fetchUrl={selectedGenre ? REQUESTS.fetchByGenre('tv', selectedGenre.id, 'popularity.desc') : REQUESTS.fetchTrendingTV}
          onSelect={onSelectMovie}
          onPlay={onPlay}
          genreId={selectedGenre?.id}
          pageType="tv"
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

export default ShowsPage;