import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation, useSearchParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PlayIcon, CheckIcon, PlusIcon, SpeakerSlashIcon, SpeakerHighIcon, ThumbsUpIcon, ThumbsDownIcon, HeartIcon, ArrowCounterClockwiseIcon } from '@phosphor-icons/react';
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
    
    const { detailedMovie, cast, recommendations, isLoading } = useMovieData(activeMovieProp);
    
    const [isPlayingTrailer, setIsPlayingTrailer] = useState(false);
    const [isActuallyPlaying, setIsActuallyPlaying] = useState(false);
    const [hasVideoEnded, setHasVideoEnded] = useState(false);
    const [replayCount, setReplayCount] = useState(0);
    const [showBackdropOverlay, setShowBackdropOverlay] = useState(false);
    const visibilityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const backdropForcedRef = useRef(false);

    const [episodes, setEpisodes] = useState<Episode[]>([]);
    const [selectedSeason, setSelectedSeason] = useState(1);
    const [loadingEpisodes, setLoadingEpisodes] = useState(false);
    
    const [activeMobileTab, setActiveMobileTab] = useState<'episodes' | 'more'>('episodes');

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

            import('../hooks/useTrailer').then(({ preloadTrailer }) => {
                preloadTrailer(movie);
            });

            if (mediaType === 'tv') {
                const saved = getLastWatchedEpisode(movie.id);
                if (saved?.season && saved?.episode) {
                    setSelectedSeason(saved.season);
                }
            }
        }
    }, [movie, mediaType, getLastWatchedEpisode]);

    const fetchEpisodes = useCallback(async (id: number, season: number) => {
        setLoadingEpisodes(true);
        const response = await getSeasonDetails(id, season);
        setEpisodes(response?.episodes || []);
        setLoadingEpisodes(false);
    }, []);

    useEffect(() => {
        if (mediaType === 'tv' && activeMovieProp) {
            fetchEpisodes(Number(activeMovieProp.id), selectedSeason);
        }
    }, [selectedSeason, mediaType, activeMovieProp, fetchEpisodes]);

    // Pause/Resume on scroll or visibility change
    useEffect(() => {
        if (!movie) return;

        const isVisible = () => document.visibilityState === 'visible';
        const isIntersectingRef = { current: true };

        const update = () => {
            const visible = isVisible();
            if (visible && isIntersectingRef.current) {
                setActiveVideoId(`modal-${movie.id}`);
                if (visibilityTimerRef.current) clearTimeout(visibilityTimerRef.current);
                backdropForcedRef.current = false;
                setShowBackdropOverlay(false);
            } else {
                setActiveVideoId(`paused-modal-${movie.id}`);
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
        onClose();
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
        <div className="fixed inset-0 z-[10000] bg-[#121212] overflow-y-auto scrollbar-hide flex flex-col w-full h-full select-none cursor-default pb-12">
            {/* Back button */}
            <button
                type="button"
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleClose();
                }}
                className="fixed top-[calc(16px+env(safe-area-inset-top))] left-4 w-11 h-11 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center border border-white/10 active:scale-95 transition-all duration-200 z-[10010] shadow-lg cursor-pointer"
            >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.8" stroke="currentColor" className="w-5.5 h-5.5 text-white">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
            </button>

            {/* Media Container Banner */}
            <div ref={heroRef} className="relative aspect-video w-full bg-black overflow-hidden shrink-0 mt-0">
                <img
                    src={`${IMG_PATH}${activeMovie.backdrop_path || activeMovie.poster_path}`}
                    className={`w-full h-full object-cover transition-opacity duration-400 ${isActuallyPlaying ? 'opacity-0' : 'opacity-100'}`}
                    alt="modal hero mobile"
                />
                
                {/* Preview overlay badge */}
                <div className="absolute top-4 right-4 bg-black/55 border border-white/15 px-2.5 py-0.5 rounded-[3px] text-[11px] font-bold uppercase tracking-wider text-white backdrop-blur-[2px]">
                    Preview
                </div>

                <div className={`absolute inset-0 transition-opacity duration-300 overflow-hidden ${isActuallyPlaying && !showBackdropOverlay ? 'opacity-100' : 'opacity-0'}`}>
                    <TrailerPlayer 
                        key={`mobile-modal-player-${replayCount}`}
                        movie={activeMovie} 
                        variant="modal"
                        onReady={() => setIsPlayingTrailer(true)}
                        onPlay={() => setIsActuallyPlaying(true)}
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

                {/* Cinematic bottom gradient */}
                <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-[#121212] to-transparent z-10 pointer-events-none" />

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
                    }} className="absolute bottom-4 right-4 z-30 w-9 h-9 rounded-full border border-white/30 bg-zinc-900/40 backdrop-blur-md flex items-center justify-center transition-all duration-300 hover:bg-white/10 active:scale-95 shadow-xl pointer-events-auto cursor-pointer">
                        {hasVideoEnded ? <ArrowCounterClockwiseIcon size={18} className="text-white" /> : globalMute ? <SpeakerSlashIcon size={18} className="text-white" /> : <SpeakerHighIcon size={18} className="text-white" />}
                    </button>
                )}
            </div>

            {/* Details Content Container */}
            <div className="px-4.5 pt-3 pb-8 flex flex-col gap-y-4">
                {/* Text Title */}
                <h2 className="text-2xl font-black font-netflix text-white tracking-wide leading-tight pt-0.5">
                    {activeMovie.title || activeMovie.name}
                </h2>

                {/* Meta Row (No 88% Match) */}
                <div className="flex items-center gap-x-3 text-[14px] font-bold text-[#a3a3a3] flex-wrap gap-y-2">
                    <span className="text-white font-extrabold">{year}</span>
                    
                    {/* Rounded grey maturity rating block matching screenshot */}
                    <span className="bg-zinc-800 text-gray-300 font-extrabold px-1.5 py-0.5 rounded-[3px] border border-gray-600 text-[11.5px] leading-none select-none shrink-0">
                        {ageRating}+
                    </span>

                    <span className="text-white font-extrabold">{duration}</span>
                    <span className="border border-white/30 px-1.5 py-0.5 text-[9px] rounded-[2px] text-gray-300 font-extrabold leading-none">HD</span>
                </div>

                {/* Primary CTA Play/Resume Button (White full-width) */}
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
                                className="w-full bg-white text-black h-[45px] rounded-[4px] font-extrabold text-[15px] flex items-center justify-center hover:bg-gray-200 transition active:scale-[0.98] shadow-md leading-none no-underline gap-2"
                            >
                                <PlayIcon size={22} weight="fill" />
                                <span>{hasResumeTV ? `Resume` : hasResumeMovie ? 'Resume' : 'Play'}</span>
                            </Link>
                        );
                    })()}
                </div>

                {/* Secondary CTA button ("My List" as full-width dark grey button) */}
                <button
                    onClick={() => toggleList(activeMovie)}
                    className="w-full bg-[#2a2a2a] hover:bg-[#333333] border border-white/5 text-white h-[45px] rounded-[4px] font-extrabold text-[15px] flex items-center justify-center transition active:scale-[0.98] gap-2.5"
                >
                    {isAdded ? (
                        <>
                            <CheckIcon size={20} weight="bold" />
                            <span>In My List</span>
                        </>
                    ) : (
                        <>
                            <PlusIcon size={20} weight="bold" />
                            <span>My List</span>
                        </>
                    )}
                </button>

                {/* TV Last-Watched progress block (Flat, borderless directly on black) */}
                {mediaType === 'tv' && (
                    <div className="flex flex-col gap-y-1.5 mt-2">
                        <h3 className="text-[15px] font-extrabold text-white leading-none tracking-wide">
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
                            <span className="text-white/40 text-[11px] font-extrabold shrink-0 leading-none">{remainingText}</span>
                        </div>
                    </div>
                )}

                {/* Description overview */}
                <p className="text-[#e5e5e5] font-normal text-[14px] leading-[1.65] pt-0.5 select-text">
                    {activeMovie.overview || "No overview description available."}
                </p>

                {/* Cast List (80% transparent = text-white/50) */}
                {cast && cast.length > 0 && (
                    <div className="text-[13px] leading-[1.7] pt-0.5 select-text flex flex-col">
                        <div className="flex flex-wrap gap-x-1">
                            <span className="text-white/50 font-bold mr-1">Cast:</span>
                            {cast.slice(0, 4).map((actor, i, arr) => (
                                <React.Fragment key={actor}>
                                    <span
                                        onClick={() => {
                                            handleClose();
                                            triggerSearch(navigate, actor);
                                        }}
                                        className="text-white/50 font-semibold hover:underline hover:text-white cursor-pointer"
                                    >
                                        {actor}
                                    </span>
                                    {i < arr.length - 1 ? <span className="text-white/50 font-semibold">, </span> : null}
                                </React.Fragment>
                            ))}
                        </div>
                        <div className="text-white/50 font-bold">
                            Creators: Daniel J. Goor, Michael Schur
                        </div>
                    </div>
                )}

                {/* Utility Icons Bar matching screenshot: My List, Rate (Cycle tap), Share (copy clean URL) */}
                <div className="flex items-center justify-start gap-x-12 mt-4 px-2 py-1 select-none">
                    <button
                        onClick={() => toggleList(activeMovie)}
                        className="flex flex-col items-center gap-y-1 text-[11px] font-bold text-white/60 active:scale-95 transition-all"
                    >
                        {isAdded ? (
                            <CheckIcon size={24} weight="bold" className="text-white" />
                        ) : (
                            <PlusIcon size={24} weight="bold" className="text-white" />
                        )}
                        <span className="mt-1">My List</span>
                    </button>

                    <div className="flex flex-col items-center gap-y-1 text-[11px] font-bold text-white/60">
                        <button
                            onClick={() => {
                                const current = getMovieRating(movie.id);
                                const next = current === 'like' ? 'dislike' : current === 'dislike' ? 'love' : current === 'love' ? undefined : 'like';
                                rateMovie(activeMovie, next as any);
                            }}
                            className="flex items-center justify-center w-[24px] h-[24px] active:scale-95 transition-all"
                            title="Rate title"
                        >
                            {(() => {
                                const rating = getMovieRating(movie.id);
                                if (rating === 'love') return <HeartIcon size={24} weight="fill" className="text-red-500" />;
                                if (rating === 'dislike') return <ThumbsDownIcon size={24} weight="fill" className="text-white" />;
                                return <ThumbsUpIcon size={24} weight={rating ? 'fill' : 'bold'} className="text-white" />;
                            })()}
                        </button>
                        <span className="mt-1">Rate</span>
                    </div>

                    <button
                        onClick={() => {
                            const url = `${window.location.origin}/title/${mediaType}/${activeMovie.id}`;
                            navigator.clipboard.writeText(url);
                            alert("Link copied to clipboard!");
                        }}
                        className="flex flex-col items-center gap-y-1 text-[11px] font-bold text-white/60 active:scale-95 transition-all"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.3" stroke="currentColor" className="w-[22px] h-[22px] text-white">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                        </svg>
                        <span className="mt-1.5">Share</span>
                    </button>
                </div>

                {/* Double Tabs section at the bottom */}
                <div className="flex border-b border-white/10 gap-x-6 text-[15px] font-bold text-gray-400 mt-6 mb-2">
                    {mediaType === 'tv' && (
                        <button
                            onClick={() => setActiveMobileTab('episodes')}
                            className={`pb-2 relative transition-colors ${activeMobileTab === 'episodes' ? 'text-white font-extrabold' : 'hover:text-white'}`}
                        >
                            Episodes
                            {activeMobileTab === 'episodes' && (
                                <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#e50914] rounded-t-full" />
                            )}
                        </button>
                    )}
                    <button
                        onClick={() => setActiveMobileTab('more')}
                        className={`pb-2 relative transition-colors ${activeMobileTab === 'more' ? 'text-white font-extrabold' : 'hover:text-white'}`}
                    >
                        More Like This
                        {activeMobileTab === 'more' && (
                            <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#e50914] rounded-t-full" />
                        )}
                    </button>
                </div>

                {/* Tab contents */}
                <div className="mt-2">
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
