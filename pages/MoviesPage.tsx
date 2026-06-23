import React, { useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
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

interface PageProps {
  onSelectMovie: (movie: Movie, time?: number, videoId?: string) => void;
  onPlay: (movie: Movie) => void;
  seekTime?: number;
  onViewAll?: (rowKey: string, fetchUrl: string, title: string) => void;
}

const MoviesPage: React.FC<PageProps> = ({ onSelectMovie, onPlay, seekTime, onViewAll }) => {
  const { t } = useTranslation();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const stateGenre = location.state?.genre as Genre | null;
  const [selectedGenre, setSelectedGenre] = useState<Genre | null>(() => {
    const id = searchParams.get('genre');
    const name = searchParams.get('gname');
    if (id && name) return { id: Number(id), name };
    return stateGenre || null;
  });

  const handleGenreSelect = (genre: Genre | null) => {
    setSelectedGenre(genre);
    if (genre) setSearchParams({ genre: String(genre.id), gname: genre.name }, { replace: true });
    else setSearchParams({}, { replace: true });
  };
  const { rows, isLoading } = useDynamicManifest('movie', selectedGenre?.id, selectedGenre?.name);

  return (
    <div className="relative">
        <CategorySubNav
          title={t('nav.movies', { defaultValue: 'Movies' })}
          genres={MOVIE_GENRES}
          selectedGenre={selectedGenre}
          onGenreSelect={handleGenreSelect}
        />

      <AnimatePresence initial={false}>
        {isLoading && (
          <motion.div
            key="skeletons"
            className="absolute inset-0 z-[100] bg-black md:bg-[#141414] pointer-events-none"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
              <HeroSkeleton />
              <main className="relative z-10 pb-12 -mt-2 sm:-mt-4 md:-mt-6 space-y-4 md:space-y-6 px-[var(--app-x)] pt-4 md:pt-10">
                 <ManifestSkeleton count={8} />
              </main>
          </motion.div>
        )}
      </AnimatePresence>

      <div className={`transition-opacity duration-300 ${isLoading ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
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

export default MoviesPage;