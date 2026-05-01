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
        const electron = (window as any).electron;
        if (electron?.cloud?.getLibrary) {
          const res = await electron.cloud.getLibrary();
          if (res.success && res.data.length > 0) {
            // 1. Unique Series Map
            const seriesMap = new Map();
            res.data.forEach((issue: any) => {
              const seriesTitle = issue.series?.title || issue.title?.split('#')[0].trim() || 'Unknown';
              if (issue.cover_google_id) {
                const existing = seriesMap.get(seriesTitle);
                // Prefer entries with real series_id (like 47 for Invincible)
                const isBetter = !existing || (!existing._hasSeriesId && issue.series_id);
                if (isBetter) {
                  seriesMap.set(seriesTitle, {
                    id: issue.series_id || issue.id,
                    title: seriesTitle,
                    name: seriesTitle,
                    overview: issue.series?.description || issue.description,
                    backdrop_path: `comic://image?id=${issue.cover_google_id}`,
                    poster_path: `comic://image?id=${issue.cover_google_id}`,
                    media_type: 'series',
                    vote_average: 9.5,
                    _hasSeriesId: !!issue.series_id, // Internal flag
                  } as Movie);
                }
              }
            });

            let allSeries = Array.from(seriesMap.values());
            if (allSeries.length < 9) return; // Need at least 9 for a top 10 list

            // 2. Filter "Invincible" (ID: 47) - Check both string and number
            const invincibleIndex = allSeries.findIndex(s =>
              s.id == 47 || (s.title || '').toLowerCase().includes('invincible')
            );

            let invincible: Movie | null = null;
            if (invincibleIndex !== -1) {
              invincible = allSeries[invincibleIndex];
              allSeries.splice(invincibleIndex, 1); // Remove from pool
            }

            // 3. Random Seeded Shuffle (Daily)
            const today = new Date().toDateString();
            let seed = 0;
            for (let i = 0; i < today.length; i++) {
              seed = ((seed << 5) - seed) + today.charCodeAt(i);
              seed |= 0;
            }

            const seededRandom = () => {
              const x = Math.sin(seed++) * 10000;
              return x - Math.floor(x);
            };

            // Shuffle remaining series
            for (let i = allSeries.length - 1; i > 0; i--) {
              const j = Math.floor(seededRandom() * (i + 1));
              [allSeries[i], allSeries[j]] = [allSeries[j], allSeries[i]];
            }

            // Take top 9 or 10 (leave room for Invincible if found)
            const limit = invincible ? 9 : 10;
            const topList = allSeries.slice(0, limit);

            // 4. Insert Invincible in Top 5
            if (invincible) {
              // Random index 0-4
              const insertIndex = Math.floor(seededRandom() * 5);
              topList.splice(insertIndex, 0, invincible);
            }

            setTopComics(topList); // Always 10 items
          }
        }
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