import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { XIcon, PlayIcon, CheckIcon, PlusIcon, SpeakerSlashIcon, SpeakerHighIcon, ThumbsUpIcon, ThumbsDownIcon, HeartIcon, TicketIcon, ClockIcon, ArrowCounterClockwiseIcon } from '@phosphor-icons/react';
import { Movie, Episode } from '../types';
import { IMG_PATH, REQUESTS } from '../constants';
import { useGlobalContext } from '../context/GlobalContext';
import { getSeasonDetails } from '../services/api';

import InfoModalEpisodes from './InfoModalEpisodes';
import InfoModalRecommendations from './InfoModalRecommendations';
import { useMovieData } from '../hooks/useMovieData';
import { useIsInTheaters } from '../hooks/useIsInTheaters';
import { NetworkPriority } from '../services/NetworkPriority';
import { MaturityBadge } from './MovieCardBadges';
import { triggerSearch } from '../utils/search';
import { TrailerPlayer } from './TrailerPlayer';
import { useTasteEngine } from '../hooks/useTasteEngine';


interface InfoModalProps {
    movie: Movie | null;
    initialTime?: number; // Resume from Hero
    onClose: (finalTime?: number) => void; // Pass back time
    onPlay: (movie: Movie, season?: number, episode?: number) => void;
    trailerId?: string; // Force specific video
}

