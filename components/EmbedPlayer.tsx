import React, { useRef, useEffect, useState, useCallback } from 'react';
import { ALL_EMBED_PROVIDERS } from '../services/EmbedProviders';
import { reportStreamError } from '../services/ProviderHealthService';
import { useEmbedLayout } from '../hooks/useEmbedLayout';

/** Functions exposed to the parent via a ref object */
export interface EmbedController {
    /** Seek to an absolute position in seconds */
    seek: (time: number) => void;
    /** Mute / unmute, optionally setting volume at the same time */
    setMuted: (muted: boolean, vol?: number) => void;
    /** Set volume level (0.0 – 1.0) without touching the mute flag */
    setVolume: (level: number) => void;
    /** Get the current iframe element */
    getIframe: () => HTMLIFrameElement | null;
}

interface EmbedPlayerProps {
    tmdbId: string;
    imdbId?: string;
    mediaType: 'movie' | 'tv';
    season?: number;
    episode?: number;
    isPlaying?: boolean;
    /** Resume position in seconds */
    startTime?: number;
    subtitleLang?: string;
    activePanel?: string;
    onPlay?: () => void;
    onPause?: () => void;
    onTimeUpdate?: (time: number, duration: number) => void;
    onEnded?: () => void;
    onProviderChange?: (providerId: string) => void;
    onAllFailed?: () => void;
    startProviderIndex?: number;
    providerIndex?: number;
    onProviderIndexChange?: (index: number) => void;
    /** Mutable ref object that receives control functions */
    controllerRef?: React.MutableRefObject<EmbedController | null>;
}

