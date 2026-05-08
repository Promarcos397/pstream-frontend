import React from 'react';
import { useTranslation } from 'react-i18next';
import { REQUESTS } from '../constants';
import { Movie } from '../types';
import Row from '../components/Row';
import TopTenRow from '../components/TopTenRow';
import { useGlobalContext } from '../context/GlobalContext';
import { useDynamicManifest } from '../hooks/useDynamicManifest';

interface PageProps {
  onSelectMovie: (movie: Movie) => void;
}

const NewPopularPage: React.FC<PageProps> = ({ onSelectMovie }) => {
  const { t } = useTranslation();

  // Comic Top 10 Logic
  const [topComics, setTopComics] = React.useState<Movie[]>([]);

  React.useEffect(() => {
    const fetchComics = async () => {
      try {
        // Comic fetching currently disabled
      } catch (e) {
        console.error("Failed to load top comics", e);
      }
    };
    fetchComics();
  }, []);

  const rows = useDynamicManifest('new_popular'); // Use dedicated massive layout for New & Popular

  return (
    <div className="min-h-screen bg-[#141414]">
      {/* Spacer for fixed Navbar */}
      <div className="h-20 sm:h-24 md:h-32" />

      {/* Removed overflow-hidden */}
      <main className="relative z-10 pb-12 space-y-6 md:space-y-10 lg:space-y-12">

        <div className="px-6 md:px-14 lg:px-20 mt-2 mb-2">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white drop-shadow-md">{t('nav.newPopular')}</h1>
        </div>

        {/* Dynamic Rows with Comics integration */}
        {rows.slice(0, 3).map(row => (
           row.type === 'top10' ? (
             <TopTenRow key={row.key} title={row.title} fetchUrl={row.fetchUrl} onSelect={onSelectMovie} />
           ) : (
             <Row key={row.key} title={row.title} fetchUrl={row.fetchUrl} data={row.data} onSelect={onSelectMovie} />
           )
        ))}

        {topComics.length > 0 && (
          <TopTenRow
            title="Top 10 Comics Today"
            data={topComics}
            onSelect={onSelectMovie}
          />
        )}

        {rows.slice(3).map(row => (
           row.type === 'top10' ? (
             <TopTenRow key={row.key} title={row.title} fetchUrl={row.fetchUrl} onSelect={onSelectMovie} />
           ) : (
             <Row key={row.key} title={row.title} fetchUrl={row.fetchUrl} data={row.data} onSelect={onSelectMovie} />
           )
        ))}
      </main>
    </div>
  );
};

export default NewPopularPage;