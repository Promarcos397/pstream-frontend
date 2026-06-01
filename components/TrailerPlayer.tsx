import React, { useRef, useEffect } from 'react';
import YouTube from 'react-youtube';
import { useTrailer } from '../hooks/useTrailer';
import { useGlobalContext } from '../context/GlobalContext';
import { Movie } from '../types';

const YouTubePlayer = YouTube as any;

interface TrailerPlayerProps {
    movie: Movie | null;
    variant?: 'card' | 'hero' | 'modal';
    cropFactor?: number;
    onEnded?: () => void;
    onErrored?: () => void;
    onReady?: () => void;
    onPlay?: () => void;
    /** Fires ~every 500ms while playing: real currentTime and duration from the YT player */
    onTimeUpdate?: (currentTime: number, duration: number) => void;
    /** Fires once when YT player is ready — use the returned handle for seekTo / pauseVideo / playVideo */
    onPlayerReady?: (player: any) => void;
    /** Start the trailer at this specific time in seconds (overrides the default intro-skip) */
    initialSeekTime?: number;
}

export const TrailerPlayer: React.FC<TrailerPlayerProps> = ({
    movie,
    variant = 'modal',
    cropFactor,
    onEnded,
    onErrored,
    onReady,
    onPlay,
    onTimeUpdate,
    onPlayerReady,
    initialSeekTime,
}) => {
    const { globalMute } = useGlobalContext();
    const { videoId, isTeaser } = useTrailer(movie);

    const containerRef = useRef<HTMLDivElement>(null);
    const playerRef = useRef<any>(null);
    const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Card/modal: fixed zoom for fixed aspect-ratio containers
    const DEFAULT_CROP: Record<string, number> = { card: 1.35, hero: 1.15, modal: 1.35 };
    const zoomFactor = cropFactor ?? DEFAULT_CROP[variant] ?? 1.35;

    // Artificial inflation (1200% size) shrinks YouTube chrome to ~1-2px at visual scale.
    // Stays well under GPU texture limits while forcing YouTube to serve max quality.
    const artificialScale = 12.0;

    // Unified scaling logic for all variants
    const getSizingStyle = (): React.CSSProperties => {
        return {
            width: `${artificialScale * 115}%`,
            height: `${artificialScale * 115}%`,
            transform: `translate(-50%, -50%) scale(${zoomFactor / artificialScale})`,
            transformOrigin: 'center center',
            willChange: 'transform',
        };
    };

    const [isLoaded, setIsLoaded] = React.useState(false);

    useEffect(() => {
        return () => {
            if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
            if (playerRef.current) {
                try {
                    playerRef.current.pauseVideo();
                    playerRef.current.stopVideo();
                    playerRef.current = null;
                } catch (e) {}
            }
        };
    }, []);

    useEffect(() => {
        if (!playerRef.current || typeof playerRef.current.mute !== 'function') return;
        try {
            if (globalMute) playerRef.current.mute();
            else playerRef.current.unMute();
        } catch {}
    }, [globalMute]);

    const { activeVideoId } = useGlobalContext();
    
    // Global Player Syncing — Reactive Pause/Play (no artificial delay)
    useEffect(() => {
        if (!playerRef.current || !movie) return;
        const myVideoId = `${variant}-${movie.id}`;
        const isMyVideo = activeVideoId === myVideoId;
        const isDirect = videoId?.startsWith('http');
        
        if (isMyVideo) {
            try { 
                if (playerRef.current && isLoaded) {
                    if (isDirect) {
                        playerRef.current.muted = globalMute;
                        playerRef.current.play().catch(() => {});
                    } else {
                        // YouTube: Ensure player is ready for commands
                        if (typeof playerRef.current.getPlayerState === 'function') {
                            playerRef.current.playVideo(); 
                        }
                    }
                }
            } catch {}
        } else {
            try { 
                if (isDirect && playerRef.current) {
                    playerRef.current.pause();
                } else if (playerRef.current && isLoaded && typeof playerRef.current.pauseVideo === 'function') {
                    playerRef.current.pauseVideo(); 
                }
                if (syncIntervalRef.current) {
                    clearInterval(syncIntervalRef.current);
                    syncIntervalRef.current = null;
                }
            } catch {}
        }
    }, [activeVideoId, movie, variant, videoId, globalMute, isLoaded]);

    const startTime = React.useMemo(() => {
        // If a specific seek time is provided (e.g. from hero timestamp), use it directly
        if (initialSeekTime && initialSeekTime > 0) return Math.floor(initialSeekTime);
        return isTeaser ? 4 : 8; // Faster intro skips for casual browsing
    }, [isTeaser, initialSeekTime]);

    const playerOpts = React.useMemo(() => ({
        width: '100%',
        height: '100%',
        playerVars: {
            autoplay: 1,
            mute: 1,
            controls: 0,
            modestbranding: 1,
            rel: 0,
            showinfo: 0,
            suggestedQuality: 'small',
            iv_load_policy: 3,
            cc_load_policy: 0,
            enablejsapi: 1,
            playsinline: 1,
            disablekb: 1,
            start: startTime,
            origin: window.location.origin,
            widget_referrer: window.location.origin,
        }
    }), [startTime]);

    const handlersRef = useRef({ onReady, onPlay, onEnded, onErrored, onTimeUpdate, onPlayerReady, globalMute, movie, videoId, activeVideoId, variant, isTeaser, initialSeekTime });
    handlersRef.current = { onReady, onPlay, onEnded, onErrored, onTimeUpdate, onPlayerReady, globalMute, movie, videoId, activeVideoId, variant, isTeaser, initialSeekTime };

    const handleReady = React.useCallback((e: any) => {
        const { globalMute, onReady, onPlayerReady, isTeaser, initialSeekTime } = handlersRef.current;
        playerRef.current = e.target;
        
        try {
            if (globalMute) e.target.mute();
            else e.target.unMute();
        } catch {}

        if (initialSeekTime && initialSeekTime > 0) {
            // Seek to provided timestamp directly — skip the default intro-skip logic
            try { e.target.seekTo(initialSeekTime, true); } catch {}
        } else {
            // Default: skip intro/outro sections
            const duration = e.target.getDuration() || 0;
            const autoDetectedTeaser = duration > 0 && duration < 90;
            const isActuallyTeaser = isTeaser || autoDetectedTeaser;
            const defaultSkip = isActuallyTeaser ? 8 : 16;
            const currentTime = e.target.getCurrentTime();
            if (Math.abs(currentTime - defaultSkip) > 3) {
                e.target.seekTo(defaultSkip, true);
            }
        }
        
        setIsLoaded(true);
        onReady?.();

        // Expose player handle to parent AFTER seek — so parent can do additional seeks if needed.
        onPlayerReady?.(e.target);
    }, []);

    const handleStateChange = React.useCallback((e: any) => {
        const { movie, onPlay, activeVideoId, variant } = handlersRef.current;
        const YT_PLAYING = 1;

        // If player gets stuck in CUED or UNSTARTED while it's the active video, kick it.
        if (e.data === 5 || e.data === -1) {
            const myVideoId = `${variant}-${movie?.id}`;
            if (activeVideoId === myVideoId) {
                try { e.target.playVideo(); } catch {}
            }
        }

        if (!movie) return;

        if (e.data === YT_PLAYING) {
            onPlay?.();
            if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
            syncIntervalRef.current = setInterval(() => {
                try {
                    const time = e.target.getCurrentTime();
                    const duration = e.target.getDuration();

                    // Always fire time update so the progress bar is real
                    if (time > 0 && duration > 0) {
                        handlersRef.current.onTimeUpdate?.(time, duration);
                    }
                    
                    if (time > 0 && duration > 45) {
                        const remaining = duration - time;
                        // Auto-outro skip: pause near the end so backdrop + audio stay in sync
                        if (remaining < 8) {
                            if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
                            try { e.target.pauseVideo(); } catch {}
                            handlersRef.current.onEnded?.();
                        }
                    }
                } catch {}
            }, 500);
        } else {
            if (syncIntervalRef.current) {
                clearInterval(syncIntervalRef.current);
                syncIntervalRef.current = null;
            }
        }
    }, []);

    const handleEnd = React.useCallback(() => {
        if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
        handlersRef.current.onEnded?.();
    }, []);

    const handleError = React.useCallback(() => {
        if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
        handlersRef.current.onErrored?.();
    }, []);

    if (!movie || !videoId) return null;
    const isDirectVideo = videoId.startsWith('http');

    return (
        <div
            ref={containerRef}
            className={`absolute inset-0 overflow-hidden bg-black pointer-events-none transition-opacity duration-300 ease-in-out ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
        >
            <div className="relative w-full h-full">
                <div
                    className="absolute left-1/2 top-1/2 flex-shrink-0"
                    style={getSizingStyle()}
                >
                    {isDirectVideo ? (
                        <video
                            ref={playerRef}
                            src={videoId}
                            autoPlay
                            muted={globalMute}
                            loop
                            playsInline
                            className="w-full h-full object-cover"
                            onPlay={() => { onPlay?.(); setIsLoaded(true); }}
                            onEnded={() => onEnded?.()}
                            onError={() => onErrored?.()}
                            onLoadedData={() => setIsLoaded(true)}
                        />
                    ) : (
                        <YouTubePlayer
                            videoId={videoId}
                            host="https://www.youtube-nocookie.com"
                            className="w-full h-full flex items-center justify-center"
                            onReady={handleReady}
                            onStateChange={handleStateChange}
                            onEnd={handleEnd}
                            onError={handleError}
                            opts={{ ...playerOpts, width: '100%', height: '100%' }}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};