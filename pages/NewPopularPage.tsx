import React from 'react';
import { useTranslation } from 'react-i18next';
import { REQUESTS } from '../constants';
import { Movie } from '../types';
import Row from '../components/Row';
import TopTenRow from '../components/TopTenRow';
import { useDynamicManifest } from '../hooks/useDynamicManifest';
import ManifestSkeleton from '../components/ManifestSkeleton';
import { useTasteEngine } from '../hooks/useTasteEngine';
import { useIsMobile } from '../hooks/useIsMobile';
import NewPopularMobilePage from './NewPopularMobilePage';

interface PageProps {
  onSelectMovie: (movie: Movie, time?: number, videoId?: string) => void;
  onPlay: (movie: Movie) => void;
  onViewAll?: (rowKey: string, fetchUrl: string, title: string) => void;
}

const NewPopularPage: React.FC<PageProps> = ({ onSelectMovie, onPlay, onViewAll }) => {
  const isMobile = useIsMobile();
  const { t } = useTranslation();
  const { rows, isLoading } = useDynamicManifest('new_popular');
  const { getRecommendedGenres } = useTasteEngine();
  const topGenres = getRecommendedGenres();

  // On mobile: hand off completely to the dedicated mobile page
  if (isMobile) {
    return <NewPopularMobilePage onSelectMovie={onSelectMovie} onPlay={onPlay} />;
  }

  // Desktop layout — unchanged
  return (
    <div className="relative min-h-screen bg-black md:bg-[#141414]">
      {/* Spacer for fixed Navbar */}
      <div className="h-20 sm:h-24 md:h-32" />

      <main className="relative z-10 pb-12 space-y-4 md:space-y-6">
        {isLoading ? (
          <ManifestSkeleton count={10} />
        ) : (
          <>
            {/* Taste Engine Personalization — surfaced at top */}
            {topGenres.length > 0 && (
              <Row
                title={t('taste.recommended', { defaultValue: 'Recommended For You' })}
                fetchUrl={REQUESTS.fetchByGenre('movie', topGenres[0])}
                onSelect={onSelectMovie}
                onPlay={onPlay}
                rowKey="taste-recommended"
                onViewAll={onViewAll}
              />
            )}

            {/* Dynamic Manifest Rows — rendered in manifest order, no manual slicing */}
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
                  rowKey={row.key}
                  onViewAll={onViewAll}
                />
              )
            ))}
          </>
        )}
      </main>
    </div>
  );
};

export default NewPopularPage;
