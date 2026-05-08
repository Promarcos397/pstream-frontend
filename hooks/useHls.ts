import { useEffect, useRef, useState, useCallback } from 'react';
import Hls from 'hls.js';
import { streamCache } from '../utils/streamCache';

interface UseHlsOptions {
    streamUrl: string | null;
    isM3U8: boolean;
    autoPlay?: boolean;
    /** Referer to inject on all HLS XHR requests (needed for noProxy IP-locked streams) */
    streamReferer?: string | null;
    onManifestParsed?: () => void;
    onError?: (error: string) => void;
    onTokenExpired?: () => void;
    onMirrorSwitch?: () => void;
    /** Called when HLS fires a fatal, unrecoverable error. Use to report to health service. */
    onFatalError?: (type: string, details: string, statusCode?: number) => void;
}

export interface HlsQuality {
    height: number;
    bitrate: number;
    level: number;
}

export interface HlsAudioTrack {
    id: number;
    name: string;
    lang: string;
    isDefault: boolean;
}

export interface HlsSubtitleTrack {
    id: number;
    name: string;
    lang: string;
    url?: string;
    isDefault: boolean;
}

/**
 * Picks the best English audio track index from a list of HLS audio tracks.
 * Priority: explicit 'en' lang > name contains 'english' > default track > track 0.
 */
function pickEnglishTrackId(tracks: HlsAudioTrack[]): number {
    if (tracks.length === 0) return -1;
    const byLang = tracks.find(t => t.lang?.toLowerCase().startsWith('en'));
    if (byLang) return byLang.id;
    const byName = tracks.find(t => t.name?.toLowerCase().includes('english'));
    if (byName) return byName.id;
    const byDefault = tracks.find(t => t.isDefault);
    if (byDefault) return byDefault.id;
    return tracks[0].id;
}

/** Detect if current device is likely mobile/tablet for adaptive HLS config */
function isMobileDevice(): boolean {
    return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth < 768;
}

/**
 * Solid Standalone HLS.js Manager Hook
 * Handles lifecycle, error recovery, quality switching, and audio tracks.
 * Auto-selects English audio immediately on MANIFEST_PARSED.
 * Mobile-optimised: capLevelToPlayerSize, adaptive buffers, low start level.
 */