type MovieRating = 'like' | 'dislike' | 'love';
const InfoModalRatingPill: React.FC<{ rating: MovieRating | undefined; onRate: (r: MovieRating) => void }> = ({ rating, onRate }) => {
    const [expanded, setExpanded] = useState(false);
    const CurrentIcon = rating === 'love' ? HeartIcon : rating === 'dislike' ? ThumbsDownIcon : ThumbsUpIcon;
    return (
        <div className="relative flex items-center" onMouseEnter={() => setExpanded(true)} onMouseLeave={() => setExpanded(false)}>
            <div
                className={`flex items-center overflow-hidden transition-all duration-200 border-2 rounded-full bg-[#2a2a2a]/60
          ${expanded ? 'border-white/60 px-2 gap-2' : 'border-gray-500 justify-center w-10 h-10 sm:w-12 sm:h-12'}`}
                style={{ height: expanded ? 48 : undefined }}
            >
                {expanded ? (
                    <>
                        {(['love', 'like', 'dislike'] as MovieRating[]).map(r => {
                            const Icon = r === 'love' ? HeartIcon : r === 'like' ? ThumbsUpIcon : ThumbsDownIcon;
                            const isActive = rating === r;
                            return (
                                <button
                                    key={r}
                                    onClick={(e) => { e.stopPropagation(); onRate(r); setExpanded(false); }}
                                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-150 hover:scale-125 flex-shrink-0
                    ${isActive ? 'text-white' : 'text-white/60 hover:text-white'}`}
                                    title={r.charAt(0).toUpperCase() + r.slice(1)}
                                >
                                    <Icon size={22} weight={isActive ? 'fill' : 'bold'} />
                                </button>
                            );
                        })}
                    </>
                ) : (
                    <CurrentIcon size={22} weight={rating ? 'fill' : 'bold'} className={rating ? 'text-white' : 'text-gray-300'} />
                )}
            </div>
        </div>
    );
};

const InfoModal: React.FC<InfoModalProps> = ({ movie, initialTime = 0, onClose, onPlay, trailerId }) => {
    const {
        myList, toggleList, updateVideoState, heroVideoState,
        globalMute, setGlobalMute, getVideoState, setActiveVideoId,
        getLastWatchedEpisode, rateMovie, getMovieRating, getEpisodeProgress,
        clearVideoState
    } = useGlobalContext();
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [overrideMovie, setOverrideMovie] = useState<Movie | null>(null);
    const activeMovieProp = overrideMovie || movie;
    const { detailedMovie, cast, recommendations, logoUrl, isLoading } = useMovieData(activeMovieProp);
    const [imgFailed, setImgFailed] = useState(false);
    const isCinemaOnly = useIsInTheaters(movie);

    const [isPlayingTrailer, setIsPlayingTrailer] = useState(false);
    const [hasVideoEnded, setHasVideoEnded] = useState(false);
    const [replayCount, setReplayCount] = useState(0);

    const { getMatchScore } = useTasteEngine();
    const matchScore = getMatchScore(detailedMovie || activeMovieProp);

    // Episode / Season State
    const [episodes, setEpisodes] = useState<Episode[]>([]);
    const [selectedSeason, setSelectedSeason] = useState(1);
    const [loadingEpisodes, setLoadingEpisodes] = useState(false);

    const modalRef = useRef<HTMLDivElement>(null);
    const heroRef = useRef<HTMLDivElement>(null);

    // ── Spring-from-card animation (FLIP technique) ──────────────────────
    const [springTransform, setSpringTransform] = useState<string>('none');
    const [springTransition, setSpringTransition] = useState('none');

    const mediaType = activeMovieProp
        ? (activeMovieProp.media_type || (activeMovieProp.title ? 'movie' : 'tv')) as 'movie' | 'tv'
        : 'movie';


    useEffect(() => {
        (window as any).__modal_active = true;
        return () => { (window as any).__modal_active = false; };
    }, []);

    useEffect(() => {
        const rect = (window as any).__last_card_rect as DOMRect | undefined;
        if (!rect || !modalRef.current) return;
        const modalRect = modalRef.current.getBoundingClientRect();
        const scaleX = rect.width / modalRect.width;
        const scaleY = rect.height / modalRect.height;
        const tx = rect.left + rect.width / 2 - (modalRect.left + modalRect.width / 2);
        const ty = rect.top + rect.height / 2 - (modalRect.top + modalRect.height / 2);
        setSpringTransition('none');
        setSpringTransform(`translate(${tx}px, ${ty}px) scale(${scaleX}, ${scaleY})`);
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                setSpringTransition('transform 0.44s cubic-bezier(0.25, 0.46, 0.45, 0.94)');
                setSpringTransform('translate(0px, 0px) scale(1, 1)');
                delete (window as any).__last_card_rect;
            });
        });
    }, []);

    const [resumeContext, setResumeContext] = useState<{ season: number; episode: number } | null>(null);
    useEffect(() => {
        if (!movie) return;
        const scrollY = window.scrollY;
        document.body.style.position = 'fixed';
        document.body.style.top = `-${scrollY}px`;
        document.body.style.left = '0';
        document.body.style.right = '0';
        document.body.style.overflowY = 'scroll';
        setActiveVideoId(`modal-${movie.id}`);
        return () => {
            document.body.style.position = '';
            document.body.style.top = '';
            document.body.style.left = '';
            document.body.style.right = '';
            document.body.style.overflowY = '';
            window.scrollTo({ top: scrollY, behavior: 'instant' as ScrollBehavior });
            setActiveVideoId(null);
        };
    }, [movie, setActiveVideoId]);

    const [springRect, setSpringRect] = useState<any>(null);
    useEffect(() => {
        if (movie) {
            setSpringRect((window as any).__last_card_rect || null);
            if (trailerId) setActiveVideoId(trailerId);
        }
        return () => setActiveVideoId(null);
    }, [movie, trailerId]);

    const handleClose = () => {
        onClose();
    };

    useEffect(() => {
        if (movie) {
            setImgFailed(false);
            setIsPlayingTrailer(false);
            setHasVideoEnded(false);
            setEpisodes([]);
            setSelectedSeason(1);
            setResumeContext(null);
            setReplayCount(0);
            setOverrideMovie(null);

            const type = (movie.media_type || (movie.title ? 'movie' : 'tv')) as 'movie' | 'tv';

            if (type === 'tv') {
                const saved = getLastWatchedEpisode(movie.id);
                if (saved?.season && saved?.episode) {
                    setResumeContext({ season: saved.season, episode: saved.episode });
                    setSelectedSeason(saved.season);
                }
            }
        }
    }, [movie]);

    useEffect(() => {
        if (!overrideMovie) return;
        const type = (overrideMovie.media_type || (overrideMovie.title ? 'movie' : 'tv')) as 'movie' | 'tv';
        if (type === 'tv') {
            const saved = getLastWatchedEpisode(overrideMovie.id);
            if (saved?.season && saved?.episode) {
                setResumeContext({ season: saved.season, episode: saved.episode });
                setSelectedSeason(saved.season);
            }
        }
    }, [overrideMovie]);

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
    }, [selectedSeason, mediaType, movie, fetchEpisodes]);

    const visibilityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [showBackdropOverlay, setShowBackdropOverlay] = useState(false);
    
    // Visibility & Scroll Pause Logic
    const visibilityRef = useRef({ isVisible: true, isIntersecting: true });
    
    useEffect(() => {
        if (!movie) return;

        visibilityRef.current.isVisible = document.visibilityState === 'visible';
        // Assume intersecting until observer says otherwise
        visibilityRef.current.isIntersecting = true; 

        const updateVideoState = () => {
            if (visibilityRef.current.isVisible && visibilityRef.current.isIntersecting) {
                setActiveVideoId(`modal-${movie.id}`);
            } else {
                setActiveVideoId(`paused-modal-${movie.id}`);
            }
        };

        const handleVisibility = () => {
            visibilityRef.current.isVisible = document.visibilityState === 'visible';
            if (!visibilityRef.current.isVisible) {
                visibilityTimerRef.current = setTimeout(() => {
                    setShowBackdropOverlay(true);
                }, 30_000);
            } else {
                if (visibilityTimerRef.current) clearTimeout(visibilityTimerRef.current);
                setShowBackdropOverlay(false);
            }
            updateVideoState();
        };

        document.addEventListener('visibilitychange', handleVisibility);
        
        let observer: IntersectionObserver | null = null;
        if (heroRef.current) {
            // Using a slight delay to prevent rapid toggling if the user scrolls quickly past the threshold
            observer = new IntersectionObserver(([entry]) => {
                visibilityRef.current.isIntersecting = entry.isIntersecting;
                updateVideoState();
            }, { threshold: 0.1 }); // Pause when less than 10% is visible
            observer.observe(heroRef.current);
        }

        updateVideoState();

        return () => {
            document.removeEventListener('visibilitychange', handleVisibility);
            if (observer) observer.disconnect();
            if (visibilityTimerRef.current) clearTimeout(visibilityTimerRef.current);
        };
    }, [movie, setActiveVideoId]);

    if (!movie) return null;
    const activeMovie = detailedMovie || activeMovieProp;
    const isAdded = myList.find(m => m.id === activeMovieProp.id);
    const year = (activeMovie.release_date || activeMovie.first_air_date)?.substring(0, 4) || "";
    const totalSeasons = activeMovie.number_of_seasons || 0;
    const duration = activeMovie.runtime
        ? `${Math.floor(activeMovie.runtime / 60)}${t('common.hour')} ${activeMovie.runtime % 60}${t('common.minute')}`
        : totalSeasons
            ? `${totalSeasons} ${t('common.season')}${totalSeasons > 1 ? 's' : ''}`
            : "";

    const handleRecommendationClick = (rec: Movie) => {
        setOverrideMovie(rec);
        setImgFailed(false);
        setIsPlayingTrailer(false);
        setHasVideoEnded(false);
        setEpisodes([]);
        setSelectedSeason(1);
        setResumeContext(null);
        if (modalRef.current) {
            modalRef.current.parentElement?.scrollTo({ top: 0, behavior: 'smooth' });
        }
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

    const hasResumeMovie = mediaType === 'movie' && watchPct >= 5;
    const hasResumeTV = mediaType === 'tv' && watchPct >= 5;

    return (
        <div
            className="fixed inset-0 z-[200] bg-black/70 flex justify-center overflow-y-auto backdrop-blur-[1px] scrollbar-hide animate-fadeIn cursor-default"
            onClick={handleClose}
        >
            <div
                ref={modalRef}
                // TWEAK HERE: Change max-w-[850px] to make narrower/wider. Change mt-6 md:mt-8 to move it up/down on Y-axis.
                className="relative w-full max-w-[850px] bg-[#181818] rounded-xl shadow-2xl mt-6 md:mt-8 mb-8 overflow-hidden h-fit mx-4 ring-1 ring-white/10"
                style={{
                    transform: springTransform,
                    transition: springTransition,
                    transformOrigin: 'center center',
                    willChange: 'transform',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    type="button"
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleClose();
                    }}
                    className="absolute top-4 right-4 w-10 h-10 rounded-full bg-[#181818] flex items-center justify-center border-2 border-transparent hover:border-white transition z-50 cursor-pointer"
                >
                    <XIcon size={24} className="text-white" />
                </button>

                {/* --- Hero Section --- */}
                <div ref={heroRef} className="relative h-[280px] sm:h-[360px] md:h-[490px] w-full bg-black group overflow-hidden">
                    <div className="absolute inset-0 z-0 text-[0px]">
                        <img
                            src={`${IMG_PATH}${activeMovie.backdrop_path || activeMovie.poster_path}`}
                            className={`w-full h-full object-cover scale-[1.05] transition-opacity duration-700 ${isPlayingTrailer ? 'opacity-0' : 'opacity-100'}`}
                            alt="modal hero"
                        />
                        <div className={`absolute inset-0 transition-opacity duration-1000 overflow-hidden ${(isPlayingTrailer && !showBackdropOverlay) ? 'opacity-100' : 'opacity-0'}`}>
                            <TrailerPlayer 
                                key={`modal-player-${replayCount}`}
                                movie={activeMovie} 
                                variant="modal"
                                onReady={() => setIsPlayingTrailer(true)}
                                onEnded={() => {
                                    setIsPlayingTrailer(false);
                                    setHasVideoEnded(true);
                                }}
                                onErrored={() => {
                                    setIsPlayingTrailer(false);
                                }}
                            />
                        </div>
                        <div className="absolute inset-0 bg-gradient-to-t from-[#181818] via-transparent to-transparent z-10 pointer-events-none" />
                    </div>

                    <div className="absolute bottom-0 left-0 w-full p-6 md:p-12 space-y-3 md:space-y-4 z-20 pointer-events-auto">
                        <div className="inline-flex flex-col max-w-[80%]">
                            {logoUrl && !imgFailed ? (
                                <div className="relative inline-flex items-end">
                                    {/* Dual-layer premium shadow for high-contrast visibility */}
                                    <img src={logoUrl} aria-hidden style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'bottom left', filter: 'blur(25px) brightness(0) opacity(0.55)', transform: 'translate(4px, 12px) scale(1.08)', pointerEvents: 'none', zIndex: 0 }} />
                                    <img src={logoUrl} aria-hidden style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'bottom left', filter: 'blur(5px) brightness(0) opacity(0.35)', transform: 'translate(2px, 4px) scale(1.02)', pointerEvents: 'none', zIndex: 0 }} />
                                    <img src={logoUrl} alt={activeMovie.title || activeMovie.name} style={{ position: 'relative', zIndex: 1, maxHeight: 'clamp(68px, 11vw, 120px)', maxWidth: '72%', objectFit: 'contain', objectPosition: 'bottom left' }} onError={() => setImgFailed(true)} />
                                </div>
                            ) : (
                                <h2 className="text-3xl sm:text-4xl md:text-5xl font-black font-leaner text-white drop-shadow-xl leading-none tracking-wide">
                                    {activeMovie.title || activeMovie.name}
                                </h2>
                            )}
                            {watchPct > 1 && (
                                <div className="relative mt-3 w-full flex items-center">
                                    <div className="w-full h-[3px] bg-white/25 overflow-hidden" style={{ borderRadius: 0 }}>
                                        <div className="h-full bg-[#e50914] transition-all duration-300" style={{ width: `${watchPct}%`, borderRadius: 0 }} />
                                    </div>
                                    {totalMins > 0 && (
                                        <span className="absolute left-[100%] ml-2.5 text-gray-400/80 text-[11px] whitespace-nowrap font-medium">
                                            {watchMins} of {totalMins}m
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="flex items-center space-x-3">
                            {isCinemaOnly && mediaType === 'movie' ? (
                                <div className="bg-[#6d6d6e]/80 text-white px-6 sm:px-8 h-10 sm:h-12 rounded-[4px] font-bold text-base sm:text-lg flex items-center select-none cursor-not-allowed">
                                    <TicketIcon size={24} weight="bold" className="mr-2" />
                                    {t('hero.inTheaters')}
                                </div>
                            ) : (() => {
                                let watchUrl = `/watch/${mediaType}/${activeMovie.id}`;
                                if (mediaType === 'tv' && lastEp) {
                                    watchUrl += `?season=${lastEp.season}&episode=${lastEp.episode}`;
                                }
                                return (
                                    <Link to={watchUrl} className="bg-white text-black px-6 sm:px-8 h-10 sm:h-12 rounded-[4px] font-bold text-base sm:text-lg flex items-center hover:bg-gray-200 transition active:scale-95 shadow-lg group-buttons no-underline">
                                        <PlayIcon size={24} weight="fill" className="mr-2" />
                                        {hasResumeTV ? `Resume E${lastEp?.episode}` : hasResumeMovie ? 'Resume' : t('hero.play')}
                                    </Link>
                                );
                            })()}
                            <button onClick={() => toggleList(activeMovie)} className={`border-2 rounded-full w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95 ${isAdded ? 'border-white bg-white/10 text-white shadow-[0_0_8px_rgba(255,255,255,0.25)]' : 'border-gray-500 bg-[#2a2a2a]/60 text-gray-300 hover:border-white hover:text-white'}`}>
                                {isAdded ? <CheckIcon size={24} /> : <PlusIcon size={24} />}
                            </button>
                            <InfoModalRatingPill rating={getMovieRating(movie.id)} onRate={(r) => rateMovie(activeMovie, r)} />
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
                        }} className="absolute bottom-6 right-6 z-30 w-10 h-10 rounded-full border border-white/40 bg-zinc-900/40 backdrop-blur-md flex items-center justify-center transition-all duration-300 hover:bg-white/10 hover:scale-110 hover:border-white shadow-xl pointer-events-auto cursor-pointer">
                            {hasVideoEnded ? <ArrowCounterClockwiseIcon size={20} className="text-white" /> : globalMute ? <SpeakerSlashIcon size={20} className="text-white" /> : <SpeakerHighIcon size={20} className="text-white" />}
                        </button>
                    )}
                </div>

                <div className="px-6 md:px-12 pb-12 bg-[#181818]">
                    <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-x-8 gap-y-6">
                        <div className="space-y-4">
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-white font-bold text-sm md:text-base mt-2 font-harmonia-condensed">
                                {matchScore !== null && (
                                    <span className="text-green-500 font-extrabold tracking-wide">{matchScore}% Match</span>
                                )}
                                <span className="text-white tracking-wide">{year}</span>
                                <span className="text-white tracking-wide">{duration}</span>
                                <span className="border border-gray-400 px-1.5 py-0.5 text-[10px] rounded-[2px] text-gray-300 h-fit leading-none font-extrabold">HD</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <MaturityBadge adult={activeMovie.adult} voteAverage={activeMovie.vote_average} size="md" />
                                <span className="text-sm font-semibold text-gray-200">{activeMovie.adult ? t('common.maturity.adultDesc') : t('common.maturity.teenDesc')}</span>
                            </div>
                            <p className="text-white font-medium text-sm md:text-[15px] leading-relaxed pt-2">{activeMovie.overview}</p>
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
                            onPlay={(rec) => onPlay(rec)}
                        />
                    </div>


                </div>
            </div>
        </div>
    );
};

export default InfoModal;