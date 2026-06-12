import React, { useState, useEffect, useRef } from 'react';
import { PlayIcon, PauseIcon, PlusIcon, CheckIcon, SpeakerHighIcon, SpeakerSlashIcon } from '@phosphor-icons/react';
import { MaturityBadge } from './MovieCardBadges';
import { Movie } from '../types';
import { useGlobalContext } from '../context/GlobalContext';
import { getMovieImages } from '../services/api';
import { TrailerPlayer } from './TrailerPlayer';
import { preloadTrailer } from '../hooks/useTrailer';

interface SpotlightCardProps {
    movie: Movie;
    onSelect: (movie: Movie) => void;
    onPlay: (movie: Movie) => void;
    /** 1-based rank for Top 10 badge */
    rank?: number;
    /** Coming Soon — hide play, show release date label */
    isComingSoon?: boolean;
    /** Just Landed content too new to stream — hide play, show only My List */
    hidePlay?: boolean;
    /** Next card's movie to preload its trailer while this card is playing */
    nextMovie?: Movie | null;
}

// ---------------------------------------------------------------------------
// Dominant colour extraction
// ---------------------------------------------------------------------------
const extractAccent = (src: string): Promise<string> =>
    new Promise(resolve => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = src.includes('?') ? `${src}&cors=true` : `${src}?cors=true`;
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = 10; canvas.height = 10;
                const ctx = canvas.getContext('2d');
                if (!ctx) return resolve('rgba(20,20,20,0)');
                ctx.drawImage(img, 0, 0, 10, 10);
                const d = ctx.getImageData(0, 0, 10, 10).data;
                let r = 0, g = 0, b = 0, n = 0;
                for (let i = 0; i < d.length; i += 4) {
                    const bright = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000;
                    if (d[i + 3] > 200 && bright > 35 && bright < 220) {
                        r += d[i]; g += d[i + 1]; b += d[i + 2]; n++;
                    }
                }
                if (n > 0) resolve(`rgba(${Math.round(r / n)},${Math.round(g / n)},${Math.round(b / n)},0.55)`);
                else resolve('rgba(20,20,20,0)');
            } catch { resolve('rgba(20,20,20,0)'); }
        };
        img.onerror = () => resolve('rgba(20,20,20,0)');
    });

// ---------------------------------------------------------------------------
// Time formatter: seconds → "m:ss"
// ---------------------------------------------------------------------------
const fmtTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
};

// Progress cache for trailers (cleared on page/tab unmounts)
const trailerTimeCache: Record<string | number, number> = {};

