import React, { useState, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLibraryStore } from '../store/useLibraryStore';
import { useShallow } from 'zustand/react/shallow';
import { useWatchStore } from '../store/useWatchStore';
import { Movie } from '../types';
import MovieCard from '../components/MovieCard';
import CategorySubNav, { Genre } from '../components/CategorySubNav';
import { PlaylistIcon } from '@phosphor-icons/react';
import Row from '../components/Row';
import { REQUESTS } from '../constants';
import { useTasteEngine } from '../hooks/useTasteEngine';
import { UNIVERSAL_GENRES } from '../data/pageGenres';
import { useIsMobile } from '../hooks/useIsMobile';
import MediaListItem from '../components/MediaListItem';

const detectMediaType = (m: Movie): 'tv' | 'movie' => {
  if (m.media_type === 'tv') return 'tv';
  if (m.media_type === 'movie') return 'movie';
  return m.name && !m.title ? 'tv' : 'movie';
};

// ─── Filter pill (same visual as CategorySubNavMobile) ────────────────────────
type PillPos = 'first' | 'mid' | 'last';
const FilterPill: React.FC<{
  label: string;
  active: boolean;
  onClick: () => void;
  pos: PillPos;
}> = ({ label, active, onClick, pos }) => {
  const radius =
    pos === 'first' ? 'rounded-l-[23px] rounded-r-[12px]'
    : pos === 'last'  ? 'rounded-r-[23px] rounded-l-[12px]'
    : 'rounded-[12px]';
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center h-[50px] px-[18px] text-[15px] font-semibold whitespace-nowrap active:scale-95 transition-all leading-none shrink-0 ${radius} ${
        active
          ? 'bg-white/[0.18] backdrop-blur-md text-white border-[1.6px] border-white/40'
          : 'bg-white/[0.06] backdrop-blur-md text-[#e5e5e5] border-[1.6px] border-white/15'
      }`}
    >
      {label}
    </button>
  );
};

// ─── Page ─────────────────────────────────────────────────────────────────────
interface PageProps {
  onSelectMovie: (movie: Movie) => void;
  onPlay?: (movie: Movie) => void;
  onViewAll?: (rowKey: string, fetchUrl: string, title: string) => void;
}

type TypeFilter   = 'tv' | 'movie' | null;
type StatusFilter = 'notStarted' | 'started' | null;

const MyListPage: React.FC<PageProps> = ({ onSelectMovie, onPlay, onViewAll }) => {
  const myList = useLibraryStore(useShallow(s => s.getListArray()));
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const location = useLocation();
  const stateGenre = location.state?.genre as Genre | null;

  // Desktop filter
  const [selectedGenre, setSelectedGenre] = useState<Genre | null>(stateGenre || null);

  // Mobile filters
  const [typeFilter,   setTypeFilter]   = useState<TypeFilter>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(null);
  const getProgress = useWatchStore(s => s.getProgress);

  const { getRecommendedGenres, getDislikedMovies } = useTasteEngine();
  const topGenres = getRecommendedGenres();
  const dislikedMovies = getDislikedMovies();

  // Desktop filtered list
  const processedList = useMemo(() => {
    let list = [...myList];
    if (selectedGenre) list = list.filter(m => m.genre_ids?.includes(selectedGenre.id));
    return list;
  }, [myList, selectedGenre]);

  // Mobile filtered list
  const mobilelist = useMemo(() => {
    let list = [...myList];
    if (typeFilter === 'tv')    list = list.filter(m => detectMediaType(m) === 'tv');
    if (typeFilter === 'movie') list = list.filter(m => detectMediaType(m) === 'movie');
    if (statusFilter === 'notStarted') list = list.filter(m => !getProgress(String(m.id)));
    if (statusFilter === 'started')    list = list.filter(m => { const p = getProgress(String(m.id)); return p && p.watchedTime > 0; });
    return list;
  }, [myList, typeFilter, statusFilter, getProgress]);

  const toggleType   = (v: TypeFilter)   => setTypeFilter(p   => p === v ? null : v);
  const toggleStatus = (v: StatusFilter) => setStatusFilter(p => p === v ? null : v);

  // ── Mobile layout ────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div className="relative min-h-screen bg-black">
        {/* Filter bar — fixed below the navbar */}
        <div className="fixed top-[calc(55px+env(safe-area-inset-top))] left-0 right-0 z-[78] bg-black/95 backdrop-blur-md pb-2 pt-1.5">
          <div className="flex items-center gap-1 px-4 overflow-x-auto scrollbar-hide">
            <FilterPill label={t('nav.shows', { defaultValue: 'Series' })}         active={typeFilter   === 'tv'}         onClick={() => toggleType('tv')}             pos="first" />
            <FilterPill label={t('nav.movies', { defaultValue: 'Films' })}         active={typeFilter   === 'movie'}      onClick={() => toggleType('movie')}          pos="mid"   />
            <FilterPill label={t('list.notStarted', { defaultValue: "Haven't started" })} active={statusFilter === 'notStarted'} onClick={() => toggleStatus('notStarted')}   pos="mid"   />
            <FilterPill label={t('list.started',    { defaultValue: 'Started' })}  active={statusFilter === 'started'}    onClick={() => toggleStatus('started')}      pos="last"  />
          </div>
        </div>

        {/* List content */}
        <div className="pt-[calc(118px+env(safe-area-inset-top))] pb-24">
          {myList.length === 0 ? (
            <div className="flex flex-col items-center justify-center mt-28 px-8 text-center animate-fadeIn">
              <div className="w-16 h-16 rounded-full bg-[#222] flex items-center justify-center mb-5 border border-white/5">
                <PlaylistIcon size={32} className="text-gray-600" />
              </div>
              <p className="text-lg font-semibold text-white">{t('list.empty')}</p>
              <p className="text-sm mt-2 text-gray-400">{t('list.emptyDesc')}</p>
            </div>
          ) : mobilelist.length === 0 ? (
            <div className="flex flex-col items-center justify-center mt-28 px-8 text-center animate-fadeIn">
              <p className="text-gray-400 text-[15px]">{t('list.noMatches')}</p>
              <button
                onClick={() => { setTypeFilter(null); setStatusFilter(null); }}
                className="mt-4 text-white text-sm underline active:opacity-60"
              >
                {t('list.reset')}
              </button>
            </div>
          ) : (
            <div className="animate-fadeIn">
              {mobilelist.map(movie => (
                <MediaListItem
                  key={movie.id}
                  movie={movie}
                  onSelect={onSelectMovie}
                  onPlay={onPlay}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Desktop layout (unchanged) ───────────────────────────────────────────
  return (
    <div className="relative min-h-screen">
      <CategorySubNav
        title="My List"
        genres={UNIVERSAL_GENRES}
        selectedGenre={selectedGenre}
        onGenreSelect={setSelectedGenre}
      />

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
              <button onClick={() => setSelectedGenre(null)} className="mt-4 text-white underline hover:text-gray-300">
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

      <div className="px-6 md:px-14 lg:px-20 pb-16 space-y-8">
        {/* Recommended For You row — temporarily disabled
        {topGenres.length > 0 && (
          <Row title={t('rows.recommendedForYou')} fetchUrl={REQUESTS.fetchByGenre('movie', topGenres[0])} onSelect={onSelectMovie} onPlay={onPlay} rowKey="mylist-taste-recommended" onViewAll={onViewAll} />
        )} */}
        {dislikedMovies.length > 0 && (
          <Row title={t('rows.hiddenDisliked')} data={dislikedMovies} onSelect={onSelectMovie} onPlay={onPlay} rowKey="mylist-disliked" />
        )}
      </div>
    </div>
  );
};

export default MyListPage;