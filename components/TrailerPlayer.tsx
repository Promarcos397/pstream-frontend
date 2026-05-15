import React, { useRef, useEffect } from 'react';
import YouTube from 'react-youtube';
import { useTrailer } from '../hooks/useTrailer';
import { useGlobalContext } from '../context/GlobalContext';
import { Movie } from '../types';

interface TrailerPlayerProps {
    movie: Movie | null;
    variant?: 'card' | 'hero' | 'modal';
    cropFactor?: number;
    onEnded?: () => void;
    onErrored?: () => void;
    onReady?: () => void;
    onPlay?: () => void;
    onProgress?: (time: number) => void;
}

export const TrailerPlayer: React.FC<TrailerPlayerProps> = ({
    movie,
    variant = 'modal',
    cropFactor,
    onEnded,
    onErrored,
    onReady,
    onPlay,
    onProgress
}) => {
    const { globalMute } = useGlobalContext();
    const { videoId, isTeaser } = useTrailer(movie);
    const { getVideoState, updateVideoState } = useGlobalContext();

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
                    const savedTime = getVideoState(movie.id)?.time || 0;
                    if (isDirect) {
                        playerRef.current.muted = globalMute;
                        if (Math.abs(playerRef.current.currentTime - savedTime) > 1) {
                            playerRef.current.currentTime = savedTime;
                        }
                        playerRef.current.play().catch(() => {});
                    } else {
                        // YouTube: Ensure player is ready for commands
                        if (typeof playerRef.current.getPlayerState === 'function') {
                            const currentTime = playerRef.current.getCurrentTime() || 0;
                            if (savedTime > 0 && Math.abs(savedTime - currentTime) > 0.5) {
                                playerRef.current.seekTo(savedTime, true);
                            }
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

    // Time Sync for Direct Video (mirroring YouTube's handleStateChange logic)
    useEffect(() => {
        if (!videoId?.startsWith('http') || !movie) return;
        
        if (activeVideoId === `${variant}-${movie.id}`) {
            const interval = setInterval(() => {
                if (playerRef.current && !playerRef.current.paused) {
                    const time = playerRef.current.currentTime;
                    updateVideoState(movie.id, time, videoId);
                    onProgress?.(time);
                }
            }, 500);
            return () => clearInterval(interval);
        }
    }, [activeVideoId, movie, videoId, variant, updateVideoState, onProgress]);

    const startTime = React.useMemo(() => {
        if (!movie) return 0;
        const savedTime = getVideoState(movie.id)?.time || 0;
        if (savedTime > 0) return Math.floor(savedTime);
        return isTeaser ? 4 : 8; // Faster intro skips for casual browsing
    }, [movie?.id, isTeaser, getVideoState]);

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

    const handlersRef = useRef({ onReady, onPlay, onEnded, onErrored, onProgress, globalMute, movie, getVideoState, updateVideoState, videoId, activeVideoId, variant, isTeaser });
    handlersRef.current = { onReady, onPlay, onEnded, onErrored, onProgress, globalMute, movie, getVideoState, updateVideoState, videoId, activeVideoId, variant, isTeaser };

    const handleReady = React.useCallback((e: any) => {
        const { globalMute, movie, getVideoState, onReady, activeVideoId, variant, isTeaser } = handlersRef.current;
        playerRef.current = e.target;
        
        try {
            if (globalMute) e.target.mute();
            else e.target.unMute();
        } catch {}

        // YouTube's 'start' param handles the initial jump, but we verify 
        // here to ensure sync if the player buffered slightly late.
        const duration = e.target.getDuration() || 0;
        const autoDetectedTeaser = duration > 0 && duration < 90;
        const isActuallyTeaser = isTeaser || autoDetectedTeaser;
        const defaultSkip = isActuallyTeaser ? 8 : 16;
        const savedTime = movie ? (getVideoState(movie.id)?.time || 0) : 0;
        const targetTime = savedTime > 0 ? savedTime : defaultSkip;
        
        const currentTime = e.target.getCurrentTime();
        // Only seek if the 'start' param failed or we are way off (e.g. background tab resumed)
        if (Math.abs(currentTime - targetTime) > 3) {
            e.target.seekTo(targetTime, true);
        }
        
        const myVideoId = `${variant}-${movie?.id}`;
        // Note: The global activeVideoId effect (line 81) will handle play/pause
        // once this ready state is set, so we don't force it here to avoid jitter.
        
        setIsLoaded(true);
        onReady?.();
    }, []);

    const handleStateChange = React.useCallback((e: any) => {
        const { movie, updateVideoState, videoId, onProgress, onPlay, activeVideoId, variant } = handlersRef.current;
        const YT_PLAYING = 1;
        const YT_PAUSED = 2;

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
                    
                    if (time > 0) {
                        const remaining = duration - time;
                        // Auto-outro skip: now PAUSES the player so backdrop + audio stay in sync
                        if (duration > 45 && remaining < 8) {
                            if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
                            try { e.target.pauseVideo(); } catch {}
                            handlersRef.current.onEnded?.();
                            return;
                        }

                        updateVideoState(movie.id, time, videoId || undefined);
                        onProgress?.(time);
                    }
                } catch {}
            }, 100);
        }

        if (e.data === YT_PAUSED) {
            if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
            try {
                const time = e.target.getCurrentTime();
                if (time > 0) updateVideoState(movie.id, time, videoId || undefined);
            } catch {}
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
                        <YouTube
                            videoId={videoId}
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