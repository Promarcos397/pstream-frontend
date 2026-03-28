import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useGlobalContext } from '../context/GlobalContext';
import { Movie } from '../types';
import MovieCard from '../components/MovieCard';
import { CaretDownIcon, PlaylistIcon } from '@phosphor-icons/react';

interface PageProps {
  onSelectMovie: (movie: Movie) => void;
}

type FilterType = 'all' | 'movie' | 'tv' | 'comic';
type SortType = 'date_added' | 'title' | 'rating' | 'release_date';

const MyListPage: React.FC<PageProps> = ({ onSelectMovie }) => {
  const { myList, isKidsMode } = useGlobalContext();
  const { t } = useTranslation();
  const [filter, setFilter] = useState<FilterType>('all');
  const [sort, setSort] = useState<SortType>('date_added');

  const processedList = useMemo(() => {
    // Create a shallow copy to sort/filter
    let list = [...myList];

    // Kids Filter
    if (isKidsMode) {
      list = list.filter(m => {
        // Kids genres ID matching: 10762 (Kids TV), 10751 (Family), 16 (Animation)
        if (!m.genre_ids) return false;
        return m.genre_ids.some(id => [10762, 10751, 16].includes(id));
      });
    }

    // 1. Media Type Filter
    if (filter !== 'all') {
      list = list.filter(m => {
        const type = m.media_type || (m.title ? 'movie' : 'tv');

        // Group all book types under 'comic'
        if (filter === 'comic') {
          return ['series', 'comic', 'manga', 'local'].includes(type);
        }

        return type === filter;
      });
    }

    // 2. Sort
    switch (sort) {
      case 'title':
        list.sort((a, b) => {
          const titleA = a.title || a.name || '';
          const titleB = b.title || b.name || '';
          return titleA.localeCompare(titleB);
        });
        break;
      case 'rating':
        list.sort((a, b) => b.vote_average - a.vote_average);
        break;
      case 'release_date':
        list.sort((a, b) => {
          const dateA = new Date(a.release_date || a.first_air_date || 0).getTime();
          const dateB = new Date(b.release_date || b.first_air_date || 0).getTime();
          return dateB - dateA;
        });
        break;
      case 'date_added':
      default:
        list.reverse();
        break;
    }

    return list;
  }, [myList, filter, sort]);

  return (
    <div className="pt-28 px-6 md:px-14 lg:px-20 pb-12 min-h-screen">
      <h2 className="text-2xl md:text-3xl font-normal text-white mb-10 tracking-wide">
        {isKidsMode ? 'Kids List' : 'My List'}
      </h2>

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
              onClick={() => { setFilter('all'); setSort('date_added'); }}
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
  );
};

export default MyListPage;