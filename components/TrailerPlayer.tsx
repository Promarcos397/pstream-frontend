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
    /**
     * How much to overscan beyond the natural cover-fit dimensions.
     * 1.0 = perfect fill (no crop), 1.04 = 4% overflow each edge.
     *
     * For the 'card' variant the default is 1.0 because:
     *  - The card popup container is exactly 16:9 (336×189), same as the video.
     *  - The artificialScale=36 trick makes YouTube UI chrome render at 1/36 its
     *    natural size (~1-2px visually), so no overscan is needed to hide it.
     * For 'hero'/'modal' the default is 1.10 because those containers may not be
     * 16:9 and need the cover-crop to guarantee full bleed coverage.
     */
    cropFactor?: number;
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
    cropFactor,
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
    
    // zoomFactor: for CARD this becomes the CSS scale zoom to push chrome off the edges.
    //             for HERO/MODAL this feeds useVideoCover cover-crop math.
    const DEFAULT_CROP: Record<string, number> = { card: 1.20, hero: 1.10, modal: 1.20 };
    const zoomFactor = cropFactor ?? DEFAULT_CROP[variant] ?? 1.10;

    // For CARD & MODAL: useVideoCover is only used by the hero render path.
    // These variants use percentage-based inflation so they need coverFactor=1.0 (natural dimensions).
    // For HERO: coverFactor = zoomFactor feeds the cover-crop math.
    const isFixedRatio = variant === 'card' || variant === 'modal';
    const coverFactor = isFixedRatio ? 1.0 : zoomFactor;
    const dimensions = useVideoCover(containerRef, coverFactor);

    // Inflate DOM so YouTube chrome shrinks to ~1-2px at visual scale.
    const artificialScale = 26;

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
                    const duration = e.target.getDuration();
                    
                    if (time > 0) {
                        // --- Auto-Outro Skip ---
                        // YouTube trailers often have 10-15s of "Channel Recommendations" at the end.
                        // We skip the last 7 seconds to keep the experience clean.
                        // Resiliency: Only skip if the video is at least 45s long, so we don't
                        // gut extremely short teasers that might be all-content.
                        const remaining = duration - time;
                        if (duration > 45 && remaining < 7) {
                            if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
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
            {isFixedRatio ? (
                // ── CARD & MODAL: BOTH effects independently ────────────────────────
                // Layer 1 — outer scale(zoomFactor): crop from center (controls visible area)
                // Layer 2 — inner percentage inflate + scale(1/N): shrinks YouTube chrome to ~2px
                // N*100% = always N× the parent width, no ResizeObserver needed, stable from frame 1.
                <div
                    className="w-full h-full"
                    style={{ transform: `scale(${zoomFactor})`, transformOrigin: 'center center' }}
                >
                    <div className="flex items-center justify-center w-full h-full">
                        <div
                            className="flex-shrink-0"
                            style={{
                                width: `${artificialScale * 100}%`,
                                height: `${artificialScale * 100}%`,
                                transform: `scale(${1 / artificialScale})`,
                                transformOrigin: 'center center',
                            }}
                        >
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
                </div>
            ) : (
                // ── HERO: Flexible aspect ratio ──────────────────────────────────────
                // useVideoCover sizes the iframe to cover the container + zoomFactor overflow.
                // artificialScale=26 inflates the DOM so YouTube chrome (~60px) becomes
                // ~2.3px at visual scale — invisible. CSS scale(1/26) restores visual size.
                // overflow:hidden clips the zoomFactor overflow, hiding any remaining chrome.
                <div className="flex items-center justify-center w-full h-full">
                    <div
                        className="flex-shrink-0"
                        style={{
                            width: dimensions.width * artificialScale,
                            height: dimensions.height * artificialScale,
                            transform: `scale(${1 / artificialScale})`,
                            transformOrigin: 'center center',
                        }}
                    >
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
            )}
        </div>
    );
};
