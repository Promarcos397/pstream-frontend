import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, Link } from 'react-router-dom';
import {
  SpeakerSlashIcon, SpeakerHighIcon, CheckIcon, PlusIcon,
  CaretDownIcon, BookOpenIcon, ArrowCounterClockwiseIcon, XIcon,
} from '@phosphor-icons/react';
import { useGlobalContext } from '../context/GlobalContext';
import { GENRES } from '../constants';
import { Movie } from '../types';
import { fetchData } from '../services/api';
import { TrailerPlayer } from './TrailerPlayer';
import { MaturityBadge, HoverProgressBar, getWatchData } from './MovieCardBadges';
import CinemaPlayButton from './CinemaPlayButton';
import TooltipWrapper from './TooltipWrapper';
import { RatingPill } from './MovieCardRating';

interface MovieCardPopupProps {
  movie: Movie;
  hoveredRect: DOMRect;
  hoverPosition: 'center' | 'left' | 'right';
  initialScroll: { x: number; y: number }; // NEW PROP
  imageSrc: string;
  logoUrl: string | null;
  logoDim: { ratio: number; isSquare: boolean };
  logoFaded: boolean;
  imgFailed: boolean;
  setImgFailed: (v: boolean) => void;
  isBook: boolean;
  isCinemaOnly: boolean;
  isActuallyPlaying: boolean;
  setIsActuallyPlaying: (v: boolean) => void;
  hasVideoEnded: boolean;
  setHasVideoEnded: (v: boolean) => void;
  replayCount: number;
  setReplayCount: React.Dispatch<React.SetStateAction<number>>;
  cardPlayerRef: React.RefObject<any>;
  cardTrailerTimeRef: React.MutableRefObject<number>;
  onOpenModal: () => void;
  onMouseLeave: () => void;
  onMouseEnter: () => void;
}

export const POPUP_W = 343;
export const TOP_OFFSET = -88;

export function calcPopupPosition(
  rect: DOMRect,
  pos: 'center' | 'left' | 'right',
  initialScroll: { x: number; y: number }
): { top: number; left: number } {
  let left: number;
  if (pos === 'left') {
    left = rect.left;
  } else if (pos === 'right') {
    left = rect.right - POPUP_W;
  } else {
    left = rect.left + rect.width / 2 - POPUP_W / 2;
  }
  left = Math.max(8, Math.min(left, window.innerWidth - POPUP_W - 8));
  
  // Use the LOCKED scroll variables, not the live window variables!
  return { 
    top: rect.top + initialScroll.y + TOP_OFFSET, 
    left: left + initialScroll.x 
  };
}

