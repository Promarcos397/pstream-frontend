import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Movie, Episode } from '../types';
import { getSeasonDetails, getMovieDetails, getStream, getExternalIds, prefetchStream } from '../services/api';
import ISO6391 from 'iso-639-1';

import { useGlobalContext } from '../context/GlobalContext';
import { useSubtitleStyle } from '../hooks/useSubtitleStyle';
import { useTitle } from '../context/TitleContext';
import { streamCache } from '../utils/streamCache';
import { useTouchGestures } from '../hooks/useTouchGestures';
import { useIsMobile } from '../hooks/useIsMobile';
import { SubtitleService } from '../services/SubtitleService';
import { SkipService, SkipSegment } from '../services/SkipService';
import { useHls } from '../hooks/useHls';
import { reportStreamError, reportStreamSuccess } from '../services/ProviderHealthService';
import { useDebridStream } from '../hooks/useDebridStream';

// Giga Engine Backend URL
const GIGA_BACKEND_URL = import.meta.env.VITE_GIGA_BACKEND_URL || 'https://ibrahimar397-pstream-giga.hf.space';

// These CDN hosts can only be reached via proxy â€” they do NOT block datacenter IPs.
// VaPlayer/vidzee CDN domains rotate and block datacenter IPs, so they use noProxy:true
// (direct browser fetch) â€” do NOT add them here.
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
import { CaretRightIcon } from '@phosphor-icons/react';

