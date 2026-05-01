import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { REQUESTS } from '../constants';
import { Movie } from '../types';
import HeroCarousel from '../components/HeroCarousel';
import Row from '../components/Row';
import TopTenRow from '../components/TopTenRow';
import { useDynamicManifest } from '../hooks/useDynamicManifest';
import CategorySubNav, { Genre } from '../components/CategorySubNav';
import { useGlobalContext } from '../context/GlobalContext';

const TV_GENRES = [
    { id: 10759, name: 'Action & Adventure' },
    { id: 16, name: 'Animation' },
    { id: 35, name: 'Comedy' },
    { id: 80, name: 'Crime' },
    { id: 99, name: 'Documentary' },
    { id: 18, name: 'Drama' },
    { id: 10751, name: 'Family' },
    { id: 9648, name: 'Mystery' },
    { id: 10763, name: 'News' },
    { id: 10764, name: 'Reality' },
    { id: 10765, name: 'Sci-Fi & Fantasy' },
    { id: 10766, name: 'Soap' },
    { id: 10767, name: 'Talk' },
    { id: 10768, name: 'War & Politics' },
    { id: 37, name: 'Western' },
];

interface PageProps {
    onSelectMovie: (movie: Movie, time?: number, videoId?: string) => void;
    onPlay: (movie: Movie) => void;
}

const ShowsPage: React.FC<PageProps> = ({ onSelectMovie, onPlay }) => {
    const { t } = useTranslation();
    const [selectedGenre, setSelectedGenre] = useState<Genre | null>(null);
    const rows = useDynamicManifest('tv', selectedGenre?.id);

    return (
        <div className="relative">
            {/* Netflix-style sub-navigation: Overlaid on top of Hero */}
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
            />
            {/* THEME_TOGGLE: ROW_POSITION - Adjust negative margin to move rows up/down relative to Hero */}
            <main className="relative z-10 pb-12 -mt-8 sm:-mt-14 md:-mt-20 space-y-4 md:space-y-6">
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

export default ShowsPage;