const MovieCardPopup = React.forwardRef<HTMLDivElement, MovieCardPopupProps>((
  {
    movie,
    hoveredRect,
    hoverPosition,
    initialScroll,
    imageSrc,
    logoUrl,
    logoDim,
    logoFaded,
    imgFailed,
    setImgFailed,
    isBook,
    isCinemaOnly,
    isActuallyPlaying,
    setIsActuallyPlaying,
    hasVideoEnded,
    setHasVideoEnded,
    replayCount,
    setReplayCount,
    cardPlayerRef,
    cardTrailerTimeRef,
    onOpenModal,
    onMouseLeave,
    onMouseEnter,
  },
  ref,
) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    myList, toggleList, rateMovie, getMovieRating,
    getVideoState, getLastWatchedEpisode, clearVideoState,
    globalMute, setGlobalMute, settings,
  } = useGlobalContext();
  
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    let raf1: number, raf2: number;
    raf1 = requestAnimationFrame(() => { raf2 = requestAnimationFrame(() => setMounted(true)); });
    return () => { cancelAnimationFrame(raf1); cancelAnimationFrame(raf2); };
  }, []);

  const [episodeName, setEpisodeName] = useState<string | null>(null);

  useEffect(() => {
    const isTV = movie.media_type === 'tv' || (!movie.media_type && !movie.title);
    if (!isTV) return;
    const ep = getLastWatchedEpisode(movie.id);
    if (!ep) return;
    let cancelled = false;
    fetchData(`/tv/${movie.id}/season/${ep.season}/episode/${ep.episode}`)
      .then((data: any) => { if (!cancelled && data?.name) setEpisodeName(data.name); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [movie.id, movie.media_type, movie.title, getLastWatchedEpisode]);

  const isAdded = myList.some(m => String(m.id) === String(movie.id));
  const rating = getMovieRating(movie.id);

  const transformOrigin =
    hoverPosition === 'left' ? 'top left'
    : hoverPosition === 'right' ? 'top right'
    : 'top center';

  const { top, left } = calcPopupPosition(hoveredRect, hoverPosition, initialScroll);

  return (
    <div
      ref={ref}
      data-popup="true"
      onClick={(e) => e.stopPropagation()}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={`transition-[opacity,transform] duration-200 ease-out ${mounted ? 'opacity-100 scale-100' : 'opacity-0 scale-[0.97]'}`}
      style={{
        position: 'absolute',
        top,
        left,
        width: POPUP_W,
        zIndex: 3,
        pointerEvents: 'auto',
        transformOrigin,
      }}
    >
      <div className="bg-[#141414] rounded-md overflow-hidden ring-1 ring-zinc-700/50 shadow-[0_2px_20px_rgba(0,0,0,0.65)]">

      <div className="relative w-full aspect-[16/9] bg-[#141414] overflow-hidden rounded-t-md" onClick={onOpenModal}>
        {!isBook && settings.autoplayPreviews ? (
          <>
            <img
              src={imageSrc}
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 scale-[1.05] ${isActuallyPlaying ? 'opacity-0' : 'opacity-100'}`}
              alt="preview"
            />
            <div className={`absolute inset-0 transition-opacity duration-300 overflow-hidden ${isActuallyPlaying ? 'opacity-100' : 'opacity-0'}`}>
              <TrailerPlayer
                key={`card-player-${replayCount}`}
                movie={movie}
                variant="card"
                cropFactor={1.35}
                onReady={() => {}}
                onPlay={() => setIsActuallyPlaying(true)}
                onPlayerReady={(p) => { cardPlayerRef.current = p; }}
                onTimeUpdate={(t) => { cardTrailerTimeRef.current = t; }}
                onEnded={() => {
                  setIsActuallyPlaying(false);
                  setHasVideoEnded(true);
                }}
                onErrored={() => setIsActuallyPlaying(false)}
              />
            </div>
          </>
        ) : (
          <img
            src={imageSrc}
            className="w-full h-full object-cover object-[50%_30%]"
            alt="preview"
          />
        )}

        {!isBook && settings.autoplayPreviews && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (hasVideoEnded) {
                clearVideoState(movie.id);
                setHasVideoEnded(false);
                setReplayCount(c => c + 1);
              } else {
                setGlobalMute(!globalMute);
              }
            }}
            className="absolute bottom-4 right-4 w-10 h-10 rounded-full border border-white/40 bg-zinc-800/80 flex items-center justify-center transition-colors duration-150 hover:bg-white/15 hover:border-white z-50 pointer-events-auto cursor-pointer shadow-lg"
          >
            {hasVideoEnded
              ? <ArrowCounterClockwiseIcon size={20} weight="bold" className="text-white" />
              : globalMute
                ? <SpeakerSlashIcon size={20} className="text-white" />
                : <SpeakerHighIcon size={18} className="text-white" />}
          </button>
        )}

        <div className="absolute inset-x-0 bottom-0 h-7 bg-gradient-to-t from-[#181818]/70 to-transparent z-10 pointer-events-none" />

        <div className={`absolute bottom-3 left-4 right-12 pointer-events-none z-20 transition-opacity duration-1000 ${logoFaded ? 'opacity-0' : 'opacity-100'}`}>
          {logoUrl && !imgFailed ? (
            <div className="relative inline-flex items-end max-w-[260px]">
              <img
                src={logoUrl}
                aria-hidden
                className={`absolute w-auto max-w-[260px] object-contain origin-bottom-left ${logoDim.isSquare ? 'h-14 md:h-20' : 'h-10 md:h-12'}`}
                style={{ filter: 'blur(4px) brightness(0) opacity(0.8)', transform: 'translate(1px, 2px) scale(1.01)', zIndex: 0 }}
              />
              <img
                src={logoUrl}
                aria-hidden
                className={`absolute w-auto max-w-[260px] object-contain origin-bottom-left ${logoDim.isSquare ? 'h-14 md:h-20' : 'h-10 md:h-12'}`}
                style={{ filter: 'blur(20px) brightness(0) opacity(0.5)', transform: 'translate(2px, 4px) scale(1.06)', zIndex: 0 }}
              />
              <img
                src={logoUrl}
                alt={movie.title || movie.name}
                className={`relative w-auto max-w-[260px] object-contain origin-bottom-left z-[1] ${logoDim.isSquare ? 'h-14 md:h-20' : 'h-10 md:h-12'}`}
                onError={() => setImgFailed(true)}
              />
            </div>
          ) : (
            <h4 className="text-white font-leaner text-4xl line-clamp-2 drop-shadow-md tracking-wide text-center mb-2 leading-none">
              {movie.title || movie.name}
            </h4>
          )}
        </div>
      </div>

      <div className="px-4 pt-6 pb-5 space-y-4 bg-[#181818]">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            {isBook ? (
              <TooltipWrapper label={t('common.readNow')}>
                <Link
                  to={`/watch/${movie.media_type === 'tv' || (!movie.media_type && !movie.title) ? 'tv' : 'movie'}/${movie.id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-white text-black rounded-full w-10 h-10 flex items-center justify-center hover:bg-neutral-200 transition shadow-md duration-200"
                >
                  <BookOpenIcon size={24} weight="fill" />
                </Link>
              </TooltipWrapper>
            ) : (
              <CinemaPlayButton movie={movie} variant="circular" isCinemaOnly={isCinemaOnly} />
            )}

            <TooltipWrapper label={isAdded ? t('modal.removeFromList') : t('modal.addToList')}>
              <button
                onClick={(e) => { e.stopPropagation(); toggleList(movie); }}
                className="border rounded-full w-10 h-10 flex items-center justify-center transition-colors duration-150 text-white border-white/40 bg-zinc-800/80 hover:bg-white/15 hover:border-white"
              >
                {isAdded ? <CheckIcon size={24} weight="bold" /> : <PlusIcon size={24} weight="bold" />}
              </button>
            </TooltipWrapper>

            <RatingPill rating={rating} onRate={(r) => rateMovie(movie, r)} />

            {getWatchData(movie, getLastWatchedEpisode, getVideoState).pct > 0 && (
              <TooltipWrapper label={t('common.removeContinue')}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    clearVideoState(movie.id);
                    onMouseLeave();
                  }}
                  className="border rounded-full w-10 h-10 flex items-center justify-center border-white/40 bg-zinc-800/80 hover:bg-white/15 hover:border-white transition-colors duration-150 text-white"
                >
                  <XIcon size={20} weight="bold" />
                </button>
              </TooltipWrapper>
            )}
          </div>

          <TooltipWrapper label={t('hero.moreInfo')}>
            <button
              onClick={onOpenModal}
              className="border rounded-full w-10 h-10 flex items-center justify-center border-white/40 bg-zinc-800/80 hover:bg-white/15 hover:border-white transition-colors duration-150 text-white"
            >
              <CaretDownIcon size={22} weight="bold" />
            </button>
          </TooltipWrapper>
        </div>

        {getWatchData(movie, getLastWatchedEpisode, getVideoState).pct <= 0 && (
          <div className="flex items-center flex-wrap gap-1.5 text-[13px] font-medium">
            <MaturityBadge adult={movie.adult} voteAverage={movie.vote_average} />

            {(() => {
              if (isBook) return <span className="text-white/70">{movie.media_type === 'series' ? 'Series' : 'Comic'}</span>;
              const isTV = movie.media_type === 'tv' || (!movie.media_type && !movie.title);
              if (isTV) {
                const s = movie.number_of_seasons;
                return <span className="text-white/70">{s ? `${s} ${s === 1 ? 'Season' : 'Seasons'}` : 'TV Series'}</span>;
              }
              if (!movie.runtime) return null;
              const h = Math.floor(movie.runtime / 60);
              const m = movie.runtime % 60;
              return <span className="text-white/70">{h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ''}` : `${m}m`}</span>;
            })()}

            {!isBook && <span className="border border-gray-300 text-gray-200 px-1 py-[2px] text-[14px] font-bold rounded-[2px] ml-3">HD</span>}
          </div>
        )}

        {getWatchData(movie, getLastWatchedEpisode, getVideoState).pct > 0 ? (
          <div className="pt-0.5 pb-1 space-y-1.5">
            {(() => {
              const isTV = movie.media_type === 'tv' || (!movie.media_type && !movie.title);
              const ep = isTV ? getLastWatchedEpisode(movie.id) : null;
              if (!ep) return null;
              return (
                <p className="text-white text-[12px] font-semibold truncate">
                  S{ep.season}:E{ep.episode}{episodeName ? ` "${episodeName}"` : ''}
                </p>
              );
            })()}
            <HoverProgressBar movie={movie} getLastWatchedEpisode={getLastWatchedEpisode} getVideoState={getVideoState} />
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-y-0.5 text-[12.5px] font-medium">
            {movie.genre_ids?.slice(0, 3).map((genreId, idx, arr) => {
              const isTV = movie.media_type === 'tv' || (!movie.media_type && !movie.title);
              const genreName = t(`genres.${genreId}`, { defaultValue: GENRES[genreId] });
              if (!genreName) return null;
              return (
                <span key={genreId} className="flex items-center">
                  <span
                    className="text-gray-400 hover:text-white cursor-pointer transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      onMouseLeave();
                      navigate(`/browse/genre-${genreId}?title=${encodeURIComponent(genreName)}&url=${encodeURIComponent(`/discover/${isTV ? 'tv' : 'movie'}?with_genres=${genreId}&sort_by=popularity.desc`)}`);
                    }}
                  >
                    {genreName}
                  </span>
                  {idx < arr.length - 1 && <span className="text-gray-500 mx-1.5 text-[16px] leading-none">•</span>}
                </span>
              );
            })}
          </div>
        )}
      </div>

      </div>
    </div>
  );
});

MovieCardPopup.displayName = 'MovieCardPopup';

export default MovieCardPopup;