export const useHls = (videoRef: React.RefObject<HTMLVideoElement>, options: UseHlsOptions) => {
    const { streamUrl, isM3U8, autoPlay = true, streamReferer, onManifestParsed, onError, onTokenExpired, onFatalError } = options;
    const hlsRef = useRef<Hls | null>(null);
    const [qualityLevels, setQualityLevels] = useState<HlsQuality[]>([]);
    const [currentQuality, setCurrentQuality] = useState<number>(-1);
    const [audioTracks, setAudioTracks] = useState<HlsAudioTrack[]>([]);
    const [currentAudioTrack, setCurrentAudioTrack] = useState<number>(-1);
    const [subtitleTracks, setSubtitleTracks] = useState<HlsSubtitleTrack[]>([]);
    const [isBuffering, setIsBuffering] = useState(true);

    const destroyHls = useCallback(() => {
        if (hlsRef.current) {
            hlsRef.current.destroy();
            hlsRef.current = null;
        }
    }, []);

    useEffect(() => {
        const video = videoRef.current;
        if (!video || !streamUrl || !isM3U8) {
            if (streamUrl && !isM3U8) {
                // Handle MP4 playback
                video!.src = streamUrl;
                setIsBuffering(false);
                if (autoPlay) video!.play().catch(() => {});
            }
            return;
        }

        destroyHls();

        if (Hls.isSupported()) {
            const mobile = isMobileDevice();

            const hlsConfig: Partial<Hls['config']> = {
                // Buffer: shorter on mobile to reduce RAM usage and initial stall time
                maxBufferLength:    mobile ? 20 : 30,
                maxMaxBufferLength: mobile ? 40 : 60,
                backBufferLength:   mobile ? 15 : 30,

                enableWorker: true,
                lowLatencyMode: false,

                // Start at lowest quality and ramp up — critical for mobile/slow networks.
                // -1 (auto) starts at the highest quality causing initial stall on slow connections.
                startLevel: mobile ? 0 : -1,

                // Cap quality to the actual player pixel size — no point loading 1080p
                // on a 375px-wide phone screen. Massive bandwidth savings.
                capLevelToPlayerSize: true,

                // ABR: conservative default bandwidth estimate for mobile (2 Mbps),
                // speeds up quality ramp-up without overshooting on first fragments.
                abrEwmaDefaultEstimate: mobile ? 500_000 : 2_000_000,

                // Retry thresholds
                manifestLoadingMaxRetry: 4,
                levelLoadingMaxRetry:    4,
                fragLoadingMaxRetry:     3,
                fragLoadingRetryDelay:   1000,
            };

            // XHR setup: always disable credentials (prevents CORS preflight issues
            // with cross-origin CDN segments), optionally inject X-Referer header.
            const referer = streamReferer;
            const isBackendProxyStream = !!streamUrl && streamUrl.includes('/proxy/stream?url=');
            (hlsConfig as any).xhrSetup = (xhr: XMLHttpRequest) => {
                xhr.withCredentials = false;
                if (referer && isBackendProxyStream) {
                    // Browsers block setting 'Referer' directly — X-Referer is a
                    // best-effort hint for CDNs that check it (most don't on token URLs).
                    try { xhr.setRequestHeader('X-Referer', referer); } catch (_) {}
                }
            };

            const hls = new Hls(hlsConfig as any);

            // Disable native subtitle rendering — our custom VTT cue overlay is the
            // sole renderer. Without this, HLS.js also renders via <track> → double subs.
            // subtitleDisplay is an instance getter/setter, not a config option.
            hls.subtitleDisplay = false;

            hlsRef.current = hls;
            hls.loadSource(streamUrl);
            hls.attachMedia(video);

            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                setIsBuffering(false);

                // Extract Quality Levels
                if (hls.levels && hls.levels.length > 0) {
                    const levels = hls.levels.map((level, index) => ({
                        height: level.height || 0,
                        bitrate: level.bitrate || 0,
                        level: index
                    })).sort((a, b) => b.height - a.height);
                    setQualityLevels(levels);
                }

                // Extract Audio Tracks and immediately pick English
                if (hls.audioTracks && hls.audioTracks.length > 0) {
                    const tracks: HlsAudioTrack[] = hls.audioTracks.map((t, index) => ({
                        id: index,
                        name: t.name || t.lang || `Track ${index + 1}`,
                        lang: t.lang || '',
                        isDefault: !!t.default
                    }));
                    setAudioTracks(tracks);

                    // Auto-select English audio immediately, preventing foreign language playback
                    if (tracks.length > 1) {
                        const englishId = pickEnglishTrackId(tracks);
                        if (englishId !== -1 && englishId !== hls.audioTrack) {
                            console.log(`[useHls] Auto-switching to English audio (track ${englishId}: "${tracks[englishId]?.name ?? 'unknown'}")`);
                            hls.audioTrack = englishId;
                        }
                        setCurrentAudioTrack(englishId !== -1 ? englishId : hls.audioTrack);
                    } else {
                        setCurrentAudioTrack(hls.audioTrack);
                    }
                }

                // Extract embedded Subtitle Tracks
                if (hls.subtitleTracks && hls.subtitleTracks.length > 0) {
                    const tracks: HlsSubtitleTrack[] = hls.subtitleTracks.map((t, index) => ({
                        id: index,
                        name: t.name || t.lang || `Subtitle ${index + 1}`,
                        lang: t.lang || '',
                        url: t.url,
                        isDefault: !!t.default
                    }));
                    setSubtitleTracks(tracks);
                }

                if (onManifestParsed) onManifestParsed();
                if (autoPlay) {
                    // Small delay on mobile ensures the video element is ready
                    // after HLS attaches — prevents silent autoplay failures on iOS/Android
                    const delay = mobile ? 100 : 0;
                    setTimeout(() => video.play().catch(err => console.warn('[useHls] Autoplay blocked:', err)), delay);
                }
            });

            hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => {
                setCurrentQuality(data.level);
            });

            hls.on(Hls.Events.AUDIO_TRACK_SWITCHED, (_, data) => {
                setCurrentAudioTrack(data.id);
            });

            hls.on(Hls.Events.ERROR, (event, data) => {
                const statusCode = (data as any)?.response?.code || (data as any)?.response?.status;

                // Fast-fail: Don't wait for HLS.js to retry 4 times if the proxy returns 500 or 403 on manifest
                if (!data.fatal && data.type === Hls.ErrorTypes.NETWORK_ERROR) {
                    if (statusCode >= 400 && data.details === Hls.ErrorDetails.MANIFEST_LOAD_ERROR) {
                        console.warn(`[useHls] Fast-failing manifest HTTP ${statusCode} to skip retry wait...`);
                        data.fatal = true; // Upgrade to fatal to trigger immediate fallback
                    }
                }

                if (data.fatal) {
                    console.error('[useHls] Fatal HLS error:', data.type, data.details, statusCode);

                    switch (data.type) {
                        case Hls.ErrorTypes.NETWORK_ERROR: {
                            // 403/401 = token expired or IP blocked
                            if (statusCode === 403 || statusCode === 401) {
                                console.warn('[useHls] 403/401 — Token expired or IP blocked, triggering cache-bust retry...');
                                if (onFatalError) onFatalError(data.type, data.details, statusCode);
                                if (onTokenExpired) onTokenExpired();
                                return;
                            }
                            // 404 on manifest = URL dead (stale prefetch, rotated token, CDN purge)
                            // 'manifestLoadError' and 'fragLoadError' after HLS max retries are both fatal here.
                            // Treat them the same as 403: bust cache + ask backend for fresh URLs.
                            if (statusCode === 404 || data.details === Hls.ErrorDetails.MANIFEST_LOAD_ERROR || data.details === Hls.ErrorDetails.MANIFEST_PARSING_ERROR) {
                                console.warn(`[useHls] ${statusCode || data.details} — manifest dead, triggering cache-bust retry...`);
                                if (onFatalError) onFatalError(data.type, data.details, statusCode);
                                if (onTokenExpired) onTokenExpired();
                                return;
                            }
                            // Genuine network error (no status code = offline / timeout).
                            // IMPORTANT: status 0 on manifestLoadError = CORS block (no ACAO header).
                            // Don't retry the same blocked URL — treat it as dead and cycle sources.
                            if (!statusCode) {
                                // status 0 here means genuine offline/timeout (CORS+manifest case
                                // is already handled above via MANIFEST_LOAD_ERROR → return).
                                console.log('[useHls] Network blip (no status) — attempting HLS recovery...');
                                if (onFatalError) onFatalError(data.type, data.details, statusCode);
                                hls.startLoad();
                                break;
                            }
                            // Any other HTTP error (5xx gateway, etc.) — treat as dead URL
                            console.warn(`[useHls] HTTP ${statusCode} on stream — treating as dead URL, triggering retry...`);
                            if (onFatalError) onFatalError(data.type, data.details, statusCode);
                            if (onTokenExpired) onTokenExpired();
                            break;
                        }

                        case Hls.ErrorTypes.MEDIA_ERROR:
                            console.log('[useHls] Media error, recovering...');
                            hls.recoverMediaError();
                            break;

                        default:
                            if (onFatalError) onFatalError(data.type, data.details, statusCode);
                            if (onError) onError(`Unrecoverable playback error: ${data.details}`);
                            destroyHls();
                            break;
                    }
                }
            });

            return destroyHls;
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            // Safari / iOS Native HLS Support
            setIsBuffering(true);
            video.src = streamUrl;

            const onMetadata = () => {
                setIsBuffering(false);
                if (onManifestParsed) onManifestParsed();
                if (autoPlay) video.play().catch(() => {});
            };
            const onWaiting = () => setIsBuffering(true);
            const onPlaying = () => setIsBuffering(false);

            video.addEventListener('loadedmetadata', onMetadata);
            video.addEventListener('waiting', onWaiting);
            video.addEventListener('playing', onPlaying);

            return () => {
                video.removeEventListener('loadedmetadata', onMetadata);
                video.removeEventListener('waiting', onWaiting);
                video.removeEventListener('playing', onPlaying);
            };
        }

    }, [streamUrl, isM3U8, streamReferer, videoRef, autoPlay, destroyHls]);

    const changeQuality = useCallback((levelIndex: number) => {
        if (hlsRef.current) {
            hlsRef.current.currentLevel = levelIndex;
            setCurrentQuality(levelIndex);
        }
    }, []);

    const changeAudioTrack = useCallback((trackId: number) => {
        if (hlsRef.current) {
            hlsRef.current.audioTrack = trackId;
            setCurrentAudioTrack(trackId);
        }
    }, []);

    return {
        hls: hlsRef.current,
        isBuffering,
        qualityLevels,
        currentQuality,
        audioTracks,
        currentAudioTrack,
        subtitleTracks,
        changeQuality,
        changeAudioTrack
    };
};