// ---------------------------------------------------------------------------
const SpotlightCard: React.FC<SpotlightCardProps> = ({
    movie,
    onSelect,
    onPlay,
    rank,
    isComingSoon = false,
    hidePlay = false,
    nextMovie,
}) => {
    const { myList, toggleList, activeVideoId, setActiveVideoId, globalMute, setGlobalMute, settings } = useGlobalContext();
    const isAdded = myList.some(m => String(m.id) === String(movie.id));

    const cardRef = useRef<HTMLDivElement>(null);
    // External YT player handle for seek/play/pause
    const playerInstanceRef = useRef<any>(null);
    // Auto-hide timer for controls overlay
    const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const [isInView, setIsInView]         = useState(false);
    const [showVideo, setShowVideo]       = useState(false);
    const [videoReady, setVideoReady]     = useState(false);
    const [isPlayingTrailer, setIsPlayingTrailer] = useState(false);
    const [isActuallyPlaying, setIsActuallyPlaying] = useState(false);
    const [hasVideoEnded, setHasVideoEnded] = useState(false);
    const [replayCount, setReplayCount]   = useState(0);
    const [trailerPct, setTrailerPct]     = useState(0);
    const [currentTimeSec, setCurrentTimeSec] = useState(0);
    const [durationSec, setDurationSec]       = useState(0);
    const [trailerStartTime, setTrailerStartTime] = useState(0);

    // Controls overlay
    const [showControls, setShowControls]   = useState(false);
    const [isVideoPaused, setIsVideoPaused] = useState(false);

    // Scroll darkness (0 = clear, up to 0.72 = dim)
    const [scrollDarkness, setScrollDarkness] = useState(0);

    const [backdropSrc, setBackdropSrc] = useState('');
    const [logoUrl, setLogoUrl]         = useState<string | null>(null);
    const [logoFailed, setLogoFailed]   = useState(false);
    const [accentColor, setAccentColor] = useState('rgba(20,20,20,0)');

    // Must match TrailerPlayer's variant key: `${variant}-${movie.id}`
    const myVideoId = `card-${movie.id}`;
    const isMyVideoActive = activeVideoId === myVideoId;

    // Cleanup trailer progress for this movie when the card unmounts (e.g. navigating to a new tab/page)
    useEffect(() => {
        return () => {
            delete trailerTimeCache[movie.id];
        };
    }, [movie.id]);

    // ── Reset when movie changes or video is no longer active ────────────────
    useEffect(() => {
        if (!isMyVideoActive) {
            setShowControls(false);
            setIsVideoPaused(false);
            setIsActuallyPlaying(false);
            setHasVideoEnded(false);
        }
    }, [isMyVideoActive]);

    // ── Controls overlay helpers ──────────────────────────────────────────────
    const openControls = () => {
        setShowControls(true);
        if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
        controlsTimerRef.current = setTimeout(() => setShowControls(false), 3000);
    };

    // ── Tap handler: tap-to-play (first tap starts trailer), then tap controls ─
    const handleMediaTap = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (isActuallyPlaying) {
        if (hasVideoEnded) {
            setTrailerStartTime(0);
            setHasVideoEnded(false);
            setIsPlayingTrailer(true);
            setIsActuallyPlaying(true);
            setReplayCount(c => c + 1);
        } else {
            // Tapping the container while playing OR paused will now 
            // strictly toggle the control interface overlays
            if (showControls) {
                setShowControls(false);
                if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
            } else {
                openControls();
            }
        }
    } else {
        // First tap → start trailer
        setTrailerStartTime(trailerTimeCache[movie.id] || 0);
        setIsPlayingTrailer(true);
        setIsActuallyPlaying(true);
        setHasVideoEnded(false);
        setShowVideo(true);
        setActiveVideoId(myVideoId);
    }
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

    // ── Asset loading ─────────────────────────────────────────────────────────
    useEffect(() => {
        let mounted = true;
        const bp = movie.backdrop_path;
        const pp = movie.poster_path;
        const src = bp
            ? bp.startsWith('http') ? bp : `https://image.tmdb.org/t/p/w780${bp}`
            : pp
                ? pp.startsWith('http') ? pp : `https://image.tmdb.org/t/p/w500${pp}`
                : '';
        if (src) {
            setBackdropSrc(src);
            extractAccent(src).then(c => { if (mounted) setAccentColor(c); });
        }
        const type = (movie.media_type || (movie.title ? 'movie' : 'tv')) as 'movie' | 'tv';
        getMovieImages(String(movie.id), type)
            .then((data: any) => {
                if (!mounted || !data?.logos?.length) return;
                const logo = data.logos.find((l: any) => l.iso_639_1 === 'en' || l.iso_639_1 === null);
                if (logo) setLogoUrl(`https://image.tmdb.org/t/p/w300${logo.file_path}`);
            })
            .catch(() => {});
        return () => { mounted = false; };
    }, [movie.id]);

    // ── IntersectionObserver: playback trigger + scroll darkness ──────────────
    useEffect(() => {
        const el = cardRef.current;
        if (!el) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                const ratio = entry.intersectionRatio;
                const top   = entry.boundingClientRect.top;
                setIsInView(ratio >= 0.6);
                // Darken cards that have scrolled off the top
                if (top < 0 && ratio < 1) {
                    setScrollDarkness(Math.min(0.72, (1 - ratio) * 1.15));
                } else {
                    setScrollDarkness(0);
                }
            },
            { threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1] }
        );
        const preloadObserver = new IntersectionObserver(
            ([entry]) => { if (entry.isIntersecting && nextMovie) preloadTrailer(nextMovie); },
            { rootMargin: '100% 0px 100% 0px', threshold: 0 }
        );
        observer.observe(el);
        preloadObserver.observe(el);
        return () => { observer.disconnect(); preloadObserver.disconnect(); };
    }, [nextMovie]);

    // ── Stop video when scrolled out of view / Autoplay when in view ─────────
    useEffect(() => {
        if (!isInView) {
            setShowVideo(false);
            setVideoReady(false);
            setIsPlayingTrailer(false);
            setIsActuallyPlaying(false);
            setHasVideoEnded(false);
            setTrailerPct(0);
            setCurrentTimeSec(0);
            setDurationSec(0);
            setShowControls(false);
            setActiveVideoId(prev => (prev === myVideoId ? null : prev) as string | null);
        } else {
            // When scrolled back in, preload next card's trailer
            if (nextMovie) preloadTrailer(nextMovie);

            // Autoplay trailer logic when scrolled in view
            if (settings?.autoplayPreviews !== false && !isComingSoon && !hidePlay) {
                const timer = setTimeout(() => {
                    setTrailerStartTime(trailerTimeCache[movie.id] || 0);
                    setIsPlayingTrailer(true);
                    setIsActuallyPlaying(true);
                    setHasVideoEnded(false);
                    setShowVideo(true);
                    setActiveVideoId(myVideoId);
                }, 800); // 800ms debounce
                return () => clearTimeout(timer);
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isInView, myVideoId, isComingSoon, hidePlay, settings?.autoplayPreviews, nextMovie, setActiveVideoId]);

    // ── Helpers ───────────────────────────────────────────────────────────────
    const releaseDate = movie.release_date || movie.first_air_date || '';
    const dateObj     = releaseDate ? new Date(releaseDate + 'T00:00:00') : null;
    const releaseLabel = dateObj
        ? dateObj.toLocaleDateString('en-US', { day: 'numeric', month: 'long' })
        : '';
    const isTv           = movie.media_type === 'tv' || !!movie.first_air_date;
    const comingSoonText = isTv ? `Season Coming on ${releaseLabel}` : `Coming on ${releaseLabel}`;

    // Accent colours for the rank sandwich rectangle
    const solidAccent  = accentColor.replace('0.55', '0.88');
    const rectGradient = `linear-gradient(to right, ${solidAccent} 0%, rgba(14,14,14,0.97) 100%)`;
    const brdGradient  = `linear-gradient(to right, rgba(255,255,255,0.70) 0%, rgba(255,255,255,0.04) 100%)`;

    // ── Card element (shared for both ranked and non-ranked variants) ─────────
    const cardEl = (
        <div
            ref={cardRef}
            className={`relative ${rank != null ? 'z-20' : 'z-10'} w-full sm:max-w-[85vw] sm:mx-auto min-h-[480px] flex flex-col bg-[#141414] border border-white/[0.09] rounded-xl overflow-hidden`}
        >
            {/* Scroll-darkness overlay — pointer-events-none so it doesn't block taps */}
            {scrollDarkness > 0 && (
                <div
                    className="absolute inset-0 z-50 pointer-events-none rounded-xl"
                    style={{ background: `rgba(0,0,0,${scrollDarkness})`, transition: 'background 0.15s ease' }}
                />
            )}

            {/* ── MEDIA AREA ─────────────────────────────────────────────── */}
            <div
                className="relative w-full aspect-video overflow-hidden bg-black shrink-0 cursor-pointer"
                onClick={handleMediaTap}
            >
                {/* Backdrop — hidden once trailer is actively playing */}
                {backdropSrc && (
                    <img
                        src={backdropSrc}
                        alt={movie.title || movie.name || ''}
                        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${isActuallyPlaying ? 'opacity-0' : 'opacity-100'}`}
                        loading="lazy"
                    />
                )}

                {/* Play hint overlay when not yet started */}
                {!isActuallyPlaying && backdropSrc && (
                    <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                        <div className="w-[54px] h-[54px] rounded-full bg-black/50 border border-white/25 flex items-center justify-center shadow-2xl">
                            <PlayIcon size={26} weight="fill" className="text-white ml-1" />
                        </div>
                    </div>
                )}

                {/* Trailer */}
                {showVideo && (
                    <div className={`absolute inset-0 transition-opacity duration-300 ${isActuallyPlaying ? 'opacity-100' : 'opacity-0'}`}>
                        <TrailerPlayer
                            key={`spotlight-${movie.id}-${replayCount}`}
                            movie={movie}
                            variant="card"
                            initialSeekTime={trailerStartTime}
                            onReady={() => { setVideoReady(true); setIsPlayingTrailer(true); }}
                            onPlay={() => {
                                setIsActuallyPlaying(true);
                                setIsVideoPaused(false);
                            }}
                            onEnded={() => {
                                setIsPlayingTrailer(false);
                                setIsActuallyPlaying(false);
                                setHasVideoEnded(true);
                                trailerTimeCache[movie.id] = 0; // Reset progress
                            }}
                            onErrored={() => {
                                setIsPlayingTrailer(false);
                                setIsActuallyPlaying(false);
                                setShowVideo(false);
                                trailerTimeCache[movie.id] = 0; // Reset progress
                            }}
                            onPlayerReady={p => { playerInstanceRef.current = p; }}
                            onTimeUpdate={(currentTime, duration) => {
                                setCurrentTimeSec(currentTime);
                                setDurationSec(duration);
                                trailerTimeCache[movie.id] = currentTime; // Save progress
                                const usable = Math.max(duration - 8, 1);
                                setTrailerPct(Math.min(100, (currentTime / usable) * 100));
                            }}
                        />
                    </div>
                )}

                {/* Paused / ended overlay */}
                {isActuallyPlaying && (isVideoPaused || hasVideoEnded) && (
                    <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
                        <button
                            onClick={(e) => {
                                e.stopPropagation(); // Stop handleMediaTap from hijacking this click
                                if (hasVideoEnded) {
                                    setTrailerStartTime(0);
                                    setHasVideoEnded(false);
                                    setIsPlayingTrailer(true);
                                    setIsActuallyPlaying(true);
                                    setReplayCount(c => c + 1);
                                } else {
                                    handlePlayPause(e);
                                }
                            }}
                            className="w-[60px] h-[60px] rounded-full bg-black/50 border border-white/20 flex items-center justify-center shadow-2xl pointer-events-auto active:scale-95 transition-transform cursor-pointer"
                        >
                            <PlayIcon size={30} weight="fill" className="text-white ml-1" />
                        </button>
                    </div>
                )}

                {/* ── CONTROLS OVERLAY (tap to reveal while playing) ───── */}
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

                {/* ── INTERACTIVE PROGRESS BAR (moves up when controls open) ── */}
                {isActuallyPlaying && (
                    <div
                        className="absolute left-0 right-0 z-30 transition-all duration-300 ease-out"
                        style={{
                            bottom:  showControls ? '44px' : '0px',
                            padding: showControls ? '0 16px' : '0',
                            height:  showControls ? '20px'  : '2px',
                        }}
                    >
                        {showControls ? (
                            <div
                                className="relative w-full h-full flex items-center cursor-pointer touch-none select-none pointer-events-auto"
                                onClick={handleScrub}
                                onPointerMove={e => { if (e.buttons !== 1) return; handleScrub(e); }}
                            >
                                <div className="relative w-full h-[3px] bg-white/25 rounded-full">
                                    <div
                                        className="absolute left-0 top-0 bottom-0 bg-[#E50914] rounded-full"
                                        style={{ width: `${trailerPct}%` }}
                                    />
                                    <div
                                        className="absolute top-1/2 -translate-y-1/2 w-[14px] h-[14px] bg-[#E50914] rounded-full shadow-lg pointer-events-none"
                                        style={{ left: `calc(${trailerPct}% - 7px)` }}
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="w-full h-full bg-white/10 relative overflow-hidden">
                                <div
                                    className="absolute top-0 left-0 bottom-0 bg-[#E50914] transition-[width] duration-500 ease-linear"
                                    style={{ width: `${trailerPct}%` }}
                                />
                            </div>
                        )}
                    </div>
                )}

                {/* Time display */}
                {isActuallyPlaying && showControls && (
                    <div className="absolute z-30 pointer-events-none" style={{ bottom: '68px', right: '20px' }}>
                        <span className="text-white text-[13px] font-semibold tracking-wide drop-shadow-md tabular-nums">
                            {fmtTime(currentTimeSec)}
                        </span>
                    </div>
                )}

                {/* Mute / Replay button */}
                {isActuallyPlaying && (
                    <button
                        onClick={e => {
                            e.stopPropagation();
                             if (hasVideoEnded) {
                                setTrailerStartTime(0);
                                setHasVideoEnded(false);
                                setIsPlayingTrailer(true);
                                setIsActuallyPlaying(true);
                                setReplayCount(c => c + 1);
                            } else {
                                setGlobalMute(!globalMute);
                            }
                        }}
                        className="absolute bottom-3 right-3 w-6 h-6 rounded-full bg-black/50 border border-white/25 text-white flex items-center justify-center backdrop-blur-md hover:bg-black/70 transition-colors"
                        style={{ zIndex: 25 }}
                    >
                        {hasVideoEnded
                            ? <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg>
                            : globalMute
                                ? <SpeakerSlashIcon size={14} weight="bold" className="text-white" />
                                : <SpeakerHighIcon  size={14} weight="bold" className="text-white" />
                        }
                    </button>
                )}

                {/* Maturity disc */}
                <div className="absolute top-3 right-3 z-30 pointer-events-none drop-shadow-md">
                    <MaturityBadge adult={movie.adult} voteAverage={movie.vote_average} size="xs" />
                </div>
            </div>

            {/* Accent glow line at media/content boundary */}
            <div
                className="w-full h-[1px] opacity-60 pointer-events-none"
                style={{
                    background: `linear-gradient(to right, ${accentColor} 0%, ${accentColor} 40%, transparent 100%)`,
                    transition: 'background 0.8s ease',
                }}
            />

            {/* ── BELOW-MEDIA CONTENT ─────────────────────────────────── */}
            <div 
                className="px-4 pb-6 pt-4 flex flex-col flex-grow gap-3 cursor-pointer select-none"
                onClick={() => onSelect(movie)}
            >

                {/* Logo or title */}
                <div className="flex items-center gap-2">
                    {logoUrl && !logoFailed ? (
                        <img
                            src={logoUrl}
                            alt={movie.title || movie.name || ''}
                            className="max-h-[40px] w-auto object-contain object-left"
                            onError={() => setLogoFailed(true)}
                        />
                    ) : (
                        <h3 className="text-white font-bold text-[17px] leading-snug">
                            {movie.title || movie.name}
                        </h3>
                    )}
                </div>

                {/* Coming Soon label */}
                {isComingSoon && releaseLabel && (
                    <p className="text-white font-bold text-[15px] tracking-wide uppercase mt-1">
                        {comingSoonText}
                    </p>
                )}

                {/* Overview */}
                {movie.overview && (
                    <div className="flex-1 overflow-hidden flex flex-col justify-start">
                        <p className="text-[16px] text-[#e5e5e5] font-netflix font-normal leading-[1.6] line-clamp-[7]">
                            {movie.overview}
                        </p>
                    </div>
                )}

                {/* ── BUTTONS ─────────────────────────────────────────── */}
                <div className="mt-auto pt-2">
                    {isComingSoon ? (
                        <div className="flex items-center gap-2">
                            <button
                                onClick={e => { e.stopPropagation(); toggleList(movie); }}
                                className="flex items-center justify-center h-[56px] px-8 rounded-[4px] bg-[#6d6d6e]/40 hover:bg-[#6d6d6e]/25 text-white font-bold text-[18px] gap-2.5 transition-all active:scale-95 font-sans"
                            >
                                {isAdded ? <CheckIcon size={24} weight="bold" className="text-white" /> : <PlusIcon size={24} weight="bold" className="text-white" />}
                                <span>My List</span>
                            </button>
                        </div>
                    ) : hidePlay ? (
                        <button
                            onClick={e => { e.stopPropagation(); toggleList(movie); }}
                            className="flex items-center justify-center h-[56px] rounded-[4px] bg-[#6d6d6e]/40 hover:bg-[#6d6d6e]/25 text-white font-bold text-[18px] gap-2.5 transition-all active:scale-95 font-sans w-full mt-2"
                        >
                            {isAdded ? <CheckIcon size={24} weight="bold" className="text-white" /> : <PlusIcon size={24} weight="bold" className="text-white" />}
                            <span>My List</span>
                        </button>
                    ) : (
                        <div className="flex items-center gap-3 mt-2">
                            <button
                                onClick={e => { e.stopPropagation(); onPlay(movie); }}
                                className="flex-1 flex items-center justify-center h-[56px] rounded-[4px] bg-white hover:bg-neutral-200 text-black font-bold text-[18px] gap-2.5 transition-all active:scale-95 font-sans"
                            >
                                <PlayIcon size={24} weight="fill" className="text-black" />
                                <span>Play</span>
                            </button>
                            <button
                                onClick={e => { e.stopPropagation(); toggleList(movie); }}
                                className="flex-1 flex items-center justify-center h-[56px] rounded-[4px] bg-[#6d6d6e]/40 hover:bg-[#6d6d6e]/25 text-white font-bold text-[18px] gap-2.5 transition-all active:scale-95 font-sans"
                            >
                                {isAdded ? <CheckIcon size={24} weight="bold" className="text-white" /> : <PlusIcon size={24} weight="bold" className="text-white" />}
                                <span>My List</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    // Non-ranked cards: just return the card
    if (rank == null) return cardEl;

    const formattedRank = rank < 10 ? `0${rank}` : String(rank);

    return (
        <div className="relative overflow-visible pt-14 pb-2 group/spotlight z-10">
            {/* ── BACKGROUND WALLET CARD (z-0) ─────────────────── */}
            <div
                className="absolute left-0 right-0 z-0 pointer-events-none"
                style={{
                    top: '36px',
                    height: '36px',
                }}
            >
                {/* Gradient-border outer shell */}
                <div
                    style={{
                        background:   brdGradient,
                        borderRadius: '12px 12px 0 0',
                        padding:      '1.2px 1.2px 0 1.2px',
                        width:        '100%',
                        height:       '100%',
                    }}
                >
                    {/* Accent-color inner fill */}
                    <div
                        style={{
                            background:   rectGradient,
                            borderRadius: '11px 11px 0 0',
                            width:        '100%',
                            height:       '100%',
                        }}
                    />
                </div>
            </div>

            {/* ── SVG NUMBER (z-10) ─────────────────── */}
            <div
                className="absolute left-[16px] pointer-events-none overflow-visible z-10"
                style={{
                    top: '-22px',
                    height: '108px',
                }}
            >
                <svg
                    viewBox="0 0 280 210"
                    className="h-full w-auto"
                    preserveAspectRatio="none"
                    style={{ overflow: 'visible' }}
                >
                    <g
                        transform="scale(1.0, 1.08)"
                        style={{ transformOrigin: "130px 205px" }}
                    >
                        {/* Outer Outline Stroke — very white, thinner */}
                        <text
                            x="8"
                            y="195"
                            textAnchor="start"
                            dominantBaseline="auto"
                            fill="none"
                            stroke="rgba(255,255,255,0.95)"
                            strokeWidth="8"
                            strokeLinejoin="round"
                            fontSize="165"
                            fontWeight="900"
                            fontFamily="'Inter', sans-serif"
                            letterSpacing="-10"
                        >
                            {formattedRank}
                        </text>
                        {/* Main Body — solid black fill */}
                        <text
                            x="8"
                            y="195"
                            textAnchor="start"
                            dominantBaseline="auto"
                            fill="#0a0a0a"
                            stroke="#0a0a0a"
                            strokeWidth="4"
                            strokeLinejoin="round"
                            fontSize="165"
                            fontWeight="900"
                            fontFamily="'Inter', sans-serif"
                            letterSpacing="-10"
                        >
                            {formattedRank}
                        </text>
                    </g>
                </svg>
            </div>

            {/* Card sits on top */}
            {cardEl}
        </div>
    );
};

export default SpotlightCard;
