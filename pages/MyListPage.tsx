import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useGlobalContext } from '../context/GlobalContext';
import { Movie } from '../types';
import MovieCard from '../components/MovieCard';
import CategorySubNav, { Genre } from '../components/CategorySubNav';
import { PlaylistIcon } from '@phosphor-icons/react';
import Row from '../components/Row';
import { REQUESTS } from '../constants';
import { useTasteEngine } from '../hooks/useTasteEngine';
import { UNIVERSAL_GENRES } from '../data/pageGenres';

interface PageProps {
  onSelectMovie: (movie: Movie) => void;
  onPlay?: (movie: Movie) => void;
  onViewAll?: (rowKey: string, fetchUrl: string, title: string) => void;
}

const MyListPage: React.FC<PageProps> = ({ onSelectMovie, onPlay, onViewAll }) => {
  const { myList, isKidsMode } = useGlobalContext();
  const { t } = useTranslation();
  const [selectedGenre, setSelectedGenre] = useState<Genre | null>(null);

  const { getRecommendedGenres, getDislikedMovies } = useTasteEngine();
  const topGenres = getRecommendedGenres();
  const dislikedMovies = getDislikedMovies();

  const processedList = useMemo(() => {
    let list = [...myList];

    // Kids Filter
    if (isKidsMode) {
      list = list.filter(m => {
        if (!m.genre_ids) return false;
        return m.genre_ids.some(id => [10762, 10751, 16].includes(id));
      });
    }

    // Genre Filter via CategorySubNav
    if (selectedGenre) {
      list = list.filter(m => m.genre_ids?.includes(selectedGenre.id));
    }

    return list;
  }, [myList, selectedGenre, isKidsMode]);

  return (
    <div className="relative min-h-screen">
      {/* Genre Sub-Nav — same pattern as MoviesPage & ShowsPage */}
      <div className="absolute top-16 md:top-20 left-0 right-0 w-full z-40 pointer-events-auto">
        <CategorySubNav
          title={isKidsMode ? 'Kids List' : 'My List'}
          genres={UNIVERSAL_GENRES}
          selectedGenre={selectedGenre}
          onGenreSelect={setSelectedGenre}
        />
      </div>

      <div className="pt-36 md:pt-44 px-6 md:px-14 lg:px-20 pb-12">
        {myList.length > 0 ? (
          processedList.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-6 gap-y-10 animate-fadeIn">
              {processedList.map(movie => (
                <div key={movie.id} className="relative group">
                  <MovieCard movie={movie} onSelect={onSelectMovie} onPlay={onPlay} isGrid={true} />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-gray-400 mt-20 text-center animate-fadeIn">
              <p>{t('list.noMatches')}</p>
              <button
                onClick={() => setSelectedGenre(null)}
                className="mt-4 text-white underline hover:text-gray-300"
              >
                {t('list.reset')}
              </button>
            </div>
          )
        ) : (
          <div className="flex flex-col items-center justify-center mt-32 text-gray-500 animate-fadeIn">
            <div className="w-20 h-20 rounded-full bg-[#222] flex items-center justify-center mb-6 border border-white/5">
              <PlaylistIcon size={40} className="text-gray-600" />
            </div>
            <p className="text-xl font-medium text-gray-300">{t('list.empty')}</p>
            <p className="text-sm mt-2 max-w-md text-center">{t('list.emptyDesc')}</p>
          </div>
        )}
      </div>

      {/* Taste Engine Sections */}
      {!isKidsMode && (
        <div className="px-6 md:px-14 lg:px-20 pb-16 space-y-8">
          {topGenres.length > 0 && (
            <Row
              title="Recommended For You"
              fetchUrl={REQUESTS.fetchByGenre('movie', topGenres[0])}
              onSelect={onSelectMovie}
              onPlay={onPlay}
              rowKey="mylist-taste-recommended"
              onViewAll={onViewAll}
            />
          )}

          {dislikedMovies.length > 0 && (
            <Row
              title="Hidden & Disliked"
              data={dislikedMovies}
              onSelect={onSelectMovie}
              onPlay={onPlay}
              rowKey="mylist-disliked"
            />
          )}
        </div>
      )}
    </div>
  );
};

export default MyListPage;