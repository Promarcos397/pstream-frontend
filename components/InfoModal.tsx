import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation, useSearchParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { XIcon, PlayIcon, CheckIcon, PlusIcon, SpeakerSlashIcon, SpeakerHighIcon, ThumbsUpIcon, ThumbsDownIcon, HeartIcon, TicketIcon, ArrowCounterClockwiseIcon } from '@phosphor-icons/react';
import { AnimatePresence, motion } from 'framer-motion';
import { Movie, Episode } from '../types';
import { IMG_PATH, REQUESTS } from '../constants';
import { useGlobalContext } from '../context/GlobalContext';
import { getSeasonDetails } from '../services/api';

import InfoModalEpisodes from './InfoModalEpisodes';
import InfoModalRecommendations from './InfoModalRecommendations';
import { useMovieData } from '../hooks/useMovieData';
import { useIsInTheaters } from '../hooks/useIsInTheaters';
import CinemaPlayButton from './CinemaPlayButton';
import { MaturityBadge } from './MovieCardBadges';
import { triggerSearch } from '../utils/search';
import { TrailerPlayer } from './TrailerPlayer';
import { preloadTrailer } from '../hooks/useTrailer';
import { useUIStore } from '../store/useUIStore';
import { useTasteEngine } from '../hooks/useTasteEngine';
import { useIsMobile } from '../hooks/useIsMobile';
import InfoModalTouch from './InfoModalTouch';
import TooltipWrapper from './TooltipWrapper';
import { dimensionsAsMovies, get404Episodes } from '../data/notFoundDimensions';

// Module-level cache: saves each movie's InfoModal trailer position across opens.
// Key: String(movie.id), Value: seconds
export const _modalTrailerCache = new Map<string, number>();


interface InfoModalProps {
    movie: Movie | null;
    initialTime?: number;
    onClose: (finalTime?: number) => void;
    onPlay: (movie: Movie, season?: number, episode?: number) => void;
    trailerId?: string;
}

type MovieRating = 'like' | 'dislike' | 'love';

const DoubleThumbsUpIcon: React.FC<{ size?: number; weight?: 'fill' | 'bold'; className?: string; maskColor?: string }> = ({
  size = 22,
  weight = 'bold',
  className = '',
  maskColor = '#2f2f2f'
}) => {
  const offsetX = Math.round(size * 0.38);
  const offsetY = Math.round(size * 0.32);
  const biteR   = Math.round(size * 0.44);

  return (
    <div
      className={`relative inline-flex ${className}`}
      style={{ width: size + offsetX, height: size + offsetY }}
    >
      {/* Bottom thumb — lower right, sits behind everything (z=1) */}
      <div className="absolute" style={{ left: offsetX, top: offsetY, zIndex: 1 }}>
        <ThumbsUpIcon size={size} weight={weight} />
      </div>

      {/* Separator circle in button background color — bites into bottom thumb (z=2) */}
      <div
        className="absolute rounded-full"
        style={{
          width:  biteR * 2,
          height: biteR * 2,
          left:   offsetX - biteR + 4,
          top:    offsetY - biteR + 5,
          background: maskColor,
          zIndex: 2,
        }}
      />

      {/* Top thumb — upper left, in front of everything (z=3) */}
      <div className="absolute" style={{ left: 0, top: 0, zIndex: 3 }}>
        <ThumbsUpIcon size={size} weight={weight} />
      </div>
    </div>
  );
};

const RatingIcon: React.FC<{ rating: MovieRating | undefined; size?: number; weight?: 'fill' | 'bold'; className?: string; maskColor?: string }> = ({
  rating,
  size = 22,
  weight = 'bold',
  className = '',
  maskColor = '#2f2f2f'
}) => {
  if (rating === 'love') {
    return <DoubleThumbsUpIcon size={size} weight={weight} className={className} maskColor={maskColor} />;
  }
  if (rating === 'dislike') {
    return <ThumbsDownIcon size={size} weight={weight} className={className} />;
  }
  return <ThumbsUpIcon size={size} weight={weight} className={className} />;
};

