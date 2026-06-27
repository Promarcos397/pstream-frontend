import React, { useState, useMemo, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLibraryStore } from '../store/useLibraryStore';
import { useShallow } from 'zustand/react/shallow';
import { useWatchStore } from '../store/useWatchStore';
import { Movie } from '../types';
import MovieCard from '../components/MovieCard';
import CategorySubNav, { Genre } from '../components/CategorySubNav';
import { PlaylistIcon, PlayIcon } from '@phosphor-icons/react';
import Row from '../components/Row';
import { REQUESTS } from '../constants';
import { useTasteEngine } from '../hooks/useTasteEngine';
import { UNIVERSAL_GENRES } from '../data/pageGenres';
import { useIsMobile } from '../hooks/useIsMobile';
import { getMovieImages, getCachedMovieImages } from '../services/api';

// ─── Media type helper (reliable even when media_type is missing) ─────────────
const detectMediaType = (m: Movie): 'tv' | 'movie' => {
  if (m.media_type === 'tv') return 'tv';
  if (m.media_type === 'movie') return 'movie';
  return m.name && !m.title ? 'tv' : 'movie';
};

// ─── Mobile list item ────────────────────────────────────────────────────────
const MyListItem: React.FC<{
  movie: Movie;
  onPlay?: (m: Movie) => void;
  onSelect: (m: Movie) => void;
}> = React.memo(({ movie, onPlay, onSelect }) => {
  const mediaType = detectMediaType(movie);
  const title = movie.title || movie.name || '';

  const backdropUrl = movie.backdrop_path
    ? `https://image.tmdb.org/t/p/w300${movie.backdrop_path}`
    : movie.poster_path
      ? `https://image.tmdb.org/t/p/w154${movie.poster_path}`
      : null;

  const [logoUrl, setLogoUrl] = useState<string | null | ''>(() => {
    const cached = getCachedMovieImages(String(movie.id), mediaType);
    if (!cached) return null;
    const logo = cached.logos?.find((l: any) => l.iso_639_1 === 'en' || !l.iso_639_1);
    return logo ? `https://image.tmdb.org/t/p/w185${logo.file_path}` : '';
  });

  useEffect(() => {
    if (logoUrl !== null) return;
    getMovieImages(String(movie.id), mediaType).then((data: any) => {
      const logo = data?.logos?.find((l: any) => l.iso_639_1 === 'en' || !l.iso_639_1);
      setLogoUrl(logo ? `https://image.tmdb.org/t/p/w185${logo.file_path}` : '');
    });
  }, [movie.id, mediaType, logoUrl]);

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 active:bg-white/[0.04] transition-colors"
      onClick={() => onSelect(movie)}
    >
      {/* Backdrop + logo */}
      <div className="relative w-[148px] h-[83px] rounded-[7px] overflow-hidden flex-shrink-0 bg-[#1c1c1c]">
        {backdropUrl && (
          <img
            src={backdropUrl}
            alt={title}
            className="w-full h-full object-cover"
            loading="lazy"
            decoding="async"
          />
        )}
        {/* Logo centred-bottom over backdrop */}
        {logoUrl && (
          <div className="absolute inset-0 flex items-end justify-center pb-2 px-2">
            <img
              src={logoUrl}
              alt={title}
              className="max-w-[85%] max-h-[52%] object-contain drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]"
              loading="lazy"
              decoding="async"
            />
          </div>
        )}
      </div>

      {/* Title */}
      <p className="flex-1 min-w-0 text-white font-semibold text-[17px] leading-snug line-clamp-2">
        {title}
      </p>

      {/* Play button — stroke only, no background fill */}
      <button
        className="w-[48px] h-[48px] rounded-full border-[2px] border-white flex items-center justify-center flex-shrink-0 active:scale-90 transition-transform"
        onClick={e => { e.stopPropagation(); onPlay?.(movie); }}
        aria-label={`Play ${title}`}
      >
        <PlayIcon size={26} weight="fill" className="text-white ml-[2px]" />
      </button>
    </div>
  );
});

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
                <MyListItem
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
        {topGenres.length > 0 && (
          <Row title={t('rows.recommendedForYou')} fetchUrl={REQUESTS.fetchByGenre('movie', topGenres[0])} onSelect={onSelectMovie} onPlay={onPlay} rowKey="mylist-taste-recommended" onViewAll={onViewAll} />
        )}
        {dislikedMovies.length > 0 && (
          <Row title={t('rows.hiddenDisliked')} data={dislikedMovies} onSelect={onSelectMovie} onPlay={onPlay} rowKey="mylist-disliked" />
        )}
      </div>
    </div>
  );
};

export default MyListPage;