import React, { useRef, useEffect } from 'react';
import YouTube from 'react-youtube';
import { useTrailer } from '../hooks/useTrailer';
import { useUIStore } from '../store/useUIStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { useTrailerHistoryStore } from '../store/useTrailerHistoryStore';
import { Movie } from '../types';

const YouTubePlayer = (YouTube as any).default || YouTube;

const DEFAULT_CROP: Record<string, number> = { card: 1.35, hero: 1.15, modal: 1.35, clips: 2.2 };

const IS_WEBKIT =
  typeof window !== 'undefined' &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
    /^((?!chrome|android).)*safari/i.test(navigator.userAgent));

const ARTIFICIAL_SCALE = IS_WEBKIT ? 2.2 : 5;

interface TrailerPlayerProps {
    movie: Movie | null;
    variant?: 'card' | 'hero' | 'modal' | 'clips';
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
    /** Play this exact video instead of resolving one via useTrailer — used by
     * the Clips feed, which resolves scene-clips through its own pipeline. */
    videoIdOverride?: string;
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
    videoIdOverride,
}) => {
    const globalMute = useSettingsStore(s => s.globalMute);
    const { videoId: resolvedVideoId, isTeaser } = useTrailer(videoIdOverride ? null : movie);
    const videoId = videoIdOverride ?? resolvedVideoId;

    const playerRef = useRef<any>(null);
    const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const zoomFactor = cropFactor ?? DEFAULT_CROP[variant] ?? 1.35;

    const sizingStyle = React.useMemo<React.CSSProperties>(() => ({
        width: `${ARTIFICIAL_SCALE * 115}%`,
        height: `${ARTIFICIAL_SCALE * 115}%`,
        transform: `translate(-50%, -50%) scale(${zoomFactor / ARTIFICIAL_SCALE})`,
        transformOrigin: 'center center',
        willChange: 'transform',
    }), [zoomFactor]);

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
            // Unmute may only ever reach the active video — offscreen players
            // preloading for the Clips feed must stay silent.
            const isMyVideo = useUIStore.getState().activeVideoId === `${variant}-${movie?.id}`;
            if (globalMute || !isMyVideo) playerRef.current.mute();
            else playerRef.current.unMute();
        } catch {}
    }, [globalMute, variant, movie?.id]);

    const activeVideoId = useUIStore(s => s.activeVideoId);
    
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
                        // <video>'s muted attribute is already reactive via JSX
                        // (muted={globalMute}) — just ensure playback continues.
                        playerRef.current.play().catch(() => {});
                    } else {
                        // YouTube: Ensure player is ready for commands. Sound is
                        // restored separately once PLAYING is confirmed (see
                        // handleStateChange) — calling unMute() together with
                        // playVideo() here trips the browser's autoplay-with-
                        // sound gate on a fresh/paused player and leaves it
                        // stuck showing YouTube's own "tap to play" overlay.
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
    // globalMute intentionally excluded — muting must never re-trigger this
    // play/pause sync (it was calling playVideo()/interrupting playback on
    // every mute toggle). Sound is handled by the dedicated mute effect above
    // and, for YouTube, by handleStateChange once PLAYING is confirmed.
    }, [activeVideoId, movie, variant, videoId, isLoaded]);

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
        const { globalMute, onReady, onPlayerReady, isTeaser, initialSeekTime, movie, variant, activeVideoId } = handlersRef.current;
        playerRef.current = e.target;

        // Only the ACTIVE video may have sound — a player preloading offscreen
        // (Clips mounts near-view slides early) must stay muted or you'd hear
        // two clips at once for a moment.
        const isMyVideo = activeVideoId === `${variant}-${movie?.id}`;
        try {
            if (globalMute || !isMyVideo) e.target.mute();
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
        const { movie, onPlay, activeVideoId, variant, globalMute } = handlersRef.current;
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
            // Real playback started — feeds "Trailers You've Watched" on My Netflix.
            if (movie) useTrailerHistoryStore.getState().recordWatch(movie);
            // Sound is restored here, now that the video is confirmed playing —
            // unmuting an already-playing element doesn't trip the browser's
            // autoplay gate the way unmuting-while-starting does.
            const myVideoId = `${variant}-${movie.id}`;
            if (activeVideoId === myVideoId) {
                try { if (globalMute) e.target.mute(); else e.target.unMute(); } catch {}
            }
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
        <div className={`absolute inset-0 overflow-hidden bg-black pointer-events-none transition-opacity duration-300 ease-in-out ${isLoaded ? 'opacity-100' : 'opacity-0'}`}>
            <div
                className="absolute left-1/2 top-1/2 flex-shrink-0"
                style={sizingStyle}
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
                        onPlay={() => { onPlay?.(); setIsLoaded(true); if (movie) useTrailerHistoryStore.getState().recordWatch(movie); }}
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
                        opts={playerOpts}
                    />
                )}
            </div>
        </div>
    );
};