interface VideoPlayerProps {
    movie: Movie;
    season?: number;
    episode?: number;
    /** Seek to this time (seconds) when the video starts â€” restores watch progress */
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
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [showUI, setShowUI] = useState(true);
    const showUIRef = useRef(true);
    useEffect(() => { showUIRef.current = showUI; }, [showUI]);

    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isPseudoFullscreen, setIsPseudoFullscreen] = useState(false);
    const [isVideoReady, setIsVideoReady] = useState(false); // gates subtitle rendering on first canplay
    const [videoFit, setVideoFit] = useState<'contain' | 'cover'>('contain');
    const hasPlayedOnceRef = useRef(false); // persists across subtitle track changes (unlike isVideoReady)
    const [loadingMessage, setLoadingMessage] = useState('Finding stream...');
    const [streamUrl, setStreamUrl] = useState<string | null>(null);
    const [streamReferer, setStreamReferer] = useState<string | null>(null);
    const [allSources, setAllSources] = useState<any[]>([]);
    const [currentSourceIndex, setCurrentSourceIndex] = useState(0);
    const [isStreamM3U8, setIsStreamM3U8] = useState<boolean>(true);
    const [isEmbed, setIsEmbed] = useState<boolean>(false);
    // â”€â”€â”€ Retry guard: max backend refetches per episode load â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

    // â”€â”€â”€ Torrent fallback â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // Triggered silently after MAX_STREAM_RETRIES, only for logged-in users.
    const debridStream = useDebridStream();
    const [premiumAttempted, setPremiumAttempted] = useState(false);

    // TV Show state
    const mediaType = movie.media_type || (movie.first_air_date ? 'tv' : 'movie');
    const [currentEpisode, setCurrentEpisode] = useState(episode);
    const [playingSeasonNumber, setPlayingSeasonNumber] = useState(season);
    const [browsedSeasonNumber, setBrowsedSeasonNumber] = useState(season);
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

    // â”€â”€â”€ Fullscreen toggle â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

    // â”€â”€â”€ Track fullscreen state changes from browser â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

    // â”€â”€â”€ URL deep-link sync â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // Keep the address bar in sync so users can share/bookmark a specific episode.
    // Uses replaceState (not pushState) to avoid polluting browser history on every
    // episode switch. Movies don't need query params â€” their URL is already canonical.
    useEffect(() => {
        if (mediaType !== 'tv') return;
        const url = new URL(window.location.href);
        url.searchParams.set('season', String(playingSeasonNumber));
        url.searchParams.set('episode', String(currentEpisode));
        window.history.replaceState(null, '', url.toString());
    }, [mediaType, playingSeasonNumber, currentEpisode]);

    // Navigation state
    const [activePanel, setActivePanel] = useState<'none' | 'episodes' | 'seasons' | 'audioSubtitles' | 'quality' | 'servers'>('none');

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

    // â”€â”€â”€ Compute next episode / season â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // Single canonical declaration â€” used by Media Session, auto-next trigger, and controls.
    const nextEpisodeInfo = useMemo<{ episode: Episode; season: number } | null>(() => {
        if (mediaType !== 'tv') return null;
        // Find current episode index within the loaded season episode list
        const currentIdx = currentSeasonEpisodes.findIndex(ep => ep.episode_number === currentEpisode);
        // Case 1: There is a next episode in this same season
        if (currentIdx !== -1 && currentIdx < currentSeasonEpisodes.length - 1) {
            return { episode: currentSeasonEpisodes[currentIdx + 1], season: playingSeasonNumber };
        }
        // Case 2: Last episode of the season â€” find the next season
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

    // â”€â”€â”€ Media Session API â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
            ? `S${playingSeasonNumber} E${currentEpisode} â€“ ${epName}`
            : (movie.release_date || movie.first_air_date || '').slice(0, 4) || 'Pstream';
        const notificationAlbum = mediaType === 'tv' ? `Season ${playingSeasonNumber}` : 'Movie';

        // Use TMDB backdrop for all platforms (wide 16:9 â€” best for notifications)
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

    // Skips
    const [skipSegments, setSkipSegments] = useState<SkipSegment[]>([]);
    const [showSkipIntro, setShowSkipIntro] = useState(false);
    const [showSkipOutro, setShowSkipOutro] = useState(false);
    const [activeSkipSegment, setActiveSkipSegment] = useState<SkipSegment | null>(null);

    // Derived data
    const title = movie.title || movie.name || '';
    const formattedDate = movie.release_date || movie.first_air_date || '';
    const currentEpisodeName = currentSeasonEpisodes.find(ep => ep.episode_number === currentEpisode)?.name || '';

    // â”€â”€â”€ Touch gestures â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // Double-tap left/right = Â±10s seek; double-tap center = play/pause
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

    // â”€â”€â”€ (nextEpisodeInfo is declared above â€” single canonical useMemo) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    // â”€â”€â”€ Apply stream result â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const applyStreamResult = useCallback((sources: any[], subtitles: any[], globalReferer?: string | null) => {
        if (!sources || sources.length === 0) return;
        setError(null);

        // "Torrent Preferred Always" â€” If premium already landed, prepend it to the list
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

        // "Torrent Preferred Always" â€” If we are already playing a premium source,
        // don't let regular scrapers auto-switch and interrupt the experience.
        const currentSource = allSources[currentSourceIndex];
        if (currentSource?.providerId === 'premium' && !isBuffering) {
            console.log('[VideoPlayer] ðŸ’Ž Premium stream active. Ignoring regular scraper result.');
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
            // All sources are in cooldown â€” use the one whose cooldown expires soonest
            if (i === sources.length - 1) {
                console.warn('[VideoPlayer] All fresh sources are in cooldown â€” clearing cooldowns and retrying from 0');
                sourceFailureCooldownRef.current.clear();
                startIndex = 0;
            }
        }
        if (startIndex > 0) {
            console.log(`[VideoPlayer] â­ï¸ Skipping ${startIndex} cooldown source(s), starting at index ${startIndex}`);
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
                // noProxy: send URL directly to HLS.js (CDN is IP-locked â€” browser fetch works, server proxy fails)
                finalUrl = hlsSource.url;
                console.log(`[VideoPlayer] âš¡ Direct (no-proxy) stream: ${finalUrl.substring(0, 60)}...`);
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
        setLoadingMessage(`Loading video from ${hlsSource.provider || 'Server'}...`);

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
            setTimeout(() => setIsBuffering(false), 1500);
        }
    }, [settings.subtitleLanguage, settings.showSubtitles, debridStream.streamUrl, debridStream.quality]);

    // â”€â”€â”€ Manual source change â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
        console.log(`[VideoPlayer] ðŸ”„ Manual server change to: ${candidate.provider}`);
        setCurrentSourceIndex(index);
        retryCooldownUntilRef.current = 0;
        setError(null);
        setIsBuffering(true);
        setLoadingMessage(`Switching to ${candidate.provider || 'Server'}...`);
        reportedSuccessRef.current = null;

        // âš ï¸ Do NOT call applyStreamResult here â€” it overwrites allSources with a single element,
        // destroying the remaining sources and breaking subsequent source cycling.
        // Instead, apply the URL/stream state directly.
        const isEmbedFallback = !!candidate.isEmbed;
        setIsEmbed(isEmbedFallback);
        const activeReferer = candidate.referer || '';
        const forceProxy = shouldForceProxy(candidate);
        let finalUrl = candidate.url;
        if (!isEmbedFallback) {
            if (candidate.noProxy && !forceProxy) {
                finalUrl = candidate.url;
                console.log(`[VideoPlayer] âš¡ Direct (no-proxy) stream: ${finalUrl.substring(0, 60)}...`);
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
        if (isEmbedFallback) setTimeout(() => setIsBuffering(false), 1500);
    }, [allSources]);

    // â”€â”€â”€ Episode Selection â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

    // Cleaned up auto-next logic

    // â”€â”€â”€ Track episode/season prop changes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    useEffect(() => {
        if (season !== playingSeasonNumber) setPlayingSeasonNumber(season);
        if (episode !== currentEpisode) setCurrentEpisode(episode);
    }, [season, episode]);

    // â”€â”€â”€ Keyboard shortcuts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
                    videoRef.current?.paused ? videoRef.current.play() : videoRef.current?.pause();
                    break;
                case 'ArrowRight':
                case 'l':
                    e.preventDefault();
                    if (videoRef.current) videoRef.current.currentTime += 10;
                    break;
                case 'ArrowLeft':
                case 'j':
                    e.preventDefault();
                    if (videoRef.current) videoRef.current.currentTime -= 10;
                    break;
                case 'ArrowUp':
                case 'ArrowDown':
                    e.preventDefault();
                    if (videoRef.current) videoRef.current.volume = Math.max(0, videoRef.current.volume - 0.1);
                    break;
                case 'f':
                    e.preventDefault();
                    toggleFullscreen();
                    break;
                case 'm':
                    e.preventDefault();
                    if (videoRef.current) videoRef.current.muted = !videoRef.current.muted;
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

    // â”€â”€â”€ AllDebrid / Torrent: Primary Source â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
        setLoadingMessage('Finding best source...');
    }, [movie.id, mediaType, playingSeasonNumber, currentEpisode]);

    // Fire torrent resolver on mount
    useEffect(() => {
        const type: 'movie' | 'tv' = mediaType === 'tv' ? 'tv' : 'movie';
        const searchTitle = movie.title || movie.name || '';
        console.log(`[VideoPlayer] ðŸŽ¯ AllDebrid resolver: ${searchTitle} (${type})`);

        const slowTimer = setTimeout(() => setLoadingMessage('Still finding source...'), 5000);

        const doResolve = (imdbId: string) => {
            debridStream.resolve(
                imdbId,
                type,
                mediaType === 'tv' ? playingSeasonNumber : undefined,
                mediaType === 'tv' ? currentEpisode : undefined,
                undefined,
                searchTitle
            ).then(result => {
                clearTimeout(slowTimer);
                if (!result) {
                    // AllDebrid couldn't find it â€” fall back to extractors
                    console.log('[VideoPlayer] AllDebrid: no result â€” activating extractor fallback.');
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

        return () => clearTimeout(slowTimer);
    }, [movie.id, mediaType, playingSeasonNumber, currentEpisode]);

    // Apply AllDebrid stream when resolved
    useEffect(() => {
        if (!debridStream.streamUrl) return;

        setError(null);
        standardErrorRef.current = null;

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

        // Torrent is preferred always:
        // Prepend it to allSources so it's the first one in the list for manual switching too.
        setAllSources(prev => {
            const alreadyHasPremium = prev.some(s => s.providerId === 'premium');
            if (alreadyHasPremium) return prev;
            return [premiumSource, ...prev];
        });

        // Always switch to it â€” use functional update to avoid stale streamUrl closure
        setStreamUrl(prev => {
            if (prev === premiumSource.url) return prev; // already playing, no-op
            setLoadingMessage('Premium Ultra High-speed source found â€” connecting...');
            setCurrentSourceIndex(0);
            setIsStreamM3U8(false);
            setIsBuffering(true);
            return premiumSource.url;
        });
    }, [debridStream.streamUrl]);

    // â”€â”€â”€ Skip Segments (TV only) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    useEffect(() => {
        const fetchSkips = async () => {
            if (mediaType === 'tv') {
                const segments = await SkipService.getSkipSegments(String(movie.id), playingSeasonNumber, currentEpisode);
                setSkipSegments(segments);
            } else {
                setSkipSegments([]);
            }
        };
        fetchSkips();
    }, [movie.id, mediaType, playingSeasonNumber, currentEpisode]);

    // â”€â”€â”€ Prefetch next episode at 30%+ progress â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // Fires for ALL episode lengths (removed the >=3600s gate â€” a 22-min episode
    // still needs its next episode preloaded). Threshold lowered 50â†’30% so on
    // slow connections there's more runway before autoplay transition.
    useEffect(() => {
        if (mediaType !== 'tv' || !nextEpisodeInfo) return;
        if (progress < 30 || duration < 60) return; // skip first 60s guard

        const nextEp = nextEpisodeInfo.episode;
        const nextSeason = nextEpisodeInfo.season;
        const releaseYear = formattedDate ? parseInt(formattedDate.split('-')[0]) : undefined;

        const cacheKey = {
            title,
            type: 'tv' as const,
            year: releaseYear,
            season: nextSeason,
            episode: nextEp.episode_number,
            tmdbId: String(movie.id)
        };
        const cacheKeyStr = JSON.stringify(cacheKey);

        if (!streamCache.get(cacheKey) && !prefetchedNextEpsRef.current.has(cacheKeyStr)) {
            prefetchedNextEpsRef.current.add(cacheKeyStr);
            console.log(`[VideoPlayer] ðŸ”® Prefetching S${nextSeason}E${nextEp.episode_number} at ${Math.round(progress)}%...`);
            prefetchStream(title, releaseYear || 0, String(movie.id), 'tv', nextSeason, nextEp.episode_number)
                .catch(() => {});
        }
    }, [progress, duration, mediaType, nextEpisodeInfo]);

    // â”€â”€â”€ HLS Hook â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
        streamUrl,
        isM3U8: isStreamM3U8,
        streamReferer: streamReferer,
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
            // Auto fullscreen on mobile â€” only on first load
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

            // Torrent/AllDebrid stream â€” never retry on 403, CDN errors are transient
            if (activeProviderId === 'torrent') {
                console.warn('[VideoPlayer] 403 on AllDebrid stream â€” ignoring.');
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
                console.log(`[VideoPlayer] ðŸ”„ 403 on source ${currentSourceIndex} â†’ trying source ${nextIdx}`);
                handleSourceChange(nextIdx);
            } else if (retryCountRef.current < MAX_STREAM_RETRIES) {
                if (Date.now() < retryCooldownUntilRef.current) {
                    console.log('[VideoPlayer] â¸ Retry cooldown active â€” waiting before backend re-fetch.');
                    return;
                }
                retryCountRef.current += 1;
                const exponentialDelay = Math.min(RETRY_BASE_DELAY_MS * (2 ** (retryCountRef.current - 1)), RETRY_MAX_DELAY_MS);
                const jitter = Math.floor(Math.random() * 400);
                const waitMs = exponentialDelay + jitter;
                retryCooldownUntilRef.current = Date.now() + waitMs;
                console.log(`[VideoPlayer] ðŸ” All sources failed, busting cache + backend re-fetch #${retryCountRef.current}`);
                // âš ï¸ CRITICAL: Bust the cache so re-fetch doesn't return the same blocked URLs.
                // The cache has no way to know a URL is 403-blocked (no expiry param).
                if (cacheKeyRef.current) {
                    streamCache.remove(cacheKeyRef.current);
                    console.log(`[VideoPlayer] ðŸ—‘ï¸ Cache busted for blocked stream`);
                }
                // Reset source index so cycling restarts from 0 on the fresh sources
                setCurrentSourceIndex(0);
                setTimeout(() => {
                    setRetryCount(c => c + 1);
                }, waitMs);
            } else {
                console.warn(`[VideoPlayer] âŒ Max retries (${MAX_STREAM_RETRIES}) reached â€” activating extractor fallback.`);
                if (!extractorEnabled) {
                    setExtractorEnabled(true);
                    setLoadingMessage('Searching backup sources...');
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

            // Torrent/AllDebrid stream errors are transient â€” don't retry with extractors
            if (activeProviderId === 'torrent') {
                console.warn('[VideoPlayer] Error on AllDebrid stream â€” ignoring.');
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
                error: errMsg,
                errorCode: 'HLS_GENERIC_ERROR'
            });
            if (currentSourceIndex < allSources.length - 1) {
                handleSourceChange(currentSourceIndex + 1);
            } else if (user && !premiumAttempted) {
                console.log('[VideoPlayer] ðŸ’Ž All sources errored â€” activating premium fallback...');
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

    // â”€â”€â”€ Seek to resume time on load â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
                console.log(`[VideoPlayer] â–¶ Resuming from ${Math.round(t)}s`);
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

    // â”€â”€â”€ Time Update & History â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const handleTimeUpdate = useCallback(() => {
        const video = videoRef.current;
        if (!video || isNaN(video.duration) || video.duration === 0) return;

        const time = video.currentTime;
        const dur = video.duration;
        setCurrentTime(time);
        setDuration(dur);
        setProgress((time / dur) * 100);

        // Skip detection
        const intro = skipSegments.find(s => s.type === 'intro' && time >= s.startTime && time <= (s.endTime - 2));
        const outro = skipSegments.find(s => s.type === 'outro' && time >= (s.startTime - 10));
        setShowSkipIntro(!!intro);
        setShowSkipOutro(!!outro);
        setActiveSkipSegment(intro || null);

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
    }, [mediaType, movie.id, playingSeasonNumber, currentEpisode, skipSegments, addToHistory, updateEpisodeProgress, updateVideoState]);

    // â”€â”€â”€ Instant progress save on manual scrub â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // timeupdate only fires every ~250ms and has a 5s throttle gate â€” so if the
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

    // Subtitle management below...

    // â”€â”€â”€ Custom Subtitle Cue Engine â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

                // Immediately snap to the cue at current playtime â€” no waiting for next timeupdate.
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



    // â”€â”€â”€ TV Details init (two separate effects to avoid double-fetching) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // Effect 1: Fetch season list once â€” only needs movie.id and mediaType
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

    // â”€â”€â”€ UI show/hide â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

    // â”€â”€â”€ Touch Gestures â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    useTouchGestures(containerRef, {
        onSingleTap: () => {
            lastTouchTimeRef.current = Date.now();
            toggleUI();
        },
        onDoubleTapCenter: () => {
            lastTouchTimeRef.current = Date.now();
            videoRef.current?.paused ? videoRef.current.play() : videoRef.current?.pause();
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
            className={`fixed z-[100] flex flex-col font-sans select-none overflow-hidden bg-black ${isPseudoFullscreen ? 'inset-0' : (isFullscreen ? '' : 'inset-0')}`}
            style={isPseudoFullscreen ? { position: 'fixed', zIndex: 9999 } : {}}
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
                        setVolume(videoRef.current.volume);
                        setIsMuted(videoRef.current.muted);
                    }
                }}
                playsInline
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
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 z-10 pointer-events-none">
                    <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin mb-4" />
                    <p className="text-white/60 text-sm font-medium tracking-widest uppercase">{loadingMessage}</p>
                </div>
            )}

            {error && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 z-20 text-center px-6">
                    <h2 className="text-2xl font-bold text-white mb-4">Playback Error</h2>
                    <p className="text-white/60 mb-8 max-w-md">{error}</p>
                    <button onClick={() => setRetryCount(c => c + 1)} className="px-8 py-3 bg-white text-black font-bold rounded-full hover:scale-105 transition">Retry Connection</button>
                    <button onClick={onClose} className="mt-4 text-white/40 hover:text-white transition">Exit Player</button>
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
                onToggleMute={() => videoRef.current && (videoRef.current.muted = !videoRef.current.muted)}
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
                    allSources={allSources}
                    currentSourceIndex={currentSourceIndex}
                    onSourceChange={handleSourceChange}
                />
            )}

            {/* â”€â”€ Skip Intro pill â”€â”€ */}
            {showSkipIntro && activeSkipSegment && (
                <button
                    onClick={() => {
                        if (videoRef.current) videoRef.current.currentTime = activeSkipSegment.endTime;
                        setShowSkipIntro(false);
                    }}
                    className="absolute z-40 pointer-events-auto flex items-center gap-2 transition-opacity hover:opacity-90 active:scale-95"
                    style={{
                        bottom: isMobile ? 90 : 110,
                        right: isMobile ? 16 : 40,
                        padding: isMobile ? '9px 20px' : '11px 26px',
                        background: 'rgba(255,255,255,0.95)',
                        color: '#000',
                        border: 'none',
                        borderRadius: 9999,
                        fontWeight: 700,
                        fontSize: isMobile ? 13 : 15,
                        cursor: 'pointer',
                        letterSpacing: '0.01em',
                        fontFamily: 'Consolas, monospace',
                        boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
                        animation: 'slide-in-right 0.3s cubic-bezier(0.22, 1, 0.36, 1) forwards',
                        whiteSpace: 'nowrap',
                    }}
                >
                    <svg viewBox="0 0 24 24" style={{ width: 15, height: 15, fill: '#000', flexShrink: 0 }}><path d="M8 5v14l11-7z"/></svg>
                    Skip Intro
                </button>
            )}

            {/* Auto-Next removed as requested */}
        </div>
    );
};

export default VideoPlayer;
