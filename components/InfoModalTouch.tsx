import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation, useSearchParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PlayIcon, PauseIcon, CheckIcon, PlusIcon, SpeakerSlashIcon, SpeakerHighIcon, ThumbsUpIcon, ThumbsDownIcon, HeartIcon, ArrowCounterClockwiseIcon, XIcon } from '@phosphor-icons/react';
import { Movie, Episode } from '../types';
import { IMG_PATH, REQUESTS } from '../constants';
import { useGlobalContext } from '../context/GlobalContext';
import { getSeasonDetails } from '../services/api';

import InfoModalEpisodesTouch from './InfoModalEpisodesTouch';
import InfoModalRecommendationsTouch from './InfoModalRecommendationsTouch';
import { useMovieData } from '../hooks/useMovieData';
import { triggerSearch } from '../utils/search';
import { TrailerPlayer } from './TrailerPlayer';
import { useTasteEngine } from '../hooks/useTasteEngine';
import { MaturityBadge } from './MovieCardBadges';
import { dimensionsAsMovies, get404Episodes } from '../data/notFoundDimensions';
import { _modalTrailerCache } from './InfoModal';
import { DoubleThumbsUpIcon } from './MovieCard';
// removing tablet and ipad styles and sidebar

interface InfoModalTouchProps {
    movie: Movie | null;
    initialTime?: number;
    onClose: (finalTime?: number) => void;
    onPlay: (movie: Movie, season?: number, episode?: number) => void;
    trailerId?: string;
}

