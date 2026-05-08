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
    const zoomFactor = variant === 'card' ? 0.90 : (variant === 'modal' ? 1.10 : 1.10);
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

    if (!movie || !videoId) return null;

    const handleReady = (e: any) => {
        playerRef.current = e.target;
        
        try {
            if (globalMute) e.target.mute();
            else e.target.unMute();
        } catch {}

        // Resume from where we left off, or skip the green bands
        const savedTime = getVideoState(movie.id)?.time || 0;
        e.target.seekTo(savedTime > 0 ? savedTime : 7, true);
        e.target.playVideo();

        onReady?.();
    };

    const handleStateChange = (e: any) => {
        const YT_PLAYING = 1;
        const YT_PAUSED = 2;

        // Watchdog: Trigger play if player is stuck in "Cued" (5) or "Unstarted" (-1)
        if (e.data === 5 || e.data === -1) {
            try { e.target.playVideo(); } catch {}
        }

        if (e.data === YT_PLAYING) {
            if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
            syncIntervalRef.current = setInterval(() => {
                try {
                    const time = e.target.getCurrentTime();
                    if (time > 0) {
                        updateVideoState(movie.id, time, videoId);
                        onProgress?.(time);
                    }
                } catch {}
            }, 1000);
        }

        if (e.data === YT_PAUSED) {
            if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
            try {
                const time = e.target.getCurrentTime();
                if (time > 0) updateVideoState(movie.id, time, videoId);
            } catch {}
        }
    };

    const handleEnd = () => {
        if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
        onEnded?.();
    };

    const handleError = () => {
        if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
        onErrored?.();
    };

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
                    opts={{
                        width: '100%',
                        height: '100%',
                        playerVars: {
                            autoplay: 1,
                            mute: globalMute ? 1 : 0,
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
                    }}
                />
            </div>
        </div>
    );
};
