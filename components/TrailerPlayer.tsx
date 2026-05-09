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
 * TrailerPlayer — unified YouTube playback engine.
 * Self-fetching (useTrailer), self-scaling (useVideoCover), self-syncing (GlobalContext).
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
    const { videoId, isTeaser } = useTrailer(movie);
    const { getVideoState, updateVideoState } = useGlobalContext();
    
    const containerRef = useRef<HTMLDivElement>(null);
    const playerRef = useRef<any>(null);
    const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    
    // Zoom crops YouTube chrome.
    const zoomFactor = variant === 'card' ? 1.10 : 1.10;
    const dimensions = useVideoCover(containerRef, zoomFactor);

    // HD Quality Trick: inflate the DOM pixel size so YouTube serves a higher-res stream,
    // then CSS-scale it back down to the correct visual size.
    // scale=1 initially so the player starts loading immediately without any gate.
    // Once ResizeObserver confirms real container dimensions, we remount the player
    // at scale=36 (via key change) so YouTube re-initializes at HD dimensions.
    const artificialScale = (variant === 'card' || variant === 'modal') && dimensions.ready ? 36 : 1;

    // Changing this key forces YouTube to remount exactly once when dimensions settle.
    // Without this, the iframe just gets CSS-scaled but YouTube never re-requests HD.
    const playerKey = `${videoId}-${variant}-${dimensions.ready ? 'hd' : 'sd'}`;

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
            start: 15
        }
    }), []);

    // Ref pattern to hold latest props so handlers never change reference and interrupt iframe
    const handlersRef = useRef({ onReady, onEnded, onErrored, onProgress, globalMute, movie, getVideoState, updateVideoState, videoId, activeVideoId, variant, isTeaser });
    handlersRef.current = { onReady, onEnded, onErrored, onProgress, globalMute, movie, getVideoState, updateVideoState, videoId, activeVideoId, variant, isTeaser };

    const handleReady = React.useCallback((e: any) => {
        const { globalMute, movie, getVideoState, onReady, activeVideoId, variant, isTeaser } = handlersRef.current;
        playerRef.current = e.target;
        
        try {
            if (globalMute) e.target.mute();
            else e.target.unMute();
        } catch {}

        // Resume from where we left off, or use content-aware skip:
        // Teasers are short (~60-90s), so only skip 5s. Full trailers skip 15s.
        const defaultSkip = isTeaser ? 5 : 15;
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
            {/* Always mount the player — never gate on dimensions.ready.
                artificialScale is 1 until dimensions settle, then jumps to 36
                for the quality trick. The player starts loading immediately. */}
            <div 
                className="flex-shrink-0" 
                style={{ 
                    width: dimensions.width * artificialScale, 
                    height: dimensions.height * artificialScale,
                    transform: `scale(${1 / artificialScale})`,
                    transformOrigin: 'center center'
                }}
            >
                <YouTube
                    key={playerKey}
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