const InfoModalTouch: React.FC<InfoModalTouchProps> = ({
    movie,
    initialTime = 0,
    onClose,
    onPlay,
    trailerId,
}) => {
    const {
        myList, toggleList, globalMute, setGlobalMute, 
        getVideoState, setActiveVideoId, getLastWatchedEpisode, 
        rateMovie, getMovieRating, getEpisodeProgress, clearVideoState
    } = useGlobalContext();
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const [, setSearchParams] = useSearchParams();
    
    const [overrideMovie, setOverrideMovie] = useState<Movie | null>(null);
    const activeMovieProp = overrideMovie || movie;
    
    // Intercept and override 404 database details for mobile touch modal
    const is404 = typeof activeMovieProp?.id === 'string' && activeMovieProp.id.startsWith('dim');
    const { detailedMovie: rawDetailedMovie, cast: rawCast, recommendations: rawRecommendations, isLoading: rawLoading } = useMovieData(activeMovieProp);
    
    const detailedMovie = is404 ? activeMovieProp : rawDetailedMovie;
    const cast = is404 ? ["The Router", "Vite Compiler", "Tailwind Engine", "A.I. Developer"] : rawCast;
    const recommendations = is404 
        ? dimensionsAsMovies.filter((m: any) => m.id !== activeMovieProp.id) 
        : rawRecommendations;
    const isLoading = is404 ? false : rawLoading;
    
    const [isPlayingTrailer, setIsPlayingTrailer] = useState(false);
    const [isActuallyPlaying, setIsActuallyPlaying] = useState(false);
    const [hasVideoEnded, setHasVideoEnded] = useState(false);
    const [replayCount, setReplayCount] = useState(0);
    const [showBackdropOverlay, setShowBackdropOverlay] = useState(false);
    const visibilityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const backdropForcedRef = useRef(false);

    // Advanced spotlight-style player states/refs
    const playerInstanceRef = useRef<any>(null);
    const hasAppliedInitialSeek = useRef(false);
    const modalTrailerTimeRef = useRef<number>(0);

    // Prefer the InfoModal's own saved position, then fall back to incoming initialTime
    const movieKey = movie ? String(movie.id) : '';
    const cachedModalTime = movieKey ? (_modalTrailerCache.get(movieKey) ?? 0) : 0;
    const resolvedSeekTime = cachedModalTime > 0 ? cachedModalTime : (initialTime ?? 0);
    const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [showControls, setShowControls] = useState(false);
    const [isVideoPaused, setIsVideoPaused] = useState(false);
    const [trailerPct, setTrailerPct] = useState(0);
    const [currentTimeSec, setCurrentTimeSec] = useState(0);
    const [durationSec, setDurationSec] = useState(0);

    const [episodes, setEpisodes] = useState<Episode[]>([]);
    const [selectedSeason, setSelectedSeason] = useState(1);
    const [loadingEpisodes, setLoadingEpisodes] = useState(false);
    
    const [activeMobileTab, setActiveMobileTab] = useState<'episodes' | 'more'>('episodes');

    const [isDescExpanded, setIsDescExpanded] = useState(false);
    const [isEpTitleExpanded, setIsEpTitleExpanded] = useState(false);
    const [showRatePopup, setShowRatePopup] = useState(false);

    const heroRef = useRef<HTMLDivElement>(null);

    const mediaType = activeMovieProp
        ? (activeMovieProp.media_type || (activeMovieProp.title ? 'movie' : 'tv')) as 'movie' | 'tv'
        : 'movie';

    useEffect(() => {
        if (mediaType === 'tv') {
            setActiveMobileTab('episodes');
        } else {
            setActiveMobileTab('more');
        }
    }, [mediaType]);

    // Handle initial mount state and trailer preloading
    useEffect(() => {
        if (movie) {
            setIsPlayingTrailer(false);
            setIsActuallyPlaying(false);
            setHasVideoEnded(false);
            setEpisodes([]);
            setSelectedSeason(1);
            setReplayCount(0);
            setOverrideMovie(null);
            hasAppliedInitialSeek.current = false;
            modalTrailerTimeRef.current = 0;

            // Reset player states
            setIsVideoPaused(false);
            setTrailerPct(0);
            setCurrentTimeSec(0);
            setDurationSec(0);
            setShowControls(false);

            // Reset description/episode title expansion states
            setIsDescExpanded(false);
            setIsEpTitleExpanded(false);

            import('../hooks/useTrailer').then(({ preloadTrailer }) => {
                preloadTrailer(movie);
            });

            if (mediaType === 'tv') {
                const getLastWatched = getLastWatchedEpisode(movie.id);
                if (getLastWatched?.season && getLastWatched?.episode) {
                    setSelectedSeason(getLastWatched.season);
                }
            }
        }
    }, [movie, mediaType]);

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
    }, [selectedSeason, mediaType, activeMovieProp, fetchEpisodes, is404]);

    // Pause/Resume on scroll or visibility change
    useEffect(() => {
        if (!movie) return;

        const isVisible = () => document.visibilityState === 'visible';
        const isIntersectingRef = { current: true };

        const update = () => {
            const visible = isVisible();
            if (visible && isIntersectingRef.current) {
                setActiveVideoId(`modal-${movie.id}`);
                setIsVideoPaused(false); // Sync state: video resumes when scrolling back up
                if (visibilityTimerRef.current) clearTimeout(visibilityTimerRef.current);
                backdropForcedRef.current = false;
                setShowBackdropOverlay(false);
            } else {
                setActiveVideoId(`paused-modal-${movie.id}`);
                if (playerInstanceRef.current) {
                    try { playerInstanceRef.current.pauseVideo(); } catch {}
                }
                setIsVideoPaused(true); // Sync state: video pauses when scrolling down
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

    if (!movie) return null;
    const activeMovie = detailedMovie || activeMovieProp;
    const isAdded = myList.some(m => String(m.id) === String(activeMovieProp.id));
    const year = (activeMovie.release_date || activeMovie.first_air_date)?.substring(0, 4) || "";
    const totalSeasons = activeMovie.number_of_seasons || 0;
    const duration = activeMovie.runtime
        ? `${Math.floor(activeMovie.runtime / 60)}${t('common.hour')} ${activeMovie.runtime % 60}${t('common.minute')}`
        : totalSeasons
            ? `${totalSeasons} ${t('common.season')}${totalSeasons > 1 ? 's' : ''}`
            : "";

    const handleRecommendationClick = (rec: Movie) => {
        setOverrideMovie(rec);
        setIsPlayingTrailer(false);
        setIsActuallyPlaying(false);
        setHasVideoEnded(false);
        setLoadingEpisodes(true);
        setEpisodes([]);
        setSelectedSeason(1);
        setReplayCount(c => c + 1);

        setIsDescExpanded(false);
        setIsEpTitleExpanded(false);

        import('../hooks/useTrailer').then(({ preloadTrailer }) => {
            preloadTrailer(rec);
        });

        const type = rec.media_type || (rec.title ? 'movie' : 'tv');
        navigate(`/title/${type}/${rec.id}${location.search}`, {
            state: location.state,
            replace: true
        });
        setActiveVideoId(`modal-${rec.id}`);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleClose = () => {
        // Save InfoModalTouch's own trailer position before closing
        if (movie && modalTrailerTimeRef.current > 4) {
            _modalTrailerCache.set(String(movie.id), modalTrailerTimeRef.current);
        }
        onClose();
    };

    const handleMediaTap = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isActuallyPlaying) {
            if (isVideoPaused) {
                // Resume play immediately on tapping the paused video!
                const player = playerInstanceRef.current;
                if (player) {
                    try { player.playVideo(); } catch {}
                    setIsVideoPaused(false);
                }
                openControls();
            } else if (hasVideoEnded) {
                // Replay video immediately on tapping the ended video!
                clearVideoState(activeMovie.id);
                setHasVideoEnded(false);
                setIsPlayingTrailer(true);
                setReplayCount(c => c + 1);
            } else {
                // If playing, tapping shows/hides controls or toggles play/pause
                if (showControls) {
                    setShowControls(false);
                } else {
                    openControls();
                }
            }
        } else {
            setIsPlayingTrailer(true);
            setIsActuallyPlaying(true);
            setHasVideoEnded(false);
        }
    };

    const openControls = () => {
        setShowControls(true);
        if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
        controlsTimerRef.current = setTimeout(() => setShowControls(false), 3000);
    };

    const handlePlayPause = (e: React.MouseEvent) => {
        e.stopPropagation();
        const player = playerInstanceRef.current;
        if (!player) return;
        if (isVideoPaused) {
            try { player.playVideo(); } catch {}
            setIsVideoPaused(false);
        } else {
            try { player.pauseVideo(); } catch {}
            setIsVideoPaused(true);
        }
        openControls();
    };

    const handleScrub = (e: React.MouseEvent<HTMLDivElement> | React.PointerEvent<HTMLDivElement>) => {
        e.stopPropagation();
        if (!playerInstanceRef.current || !durationSec) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        try { playerInstanceRef.current.seekTo(pct * durationSec, true); } catch {}
        openControls();
    };

    const fmtTime = (s: number) => {
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return `${m}:${sec.toString().padStart(2, '0')}`;
    };

    const savedMovieState = getVideoState(activeMovieProp.id);
    const lastEp = mediaType === 'tv' ? getLastWatchedEpisode(activeMovieProp.id) : null;

    let watchPct = 0, watchMins = 0, totalMins = 0;
    if (mediaType === 'movie' && savedMovieState?.time && savedMovieState?.duration) {
        watchPct = Math.min(100, (savedMovieState.time / savedMovieState.duration) * 100);
        if (watchPct < 5) watchPct = 0;
        watchMins = Math.round(savedMovieState.time / 60);
        totalMins = Math.round(savedMovieState.duration / 60);
    } else if (mediaType === 'tv' && lastEp) {
        const epProg = getEpisodeProgress(movie.id, lastEp.season, lastEp.episode);
        if (epProg?.duration) {
            watchPct = Math.min(100, (epProg.time / epProg.duration) * 100);
            if (watchPct < 5) watchPct = 0;
            watchMins = Math.round(epProg.time / 60);
            totalMins = Math.round(epProg.duration / 60);
        }
    }

    const hasResumeTV = mediaType === 'tv' && watchPct >= 5;
    const hasResumeMovie = mediaType === 'movie' && watchPct >= 5;

    const lastEpNum = lastEp?.episode || 1;
    const lastEpSeason = lastEp?.season || 1;
    const currentEpData = episodes.find(e => e.season_number === lastEpSeason && e.episode_number === lastEpNum) 
        || episodes[0] 
        || null;
    const epName = currentEpData ? currentEpData.name : 'Pilot';

    const remainingMins = totalMins - watchMins;
    const remainingText = remainingMins > 0 ? `${remainingMins}m remaining` : `${totalMins || 20}m remaining`;

    const ageRating = activeMovie.adult ? '18' : (activeMovie.vote_average ?? 0) >= 7.5 ? '16' : '13';

    return (
        <div className="fixed inset-0 z-[10000] bg-black overflow-y-auto scrollbar-hide flex flex-col w-full h-full select-none cursor-default pt-[calc(68px+env(safe-area-inset-top))] pb-[calc(96px+env(safe-area-inset-bottom))]">
            {/* Top Navigation Bar — solid background, Netflix style back arrow */}
            <div className="fixed top-0 left-0 right-0 h-[calc(68px+env(safe-area-inset-top))] bg-black border-b border-white/[0.04] flex items-center px-3 pt-[env(safe-area-inset-top)] z-[10010] shadow-md">
                <button
                    type="button"
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleClose();
                    }}
                    className="text-white active:scale-95 transition-all duration-200 p-2 cursor-pointer flex items-center justify-center"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-[26px] h-[26px] text-white">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                    </svg>
                </button>
            </div>

            {/* Media Container Banner — clickable media player */}
            <div 
                ref={heroRef} 
                className="relative aspect-video w-full bg-black overflow-hidden shrink-0 mt-0 cursor-pointer"
                onClick={handleMediaTap}
            >
                <img
                    src={
                        typeof activeMovie.id === 'string' && activeMovie.id.startsWith('dim')
                            ? (activeMovie.backdrop_path || activeMovie.poster_path)
                            : `${IMG_PATH}${activeMovie.backdrop_path || activeMovie.poster_path}`
                    }
                    className={`w-full h-full object-cover transition-opacity duration-400 ${isActuallyPlaying && !showBackdropOverlay ? 'opacity-0' : 'opacity-100'}`}
                    alt="modal hero mobile"
                />

                <div className={`absolute inset-0 transition-opacity duration-300 overflow-hidden ${isActuallyPlaying && !showBackdropOverlay ? 'opacity-100' : 'opacity-0'}`}>
                    <TrailerPlayer 
                        key={`mobile-modal-player-${replayCount}`}
                        movie={activeMovie} 
                        variant="modal"
                        initialSeekTime={resolvedSeekTime > 0 ? resolvedSeekTime : undefined}
                        onReady={() => setIsPlayingTrailer(true)}
                        onPlay={() => {
                            setIsActuallyPlaying(true);
                            setIsVideoPaused(false);
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
                        onPlayerReady={p => { playerInstanceRef.current = p; }}
                        onTimeUpdate={(currentTime, duration) => {
                            modalTrailerTimeRef.current = currentTime;
                            setCurrentTimeSec(currentTime);
                            setDurationSec(duration);
                            const usable = Math.max(duration - 8, 1);
                            setTrailerPct(Math.min(100, (currentTime / usable) * 100));
                        }}
                    />
                </div>

                {/* Circular play icon overlay when paused/stopped (only shows after first play has been triggered) */}
                {isActuallyPlaying && (isVideoPaused || hasVideoEnded) && (
                    <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
                        <div className="w-[64px] h-[64px] rounded-full bg-black/50 border border-white/20 flex items-center justify-center shadow-2xl transition-all duration-300">
                            <PlayIcon size={32} weight="fill" className="text-white ml-1" />
                        </div>
                    </div>
                )}

                {/* Controls overlay in center when playing */}
                {isActuallyPlaying && !isVideoPaused && showControls && (
                    <div className="absolute inset-0 bg-black/25 z-20 flex items-center justify-center">
                        <button
                            onClick={handlePlayPause}
                            className="w-[60px] h-[60px] rounded-full bg-black/50 border border-white/20 flex items-center justify-center active:scale-90 transition-transform z-30 pointer-events-auto cursor-pointer"
                        >
                            <PauseIcon size={30} weight="fill" className="text-white" />
                        </button>
                    </div>
                )}

                {/* Mute button */}
                {isActuallyPlaying && !showBackdropOverlay && (
                    <button 
                        onClick={(e) => { 
                            e.stopPropagation(); 
                            if (hasVideoEnded) { 
                                clearVideoState(activeMovie.id);
                                setHasVideoEnded(false); 
                                setIsPlayingTrailer(true); 
                                setReplayCount(c => c + 1); 
                            } else { 
                                setGlobalMute(!globalMute); 
                            } 
                        }} 
                        className="absolute bottom-4 right-4 z-30 w-9 h-9 rounded-full border border-white/30 bg-zinc-900/40 flex items-center justify-center transition-all duration-300 hover:bg-white/10 active:scale-95 shadow-xl pointer-events-auto cursor-pointer"
                    >
                        {hasVideoEnded ? <ArrowCounterClockwiseIcon size={18} className="text-white" /> : globalMute ? <SpeakerSlashIcon size={18} className="text-white" /> : <SpeakerHighIcon size={18} className="text-white" />}
                    </button>
                )}

                {/* Passive/Active Scrubbing Progress Bar */}
                {isActuallyPlaying && !showBackdropOverlay && (
                    <div
                        className="absolute left-0 right-0 z-30 transition-all duration-300 ease-out"
                        style={{
                            bottom: showControls ? '44px' : '0px',
                            padding: showControls ? '0 16px' : '0',
                            height: showControls ? '20px' : '2px',
                        }}
                    >
                        {showControls ? (
                            <div
                                className="relative w-full h-full flex items-center cursor-pointer touch-none select-none pointer-events-auto"
                                onClick={handleScrub}
                                onPointerMove={e => {
                                    if (e.buttons !== 1) return;
                                    handleScrub(e);
                                }}
                            >
                                <div className="relative w-full h-[3px] bg-white/25 rounded-full">
                                    <div
                                        className="absolute left-0 top-0 bottom-0 bg-[#e50914] rounded-full"
                                        style={{ width: `${trailerPct}%` }}
                                    />
                                    <div
                                        className="absolute top-1/2 -translate-y-1/2 w-[12px] h-[12px] bg-[#e50914] rounded-full shadow-lg pointer-events-none"
                                        style={{ left: `calc(${trailerPct}% - 6px)` }}
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="w-full h-full bg-white/10 relative overflow-hidden">
                                <div
                                    className="absolute top-0 left-0 bottom-0 bg-[#e50914] transition-[width] duration-500 ease-linear"
                                    style={{ width: `${trailerPct}%` }}
                                />
                            </div>
                        )}
                    </div>
                )}

                {/* Time Display */}
                {isActuallyPlaying && !showBackdropOverlay && showControls && (
                    <div className="absolute z-30 pointer-events-none" style={{ bottom: '68px', right: '20px' }}>
                        <span className="text-white text-[13px] font-semibold tracking-wide drop-shadow-md tabular-nums">
                            {fmtTime(currentTimeSec)}
                        </span>
                    </div>
                )}
            </div>

            {/* Details Content Container — margins/padding aligned consistently */}
            <div className="px-3 sm:px-6 pt-[10px] pb-8 flex flex-col gap-y-[16px] bg-black w-full sm:max-w-[640px] sm:mx-auto">
                {/* Text Title */}
                <h2 className="text-[25px] font-black font-netflix text-white tracking-wide leading-tight pt-0.5">
                    {activeMovie.title || activeMovie.name}
                </h2>

                {/* Meta Row (bigger, less bold) */}
                <div className="flex items-center gap-x-3 text-[17px] font-medium text-white/70 flex-wrap gap-y-2">
                    <span className="text-white/70 font-normal">{year}</span>
                    
                    {/* Circular rating badge from MovieCardBadges */}
                    <MaturityBadge adult={activeMovie.adult} voteAverage={activeMovie.vote_average} size="xs" />

                    <span className="text-white/70 font-normal">{duration}</span>
                    
                    {/* High-contrast HD badge with background */}
                    <span className="border-[1.5px] border-white/90 bg-white/15 px-1.5 py-0.5 text-[12px] rounded-[2px] text-white font-bold leading-none tracking-wider shrink-0 select-none shadow-[0_1px_3px_rgba(0,0,0,0.4)]">HD</span>
                </div>

                {/* Primary CTA Play/Resume Button — bigger, less rounded, matching margins */}
                <div className="w-full">
                    {(() => {
                        let watchUrl = `/watch/${mediaType}/${activeMovie.id}`;
                        if (mediaType === 'tv' && lastEp) {
                            watchUrl += `?season=${lastEp.season}&episode=${lastEp.episode}`;
                        } else if (mediaType === 'tv') {
                            watchUrl += `?season=1&episode=1`;
                        }
                        return (
                            <Link
                                to={watchUrl}
                                className="w-full bg-white text-black h-[50px] rounded-[2px] font-extrabold text-[17px] flex items-center justify-center hover:bg-gray-200 transition active:scale-[0.98] shadow-md leading-none no-underline gap-2 cursor-pointer"
                            >
                                <PlayIcon size={26} weight="fill" className="text-black" />
                                <span>{hasResumeTV ? `Resume` : hasResumeMovie ? 'Resume' : 'Play'}</span>
                            </Link>
                        );
                    })()}
                </div>

                {/* TV Last-Watched progress block — borderless, direct on black */}
                {mediaType === 'tv' && (
                    <div className="flex flex-col gap-y-1.5 mt-2">
                        <h3 
                            onClick={() => setIsEpTitleExpanded(!isEpTitleExpanded)}
                            className={`text-[15px] font-extrabold text-white leading-snug tracking-wide cursor-pointer transition-all duration-300 ${isEpTitleExpanded ? '' : 'line-clamp-2'}`}
                        >
                            S{lastEpSeason}:E{lastEpNum} {epName}
                        </h3>
                        
                        {/* Linear progress bar and remaining minutes inline row */}
                        <div className="flex items-center gap-x-3.5 w-full">
                            <div className="flex-1 h-[3px] bg-white/20 rounded-full overflow-hidden">
                                <div 
                                    className="h-full bg-[#e50914] rounded-full transition-all duration-300"
                                    style={{ width: `${watchPct || 35}%` }} 
                                />
                            </div>
                            <span className="text-white/80 text-[15px] font-medium shrink-0 leading-none">{remainingText}</span>
                        </div>
                    </div>
                )}

                {/* Description overview — more whiter */}
                <p 
                    onClick={() => setIsDescExpanded(!isDescExpanded)}
                    className={`text-white/90 font-normal text-[18px] leading-[1.65] pt-0.5 select-text cursor-pointer transition-all duration-300 ${isDescExpanded ? '' : 'line-clamp-4'}`}
                >
                    {activeMovie.overview || "No overview description available."}
                </p>

                {/* Cast List & Creators */}
                {cast && cast.length > 0 && (
                    <div className="text-[16px] leading-[1.7] pt-0.5 select-text flex flex-col text-white/70 font-normal">
                        <div className="flex flex-wrap gap-x-1">
                            <span className="text-white/70 font-medium mr-1">{t('infoModal.cast', { defaultValue: 'Cast:' })}</span>
                            {cast.slice(0, 4).map((actor, i, arr) => (
                                <React.Fragment key={actor}>
                                    <span
                                        onClick={() => {
                                            handleClose();
                                            triggerSearch(navigate, actor);
                                        }}
                                        className="text-white/70 font-normal hover:underline hover:text-white cursor-pointer"
                                    >
                                        {actor}
                                    </span>
                                    {i < arr.length - 1 ? <span className="text-white/70 font-normal">, </span> : null}
                                </React.Fragment>
                            ))}
                        </div>
                        <div className="text-white/70">
                            <span className="font-medium mr-1">{t('infoModal.creators', { defaultValue: 'Creators:' })}</span>
                            <span className="font-normal">{t('infoModal.creatorsList', { defaultValue: 'Daniel J. Goor, Michael Schur' })}</span>
                        </div>
                    </div>
                )}

                {/* Utility Icons Bar: My List, Rate (Popup), Share */}
                <div className="relative flex items-center justify-around mt-2 px-4 py-2 select-none">
                    {/* Transparent Click Catcher for tapping outside the rating popup */}
                    {showRatePopup && (
                        <div 
                            className="fixed inset-0 z-[10015] bg-transparent"
                            onClick={() => setShowRatePopup(false)}
                        />
                    )}

                    {/* Inline Rating Popup Floating Above */}
                    {showRatePopup && (
                        <div 
                            className="absolute bottom-[78px] left-0 right-0 mx-auto w-max z-[10020] bg-[#2f2f2f] rounded-full px-7 py-2.5 flex items-center justify-center gap-x-8 shadow-[0_12px_32px_rgba(0,0,0,0.85)] animate-popIn whitespace-nowrap"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Option 1: Dislike */}
                            <button
                                onClick={() => {
                                    rateMovie(activeMovie, 'dislike');
                                    setShowRatePopup(false);
                                }}
                                className="flex flex-col items-center gap-y-1.5 transition-all active:scale-90"
                            >
                                <ThumbsDownIcon size={20} weight={getMovieRating(movie.id) === 'dislike' ? 'fill' : 'bold'} className="text-white" />
                                <span className="text-[10px] font-medium text-white">{t('infoModal.notForMe', { defaultValue: 'Not for me' })}</span>
                            </button>

                            {/* Option 2: Like */}
                            <button
                                onClick={() => {
                                    rateMovie(activeMovie, 'like');
                                    setShowRatePopup(false);
                                }}
                                className="flex flex-col items-center gap-y-1.5 transition-all active:scale-90"
                            >
                                <ThumbsUpIcon size={20} weight={getMovieRating(movie.id) === 'like' ? 'fill' : 'bold'} className="text-white" />
                                <span className="text-[10px] font-medium text-white">{t('infoModal.iLikeThis', { defaultValue: 'I like this' })}</span>
                            </button>

                            {/* Option 3: Love */}
                            <button
                                onClick={() => {
                                    rateMovie(activeMovie, 'love');
                                    setShowRatePopup(false);
                                }}
                                className="flex flex-col items-center gap-y-1.5 transition-all active:scale-90"
                            >
                                <DoubleThumbsUpIcon size={20} weight={getMovieRating(movie.id) === 'love' ? 'fill' : 'bold'} className="text-white" maskColor="#2f2f2f" />
                                <span className="text-[10px] font-medium text-white">{t('infoModal.loveThis', { defaultValue: 'Love this!' })}</span>
                            </button>
                        </div>
                    )}

                    {/* My List Button */}
                    <button
                        onClick={() => toggleList(activeMovie)}
                        className="h-[54px] flex flex-col items-center justify-center gap-y-1.5 text-[11px] font-bold text-white/60 active:scale-95 transition-all cursor-pointer"
                    >
                        {isAdded ? (
                            <CheckIcon size={24} weight="bold" className="text-white" />
                        ) : (
                            <PlusIcon size={24} weight="bold" className="text-white" />
                        )}
                        <span className="mt-1">{t('infoModal.myList', { defaultValue: 'My List' })}</span>
                    </button>

                    {/* Remove Progress Button */}
                    {(hasResumeMovie || hasResumeTV) && (
                        <button
                            onClick={() => {
                                clearVideoState(activeMovie.id);
                            }}
                            className="h-[54px] flex flex-col items-center justify-center gap-y-1.5 text-[11px] font-bold text-white/60 active:scale-95 transition-all cursor-pointer hover:text-white"
                        >
                            <XIcon size={24} weight="bold" className="text-white hover:text-white" />
                            <span className="mt-1">{t('common.removeProgress')}</span>
                        </button>
                    )}

                    {/* Rate / Close X Button */}
                    {showRatePopup ? (
                        <div className="h-[54px] flex flex-col items-center justify-center z-[10020]">
                            <button
                                onClick={() => setShowRatePopup(false)}
                                className="flex items-center justify-center w-9 h-9 rounded-full bg-[#2f2f2f] text-white active:scale-95 transition-all cursor-pointer shadow-md"
                                title={t('common.closeRating')}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-5 h-5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                            <span className="mt-1 text-[11px] font-bold opacity-0 h-0 select-none pointer-events-none">{t('infoModal.rate', { defaultValue: 'Rate' })}</span>
                        </div>
                    ) : (
                        <div className="h-[54px] flex flex-col items-center justify-center gap-y-1 text-[11px] font-bold text-white/60">
                            <button
                                onClick={() => setShowRatePopup(true)}
                                className="flex items-center justify-center w-[24px] h-[24px] active:scale-95 transition-all cursor-pointer"
                                title={t('common.rateTitle')}
                            >
                                {(() => {
                                     const rating = getMovieRating(movie.id);
                                     if (rating === 'love') return <DoubleThumbsUpIcon size={24} weight="fill" className="text-white" maskColor="#000000" />;
                                     if (rating === 'dislike') return <ThumbsDownIcon size={24} weight="fill" className="text-white" />;
                                     return <ThumbsUpIcon size={24} weight={rating ? 'fill' : 'bold'} className="text-white" />;
                                })()}
                            </button>
                            <span className="mt-1">{t('infoModal.rate', { defaultValue: 'Rate' })}</span>
                        </div>
                    )}

                    {/* Share Button */}
                    <button
                        onClick={() => {
                            const url = `${window.location.origin}/title/${mediaType}/${activeMovie.id}`;
                            navigator.clipboard.writeText(url);
                            alert("Link copied to clipboard!");
                        }}
                        className="h-[54px] flex flex-col items-center justify-center gap-y-1 text-[11px] font-bold text-white/60 active:scale-95 transition-all cursor-pointer"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.3" stroke="currentColor" className="w-[22px] h-[22px] text-white">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                        </svg>
                        <span className="mt-1.5">{t('infoModal.share', { defaultValue: 'Share' })}</span>
                    </button>
                </div>

                {/* Double Tabs section at the bottom — overlapping red line selection indicator */}
                <div className="relative flex border-b border-white/25 gap-x-6 text-[15px] font-bold text-gray-400 mt-3 mb-1">
                    {mediaType === 'tv' && (
                        <button
                            onClick={() => setActiveMobileTab('episodes')}
                            className={`pb-2 relative transition-colors ${activeMobileTab === 'episodes' ? 'text-white font-extrabold' : 'hover:text-white'}`}
                        >
                            {t('infoModal.episodesTab', { defaultValue: 'Episodes' })}
                            {activeMobileTab === 'episodes' && (
                                <div className="absolute left-0 right-0 h-[4px] bg-[#e50914] rounded-none" style={{ bottom: '-1px' }} />
                            )}
                        </button>
                    )}
                    <button
                        onClick={() => setActiveMobileTab('more')}
                        className={`pb-2 relative transition-colors ${activeMobileTab === 'more' ? 'text-white font-extrabold' : 'hover:text-white'}`}
                    >
                        {t('infoModal.moreTab', { defaultValue: 'More Like This' })}
                        {activeMobileTab === 'more' && (
                            <div className="absolute left-0 right-0 h-[4px] bg-[#e50914] rounded-none" style={{ bottom: '-1px' }} />
                        )}
                    </button>
                </div>

                {/* Tab contents */}
                <div className="mt-1">
                    {activeMobileTab === 'episodes' && mediaType === 'tv' && (
                        <InfoModalEpisodesTouch
                            movie={activeMovie}
                            mediaType={mediaType}
                            episodes={episodes}
                            loadingEpisodes={loadingEpisodes}
                            selectedSeason={selectedSeason}
                            setSelectedSeason={setSelectedSeason}
                            onPlay={onPlay}
                            totalSeasons={totalSeasons}
                        />
                    )}
                    {activeMobileTab === 'more' && (
                        <InfoModalRecommendationsTouch
                            recommendations={recommendations}
                            onRecommendationClick={handleRecommendationClick}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

export default InfoModalTouch;
