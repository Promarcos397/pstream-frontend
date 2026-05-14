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
        
        if (isMyVideo) {
            try { 
                if (playerRef.current) {
                    const savedTime = getVideoState(movie.id)?.time || 0;
                    const currentTime = playerRef.current.getCurrentTime() || 0;
                    if (savedTime > 0 && Math.abs(savedTime - currentTime) > 0.5) {
                        playerRef.current.seekTo(savedTime, true);
                    }
                    playerRef.current.playVideo(); 
                }
            } catch {}
        } else {
            try { 
                playerRef.current.pauseVideo(); 
                if (syncIntervalRef.current) {
                    clearInterval(syncIntervalRef.current);
                    syncIntervalRef.current = null;
                }
            } catch {}
        }
    }, [activeVideoId, movie, variant]);

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
            iv_load_policy: 3,
            cc_load_policy: 0,
            enablejsapi: 1,
            playsinline: 1,
            disablekb: 1,
            // REMOVED: start: 15 — handleReady seeks precisely, avoiding double-seek jank
        }
    }), []);

    const handlersRef = useRef({ onReady, onPlay, onEnded, onErrored, onProgress, globalMute, movie, getVideoState, updateVideoState, videoId, activeVideoId, variant, isTeaser });
    handlersRef.current = { onReady, onPlay, onEnded, onErrored, onProgress, globalMute, movie, getVideoState, updateVideoState, videoId, activeVideoId, variant, isTeaser };

    const handleReady = React.useCallback((e: any) => {
        const { globalMute, movie, getVideoState, onReady, activeVideoId, variant, isTeaser } = handlersRef.current;
        playerRef.current = e.target;
        
        try {
            if (globalMute) e.target.mute();
            else e.target.unMute();
        } catch {}

        const duration = e.target.getDuration() || 0;
        const autoDetectedTeaser = duration > 0 && duration < 90;
        const isActuallyTeaser = isTeaser || autoDetectedTeaser;
        const defaultSkip = isActuallyTeaser ? 5 : 15;
        const savedTime = movie ? (getVideoState(movie.id)?.time || 0) : 0;
        e.target.seekTo(savedTime > 0 ? savedTime : defaultSkip, true);
        
        const myVideoId = `${variant}-${movie?.id}`;
        if (activeVideoId === myVideoId) {
            e.target.playVideo();
        } else {
            e.target.pauseVideo();
        }

        onReady?.();
    }, []);

    const handleStateChange = React.useCallback((e: any) => {
        const { movie, updateVideoState, videoId, onProgress, onPlay, activeVideoId, variant } = handlersRef.current;
        const YT_PLAYING = 1;
        const YT_PAUSED = 2;

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
                        if (duration > 45 && remaining < 7) {
                            if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
                            try { e.target.pauseVideo(); } catch {}
                            handlersRef.current.onEnded?.();
                            return;
                        }

                        updateVideoState(movie.id, time, videoId || undefined);
                        onProgress?.(time);
                    }
                } catch {}
            }, 1000);
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

    return (
        <div
            ref={containerRef}
            className="absolute inset-0 overflow-hidden bg-black pointer-events-none"
        >
            <div className="relative w-full h-full">
                <div
                    className="absolute left-1/2 top-1/2 flex-shrink-0"
                    style={getSizingStyle()}
                >
                    <YouTube
                        videoId={videoId}
                        className="w-full h-full flex items-center justify-center"
                        onReady={handleReady}
                        onStateChange={handleStateChange}
                        onEnd={handleEnd}
                        onError={handleError}
                        opts={{ ...playerOpts, width: '100%', height: '100%' }}
                    />
                </div>
            </div>
        </div>
    );
};