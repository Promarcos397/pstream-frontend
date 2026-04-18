import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { XIcon, PlayIcon, CheckIcon, PlusIcon, SpeakerSlashIcon, SpeakerHighIcon, ThumbsUpIcon, ThumbsDownIcon, HeartIcon, TicketIcon, ClockIcon, ArrowCounterClockwiseIcon } from '@phosphor-icons/react';
import YouTube from 'react-youtube';
import { Movie, Episode } from '../types';
import { IMG_PATH } from '../constants';
import { useGlobalContext } from '../context/GlobalContext';
import { fetchTrailers, getSeasonDetails, prefetchStream } from '../services/api';
import InfoModalEpisodes from './InfoModalEpisodes';
import InfoModalRecommendations from './InfoModalRecommendations';
import { useMovieData } from '../hooks/useMovieData';
import { useIsInTheaters } from '../hooks/useIsInTheaters';
import { NetworkPriority } from '../services/NetworkPriority';
import { MaturityBadge } from './MovieCardBadges';


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
        getLastWatchedEpisode, rateMovie, getMovieRating, getEpisodeProgress
    } = useGlobalContext();
    const { t } = useTranslation();
    const { detailedMovie, cast, recommendations, logoUrl, isLoading } = useMovieData(movie);
    const [imgFailed, setImgFailed] = useState(false);
    const isCinemaOnly = useIsInTheaters(movie);

    const [trailerQueue, setTrailerQueue] = useState<string[]>([]);
    const [isPlayingTrailer, setIsPlayingTrailer] = useState(false);
    const [isTrailerReady, setIsTrailerReady] = useState(false); // true once player actually starts playing
    const isMuted = globalMute;
    const setIsMuted = setGlobalMute;
    const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Episode / Season State
    const [episodes, setEpisodes] = useState<Episode[]>([]);
    const [selectedSeason, setSelectedSeason] = useState(1);
    const [loadingEpisodes, setLoadingEpisodes] = useState(false);

    const playerRef = useRef<any>(null);
    const modalRef = useRef<HTMLDivElement>(null);
    const [hasVideoEnded, setHasVideoEnded] = useState(false);
    const [replayCount, setReplayCount] = useState(0);

    // ── Spring-from-card animation (FLIP technique) ──────────────────────
    // On mount we read the card's screen rect, compute the transform that makes
    // the modal START visually at the card, then transition it to identity.
    const [springTransform, setSpringTransform] = useState<string>('none');
    const [springTransition, setSpringTransition] = useState('none');

    useEffect(() => {
        const rect = (window as any).__last_card_rect as DOMRect | undefined;
        if (!rect || !modalRef.current) return; // no card rect = no animation, just fade in normally

        // Step 1: measure where the modal actually rendered in the DOM
        const modalRect = modalRef.current.getBoundingClientRect();

        // Step 2: calculate the scale + translate that makes the modal appear AT the card's position
        const scaleX = rect.width  / modalRect.width;
        const scaleY = rect.height / modalRect.height;
        const tx = rect.left + rect.width  / 2 - (modalRect.left + modalRect.width  / 2);
        const ty = rect.top  + rect.height / 2 - (modalRect.top  + modalRect.height / 2);

        // Step 3: instantly snap to card position (no transition — happens before browser paints)
        setSpringTransition('none');
        setSpringTransform(`translate(${tx}px, ${ty}px) scale(${scaleX}, ${scaleY})`);

        // Step 4: two rAF frames later -- spring to identity (natural modal position)
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                setSpringTransition('transform 0.44s cubic-bezier(0.25, 0.46, 0.45, 0.94)');
                setSpringTransform('translate(0px, 0px) scale(1, 1)');
                delete (window as any).__last_card_rect;
            });
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    // ────────────────────────────────────────────────────────────────────

    const [resumeContext, setResumeContext] = useState<{ season: number; episode: number } | null>(null);
    // Lock body scroll when modal is open, restore exactly on close
    useEffect(() => {
        if (!movie) return;

        // Save the current scroll position before locking
        const scrollY = window.scrollY;

        // Lock body in place using fixed positioning (prevents scroll-to-top jump)
        document.body.style.position = 'fixed';
        document.body.style.top = `-${scrollY}px`;
        document.body.style.left = '0';
        document.body.style.right = '0';
        document.body.style.overflowY = 'scroll'; // keep scrollbar space to prevent layout shift

        // Claim the stage when the modal opens
        setActiveVideoId(`modal-${movie.id}`);

        return () => {
            // Restore body scroll lock
            document.body.style.position = '';
            document.body.style.top = '';
            document.body.style.left = '';
            document.body.style.right = '';
            document.body.style.overflowY = '';
            // Restore scroll position exactly where user was
            window.scrollTo({ top: scrollY, behavior: 'instant' as ScrollBehavior });

            // Clear the stage when the modal closes, letting the Hero resume
            setActiveVideoId(null);
        };
    }, [movie, setActiveVideoId]);
    // Determines media type safely
    const mediaType = movie
        ? (movie.media_type || (movie.title ? 'movie' : 'tv')) as 'movie' | 'tv'
        : 'movie';

    // Cinematic Spring Entry
    const [springRect, setSpringRect] = useState<any>(null);
    useEffect(() => {
        if (movie) {
            setSpringRect((window as any).__last_card_rect || null);
            // Claim global player focus
            if (trailerId) setActiveVideoId(trailerId);
        }
        return () => setActiveVideoId(null);
    }, [movie, trailerId]);

    // Helper to close and pass back time
    const handleClose = () => {
        let currentTime = 0;
        let currentVideoId = trailerQueue[0] || trailerId;
        if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
            currentTime = playerRef.current.getCurrentTime();
        }
        // Save to global context for MovieCard sync
        if (movie && currentVideoId) {
            updateVideoState(movie.id, currentTime, currentVideoId);
        }
        onClose(currentTime);
    };

    const getInitialStyles = () => {
        if (!springRect) return { opacity: 0, transform: 'scale(0.9) translateY(20px)' };
        
        // Match card dimensions exactly for the 'Growing' effect
        const scaleX = springRect.width / 850;
        const scaleY = springRect.height / 500; // Estimated init height
        
        return {
            opacity: 0,
            left: `${springRect.x}px`,
            top: `${springRect.y}px`,
            width: `${springRect.width}px`,
            height: `${springRect.height}px`,
            transform: `translate(0, 0) scale(1)`,
            position: 'absolute' as any,
            borderRadius: '0px'
        };
    };

    // Clean up sync interval on unmount
    useEffect(() => {
        return () => {
            if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
        };
    }, []);

    useEffect(() => {
        if (movie) {
            // Reset state for new movie
            setImgFailed(false);
            setTrailerQueue([]);
            setIsPlayingTrailer(false);
            setIsTrailerReady(false);
            setEpisodes([]);
            setSelectedSeason(1);
            setResumeContext(null);
            setHasVideoEnded(false);
            setReplayCount(0);

            const type = (movie.media_type || (movie.title ? 'movie' : 'tv')) as 'movie' | 'tv';

            // 2. Load Resume Context for TV Shows — read from GlobalContext
            if (type === 'tv') {
                const saved = getLastWatchedEpisode(movie.id);
                if (saved?.season && saved?.episode) {
                    setResumeContext({ season: saved.season, episode: saved.episode });
                    setSelectedSeason(saved.season);
                }
            }

            // 3. Load Video (Prioritize Local Sync, then Hero Sync, then Prop, then Fetch)
            const savedState = movie ? getVideoState(movie.id) : null;
            let finalTrailerId = trailerId || savedState?.videoId;

            // Check if Hero currently owns this movie to sync directly from Hero's trailer
            if (!finalTrailerId && heroVideoState.movieId && String(heroVideoState.movieId) === String(movie.id)) {
                finalTrailerId = heroVideoState.videoId;
            }

            if (finalTrailerId) {
                setTrailerQueue([finalTrailerId]);
                setIsPlayingTrailer(true);
                // Also update local state so subsequent opens remember this ID
                if (movie.id && !savedState?.videoId) {
                    updateVideoState(movie.id, 0, finalTrailerId);
                }
            } else {
                fetchTrailers(movie.id, type).then(keys => {
                    if (keys && keys.length > 0) {
                        setTrailerQueue(keys);
                        setIsPlayingTrailer(true);
                        updateVideoState(movie.id, 0, keys[0]);
                    }
                });
            }
        }
    }, [movie, trailerId]); // NOTE: intentionally omit getVideoState — its ref changes on every progress tick, which would reset episodes unnecessarily

    const fetchEpisodes = useCallback(async (id: number, season: number) => {
        setLoadingEpisodes(true);
        const response = await getSeasonDetails(id, season);
        setEpisodes(response?.episodes || []);
        setLoadingEpisodes(false);
    }, []);

    // Handle Season Change Trigger
    useEffect(() => {
        if (mediaType === 'tv' && movie) {
            fetchEpisodes(Number(movie.id), selectedSeason);
        }
    }, [selectedSeason, mediaType, movie, fetchEpisodes]);

    useEffect(() => {
        if (playerRef.current) {
            if (isMuted) playerRef.current.mute();
            else playerRef.current.unMute();
        }
    }, [isMuted]);

    // Cinematic: Tab Visibility Pause (Netflix Logic)
    useEffect(() => {
        const handleVisibility = () => {
            if (document.visibilityState === 'hidden' && playerRef.current) {
                playerRef.current.pauseVideo?.();
            } else if (document.visibilityState === 'visible' && isPlayingTrailer && playerRef.current) {
                playerRef.current.playVideo?.();
            }
        };
        document.addEventListener('visibilitychange', handleVisibility);
        return () => document.removeEventListener('visibilitychange', handleVisibility);
    }, [isPlayingTrailer]);

    // Prefetch stream
    useEffect(() => {
        if (!movie) return;
        const yearStr = (movie.release_date || movie.first_air_date)?.substring(0, 4);
        const year = yearStr ? parseInt(yearStr) : 0;

        if (mediaType === 'movie') {
            // HOT mode: user is actively looking at this movie — pre-resolve for instant play
            prefetchStream(movie.title || movie.name || '', year || undefined, String(movie.id), 'movie', 1, 1, undefined, 'hot');
        } else {
            const s = resumeContext?.season || 1;
            const e = resumeContext?.episode || 1;
            prefetchStream(movie.name || movie.title || '', year || undefined, String(movie.id), 'tv', s, e, undefined, 'hot');
        }
    }, [movie, resumeContext, mediaType]);

    if (!movie) return null;

    const activeMovie = detailedMovie || movie;
    const isAdded = myList.find(m => m.id === movie.id);

    const year = (activeMovie.release_date || activeMovie.first_air_date)?.substring(0, 4) || "";

    const duration = activeMovie.runtime
        ? `${Math.floor(activeMovie.runtime / 60)}${t('common.hour')} ${activeMovie.runtime % 60}${t('common.minute')}`
        : activeMovie.number_of_seasons
            ? `${activeMovie.number_of_seasons} ${t('common.season')}${activeMovie.number_of_seasons > 1 ? 's' : ''}`
            : "";

    const genreNames = activeMovie.genres
        ? activeMovie.genres.map(g => g.name).slice(0, 3).join(', ')
        : activeMovie.genre_ids?.map(id => t(`genres.${id}`)).slice(0, 3).join(', ');

    const handleRecommendationClick = (rec: Movie) => {
        handleClose();
    };

    const savedMovieState = getVideoState(movie.id);
    const lastEp = mediaType === 'tv' ? getLastWatchedEpisode(movie.id) : null;
    
    // threshold: 30s for movies, 0s for episodes
    const hasResumeMovie = mediaType === 'movie' && savedMovieState && savedMovieState.time > 30;
    const hasResumeTV = mediaType === 'tv' && lastEp;
    const isResuming = hasResumeMovie || hasResumeTV;

    const handlePlayClick = () => {
        if (mediaType === 'tv') {
            if (lastEp) {
                onPlay(activeMovie, lastEp.season, lastEp.episode);
            } else if (resumeContext) {
                onPlay(activeMovie, resumeContext.season, resumeContext.episode);
            } else {
                onPlay(activeMovie, 1, 1);
            }
        } else {
            onPlay(activeMovie);
        }
    };

    const totalSeasons = activeMovie.number_of_seasons || 1;

    // Progress bar data — computed once, used in hero area above button
    let watchPct = 0, watchMins = 0, totalMins = 0;
    if (hasResumeMovie && savedMovieState?.time && savedMovieState?.duration) {
        watchPct = Math.min(100, (savedMovieState.time / savedMovieState.duration) * 100);
        watchMins = Math.round(savedMovieState.time / 60);
        totalMins = Math.round(savedMovieState.duration / 60);
    } else if (hasResumeTV && lastEp) {
        const epProg = getEpisodeProgress(movie.id, lastEp.season, lastEp.episode);
        if (epProg?.duration) {
            watchPct = Math.min(100, (epProg.time / epProg.duration) * 100);
            watchMins = Math.round(epProg.time / 60);
            totalMins = Math.round(epProg.duration / 60);
        }
    }

    return (
        <div
            className="fixed inset-0 z-[200] bg-black/70 flex justify-center overflow-y-auto backdrop-blur-[1px] scrollbar-hide animate-fadeIn cursor-default"
            onClick={handleClose}
        >
            <div
                ref={modalRef}
                className="relative w-full max-w-[950px] bg-[#181818] rounded-2xl shadow-2xl mt-12 md:mt-16 mb-8 overflow-hidden h-fit mx-4 ring-1 ring-white/10"
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
                        onClose();
                    }}
                    className="absolute top-4 right-4 w-10 h-10 rounded-full bg-[#181818] flex items-center justify-center border-2 border-transparent hover:border-white transition z-50 cursor-pointer"
                >
                    <XIcon size={24} className="text-white" />
                </button>

                {/* --- Hero Section - Video Background --- */}
                <div className="relative h-[300px] sm:h-[400px] md:h-[560px] w-full bg-black group overflow-hidden">

                    {/* Layer 1: Backdrop — stays visible until trailer is actively playing */}
                    <div className="absolute inset-0 z-0 text-[0px]">
                        <img
                            src={`${IMG_PATH}${activeMovie.backdrop_path || activeMovie.poster_path}`}
                            className={`w-full h-full object-cover transition-opacity duration-700 ${isPlayingTrailer && isTrailerReady ? 'opacity-0' : 'opacity-100'}`}
                            alt="modal hero"
                        />

                        {/* Video Layer — only fades in once player is ready AND playing */}
                        <div className={`absolute inset-0 transition-opacity duration-1000 ${isPlayingTrailer && isTrailerReady ? 'opacity-100' : 'opacity-0'}`}>
                            {trailerQueue.length > 0 && (
                                <div className="w-full h-full scale-[1.35] translate-y-[-12%] pointer-events-none">
                                    <YouTube
                                        key={`${trailerQueue[0]}-modal-${replayCount}`}
                                        videoId={trailerQueue[0]}
                                        className="w-full h-full"
                                        onReady={(e) => {
                                            playerRef.current = e.target;
                                            if (isMuted) e.target.mute();
                                            else e.target.unMute();

                                            // Force highest available quality
                                            const forceHD = () => {
                                                try {
                                                    const levels = e.target.getAvailableQualityLevels?.() || [];
                                                    const best = ['hd2160','hd1440','hd1080','hd720'].find(q => levels.includes(q)) || 'hd1080';
                                                    e.target.setPlaybackQuality(best);
                                                } catch (_) {}
                                            };
                                            forceHD();
                                            e.target.addEventListener?.('onPlaybackQualityChange', forceHD);
                                            NetworkPriority.setVideoActive(true);

                                            if (initialTime > 5) {
                                                e.target.seekTo(initialTime, true);
                                            }
                                        }}
                                        onStateChange={(e) => {
                                            const YT_PLAYING = 1;
                                            const YT_PAUSED = 2;

                                            // Mark trailer ready only when ACTUALLY playing (not just buffering)
                                            if (e.data === YT_PLAYING && !isTrailerReady) {
                                                setIsTrailerReady(true);
                                            }

                                            // Sync interval: save current time to GlobalContext every second while playing
                                            if (e.data === YT_PLAYING) {
                                                if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
                                                syncIntervalRef.current = setInterval(() => {
                                                    try {
                                                        const time = playerRef.current?.getCurrentTime?.();
                                                        const videoId = trailerQueue[0];
                                                        if (time > 0 && videoId && movie) {
                                                            updateVideoState(movie.id, time, videoId);
                                                        }
                                                    } catch (_) {}
                                                }, 1000);

                                                // Early stop: 5s before end to prevent YouTube overlay
                                                const checkEnd = () => {
                                                    if (!playerRef.current) return;
                                                    try {
                                                        const remaining = playerRef.current.getDuration() - playerRef.current.getCurrentTime();
                                                        if (remaining <= 5) {
                                                            if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
                                                            playerRef.current.pauseVideo();
                                                            setIsPlayingTrailer(false);
                                                            setIsTrailerReady(false);
                                                            setHasVideoEnded(true);
                                                            return;
                                                        }
                                                    } catch (_) {}
                                                    setTimeout(checkEnd, 1000);
                                                };
                                                checkEnd();
                                            }

                                            if (e.data === YT_PAUSED) {
                                                if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
                                            }
                                        }}
                                        onEnd={() => {
                                            if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
                                            setIsPlayingTrailer(false);
                                            setIsTrailerReady(false);
                                            setHasVideoEnded(true);
                                        }}
                                        onError={(e) => {
                                            console.warn("InfoModal Video error, trying next...", e);
                                            setIsTrailerReady(false);
                                            setTrailerQueue(prev => {
                                                const newQueue = prev.slice(1);
                                                if (newQueue.length === 0) setIsPlayingTrailer(false);
                                                return newQueue;
                                            });
                                        }}
                                        opts={{
                                            width: '100%',
                                            height: '100%',
                                            playerVars: {
                                                autoplay: 1,
                                                mute: isMuted ? 1 : 0,
                                                modestbranding: 1,
                                                rel: 0,
                                                controls: 0,
                                                iv_load_policy: 3,
                                                cc_load_policy: 0,
                                                enablejsapi: 1,
                                                start: initialTime > 5 ? Math.floor(initialTime) : 5,
                                                loop: 0,
                                            }
                                        }}
                                    />
                                </div>
                            )}
                        </div>

                        {/* Gradient Overlay (Always on top of media) */}
                        <div className="absolute inset-0 bg-gradient-to-t from-[#181818] via-transparent to-transparent z-10" />

                        {/* Side gradients to mask video edge bleed */}
                        <div className="absolute inset-0 bg-gradient-to-r from-[#181818] via-transparent to-[#181818] z-10 pointer-events-none" />
                    </div>

                    {/* Layer 2: Content (Buttons, Title) - Always Visible */}
                    <div className="absolute bottom-0 left-0 w-full p-6 md:p-12 space-y-3 md:space-y-4 z-20 pointer-events-auto">
                        {/* Logo / Title + progress bar above button */}
                        <div className="w-[80%]">
                            {logoUrl && !imgFailed ? (
                                <img src={logoUrl} alt={activeMovie.title} className="h-24 md:h-32 object-contain origin-bottom-left" onError={() => setImgFailed(true)} />
                            ) : (
                                <h2 className="text-3xl sm:text-4xl md:text-5xl font-black font-leaner text-white drop-shadow-xl leading-none tracking-wide">
                                    {activeMovie.title || activeMovie.name}
                                </h2>
                            )}
                            {/* Progress bar — ABOVE button, flat corners, width of logo container */}
                            {watchPct > 1 && (
                                <div className="flex items-center gap-2.5 mt-3 w-full">
                                    <div className="flex-1 h-[3px] bg-white/25 overflow-hidden" style={{ borderRadius: 0 }}>
                                        <div
                                            className="h-full bg-[#e50914] transition-all duration-300"
                                            style={{ width: `${watchPct}%`, borderRadius: 0 }}
                                        />
                                    </div>
                                    {totalMins > 0 && (
                                        <span className="text-gray-400/80 text-[11px] whitespace-nowrap flex-shrink-0 font-medium">
                                            {watchMins} of {totalMins}m
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Action buttons row */}
                        <div className="flex items-center space-x-3">
                            {isCinemaOnly && mediaType === 'movie' ? (
                                <div className="bg-[#6d6d6e]/80 text-white px-6 sm:px-8 h-10 sm:h-12 rounded-[4px] font-bold text-base sm:text-lg flex items-center select-none cursor-not-allowed">
                                    <TicketIcon size={24} weight="bold" className="mr-2" />
                                    {t('hero.inTheaters', { defaultValue: 'In Theaters' })}
                                </div>
                            ) : (() => {
                                const type = (activeMovie.media_type || (activeMovie.title ? 'movie' : 'tv')) as 'movie' | 'tv';
                                let watchUrl = `/watch/${type}/${activeMovie.id}`;
                                if (type === 'tv' && lastEp) {
                                    watchUrl += `?season=${lastEp.season}&episode=${lastEp.episode}`;
                                }
                                return (
                                    <Link
                                        to={watchUrl}
                                        className="bg-white text-black px-6 sm:px-8 h-10 sm:h-12 rounded-[4px] font-bold text-base sm:text-lg flex items-center hover:bg-gray-200 transition active:scale-95 shadow-lg group-buttons no-underline"
                                    >
                                        <PlayIcon size={24} weight="fill" className="mr-2" />
                                        {hasResumeTV
                                            ? `Resume E${lastEp?.episode ?? 1}`
                                            : hasResumeMovie
                                            ? 'Resume'
                                            : t('hero.play')}
                                    </Link>
                                );
                            })()}
                            <button
                                onClick={() => toggleList(activeMovie)}
                                className={`border-2 rounded-full w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95
                                  ${isAdded ? 'border-white bg-white/10 text-white shadow-[0_0_8px_rgba(255,255,255,0.25)]' : 'border-gray-500 bg-[#2a2a2a]/60 text-gray-300 hover:border-white hover:text-white'}`}
                                title={isAdded ? t('modal.removeFromList') : t('modal.addToList')}
                            >
                                {isAdded ? <CheckIcon size={24} /> : <PlusIcon size={24} />}
                            </button>
                            {/* Rating Pill — Love / Like / Dislike */}
                            <InfoModalRatingPill
                                rating={getMovieRating(movie.id)}
                                onRate={(r) => rateMovie(activeMovie, r)}
                            />
                        </div>
                    </div>

                    {/* Layer 3: Mute / Replay button — visible once trailer has loaded */}
                    {(isPlayingTrailer || hasVideoEnded) && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                if (hasVideoEnded) {
                                    // Replay: restart trailer
                                    setHasVideoEnded(false);
                                    setIsTrailerReady(false);
                                    setIsPlayingTrailer(true);
                                    setReplayCount(c => c + 1);
                                    setTimeout(() => {
                                        playerRef.current?.seekTo(5, true);
                                        playerRef.current?.playVideo();
                                    }, 300);
                                } else {
                                    setIsMuted(!isMuted);
                                }
                            }}
                            className="absolute bottom-6 right-6 z-30 w-10 h-10 rounded-full border border-white/40 bg-zinc-900/40 backdrop-blur-md flex items-center justify-center transition-all duration-300 hover:bg-white/10 hover:scale-110 hover:border-white shadow-xl pointer-events-auto cursor-pointer"
                            aria-label={hasVideoEnded ? 'Replay trailer' : (isMuted ? 'Unmute' : 'Mute')}
                        >
                            {hasVideoEnded
                                ? <ArrowCounterClockwiseIcon size={20} className="text-white" />
                                : isMuted ? <SpeakerSlashIcon size={20} className="text-white" /> : <SpeakerHighIcon size={20} className="text-white" />}
                        </button>
                    )}
                </div>

                {/* --- Details Body --- */}
                <div className="px-6 md:px-12 pb-12 bg-[#181818]">
                    <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-x-8 gap-y-6">

                        {/* Left Column: Stats & Description */}
                        <div className="space-y-4">
                            {/* Metadata Row */}
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-white font-medium text-sm md:text-base mt-2 font-harmonia-condensed">
                                <span className="text-white/80 tracking-wide">{year}</span>
                                <span className="text-white/80 tracking-wide">{duration}</span>
                                <span className="border border-gray-500 px-1.5 py-0.5 text-[10px] rounded-[2px] text-gray-400 h-fit leading-none font-bold">HD</span>
                            </div>

                            {/* Age & Warning Row — using standardized MaturityBadge */}
                            <div className="flex items-center gap-3">
                                <MaturityBadge
                                    adult={activeMovie.adult}
                                    voteAverage={activeMovie.vote_average}
                                    size="md"
                                />
                                {activeMovie.adult
                                    ? <span className="text-sm text-gray-400">{t('common.maturity.adultDesc')}</span>
                                    : <span className="text-sm text-gray-400">{t('common.maturity.teenDesc')}</span>
                                }
                            </div>

                            <p className="text-white text-sm md:text-[15px] leading-relaxed pt-2">
                                {activeMovie.overview}
                            </p>
                        </div>

                        {/* Right Column: Cast & Genres */}
                        <div className="text-sm space-y-3 pt-2">
                            <div className="flex flex-wrap gap-1">
                                <span className="text-gray-500">{t('common.cast')}</span>
                                {cast.slice(0, 3).map((name, i) => (
                                    <span key={i} className="text-white hover:underline cursor-pointer">{name}{i < cast.slice(0, 3).length - 1 ? ',' : ','}</span>
                                ))}
                                {cast.length > 3 && <span className="text-gray-400 italic cursor-pointer hover:underline">{t('modal.more')}</span>}
                            </div>
                            {/* Genres — single row, no duplicate */}
                            <div className="flex flex-wrap gap-1">
                                <span className="text-gray-500">{t('common.genres')}</span>
                                <span className="text-white">{genreNames}</span>
                            </div>
                        </div>
                    </div>

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

                    <InfoModalRecommendations
                        recommendations={recommendations}
                        onRecommendationClick={handleRecommendationClick}
                    />
                </div>
            </div>
        </div>
    );
};

export default InfoModal;