const RatingPillOption: React.FC<{
  option: MovieRating;
  isActive: boolean;
  tooltipText: string;
  onClick: () => void;
  maskColor?: string;
}> = ({ option, isActive, tooltipText, onClick, maskColor = '#2f2f2f' }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className="relative flex items-center justify-center"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <AnimatePresence>
        {isHovered && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.9, x: '-50%' }}
            animate={{ opacity: 1, y: 0, scale: 1, x: '-50%' }}
            exit={{ opacity: 0, y: 2, scale: 0.95, x: '-50%' }}
            transition={{ duration: 0.1 }}
            className="absolute bottom-full left-1/2 mb-3 flex flex-col items-center z-[110] pointer-events-none"
            style={{ transformOrigin: 'bottom center' }}
          >
            {/* Tooltip Box */}
            <div className="bg-[#e6e6e6] text-[#141414] text-[15px] font-extrabold px-5 py-3 rounded-[1px] shadow-[0_8px_24px_rgba(0,0,0,0.5)] whitespace-nowrap leading-none select-none">
              {tooltipText}
            </div>
            {/* Tooltip Arrow */}
            <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-[#e6e6e6] -mt-[1px]" />
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={onClick}
        className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors duration-150 hover:bg-white/10 flex-shrink-0 text-white
          ${isActive ? 'bg-white/15' : ''}`}
        title={tooltipText}
      >
        <RatingIcon rating={option} size={20} weight={isActive ? 'fill' : 'bold'} maskColor={isHovered ? '#414141' : maskColor} />
      </button>
    </div>
  );
};

const InfoModalRatingPill: React.FC<{ rating: MovieRating | undefined; onRate: (r: MovieRating) => void }> = ({ rating, onRate }) => {
    const [expanded, setExpanded] = useState(false);
    const { t } = useTranslation();

    return (
        <div className="relative flex items-center" onMouseEnter={() => setExpanded(true)} onMouseLeave={() => setExpanded(false)}>
            <button
                type="button"
                className="border border-white/40 rounded-full w-10 h-10 flex items-center justify-center transition-colors duration-150 cursor-pointer text-white bg-zinc-800/80 hover:bg-white/15 hover:border-white"
            >
                <RatingIcon rating={rating} size={22} weight={rating ? 'fill' : 'bold'} className="text-white" maskColor="#444444" />
            </button>

            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ opacity: 0, scaleX: 0, x: '-50%', y: '-50%' }}
                        animate={{ opacity: 1, scaleX: 1, x: '-50%', y: '-50%' }}
                        exit={{ opacity: 0, scaleX: 0, x: '-50%', y: '-50%' }}
                        transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
                        className="absolute top-1/2 left-1/2 bg-[#2f2f2f] rounded-full px-5 py-2.5 flex items-center justify-center gap-x-3.5 shadow-[0_12px_24px_rgba(0,0,0,0.85)] border border-white/10 z-[100]"
                        style={{ transformOrigin: 'center center', originX: 0.5 }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {(['dislike', 'like', 'love'] as MovieRating[]).map(r => {
                             const tooltipText = r === 'love' 
                               ? t('infoModal.loveThis', { defaultValue: 'Love this!' }) 
                               : r === 'like' 
                                 ? t('infoModal.iLikeThis', { defaultValue: 'I like this' }) 
                                 : t('infoModal.notForMe', { defaultValue: 'Not for me' });
                             return (
                               <RatingPillOption
                                 key={r}
                                 option={r}
                                 isActive={rating === r}
                                 tooltipText={tooltipText}
                                 onClick={() => { onRate(r); }}
                               />
                             );
                        })}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

const InfoModal: React.FC<InfoModalProps> = ({ movie, initialTime = 0, onClose, onPlay, trailerId }) => {
    const {
        myList, toggleList, updateVideoState, heroVideoState,
        globalMute, setGlobalMute, getVideoState,
        getLastWatchedEpisode, rateMovie, getMovieRating, getEpisodeProgress,
        clearVideoState
    } = useGlobalContext();
    const setActiveVideoId = useUIStore(s => s.setActiveVideoId);
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const [, setSearchParams] = useSearchParams();
    const [overrideMovie, setOverrideMovie] = useState<Movie | null>(null);
    const activeMovieProp = overrideMovie || movie;
    
    // Intercept and override 404 database details for alternate dimensions Masquerade
    const is404 = typeof activeMovieProp?.id === 'string' && activeMovieProp.id.startsWith('dim');
    const { detailedMovie: rawDetailedMovie, cast: rawCast, recommendations: rawRecommendations, logoUrl: rawLogoUrl, isLoading: rawLoading } = useMovieData(activeMovieProp);
    
    const detailedMovie = is404 ? activeMovieProp : rawDetailedMovie;
    const cast = is404 ? ["The Router", "Vite Compiler", "Tailwind Engine", "A.I. Developer"] : rawCast;
    const recommendations = is404 
        ? dimensionsAsMovies.filter((m: any) => m.id !== activeMovieProp.id) 
        : rawRecommendations;
    const logoUrl = is404 ? activeMovieProp.image_url : rawLogoUrl;
    const isLoading = is404 ? false : rawLoading;

    const [imgFailed, setImgFailed] = useState(false);
    const isCinemaOnly = useIsInTheaters(movie);

    const [isPlayingTrailer, setIsPlayingTrailer] = useState(false);
    const [isActuallyPlaying, setIsActuallyPlaying] = useState(false);
    const [hasVideoEnded, setHasVideoEnded] = useState(false);
    const [replayCount, setReplayCount] = useState(0);
    const [showBackdropOverlay, setShowBackdropOverlay] = useState(false);
    const visibilityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const backdropForcedRef = useRef(false);
    const modalPlayerRef = useRef<any>(null);
    const hasAppliedInitialSeek = useRef(false);
    const modalTrailerTimeRef = useRef<number>(0);

    // Resolve the trailer start time: prefer the InfoModal's own saved position,
    // then fall back to the passed-in initialTime (from hero/card).
    const movieKey = movie ? String(movie.id) : '';
    const cachedModalTime = movieKey ? (_modalTrailerCache.get(movieKey) ?? 0) : 0;
    const resolvedSeekTime = cachedModalTime > 0 ? cachedModalTime : (initialTime ?? 0);

    const { getMatchScore } = useTasteEngine();
    const matchScore = getMatchScore(detailedMovie || activeMovieProp);

    const [episodes, setEpisodes] = useState<Episode[]>([]);
    const [selectedSeason, setSelectedSeason] = useState(1);
    const [loadingEpisodes, setLoadingEpisodes] = useState(false);
    
    const isMobile = useIsMobile();
    const mediaType = activeMovieProp
        ? (activeMovieProp.media_type || (activeMovieProp.title ? 'movie' : 'tv')) as 'movie' | 'tv'
        : 'movie';

    const modalRef = useRef<HTMLDivElement>(null);
    const heroRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        (window as any).__modal_active = true;
        window.dispatchEvent(new Event('pstream:theme-update'));
        return () => {
            (window as any).__modal_active = false;
            window.dispatchEvent(new Event('pstream:theme-update'));
        };
    }, []);


    useEffect(() => {
        if (!movie) return;
        const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
        document.body.style.overflow = 'hidden';
        if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`;
        setActiveVideoId(`modal-${movie.id}`);
        return () => {
            document.body.style.overflow = '';
            document.body.style.paddingRight = '';
            setActiveVideoId(null);
        };
    }, [movie, setActiveVideoId]);

    const handleClose = () => {
        if (movie && modalTrailerTimeRef.current > 4) {
            _modalTrailerCache.set(String(movie.id), modalTrailerTimeRef.current);
        }
        onClose();
    };

    const handleCloseRef = useRef(handleClose);
    handleCloseRef.current = handleClose;
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') handleCloseRef.current(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    useEffect(() => {
        if (movie) {
            setImgFailed(false);
            setIsPlayingTrailer(false);
            setIsActuallyPlaying(false);
            setHasVideoEnded(false);
            setEpisodes([]);
            setSelectedSeason(1);
            setReplayCount(0);
            setOverrideMovie(null);
            hasAppliedInitialSeek.current = false;
            modalTrailerTimeRef.current = 0;

            preloadTrailer(movie);

            const type = (movie.media_type || (movie.title ? 'movie' : 'tv')) as 'movie' | 'tv';

            if (type === 'tv') {
                const saved = getLastWatchedEpisode(movie.id);
                if (saved?.season && saved?.episode) {
                    setSelectedSeason(saved.season);
                }
            }
        }
    }, [movie]);

    const fetchEpisodes = useCallback(async (id: number, season: number) => {
        setLoadingEpisodes(true);
        const response = await getSeasonDetails(id, season);
        setEpisodes(response?.episodes || []);
        setLoadingEpisodes(false);
    }, []);

    useEffect(() => {
        if (mediaType === 'tv' && activeMovieProp) {
            if (is404) {
                setEpisodes(get404Episodes());
            } else {
                fetchEpisodes(Number(activeMovieProp.id), selectedSeason);
            }
        }
    }, [selectedSeason, mediaType, movie, fetchEpisodes, is404, activeMovieProp]);

    // ── Pause/Resume via activeVideoId ONLY ─────────────────────────────────
    // No separate backdrop overlay state. TrailerPlayer onEnded/onErrored is
    // the single source of truth for when the video layer hides.
    useEffect(() => {
        if (!movie) return;

        const isVisible = () => document.visibilityState === 'visible';
        const isIntersectingRef = { current: true };

        const update = () => {
            const visible = isVisible();
            if (visible && isIntersectingRef.current) {
                setActiveVideoId(`modal-${movie.id}`);
                
                // Clear forced backdrop when returning
                if (visibilityTimerRef.current) clearTimeout(visibilityTimerRef.current);
                backdropForcedRef.current = false;
                setShowBackdropOverlay(false);
            } else {
                setActiveVideoId(`paused-modal-${movie.id}`);
                
                // Start 15s timer if hidden
                if (!visible) {
                    if (visibilityTimerRef.current) clearTimeout(visibilityTimerRef.current);
                    visibilityTimerRef.current = setTimeout(() => {
                        backdropForcedRef.current = true;
                        setShowBackdropOverlay(true);
                    }, 15_000);
                }
            }
        };

        const handleVisibility = () => update();

        document.addEventListener('visibilitychange', handleVisibility);
        
        let observer: IntersectionObserver | null = null;
        if (heroRef.current) {
            observer = new IntersectionObserver(([entry]) => {
                isIntersectingRef.current = entry.isIntersecting;
                update();
            }, { threshold: 0.1 });
            observer.observe(heroRef.current);
        }

        update();

        return () => {
            document.removeEventListener('visibilitychange', handleVisibility);
            if (visibilityTimerRef.current) clearTimeout(visibilityTimerRef.current);
            if (observer) observer.disconnect();
        };
    }, [movie, setActiveVideoId]);

    const handleRecommendationClick = useCallback((rec: Movie) => {
        setOverrideMovie(rec);
        setImgFailed(false);
        setIsPlayingTrailer(false);
        setIsActuallyPlaying(false);
        setHasVideoEnded(false);
        setLoadingEpisodes(true);
        setEpisodes([]);
        setSelectedSeason(1);
        setReplayCount(c => c + 1);
        preloadTrailer(rec);
        const type = rec.media_type || (rec.title ? 'movie' : 'tv');
        navigate(`/title/${type}/${rec.id}${location.search}`, { state: location.state, replace: true });
        setActiveVideoId(`modal-${rec.id}`);
        if (modalRef.current) {
            modalRef.current.parentElement?.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }, [navigate, location, setActiveVideoId]);

    if (!movie) return null;
    const activeMovie = detailedMovie || activeMovieProp;
    const isAdded = myList.some(m => String(m.id) === String(activeMovieProp.id));
    const year = (activeMovie.release_date || activeMovie.first_air_date)?.substring(0, 4) || "";
    const totalSeasons = activeMovie.number_of_seasons || 0;
    const duration = activeMovie.runtime
        ? `${Math.floor(activeMovie.runtime / 60)}${t('common.hour')} ${activeMovie.runtime % 60}${t('common.minute')}`
        : totalSeasons
            ? t('common.seasonCount', { count: totalSeasons })
            : "";

    const savedMovieState = getVideoState(activeMovieProp.id);
    const lastEp = mediaType === 'tv' ? getLastWatchedEpisode(activeMovieProp.id) : null;

    let watchPct = 0;
    if (mediaType === 'movie' && savedMovieState?.time && savedMovieState?.duration) {
        watchPct = Math.min(100, (savedMovieState.time / savedMovieState.duration) * 100);
        if (watchPct < 5) watchPct = 0;
    } else if (mediaType === 'tv' && lastEp) {
        const epProg = getEpisodeProgress(movie.id, lastEp.season, lastEp.episode);
        if (epProg?.duration) {
            watchPct = Math.min(100, (epProg.time / epProg.duration) * 100);
            if (watchPct < 5) watchPct = 0;
        }
    }

    const hasResumeMovie = mediaType === 'movie' && watchPct >= 5;
    const hasResumeTV = mediaType === 'tv' && watchPct >= 5;

    if (isMobile) {
        return (
            <InfoModalTouch
                movie={movie}
                initialTime={initialTime}
                onClose={onClose}
                onPlay={onPlay}
                trailerId={trailerId}
            />
        );
    }

    return (
        <div
            className="fixed inset-0 z-[10000] bg-black/70 flex justify-center overflow-y-auto scrollbar-hide cursor-default"
            onClick={handleClose}
        >
            <div
                ref={modalRef}
                className="relative w-full max-w-[850px] bg-[#181818] rounded-xl shadow-2xl mt-6 md:mt-8 mb-8 overflow-hidden h-fit mx-4 ring-1 ring-white/10"
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    type="button"
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleClose();
                    }}
                    className="absolute top-4 right-4 w-10 h-10 rounded-full border border-white/40 bg-zinc-800/80 flex items-center justify-center transition-colors duration-150 hover:bg-white/15 hover:border-white z-50 cursor-pointer shadow-lg"
                >
                    <XIcon size={24} className="text-white" />
                </button>

                {/* --- Media Container --- */}
                <div ref={heroRef} className="relative aspect-[16/8] max-sm:aspect-video w-full bg-black group overflow-hidden">
                    <div className="absolute inset-0 z-0 text-[0px]">
                        <img
                            src={
                                typeof activeMovie.id === 'string' && activeMovie.id.startsWith('dim')
                                    ? (activeMovie.backdrop_path || activeMovie.poster_path)
                                    : `${IMG_PATH}${activeMovie.backdrop_path || activeMovie.poster_path}`
                            }
                            className={`w-full h-full object-cover scale-[1.05] transition-opacity duration-300 ${isActuallyPlaying ? 'opacity-0' : 'opacity-100'}`}
                            alt="modal hero"
                            fetchPriority="high"
                            decoding="async"
                        />
                        {/* Video layer: hidden if backdrop is forced or video hasn't started */}
                        <div className={`absolute inset-0 transition-opacity duration-300 overflow-hidden ${isActuallyPlaying && !showBackdropOverlay ? 'opacity-100' : 'opacity-0'}`}>
                            <TrailerPlayer 
                                key={`modal-player-${replayCount}`}
                                movie={activeMovie} 
                                variant="modal"
                                initialSeekTime={resolvedSeekTime > 0 ? resolvedSeekTime : undefined}
                                onReady={() => setIsPlayingTrailer(true)}
                                onPlay={() => setIsActuallyPlaying(true)}
                                onTimeUpdate={(t) => { modalTrailerTimeRef.current = t; }}
                                onPlayerReady={(player) => {
                                    modalPlayerRef.current = player;
                                }}
                                onEnded={() => {
                                    setIsPlayingTrailer(false);
                                    setIsActuallyPlaying(false);
                                    setHasVideoEnded(true);
                                }}
                                onErrored={() => {
                                    setIsPlayingTrailer(false);
                                    setIsActuallyPlaying(false);
                                }}
                            />
                        </div>
                    </div>

                    {/* Cinematic gradient — direct child of heroRef so it's flush with the bottom edge */}
                    <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-[#181818] via-[#181818]/40 to-transparent z-10 pointer-events-none" />

                    <div className="absolute bottom-0 left-0 w-full p-6 md:p-12 space-y-3 md:space-y-4 z-20 pointer-events-auto">
                        <div className={`inline-flex flex-col max-w-[80%] transition-opacity duration-200 ${isLoading ? 'opacity-0' : 'opacity-100'}`}>
                            {logoUrl && !imgFailed ? (
                                <img src={logoUrl} alt={activeMovie.title || activeMovie.name} style={{ maxHeight: 'clamp(68px, 11vw, 120px)', maxWidth: '72%', objectFit: 'contain', objectPosition: 'bottom left', filter: 'drop-shadow(0 2px 12px rgba(0,0,0,0.85))' }} decoding="async" onError={() => setImgFailed(true)} />
                            ) : (
                                <h2 className="text-3xl sm:text-4xl md:text-5xl font-black font-leaner text-white drop-shadow-xl leading-none tracking-wide">
                                    {activeMovie.title || activeMovie.name}
                                </h2>
                            )}
                        </div>

                        <div className={`flex items-center space-x-3 transition-opacity duration-200 ${isLoading ? 'opacity-0' : 'opacity-100'}`}>
                            {(() => {
                                let watchUrl = `/watch/${mediaType}/${activeMovie.id}`;
                                if (mediaType === 'tv' && lastEp) {
                                    watchUrl += `?season=${lastEp.season}&episode=${lastEp.episode}`;
                                }
                                const labelText = hasResumeTV ? `Resume E${lastEp?.episode}` : hasResumeMovie ? 'Resume' : t('hero.play');
                                return (
                                    <CinemaPlayButton
                                        movie={activeMovie}
                                        variant="rectangular"
                                        isCinemaOnly={isCinemaOnly && mediaType === 'movie'}
                                        onPlay={onPlay}
                                        to={watchUrl}
                                        label={labelText}
                                        className="h-10 sm:h-12 text-base sm:text-lg !px-6 sm:!px-8 rounded-[4px]"
                                    />
                                );
                            })()}
                            <TooltipWrapper label={isAdded ? t('modal.removeFromList') : t('modal.addToList')}>
                                <button
                                    onClick={() => toggleList(activeMovie)}
                                    className="border rounded-full w-10 h-10 flex items-center justify-center transition-colors duration-150 text-white border-white/40 bg-zinc-800/80 hover:bg-white/15 hover:border-white"
                                >
                                    {isAdded ? <CheckIcon size={24} /> : <PlusIcon size={24} />}
                                </button>
                            </TooltipWrapper>
                            <InfoModalRatingPill rating={getMovieRating(movie.id)} onRate={(r) => rateMovie(activeMovie, r)} />
                            {(hasResumeMovie || hasResumeTV) && (
                                <TooltipWrapper label={t('common.removeContinue')}>
                                    <button
                                        onClick={() => {
                                            clearVideoState(activeMovie.id);
                                        }}
                                        className="border rounded-full w-10 h-10 flex items-center justify-center border-white/40 bg-zinc-800/80 hover:bg-white/15 hover:border-white transition-colors duration-150 text-white"
                                    >
                                        <XIcon size={22} weight="bold" />
                                    </button>
                                </TooltipWrapper>
                            )}
                        </div>
                    </div>

                    {(isPlayingTrailer || hasVideoEnded) && (
                        <button onClick={(e) => { 
                            e.stopPropagation(); 
                            if (hasVideoEnded) { 
                                clearVideoState(activeMovie.id);
                                setHasVideoEnded(false); 
                                setIsPlayingTrailer(true); 
                                setReplayCount(c => c + 1); 
                            } else { 
                                setGlobalMute(!globalMute); 
                            } 
                        }} className="absolute bottom-6 right-6 z-30 w-10 h-10 rounded-full border border-white/40 bg-zinc-800/80 flex items-center justify-center transition-colors duration-150 hover:bg-white/15 hover:border-white shadow-xl pointer-events-auto cursor-pointer">
                            {hasVideoEnded ? <ArrowCounterClockwiseIcon size={20} className="text-white" /> : globalMute ? <SpeakerSlashIcon size={20} className="text-white" /> : <SpeakerHighIcon size={20} className="text-white" />}
                        </button>
                    )}
                </div>

                <div className="px-6 md:px-12 pb-12 bg-[#181818]">
                    {isLoading ? (
                        <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-x-8 gap-y-6 mt-2">
                            <div className="space-y-4">
                                <div className="flex items-center gap-3 mt-2">
                                    <div className="h-3 w-14 bg-white/10 rounded-full animate-pulse" />
                                    <div className="h-3 w-8 bg-white/10 rounded-full animate-pulse" />
                                    <div className="h-3 w-20 bg-white/10 rounded-full animate-pulse" />
                                </div>
                                <div className="space-y-2 pt-1">
                                    <div className="h-3 w-full bg-white/[0.07] rounded-full animate-pulse" />
                                    <div className="h-3 w-[92%] bg-white/[0.07] rounded-full animate-pulse" />
                                    <div className="h-3 w-[80%] bg-white/[0.07] rounded-full animate-pulse" />
                                    <div className="h-3 w-[65%] bg-white/[0.07] rounded-full animate-pulse" />
                                </div>
                            </div>
                            <div className="space-y-3 pt-2">
                                <div className="flex gap-2">
                                    <div className="h-3 w-10 bg-white/10 rounded-full animate-pulse" />
                                    <div className="h-3 w-28 bg-white/[0.06] rounded-full animate-pulse" />
                                </div>
                                <div className="flex gap-2">
                                    <div className="h-3 w-12 bg-white/10 rounded-full animate-pulse" />
                                    <div className="h-3 w-24 bg-white/[0.06] rounded-full animate-pulse" />
                                </div>
                            </div>
                        </div>
                    ) : (
                    <div className="grid grid-cols-1 md:grid-cols-[3fr_1fr] gap-x-10 gap-y-5">
                        <div className="space-y-4">
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-white font-bold text-sm md:text-base mt-2 font-netflix">
                                {matchScore !== null && (
                                    <span className="text-green-500 font-extrabold tracking-wide">{matchScore}% Match</span>
                                )}
                                <span className="text-white tracking-wide">{year}</span>
                                <span className="text-white tracking-wide">{duration}</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <MaturityBadge adult={activeMovie.adult} voteAverage={activeMovie.vote_average} certification={activeMovie.certification} size="md" />
                                {activeMovie.content_descriptors?.length ? (
                                  <span className="text-sm font-semibold text-gray-200">
                                    {activeMovie.content_descriptors.map((d: string) => d.toLowerCase()).join(', ')}
                                  </span>
                                ) : null}
                            </div>
                            <p className="text-white font-normal text-[14px] md:text-[15px] leading-[1.65] pt-1">{activeMovie.overview}</p>
                        </div>
                        <div className="space-y-4 pt-2">
                            <div className="text-sm flex flex-wrap gap-x-1">
                                <span className="text-gray-300 font-semibold mr-1">{t('common.cast')}</span>
                                {cast?.slice(0, 3).map((actor, i, arr) => (
                                    <React.Fragment key={actor}>
                                        <span
                                            onClick={() => {
                                                handleClose();
                                                triggerSearch(navigate, actor);
                                            }}
                                            className="text-white font-semibold hover:underline cursor-pointer"
                                        >
                                            {actor}
                                        </span>
                                        {i < arr.length - 1 ? <span className="text-white font-semibold">, </span> : null}
                                    </React.Fragment>
                                ))}
                            </div>
                            <div className="text-sm flex flex-wrap gap-x-1">
                                <span className="text-gray-300 font-semibold mr-1">{t('common.genres')}</span>
                                {(activeMovie.genres?.length
                                    ? activeMovie.genres.map(g => ({ id: g.id, name: g.name }))
                                    : activeMovie.genre_ids?.map(id => ({ id, name: t(`genres.${id}`) })) || []
                                ).map((g, i, arr) => (
                                    <React.Fragment key={g.id}>
                                        <span
                                            onClick={() => {
                                                handleClose();
                                                navigate(`/browse/genre-${g.id}?title=${encodeURIComponent(g.name)}&url=${encodeURIComponent(REQUESTS.fetchByGenre(activeMovie.media_type === 'tv' ? 'tv' : 'movie', g.id))}`);
                                            }}
                                            className="text-white font-semibold hover:underline cursor-pointer"
                                        >
                                            {g.name}
                                        </span>
                                        {i < arr.length - 1 ? <span className="text-white font-semibold">, </span> : null}
                                    </React.Fragment>
                                ))}
                            </div>
                        </div>
                    </div>
                    )}

                    {mediaType === 'tv' && (
                        <div className="mt-12">
                            <InfoModalEpisodes
                                movie={activeMovie}
                                mediaType={mediaType}
                                episodes={episodes}
                                loadingEpisodes={loadingEpisodes}
                                selectedSeason={selectedSeason}
                                setSelectedSeason={setSelectedSeason}
                                onPlay={onPlay}
                                totalSeasons={totalSeasons}
                            />
                        </div>
                    )}

                    <div className="mt-12">
                        <InfoModalRecommendations
                            recommendations={recommendations}
                            onRecommendationClick={handleRecommendationClick}
                            onPlay={onPlay}
                        />
                    </div>


                </div>
            </div>
        </div>
    );
};

export default InfoModal;