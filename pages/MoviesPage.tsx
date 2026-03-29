import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { REQUESTS, GENRES } from '../constants';
import { Movie } from '../types';
import HeroCarousel from '../components/HeroCarousel';
import Row from '../components/Row';
import TopTenRow from '../components/TopTenRow';
import CategorySubNav, { Genre } from '../components/CategorySubNav';
import { useGlobalContext } from '../context/GlobalContext';
import { useDynamicManifest } from '../hooks/useDynamicManifest';

const MOVIE_GENRES = [
    { id: 28, name: 'Action' },
    { id: 12, name: 'Adventure' },
    { id: 16, name: 'Animation' },
    { id: 35, name: 'Comedy' },
    { id: 80, name: 'Crime' },
    { id: 99, name: 'Documentary' },
    { id: 18, name: 'Drama' },
    { id: 10751, name: 'Family' },
    { id: 14, name: 'Fantasy' },
    { id: 36, name: 'History' },
    { id: 27, name: 'Horror' },
    { id: 10402, name: 'Music' },
    { id: 189, name: 'Mystery' },
    { id: 10749, name: 'Romance' },
    { id: 878, name: 'Science Fiction' },
    { id: 10770, name: 'TV Movie' },
    { id: 53, name: 'Thriller' },
    { id: 10752, name: 'War' },
    { id: 37, name: 'Western' }
];

interface PageProps {
  onSelectMovie: (movie: Movie, time?: number, videoId?: string) => void;
  onPlay: (movie: Movie) => void;
  seekTime?: number;
}

const MoviesPage: React.FC<PageProps> = ({ onSelectMovie, onPlay, seekTime }) => {
  const { t } = useTranslation();
  const [selectedGenre, setSelectedGenre] = useState<Genre | null>(null);
  const { continueWatching } = useGlobalContext();
  const rows = useDynamicManifest('movie', selectedGenre?.id);

  return (
    <div className="relative">
      {/* Netflix-style sub-navigation: Overlaid on top of Hero */}
      <div className="absolute top-16 md:top-20 left-0 right-0 w-full z-40 pointer-events-auto">
        <CategorySubNav
          title={t('nav.movies', { defaultValue: 'Films' })}
          genres={MOVIE_GENRES}
          selectedGenre={selectedGenre}
          onGenreSelect={setSelectedGenre}
        />
      </div>

      <HeroCarousel
        key={`movies-${selectedGenre?.id || 'all'}`}
        onSelect={onSelectMovie}
        onPlay={onPlay}
        fetchUrl={selectedGenre ? REQUESTS.fetchByGenre('movie', selectedGenre.id, 'popularity.desc') : REQUESTS.fetchTopRated}
        seekTime={seekTime}
        genreId={selectedGenre?.id}
        pageType="movie"
      />

      <main className="relative z-10 pb-12 -mt-12 sm:-mt-20 md:-mt-28 space-y-4 md:space-y-6">
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
    </div>
  );
};

export default MoviesPage;