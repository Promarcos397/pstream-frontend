import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Movie, Episode, InternalTrack } from '../types';
import { getSeasonDetails, getMovieDetails, getExternalIds } from '../services/api';
import ISO6391 from 'iso-639-1';
import { useTranslation } from 'react-i18next';
import { useGlobalContext } from '../context/GlobalContext';
import { useSubtitleStyle } from '../hooks/useSubtitleStyle';
import { useTitle } from '../context/TitleContext';
import { streamCache } from '../utils/streamCache';
import { useTouchGestures } from '../hooks/useTouchGestures';
import { useIsMobile } from '../hooks/useIsMobile';
import { SubtitleService } from '../services/SubtitleService';
import { reportStreamError, reportStreamSuccess } from '../services/ProviderHealthService';
import { useSkipTimestamps, SkipSegment } from '../hooks/useSkipTimestamps';
import VideoPlayerControls from './VideoPlayerControls';
import VideoPlayerSettings from './VideoPlayerSettings';
import VideoPlayerSettingsTouch from './VideoPlayerSettingsTouch';
import { EmbedPlayer, EmbedController } from './EmbedPlayer';
import { ALL_EMBED_PROVIDERS } from '../services/EmbedProviders';
import { ArrowLeftIcon } from '@phosphor-icons/react';


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

