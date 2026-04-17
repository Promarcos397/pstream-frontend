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

/**
 * Solid Standalone HLS.js Manager Hook
 * Handles lifecycle, error recovery, quality switching, and audio tracks.
 * Auto-selects English audio immediately on MANIFEST_PARSED.
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
            const hlsConfig: Partial<Hls['config']> = {
                maxBufferLength: 30,
                maxMaxBufferLength: 60,
                enableWorker: true,
                startLevel: -1,
                manifestLoadingMaxRetry: 4,
                levelLoadingMaxRetry: 4,
            };

            // Inject Referer header on every XHR for IP/referer-locked CDNs (noProxy streams)
            if (streamReferer) {
                const referer = streamReferer;
                (hlsConfig as any).xhrSetup = (xhr: XMLHttpRequest) => {
                    // Note: setting Referer directly is blocked by browsers for security.
                    // We set it via a custom header — the CDN usually checks "Referer" or "Origin".
                    // For same-origin requests this won't be needed, but cross-origin CDNs
                    // that validate by token (not referer) will work fine without it.
                    xhr.setRequestHeader('X-Referer', referer);
                };
            }

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
                if (autoPlay) video.play().catch(err => console.warn('[useHls] Autoplay blocked:', err));
            });

            hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => {
                setCurrentQuality(data.level);
            });

            hls.on(Hls.Events.AUDIO_TRACK_SWITCHED, (_, data) => {
                setCurrentAudioTrack(data.id);
            });

            hls.on(Hls.Events.ERROR, (event, data) => {
                if (data.fatal) {
                    console.error('[useHls] Fatal HLS error:', data.type, data.details, (data as any)?.response?.code);

                    const statusCode = (data as any)?.response?.code || (data as any)?.response?.status;

                    switch (data.type) {
                        case Hls.ErrorTypes.NETWORK_ERROR:
                            // 403 on manifest or segments = token expired or IP blocked
                            if (statusCode === 403 || statusCode === 401) {
                                console.warn('[useHls] 403/401 — Token expired or IP blocked, triggering retry...');
                                if (onFatalError) onFatalError(data.type, data.details, statusCode);
                                if (onTokenExpired) onTokenExpired();
                                return;
                            }
                            console.log('[useHls] Network error, recovering...');
                            if (onFatalError) onFatalError(data.type, data.details, statusCode);
                            hls.startLoad();
                            break;

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
