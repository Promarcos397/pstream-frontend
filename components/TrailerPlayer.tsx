import React, { useRef, useEffect } from 'react';
import YouTube from 'react-youtube';
import { useTrailer } from '../hooks/useTrailer';
import { useGlobalContext } from '../context/GlobalContext';
import { useVideoCover } from '../hooks/useVideoCover';
import { Movie } from '../types';

interface TrailerPlayerProps {
    movie: Movie | null;
    /** The UI context. Dictates how heavily to crop the YouTube watermark */
    variant?: 'card' | 'hero' | 'modal';
    onEnded?: () => void;
    onErrored?: () => void;
    onReady?: () => void;
    onProgress?: (time: number) => void;
}

/**
 * TrailerPlayer
 * ─────────────
 * The unified YouTube playback engine.
 * Completely replaces `useVideoPlayer`, `InfoModal` custom hooks, and `MovieCard` custom hooks.
 * 
 * Features:
 * 1. Self-Fetching: Uses `useTrailer` to fetch/read from cache automatically.
 * 2. Self-Scaling: Uses `useVideoCover` to crop YouTube UI perfectly.
 * 3. Self-Syncing: Automatically writes playback progress to the GlobalContext.
 */
export const TrailerPlayer: React.FC<TrailerPlayerProps> = ({ 
    movie, 
    variant = 'modal',
    onEnded,
    onErrored,
    onReady,
    onProgress
}) => {
    const { globalMute } = useGlobalContext();
    const { videoId } = useTrailer(movie);
    const { getVideoState, updateVideoState } = useGlobalContext();
    
    const containerRef = useRef<HTMLDivElement>(null);
    const playerRef = useRef<any>(null);
    const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Apply zoom based on variant to hide YouTube UI perfectly
    // NOTE: Values < 1.0 DO NOT zoom out the video! They just shrink the iframe, creating black bars.
    // We MUST use values > 1.0 (like 1.15) to crop out the YouTube title text and logo.
    const zoomFactor = variant === 'card' ? 1.05 : (variant === 'modal' ? 1.05 : 1.30);
    const dimensions = useVideoCover(containerRef, zoomFactor);

    // Cleanup interval on unmount
    useEffect(() => {
        return () => {
            if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
        };
    }, []);

    // Sync mute state globally
    useEffect(() => {
        if (!playerRef.current || typeof playerRef.current.mute !== 'function') return;
        try {
            if (globalMute) playerRef.current.mute();
            else playerRef.current.unMute();
        } catch {}
    }, [globalMute]);

    const { activeVideoId } = useGlobalContext();
    
    // Global Player Syncing
    useEffect(() => {
        if (!playerRef.current || !movie) return;
        const myVideoId = `${variant}-${movie.id}`;
        const isMyVideo = activeVideoId === myVideoId;
        
        if (activeVideoId && !isMyVideo) {
            try { playerRef.current.pauseVideo(); } catch {}
        } else {
            // Wait slightly before playing to avoid interrupting a deliberate pause
            const timer = setTimeout(() => {
                try { 
                    const savedTime = getVideoState(movie.id)?.time || 0;
                    const currentTime = playerRef.current.getCurrentTime() || 0;
                    if (savedTime > 0 && Math.abs(savedTime - currentTime) > 2) {
                        playerRef.current.seekTo(savedTime, true);
                    }
                    playerRef.current.playVideo(); 
                } catch {}
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [activeVideoId, movie]);

    const playerOpts = React.useMemo(() => ({
        width: '100%',
        height: '100%',
        playerVars: {
            autoplay: 1,
            mute: 1, // Always initialize muted to guarantee mobile autoplay
            controls: 0,
            modestbranding: 1,
            rel: 0,
            showinfo: 0,
            iv_load_policy: 3,
            cc_load_policy: 0,
            enablejsapi: 1,
            playsinline: 1,
            disablekb: 1,
            start: 7 // Premium start strictly enforced
        }
    }), []);

    // Ref pattern to hold latest props so handlers never change reference and interrupt iframe
    const handlersRef = useRef({ onReady, onEnded, onErrored, onProgress, globalMute, movie, getVideoState, updateVideoState, videoId, activeVideoId, variant });
    handlersRef.current = { onReady, onEnded, onErrored, onProgress, globalMute, movie, getVideoState, updateVideoState, videoId, activeVideoId, variant };

    const handleReady = React.useCallback((e: any) => {
        const { globalMute, movie, getVideoState, onReady, activeVideoId, variant } = handlersRef.current;
        playerRef.current = e.target;
        
        try {
            if (globalMute) e.target.mute();
            else e.target.unMute();
        } catch {}

        // Resume from where we left off, or skip the green bands
        const savedTime = movie ? (getVideoState(movie.id)?.time || 0) : 0;
        e.target.seekTo(savedTime > 0 ? savedTime : 7, true);
        
        const myVideoId = `${variant}-${movie?.id}`;
        if (activeVideoId === myVideoId) {
            e.target.playVideo();
        } else {
            e.target.pauseVideo();
        }

        onReady?.();
    }, []);

    const handleStateChange = React.useCallback((e: any) => {
        const { movie, updateVideoState, videoId, onProgress, activeVideoId, variant } = handlersRef.current;
        const YT_PLAYING = 1;
        const YT_PAUSED = 2;

        // Watchdog: Trigger play if player is stuck in "Cued" (5) or "Unstarted" (-1)
        if (e.data === 5 || e.data === -1) {
            const myVideoId = `${variant}-${movie?.id}`;
            if (activeVideoId === myVideoId) {
                try { e.target.playVideo(); } catch {}
            }
        }

        if (!movie) return;

        if (e.data === YT_PLAYING) {
            if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
            syncIntervalRef.current = setInterval(() => {
                try {
                    const time = e.target.getCurrentTime();
                    if (time > 0) {
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
            className="absolute inset-0 overflow-hidden bg-black pointer-events-none flex items-center justify-center"
        >
            <div className="flex-shrink-0" style={{ width: dimensions.width, height: dimensions.height }}>
                <YouTube
                    videoId={videoId}
                    className="w-full h-full"
                    onReady={handleReady}
                    onStateChange={handleStateChange}
                    onEnd={handleEnd}
                    onError={handleError}
                    opts={playerOpts}
                />
            </div>
        </div>
    );
};