/** Parses standard subtitle formatting tags into safe, structured React elements. */
function parseSubtitleTags(text: string): React.ReactNode[] {
    const tagRegex = /(<\/?[ibuf](?: [^>]*)?>|<\/?[uU]>|<br\s*\/?>|\n)/g;
    const parts = text.split(tagRegex);
    const elements: React.ReactNode[] = [];

    let isItalic = false;
    let isBold = false;
    let isUnderline = false;
    let activeColor: string | undefined = undefined;

    parts.forEach((part, index) => {
        if (!part) return;

        const lower = part.toLowerCase();
        if (lower === '<i>') {
            isItalic = true;
        } else if (lower === '</i>') {
            isItalic = false;
        } else if (lower === '<b>') {
            isBold = true;
        } else if (lower === '</b>') {
            isBold = false;
        } else if (lower === '<u>') {
            isUnderline = true;
        } else if (lower === '</u>') {
            isUnderline = false;
        } else if (lower.startsWith('<font')) {
            const colorMatch = part.match(/color=["']?([^"'\s>]+)["']?/i);
            if (colorMatch) {
                activeColor = colorMatch[1];
            }
        } else if (lower === '</font>') {
            activeColor = undefined;
        } else if (lower === '<br>' || lower === '<br/>' || lower === '<br />' || part === '\n') {
            elements.push(<br key={index} />);
        } else {
            if (isItalic || isBold || isUnderline || activeColor) {
                elements.push(
                    <span
                        key={index}
                        style={{
                            fontStyle: isItalic ? 'italic' : undefined,
                            fontWeight: isBold ? 'bold' : undefined,
                            textDecoration: isUnderline ? 'underline' : undefined,
                            color: activeColor || undefined,
                        }}
                    >
                        {part}
                    </span>
                );
            } else {
                elements.push(part);
            }
        }
    });

    return elements;
}

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
                    (screen.orientation as any).lock('landscape').catch(() => { });
                }
            }).catch(() => { });
        } else if (elem.webkitRequestFullscreen) {
            elem.webkitRequestFullscreen();
        } else if (elem.webkitEnterFullscreen) {
            // iPhone video element fallback
            elem.webkitEnterFullscreen();
        }
    } catch (e) { }
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ movie, season = 1, episode = 1, resumeTime = 0, onClose }) => {
    const HIDE_CUSTOM_UI = false; // Custom controls UI fully active
    const { t } = useTranslation();
    const { user, settings, updateEpisodeProgress, getEpisodeProgress, updateVideoState, addToHistory, getVideoState, setActiveVideoId } = useGlobalContext();
    const { setPageTitle } = useTitle();
    const isMobile = useIsMobile();
    const { overlayStyle, enabled: subsEnabled } = useSubtitleStyle();
    const mediaType = movie.media_type || (movie.first_air_date ? 'tv' : 'movie');
    const videoRef = useRef<HTMLVideoElement>(null);
    const embedControllerRef = useRef<EmbedController | null>(null);
    // Estimated duration used for embed timeline calculations when real duration unknown
    const estimatedDurationRef = useRef(mediaType === 'tv' ? 2700 : 7200);
    const containerRef = useRef<HTMLDivElement>(null);
    const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
    const lastSavedTimeRef = useRef<number>(0);
    const hasAutoFullscreenedRef = useRef(false);
    const [bufferedAmount, setBufferedAmount] = useState<number>(0);

    // Player State
    const [isPlaying, setIsPlaying] = useState(false);
    const [isBuffering, setIsBuffering] = useState(true);
    const [currentTime, setCurrentTime] = useState(0);
    const currentTimeRef = useRef(0);
    useEffect(() => {
        currentTimeRef.current = currentTime;
    }, [currentTime]);
    const [duration, setDuration] = useState(0);
    const [progress, setProgress] = useState(0);
    const [volume, setVolume] = useState(() => {
        try {
            const stored = parseFloat(localStorage.getItem('pstream_vol') || '1');
            return isFinite(stored) && stored >= 0.05 && stored <= 1 ? stored : 1;
        } catch { return 1; }
    });
    const [isMuted, setIsMuted] = useState(false); // Always start unmuted; user mutes manually
    const [showSourceSelector, setShowSourceSelector] = useState(false);
    const [showUI, setShowUI] = useState(true);
    const showUIRef = useRef(true);
    useEffect(() => { showUIRef.current = showUI; }, [showUI]);

    const [showPausedOverlay, setShowPausedOverlay] = useState(false);
    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (!isPlaying && !showUI) {
            timer = setTimeout(() => setShowPausedOverlay(true), 2500);
        } else {
            setShowPausedOverlay(false);
        }
        return () => clearTimeout(timer);
    }, [isPlaying, showUI]);

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
    useEffect(() => {
        volumeRef.current = volume;
        try {
            if (volume > 0) {
                localStorage.setItem('pstream_vol', String(volume));
            }
        } catch { }
    }, [volume]);
    const mutedRef = useRef(false); // tracks real-time element state
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



    // Internal tracks (MKV/MP4)
    const [internalTracks, setInternalTracks] = useState<InternalTrack[]>([]);
    const [selectedAudioTrackId, setSelectedAudioTrackId] = useState<number | null>(null);
    const [selectedSubtitleTrackId, setSelectedSubtitleTrackId] = useState<number | null>(null);

    // Embed Fallback state (Direct client-side embeds only)
    const [useEmbedFallback, setUseEmbedFallback] = useState(true);
    const [embedProviderIndex, setEmbedProviderIndex] = useState(0);

    const embedSourcesMapped = useMemo(() => {
        return ALL_EMBED_PROVIDERS.map((p) => ({
            id: p.id,
            name: p.name,
            provider: 'Premium Embed',
            quality: p.supportsPostMessage ? 'Tier-1 (Seamless)' : 'Tier-2 (Reload)',
            isM3U8: false,
        }));
    }, []);


    const activeStreamUrl = useMemo(() => streamUrl, [streamUrl]);

    useEffect(() => {
        if (streamUrl) {
            console.info(`[VideoPlayer] 🎬 New source loaded: ${new URL(streamUrl).hostname}`);
        }
    }, [streamUrl]);

    // TV Show state
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
        setUseEmbedFallback(true); // Retain direct client-side embed mode across episodes
        setEmbedProviderIndex(0); // Reset provider index to default (VidLink) on episode switch
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
                if (doc.exitFullscreen) doc.exitFullscreen().catch(() => { });
                else if (doc.webkitExitFullscreen) doc.webkitExitFullscreen();
                else if (doc.msExitFullscreen) doc.msExitFullscreen();
            }

            setIsFullscreen(false);
            setIsPseudoFullscreen(false);
            try { (screen.orientation as any)?.unlock?.(); } catch (e) { }
        } else {
            if (el?.requestFullscreen) {
                el.requestFullscreen().then(() => {
                    if ((screen.orientation as any)?.lock) (screen.orientation as any).lock('landscape').catch(() => { });
                }).catch(() => { });
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
    const [captions, setCaptions] = useState<{ id: string; label: string; url: string; lang: string; duration?: number }[]>([]);
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
        // Guard against mismatched season details during transition
        if (currentSeasonEpisodes.length === 0 || currentSeasonEpisodes[0].season_number !== playingSeasonNumber) {
            return null;
        }
        // Find current episode index within the loaded season episode list
        const currentIdx = currentSeasonEpisodes.findIndex(ep => ep.episode_number === currentEpisode);
        // Case 1: There is a next episode in this same season
        if (currentIdx !== -1 && currentIdx < currentSeasonEpisodes.length - 1) {
            return { episode: currentSeasonEpisodes[currentIdx + 1]!, season: playingSeasonNumber };
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

    const previousEpisodeInfo = useMemo<{ episode: Episode; season: number } | null>(() => {
        if (mediaType !== 'tv') return null;
        // Guard against mismatched season details during transition
        if (currentSeasonEpisodes.length === 0 || currentSeasonEpisodes[0].season_number !== playingSeasonNumber) {
            return null;
        }
        // Find current episode index within the loaded season episode list
        const currentIdx = currentSeasonEpisodes.findIndex(ep => ep.episode_number === currentEpisode);
        // Case 1: There is a previous episode in this same season
        if (currentIdx > 0) {
            return { episode: currentSeasonEpisodes[currentIdx - 1]!, season: playingSeasonNumber };
        }
        // Case 2: First episode of the season — find the previous season
        const prevSeason = [...seasonList].reverse().find(s => s < playingSeasonNumber);
        if (prevSeason !== undefined) {
            // Return a placeholder ep; the real list loads when the season is fetched
            return {
                episode: { id: -1, episode_number: 99, name: 'Previous Season', season_number: prevSeason } as Episode,
                season: prevSeason,
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
        const notificationTitle = showTitle;
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

        // Wire OS controls to the actual video player / embed controller
        navigator.mediaSession.setActionHandler('play', () => { 
            setIsPlaying(true); 
        });
        navigator.mediaSession.setActionHandler('pause', () => { 
            setIsPlaying(false); 
        });
        navigator.mediaSession.setActionHandler('seekbackward', (details) => {
            const offset = details.seekOffset || 10;
            const target = Math.max(0, currentTimeRef.current - offset);
            currentTimeRef.current = target;
            embedControllerRef.current?.seek(target);
            setCurrentTime(target);
        });
        navigator.mediaSession.setActionHandler('seekforward', (details) => {
            const offset = details.seekOffset || 10;
            const target = Math.min(duration || estimatedDurationRef.current, currentTimeRef.current + offset);
            currentTimeRef.current = target;
            embedControllerRef.current?.seek(target);
            setCurrentTime(target);
        });
        navigator.mediaSession.setActionHandler('seekto', (details) => {
            if (details.seekTime != null) {
                const target = details.seekTime;
                currentTimeRef.current = target;
                embedControllerRef.current?.seek(target);
                setCurrentTime(target);
            }
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

        return () => {
            if ('mediaSession' in navigator) {
                navigator.mediaSession.setActionHandler('play', null);
                navigator.mediaSession.setActionHandler('pause', null);
                navigator.mediaSession.setActionHandler('seekbackward', null);
                navigator.mediaSession.setActionHandler('seekforward', null);
                navigator.mediaSession.setActionHandler('seekto', null);
                navigator.mediaSession.setActionHandler('nexttrack', null);
                navigator.mediaSession.setActionHandler('previoustrack', null);
            }
        };
    }, [movie, mediaType, playingSeasonNumber, currentEpisode, currentSeasonEpisodes, nextEpisodeInfo, duration]);

    // Sync position state so the OS scrubber knows the duration
    useEffect(() => {
        if (!('mediaSession' in navigator) || !navigator.mediaSession.metadata) return;
        if (!duration || isNaN(duration)) return;
        try {
            navigator.mediaSession.setPositionState({
                duration: duration,
                playbackRate: isPlaying ? 1 : 0,
                position: currentTime,
            });
        } catch (_) { }
    }, [currentTime, duration, isPlaying]);

    const [currentCueText, setCurrentCueText] = useState<string>('');

    // HLS state (from hook)
    const [qualityLevels, setQualityLevels] = useState<{ height: number; bitrate: number; level: number }[]>([]);
    const [currentQualityLevel, setCurrentQualityLevel] = useState<number>(-1);
    const [audioTracks, setAudioTracks] = useState<{ id: number; name: string; lang: string }[]>([]);
    const [currentAudioTrack, setCurrentAudioTrack] = useState<number>(-1);

    // Skip Intro/Credits Timestamps — pass IMDB ID (api.introdb.app uses imdb_id, not tmdb_id)
    const { segments: skipSegments } = useSkipTimestamps(movie.imdb_id, mediaType as 'movie' | 'tv', playingSeasonNumber, currentEpisode);

    const handleSkipSegment = useCallback((segment: SkipSegment) => {
        if (useEmbedFallback) {
            // Best-effort seek via postMessage broadcast
            embedControllerRef.current?.seek(segment.end);
        } else if (videoRef.current) {
            videoRef.current.currentTime = segment.end;
        }
    }, [useEmbedFallback]);

    // Derived data
    const title = movie.title || movie.name || '';
    const formattedDate = movie.release_date || movie.first_air_date || '';
    const currentEpisodeName = currentSeasonEpisodes.find(ep => ep.episode_number === currentEpisode)?.name || '';

    // ——— Touch gestures ————————————————————————————————————————————————————————————
    // Single tap = toggle UI (reveal/hide). No swipe-to-seek, no double-tap-to-seek.
    useTouchGestures(containerRef, {
        onSingleTap: () => {
            lastTouchTimeRef.current = Date.now();
            if (activePanel !== 'none') {
                setActivePanel('none');
                return;
            }
            toggleUI();
        },
    });

    // ——— Apply stream result ———————————————————————————————————————————————————————
    const applyStreamResult = useCallback((sources: any[], subtitles: any[], globalReferer?: string | null) => {
        if (!sources || sources.length === 0) return;
        setError(null);

        setAllSources(sources);

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
                } catch (e) { }
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
    }, [settings.subtitleLanguage, settings.showSubtitles]);

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
                } catch (e) { }
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
            }).catch(() => { });
        }
        if (episodes) setCurrentSeasonEpisodes(episodes);
        setCurrentEpisode(ep.episode_number);
    }, [playingSeasonNumber, movie.id]);

    // Pass the target season explicitly so cross-season transitions always update season state
    const handleNextEpisode = useCallback(() => {
        if (!nextEpisodeInfo) return;
        handleEpisodeSelect(nextEpisodeInfo.episode, nextEpisodeInfo.season);
    }, [nextEpisodeInfo, handleEpisodeSelect]);

    const handlePreviousEpisode = useCallback(() => {
        if (!previousEpisodeInfo) return;

        // If it was a placeholder episode from the previous season (episode_number 99),
        // we should fetch the previous season details to get the actual last episode of that season!
        if (previousEpisodeInfo.episode.id === -1) {
            setStreamUrl(null);
            setIsBuffering(true);
            setActivePanel('none');
            const targetSeason = previousEpisodeInfo.season;
            setPlayingSeasonNumber(targetSeason);
            setBrowsedSeasonNumber(targetSeason);
            getSeasonDetails(String(movie.id), targetSeason).then(data => {
                if (data?.episodes && data.episodes.length > 0) {
                    setCurrentSeasonEpisodes(data.episodes);
                    // Select the last episode of the previous season
                    const lastEp = data.episodes[data.episodes.length - 1]!;
                    setCurrentEpisode(lastEp.episode_number);
                }
            }).catch(() => { });
        } else {
            handleEpisodeSelect(previousEpisodeInfo.episode, previousEpisodeInfo.season);
        }
    }, [previousEpisodeInfo, handleEpisodeSelect, movie.id]);

    // ——— Track episode/season prop changes ——————————————————————————————————————————
    useEffect(() => {
        if (season !== playingSeasonNumber) setPlayingSeasonNumber(season);
        if (episode !== currentEpisode) setCurrentEpisode(episode);
    }, [season, episode]);

    // ——— Keyboard shortcuts ————————————————————————————————————————————————————————
    // Moved to the bottom of the component to avoid TDZ compile errors with showControls.

    // Resolve direct stream from GoatAPI
    // Reset everything when content changes
    useEffect(() => {
        standardErrorRef.current = null;
        setIsBuffering(false); // No spinner needed since we mount EmbedPlayer immediately
        setError(null);
        setStreamUrl(null);
        setAllSources([]);
        setCurrentSourceIndex(0);
        setLoadingMessage('Loading player...');
        // Wipe subtitles from the previous episode/movie
        setCaptions([]);
        setCurrentCaption(null);
        // Reset playback ref so the initial-load overlay shows again for the new episode
        hasPlayedOnceRef.current = false;
        // Reset time display immediately
        setCurrentTime(0);
        setDuration(0);
        setProgress(0);
        setBufferedAmount(0);
    }, [movie.id, mediaType, playingSeasonNumber, currentEpisode]);

    // One-time volume initialisation on mount
    useEffect(() => {
        const video = videoRef.current;
        if (!video || !streamUrl) return;
        if (volumeRef.current > 0 && volumeRef.current <= 1) {
            video.volume = volumeRef.current;
        }
    }, [streamUrl]);



    // NOTE: useAudioSilenceDetector was removed — createMediaElementSource() is a destructive
    // one-way pipe into WebAudio that itself causes silence when AudioContext is suspended.
    // Audio compatibility is managed at the source selection layer, not a post-hoc silence probe.

    // ── Subtitle Fetcher Hook ──────────────────────────────────────────────────────
    // Fetch external subtitles whenever the current content changes.
    // Depends ONLY on movie.id, mediaType, playingSeasonNumber, and currentEpisode.
    useEffect(() => {
        let cancelled = false;

        const type: 'movie' | 'tv' = mediaType === 'tv' ? 'tv' : 'movie';
        const preferredLang = settings.subtitleLanguage?.toLowerCase() || 'en';

        let expectedDurationSec = 0;
        if (mediaType === 'movie') {
            expectedDurationSec = (movie.runtime || 0) * 60;
        } else if (mediaType === 'tv') {
            const currentEpObj = currentSeasonEpisodes.find(e => e.episode_number === currentEpisode);
            expectedDurationSec = (currentEpObj?.runtime || 0) * 60;
        }
        const actualDurationSec = duration || (videoRef.current?.duration || 0);
        const targetDuration = actualDurationSec > 0 ? actualDurationSec : expectedDurationSec;

        setCaptions([]); // Clear captions list for new content

        SubtitleService.getSubtitleTracks(
            String(movie.id), type,
            mediaType === 'tv' ? playingSeasonNumber : undefined,
            mediaType === 'tv' ? currentEpisode : undefined,
            preferredLang,
            movie.imdb_id
        ).then(tracks => {
            if (cancelled) return;
            if (!tracks.length) return;

            const mappedCaptions = tracks.map((sub, idx) => ({
                id: `sub-ext-${idx}`,
                label: sub.label,
                url: sub.url,
                lang: sub.lang,
                duration: sub.duration,
            }));

            // Sort subtitles: those with closer duration to targetDuration go first
            if (targetDuration > 0) {
                mappedCaptions.sort((a, b) => {
                    const diffA = a.duration ? Math.abs(a.duration - targetDuration) : Infinity;
                    const diffB = b.duration ? Math.abs(b.duration - targetDuration) : Infinity;

                    // Prioritize close matches (within 90s)
                    const aIsClose = diffA <= 90;
                    const bIsClose = diffB <= 90;
                    if (aIsClose && !bIsClose) return -1;
                    if (!aIsClose && bIsClose) return 1;

                    if (diffA !== diffB) {
                        return diffA - diffB;
                    }
                    return 0; // Maintain default sorting
                });
            }

            setCaptions(mappedCaptions);
        }).catch(() => {});

        return () => { cancelled = true; };
    }, [movie.id, mediaType, playingSeasonNumber, currentEpisode, movie.imdb_id]);

    // ── Subtitle Auto-Selection Hook ────────────────────────────────────────────────
    // Automatically select the best matching subtitle track when captions load or settings change.
    useEffect(() => {
        if (!settings.showSubtitles || captions.length === 0) {
            setCurrentCaption(null);
            return;
        }

        const preferredLang = settings.subtitleLanguage?.toLowerCase() || 'en';

        let expectedDurationSec = 0;
        if (mediaType === 'movie') {
            expectedDurationSec = (movie.runtime || 0) * 60;
        } else if (mediaType === 'tv') {
            const currentEpObj = currentSeasonEpisodes.find(e => e.episode_number === currentEpisode);
            expectedDurationSec = (currentEpObj?.runtime || 0) * 60;
        }
        const actualDurationSec = duration || (videoRef.current?.duration || 0);
        const targetDuration = actualDurationSec > 0 ? actualDurationSec : expectedDurationSec;

        const matchingLangs = captions.filter(s => s.lang === preferredLang);
        const enTracks = captions.filter(s => s.lang === 'en');

        const findBestTrack = (tracksList: typeof captions) => {
            if (tracksList.length === 0) return null;
            if (targetDuration > 0) {
                const closeMatches = tracksList.filter(t => t.duration && Math.abs(t.duration - targetDuration) <= 90);
                if (closeMatches.length > 0) return closeMatches[0];

                const sortedByCloseness = [...tracksList].sort((a, b) => {
                    const diffA = a.duration ? Math.abs(a.duration - targetDuration) : Infinity;
                    const diffB = b.duration ? Math.abs(b.duration - targetDuration) : Infinity;
                    return diffA - diffB;
                });
                if (sortedByCloseness[0] && sortedByCloseness[0].duration && Math.abs(sortedByCloseness[0].duration - targetDuration) < 300) {
                    return sortedByCloseness[0];
                }
            }
            return null;
        };

        const bestPreferred = findBestTrack(matchingLangs);
        const bestEnglish = findBestTrack(enTracks);

        const target = bestPreferred
            || matchingLangs[0]
            || bestEnglish
            || enTracks[2] || enTracks[0]
            || captions[0];

        if (target) {
            setCurrentCaption(target.url);
        }
    }, [captions, settings.showSubtitles, settings.subtitleLanguage, duration]);

    const changeQuality = useCallback((_level: number) => {}, []);
    const changeAudioTrack = useCallback((_trackId: number) => {}, []);



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
                updateEpisodeProgress(movie, playingSeasonNumber, currentEpisode, time, dur);
            } else {
                updateVideoState(movie, time, undefined, dur);
            }
        };
        video.addEventListener('seeked', onSeeked);
        return () => video.removeEventListener('seeked', onSeeked);
    }, [mediaType, movie, playingSeasonNumber, currentEpisode, updateEpisodeProgress, updateVideoState]);

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
                // Direct client-side fetch only (no proxies)
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
                if (isMounted) {
                    const now = currentTime - subtitleOffset;
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

    // Update active cue text when currentTime or subtitleOffset changes
    useEffect(() => {
        const t = currentTime - subtitleOffset;
        const cue = parsedCuesRef.current.find(c => t >= c.start && t <= c.end);
        setCurrentCueText(cue ? cue.text : '');
    }, [currentTime, subtitleOffset, subtitleObjectUrl]);

    // Disable native subtitles to prevent double-rendering (since we use our own overlay)
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;
        const hideNative = () => {
            Array.from(video.textTracks).forEach(track => {
                track.mode = 'hidden';
            });
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
            } catch (e) { }
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
            } catch (e) { }
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
        }, 2500);
    }, [activePanel]);

    // When panel state changes:
    // If open: keep UI visible and clear hide timer
    // If closed: trigger showControls to start the 2.5s hide timer
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
    };

    const handleInternalSubtitleChange = (id: number) => {
        setSelectedSubtitleTrackId(id);
        console.log(`[VideoPlayer] Switched internal subtitle to track ${id}`);
        // TODO: Signal to Service Worker or WASM decoder to switch stream
    };

    // ——— Keyboard shortcuts ————————————————————————————————————————————————————————
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (activePanel !== 'none') return;

            const key = e.key.toLowerCase();

            // Allow key repeat only for navigation/adjustment actions (seeking, volume)
            if (e.repeat && !['arrowright', 'arrowleft', 'arrowup', 'arrowdown', 'l', 'j'].includes(key)) {
                return;
            }

            // Ignore shortcuts if the user is typing in an input/textarea
            const target = e.target as HTMLElement;
            if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
                return;
            }

            const registeredKeys = [' ', 'k', 'l', 'j', 'arrowright', 'arrowleft', 'arrowup', 'arrowdown', 'f', 'm', 'n', 'p', 's', 'escape'];

            if (!registeredKeys.includes(key)) {
                // Unregistered key: just show/wake controls and return
                showControls();
                return;
            }

            // Registered key: trigger UI controls show/wake and run immediate action
            showControls();
            e.preventDefault();

            switch (e.key) { // Keep exact matching for special/cased keys
                case 'Escape':
                    if (isFullscreen || isPseudoFullscreen) {
                        toggleFullscreen();
                    } else if (onClose) {
                        onClose();
                    }
                    break;
                case ' ':
                    if (useEmbedFallback) {
                        setIsPlaying(prev => !prev);
                        setPpRippleTrigger(t => t + 1);
                    } else if (videoRef.current) {
                        videoRef.current.paused ? videoRef.current.play() : videoRef.current.pause();
                        setPpRippleTrigger(t => t + 1);
                    }
                    break;
                case 'ArrowRight':
                    if (useEmbedFallback) {
                        const t = currentTimeRef.current + 10;
                        currentTimeRef.current = t;
                        embedControllerRef.current?.seek(t);
                        setCurrentTime(t);
                        setProgress(duration > 0 ? (t / duration) * 100 : 0);
                    } else if (videoRef.current) {
                        videoRef.current.currentTime += 10;
                    }
                    setSeekFlash({ side: 'right', ts: Date.now() });
                    setTimeout(() => setSeekFlash(null), 450);
                    break;
                case 'ArrowLeft':
                    if (useEmbedFallback) {
                        const t = Math.max(0, currentTimeRef.current - 10);
                        currentTimeRef.current = t;
                        embedControllerRef.current?.seek(t);
                        setCurrentTime(t);
                        setProgress(duration > 0 ? (t / duration) * 100 : 0);
                    } else if (videoRef.current) {
                        videoRef.current.currentTime -= 10;
                    }
                    setSeekFlash({ side: 'left', ts: Date.now() });
                    setTimeout(() => setSeekFlash(null), 450);
                    break;
                case 'ArrowUp':
                    if (useEmbedFallback) {
                        const v = Math.min(1, volumeRef.current + 0.1);
                        setVolume(v);
                        embedControllerRef.current?.setMuted(false, v);
                        if (isMuted) setIsMuted(false);
                    } else if (videoRef.current) {
                        videoRef.current.volume = Math.min(1, videoRef.current.volume + 0.1);
                    }
                    break;
                case 'ArrowDown':
                    if (useEmbedFallback) {
                        const v = Math.max(0, volumeRef.current - 0.1);
                        setVolume(v);
                        if (v === 0) {
                            setIsMuted(true);
                            embedControllerRef.current?.setMuted(true);
                        } else {
                            embedControllerRef.current?.setMuted(false, v);
                            if (isMuted) setIsMuted(false);
                        }
                    } else if (videoRef.current) {
                        videoRef.current.volume = Math.max(0, videoRef.current.volume - 0.1);
                    }
                    break;
                default:
                    // Normalize all letter keys to lowercase to support Caps Lock / Shift modifiers
                    switch (key) {
                        case 'k':
                            if (useEmbedFallback) {
                                setIsPlaying(prev => !prev);
                                setPpRippleTrigger(t => t + 1);
                            } else if (videoRef.current) {
                                videoRef.current.paused ? videoRef.current.play() : videoRef.current.pause();
                                setPpRippleTrigger(t => t + 1);
                            }
                            break;
                        case 'l':
                            if (useEmbedFallback) {
                                const t = currentTimeRef.current + 10;
                                currentTimeRef.current = t;
                                embedControllerRef.current?.seek(t);
                                setCurrentTime(t);
                                setProgress(duration > 0 ? (t / duration) * 100 : 0);
                            } else if (videoRef.current) {
                                videoRef.current.currentTime += 10;
                            }
                            setSeekFlash({ side: 'right', ts: Date.now() });
                            setTimeout(() => setSeekFlash(null), 450);
                            break;
                        case 'j':
                            if (useEmbedFallback) {
                                const t = Math.max(0, currentTimeRef.current - 10);
                                currentTimeRef.current = t;
                                embedControllerRef.current?.seek(t);
                                setCurrentTime(t);
                                setProgress(duration > 0 ? (t / duration) * 100 : 0);
                            } else if (videoRef.current) {
                                videoRef.current.currentTime -= 10;
                            }
                            setSeekFlash({ side: 'left', ts: Date.now() });
                            setTimeout(() => setSeekFlash(null), 450);
                            break;
                        case 'f':
                            toggleFullscreen();
                            break;
                        case 'm':
                            {
                                const next = !isMuted;
                                setIsMuted(next);
                                userMutedRef.current = next;
                                if (useEmbedFallback) {
                                    embedControllerRef.current?.setMuted(next);
                                } else if (videoRef.current) {
                                    videoRef.current.muted = next;
                                }
                            }
                            break;
                        case 'n':
                            if (nextEpisodeInfo) handleNextEpisode();
                            break;
                        case 'p':
                            if (previousEpisodeInfo) handlePreviousEpisode();
                            break;
                        case 's':
                            // Toggle subtitles on/off (cycle through available or disable)
                            if (currentCaption) {
                                setCurrentCaption(null);
                            } else if (captions.length > 0) {
                                // Re-select the preferred language
                                const preferred = captions.find(c => c.lang === 'en' || c.label.toLowerCase().includes('english')) || captions[0];
                                setCurrentCaption(preferred.url);
                            }
                            break;
                    }
                    break;
            }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [onClose, activePanel, nextEpisodeInfo, handleNextEpisode, previousEpisodeInfo, handlePreviousEpisode, isFullscreen, isPseudoFullscreen, toggleFullscreen, captions, currentCaption, showControls, useEmbedFallback, duration, isMuted]);

    return (
        <div
            ref={containerRef}
            className={`fixed z-[20000] flex flex-col font-sans select-none overflow-hidden bg-black ${isPseudoFullscreen ? 'inset-0' : (isFullscreen ? '' : 'inset-0')}`}
            style={isPseudoFullscreen ? { position: 'fixed', zIndex: 20001 } : {}}
            onMouseMove={showControls}
            onClick={(e) => {
                const target = e.target as HTMLElement;

                // If a settings panel is open: close it first and prevent any other background click actions
                if (activePanel !== 'none') {
                    const panelContainer = target.closest('.settings-panel') || target.closest('.settings-panel-touch');
                    if (!panelContainer) {
                        setActivePanel('none');
                        e.stopPropagation();
                        e.preventDefault();
                        return;
                    }
                }

                // Only act on clicks directly on the background/video/embed-shield
                const isBackgroundClick = target === containerRef.current ||
                    target === videoRef.current ||
                    target.classList.contains('embed-shield');

                if (isBackgroundClick) {
                    // Ignore synthesized clicks from touch devices
                    if (Date.now() - lastTouchTimeRef.current < 900) return;

                    if (showUIRef.current) {
                        // If controls UI is already showing, a click toggles play/pause!
                        if (useEmbedFallback) {
                            setIsPlaying(prev => !prev);
                        } else if (videoRef.current) {
                            if (videoRef.current.paused) {
                                videoRef.current.muted = false;
                                videoRef.current.play();
                            } else {
                                videoRef.current.pause();
                            }
                        }
                        setPpRippleTrigger(t => t + 1);
                    }

                    // Always wake up / show the controls UI and reset hide timer
                    showControls();
                } else {
                    // Clicked on a controls element — keep UI awake but don't block iframe
                    showControls();
                }
            }}
            onTouchStart={() => { lastTouchTimeRef.current = Date.now(); }}
            // Double-click = toggle fullscreen (desktop, non-embed only)
            onDoubleClick={(e) => {
                if (useEmbedFallback) return; // let the iframe handle it
                // Ignore double-clicks on control buttons
                const target = e.target as HTMLElement;
                if (target.tagName === 'BUTTON' || target.closest('button')) return;
                toggleFullscreen();
            }}
        >
            <EmbedPlayer
                tmdbId={String(movie.id)}
                imdbId={movie.imdb_id}
                mediaType={mediaType as 'movie' | 'tv'}
                season={playingSeasonNumber}
                episode={currentEpisode}
                videoFit={videoFit}
                isPlaying={isPlaying}
                controllerRef={embedControllerRef}
                subtitleLang={settings.subtitleLanguage || 'en'}
                activePanel={activePanel}
                providerIndex={embedProviderIndex}
                onProviderIndexChange={setEmbedProviderIndex}
                startTime={(() => {
                    // Compute resume time from the same store the native player uses (sync threshold > 5s)
                    if (mediaType === 'tv') {
                        const prog = getEpisodeProgress(movie.id, playingSeasonNumber, currentEpisode);
                        if (prog && prog.time > 5 && (prog.duration === 0 || (prog.time / prog.duration) < 0.95)) return prog.time;
                    } else {
                        const state = getVideoState(movie.id);
                        if (state && state.time > 5 && (state.duration === 0 || (state.time / state.duration) < 0.95)) return state.time;
                    }
                    return resumeTime > 5 ? resumeTime : 0;
                })()}
                onPlay={() => {
                    setIsPlaying(true);
                    setIsVideoReady(true);
                    hasPlayedOnceRef.current = true;
                }}
                onPause={() => setIsPlaying(false)}
                onEnded={() => {
                    if (settings.autoplayNextEpisode) handleNextEpisode();
                }}
                onTimeUpdate={(t, d) => {
                    setCurrentTime(t);
                    if (d > 0) {
                        setDuration(d);
                        setProgress((t / d) * 100);
                    }
                    // Throttled progress save — identical to native player cadence (every 5s starting from 0)
                    if (t > 0 && Math.abs(t - lastSavedTimeRef.current) > 5) {
                        lastSavedTimeRef.current = t;
                        addToHistory(movie);
                        if (mediaType === 'tv') {
                            updateEpisodeProgress(movie, playingSeasonNumber, currentEpisode, t, d);
                        } else {
                            updateVideoState(movie, t, undefined, d);
                        }
                    }
                }}
                onAllFailed={() => {
                    setError('All streaming providers have failed. Please try again later.');
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
                                bottom: useEmbedFallback ? '9rem' : '5.5rem',
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
                                >
                                    {parseSubtitleTags(line)}
                                </span>
                            ))}
                        </div>
                    );
                }

                return (
                    <div
                        className="subtitle-overlay"
                        style={{
                            ...overlayStyle,
                            bottom: useEmbedFallback ? '9rem' : '5.5rem',
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
                        >
                            {parseSubtitleTags(currentCueText)}
                        </span>
                    </div>
                );
            })()}


            {isBuffering && !useEmbedFallback && (
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
                    <h2 className="text-2xl font-bold text-white mb-3 tracking-tight">
                        {t('player.playbackError', { defaultValue: 'Playback Error' })}
                    </h2>
                    <p className="text-white/50 mb-8 max-w-sm text-sm leading-relaxed">{error}</p>
                    <div className="flex flex-col items-center gap-3">
                        <button
                            onClick={() => setRetryCount(c => c + 1)}
                            className="px-8 py-3 bg-white text-black font-bold text-sm rounded-full hover:bg-white/90 hover:scale-105 transition-all active:scale-95"
                        >
                            {t('player.retryConnection', { defaultValue: 'Retry Connection' })}
                        </button>
                        <button
                            onClick={onClose}
                            className="text-white/30 hover:text-white/70 text-sm transition-colors mt-1"
                        >
                            {t('player.exitPlayer', { defaultValue: 'Exit Player' })}
                        </button>
                    </div>
                </div>
            )}



            {!HIDE_CUSTOM_UI && !isMobile && showPausedOverlay && !isBuffering && isVideoReady && !error && (
                <div className="absolute inset-0 pointer-events-none flex flex-col justify-center p-12 z-[50] bg-black/60">
                    <div className="flex flex-col gap-1 max-w-2xl ml-24">
                        <p className="text-white/80 text-[1.1rem] font-normal tracking-wide drop-shadow-md">
                            {t('player.youreWatching', { defaultValue: "You're watching" })}
                        </p>
                        <h1 className="text-white text-6xl font-bold tracking-tight mb-2 drop-shadow-lg">{title}</h1>

                        {mediaType === 'tv' && (
                            <>
                                <h2 className="text-white font-bold text-2xl mt-1 drop-shadow-md">
                                    {t('player.season', { defaultValue: 'Season' })} {playingSeasonNumber}
                                </h2>
                                <h3 className="text-white font-bold text-xl mt-3 drop-shadow-md">{currentEpisodeName}: Ep. {currentEpisode}</h3>
                            </>
                        )}

                        <p className="text-white/90 text-[1.1rem] mt-3 leading-relaxed line-clamp-3 drop-shadow-md max-w-xl">
                            {mediaType === 'tv' ? (currentSeasonEpisodes.find(ep => ep.episode_number === currentEpisode)?.overview || movie.overview) : movie.overview}
                        </p>
                    </div>
                    <div className="absolute bottom-12 right-16">
                        <span className="text-white/80 text-[1.2rem] font-medium tracking-wide drop-shadow-md">
                            {t('player.paused', { defaultValue: 'Paused' })}
                        </span>
                    </div>
                </div>
            )}

            {!HIDE_CUSTOM_UI && (
                <>
                    <VideoPlayerControls
                        isEmbedFallback={useEmbedFallback}
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
                        onPlayPause={() => {
                            if (useEmbedFallback) {
                                setIsPlaying(prev => !prev);
                            } else if (videoRef.current?.paused) {
                                videoRef.current.muted = false;
                                videoRef.current.play();
                            } else {
                                videoRef.current?.pause();
                            }
                        }}
                        onSeek={(amt) => {
                            if (useEmbedFallback) {
                                // Best-effort: broadcast seek to current time + amt
                                const target = Math.max(0, currentTime + amt);
                                embedControllerRef.current?.seek(target);
                                setCurrentTime(target);
                                setProgress(duration > 0 ? (target / duration) * 100 : 0);
                            } else {
                                videoRef.current && (videoRef.current.currentTime += amt);
                            }
                        }}
                        volume={volume}
                        onVolumeChange={(v) => {
                            if (useEmbedFallback) {
                                setVolume(v);
                            } else if (videoRef.current) {
                                videoRef.current.volume = v;
                                if (v > 0) videoRef.current.muted = false;
                            }
                        }}
                        onToggleMute={() => {
                            const nextMuted = !isMuted;
                            userMutedRef.current = nextMuted;
                            setIsMuted(nextMuted);
                            if (useEmbedFallback) {
                                embedControllerRef.current?.setMuted(nextMuted);
                            } else if (videoRef.current) {
                                videoRef.current.muted = nextMuted;
                            }
                        }}
                        onTimelineSeek={(p) => {
                            if (useEmbedFallback) {
                                // Best-effort: broadcast seek. Actual seeking depends on provider support.
                                const target = (p / 100) * (duration || estimatedDurationRef.current);
                                embedControllerRef.current?.seek(target);
                                setCurrentTime(target);
                                setProgress(p);
                            } else {
                                videoRef.current && (videoRef.current.currentTime = (p / 100) * videoRef.current.duration);
                            }
                        }}
                        onToggleFullscreen={toggleFullscreen}
                        onClose={onClose || (() => window.history.back())}
                        activePanel={activePanel}
                        setActivePanel={setActivePanel}
                        mediaType={mediaType}
                        hasNextEpisode={!!nextEpisodeInfo}
                        onNextEpisode={() => {
                            handleNextEpisode();
                        }}
                        hasPreviousEpisode={!!previousEpisodeInfo}
                        onPrevEpisode={() => {
                            handlePreviousEpisode();
                        }}
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
                        skipSegments={skipSegments}
                        onSkipSegment={handleSkipSegment}
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
                                }).catch(() => { });
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
                            allSources={useEmbedFallback ? embedSourcesMapped : allSources}
                            currentSourceIndex={useEmbedFallback ? embedProviderIndex : currentSourceIndex}
                            onSourceChange={useEmbedFallback ? setEmbedProviderIndex : handleSourceChange}
                            showTitle={title || movie.title || movie.name}
                            videoDuration={duration}
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
                                }).catch(() => { });
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
                            allSources={useEmbedFallback ? embedSourcesMapped : allSources}
                            currentSourceIndex={useEmbedFallback ? embedProviderIndex : currentSourceIndex}
                            onSourceChange={useEmbedFallback ? setEmbedProviderIndex : handleSourceChange}
                            showTitle={title || movie.title || movie.name}
                            videoDuration={duration}
                        />
                    )}
                </>
            )}

            {HIDE_CUSTOM_UI && (
                <div className="absolute top-8 left-8 z-[20002] pointer-events-auto">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            if (onClose) onClose();
                            else window.history.back();
                        }}
                        className="flex items-center justify-center text-white/80 hover:text-white hover:scale-110 transition-all p-2 bg-zinc-950/60 backdrop-blur-md rounded-full shadow-2xl border border-white/10"
                        aria-label="Close player"
                        style={{ width: 50, height: 50 }}
                    >
                        <ArrowLeftIcon size={32} weight="bold" />
                    </button>
                </div>
            )}

        </div>
    );
};

export default VideoPlayer;
