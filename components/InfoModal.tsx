import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { XIcon, PlayIcon, CheckIcon, PlusIcon, SpeakerSlashIcon, SpeakerHighIcon, ThumbsUpIcon, TicketIcon } from '@phosphor-icons/react';
import YouTube from 'react-youtube';
import { Movie, Episode } from '../types';
import { IMG_PATH } from '../constants';
import { useGlobalContext } from '../context/GlobalContext';
import { fetchTrailers, getSeasonDetails, prefetchStream } from '../services/api';
import InfoModalEpisodes from './InfoModalEpisodes';
import InfoModalRecommendations from './InfoModalRecommendations';
import { useMovieData } from '../hooks/useMovieData';
import { useIsInTheaters } from '../hooks/useIsInTheaters';

interface InfoModalProps {
    movie: Movie | null;
    initialTime?: number; // Resume from Hero
    onClose: (finalTime?: number) => void; // Pass back time
    onPlay: (movie: Movie, season?: number, episode?: number) => void;
    trailerId?: string; // Force specific video
}

const InfoModal: React.FC<InfoModalProps> = ({ movie, initialTime = 0, onClose, onPlay, trailerId }) => {
    const { myList, toggleList, updateVideoState, heroVideoState } = useGlobalContext();
    const { t } = useTranslation();
    const { detailedMovie, cast, recommendations, logoUrl, isLoading } = useMovieData(movie);
    const [imgFailed, setImgFailed] = useState(false);
    const isCinemaOnly = useIsInTheaters(movie);

    const [trailerQueue, setTrailerQueue] = useState<string[]>([]);
    const [isPlayingTrailer, setIsPlayingTrailer] = useState(false);
    const [isMuted, setIsMuted] = useState(false);

    // Episode / Season State
    const [episodes, setEpisodes] = useState<Episode[]>([]);
    const [selectedSeason, setSelectedSeason] = useState(1);
    const [loadingEpisodes, setLoadingEpisodes] = useState(false);

    const playerRef = useRef<any>(null);
    const modalRef = useRef<HTMLDivElement>(null);
    const { getVideoState, setActiveVideoId } = useGlobalContext();

    const [resumeContext, setResumeContext] = useState<{ season: number; episode: number } | null>(null);
// Add this near the top of InfoModal.tsx
    useEffect(() => {
        if (movie) {
            // Claim the stage when the modal opens
            setActiveVideoId(`modal-${movie.id}`);
        }
        
        // Clear the stage when the modal closes, letting the Hero resume!
        return () => {
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

    useEffect(() => {
        if (movie) {
            // Reset state for new movie
            setImgFailed(false);
            setTrailerQueue([]);
            setIsPlayingTrailer(false);
            setEpisodes([]);
            setSelectedSeason(1);
            setResumeContext(null);

            const type = (movie.media_type || (movie.title ? 'movie' : 'tv')) as 'movie' | 'tv';

            // 2. Load Video (Prioritize Local Sync, then Hero Sync, then Prop, then Fetch)
            const savedState = movie ? getVideoState(movie.id) : null;

            if (savedState?.videoId) {
                setTrailerQueue([savedState.videoId]);
                setIsPlayingTrailer(true);
            } else if (heroVideoState.movieId && String(heroVideoState.movieId) === String(movie.id)) {
                if (heroVideoState.videoId) setTrailerQueue([heroVideoState.videoId]);
                setIsPlayingTrailer(true);
            } else if (trailerId) {
                setTrailerQueue([trailerId]);
                setIsPlayingTrailer(true);
            } else {
                fetchTrailers(movie.id, type).then(keys => {
                    if (keys && keys.length > 0) {
                        setTrailerQueue(keys);
                        setIsPlayingTrailer(true);
                    }
                });
            }
        }
    }, [movie, trailerId, getVideoState]);

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
        if (!year) return;

        if (mediaType === 'movie') {
            prefetchStream(movie.title || movie.name || '', year, String(movie.id), 'movie');
        } else {
            const s = resumeContext?.season || 1;
            const e = resumeContext?.episode || 1;
            prefetchStream(movie.name || movie.title || '', year, String(movie.id), 'tv', s, e);
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

    const handlePlayClick = () => {
        if (mediaType === 'tv') {
            if (resumeContext) {
                onPlay(activeMovie, resumeContext.season, resumeContext.episode);
            } else {
                onPlay(activeMovie, 1, 1);
            }
        } else {
            onPlay(activeMovie);
        }
    };

    const totalSeasons = activeMovie.number_of_seasons || 1;

    return (
        <div
            className="fixed inset-0 z-[200] bg-black/70 flex justify-center overflow-y-auto backdrop-blur-md scrollbar-hide animate-fadeIn cursor-default"
            onClick={handleClose}
        >
            <div
                ref={modalRef}
                className={`relative w-full max-w-[850px] bg-[#181818] rounded-md shadow-2xl mt-12 md:mt-16 mb-8 overflow-hidden h-fit mx-4 ring-1 ring-white/10
                    transition-all duration-500 cubic-bezier-spring animate-modal-spring`}
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    onClick={handleClose}
                    className="absolute top-4 right-4 z-[60] bg-[#181818]/60 backdrop-blur-md p-1.5 rounded-full hover:bg-[#2a2a2a] transition flex items-center justify-center border border-white/10 hover:border-white/40 shadow-xl"
                >
                    <XIcon size={24} className="text-white" />
                </button>

                {/* --- Hero Section - Video Background --- */}
                <div className="relative h-[250px] sm:h-[350px] md:h-[480px] w-full bg-black group overflow-hidden">

                    {/* Layer 1: Media (Image or Video) */}
                    <div className="absolute inset-0 z-0 text-[0px]"> {/* text-[0] removes whitespace gaps */}
                        <img
                            src={`${IMG_PATH}${activeMovie.backdrop_path || activeMovie.poster_path}`}
                            className={`w-full h-full object-cover transition-opacity duration-700 ${isPlayingTrailer ? 'opacity-0' : 'opacity-100'}`}
                            alt="modal hero"
                        />

                        {/* Video Layer */}
                        <div className={`absolute inset-0 transition-opacity duration-1000 ${isPlayingTrailer ? 'opacity-100' : 'opacity-0'}`}>
                            {trailerQueue.length > 0 && (
                                <div className="w-full h-full scale-[1.35] translate-y-[-15%] pointer-events-none">
                                    <YouTube
                                        videoId={trailerQueue[0]}
                                        className="w-full h-full"
                                        onReady={(e) => {
                                            playerRef.current = e.target;
                                            if (isMuted) e.target.mute();
                                            else e.target.unMute();

                                            // Cinematic: Force Highest Quality
                                            if (typeof e.target.setPlaybackQuality === 'function') {
                                                e.target.setPlaybackQuality('hd1080');
                                            }

                                            // Resume logic
                                            if (initialTime > 0) {
                                                e.target.seekTo(initialTime, true);
                                            }
                                        }}
                                        onEnd={(e) => {
                                            // Kill player 0.1s before suggestions
                                            setIsPlayingTrailer(false);
                                            setTimeout(() => {
                                              if (trailerQueue.length > 0) setIsPlayingTrailer(true);
                                            }, 100);
                                        }}
                                        onError={(e) => {
                                            console.warn("InfoModal Video error, trying next...", e);
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
                                                modestbranding: 1,
                                                rel: 0,
                                                controls: 0,
                                                start: Math.floor(initialTime), // Seamless resume
                                                loop: 1,
                                                playlist: trailerQueue[0], // Required for looping
                                            }
                                        }}
                                    />
                                </div>
                            )}
                        </div>

                        {/* Gradient Overlay (Always on top of media) */}
                        <div className="absolute inset-0 bg-gradient-to-t from-[#181818] via-transparent to-transparent z-10" />
                    </div>

                    {/* Layer 2: Content (Buttons, Title) - Always Visible */}
                    <div className="absolute bottom-0 left-0 w-full p-6 md:p-12 space-y-4 md:space-y-6 z-20 pointer-events-auto">
                        <div className="w-[80%] mb-2">
                            {logoUrl && !imgFailed ? (
                                <img src={logoUrl} alt={activeMovie.title} className="h-24 md:h-32 object-contain origin-bottom-left" onError={() => setImgFailed(true)} />
                            ) : (
                                <h2 className="text-3xl sm:text-4xl md:text-5xl font-black font-leaner text-white drop-shadow-xl leading-none tracking-wide">
                                    {activeMovie.title || activeMovie.name}
                                </h2>
                            )}
                        </div>

                        <div className="flex items-center space-x-3">
                            {isCinemaOnly && mediaType === 'movie' ? (
                                <div className="bg-[#6d6d6e]/80 text-white px-6 sm:px-8 h-10 sm:h-12 rounded-[4px] font-bold text-base sm:text-lg flex items-center select-none cursor-not-allowed">
                                    <TicketIcon size={24} weight="bold" className="mr-2" />
                                    {t('hero.inTheaters', { defaultValue: 'In Theaters' })}
                                </div>
                            ) : (
                                <button
                                    onClick={handlePlayClick}
                                    className="bg-white text-black px-6 sm:px-8 h-10 sm:h-12 rounded-[4px] font-bold text-base sm:text-lg flex items-center hover:bg-gray-200 transition"
                                >
                                    <PlayIcon size={24} weight="fill" className="mr-2" />
                                    {resumeContext && mediaType === 'tv' ? t('modal.resume', { season: resumeContext.season, episode: resumeContext.episode }) : t('hero.play')}
                                </button>
                            )}
                            <button
                                onClick={() => toggleList(activeMovie)}
                                className="border-2 border-gray-500 bg-[#2a2a2a]/60 text-gray-300 rounded-full w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center hover:border-white hover:text-white transition"
                                title={isAdded ? t('modal.removeFromList') : t('modal.addToList')}
                            >
                                {isAdded ? <CheckIcon size={24} /> : <PlusIcon size={24} />}
                            </button>
                            <button
                                className="border-2 border-gray-500 bg-[#2a2a2a]/60 text-gray-300 rounded-full w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center hover:border-white hover:text-white transition"
                                title={t('modal.rate')}
                            >
                                <ThumbsUpIcon size={22} weight="bold" />
                            </button>
                        </div>
                    </div>

                    {/* Layer 3: Controls (Mute) */}
                    {isPlayingTrailer && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsMuted(!isMuted);
                            }}
                            className="absolute bottom-6 right-6 z-30 w-10 h-10 rounded-full border border-white/40 bg-zinc-900/40 backdrop-blur-md flex items-center justify-center transition-all duration-300 hover:bg-white/10 hover:scale-110 hover:border-white shadow-xl pointer-events-auto cursor-pointer"
                        >
                            {isMuted ? <SpeakerSlashIcon size={20} className="text-white" /> : <SpeakerHighIcon size={20} className="text-white" />}
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

                            {/* Age & Warning Row */}
                            <div className="flex items-center gap-3">
                                <span className="border border-white/40 bg-transparent text-white px-2 py-0.5 text-sm font-medium uppercase">
                                    {activeMovie.adult ? '18+' : '13+'}
                                </span>
                                {activeMovie.adult && <span className="text-sm text-gray-400">{t('common.maturity.adultDesc')}</span>}
                                {!activeMovie.adult && <span className="text-sm text-gray-400">{t('common.maturity.teenDesc')}</span>}
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
                            <div className="flex flex-wrap gap-1">
                                <span className="text-gray-500">{t('common.genres')}</span>
                                <span className="text-white">{genreNames}</span>
                            </div>
                            {activeMovie.genres && activeMovie.genres.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                    <span className="text-gray-500">{t('modal.thisFilmIs')}</span>
                                    <span className="text-white">{activeMovie.genres.slice(0, 3).map(g => g.name).join(', ')}</span>
                                </div>
                            )}
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