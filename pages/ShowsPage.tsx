import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { REQUESTS } from '../constants';
import { Movie } from '../types';
import HeroCarousel from '../components/HeroCarousel';
import Row from '../components/Row';
import CharacterRow from '../components/CharacterRow';
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
                key="shows"
                fetchUrl={selectedGenre ? REQUESTS.fetchByGenre('tv', selectedGenre.id, 'popularity.desc') : REQUESTS.fetchTrendingTV}
                onSelect={onSelectMovie}
                onPlay={onPlay}
            />
            <main className="relative z-10 pb-12 -mt-12 sm:-mt-20 md:-mt-28 space-y-4 md:space-y-6">
                {!selectedGenre ? (
                    // 1. No Genre Selected -> Netflix generic themed rows
                    <>
                        <Row title={t('rows.boredomBusters', { defaultValue: 'Bingeworthy Picks' })} fetchUrl={REQUESTS.fetchBoredomBustersTV} onSelect={onSelectMovie} onPlay={onPlay} />
                        <Row title={t('rows.usSeries', { defaultValue: 'US Series' })} fetchUrl={REQUESTS.fetchUSSeries} onSelect={onSelectMovie} onPlay={onPlay} />
                        <Row title={t('rows.familiarFavorites', { defaultValue: 'Familiar Favourite Series' })} fetchUrl={REQUESTS.fetchFamiliarFavoritesTV} onSelect={onSelectMovie} onPlay={onPlay} />
                        <Row title={t('rows.excitingSeries', { defaultValue: 'Exciting Series' })} fetchUrl={REQUESTS.fetchExcitingSeriesTV} onSelect={onSelectMovie} onPlay={onPlay} />
                        <Row title={t('rows.weThinkYoullLove', { defaultValue: "We think you'll love these" })} fetchUrl={REQUESTS.fetchLoveTheseTV} onSelect={onSelectMovie} onPlay={onPlay} />
                        <Row title={t('rows.netflixOriginals', { defaultValue: 'Netflix Originals' })} fetchUrl={REQUESTS.fetchNetflixOriginals} onSelect={onSelectMovie} onPlay={onPlay} />
                    </>
                ) : (
                    // 2. Genre Selected -> Specific to that genre
                    <>
                        <Row title={t('rows.genreSeries', { genre: t(`genres.${selectedGenre.id}`, { defaultValue: selectedGenre.name }), defaultValue: `${selectedGenre.name} Series` })} fetchUrl={REQUESTS.fetchByGenre('tv', selectedGenre.id, 'popularity.desc')} onSelect={onSelectMovie} onPlay={onPlay} />
                        <Row title={t('rows.trendingGenre', { genre: t(`genres.${selectedGenre.id}`, { defaultValue: selectedGenre.name }), defaultValue: `Trending ${selectedGenre.name}` })} fetchUrl={REQUESTS.fetchByGenre('tv', selectedGenre.id, 'vote_count.desc')} onSelect={onSelectMovie} onPlay={onPlay} />
                        <Row title={t('rows.criticallyAcclaimedGenre', { genre: t(`genres.${selectedGenre.id}`, { defaultValue: selectedGenre.name }), defaultValue: `Critically Acclaimed ${selectedGenre.name}` })} fetchUrl={REQUESTS.fetchByGenre('tv', selectedGenre.id, 'vote_average.desc')} onSelect={onSelectMovie} onPlay={onPlay} />
                        <Row title={t('rows.latestReleases', { genre: t(`genres.${selectedGenre.id}`, { defaultValue: selectedGenre.name }), defaultValue: `Latest ${selectedGenre.name} Releases` })} fetchUrl={REQUESTS.fetchByGenre('tv', selectedGenre.id, 'first_air_date.desc')} onSelect={onSelectMovie} onPlay={onPlay} />
                    </>
                )}
            </main>
        </div>
    );
};

export default ShowsPage;
