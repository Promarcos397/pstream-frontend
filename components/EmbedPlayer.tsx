import React, { useRef, useEffect, useState, useCallback } from 'react';
import { ALL_EMBED_PROVIDERS } from '../services/EmbedProviders';
import { reportStreamError } from '../services/ProviderHealthService';

/** Functions exposed to the parent via a ref object */
export interface EmbedController {
    /** Broadcast a seek command to the iframe (best-effort) */
    seek: (time: number) => void;
    /** Broadcast mute/unmute to the iframe (best-effort) */
    setMuted: (muted: boolean, vol?: number) => void;
    /** Get the current iframe element (for direct postMessage if needed) */
    getIframe: () => HTMLIFrameElement | null;
}

interface EmbedPlayerProps {
    tmdbId: string;
    imdbId?: string;
    mediaType: 'movie' | 'tv';
    season?: number;
    episode?: number;
    videoFit?: 'contain' | 'cover';
    isPlaying?: boolean;
    /** Resume position in seconds */
    startTime?: number;
    subtitleLang?: string;
    onPlay?: () => void;
    onPause?: () => void;
    onTimeUpdate?: (time: number, duration: number) => void;
    onEnded?: () => void;
    onProviderChange?: (providerId: string) => void;
    onAllFailed?: () => void;
    startProviderIndex?: number;
    /** Mutable ref object that receives control functions */
    controllerRef?: React.MutableRefObject<EmbedController | null>;
}

