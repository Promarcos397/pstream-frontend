import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Movie, Episode, InternalTrack } from '../types';
import { MediaProbe } from '../utils/mediaProbe';
import { getSeasonDetails, getMovieDetails, getStream, getExternalIds } from '../services/api';
import ISO6391 from 'iso-639-1';
import { useGlobalContext } from '../context/GlobalContext';
import { useSubtitleStyle } from '../hooks/useSubtitleStyle';
import { useTitle } from '../context/TitleContext';
import { streamCache } from '../utils/streamCache';
import { useTouchGestures } from '../hooks/useTouchGestures';
import { useIsMobile } from '../hooks/useIsMobile';
import { SubtitleService } from '../services/SubtitleService';
import { useHls } from '../hooks/useHls';
import { reportStreamError, reportStreamSuccess } from '../services/ProviderHealthService';
import { useDebridStream, BROWSER_SAFE_AUDIO } from '../hooks/useDebridStream';
import { useAudioTranscoder, isAudioCodecSupported } from '../hooks/useAudioTranscoder';
import { useAudioSilenceDetector } from '../hooks/useAudioSilenceDetector';
import { useAudioSidecar } from '../hooks/useAudioSidecar';

// Giga Engine Backend URL
const GIGA_BACKEND_URL = import.meta.env.VITE_GIGA_BACKEND_URL || 'https://ibrahimar397-pstream-giga.hf.space';

// These CDN hosts can only be reached via proxy — they do NOT block datacenter IPs.
// VaPlayer/vidzee CDN domains rotate and block datacenter IPs, so they use noProxy:true
// (direct browser fetch) — do NOT add them here.
const FORCE_PROXY_HOST_PATTERNS: RegExp[] = [];
const RETRY_BASE_DELAY_MS = 1200;
const RETRY_MAX_DELAY_MS = 5000;
const SOURCE_FAILURE_COOLDOWN_MS = 20 * 1000;

function shouldForceProxy(source: any): boolean {
    const rawUrl = String(source?.url || '');
    try {
        const host = new URL(rawUrl).hostname;
        return FORCE_PROXY_HOST_PATTERNS.some((pattern) => pattern.test(host));
    } catch (_) {
        return false;
    }
}

// Child Components
import VideoPlayerControls from './VideoPlayerControls';
import VideoPlayerSettings from './VideoPlayerSettings';
import VideoPlayerSettingsTouch from './VideoPlayerSettingsTouch';

interface VideoPlayerProps {
    movie: Movie;
    season?: number;
    episode?: number;
    /** Seek to this time (seconds) when the video starts — restores watch progress */
    resumeTime?: number;
    onClose?: () => void;
}