export const EmbedPlayer: React.FC<EmbedPlayerProps> = ({
    tmdbId,
    imdbId,
    mediaType,
    season,
    episode,
    isPlaying = false,
    startTime = 0,
    subtitleLang,
    activePanel,
    onPlay,
    onPause,
    onTimeUpdate,
    onEnded,
    onProviderChange,
    onAllFailed,
    startProviderIndex = 0,
    providerIndex,
    onProviderIndexChange,
    controllerRef
}) => {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [localProviderIndex, setLocalProviderIndex] = useState(startProviderIndex);

    const activeProviderIndex = providerIndex !== undefined ? providerIndex : localProviderIndex;
    const setActiveProviderIndex = useCallback((idx: number | ((prev: number) => number)) => {
        if (onProviderIndexChange) {
            const nextIdx = typeof idx === 'function' ? (idx as any)(activeProviderIndex) : idx;
            onProviderIndexChange(nextIdx);
        } else {
            setLocalProviderIndex(idx as any);
        }
    }, [onProviderIndexChange, activeProviderIndex]);

    // Lock the start time for the current content to prevent iframe reloading during watch progress saves
    const [lockedStartTime, setLockedStartTime] = useState(startTime);
    const seekTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pendingSeekTimeRef = useRef<number | null>(null);
    const seekVerifiedRef = useRef<boolean>(false);
    const [hasPlayedOnce, setHasPlayedOnce] = useState(false);

    // ── Elapsed timer (fallback when provider sends no postMessage) ────────────
    const elapsedRef = useRef(startTime);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const hasRealTimeUpdateRef = useRef(false);

    // Sync lockedStartTime when provider changes, so the new iframe starts at current progress
    useEffect(() => {
        if (elapsedRef.current > 5) {
            setLockedStartTime(elapsedRef.current);
        }
        seekVerifiedRef.current = false;
        setHasPlayedOnce(false);
    }, [activeProviderIndex]);

    useEffect(() => {
        setLockedStartTime(startTime);
        setHasPlayedOnce(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tmdbId, season, episode]);

    useEffect(() => {
        if (activeProviderIndex >= ALL_EMBED_PROVIDERS.length) {
            onAllFailed?.();
        }
    }, [activeProviderIndex, onAllFailed]);

    const currentProvider = ALL_EMBED_PROVIDERS[activeProviderIndex];
    const supportsInbound = currentProvider?.supportsInboundControl === true;

    const embedUrl = currentProvider
        ? currentProvider.buildUrl({
            tmdbId,
            imdbId,
            mediaType,
            season,
            episode,
            startTime: lockedStartTime,
            subtitleLang: undefined
        })
        : '';

    // ── Preconnect and DNS Prefetch to speed up domain resolution and handshakes ──
    useEffect(() => {
        if (!currentProvider || !embedUrl) return;
        try {
            const parsed = new URL(embedUrl);
            const origin = parsed.origin;

            const links: HTMLLinkElement[] = [];

            const preconnect = document.createElement('link');
            preconnect.rel = 'preconnect';
            preconnect.href = origin;
            preconnect.crossOrigin = 'anonymous';
            document.head.appendChild(preconnect);
            links.push(preconnect);

            const dnsPrefetch = document.createElement('link');
            dnsPrefetch.rel = 'dns-prefetch';
            dnsPrefetch.href = origin;
            document.head.appendChild(dnsPrefetch);
            links.push(dnsPrefetch);

            return () => {
                links.forEach(l => {
                    try { document.head.removeChild(l); } catch (e) { }
                });
            };
        } catch (e) {
            console.warn(`[EmbedPlayer] Failed to preconnect:`, e);
        }
    }, [embedUrl, currentProvider]);

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
        setActiveProviderIndex(prev => prev + 1);
    }, [currentProvider, tmdbId, mediaType, season, episode, setActiveProviderIndex]);

    const estimatedDuration = mediaType === 'tv' ? 2700 : 7200;

    // ── Auto-start: assume autoplay after fallback timeout if no real events arrive ──
    const autoStartRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (autoStartRef.current) clearTimeout(autoStartRef.current);
        stopTimer();
        elapsedRef.current = lockedStartTime;
        hasRealTimeUpdateRef.current = false;

        // Shorter timeout (3.5s) to avoid UI lockups if autoplay fails or loading is slow
        const timeoutDuration = 3500;

        autoStartRef.current = setTimeout(() => {
            if (!hasRealTimeUpdateRef.current) {
                console.log(`[EmbedPlayer] Fallback autoplay timer fired after ${timeoutDuration}ms for provider: ${currentProvider?.name}`);
                setHasPlayedOnce(true);
                startTimer();
                onPlay?.();
            }
        }, timeoutDuration);

        return () => {
            if (autoStartRef.current) clearTimeout(autoStartRef.current);
            stopTimer();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tmdbId, season, episode, activeProviderIndex, lockedStartTime, currentProvider]);

    useEffect(() => {
        if (currentProvider) {
            onProviderChange?.(currentProvider.id);
            console.log(`[EmbedPlayer] Loading provider: ${currentProvider.name}`);
        }
    }, [currentProvider, onProviderChange]);

    // ── Command broadcasters — VidFast PostMessage API only ────────────────────
    // Docs: https://vidfast.net/documentation → PostMessage tab

    const broadcastPlayPause = useCallback((play: boolean) => {
        const win = iframeRef.current?.contentWindow;
        if (!win) return;
        // VidFast documented format: { command: 'play' | 'pause' }
        win.postMessage({ command: play ? 'play' : 'pause' }, '*');
    }, []);

    const handleIframeLoad = useCallback(() => {
        console.log(`[EmbedPlayer] Iframe onLoad event fired. Sending initial play state.`);
        if (isPlaying) {
            broadcastPlayPause(true);
            setTimeout(() => broadcastPlayPause(true), 200);
        }
    }, [isPlaying, broadcastPlayPause]);

    const broadcastSeek = useCallback((time: number) => {
        const win = iframeRef.current?.contentWindow;
        if (!win) return;
        elapsedRef.current = time; // keep our local tracker in sync
        // VidFast documented format: { command: 'seek', time: <seconds> }
        win.postMessage({ command: 'seek', time }, '*');
        console.log(`[EmbedPlayer] Seek → ${time}s`);
    }, []);

    const broadcastMute = useCallback((muted: boolean, vol?: number) => {
        const win = iframeRef.current?.contentWindow;
        if (!win) return;
        // VidFast documented format: { command: 'mute', muted: bool }
        win.postMessage({ command: 'mute', muted }, '*');
        // If a target volume is supplied alongside unmute, also set volume
        if (!muted && vol !== undefined) {
            win.postMessage({ command: 'volume', level: vol }, '*');
        }
    }, []);

    const broadcastVolume = useCallback((level: number) => {
        const win = iframeRef.current?.contentWindow;
        if (!win) return;
        // VidFast documented format: { command: 'volume', level: 0.0–1.0 }
        win.postMessage({ command: 'volume', level }, '*');
        console.log(`[EmbedPlayer] Volume → ${Math.round(level * 100)}%`);
    }, []);

    // ── Controller ref — exposes seek / mute / volume to VideoPlayer ───────────
    useEffect(() => {
        if (!controllerRef) return;
        controllerRef.current = {
            seek: (time: number) => {
                broadcastSeek(time);

                // Clear any pending watchdog/reload timer
                if (seekTimeoutRef.current) clearTimeout(seekTimeoutRef.current);

                if (!currentProvider?.supportsPostMessage || currentProvider?.supportsInboundControl === false) {
                    // ── Category 2: dumb iframe — debounced reload ─────────────────────
                    console.log(`[EmbedPlayer] ⚙️ No inbound postMessage — reload at ${time}s.`);
                    seekTimeoutRef.current = setTimeout(() => {
                        setLockedStartTime(time);
                        seekTimeoutRef.current = null;
                    }, 400);
                } else {
                    // ── Category 1: postMessage-capable provider (VidFast) ─────────────
                    console.log(`[EmbedPlayer] 🚀 Seek sent via postMessage to ${time}s.`);
                }
            },
            setMuted: broadcastMute,
            setVolume: broadcastVolume,
            getIframe: () => iframeRef.current,
        };
        return () => {
            controllerRef.current = null;
            if (seekTimeoutRef.current) clearTimeout(seekTimeoutRef.current);
        };
    }, [controllerRef, broadcastSeek, broadcastMute, broadcastVolume, currentProvider]);

    // React to parent's isPlaying state — skip mount so we don't send pause before the iframe loads
    const hasMountedPlayRef = useRef(false);
    useEffect(() => {
        if (!hasMountedPlayRef.current) { hasMountedPlayRef.current = true; return; }
        broadcastPlayPause(isPlaying);
    }, [isPlaying, broadcastPlayPause]);

    // ── postMessage listener — VidFast event format only ──────────────────────
    // VidFast event shape:
    // { type: 'PLAYER_EVENT', data: { event, currentTime, duration, playing, muted, volume } }
    useEffect(() => {
        const handler = (e: MessageEvent) => {
            let data = e.data;
            if (typeof data === 'string') {
                try { data = JSON.parse(data); } catch { return; }
            }
            if (!data || typeof data !== 'object') return;

            // Only handle VidFast's documented event envelope
            if (data.type !== 'PLAYER_EVENT' || !data.data) return;

            const d = data.data;
            const event = d.event as string;
            const time = typeof d.currentTime === 'number' ? d.currentTime : null;
            const dur = typeof d.duration === 'number' && d.duration > 0 ? d.duration : estimatedDuration;

            // ── play / playing ─────────────────────────────────────────────────
            if (event === 'play' || event === 'playing') {
                hasRealTimeUpdateRef.current = true;
                setHasPlayedOnce(true);
                if (autoStartRef.current) { clearTimeout(autoStartRef.current); autoStartRef.current = null; }
                stopTimer();
                onPlay?.();
            }

            // ── pause ──────────────────────────────────────────────────────────
            if (event === 'pause' || event === 'paused') {
                stopTimer();
                onPause?.();
            }

            // ── ended ──────────────────────────────────────────────────────────
            if (event === 'ended' || event === 'complete' || event === 'completed') {
                onEnded?.();
            }

            // ── next episode button clicked (VidFast nextButton param) ─────────
            if (['next', 'nextepisode', 'next_episode'].includes(event.toLowerCase())) {
                console.log(`[EmbedPlayer] ⏩ Next episode event from iframe: "${event}"`);
                onEnded?.();
            }

            // ── timeupdate ────────────────────────────────────────────────────
            if (event === 'timeupdate' && time !== null) {
                hasRealTimeUpdateRef.current = true;
                setHasPlayedOnce(true);
                if (autoStartRef.current) { clearTimeout(autoStartRef.current); autoStartRef.current = null; }
                stopTimer();
                elapsedRef.current = time;
                onTimeUpdate?.(time, dur);

                // Verify that our programmatic seek landed correctly
                if (pendingSeekTimeRef.current !== null && Math.abs(time - pendingSeekTimeRef.current) < 3.5) {
                    console.log(`[EmbedPlayer] ✅ Seek verified via timeupdate at ${time}s`);
                    seekVerifiedRef.current = true;
                    pendingSeekTimeRef.current = null;
                    if (seekTimeoutRef.current) { clearTimeout(seekTimeoutRef.current); seekTimeoutRef.current = null; }
                }
            }

            // ── seeked ────────────────────────────────────────────────────────
            // VidFast fires this right when the seek completes — best event to verify on
            if (event === 'seeked' && time !== null) {
                hasRealTimeUpdateRef.current = true;
                setHasPlayedOnce(true);
                if (autoStartRef.current) { clearTimeout(autoStartRef.current); autoStartRef.current = null; }
                elapsedRef.current = time;
                onTimeUpdate?.(time, dur);

                if (pendingSeekTimeRef.current !== null && Math.abs(time - pendingSeekTimeRef.current) < 3.5) {
                    console.log(`[EmbedPlayer] ✅ Seek verified via 'seeked' event at ${time}s`);
                    seekVerifiedRef.current = true;
                    pendingSeekTimeRef.current = null;
                    if (seekTimeoutRef.current) { clearTimeout(seekTimeoutRef.current); seekTimeoutRef.current = null; }
                }
            }

            // ── error ─────────────────────────────────────────────────────────
            if (event === 'error') {
                handleProviderError();
            }
        };

        window.addEventListener('message', handler);
        return () => window.removeEventListener('message', handler);
    }, [onTimeUpdate, onPlay, onPause, onEnded, stopTimer, handleProviderError, estimatedDuration]);

    const { iframeW, iframeH, left, top, scale, clipPath } = useEmbedLayout();

    if (!currentProvider || activeProviderIndex >= ALL_EMBED_PROVIDERS.length || !embedUrl) return null;

    return (
        <div className="absolute inset-0 overflow-hidden bg-black z-0 pointer-events-auto">
            <div
                style={{
                    position: 'absolute',
                    width:    `${iframeW}px`,
                    height:   `${iframeH}px`,
                    left:     `${left}px`,
                    top:      `${top}px`,
                    transform: `scale(${scale})`,
                    transformOrigin: 'center center',
                    clipPath,
                    willChange: 'transform',
                }}
            >
                <iframe
                    ref={iframeRef}
                    src={embedUrl}
                    onLoad={handleIframeLoad}
                    style={{ width: '100%', height: '100%', border: 'none', display: 'block', pointerEvents: 'none' }}
                    allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
                    allowFullScreen={true}
                    referrerPolicy="no-referrer-when-downgrade"
                    onError={handleProviderError}
                    loading="eager"
                />
            </div>

            {/* Invisible Shield: blocks ad clicks and passes play/pause taps up to VideoPlayer */}
            <div
                className={`absolute inset-0 z-20 cursor-pointer embed-shield ${(!supportsInbound || !hasPlayedOnce) ? 'pointer-events-none' : ''}`}
                onClick={() => {
                    if (!supportsInbound) return;
                    if (activePanel && activePanel !== 'none') return;
                }}
            />

            {/* Edge catchers for UI wake-up */}
            <div className="absolute top-0 inset-x-0 h-4 z-10" style={{ pointerEvents: 'auto' }} />
            <div className="absolute bottom-0 inset-x-0 h-4 z-10" style={{ pointerEvents: 'auto' }} />
            <div className="absolute left-0 inset-y-0 w-4 z-10" style={{ pointerEvents: 'auto' }} />
            <div className="absolute right-0 inset-y-0 w-4 z-10" style={{ pointerEvents: 'auto' }} />
        </div>
    );
};