export const EmbedPlayer: React.FC<EmbedPlayerProps> = ({
    tmdbId,
    imdbId,
    mediaType,
    season,
    episode,
    videoFit = 'contain',
    isPlaying = false,
    startTime = 0,
    subtitleLang,
    onPlay,
    onPause,
    onTimeUpdate,
    onEnded,
    onProviderChange,
    onAllFailed,
    startProviderIndex = 0,
    controllerRef
}) => {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [providerIndex, setProviderIndex] = useState(startProviderIndex);

    // Lock the start time for the current content to prevent iframe reloading during watch progress saves
    const [lockedStartTime, setLockedStartTime] = useState(startTime);

    useEffect(() => {
        setLockedStartTime(startTime);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tmdbId, season, episode]);

    useEffect(() => {
        if (providerIndex >= ALL_EMBED_PROVIDERS.length) {
            onAllFailed?.();
        }
    }, [providerIndex, onAllFailed]);

    const currentProvider = ALL_EMBED_PROVIDERS[providerIndex];

    // ── Elapsed timer (fallback when provider sends no postMessage) ────────────
    const elapsedRef = useRef(startTime);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const hasRealTimeUpdateRef = useRef(false);

    const stopTimer = useCallback(() => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    const startTimer = useCallback(() => {
        if (!timerRef.current && !hasRealTimeUpdateRef.current) {
            timerRef.current = setInterval(() => {
                elapsedRef.current += 0.5;
                onTimeUpdate?.(elapsedRef.current, estimatedDuration);
            }, 500);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [onTimeUpdate]);

    const handleProviderError = useCallback(() => {
        if (currentProvider) {
            reportStreamError({
                provider: currentProvider.name,
                providerId: currentProvider.id,
                tmdbId,
                type: mediaType,
                season,
                episode,
                error: 'Embed load failed or errored',
                errorCode: 'EMBED_FAILED'
            });
        }
        setProviderIndex(prev => prev + 1);
    }, [currentProvider, tmdbId, mediaType, season, episode]);

    const estimatedDuration = mediaType === 'tv' ? 2700 : 7200;

    // ── Auto-start: assume autoplay after 4s if no real events arrive ──────────
    const autoStartRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (autoStartRef.current) clearTimeout(autoStartRef.current);
        stopTimer();
        elapsedRef.current = lockedStartTime;
        hasRealTimeUpdateRef.current = false;

        autoStartRef.current = setTimeout(() => {
            if (!hasRealTimeUpdateRef.current) {
                startTimer();
                onPlay?.();
            }
        }, 4000);

        return () => {
            if (autoStartRef.current) clearTimeout(autoStartRef.current);
            stopTimer();
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tmdbId, season, episode, providerIndex, lockedStartTime]);

    useEffect(() => {
        if (currentProvider) {
            onProviderChange?.(currentProvider.id);
            console.log(`[EmbedPlayer] Loading provider: ${currentProvider.name}`);
        }
    }, [currentProvider, onProviderChange]);

    // ── Command broadcasters ────────────────────────────────────────────────────
    const broadcastPlayPause = useCallback((play: boolean) => {
        const win = iframeRef.current?.contentWindow;
        if (!win) return;
        const cmd = play ? 'play' : 'pause';
        // Shotgun every known format
        win.postMessage(cmd, '*');
        win.postMessage(JSON.stringify({ method: cmd }), '*');
        win.postMessage(JSON.stringify({ event: 'command', func: play ? 'playVideo' : 'pauseVideo' }), '*');
        win.postMessage({ type: cmd }, '*');
        win.postMessage({ type: 'COMMAND', event: cmd }, '*');
        win.postMessage({ action: cmd }, '*');
        win.postMessage({ event: 'command', command: cmd }, '*');
        win.postMessage({ type: 'PLAYER_EVENT', player_status: play ? 'playing' : 'paused' }, '*');
    }, []);

    const broadcastSeek = useCallback((time: number) => {
        const win = iframeRef.current?.contentWindow;
        if (!win) return;
        elapsedRef.current = time; // keep our local tracker in sync
        win.postMessage({ type: 'seek', time }, '*');
        win.postMessage({ type: 'COMMAND', event: 'seek', time }, '*');
        win.postMessage(JSON.stringify({ method: 'seek', time }), '*');
        win.postMessage({ action: 'seek', currentTime: time }, '*');
        win.postMessage(JSON.stringify({ method: 'seek', params: [time] }), '*');
        win.postMessage({ type: 'PLAYER_EVENT', player_status: 'seeked', player_progress: time }, '*');
        console.log(`[EmbedPlayer] Broadcast seek to ${time}s`);
    }, []);

    const broadcastMute = useCallback((muted: boolean, vol?: number) => {
        const win = iframeRef.current?.contentWindow;
        if (!win) return;
        win.postMessage(JSON.stringify({ method: muted ? 'mute' : 'unmute' }), '*');
        win.postMessage(JSON.stringify({ event: 'command', func: muted ? 'mute' : 'unMute' }), '*');
        win.postMessage({ type: muted ? 'mute' : 'unmute' }, '*');
        win.postMessage({ action: muted ? 'mute' : 'unmute' }, '*');
        win.postMessage({ volume: muted ? 0 : (vol ?? 1) }, '*');
    }, []);

    // Populate the controller ref so parent can call these directly
    useEffect(() => {
        if (!controllerRef) return;
        controllerRef.current = {
            seek: broadcastSeek,
            setMuted: broadcastMute,
            getIframe: () => iframeRef.current
        };
        return () => { controllerRef.current = null; };
    }, [controllerRef, broadcastSeek, broadcastMute]);

    // React to parent's isPlaying state
    useEffect(() => {
        broadcastPlayPause(isPlaying);
    }, [isPlaying, broadcastPlayPause]);

    // ── postMessage listener ────────────────────────────────────────────────────
    useEffect(() => {
        const handler = (e: MessageEvent) => {
            let data = e.data;
            if (typeof data === 'string') {
                try { data = JSON.parse(data); } catch { return; }
            }
            if (!data || typeof data !== 'object') return;

            // VidAPI.ru format
            if (data.type === 'PLAYER_EVENT' && data.player_status != null) {
                const status = data.player_status as string;
                const time = typeof data.player_progress === 'number' ? data.player_progress : null;
                const dur = typeof data.player_duration === 'number' ? data.player_duration : 0;

                if (status === 'playing') {
                    hasRealTimeUpdateRef.current = true;
                    if (autoStartRef.current) { clearTimeout(autoStartRef.current); autoStartRef.current = null; }
                    stopTimer();
                    onPlay?.();
                    if (time !== null) {
                        elapsedRef.current = time;
                        onTimeUpdate?.(time, dur || estimatedDuration);
                    }
                }
                if (status === 'paused') { stopTimer(); onPause?.(); }
                if (status === 'completed') onEnded?.();
                if (status === 'seeked' && time !== null) {
                    elapsedRef.current = time;
                    onTimeUpdate?.(time, dur || estimatedDuration);
                }
                return;
            }

            // VidLink / VixSrc / CinemaOS PLAYER_EVENT format
            const d = (data.type === 'PLAYER_EVENT' && data.data) ? data.data : data;
            const type = d.type || d.event;

            if (type === 'timeupdate') {
                hasRealTimeUpdateRef.current = true;
                if (autoStartRef.current) { clearTimeout(autoStartRef.current); autoStartRef.current = null; }
                stopTimer();
                const time = d.currentTime ?? d.time ?? d.player_progress;
                const dur = d.duration ?? d.player_duration ?? 0;
                if (typeof time === 'number') {
                    elapsedRef.current = time;
                    onTimeUpdate?.(time, dur || estimatedDuration);
                }
                onPlay?.();
            }
            if (type === 'play' || type === 'playing') {
                hasRealTimeUpdateRef.current = true;
                if (autoStartRef.current) { clearTimeout(autoStartRef.current); autoStartRef.current = null; }
                stopTimer();
                onPlay?.();
            }
            if (type === 'pause' || type === 'paused') { stopTimer(); onPause?.(); }
            if (type === 'ended' || type === 'complete' || type === 'completed') onEnded?.();
            if (type === 'error') handleProviderError();
        };

        window.addEventListener('message', handler);
        return () => window.removeEventListener('message', handler);
    }, [onTimeUpdate, onPlay, onPause, onEnded, stopTimer, handleProviderError, estimatedDuration]);

    if (!currentProvider || providerIndex >= ALL_EMBED_PROVIDERS.length) return null;

    const embedUrl = currentProvider.buildUrl({ tmdbId, imdbId, mediaType, season, episode, startTime: lockedStartTime, subtitleLang });

    const hideNative = currentProvider.supportsControlsHide;
    const baseScale  = hideNative ? 1.0 : 1.3;
    const zoomFactor = videoFit === 'cover' ? 1.35 : 1.0;
    const totalScale = baseScale * zoomFactor;

    return (
        <div className="absolute inset-0 overflow-hidden bg-black z-0 pointer-events-auto flex items-center justify-center">
            <div
                className="absolute inset-0 flex items-center justify-center"
                style={{
                    transform: totalScale !== 1 ? `scale(${totalScale})` : undefined,
                    transformOrigin: 'center center',
                    width: `${100 / totalScale}%`,
                    height: `${100 / totalScale}%`,
                    left: `${(100 - 100 / totalScale) / 2}%`,
                    top: `${(100 - 100 / totalScale) / 2}%`,
                }}
            >
                <iframe
                    ref={iframeRef}
                    src={embedUrl}
                    style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
                    allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
                    allowFullScreen={true}
                    referrerPolicy="no-referrer-when-downgrade"
                    onError={handleProviderError}
                />
            </div>

            {/* Edge catchers for UI wake-up */}
            <div className="absolute top-0 inset-x-0 h-4 z-10" style={{ pointerEvents: 'auto' }} />
            <div className="absolute bottom-0 inset-x-0 h-4 z-10" style={{ pointerEvents: 'auto' }} />
            <div className="absolute left-0 inset-y-0 w-4 z-10" style={{ pointerEvents: 'auto' }} />
            <div className="absolute right-0 inset-y-0 w-4 z-10" style={{ pointerEvents: 'auto' }} />
        </div>
    );
};