/** Request landscape fullscreen on mobile/tablet. Works on Android Chrome and most WebKit. */
function requestMobileLandscapeFullscreen(el: HTMLElement) {
    const doc = document as any;
    const elem = el as any;
    try {
        if (elem.requestFullscreen) {
            elem.requestFullscreen().then(() => {
                if ((screen.orientation as any)?.lock) {
                    (screen.orientation as any).lock('landscape').catch(() => {});
                }
            }).catch(() => {});
        } else if (elem.webkitRequestFullscreen) {
            elem.webkitRequestFullscreen();
        } else if (elem.webkitEnterFullscreen) {
            // iPhone video element fallback
            elem.webkitEnterFullscreen();
        }
    } catch (e) {}
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ movie, season = 1, episode = 1, resumeTime = 0, onClose }) => {
    const { user, settings, updateEpisodeProgress, getEpisodeProgress, updateVideoState, addToHistory, getVideoState, setActiveVideoId } = useGlobalContext();
    const { setPageTitle } = useTitle();
    const isMobile = useIsMobile();
    const { overlayStyle, enabled: subsEnabled } = useSubtitleStyle();
    const videoRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
    const lastSavedTimeRef = useRef<number>(0);
    const hasAutoFullscreenedRef = useRef(false);
    const [bufferedAmount, setBufferedAmount] = useState<number>(0);

    // Player State
    const [isPlaying, setIsPlaying] = useState(false);
    const [isBuffering, setIsBuffering] = useState(true);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [progress, setProgress] = useState(0);
    const [volume, setVolume] = useState(() => {
        try {
            const stored = parseFloat(localStorage.getItem('pstream_vol') || '1');
            return isFinite(stored) && stored >= 0.05 && stored <= 1 ? stored : 1;
        } catch { return 1; }
    });
    const [isMuted, setIsMuted] = useState(false); // Always start unmuted; user mutes manually
    const [showUI, setShowUI] = useState(true);
    const showUIRef = useRef(true);
    useEffect(() => { showUIRef.current = showUI; }, [showUI]);

    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isPseudoFullscreen, setIsPseudoFullscreen] = useState(false);
    const [isVideoReady, setIsVideoReady] = useState(false); // gates subtitle rendering on first canplay
    const [videoFit, setVideoFit] = useState<'contain' | 'cover'>('contain');
    const hasPlayedOnceRef = useRef(false); // persists across subtitle track changes (unlike isVideoReady)
    const volumeRef = useRef((() => {
        try {
            const stored = parseFloat(localStorage.getItem('pstream_vol') || '1');
            return isFinite(stored) && stored >= 0.05 && stored <= 1 ? stored : 1;
        } catch { return 1; }
    })()); // latest volume — init from localStorage, kept in sync via onVolumeChange
    const mutedRef  = useRef(false); // tracks real-time element state
    const userMutedRef = useRef(false); // tracks explicit user intent (manual toggle)
    const [loadingMessage, setLoadingMessage] = useState('Finding stream...');
    const [streamUrl, setStreamUrl] = useState<string | null>(null);
    const [streamReferer, setStreamReferer] = useState<string | null>(null);
    const [allSources, setAllSources] = useState<any[]>([]);
    const [currentSourceIndex, setCurrentSourceIndex] = useState(0);
    const [isStreamM3U8, setIsStreamM3U8] = useState<boolean>(true);
    const [isEmbed, setIsEmbed] = useState<boolean>(false);
    // ——— Retry guard: max backend refetches per episode load ———————————————————————
    // Prevents the infinite 403 storm when a CDN IP-blocks the proxy.
    // After MAX_STREAM_RETRIES total backend re-fetches, show "no sources" error.
    const MAX_STREAM_RETRIES = 3;
    const retryCountRef = useRef(0);
    const [retryCount, setRetryCount] = useState(0);
    const retryCooldownUntilRef = useRef(0);
    const sourceFailureCooldownRef = useRef<Map<string, number>>(new Map());
    // Stores the current stream's cache key so the 403 handler can bust it
    const cacheKeyRef = useRef<import('../utils/streamCache').CacheKey | null>(null);
    const [error, setError] = useState<string | null>(null);
    const reportedSuccessRef = useRef<string | null>(null);
    const prefetchedNextEpsRef = useRef<Set<string>>(new Set());
    // Holds the pending error from the standard resolver; cleared if premium succeeds
    const standardErrorRef = useRef<string | null>(null);

    // ——— Torrent fallback ——————————————————————————————————————————————————————————
    // Triggered silently after MAX_STREAM_RETRIES, only for logged-in users.
    const debridStream = useDebridStream();
    const [premiumAttempted, setPremiumAttempted] = useState(false);

    // Internal tracks (MKV/MP4)
    const [internalTracks, setInternalTracks] = useState<InternalTrack[]>([]);
    const [selectedAudioTrackId, setSelectedAudioTrackId] = useState<number | null>(null);
    const [selectedSubtitleTrackId, setSelectedSubtitleTrackId] = useState<number | null>(null);
    const [transcodedAudioUrl, setTranscodedAudioUrl] = useState<string | null>(null);
    const transcodedAudioRef = useRef<HTMLAudioElement | null>(null);
    const transcodedCleanupRef = useRef<(() => void) | null>(null);

    const { transcode, status: transcodeStatus, progress: transcodeProgress } = useAudioTranscoder();

    // ── Audio Silence Detector ──────────────────────────────────────────────
    // Catches cases where video plays but no audio is heard (common for AC3 on Chrome).
    const { silenceDetected, dismiss: dismissSilence } = useAudioSilenceDetector(videoRef, !!streamUrl && !isEmbed);

    // ── Audio Sidecar (client-side AC3 decode) ─────────────────────────
    // When silence is detected, try to decode audio via WASM
    const audioSidecar = useAudioSidecar(videoRef, {
        onSyncLost: () => {
            // Drift is too high — VLC fallback is the best option
            console.warn('[VideoPlayer] Audio sync lost — recommending VLC fallback');
        }
    });

    // Start sidecar when silence is detected (AC3/DTS unsupported codec)
    useEffect(() => {
        if (silenceDetected && streamUrl && !isStreamM3U8 && !isEmbed) {
            console.log('[VideoPlayer] 🔊 Starting audio sidecar for AC3/DTS decode...');
            audioSidecar.start(streamUrl).catch(err => {
                console.warn('[VideoPlayer] Sidecar decode failed:', err);
            });
        } else if (!silenceDetected && audioSidecar.isActive) {
            audioSidecar.stop();
        }
    }, [silenceDetected, streamUrl]);

    useEffect(() => {
        if (silenceDetected) {
            console.warn('[VideoPlayer] ⚠️ Audio silence detected! This usually indicates an unsupported codec (AC3/DTS) on this browser.');
        }
    }, [silenceDetected]);

    // Route MKV through SW proxy — the SW probes the audio codec and streams without CORS issues.
    // Non-MKV URLs stay direct (HLS, MP4 from other sources).
    const activeStreamUrl = useMemo(() => streamUrl, [streamUrl]);

    // Detect likely audio codec from filename — instant, no network needed.
    // Most real-world torrent filenames include codec info (AAC, AC3, DTS, etc.)
    const guessedAudioCodec = useMemo((): 'aac' | 'ac3' | 'unknown' => {
        if (!streamUrl) return 'unknown';
        const name = decodeURIComponent(streamUrl).toLowerCase();
        if (name.includes('aac')) return 'aac';
        if (name.includes('web-dl') || name.includes('webrip') || name.includes('amzn') || name.includes('nf.') || name.includes('hbo') || name.includes('dsnp')) return 'aac';
        if (name.includes('ac3') || name.includes('dts') || name.includes('truehd') || name.includes('dd+') || name.includes('eac3')) return 'ac3';
        return 'unknown';
    }, [streamUrl]);

    useEffect(() => {
        if (streamUrl) {
            console.info(`[VideoPlayer] 🎬 New source loaded: ${new URL(streamUrl).hostname}`);
            console.info(`[VideoPlayer] 🔍 Guessed audio codec from filename: ${guessedAudioCodec.toUpperCase()}`);
        }
    }, [streamUrl, guessedAudioCodec]);

    // TV Show state
    const mediaType = movie.media_type || (movie.first_air_date ? 'tv' : 'movie');
    const [currentEpisode, setCurrentEpisode] = useState(episode);
    const [playingSeasonNumber, setPlayingSeasonNumber] = useState(season);
    const [browsedSeasonNumber, setBrowsedSeasonNumber] = useState(season || 1);
    const [ppRippleTrigger, setPpRippleTrigger] = useState(0);
    const [seekFlash, setSeekFlash] = useState<{ side: 'left' | 'right'; ts: number } | null>(null);
    const [seasonList, setSeasonList] = useState<number[]>([]);
    const [currentSeasonEpisodes, setCurrentSeasonEpisodes] = useState<Episode[]>([]);

    // Reset retry counter AND subtitle gate when episode/movie changes
    useEffect(() => {
        retryCountRef.current = 0;
        setRetryCount(0);
        retryCooldownUntilRef.current = 0;
        sourceFailureCooldownRef.current.clear();
        hasPlayedOnceRef.current = false; // force clean subtitle gate for new content
        reportedSuccessRef.current = null;
    }, [movie.id, mediaType, playingSeasonNumber, currentEpisode]);

    // ——— Fullscreen toggle —————————————————————————————————————————————————————————
    const toggleFullscreen = useCallback(() => {
        const el = containerRef.current as any;
        const doc = document as any;

        // On iPhone (where requestFullscreen on DIV often fails), we use Pseudo-Fullscreen
        const isIPhone = /iPhone/i.test(navigator.userAgent);
        
        if (isFullscreen || isPseudoFullscreen) {
            const hasFs = !!(doc.fullscreenElement || doc.webkitFullscreenElement || doc.msFullscreenElement);
            
            if (hasFs) {
                if (doc.exitFullscreen) doc.exitFullscreen().catch(() => {});
                else if (doc.webkitExitFullscreen) doc.webkitExitFullscreen();
                else if (doc.msExitFullscreen) doc.msExitFullscreen();
            }
            
            setIsFullscreen(false);
            setIsPseudoFullscreen(false);
            try { (screen.orientation as any)?.unlock?.(); } catch (e) {}
        } else {
            if (el?.requestFullscreen) {
                el.requestFullscreen().then(() => {
                    if ((screen.orientation as any)?.lock) (screen.orientation as any).lock('landscape').catch(() => {});
                }).catch(() => {});
            } else if (el?.webkitRequestFullscreen) {
                el.webkitRequestFullscreen();
            } else if (isIPhone) {
                // iPhone Fallback: Use Fixed position "Pseudo-Fullscreen" to keep our UI
                setIsPseudoFullscreen(true);
            } else if ((videoRef.current as any)?.webkitEnterFullscreen) {
                // Last resort: native video fullscreen
                (videoRef.current as any).webkitEnterFullscreen();
            }
            setIsFullscreen(true);
        }
    }, [isFullscreen, isPseudoFullscreen]);

    // ——— Track fullscreen state changes from browser ——————————————————————————————
    useEffect(() => {
        const handleFsChange = () => {
            const doc = document as any;
            setIsFullscreen(!!(doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement || doc.msFullscreenElement));
        };
        document.addEventListener('fullscreenchange', handleFsChange);
        document.addEventListener('webkitfullscreenchange', handleFsChange);
        document.addEventListener('mozfullscreenchange', handleFsChange);
        document.addEventListener('MSFullscreenChange', handleFsChange);
        return () => {
            document.removeEventListener('fullscreenchange', handleFsChange);
            document.removeEventListener('webkitfullscreenchange', handleFsChange);
            document.removeEventListener('mozfullscreenchange', handleFsChange);
            document.removeEventListener('MSFullscreenChange', handleFsChange);
        };
    }, []);

    // ——— URL deep-link sync ————————————————————————————————————————————————————————
    // Keep the address bar in sync so users can share/bookmark a specific episode.
    // Uses replaceState (not pushState) to avoid polluting browser history on every
    // episode switch. Movies don't need query params — their URL is already canonical.
    useEffect(() => {
        if (mediaType !== 'tv') return;
        const url = new URL(window.location.href);
        url.searchParams.set('season', String(playingSeasonNumber));
        url.searchParams.set('episode', String(currentEpisode));
        window.history.replaceState(null, '', url.toString());
    }, [mediaType, playingSeasonNumber, currentEpisode]);

    // Navigation state
    const [activePanel, setActivePanel] = useState<'none' | 'episodes' | 'seasons' | 'audioSubtitles' | 'quality' | 'servers' | 'playback'>('none');

    // Subtitles
    const [captions, setCaptions] = useState<{ id: string; label: string; url: string; lang: string }[]>([]);
    const [currentCaption, setCurrentCaption] = useState<string | null>(null);
    const [subtitleObjectUrl, setSubtitleObjectUrl] = useState<string | null>(null);
    // Subtitle offset in seconds: positive = show later, negative = show earlier
    const [subtitleOffset, setSubtitleOffset] = useState(0);
    // Dialogue subtitle state: tracks which side the last cue was on
    const speakerSideRef = useRef<'left' | 'right'>('right');
    const [subtitleSide, setSubtitleSide] = useState<'left' | 'center' | 'right'>('center');
    const prevCueRef = useRef<string>('');

    // Store Backdrop globally for Tooltip Previews
    useEffect(() => {
        const backdrop = movie.backdrop_path ? `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}` : '';
        (window as any).__video_backdrop = backdrop;
    }, [movie.id]);

    // ——— Compute next episode / season ————————————————————————————————————————————
    // Single canonical declaration — used by Media Session, auto-next trigger, and controls.
    const nextEpisodeInfo = useMemo<{ episode: Episode; season: number } | null>(() => {
        if (mediaType !== 'tv') return null;
        // Find current episode index within the loaded season episode list
        const currentIdx = currentSeasonEpisodes.findIndex(ep => ep.episode_number === currentEpisode);
        // Case 1: There is a next episode in this same season
        if (currentIdx !== -1 && currentIdx < currentSeasonEpisodes.length - 1) {
            return { episode: currentSeasonEpisodes[currentIdx + 1], season: playingSeasonNumber };
        }
        // Case 2: Last episode of the season — find the next season
        const nextSeason = seasonList.find(s => s > playingSeasonNumber);
        if (nextSeason !== undefined) {
            // Return a placeholder ep; the real list loads when the season is fetched
            return {
                episode: { id: -1, episode_number: 1, name: 'Next Season', season_number: nextSeason } as Episode,
                season: nextSeason,
            };
        }
        return null;
    }, [mediaType, currentSeasonEpisodes, currentEpisode, playingSeasonNumber, seasonList]);

    // ——— Media Session API —————————————————————————————————————————————————————————
    // Powers: Android notification, iOS lock screen, Windows media flyout, macOS Control Center
    useEffect(() => {
        if (!('mediaSession' in navigator)) return;

        const showTitle = movie.title || movie.name || '';
        const epName = currentSeasonEpisodes.find(ep => ep.episode_number === currentEpisode)?.name || '';

        // Match the title format used in the video player HUD exactly
        const notificationTitle = mediaType === 'tv'
            ? showTitle
            : showTitle;
        const notificationArtist = mediaType === 'tv' && epName
            ? `S${playingSeasonNumber} E${currentEpisode} — ${epName}`
            : (movie.release_date || movie.first_air_date || '').slice(0, 4) || 'Pstream';
        const notificationAlbum = mediaType === 'tv' ? `Season ${playingSeasonNumber}` : 'Movie';

        // Use TMDB backdrop for all platforms (wide 16:9 — best for notifications)
        const backdropUrl = movie.backdrop_path
            ? `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}`
            : '';

        const artwork: MediaImage[] = backdropUrl
            ? [
                { src: backdropUrl, sizes: '1280x720', type: 'image/jpeg' },
              ]
            : [];

        navigator.mediaSession.metadata = new MediaMetadata({
            title: notificationTitle,
            artist: notificationArtist,
            album: notificationAlbum,
            artwork,
        });

        // Wire OS controls to the actual video element
        const video = videoRef.current;
        if (!video) return;

        navigator.mediaSession.setActionHandler('play', () => { video.play(); });
        navigator.mediaSession.setActionHandler('pause', () => { video.pause(); });
        navigator.mediaSession.setActionHandler('seekbackward', (details) => {
            video.currentTime = Math.max(0, video.currentTime - (details.seekOffset || 10));
        });
        navigator.mediaSession.setActionHandler('seekforward', (details) => {
            video.currentTime = Math.min(video.duration, video.currentTime + (details.seekOffset || 10));
        });
        navigator.mediaSession.setActionHandler('seekto', (details) => {
            if (details.seekTime != null) video.currentTime = details.seekTime;
        });

        // Wire "next track" to the next episode handler if available
        if (mediaType === 'tv') {
            navigator.mediaSession.setActionHandler('nexttrack', () => {
                if (nextEpisodeInfo) {
                    const ep = nextEpisodeInfo.episode;
                    setCurrentEpisode(ep.episode_number);
                    if (nextEpisodeInfo.season !== playingSeasonNumber) {
                        setPlayingSeasonNumber(nextEpisodeInfo.season);
                    }
                    setStreamUrl(null);
                    setIsBuffering(true);
                    setActivePanel('none');
                }
            });
        } else {
            navigator.mediaSession.setActionHandler('nexttrack', null);
        }
        navigator.mediaSession.setActionHandler('previoustrack', null);

        // Sync position state so the OS scrubber knows the duration
        const syncPosition = () => {
            if (!video.duration || isNaN(video.duration)) return;
            try {
                navigator.mediaSession.setPositionState({
                    duration: video.duration,
                    playbackRate: video.playbackRate,
                    position: video.currentTime,
                });
            } catch (_) {}
        };
        video.addEventListener('timeupdate', syncPosition);
        return () => { video.removeEventListener('timeupdate', syncPosition); };
    }, [movie, mediaType, playingSeasonNumber, currentEpisode, currentSeasonEpisodes, nextEpisodeInfo]);

    const [currentCueText, setCurrentCueText] = useState<string>('');

    // HLS state (from hook)
    const [qualityLevels, setQualityLevels] = useState<{ height: number; bitrate: number; level: number }[]>([]);
    const [currentQualityLevel, setCurrentQualityLevel] = useState<number>(-1);
    const [audioTracks, setAudioTracks] = useState<{ id: number; name: string; lang: string }[]>([]);
    const [currentAudioTrack, setCurrentAudioTrack] = useState<number>(-1);


    // Derived data
    const title = movie.title || movie.name || '';
    const formattedDate = movie.release_date || movie.first_air_date || '';
    const currentEpisodeName = currentSeasonEpisodes.find(ep => ep.episode_number === currentEpisode)?.name || '';

    // ——— Touch gestures ————————————————————————————————————————————————————————————
    // Double-tap left/right = ±10s seek; double-tap center = play/pause
    useTouchGestures(containerRef, {
        onDoubleTapLeft: () => { 
            lastTouchTimeRef.current = Date.now();
            if (videoRef.current) videoRef.current.currentTime -= 10; 
        },
        onDoubleTapRight: () => { 
            lastTouchTimeRef.current = Date.now();
            if (videoRef.current) videoRef.current.currentTime += 10; 
        },
        onSwipeLeft: (distance) => {
            lastTouchTimeRef.current = Date.now();
            if (videoRef.current) videoRef.current.currentTime -= Math.min(60, Math.round(distance / 10));
            showControls();
        },
        onSwipeRight: (distance) => {
            lastTouchTimeRef.current = Date.now();
            if (videoRef.current) videoRef.current.currentTime += Math.min(60, Math.round(distance / 10));
            showControls();
        },
        onSingleTap: () => { 
            lastTouchTimeRef.current = Date.now();
            if (activePanel !== 'none') {
                setActivePanel('none');
                return;
            }
            if (showUIRef.current) {
                setShowUI(false);
                if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
            } else {
                showControls();
            }
        },
    });

    // ——— Apply stream result ———————————————————————————————————————————————————————
    const applyStreamResult = useCallback((sources: any[], subtitles: any[], globalReferer?: string | null) => {
        if (!sources || sources.length === 0) return;
        setError(null);

        // "Torrent Preferred Always" — If premium already landed, prepend it to the list
        let finalSources = [...sources];
        if (debridStream.streamUrl) {
            const premiumSource = {
                url:        debridStream.streamUrl,
                quality:    debridStream.quality || 'auto',
                isM3U8:     false,
                isEmbed:    false,
                noProxy:    false,
                provider:   'Premium Server',
                providerId: 'premium',
                referer:    '',
                origin:     '',
                headers:    {},
                _type:      'mp4',
            };
            const alreadyHasPremium = finalSources.some(s => s.providerId === 'premium');
            if (!alreadyHasPremium) {
                finalSources = [premiumSource, ...finalSources];
            }
        }

        setAllSources(finalSources);

        // "Torrent Preferred Always" — If we are already playing a premium source,
        // don't let regular scrapers auto-switch and interrupt the experience.
        const currentSource = allSources[currentSourceIndex];
        if (currentSource?.providerId === 'premium' && !isBuffering) {
            console.log('[VideoPlayer] 💎 Premium stream active. Ignoring regular scraper result.');
            return;
        }

        // Skip any sources that are in the failure cooldown from a previous attempt.
        // Without this, a cache-bust re-fetch that returns the same dead URL gets tried again immediately.
        let startIndex = 0;
        for (let i = 0; i < sources.length; i++) {
            const candidate = sources[i];
            const sourceKey = `${candidate.providerId || candidate.provider || 'unknown'}::${candidate.url || ''}`;
            const blockedUntil = sourceFailureCooldownRef.current.get(sourceKey) || 0;
            if (blockedUntil <= Date.now()) {
                startIndex = i;
                break;
            }
            // All sources are in cooldown — use the one whose cooldown expires soonest
            if (i === sources.length - 1) {
                console.warn('[VideoPlayer] All fresh sources are in cooldown — clearing cooldowns and retrying from 0');
                sourceFailureCooldownRef.current.clear();
                startIndex = 0;
            }
        }
        if (startIndex > 0) {
            console.log(`[VideoPlayer] ⚠️ Skipping ${startIndex} cooldown source(s), starting at index ${startIndex}`);
        }
        setCurrentSourceIndex(startIndex);
        const hlsSource = sources[startIndex];
        const isEmbedFallback = !!hlsSource.isEmbed;
        setIsEmbed(isEmbedFallback);

        const activeReferer = hlsSource.referer || globalReferer || '';
        let finalUrl = hlsSource.url;
        const forceProxy = shouldForceProxy(hlsSource);

        if (!isEmbedFallback) {
            if (hlsSource.directManifest) {
                const blob = new Blob([hlsSource.directManifest], { type: 'application/vnd.apple.mpegurl' });
                finalUrl = URL.createObjectURL(blob);
            } else if (hlsSource.noProxy && !forceProxy) {
                // noProxy: send URL directly to HLS.js (CDN is IP-locked — browser fetch works, server proxy fails)
                finalUrl = hlsSource.url;
                console.log(`[VideoPlayer] ⚡ Direct (no-proxy) stream: ${finalUrl.substring(0, 60)}...`);
            } else {
                let origin = '';
                try {
                    const refUrl = activeReferer.startsWith('//') ? `https:${activeReferer}` : activeReferer;
                    origin = refUrl ? new URL(refUrl).origin : '';
                } catch (e) {}
                const headersObj = { referer: activeReferer, origin };
                finalUrl = `${GIGA_BACKEND_URL}/proxy/stream?url=${encodeURIComponent(hlsSource.url)}&headers=${encodeURIComponent(JSON.stringify(headersObj))}`;
            }
        }

        setStreamUrl(finalUrl);
        setIsStreamM3U8(!!hlsSource.isM3U8);
        setStreamReferer(activeReferer || null);
        setLoadingMessage('Initializing...');

        if (subtitles && subtitles.length > 0) {
            const mappedCaptions = subtitles.map((sub: any, index: number) => ({
                id: `sub-${index}`,
                label: ISO6391.getName((sub.lang || 'en').toLowerCase().split('-')[0]) || sub.label || sub.lang || `Subtitle ${index + 1}`,
                url: sub.url,
                lang: (sub.lang || 'en').toLowerCase().split('-')[0]
            }));
            setCaptions(mappedCaptions);

            const preferredLang = settings.subtitleLanguage?.toLowerCase() || 'en';
            
            // New logic: If user is Guest (!user) or prefers English, target the 3rd English track.
            const isEnglishTarget = (!user && preferredLang === 'en') || preferredLang === 'en' || !user;
            
            let finalSub = null;
            if (isEnglishTarget) {
                const enSubs = mappedCaptions.filter((s: any) => s.lang === 'en' || s.label.toLowerCase().includes('english'));
                // Target the 3rd track (index 2) as requested, else fallback to 1st.
                finalSub = enSubs.length >= 3 ? enSubs[2] : (enSubs[0] || mappedCaptions[0]);
            } else {
                // Logged in and prefers a different language.
                finalSub = mappedCaptions.find((s: any) => s.lang.includes(preferredLang) || s.label.toLowerCase().includes(preferredLang));
                // Fallback to 3rd English if preferred isn't found.
                if (!finalSub) {
                    const enSubs = mappedCaptions.filter((s: any) => s.lang === 'en' || s.label.toLowerCase().includes('english'));
                    finalSub = enSubs.length >= 3 ? enSubs[2] : (enSubs[0] || mappedCaptions[0]);
                }
            }

            if (finalSub && settings.showSubtitles) {
                setCurrentCaption(finalSub.url);
            }
        }

        if (isEmbedFallback) {
            setTimeout(() => setIsBuffering(false), 500);
        }
    }, [settings.subtitleLanguage, settings.showSubtitles, debridStream.streamUrl, debridStream.quality]);

    // ——— Manual source change ——————————————————————————————————————————————————————
    const handleSourceChange = useCallback((index: number) => {
        if (!allSources[index]) return;
        const candidate = allSources[index];
        const sourceKey = `${candidate.providerId || candidate.provider || 'unknown'}::${candidate.url || ''}`;
        const blockedUntil = sourceFailureCooldownRef.current.get(sourceKey) || 0;
        if (blockedUntil > Date.now()) {
            const nextIndex = index + 1;
            if (allSources[nextIndex]) {
                handleSourceChange(nextIndex);
            }
            return;
        }
        console.log(`[VideoPlayer] 🔄 Manual server change to: ${candidate.provider}`);
        setCurrentSourceIndex(index);
        retryCooldownUntilRef.current = 0;
        setError(null);
        setIsBuffering(true);
        setLoadingMessage('Switching source...');
        reportedSuccessRef.current = null;

        const isEmbedFallback = !!candidate.isEmbed;
        setIsEmbed(isEmbedFallback);
        const activeReferer = candidate.referer || '';
        const forceProxy = shouldForceProxy(candidate);
        let finalUrl = candidate.url;
        if (!isEmbedFallback) {
            if (candidate.noProxy && !forceProxy) {
                finalUrl = candidate.url;
                console.log(`[VideoPlayer] ⚡ Direct (no-proxy) stream: ${finalUrl.substring(0, 60)}...`);
            } else {
                let origin = '';
                try {
                    const refUrl = activeReferer.startsWith('//') ? `https:${activeReferer}` : activeReferer;
                    origin = refUrl ? new URL(refUrl).origin : '';
                } catch (e) {}
                const headersObj = { referer: activeReferer, origin };
                finalUrl = `${GIGA_BACKEND_URL}/proxy/stream?url=${encodeURIComponent(candidate.url)}&headers=${encodeURIComponent(JSON.stringify(headersObj))}`;
            }
        }
        setStreamUrl(finalUrl);
        setIsStreamM3U8(!!candidate.isM3U8);
        setStreamReferer(activeReferer || null);
        if (isEmbedFallback) setTimeout(() => setIsBuffering(false), 500);
    }, [allSources]);

    // ————————————————————————————————————————————————————————————————————————————————————————————————————
    const handleEpisodeSelect = useCallback(async (ep: Episode, seasonNum?: number, episodes?: Episode[]) => {
        setStreamUrl(null);
        setIsBuffering(true);
        setActivePanel('none');
        // Always sync season: prefer explicit seasonNum, then ep.season_number
        const targetSeason = seasonNum ?? ep.season_number;
        if (targetSeason && targetSeason !== playingSeasonNumber) {
            setPlayingSeasonNumber(targetSeason);
            setBrowsedSeasonNumber(targetSeason);
            // Load the new season's episode list so nextEpisodeInfo stays accurate
            getSeasonDetails(String(movie.id), targetSeason).then(data => {
                if (data?.episodes) setCurrentSeasonEpisodes(data.episodes);
            }).catch(() => {});
        }
        if (episodes) setCurrentSeasonEpisodes(episodes);
        setCurrentEpisode(ep.episode_number);
    }, [playingSeasonNumber, movie.id]);

    // Pass the target season explicitly so cross-season transitions always update season state
    const handleNextEpisode = useCallback(() => {
        if (!nextEpisodeInfo) return;
        handleEpisodeSelect(nextEpisodeInfo.episode, nextEpisodeInfo.season);
    }, [nextEpisodeInfo, handleEpisodeSelect]);

    // ——— Track episode/season prop changes ——————————————————————————————————————————
    useEffect(() => {
        if (season !== playingSeasonNumber) setPlayingSeasonNumber(season);
        if (episode !== currentEpisode) setCurrentEpisode(episode);
    }, [season, episode]);

    // ——— Keyboard shortcuts ————————————————————————————————————————————————————————
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (activePanel !== 'none') return;
            switch (e.key) {
                case 'Escape':
                    e.preventDefault();
                    if (isFullscreen || isPseudoFullscreen) {
                        toggleFullscreen();
                    } else if (onClose) {
                        onClose();
                    }
                    break;
                case ' ':
                case 'k':
                    e.preventDefault();
                    if (videoRef.current) {
                        videoRef.current.paused ? videoRef.current.play() : videoRef.current.pause();
                        setPpRippleTrigger(t => t + 1);
                        showControls();
                    }
                    break;
                case 'ArrowRight':
                case 'l':
                    e.preventDefault();
                    if (videoRef.current) {
                        videoRef.current.currentTime += 10;
                        setSeekFlash({ side: 'right', ts: Date.now() });
                        setTimeout(() => setSeekFlash(null), 450);
                        showControls();
                    }
                    break;
                case 'ArrowLeft':
                case 'j':
                    e.preventDefault();
                    if (videoRef.current) {
                        videoRef.current.currentTime -= 10;
                        setSeekFlash({ side: 'left', ts: Date.now() });
                        setTimeout(() => setSeekFlash(null), 450);
                        showControls();
                    }
                    break;
                case 'ArrowUp':
                case 'ArrowDown':
                    e.preventDefault();
                    if (videoRef.current) {
                        videoRef.current.volume = Math.max(0, videoRef.current.volume - 0.1);
                    }
                    break;
                case 'f':
                    e.preventDefault();
                    toggleFullscreen();
                    break;
                case 'm':
                    e.preventDefault();
                    if (videoRef.current) {
                        videoRef.current.muted = !videoRef.current.muted;
                    }
                    break;
                case 'n':
                    if (nextEpisodeInfo) { e.preventDefault(); handleNextEpisode(); }
                    break;
                case 's':
                    // Toggle subtitles on/off (cycle through available or disable)
                    e.preventDefault();
                    if (currentCaption) {
                        setCurrentCaption(null);
                    } else if (captions.length > 0) {
                        // Re-select the preferred language
                        const preferred = captions.find(c => c.lang === 'en' || c.label.toLowerCase().includes('english')) || captions[0];
                        setCurrentCaption(preferred.url);
                    }
                    break;
            }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [onClose, activePanel, nextEpisodeInfo, handleNextEpisode, isFullscreen, isPseudoFullscreen, toggleFullscreen]);

    // ——— AllDebrid / Torrent: Primary Source ——————————————————————————————————————
    // Fires immediately on mount. Extractors only activate if this fails.
    const [extractorEnabled, setExtractorEnabled] = useState(false);

    // Reset everything when content changes
    useEffect(() => {
        standardErrorRef.current = null;
        setExtractorEnabled(false);
        debridStream.reset();
        setIsBuffering(true);
        setError(null);
        setStreamUrl(null);
        setAllSources([]);
        setCurrentSourceIndex(0);
        setLoadingMessage('Locating stream...');
        // Wipe subtitles from the previous episode/movie
        setCaptions([]);
        setCurrentCaption(null);
        setPremiumAttempted(false);
        // Reset playback ref so the initial-load overlay shows again for the new episode
        hasPlayedOnceRef.current = false;
        // Reset time display immediately — don't let the old episode's progress show on the new one
        setCurrentTime(0);
        setDuration(0);
        setProgress(0);
        setBufferedAmount(0);
    }, [movie.id, mediaType, playingSeasonNumber, currentEpisode]);

    // Restore audio after stream URL change.
    // Browsers may auto-mute videos played via programmatic play() without a direct user gesture.
    // Listening on 'playing' (not 'canplay') guarantees the browser has committed to playback.
    useEffect(() => {
        const video = videoRef.current;
        if (!video || !streamUrl) return;

        const restoreAudio = () => {
            if (volumeRef.current > 0) video.volume = volumeRef.current;
            // CRITICAL: Only stay muted if the user EXPLICITLY chose to mute.
            // If the browser auto-muted (userMutedRef is false), force-unmute now.
            if (!userMutedRef.current) {
                video.muted = false;
                console.log('[VideoPlayer] 🔊 Overriding browser auto-mute');
            }
            // Sync state back from the real element
            setVolume(video.volume);
            setIsMuted(video.muted);
        };

        video.addEventListener('playing', restoreAudio, { once: true });
        return () => video.removeEventListener('playing', restoreAudio);
    }, [streamUrl]);

    // Fire torrent resolver on mount
    useEffect(() => {
        const type: 'movie' | 'tv' = mediaType === 'tv' ? 'tv' : 'movie';
        const searchTitle = movie.title || movie.name || '';
        console.log(`[VideoPlayer] 🎯 AllDebrid resolver: ${searchTitle} (${type})`);

        const slowTimer  = setTimeout(() => setLoadingMessage('Establishing connection...'), 6000);
        const slowerTimer = setTimeout(() => setLoadingMessage('Preparing playback...'), 14000);

        const doResolve = (imdbId: string) => {
            debridStream.resolve(
                imdbId,
                type,
                mediaType === 'tv' ? playingSeasonNumber : undefined,
                mediaType === 'tv' ? currentEpisode : undefined,
                searchTitle,
                String(movie.id)
            ).then(result => {
                clearTimeout(slowTimer);
                clearTimeout(slowerTimer);
                if (!result) {
                    // AllDebrid couldn't find it — fall back to extractors
                    console.log('[VideoPlayer] AllDebrid: no result — activating extractor fallback.');
                    setExtractorEnabled(true);
                }
            });
        };

        if (movie.imdb_id) {
            doResolve(movie.imdb_id);
        } else {
            getExternalIds(movie.id, type)
                .then((ext: any) => ext?.imdb_id || '')
                .catch(() => '')
                .then(doResolve);
        }

        return () => { clearTimeout(slowTimer); clearTimeout(slowerTimer); };
    }, [movie.id, mediaType, playingSeasonNumber, currentEpisode]);

    // Apply AllDebrid stream when resolved
    useEffect(() => {
        if (!debridStream.streamUrl) return;

        setError(null);
        standardErrorRef.current = null;

        const debridSources = (debridStream as any).alternatives?.map((alt: any, idx: number) => {
            const name = alt.name || '';
            const ext = name.toLowerCase().endsWith('.mkv') ? 'mkv' : 
                        name.toLowerCase().endsWith('.webm') ? 'webm' : 
                        name.toLowerCase().endsWith('.avi') ? 'avi' : 'mp4';
            
            // Extract a cleaner display name from the torrent name
            const displayName = name.split('/').pop() || name;

            return {
                url:        alt.url,
                name:       displayName,
                quality:    alt.quality || 'auto',
                isM3U8:     false,
                isEmbed:    false,
                noProxy:    true,
                provider:   idx === 0 ? 'Premium Server (Best)' : `Premium Alt ${idx + 1}`,
                providerId: `torrent-${idx}`,
                referer:    '',
                origin:     '',
                headers:    {},
                _type:      ext,
                _audio:     alt._audio || 'unknown',
            };
        }) || [{
            url:        debridStream.streamUrl,
            name:       debridStream.name || 'Torrent Stream',
            quality:    debridStream.quality || 'auto',
            isM3U8:     false,
            isEmbed:    false,
            noProxy:    true,
            provider:   'Premium Server',
            providerId: 'torrent-0',
            referer:    '',
            origin:     '',
            headers:    {},
            _type:      (debridStream.name || '').toLowerCase().endsWith('.mkv') ? 'mkv' : 'mp4',
            _audio:     'unknown',
        }];

        // ── Source Manifest Log (for filename pattern study) ──────────────────
        try {
            const label = `${movie.title || movie.name || 'Unknown'}${mediaType === 'tv' ? ` S${playingSeasonNumber}E${currentEpisode}` : ''}`;
            console.groupCollapsed(`📦 SOURCE MANIFEST — ${label} (${debridSources.length} sources)`);
            console.table(
                debridSources.map((s: any, i: number) => {
                    const rawName = (debridStream as any).alternatives?.[i]?.name || s.name || '';
                    const filename = rawName.split('/').pop() || rawName;
                    return {
                        '#':        i + 1,
                        'filename': filename,
                        'ext':      s._type || '?',
                        'quality':  s.quality || '?',
                        'provider': s.provider || '?',
                        'url':      s.url?.substring(0, 80) + (s.url?.length > 80 ? '…' : ''),
                    };
                })
            );
            console.groupEnd();
        } catch (_) {}

        // Torrent is preferred always:
        // Prepend to allSources so it appears first in manual source list too.
        setAllSources(prev => {
            const filtered = prev.filter(s => !s.providerId?.startsWith('torrent'));
            return [...debridSources, ...filtered];
        });

        // Always switch to it — use functional update to avoid stale streamUrl closure
        setStreamUrl(prev => {
            const bestUrl = debridSources[0].url;
            if (prev === bestUrl) return prev;
            setLoadingMessage('Source found! Preparing...');
            setCurrentSourceIndex(0);
            setIsStreamM3U8(false);
            setIsBuffering(true);
            return bestUrl;
        });
    }, [debridStream.streamUrl, (debridStream as any).alternatives]);

    // Internal MKV/MP4 track probing — skip for Debrid (IP blocked) but run for others
    useEffect(() => {
        if (!streamUrl || isStreamM3U8 || isEmbed) {
            setInternalTracks([]);
            setSelectedAudioTrackId(null);
            setSelectedSubtitleTrackId(null);
            setTranscodedAudioUrl(null);
            return;
        }

        // Debrid URLs are blocked by the backend (503), so we can't probe them.
        const isDebrid = streamUrl.includes('.debrid.it') || streamUrl.includes('.alldebrid.com');
        if (isDebrid) {
            setInternalTracks([]);
            setTranscodedAudioUrl(null);
            return;
        }

        const controller = new AbortController();

        const probe = async () => {
            try {
                const tracks = await MediaProbe.probe(streamUrl);
                if (controller.signal.aborted) return;

                if (tracks && tracks.length > 0) {
                    console.log('[VideoPlayer] 🎵 Internal tracks:', tracks.map(t => `${t.type}:${t.codec}(${t.language || '?'})`).join(', '));
                    setInternalTracks(tracks);

                    // Auto-select default audio track
                    const defAudio = tracks.find(t => t.type === 'audio' && t.isDefault) ?? tracks.find(t => t.type === 'audio');
                    if (defAudio) {
                        setSelectedAudioTrackId(defAudio.id);

                        // Transcode if unsupported (standard extractors often support CORS or we proxy them)
                        if (!isAudioCodecSupported(defAudio.codec)) {
                            console.log(`[VideoPlayer] 🔄 Unsupported codec ${defAudio.codec} — transcoding via ffmpeg.wasm`);
                            const trackIndex = tracks.filter(t => t.type === 'audio').indexOf(defAudio);
                            const result = await transcode(streamUrl, trackIndex);
                            if (!controller.signal.aborted) {
                                transcodedCleanupRef.current?.();
                                transcodedCleanupRef.current = result.cleanup;
                                setTranscodedAudioUrl(result.url);
                            } else {
                                result.cleanup();
                            }
                        }
                    }
                }
            } catch (e) {
                console.warn('[VideoPlayer] Probe/Transcode failed:', e);
            }
        };

        probe();
        return () => {
            controller.abort();
            transcodedCleanupRef.current?.();
            transcodedCleanupRef.current = null;
        };
    }, [streamUrl, isStreamM3U8, isEmbed]);

    // ── MKV Audio Safety Fallback (Debrid only) ──────────────────────────────
    // Since we can't probe Debrid URLs directly via the browser, we rely on the
    // proxy probe in useDebridStream. If that failed, we just log a warning.
    useEffect(() => {
        if (!streamUrl || isStreamM3U8 || isEmbed) return;
        
        const currentSource = allSources[currentSourceIndex];
        const isDebrid = streamUrl.includes('.debrid.it') || streamUrl.includes('.alldebrid.com');
        if (!isDebrid) return;
        
        const isMkv = streamUrl.toLowerCase().includes('.mkv');
        if (isMkv && (!currentSource?._audio || currentSource._audio === 'unknown')) {
            console.log('[VideoPlayer] ℹ️ Debrid MKV with unknown audio. If silent, use the source selector to pick a WEB-DL/AAC alternative.');
        }
    }, [streamUrl, isStreamM3U8, isEmbed, currentSourceIndex, allSources]);

    // ── External subtitles for AllDebrid streams ─────────────────────────────────
    // Torrent/MKV files have no embedded subtitle streams in the HTTP response,
    // so we fetch from OpenSubtitles whenever the debrid URL is resolved.
    useEffect(() => {
        if (!debridStream.streamUrl) return;
        let cancelled = false;

        const type: 'movie' | 'tv' = mediaType === 'tv' ? 'tv' : 'movie';
        const preferredLang = settings.subtitleLanguage?.toLowerCase() || 'en';

        const debridSubs = (debridStream as any).subtitles || [];

        SubtitleService.getSubtitleTracks(
            String(movie.id), type,
            mediaType === 'tv' ? playingSeasonNumber : undefined,
            mediaType === 'tv' ? currentEpisode : undefined,
            preferredLang
        ).then(tracks => {
            if (cancelled) return;

            // Merge debridSubs and tracks, deduplicating by URL
            const combined = [...debridSubs];
            for (const t of tracks) {
                if (!combined.some(c => c.url === t.url)) {
                    combined.push(t);
                }
            }

            if (!combined.length) return;

            const mappedCaptions = combined.map((sub, idx) => ({
                id: `sub-ext-${idx}`,
                label: sub.label,
                url: sub.url,
                lang: sub.lang,
            }));

            setCaptions(prev => {
                // If we already have HLS/Embedded captions, keep them but append these
                const existingUrls = new Set(prev.map(p => p.url));
                const newOnes = mappedCaptions.filter(m => !existingUrls.has(m.url));
                return [...prev, ...newOnes];
            });

            if (!settings.showSubtitles) return;

            // Pick: preferred lang → 3rd English (avoids SDH/CC) → 1st English → anything
            const enTracks = mappedCaptions.filter(s => s.lang === 'en');
            const target = mappedCaptions.find(s => s.lang === preferredLang)
                || enTracks[2] || enTracks[0]
                || mappedCaptions[0];

            if (target) setCurrentCaption(target.url);
        }).catch(() => {});

        return () => { cancelled = true; };
    }, [debridStream.streamUrl, (debridStream as any).subtitles, movie.id, mediaType, playingSeasonNumber, currentEpisode,
        settings.subtitleLanguage, settings.showSubtitles]);

    // ——— HLS Hook ——————————————————————————————————————————————————————————————————
    const {
        isBuffering: hlsBuffering,
        qualityLevels: hlsLevels,
        currentQuality: hlsQuality,
        audioTracks: hlsAudios,
        currentAudioTrack: hlsAudio,
        subtitleTracks: hlsSubtitles,
        changeQuality,
        changeAudioTrack
    } = useHls(videoRef, {
        streamUrl: activeStreamUrl,
        isM3U8: isStreamM3U8 && !activeStreamUrl?.startsWith('/sw-proxy'),
        autoPlay: settings.autoplayVideo,
        streamReferer: streamReferer,
        preferredAudioLanguage: settings.audioLanguage,
        onManifestParsed: () => {
            const video = videoRef.current;
            if (video) {
                const saved = mediaType === 'tv'
                    ? getEpisodeProgress(movie.id, playingSeasonNumber, currentEpisode)
                    : getVideoState(movie.id);
                if (saved?.time > 10 && saved.time < (video.duration - 30)) {
                    video.currentTime = saved.time;
                }
            }
            // Auto fullscreen on mobile — only on first load
            if (isMobile && !hasAutoFullscreenedRef.current && containerRef.current) {
                hasAutoFullscreenedRef.current = true;
                requestMobileLandscapeFullscreen(containerRef.current);
            }
        },
        onTokenExpired: () => {
            const activeSource = allSources[currentSourceIndex];
            const activeProvider = activeSource?.provider || 'unknown';
            const activeProviderId = activeSource?.providerId;
            const activeUrl = activeSource?.url || '';

            // Torrent/AllDebrid stream — never retry on 403, CDN errors are transient
            if (activeProviderId === 'torrent') {
                console.warn('[VideoPlayer] 403 on AllDebrid stream — ignoring.');
                return;
            }

            const failedSourceKey = `${activeProviderId || activeProvider}::${activeUrl}`;
            sourceFailureCooldownRef.current.set(failedSourceKey, Date.now() + SOURCE_FAILURE_COOLDOWN_MS);
            reportStreamError({
                provider: activeProvider,
                providerId: activeProviderId,
                tmdbId: String(movie.id || ''),
                type: mediaType === 'tv' ? 'tv' : 'movie',
                season: playingSeasonNumber,
                episode: currentEpisode,
                error: 'token-expired-or-ip-blocked',
                errorCode: 'HLS_TOKEN_EXPIRED'
            });
            // 403/401: First try cycling to next source in the current source list.
            // Only fall back to a full backend re-fetch if we've exhausted all sources.
            const nextIdx = currentSourceIndex + 1;
            if (allSources[nextIdx]) {
                console.log(`[VideoPlayer] 🔄 403 on source ${currentSourceIndex} → trying source ${nextIdx}`);
                handleSourceChange(nextIdx);
            } else if (retryCountRef.current < MAX_STREAM_RETRIES) {
                if (Date.now() < retryCooldownUntilRef.current) {
                    console.log('[VideoPlayer] 🕗 Retry cooldown active — waiting before backend re-fetch.');
                    return;
                }
                retryCountRef.current += 1;
                const exponentialDelay = Math.min(RETRY_BASE_DELAY_MS * (2 ** (retryCountRef.current - 1)), RETRY_MAX_DELAY_MS);
                const jitter = Math.floor(Math.random() * 400);
                const waitMs = exponentialDelay + jitter;
                retryCooldownUntilRef.current = Date.now() + waitMs;
                console.log(`[VideoPlayer] 🔄 All sources failed, busting cache + backend re-fetch #${retryCountRef.current}`);
                // ⚠️ CRITICAL: Bust the cache so re-fetch doesn't return the same blocked URLs.
                // The cache has no way to know a URL is 403-blocked (no expiry param).
                if (cacheKeyRef.current) {
                    streamCache.remove(cacheKeyRef.current);
                    console.log(`[VideoPlayer] 🗑️ Cache busted for blocked stream`);
                }
                // Reset source index so cycling restarts from 0 on the fresh sources
                setCurrentSourceIndex(0);
                setTimeout(() => {
                    setRetryCount(c => c + 1);
                }, waitMs);
            } else {
                console.warn(`[VideoPlayer] ❌ Max retries (${MAX_STREAM_RETRIES}) reached — activating extractor fallback.`);
                if (!extractorEnabled) {
                    setExtractorEnabled(true);
                    setLoadingMessage('Searching alternatives...');
                    setIsBuffering(true);
                    setError(null);
                } else {
                    setError('Stream unavailable: all sources are temporarily blocked. Please try again in a minute.');
                    setIsBuffering(false);
                }
            }
        },
        onError: (errMsg) => {
            const activeSource = allSources[currentSourceIndex];
            const activeProvider = activeSource?.provider || 'unknown';
            const activeProviderId = activeSource?.providerId;
            const activeUrl = activeSource?.url || '';

            // Torrent/AllDebrid stream errors (often codec related like AC3/HEVC/MKV)
            // should trigger a fallback to the next source instead of stalling.
            if (activeProviderId === 'torrent') {
                console.warn('[VideoPlayer] AllDebrid stream failed (likely codec/container issue) -> falling back.');
            }

            const failedSourceKey = `${activeProviderId || activeProvider}::${activeUrl}`;
            sourceFailureCooldownRef.current.set(failedSourceKey, Date.now() + SOURCE_FAILURE_COOLDOWN_MS);
            reportStreamError({
                provider: activeProvider,
                providerId: activeProviderId,
                tmdbId: String(movie.id || ''),
                type: mediaType === 'tv' ? 'tv' : 'movie',
                season: playingSeasonNumber,
                episode: currentEpisode,
                error: errMsg,
                errorCode: 'HLS_GENERIC_ERROR'
            });
            if (currentSourceIndex < allSources.length - 1) {
                handleSourceChange(currentSourceIndex + 1);
            } else if (user && !premiumAttempted) {
                console.log('[VideoPlayer] 💎 All sources errored — activating premium fallback...');
                setPremiumAttempted(true);
                setLoadingMessage('Connecting to high-speed server...');
                setIsBuffering(true);
                setError(null);
            } else {
                setError(errMsg);
            }
        }
    });

    useEffect(() => {
        setQualityLevels(hlsLevels);
        setCurrentQualityLevel(hlsQuality);
        setAudioTracks(hlsAudios);
        setCurrentAudioTrack(hlsAudio);
        if (!isEmbed) setIsBuffering(hlsBuffering);

        // Merge native HLS subtitles if they exist
        if (hlsSubtitles && hlsSubtitles.length > 0) {
            setCaptions(prev => {
                const existingUrls = new Set(prev.map(p => p.url));
                const newSubs = hlsSubtitles
                    .filter(sub => sub.url && !existingUrls.has(sub.url))
                    .map((sub, index) => ({
                        id: `hls-sub-${sub.id || index}`,
                        label: ISO6391.getName((sub.lang || 'en').toLowerCase().split('-')[0]) || sub.name || `Subtitle ${index + 1}`,
                        url: sub.url!,
                        lang: (sub.lang || 'en').toLowerCase().split('-')[0]
                    }));
                return [...prev, ...newSubs];
            });
        }
    }, [hlsLevels, hlsQuality, hlsAudios, hlsAudio, hlsBuffering, isEmbed, hlsSubtitles]);

    // Report provider success after 10s of uninterrupted playback on a source.
    useEffect(() => {
        const activeProvider = allSources[currentSourceIndex]?.provider;
        const activeProviderId = allSources[currentSourceIndex]?.providerId;
        if (!activeProvider) return;
        if (!isPlaying || isBuffering || currentTime < 10) return;
        if (reportedSuccessRef.current === activeProvider) return;

        reportedSuccessRef.current = activeProvider;
        reportStreamSuccess(activeProvider, activeProviderId);
    }, [isPlaying, isBuffering, currentTime, allSources, currentSourceIndex]);

    // ——— Seek to resume time on load ———————————————————————————————————————————————
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        // Calculate the best resume time:
        // 1. For TV: getEpisodeProgress for this S+E
        // 2. For Movie: getVideoState time
        // 3. Fallback to resumeTime prop passed from CinemaPage
        const getResumeTime = () => {
            if (mediaType === 'tv') {
                const prog = getEpisodeProgress(movie.id, playingSeasonNumber, currentEpisode);
                if (prog && prog.time > 5 && prog.duration > 0 && (prog.time / prog.duration) < 0.95) {
                    return prog.time;
                }
            } else {
                const state = getVideoState(movie.id);
                if (state && state.time > 5 && state.duration && (state.time / state.duration) < 0.95) {
                    return state.time;
                }
            }
            return resumeTime > 5 ? resumeTime : 0;
        };

        const handleCanPlay = () => {
            const t = getResumeTime();
            if (t > 0 && video.currentTime < 2) {
                video.currentTime = t;
                console.log(`[VideoPlayer] ▶ Resuming from ${Math.round(t)}s`);
            }
            // Mark video as ready so subtitles can render
            setIsVideoReady(true);
            hasPlayedOnceRef.current = true;
        };

        // Reset ready state whenever stream URL changes (new episode / new source)
        // but NOT when just caption/subtitle track changes
        setIsVideoReady(false);

        video.addEventListener('canplay', handleCanPlay, { once: true });
        return () => video.removeEventListener('canplay', handleCanPlay);
    }, [streamUrl, mediaType, playingSeasonNumber, currentEpisode]);

    // ——— Time Update & History —————————————————————————————————————————————————————
    const handleTimeUpdate = useCallback(() => {
        const video = videoRef.current;
        if (!video || isNaN(video.duration) || video.duration === 0) return;

        const time = video.currentTime;
        const dur = video.duration;
        setCurrentTime(time);
        setDuration(dur);
        setProgress((time / dur) * 100);

        // Track buffered range so the seek bar can show how much is loaded ahead
        if (video.buffered.length > 0) {
            try {
                const bufferedEnd = video.buffered.end(video.buffered.length - 1);
                setBufferedAmount((bufferedEnd / dur) * 100);
            } catch (_) {}
        }


        if (time > 0 && Math.abs(time - lastSavedTimeRef.current) > 5) {
            lastSavedTimeRef.current = time;
            addToHistory(movie);
            if (mediaType === 'tv') {
                updateEpisodeProgress(movie.id, playingSeasonNumber, currentEpisode, time, dur);
            } else {
                updateVideoState(movie.id, time, undefined, dur);
            }
        }

        if (video.buffered.length > 0) {
            const bufferedEnd = video.buffered.end(video.buffered.length - 1);
            setBufferedAmount((bufferedEnd / dur) * 100);
        }
    }, [mediaType, movie.id, playingSeasonNumber, currentEpisode, addToHistory, updateEpisodeProgress, updateVideoState]);

    // ——— Instant progress save on manual scrub —————————————————————————————————————
    // timeupdate only fires every ~250ms and has a 5s throttle gate — so if the
    // user jumps with the seek bar we must catch it on 'seeked' immediately.
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;
        const onSeeked = () => {
            const time = video.currentTime;
            const dur = video.duration;
            if (!time || !dur || isNaN(dur)) return;
            lastSavedTimeRef.current = time; // reset throttle so next tick saves cleanly
            if (mediaType === 'tv') {
                updateEpisodeProgress(movie.id, playingSeasonNumber, currentEpisode, time, dur);
            } else {
                updateVideoState(movie.id, time, undefined, dur);
            }
        };
        video.addEventListener('seeked', onSeeked);
        return () => video.removeEventListener('seeked', onSeeked);
    }, [mediaType, movie.id, playingSeasonNumber, currentEpisode, updateEpisodeProgress, updateVideoState]);

    // ——— Custom Subtitle Cue Engine ———————————————————————————————————————————————
    // We parse the VTT file directly and drive currentCueText via a polling ref.
    const parsedCuesRef = useRef<Array<{ start: number; end: number; text: string }>>([]);

    useEffect(() => {
        if (!currentCaption) {
            setSubtitleObjectUrl(prev => { if (prev) URL.revokeObjectURL(prev); return null; });
            setCurrentCueText('');
            parsedCuesRef.current = [];
            return;
        }
        let isMounted = true;
        const loadSubtitles = async () => {
            try {
                const res = await fetch(currentCaption);
                const text = await res.text();
                if (!text || !isMounted) return;

                // Parse VTT/SRT cues
                const cues: Array<{ start: number; end: number; text: string }> = [];
                const timeToSec = (t: string) => {
                    const parts = t.trim().split(':');
                    if (parts.length === 3) {
                        return parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2].replace(',', '.'));
                    }
                    return parseFloat(parts[0]) * 60 + parseFloat(parts[1].replace(',', '.'));
                };
                // Universal VTT + SRT regex
                const cueRegex = /(?:\d+\n)?([\d:,.]+ --> [\d:,.]+)[^\n]*\n([\s\S]*?)(?=\n\n|\n?$)/g;
                let match;
                while ((match = cueRegex.exec(text)) !== null) {
                    const [startStr, endStr] = match[1].split(' --> ');
                    const cueText = match[2].trim().replace(/<[^>]+>/g, '');
                    if (cueText) cues.push({ start: timeToSec(startStr), end: timeToSec(endStr), text: cueText });
                }
                parsedCuesRef.current = cues;

                // Immediately snap to the cue at current playtime — no waiting for next timeupdate.
                // This is the "precision" fix: caption is correct the instant you switch tracks.
                if (isMounted && videoRef.current) {
                    const now = videoRef.current.currentTime - subtitleOffset;
                    const immediateCue = cues.find(c => now >= c.start && now <= c.end);
                    setCurrentCueText(immediateCue?.text || '');
                }

                // Produce a blob URL and revoke the previous one to prevent memory leaks
                const { convertSubtitlesToObjectUrl } = await import('../utils/captions');
                const newUrl = convertSubtitlesToObjectUrl(text);
                if (newUrl && isMounted) {
                    setSubtitleObjectUrl(prev => {
                        if (prev) URL.revokeObjectURL(prev);
                        return newUrl;
                    });
                }
            } catch (e) {
                console.error('[VideoPlayer] Subtitle load failed', e);
            }
        };
        loadSubtitles();
        return () => {
            isMounted = false;
            // Revoke blob URL when caption changes or component unmounts
            setSubtitleObjectUrl(prev => { if (prev) URL.revokeObjectURL(prev); return null; });
        };
    }, [currentCaption]);

    // Poll video currentTime to update the active cue text
    useEffect(() => {
        const update = () => {
            const video = videoRef.current;
            if (!video) return;
            const t = video.currentTime - subtitleOffset;
            const cue = parsedCuesRef.current.find(c => t >= c.start && t <= c.end);
            setCurrentCueText(cue ? cue.text : '');
        };
        const vid = videoRef.current;
        vid?.addEventListener('timeupdate', update);
        
        // Immediately run an update when this effect fires (e.g. if subtitleOffset changed while paused)
        update();

        return () => vid?.removeEventListener('timeupdate', update);
    }, [subtitleObjectUrl, subtitleOffset]);

    // Disable native subtitles to prevent double-rendering (since we use our own overlay)
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;
        const hideNative = () => {
            for (let i = 0; i < video.textTracks.length; i++) {
                video.textTracks[i].mode = 'hidden';
            }
        };
        video.addEventListener('loadedmetadata', hideNative);
        const interval = setInterval(hideNative, 1000);
        hideNative();
        return () => {
            video.removeEventListener('loadedmetadata', hideNative);
            clearInterval(interval);
        };
    }, [streamUrl]);

    // ——— TV Details init ——————————————————————————————————————————————————————————
    // Effect 1: Fetch season list once — only needs movie.id and mediaType
    useEffect(() => {
        if (mediaType !== 'tv') return;
        const init = async () => {
            try {
                const details = await getMovieDetails(String(movie.id), 'tv');
                if (details?.seasons) {
                    const validSeasons = details.seasons
                        .filter((s: any) => s.season_number > 0)
                        .map((s: any) => s.season_number);
                    setSeasonList(validSeasons);
                }
            } catch (e) {}
        };
        init();
    }, [movie.id, mediaType]);

    // Effect 2: Fetch episode list whenever the viewed season changes
    useEffect(() => {
        if (mediaType !== 'tv') return;
        let cancelled = false;
        const fetchEps = async () => {
            try {
                const seasonData = await getSeasonDetails(String(movie.id), playingSeasonNumber);
                if (!cancelled && seasonData?.episodes) setCurrentSeasonEpisodes(seasonData.episodes);
            } catch (e) {}
        };
        fetchEps();
        return () => { cancelled = true; };
    }, [movie.id, mediaType, playingSeasonNumber]);

    // ——— UI show/hide —————————————————————————————————————————————————————————————
    const isControlsHovered = useRef(false);
    const lastTouchTimeRef = useRef(0);

    const showControls = useCallback(() => {
        // Ignore simulated mouse moves that often follow touch events on mobile
        if (Date.now() - lastTouchTimeRef.current < 900) return;

        setShowUI(true);
        // Don't start a hide timer if a panel is open or mouse is over controls
        if (isControlsHovered.current || activePanel !== 'none') return;
        if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = setTimeout(() => {
            if (!isControlsHovered.current) setShowUI(false);
        }, 3500);
    }, [activePanel]);

    // When panel state changes:
    // If open: keep UI visible and clear hide timer
    // If closed: trigger showControls to start the 3.5s hide timer
    useEffect(() => {
        if (activePanel !== 'none') {
            if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
            setShowUI(true);
        } else {
            showControls();
        }
    }, [activePanel, showControls]);

    const toggleUI = useCallback(() => {
        if (activePanel !== 'none') return;
        
        setShowUI(prev => {
            const next = !prev;
            if (next) {
                // If showing UI, start the inactivity timer
                // We use a small delay or call showControls directly
                // but we need to ensure lastTouchTime doesn't block it
                const now = Date.now();
                const oldTouch = lastTouchTimeRef.current;
                lastTouchTimeRef.current = 0; // Temporarily allow
                showControls();
                lastTouchTimeRef.current = oldTouch; // Restore
            } else {
                // If hiding UI, clear any pending timer
                if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
            }
            return next;
        });
    }, [activePanel, showControls]);

    const handleInternalAudioChange = (id: number) => {
        setSelectedAudioTrackId(id);
        console.log(`[VideoPlayer] Switched internal audio to track ${id}`);
        
        const track = internalTracks.find(t => t.id === id);
        if (track && !isAudioCodecSupported(track.codec)) {
            console.log(`[VideoPlayer] Unsupported codec ${track.codec} detected. Routing through Background Interceptor...`);
        }
    };

    const handleInternalSubtitleChange = (id: number) => {
        setSelectedSubtitleTrackId(id);
        console.log(`[VideoPlayer] Switched internal subtitle to track ${id}`);
        // TODO: Signal to Service Worker or WASM decoder to switch stream
    };

    // â”€â”€â”€ Touch Gestures â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    useTouchGestures(containerRef, {
        onSingleTap: () => {
            lastTouchTimeRef.current = Date.now();
            toggleUI();
        },
        onDoubleTapLeft: () => {
            lastTouchTimeRef.current = Date.now();
            if (videoRef.current) videoRef.current.currentTime -= 10;
        },
        onDoubleTapRight: () => {
            lastTouchTimeRef.current = Date.now();
            if (videoRef.current) videoRef.current.currentTime += 10;
        }
    });


    return (
        <div
            ref={containerRef}
            className={`fixed z-[20000] flex flex-col font-sans select-none overflow-hidden bg-black ${isPseudoFullscreen ? 'inset-0' : (isFullscreen ? '' : 'inset-0')}`}
            style={isPseudoFullscreen ? { position: 'fixed', zIndex: 20001 } : {}}
            onMouseMove={showControls}
            onTouchStart={() => { lastTouchTimeRef.current = Date.now(); }}
            // Double-click on the video container = toggle fullscreen (desktop)
            onDoubleClick={(e) => {
                // Ignore double-clicks on control buttons
                const target = e.target as HTMLElement;
                if (target.tagName === 'BUTTON' || target.closest('button')) return;
                toggleFullscreen();
            }}
        >
            <video
                ref={videoRef}
                className={`w-full h-full ${videoFit === 'cover' ? 'object-cover' : 'object-contain'}`}
                onTimeUpdate={handleTimeUpdate}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onVolumeChange={() => {
                    if (videoRef.current) {
                        const vol = videoRef.current.volume;
                        const muted = videoRef.current.muted;
                        setVolume(vol);
                        setIsMuted(muted);
                        // Keep refs in sync for the audio-restore effect
                        volumeRef.current = vol;
                        mutedRef.current = muted;
                        // Persist volume level (not muted — always start unmuted on next visit)
                        if (vol > 0) {
                            try { localStorage.setItem('pstream_vol', String(vol)); } catch {}
                        }
                    }
                }}
                // For direct MP4 streams (AllDebrid CDN), track buffering via native events.
                // HLS streams use the hlsBuffering state from useHls instead.
                onWaiting={() => { if (!isStreamM3U8) setIsBuffering(true); }}
                onPlaying={() => { if (!isStreamM3U8) setIsBuffering(false); }}
                onCanPlay={() => { if (!isStreamM3U8) setIsBuffering(false); }}
                // Aggressive pre-buffering: tell the browser to download as much as possible
                preload="auto"
                playsInline
                onEnded={() => {
                    if (settings.autoplayNextEpisode) {
                        handleNextEpisode();
                    }
                }}
            />

            {/* â”€â”€ Custom Subtitle Overlay â”€â”€ */}
            {/* Show when: stream is ready (isVideoReady) OR we've played before and are just switching subtitle tracks */}
            {(isVideoReady || hasPlayedOnceRef.current) && subtitleObjectUrl && currentCueText && (() => {
                // Dialogue detection: lines starting with '- ' (or 'â€“ ')
                const lines = currentCueText.split(/\n/);
                const isDialogue = lines.length >= 2 && lines.filter(l => /^[-â€“]\s/.test(l.trim())).length >= 2;

                if (currentCueText !== prevCueRef.current) {
                    prevCueRef.current = currentCueText;
                    if (isDialogue) {
                        speakerSideRef.current = speakerSideRef.current === 'right' ? 'left' : 'right';
                    }
                }

                if (isDialogue) {
                    const speakerLines = lines.map(l => l.replace(/^[-â€“]\s*/, '').trim()).filter(Boolean);
                    const side = speakerSideRef.current;
                    return (
                        <div
                            className="subtitle-overlay"
                            style={{
                                ...overlayStyle,
                                bottom: showUI ? (isMobile ? '8rem' : '7rem') : '2.5rem',
                                left: '0',
                                transform: 'none',
                                maxWidth: '100%',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: side === 'left' ? 'flex-start' : 'flex-end',
                                paddingLeft: side === 'left' ? '12%' : '4%',
                                paddingRight: side === 'right' ? '12%' : '4%',
                                transition: 'all 0.25s ease',
                                background: 'transparent',
                                backgroundColor: 'transparent',
                                backdropFilter: 'none',
                                boxShadow: 'none'
                            }}
                        >
                            {speakerLines.map((line, i) => (
                                <span
                                    key={i}
                                    className="subtitle-line"
                                    style={{
                                        color: overlayStyle.color,
                                        fontFamily: overlayStyle.fontFamily,
                                        fontSize: overlayStyle.fontSize,
                                        textShadow: overlayStyle.textShadow,
                                        backgroundColor: overlayStyle.backgroundColor,
                                        padding: overlayStyle.padding,
                                        borderRadius: overlayStyle.borderRadius,
                                        backdropFilter: overlayStyle.backdropFilter,
                                        marginBottom: i < speakerLines.length - 1 ? '0.2em' : 0,
                                        alignSelf: i === 1 ? (side === 'left' ? 'flex-end' : 'flex-start') : undefined,
                                        transform: `translateX(${i === 1 ? (side === 'left' ? '8%' : '-8%') : '0'})`,
                                        transition: 'all 0.2s ease',
                                    }}
                                    dangerouslySetInnerHTML={{ __html: line }}
                                />
                            ))}
                        </div>
                    );
                }

                return (
                    <div
                        className="subtitle-overlay"
                        style={{
                            ...overlayStyle,
                            bottom: showUI ? (isMobile ? '8rem' : '7rem') : '2.5rem',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            background: 'transparent',
                            backgroundColor: 'transparent',
                            backdropFilter: 'none',
                            padding: 0,
                            transition: 'all 0.25s ease',
                        }}
                    >
                        <span
                            className="subtitle-line"
                            style={{
                                color: overlayStyle.color,
                                fontFamily: overlayStyle.fontFamily,
                                fontSize: overlayStyle.fontSize,
                                textShadow: overlayStyle.textShadow,
                                backgroundColor: overlayStyle.backgroundColor,
                                padding: overlayStyle.padding,
                                borderRadius: overlayStyle.borderRadius,
                                backdropFilter: overlayStyle.backdropFilter,
                                display: 'inline-block',
                                whiteSpace: 'pre-wrap',
                            }}
                            dangerouslySetInnerHTML={{ __html: currentCueText.replace(/\n/g, '<br/>') }}
                        />
                    </div>
                );
            })()}


            {isBuffering && (
                hasPlayedOnceRef.current ? (
                    // Mid-playback stall — subtle spinner only, no alarm
                    <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                        <div className="relative w-12 h-12">
                            <div className="absolute inset-0 rounded-full border-[3px] border-white/10" />
                            <div className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-white/90 animate-spin" />
                        </div>
                    </div>
                ) : (
                    // Initial load — premium branded loading screen
                    <div className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none" style={{ background: 'radial-gradient(ellipse at center, rgba(20,20,20,0.97) 0%, rgba(0,0,0,1) 100%)' }}>
                        {/* Spinner */}
                        <div className="relative w-14 h-14 mb-8">
                            <div className="absolute inset-0 rounded-full border-[3px] border-white/8" />
                            <div className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-white/70 animate-spin" />
                            <div className="absolute inset-[6px] rounded-full border-[2px] border-transparent border-t-[#e50914]/60 animate-spin" style={{ animationDuration: '0.7s', animationDirection: 'reverse' }} />
                        </div>
                        {/* Message */}
                        <p className="text-white/40 text-[13px] font-medium tracking-[0.12em] uppercase select-none">{loadingMessage}</p>
                    </div>
                )
            )}

            {error && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/95 z-20 text-center px-6" style={{ backdropFilter: 'blur(8px)' }}>
                    <div className="w-16 h-16 rounded-full border-2 border-[#e50914]/40 flex items-center justify-center mb-6">
                        <span className="text-[#e50914] text-3xl font-bold">!</span>
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-3 tracking-tight">Playback Error</h2>
                    <p className="text-white/50 mb-8 max-w-sm text-sm leading-relaxed">{error}</p>
                    <div className="flex flex-col items-center gap-3">
                        <button
                            onClick={() => setRetryCount(c => c + 1)}
                            className="px-8 py-3 bg-white text-black font-bold text-sm rounded-full hover:bg-white/90 hover:scale-105 transition-all active:scale-95"
                        >
                            Retry Connection
                        </button>
                        <button
                            onClick={onClose}
                            className="text-white/30 hover:text-white/70 text-sm transition-colors mt-1"
                        >
                            Exit Player
                        </button>
                    </div>
                </div>
            )}

            {/* ── Silence Detection Toast ── */}
            {/* Shows when audio codec is unsupported (AC3/DTS on Chrome) */}
            {silenceDetected && (
                <div className="absolute top-8 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-md border border-white/10 rounded-2xl p-4 flex items-center gap-4 z-50 animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className="w-10 h-10 rounded-full bg-[#e50914]/20 flex items-center justify-center text-[#e50914]">
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M13.5 4.06c-.22-.13-.48-.13-.7 0L6.47 8.38H4c-.55 0-1 .45-1 1v5.25c0 .55.45 1 1 1h2.47l6.33 4.32c.11.07.24.11.37.11s.26-.03.37-.11c.26-.18.43-.47.43-.79V4.85c0-.32-.17-.61-.47-.79z" opacity=".3"/><path d="M20.5 12c0-3.31-1.95-6.17-4.78-7.5-.38-.18-.84-.02-1.02.36-.18.38-.02.84.36 1.02C17.38 7.03 19 9.33 19 12s-1.62 4.97-4.94 6.12c-.38.13-.58.55-.45.93.1.3.38.48.68.48.08 0 .17-.02.25-.05 3.82-1.32 6.46-4.9 6.46-8.98z"/></svg>
                    </div>
                    <div>
                        <h4 className="text-white text-sm font-bold">No Audio Detected</h4>
                        <p className="text-white/50 text-xs">This file uses an unsupported audio codec (AC3/DTS).</p>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* VLC Fallback - opens direct CDN URL in VLC */}
                        <button
                            onClick={() => {
                                // Extract the actual CDN URL from the stream
                                const currentSrc = allSources[currentSourceIndex];
                                if (currentSrc?.url) {
                                    const vlcUrl = currentSrc.url;
                                    // Try VLC protocol first, fallback to intent:// for mobile
                                    const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent);
                                    const protocol = isMobile ? 'intent://' : 'vlc://';
                                    const encodedUrl = encodeURIComponent(vlcUrl);
                                    window.open(`${protocol}${encodedUrl}`, '_blank');
                                }
                            }}
                            className="px-4 py-2 bg-[#e50914] text-white rounded-lg text-xs font-bold hover:bg-[#e50914]/90 transition-colors"
                        >
                            Open in VLC
                        </button>
                        <button
                            onClick={() => {
                                const nextIdx = currentSourceIndex + 1;
                                if (allSources[nextIdx]) handleSourceChange(nextIdx);
                                dismissSilence();
                            }}
                            className="px-4 py-2 bg-white text-black rounded-lg text-xs font-bold hover:bg-white/90 transition-colors"
                        >
                            Switch Server
                        </button>
                        <button
                            onClick={dismissSilence}
                            className="px-4 py-2 bg-white/10 text-white rounded-lg text-xs font-bold hover:bg-white/20 transition-colors"
                        >
                            Dismiss
                        </button>
                    </div>
                </div>
            )}


            <VideoPlayerControls
                showUI={showUI}
                isPlaying={isPlaying}
                isMuted={isMuted}
                progress={progress}
                duration={duration}
                currentTime={currentTime}
                buffered={bufferedAmount}
                isBuffering={isBuffering}
                title={title}
                episodeNumber={mediaType === 'tv' ? currentEpisode : undefined}
                episodeName={mediaType === 'tv' ? currentEpisodeName : undefined}
                onPlayPause={() => videoRef.current?.paused ? videoRef.current.play() : videoRef.current?.pause()}
                onSeek={(amt) => videoRef.current && (videoRef.current.currentTime += amt)}
                volume={volume}
                onVolumeChange={(v) => { if (videoRef.current) { videoRef.current.volume = v; if (v > 0) videoRef.current.muted = false; } }}
                onToggleMute={() => {
                    if (videoRef.current) {
                        const nextMuted = !videoRef.current.muted;
                        videoRef.current.muted = nextMuted;
                        userMutedRef.current = nextMuted;
                        setIsMuted(nextMuted);
                    }
                }}
                onTimelineSeek={(p) => videoRef.current && (videoRef.current.currentTime = (p / 100) * videoRef.current.duration)}
                onToggleFullscreen={toggleFullscreen}
                onClose={onClose || (() => window.history.back())}
                activePanel={activePanel}
                setActivePanel={setActivePanel}
                mediaType={mediaType}
                hasNextEpisode={!!nextEpisodeInfo}
                onNextEpisode={handleNextEpisode}
                showNextEp={!!nextEpisodeInfo}
                onInteraction={showControls}
                onControlsHoverChange={(h) => isControlsHovered.current = h}
                onSubtitlesClick={() => setActivePanel(p => p === 'audioSubtitles' ? 'none' : 'audioSubtitles')}
                currentCaption={currentCaption}
                onEpisodesClick={mediaType === 'tv'
                    ? () => {
                        setBrowsedSeasonNumber(playingSeasonNumber);
                        setActivePanel(p => (p === 'episodes' || p === 'seasons') ? 'none' : 'episodes');
                      }
                    : undefined}
                videoFit={videoFit}
                onToggleFit={() => setVideoFit(prev => prev === 'contain' ? 'cover' : 'contain')}
                ppRippleTrigger={ppRippleTrigger}
                setPpRippleTrigger={setPpRippleTrigger}
                seekFlash={seekFlash}
                setSeekFlash={setSeekFlash}
            />

            {isMobile ? (
                <VideoPlayerSettingsTouch
                    activePanel={activePanel}
                    setActivePanel={setActivePanel}
                    seasonList={seasonList}
                    currentSeasonEpisodes={currentSeasonEpisodes}
                    selectedSeason={browsedSeasonNumber}
                    currentEpisode={currentEpisode}
                    playingSeason={playingSeasonNumber}
                    showId={movie.id}
                    onSeasonSelect={(s) => {
                        setBrowsedSeasonNumber(s);
                        getSeasonDetails(String(movie.id), s).then(data => {
                            if (data?.episodes) setCurrentSeasonEpisodes(data.episodes);
                        }).catch(() => {});
                        setActivePanel('episodes');
                    }}
                    onEpisodeSelect={handleEpisodeSelect}
                    qualities={qualityLevels}
                    currentQuality={currentQualityLevel}
                    onQualityChange={changeQuality}
                    captions={captions}
                    currentCaption={currentCaption}
                    onSubtitleChange={setCurrentCaption}
                    subtitleOffset={subtitleOffset}
                    onSubtitleOffsetChange={setSubtitleOffset}
                    audioTracks={audioTracks}
                    currentAudioTrack={currentAudioTrack}
                    onAudioChange={changeAudioTrack}
                    internalTracks={internalTracks}
                    selectedAudioTrackId={selectedAudioTrackId}
                    selectedSubtitleTrackId={selectedSubtitleTrackId}
                    onInternalAudioChange={handleInternalAudioChange}
                    onInternalSubtitleChange={handleInternalSubtitleChange}
                    allSources={allSources}
                    currentSourceIndex={currentSourceIndex}
                    onSourceChange={handleSourceChange}
                />
            ) : (
                <VideoPlayerSettings
                    activePanel={activePanel}
                    setActivePanel={setActivePanel}
                    seasonList={seasonList}
                    currentSeasonEpisodes={currentSeasonEpisodes}
                    selectedSeason={browsedSeasonNumber}
                    currentEpisode={currentEpisode}
                    playingSeason={playingSeasonNumber}
                    showId={movie.id}
                    onSeasonSelect={(s) => {
                        setBrowsedSeasonNumber(s);
                        getSeasonDetails(String(movie.id), s).then(data => {
                            if (data?.episodes) setCurrentSeasonEpisodes(data.episodes);
                        }).catch(() => {});
                        setActivePanel('episodes');
                    }}
                    onEpisodeSelect={handleEpisodeSelect}
                    qualities={qualityLevels}
                    currentQuality={currentQualityLevel}
                    onQualityChange={changeQuality}
                    captions={captions}
                    currentCaption={currentCaption}
                    onSubtitleChange={setCurrentCaption}
                    subtitleOffset={subtitleOffset}
                    onSubtitleOffsetChange={setSubtitleOffset}
                    audioTracks={audioTracks}
                    currentAudioTrack={currentAudioTrack}
                    onAudioChange={changeAudioTrack}
                    internalTracks={internalTracks}
                    selectedAudioTrackId={selectedAudioTrackId}
                    selectedSubtitleTrackId={selectedSubtitleTrackId}
                    onInternalAudioChange={handleInternalAudioChange}
                    onInternalSubtitleChange={handleInternalSubtitleChange}
                    allSources={allSources}
                    currentSourceIndex={currentSourceIndex}
                    onSourceChange={handleSourceChange}
                />
            )}

        </div>
    );
};

export default VideoPlayer;

