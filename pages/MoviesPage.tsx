import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { REQUESTS } from '../constants';
import { Movie } from '../types';
import HeroCarousel from '../components/HeroCarousel';
import Row from '../components/Row';
import TopTenRow from '../components/TopTenRow';
import CategorySubNav, { Genre } from '../components/CategorySubNav';
import { useDynamicManifest } from '../hooks/useDynamicManifest';
import ManifestSkeleton from '../components/ManifestSkeleton';
import HeroSkeleton from '../components/HeroSkeleton';
import { motion, AnimatePresence } from 'framer-motion';
import { MOVIE_GENRES } from '../data/pageGenres';
import { useGlobalContext } from '../context/GlobalContext';

interface PageProps {
  onSelectMovie: (movie: Movie, time?: number, videoId?: string) => void;
  onPlay: (movie: Movie) => void;
  seekTime?: number;
  onViewAll?: (rowKey: string, fetchUrl: string, title: string) => void;
}

const MoviesPage: React.FC<PageProps> = ({ onSelectMovie, onPlay, seekTime, onViewAll }) => {
  const { t } = useTranslation();
  const { isAppReady } = useGlobalContext();
  const [selectedGenre, setSelectedGenre] = useState<Genre | null>(null);
  const { rows, isLoading } = useDynamicManifest('movie', selectedGenre?.id);

  return (
    <div className="relative">
      <div className="absolute top-16 md:top-20 left-0 right-0 w-full z-40 pointer-events-auto">
        <CategorySubNav
          title={t('nav.movies', { defaultValue: 'Movies' })}
          genres={MOVIE_GENRES}
          selectedGenre={selectedGenre}
          onGenreSelect={setSelectedGenre}
        />
      </div>

      <AnimatePresence>
        {!isAppReady || isLoading ? (
          <motion.div
            key="skeletons"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          >
             <HeroSkeleton />
             <main className="relative z-10 pb-12 -mt-8 sm:-mt-14 md:-mt-20 space-y-4 md:space-y-6 px-4 md:px-14 lg:px-16 pt-4 md:pt-10">
                <ManifestSkeleton count={8} />
             </main>
          </motion.div>
        ) : (
          <motion.div
            key="content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            <HeroCarousel
              key={`movies-${selectedGenre?.id || 'all'}`}
              onSelect={onSelectMovie}
              onPlay={onPlay}
              fetchUrl={selectedGenre 
                ? REQUESTS.fetchByGenre('movie', selectedGenre.id, 'popularity.desc') 
                : REQUESTS.fetchTopRated}
              seekTime={seekTime}
              genreId={selectedGenre?.id}
              pageType="movie"
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MoviesPage;