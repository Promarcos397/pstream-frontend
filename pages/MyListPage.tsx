import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useGlobalContext } from '../context/GlobalContext';
import { Movie } from '../types';
import MovieCard from '../components/MovieCard';
import CategorySubNav, { Genre } from '../components/CategorySubNav';
import { PlaylistIcon } from '@phosphor-icons/react';

interface PageProps {
  onSelectMovie: (movie: Movie) => void;
}

type FilterType = 'all' | 'movie' | 'tv' | 'comic';
type SortType = 'date_added' | 'title' | 'rating' | 'release_date';

const MY_LIST_GENRES = [
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
  { id: 9648, name: 'Mystery' },
  { id: 10749, name: 'Romance' },
  { id: 878, name: 'Science Fiction' },
  { id: 53, name: 'Thriller' },
  { id: 10752, name: 'War' },
  { id: 37, name: 'Western' }
];

const MyListPage: React.FC<PageProps> = ({ onSelectMovie }) => {
  const { myList, isKidsMode } = useGlobalContext();
  const { t } = useTranslation();
  const [filter, setFilter] = useState<FilterType>('all');
  const [sort, setSort] = useState<SortType>('date_added');
  const [selectedGenre, setSelectedGenre] = useState<Genre | null>(null);

  const processedList = useMemo(() => {
    let list = [...myList];

    // Kids Filter
    if (isKidsMode) {
      list = list.filter(m => {
        if (!m.genre_ids) return false;
        return m.genre_ids.some(id => [10762, 10751, 16].includes(id));
      });
    }

    // 1. Media Type Filter
    if (filter !== 'all') {
      list = list.filter(m => {
        const type = m.media_type || (m.title ? 'movie' : 'tv');
        if (filter === 'comic') return ['series', 'comic', 'manga', 'local'].includes(type);
        return type === filter;
      });
    }

    // 2. Genre Filter
    if (selectedGenre) {
      list = list.filter(m => m.genre_ids?.includes(selectedGenre.id));
    }

    // 3. Sort
    switch (sort) {
      case 'title':
        list.sort((a, b) => (a.title || a.name || '').localeCompare(b.title || b.name || ''));
        break;
      case 'rating':
        list.sort((a, b) => b.vote_average - a.vote_average);
        break;
      case 'release_date':
        list.sort((a, b) => new Date(b.release_date || b.first_air_date || 0).getTime() - new Date(a.release_date || a.first_air_date || 0).getTime());
        break;
      case 'date_added':
      default:
        list.reverse();
        break;
    }

    return list;
  }, [myList, filter, sort, selectedGenre, isKidsMode]);

  return (
    <div className="relative min-h-screen">
      {/* Dynamic Sub-Nav for My List */}
      <div className="absolute top-16 md:top-20 left-0 right-0 w-full z-40 pointer-events-auto">
        <CategorySubNav
          title={isKidsMode ? 'Kids List' : 'My List'}
          genres={MY_LIST_GENRES}
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
                  <MovieCard movie={movie} onSelect={onSelectMovie} isGrid={true} />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-gray-400 mt-20 text-center animate-fadeIn">
              <p>{t('list.noMatches')}</p>
              <button
                onClick={() => { setFilter('all'); setSort('date_added'); setSelectedGenre(null); }}
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
    </div>
  );
};

export default MyListPage;