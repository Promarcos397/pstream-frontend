import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { REQUESTS } from '../constants';
import { Movie } from '../types';
import HeroCarousel from '../components/HeroCarousel';
import Row from '../components/Row';
import CategorySubNav, { Genre } from '../components/CategorySubNav';

import { useGlobalContext } from '../context/GlobalContext';

interface PageProps {
  onSelectMovie: (movie: Movie, time?: number, videoId?: string) => void;
  onPlay: (movie: Movie) => void;
  seekTime?: number;
}

const TV_GENRES = [
  { id: 10759, name: 'Action & Adventure' },
  { id: 16, name: 'Animation' },
  { id: 35, name: 'Comedy' },
  { id: 80, name: 'Crime' },
  { id: 99, name: 'Documentary' },
  { id: 18, name: 'Drama' },
  { id: 10751, name: 'Family' },
  { id: 10762, name: 'Kids' },
  { id: 9648, name: 'Mystery' },
  { id: 10763, name: 'News' },
  { id: 10764, name: 'Reality' },
  { id: 10765, name: 'Sci-Fi & Fantasy' },
  { id: 10766, name: 'Soap' },
  { id: 10767, name: 'Talk' },
  { id: 10768, name: 'War & Politics' },
  { id: 37, name: 'Western' },
];

const TVShowsPage: React.FC<PageProps> = ({ onSelectMovie, onPlay, seekTime }) => {
  const { t } = useTranslation();
  const { continueWatching } = useGlobalContext();
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

      <HeroCarousel key="tv" onSelect={onSelectMovie} onPlay={onPlay} fetchUrl={selectedGenre ? REQUESTS.fetchByGenre('tv', selectedGenre.id, 'popularity.desc') : REQUESTS.fetchTrendingTV} seekTime={seekTime} />

      <main className="relative z-10 pb-12 -mt-12 sm:-mt-20 md:-mt-28 space-y-4 md:space-y-6">
        {!selectedGenre ? (
          <>
            <Row title="Netflix Originals" fetchUrl={REQUESTS.fetchNetflixOriginals} onSelect={onSelectMovie} />
            <Row title="Action & Adventure" fetchUrl={REQUESTS.fetchActionTV} onSelect={onSelectMovie} />

            {continueWatching.length > 0 && (
              <Row title={t('rows.continueWatching', { defaultValue: 'Continue Watching' })} data={continueWatching} onSelect={onSelectMovie} />
            )}

            <Row title="Reality" fetchUrl={REQUESTS.fetchRealityTV} onSelect={onSelectMovie} />
            <Row title="Comedies" fetchUrl={REQUESTS.fetchComedyTV} onSelect={onSelectMovie} />
            <Row title="Dramas" fetchUrl={REQUESTS.fetchDramaTV} onSelect={onSelectMovie} />
            <Row title={t('rows.documentaries')} fetchUrl={REQUESTS.fetchDocumentaries} onSelect={onSelectMovie} />
            <Row title="Crime" fetchUrl={REQUESTS.fetchCrimeTV} onSelect={onSelectMovie} />
          </>
        ) : (
          <>
            <Row title={`${selectedGenre.name} Series`} fetchUrl={REQUESTS.fetchByGenre('tv', selectedGenre.id, 'popularity.desc')} onSelect={onSelectMovie} />
            <Row title={`Trending ${selectedGenre.name}`} fetchUrl={REQUESTS.fetchByGenre('tv', selectedGenre.id, 'vote_count.desc')} onSelect={onSelectMovie} />
            <Row title={`Critically Acclaimed ${selectedGenre.name}`} fetchUrl={REQUESTS.fetchByGenre('tv', selectedGenre.id, 'vote_average.desc')} onSelect={onSelectMovie} />
          </>
        )}
      </main>
    </div>
  );
};

export default TVShowsPage;