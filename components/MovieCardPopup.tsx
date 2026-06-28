import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useNavigate, Link } from 'react-router-dom';
import {
  SpeakerSlashIcon, SpeakerHighIcon, CheckIcon, PlusIcon,
  CaretDownIcon, BookOpenIcon, ArrowCounterClockwiseIcon, XIcon,
} from '@phosphor-icons/react';
import { useGlobalContext } from '../context/GlobalContext';
import { GENRES } from '../constants';
import { Movie } from '../types';
import { fetchData, getMovieDetails, getMovieCredits, getRecommendations, getMovieImages, getSeasonDetails, getCachedData } from '../services/api';
import { TrailerPlayer } from './TrailerPlayer';
import { MaturityBadge, HoverProgressBar, getWatchData } from './MovieCardBadges';
import CinemaPlayButton from './CinemaPlayButton';
import TooltipWrapper from './TooltipWrapper';
import { RatingPill } from './MovieCardRating';

interface MovieCardPopupProps {
  movie: Movie;
  hoveredRect: DOMRect;
  hoverPosition: 'center' | 'left' | 'right';
  initialScroll: { x: number; y: number };
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
  onMediaHoverChange: (hovered: boolean) => void;
}

const _episodeNameCache = new Map<string, string>();

export const POPUP_W = 341;
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
  let appX = 16;
  if (window.innerWidth >= 1024) appX = 56;
  else if (window.innerWidth >= 768) appX = 48;

  left = Math.max(appX, Math.min(left, window.innerWidth - POPUP_W - appX));
  
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
    onMediaHoverChange,
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
  
  const fetchedRef = useRef(false);
  const [cert, setCert] = useState<string | undefined>(movie.certification);
  const [runtime, setRuntime] = useState<number | undefined>(movie.runtime);

  // Pre-warm the modal data cache while the popup is visible so InfoModal opens instantly.
  // Season 1 is also fetched here so the episode name is in _dataCache synchronously.
  useEffect(() => {
    const mt = (movie.media_type || (movie.title ? 'movie' : 'tv')) as 'movie' | 'tv';
    getMovieDetails(movie.id, mt).then((d: any) => {
      if (d?.certification) setCert(d.certification);
      const rt = d?.runtime || d?.episode_run_time?.[0];
      if (rt) setRuntime(rt);
    });
    getMovieCredits(movie.id, mt);
    getRecommendations(movie.id, mt);
    getMovieImages(String(movie.id), mt);
    if (mt === 'tv') getSeasonDetails(movie.id, 1);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const isTV = movie.media_type === 'tv' || (!movie.media_type && !movie.title);
  const _watchedEp = isTV ? getLastWatchedEpisode(movie.id) : null;
  const _epS = _watchedEp?.season ?? 1;
  const _epE = _watchedEp?.episode ?? 1;

  // Resolve episode name: try _dataCache synchronously first, then async fallback.
  const [episodeName, setEpisodeName] = useState<string | null>(() => {
    if (!isTV) return null;
    const cached = getCachedData(`/tv/${movie.id}/season/${_epS}`);
    const ep = cached?.episodes?.find((e: any) => e.episode_number === _epE);
    if (ep?.name) {
      _episodeNameCache.set(`${movie.id}-s${_epS}e${_epE}`, ep.name);
      return ep.name;
    }
    const directKey = `${movie.id}-s${_epS}e${_epE}`;
    return _episodeNameCache.get(directKey) ?? null;
  });

  useEffect(() => {
    if (!isTV || episodeName) return;
    const cacheKey = `${movie.id}-s${_epS}e${_epE}`;
    if (_episodeNameCache.has(cacheKey)) { setEpisodeName(_episodeNameCache.get(cacheKey)!); return; }
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    let cancelled = false;
    getSeasonDetails(movie.id, _epS)
      .then((data: any) => {
        if (cancelled) return;
        const ep = data?.episodes?.find((e: any) => e.episode_number === _epE);
        if (ep?.name) {
          _episodeNameCache.set(cacheKey, ep.name);
          setEpisodeName(ep.name);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [isTV, episodeName]); // eslint-disable-line react-hooks/exhaustive-deps

  const isAdded = myList.some(m => String(m.id) === String(movie.id));
  const rating = getMovieRating(movie.id);
  const watchPct = getWatchData(movie, getLastWatchedEpisode, getVideoState).pct;

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
      className="pointer-events-auto"
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
      <motion.div
        className="bg-[#181818] rounded-md overflow-hidden shadow-[0_2px_20px_rgba(0,0,0,0.65)]"
        initial={{ opacity: 0, y: 22, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.95 }}
        transition={{ duration: 0.05, ease: [0.25, 1, 0.5, 1], opacity: { duration: 0.05 } }}
        style={{ willChange: 'transform, opacity' }}
      >

      <div className="relative w-full aspect-[16/9] bg-[#141414] overflow-hidden rounded-t-md" onClick={() => { const mt = movie.media_type === 'tv' || (!movie.media_type && !movie.title) ? 'tv' : 'movie'; navigate(`/watch/${mt}/${movie.id}`); }} onMouseEnter={() => onMediaHoverChange(true)} onMouseLeave={() => onMediaHoverChange(false)}>
        {!isBook && settings.autoplayPreviews ? (
          <>
            <img
              src={imageSrc}
              className={`absolute inset-0 w-full h-full object-cover backdrop-pop transition-opacity duration-300 scale-[1.05] ${isActuallyPlaying ? 'opacity-0' : 'opacity-100'}`}
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
            className="w-full h-full object-cover backdrop-pop object-[50%_30%]"
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
            className={`absolute bottom-3 right-3 w-7 h-7 rounded-full border border-white/40 flex items-center justify-center hover:bg-white/20 hover:border-white/70 z-50 pointer-events-auto cursor-pointer ${logoFaded ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
            style={{ transition: 'background-color 150ms, border-color 150ms, opacity 1000ms' }}
          >
            {hasVideoEnded
              ? <ArrowCounterClockwiseIcon size={15} weight="bold" className="text-white" />
              : globalMute
                ? <SpeakerSlashIcon size={15} className="text-white" />
                : <SpeakerHighIcon size={14} className="text-white" />}
          </button>
        )}

        <div className="absolute inset-x-0 bottom-0 h-7 bg-gradient-to-t from-[#181818]/70 to-transparent z-10 pointer-events-none" />

        <div className={`absolute bottom-3 left-4 right-12 pointer-events-none z-20 transition-opacity duration-1000 ${logoFaded ? 'opacity-0' : 'opacity-100'}`}>
          {logoUrl && !imgFailed ? (
            <img
              src={logoUrl}
              alt={movie.title || movie.name}
              className={`w-auto h-auto object-contain origin-bottom-left max-w-[210px] ${
                logoDim.ratio > 6    ? 'max-h-[24px]' :
                logoDim.ratio > 5    ? 'max-h-[27px]' :
                logoDim.ratio > 4    ? 'max-h-[30px]' :
                logoDim.ratio > 3.5  ? 'max-h-[33px]' :
                logoDim.ratio > 3    ? 'max-h-[36px]' :
                logoDim.ratio > 2.5  ? 'max-h-[39px]' :
                logoDim.ratio > 2    ? 'max-h-[43px]' :
                logoDim.ratio > 1.7  ? 'max-h-[47px]' :
                logoDim.ratio > 1.35 ? 'max-h-[51px]' :
                logoDim.ratio > 1.1  ? 'max-h-[55px]' :
                logoDim.ratio > 0.8  ? 'max-h-[59px]' :
                logoDim.ratio > 0.6  ? 'max-h-[63px]' :
                                       'max-h-[67px]'
              }`}
              style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.6))' }}
              onError={() => setImgFailed(true)}
            />
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

            {watchPct > 0 && (
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

        {watchPct <= 0 && (
          <div className="flex items-center flex-wrap gap-1.5 text-[15px] font-medium">
            <MaturityBadge adult={movie.adult} voteAverage={movie.vote_average} certification={cert} />

            {(() => {
              const fmtRuntime = (mins: number) => {
                const h = Math.floor(mins / 60), m = mins % 60;
                return h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ''}` : `${m}m`;
              };
              if (isBook) return <span className="text-white">{movie.media_type === 'series' ? t('common.series', { defaultValue: 'Series' }) : t('badge.comic', { defaultValue: 'Comic' })}</span>;
              const isTV = movie.media_type === 'tv' || (!movie.media_type && !movie.title);
              if (isTV) {
                const s = movie.number_of_seasons;
                return <>
                  <span className="text-white">{s ? t('common.seasonCount', { count: s }) : t('common.tv', { defaultValue: 'TV' })}</span>
                  {runtime && <span className="text-white/70">{fmtRuntime(runtime)}</span>}
                </>;
              }
              if (!runtime) return null;
              return <span className="text-white">{fmtRuntime(runtime)}</span>;
            })()}
          </div>
        )}

        {(() => {
          if (!isTV || isBook || watchPct <= 0) return null;
          return (
            <div className="space-y-1">
              <p className="text-white text-[17px] font-medium truncate">
                {t('player.episodeCode', { season: _epS, episode: _epE })}{episodeName ? ` "${episodeName}"` : ''}
              </p>
              <HoverProgressBar movie={movie} getLastWatchedEpisode={getLastWatchedEpisode} getVideoState={getVideoState} />
            </div>
          );
        })()}

        {(() => {
          // Movie in-progress: show progress bar (TV handles it inside the episode block)
          if (watchPct > 0 && !isTV && !isBook) {
            return (
              <div className="pt-0.5 pb-1">
                <HoverProgressBar movie={movie} getLastWatchedEpisode={getLastWatchedEpisode} getVideoState={getVideoState} />
              </div>
            );
          }
          if (watchPct > 0) return null;
          return (
            <div className="flex flex-wrap items-center gap-y-0.5 text-[15.5px] font-medium">
              {movie.genre_ids?.slice(0, 3).map((genreId, idx, arr) => {
                const genreName = t(`genres.${genreId}`, { defaultValue: GENRES[genreId] });
                if (!genreName) return null;
                return (
                  <span key={genreId} className="flex items-center">
                    <span
                      className="text-white cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        onMouseLeave();
                        navigate(`/browse/genre-${genreId}?title=${encodeURIComponent(genreName)}&url=${encodeURIComponent(`/discover/${isTV ? 'tv' : 'movie'}?with_genres=${genreId}&sort_by=popularity.desc`)}`);
                      }}
                    >
                      {genreName}
                    </span>
                    {idx < arr.length - 1 && <span className="text-white/30 mx-1.5 text-[16px] leading-none">•</span>}
                  </span>
                );
              })}
            </div>
          );
        })()}
      </div>

      </motion.div>
    </div>
  );
});

MovieCardPopup.displayName = 'MovieCardPopup';

export default MovieCardPopup;