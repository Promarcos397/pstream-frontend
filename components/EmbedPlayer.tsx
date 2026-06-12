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
    videoFit = 'contain',
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

    // ── Elapsed timer (fallback when provider sends no postMessage) ────────────
    const elapsedRef = useRef(startTime);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const hasRealTimeUpdateRef = useRef(false);

    // Sync lockedStartTime when provider changes, so the new iframe starts at our current progress!
    useEffect(() => {
        if (elapsedRef.current > 5) {
            setLockedStartTime(elapsedRef.current);
        }
        seekVerifiedRef.current = false;
    }, [activeProviderIndex]);

    useEffect(() => {
        setLockedStartTime(startTime);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tmdbId, season, episode]);

    useEffect(() => {
        if (activeProviderIndex >= ALL_EMBED_PROVIDERS.length) {
            onAllFailed?.();
        }
    }, [activeProviderIndex, onAllFailed]);

    const currentProvider = ALL_EMBED_PROVIDERS[activeProviderIndex];
    const supportsInbound = currentProvider?.supportsInboundControl === true;

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

    // ── Auto-start: assume autoplay after fallback timeout if no real events arrive ──────────
    const autoStartRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (autoStartRef.current) clearTimeout(autoStartRef.current);
        stopTimer();
        elapsedRef.current = lockedStartTime;
        hasRealTimeUpdateRef.current = false;

        const timeoutDuration = currentProvider?.supportsPostMessage ? 12000 : 7000;

        autoStartRef.current = setTimeout(() => {
            if (!hasRealTimeUpdateRef.current) {
                console.log(`[EmbedPlayer] Fallback autoplay timer fired after ${timeoutDuration}ms for provider: ${currentProvider?.name}`);
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
        
        // VidFast / Vidking specific formats
        win.postMessage({ command: cmd }, '*');
        win.postMessage(JSON.stringify({ command: cmd }), '*');
    }, []);

    const broadcastSeek = useCallback((time: number) => {
        const win = iframeRef.current?.contentWindow;
        if (!win) return;
        elapsedRef.current = time; // keep our local tracker in sync

        // Shotgun seek commands
        win.postMessage({ type: 'seek', time }, '*');
        win.postMessage({ type: 'seek', value: time }, '*');
        win.postMessage({ type: 'seek', to: time }, '*');
        win.postMessage({ event: 'seek', value: time }, '*');
        win.postMessage({ event: 'seek', to: time }, '*');
        win.postMessage({ type: 'COMMAND', event: 'seek', time }, '*');
        win.postMessage(JSON.stringify({ method: 'seek', time }), '*');
        win.postMessage(JSON.stringify({ method: 'seek', value: time }), '*');
        win.postMessage(JSON.stringify({ method: 'seek', to: time }), '*');
        win.postMessage(JSON.stringify({ method: 'seekTo', value: time }), '*');
        win.postMessage({ action: 'seek', currentTime: time }, '*');
        win.postMessage({ action: 'seek', to: time }, '*');
        win.postMessage(JSON.stringify({ method: 'seek', params: [time] }), '*');
        win.postMessage(JSON.stringify({ event: 'command', func: 'seekTo', args: [time, true] }), '*');
        win.postMessage(JSON.stringify({ event: 'command', func: 'seek', args: [time] }), '*');
        win.postMessage(JSON.stringify({ event: 'seek', to: time }), '*');
        win.postMessage(JSON.stringify({ type: 'seek', to: time }), '*');
        win.postMessage(JSON.stringify({ method: 'setCurrentTime', value: time }), '*');
        win.postMessage(JSON.stringify({ method: 'setCurrentTime', params: [time] }), '*');
        win.postMessage({ type: 'PLAYER_EVENT', player_status: 'seeked', player_progress: time }, '*');

        // VidFast / Vidking specific inbound seek command formats
        win.postMessage({ command: 'seek', time }, '*');
        win.postMessage(JSON.stringify({ command: 'seek', time }), '*');

        // StreamVault / generic data wrappers
        win.postMessage({ type: 'seek', data: { time } }, '*');

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

        // VidFast / Vidking specific formats
        win.postMessage({ command: 'mute', muted }, '*');
        win.postMessage(JSON.stringify({ command: 'mute', muted }), '*');
        if (vol !== undefined) {
            win.postMessage({ command: 'volume', level: vol }, '*');
            win.postMessage(JSON.stringify({ command: 'volume', level: vol }), '*');
        }
    }, []);

    // Populate the controller ref so parent can call these directly
    useEffect(() => {
        if (!controllerRef) return;
        controllerRef.current = {
            seek: (time: number) => {
                broadcastSeek(time);

                // Clear any pending seek timer
                if (seekTimeoutRef.current) {
                    clearTimeout(seekTimeoutRef.current);
                }

                // Special Treatment based on provider capabilities:
                if (currentProvider?.supportsPostMessage && currentProvider?.supportsInboundControl !== false) {
                    // Category 1: Programmatic Seeker (Tier 1).
                    // If we have already verified that postMessage works in this session,
                    // we NEVER reload the iframe — the player is perfectly functional.
                    if (seekVerifiedRef.current) {
                        console.log(`[EmbedPlayer] 🚀 postMessage seek already verified for this session. Skipping watchdog reload fallback.`);
                        pendingSeekTimeRef.current = null;
                        return;
                    }

                    pendingSeekTimeRef.current = time;
                    console.log(`[EmbedPlayer] 🕒 Scheduling smart watchdog for programmatic seek verification at ${time}s.`);

                    seekTimeoutRef.current = setTimeout(() => {
                        if (pendingSeekTimeRef.current !== null) {
                            console.log(`[EmbedPlayer] ⚠️ postMessage seek verification timed out for ${time}s. Falling back to iframe reload.`);
                            setLockedStartTime(time);
                            pendingSeekTimeRef.current = null;
                        }
                        seekTimeoutRef.current = null;
                    }, 1500); // Generous 1500ms watchdog for the very first seek
                } else {
                    // Category 2: Hard Fallback (Tier 2). Trigger debounced reload immediately for skips.
                    console.log(`[EmbedPlayer] ⚙️ Provider does not support postMessage. Triggering debounced iframe reload at ${time}s.`);
                    seekTimeoutRef.current = setTimeout(() => {
                        setLockedStartTime(time);
                        seekTimeoutRef.current = null;
                    }, 400); // 400ms rapid skip debounce for hard reloads
                }
            },
            setMuted: broadcastMute,
            getIframe: () => iframeRef.current
        };
        return () => {
            controllerRef.current = null;
            if (seekTimeoutRef.current) clearTimeout(seekTimeoutRef.current);
        };
    }, [controllerRef, broadcastSeek, broadcastMute, currentProvider]);

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

            // ── Collision-Free Vidsync Telemetry ──────────────────────────────
            if (data.type === 'VIDSYNC_PLAYER_EVENT' && data.data) {
                const d = data.data;
                const type = d.event;
                const time = d.currentTime;
                const dur = d.duration;

                if (type === 'play' || type === 'playing') {
                    hasRealTimeUpdateRef.current = true;
                    if (autoStartRef.current) { clearTimeout(autoStartRef.current); autoStartRef.current = null; }
                    stopTimer();
                    onPlay?.();
                }
                if (type === 'pause' || type === 'paused') { stopTimer(); onPause?.(); }
                if (type === 'ended' || type === 'complete') onEnded?.();
                if (type === 'timeupdate' && typeof time === 'number') {
                    hasRealTimeUpdateRef.current = true;
                    if (autoStartRef.current) { clearTimeout(autoStartRef.current); autoStartRef.current = null; }
                    stopTimer();
                    elapsedRef.current = time;
                    onTimeUpdate?.(time, dur || estimatedDuration);
                }

                // Watchdog verification for Vidsync
                if (pendingSeekTimeRef.current !== null && typeof time === 'number') {
                    if (Math.abs(time - pendingSeekTimeRef.current) < 3.5) {
                        console.log(`[EmbedPlayer] 🎉 Programmatic postMessage seek verified for Vidsync at ${time}s! Skipping iframe reload.`);
                        seekVerifiedRef.current = true;
                        pendingSeekTimeRef.current = null;
                        if (seekTimeoutRef.current) {
                            clearTimeout(seekTimeoutRef.current);
                            seekTimeoutRef.current = null;
                        }
                    }
                }
                return;
            }

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
            const time = d.currentTime ?? d.time ?? d.player_progress;

            if (type === 'timeupdate') {
                hasRealTimeUpdateRef.current = true;
                if (autoStartRef.current) { clearTimeout(autoStartRef.current); autoStartRef.current = null; }
                stopTimer();
                const dur = d.duration ?? d.player_duration ?? 0;
                if (typeof time === 'number') {
                    elapsedRef.current = time;
                    onTimeUpdate?.(time, dur || estimatedDuration);

                    // Verify programmatic postMessage seek
                    if (pendingSeekTimeRef.current !== null) {
                        if (Math.abs(time - pendingSeekTimeRef.current) < 3.5) {
                            console.log(`[EmbedPlayer] 🎉 Programmatic postMessage seek verified at ${time}s! Skipping iframe reload.`);
                            seekVerifiedRef.current = true;
                            pendingSeekTimeRef.current = null;
                            if (seekTimeoutRef.current) {
                                clearTimeout(seekTimeoutRef.current);
                                seekTimeoutRef.current = null;
                            }
                        }
                    }
                }
            }
            if (type === 'play' || type === 'playing') {
                hasRealTimeUpdateRef.current = true;
                if (autoStartRef.current) { clearTimeout(autoStartRef.current); autoStartRef.current = null; }
                stopTimer();
                onPlay?.();
            }
            if (type === 'pause' || type === 'paused') { stopTimer(); onPause?.(); }
            const typeStr = String(type || '').toLowerCase();
            const isNextClick = [
                'next',
                'nextepisode',
                'vixsrc_next',
                'vidlink_next',
                'next_episode',
                'next_click'
            ].includes(typeStr);
            if (type === 'ended' || type === 'complete' || type === 'completed' || isNextClick) {
                console.log(`[EmbedPlayer] ⏩ Captured 'next' navigation event from iframe: "${type}"`);
                onEnded?.();
            }
            if (type === 'error') handleProviderError();
        };

        window.addEventListener('message', handler);
        return () => window.removeEventListener('message', handler);
    }, [onTimeUpdate, onPlay, onPause, onEnded, stopTimer, handleProviderError, estimatedDuration]);

    if (!currentProvider || activeProviderIndex >= ALL_EMBED_PROVIDERS.length) return null;

    const embedUrl = currentProvider.buildUrl({
        tmdbId,
        imdbId,
        mediaType,
        season,
        episode,
        startTime: lockedStartTime,
        subtitleLang: undefined
    });

    const hideNative = currentProvider.supportsControlsHide;

    // Smart high-res scaling factor: renders the iframe at a higher resolution
    // to make its internal UI elements (controls, menus, buttons) microscopic and sharp.
    // We use a safe scaling factor (2.2 for WebKit/Safari, 2.5 for others) to stay well
    // under GPU texture limits and prevent process crashes on iOS.
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    const isIOS = /iPad|iPhone|iPod/.test(ua) ||
        (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1 && /Macintosh/.test(ua));
    const isMac = /Macintosh|Mac OS X/.test(ua);
    const isIOSOrMac = isIOS || isMac;

    // TEMP: Set to true to temporarily pause scaling and zoom hacks
    const tempPauseScaling = true;

    const getHighResFactor = () => {
        if (tempPauseScaling) return 1;
        // Apply scaling factor to all providers to ensure any branding, logos, or unhidden controls are scaled down
        return isIOSOrMac ? 2 : 2;
    };
    const highResFactor = getHighResFactor();

    // Zoom factor: crops out the outer edges to hide native player controls and branding.
    // On non-Apple platforms, the high scale (4.5) already renders controls microscopic, 
    // allowing a gentler crop (1.25) to preserve the video frame.
    const defaultZoom = isIOSOrMac ? 1 : 1;
    const zoomFactor = tempPauseScaling ? 1 : (videoFit === 'cover'
        ? 1
        : defaultZoom);


    // Calculate the final scale to bring the high-res iframe back to the screen fit
    const totalScale = zoomFactor / highResFactor;

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
                    clipPath: 'inset(0% 0% 0% 0%)', // Hides the bottom 8% of the iframe to remove native controls
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

            {/* The Invisible Shield: captures all clicks to block ads and toggles play/pause */}
            <div
                className={`absolute inset-0 z-20 cursor-pointer embed-shield ${!supportsInbound ? 'pointer-events-none' : ''}`}
                onClick={(e) => {
                    if (!supportsInbound) return;
                    if (activePanel && activePanel !== 'none') {
                        // Let the click bubble up to the parent container to close the active settings panel!
                        return;
                    }
                    // Let the click bubble up to the parent VideoPlayer container to determine play/pause and UI visibility!
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