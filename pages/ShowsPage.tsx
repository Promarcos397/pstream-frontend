import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { REQUESTS } from '../constants';
import { Movie } from '../types';
import HeroCarousel from '../components/HeroCarousel';
import Row from '../components/Row';
import TopTenRow from '../components/TopTenRow';
import { useDynamicManifest } from '../hooks/useDynamicManifest';
import ManifestSkeleton from '../components/ManifestSkeleton';
import CategorySubNav, { Genre } from '../components/CategorySubNav';
import { TV_GENRES } from '../data/pageGenres';

interface PageProps {
  onSelectMovie: (movie: Movie, time?: number, videoId?: string) => void;
  onPlay: (movie: Movie) => void;
  onViewAll?: (rowKey: string, fetchUrl: string, title: string) => void;
}

const ShowsPage: React.FC<PageProps> = ({ onSelectMovie, onPlay, onViewAll }) => {
  const { t } = useTranslation();
  const [selectedGenre, setSelectedGenre] = useState<Genre | null>(null);
  const { rows, isLoading } = useDynamicManifest('tv', selectedGenre?.id);

  return (
    <div className="relative">
      <div className="absolute top-16 md:top-20 left-0 right-0 w-full z-40 pointer-events-auto">
        <CategorySubNav
          title={t('nav.shows', { defaultValue: 'Series' })}
          genres={TV_GENRES}
          selectedGenre={selectedGenre}
          onGenreSelect={setSelectedGenre}
        />
      </div>

      <HeroCarousel
        key={`shows-${selectedGenre?.id || 'all'}`}
        fetchUrl={selectedGenre ? REQUESTS.fetchByGenre('tv', selectedGenre.id, 'popularity.desc') : REQUESTS.fetchTrendingTV}
        onSelect={onSelectMovie}
        onPlay={onPlay}
        genreId={selectedGenre?.id}
        pageType="tv"
      />

      <main className="relative z-10 pb-12 -mt-8 sm:-mt-14 md:-mt-20 space-y-4 md:space-y-6">
        {isLoading ? (
          <div className="pt-4 md:pt-10">
            <ManifestSkeleton count={8} />
          </div>
        ) : (
          rows.map(row => (
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
                rowKey={row.key}
                onViewAll={onViewAll}
              />
            )
          ))
        )}
      </main>
    </div>
  );
};

export default ShowsPage;