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
import { parseSubtitles, CaptionCueType } from '../utils/captions';


const GIGA_BACKEND_URL = import.meta.env.VITE_GIGA_BACKEND_URL || 'https://ibrahimar397-pstream-giga.hf.space';
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
    resumeTime?: number;
    onClose?: () => void;
}

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
            elem.webkitEnterFullscreen();
        }
    } catch (e) { }
}
// we need to do webkit-requestfullscreen as well and it should go fullscreen
// and when we exit fullscreen we need to do webkit-exit-fullscreen as well
const VideoPlayer: React.FC<VideoPlayerProps> = ({ movie, season = 1, episode = 1, resumeTime = 0, onClose }) => {
    const HIDE_CUSTOM_UI = false; 
    const { t } = useTranslation();
    const { user, settings, updateEpisodeProgress, getEpisodeProgress, updateVideoState, addToHistory, getVideoState, setActiveVideoId } = useGlobalContext();
    const { setPageTitle } = useTitle();
    const isMobile = useIsMobile();
    const { overlayStyle, enabled: subsEnabled } = useSubtitleStyle();
    const mediaType = movie.media_type || (movie.first_air_date ? 'tv' : 'movie');
    const videoRef = useRef<HTMLVideoElement>(null);
    const embedControllerRef = useRef<EmbedController | null>(null);
    const estimatedDurationRef = useRef(mediaType === 'tv' ? 2700 : 7200);
    const containerRef = useRef<HTMLDivElement>(null);
    const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
    const lastSavedTimeRef = useRef<number>(0);
    const hasAutoFullscreenedRef = useRef(false);
    const [bufferedAmount, setBufferedAmount] = useState<number>(0);

    const [isPlaying, setIsPlaying] = useState(false);
    const [isBuffering, setIsBuffering] = useState(true);
    const [currentTime, setCurrentTime] = useState(0);
    const currentTimeRef = useRef(0);
    
    // SAFETY LOCK 1: Prevents double-firing of "Next Episode" 
    const isTransitioningRef = useRef(false);

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
    const [isMuted, setIsMuted] = useState(false); 
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
    const [isVideoReady, setIsVideoReady] = useState(false); 
    const [videoFit, setVideoFit] = useState<'contain' | 'cover'>('contain');
    const hasPlayedOnceRef = useRef(false); 
    const volumeRef = useRef((() => {
        try {
            const stored = parseFloat(localStorage.getItem('pstream_vol') || '1');
            return isFinite(stored) && stored >= 0.05 && stored <= 1 ? stored : 1;
        } catch { return 1; }
    })()); 
    useEffect(() => {
        volumeRef.current = volume;
        try {
            if (volume > 0) {
                localStorage.setItem('pstream_vol', String(volume));
            }
        } catch { }
    }, [volume]);
    const mutedRef = useRef(false); 
    const userMutedRef = useRef(false); 
    const [loadingMessage, setLoadingMessage] = useState('Finding stream...');
    const [streamUrl, setStreamUrl] = useState<string | null>(null);
    const [streamReferer, setStreamReferer] = useState<string | null>(null);
    const [allSources, setAllSources] = useState<any[]>([]);
    const [currentSourceIndex, setCurrentSourceIndex] = useState(0);
    const [isStreamM3U8, setIsStreamM3U8] = useState<boolean>(true);
    const [isEmbed, setIsEmbed] = useState<boolean>(false);
    
    const MAX_STREAM_RETRIES = 3;
    const retryCountRef = useRef(0);
    const [retryCount, setRetryCount] = useState(0);
    const retryCooldownUntilRef = useRef(0);
    const sourceFailureCooldownRef = useRef<Map<string, number>>(new Map());
    const cacheKeyRef = useRef<import('../utils/streamCache').CacheKey | null>(null);
    const [error, setError] = useState<string | null>(null);
    const reportedSuccessRef = useRef<string | null>(null);
    const prefetchedNextEpsRef = useRef<Set<string>>(new Set());
    const standardErrorRef = useRef<string | null>(null);

    const [internalTracks, setInternalTracks] = useState<InternalTrack[]>([]);
    const [selectedAudioTrackId, setSelectedAudioTrackId] = useState<number | null>(null);
    const [selectedSubtitleTrackId, setSelectedSubtitleTrackId] = useState<number | null>(null);

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
            // Unlock transitions safely
            isTransitioningRef.current = false;
        }
    }, [streamUrl]);

    const [currentEpisode, setCurrentEpisode] = useState(episode);
    const [playingSeasonNumber, setPlayingSeasonNumber] = useState(season);
    const [browsedSeasonNumber, setBrowsedSeasonNumber] = useState(season || 1);
    const [ppRippleTrigger, setPpRippleTrigger] = useState(0);
    const [seekFlash, setSeekFlash] = useState<{ side: 'left' | 'right'; ts: number } | null>(null);
    const [seasonList, setSeasonList] = useState<number[]>([]);
    const [currentSeasonEpisodes, setCurrentSeasonEpisodes] = useState<Episode[]>([]);

    useEffect(() => {
        retryCountRef.current = 0;
        setRetryCount(0);
        retryCooldownUntilRef.current = 0;
        sourceFailureCooldownRef.current.clear();
        hasPlayedOnceRef.current = false; 
        reportedSuccessRef.current = null;
        setUseEmbedFallback(true); 
        setEmbedProviderIndex(0); 
    }, [movie.id, mediaType, playingSeasonNumber, currentEpisode]);

    const toggleFullscreen = useCallback(() => {
        const el = containerRef.current as any;
        const doc = document as any;
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
                setIsPseudoFullscreen(true);
            } else if ((videoRef.current as any)?.webkitEnterFullscreen) {
                (videoRef.current as any).webkitEnterFullscreen();
            }
            setIsFullscreen(true);
        }
    }, [isFullscreen, isPseudoFullscreen]);

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

    // SAFETY LOCK 2: Prevents stale props from wrapper resetting user progress
    const lastSyncedUrlRef = useRef({ s: season, e: episode });

    useEffect(() => {
        if (mediaType !== 'tv') return;
        const url = new URL(window.location.href);
        url.searchParams.set('season', String(playingSeasonNumber));
        url.searchParams.set('episode', String(currentEpisode));
        window.history.replaceState(null, '', url.toString());
        
        lastSyncedUrlRef.current = { s: playingSeasonNumber, e: currentEpisode };
    }, [mediaType, playingSeasonNumber, currentEpisode]);

    const [activePanel, setActivePanel] = useState<'none' | 'episodes' | 'seasons' | 'audioSubtitles' | 'quality' | 'servers' | 'playback'>('none');

    const [captions, setCaptions] = useState<{ id: string; label: string; url: string; lang: string; duration?: number }[]>([]);
    const [currentCaption, setCurrentCaption] = useState<string | null>(null);
    const [subtitleObjectUrl, setSubtitleObjectUrl] = useState<string | null>(null);
    const [subtitleOffset, setSubtitleOffset] = useState(0);

    useEffect(() => {
        const backdrop = movie.backdrop_path ? `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}` : '';
        (window as any).__video_backdrop = backdrop;
    }, [movie.id]);

    const nextEpisodeInfo = useMemo<{ episode: Episode; season: number } | null>(() => {
        if (mediaType !== 'tv') return null;
        if (currentSeasonEpisodes.length === 0 || currentSeasonEpisodes[0].season_number !== playingSeasonNumber) {
            return null;
        }
        const currentIdx = currentSeasonEpisodes.findIndex(ep => ep.episode_number === currentEpisode);
        if (currentIdx !== -1 && currentIdx < currentSeasonEpisodes.length - 1) {
            return { episode: currentSeasonEpisodes[currentIdx + 1]!, season: playingSeasonNumber };
        }
        const nextSeason = seasonList.find(s => s > playingSeasonNumber);
        if (nextSeason !== undefined) {
            return {
                episode: { id: -1, episode_number: 1, name: 'Next Season', season_number: nextSeason } as Episode,
                season: nextSeason,
            };
        }
        return null;
    }, [mediaType, currentSeasonEpisodes, currentEpisode, playingSeasonNumber, seasonList]);

    const previousEpisodeInfo = useMemo<{ episode: Episode; season: number } | null>(() => {
        if (mediaType !== 'tv') return null;
        if (currentSeasonEpisodes.length === 0 || currentSeasonEpisodes[0].season_number !== playingSeasonNumber) {
            return null;
        }
        const currentIdx = currentSeasonEpisodes.findIndex(ep => ep.episode_number === currentEpisode);
        if (currentIdx > 0) {
            return { episode: currentSeasonEpisodes[currentIdx - 1]!, season: playingSeasonNumber };
        }
        const prevSeason = [...seasonList].reverse().find(s => s < playingSeasonNumber);
        if (prevSeason !== undefined) {
            return {
                episode: { id: -1, episode_number: 99, name: 'Previous Season', season_number: prevSeason } as Episode,
                season: prevSeason,
            };
        }
        return null;
    }, [mediaType, currentSeasonEpisodes, currentEpisode, playingSeasonNumber, seasonList]);

    useEffect(() => {
        if (!('mediaSession' in navigator)) return;

        const showTitle = movie.title || movie.name || '';
        const epName = currentSeasonEpisodes.find(ep => ep.episode_number === currentEpisode)?.name || '';

        const notificationTitle = showTitle;
        const notificationArtist = mediaType === 'tv' && epName
            ? `S${playingSeasonNumber} E${currentEpisode} — ${epName}`
            : (movie.release_date || movie.first_air_date || '').slice(0, 4) || 'Pstream';
        const notificationAlbum = mediaType === 'tv' ? `Season ${playingSeasonNumber}` : 'Movie';

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

        navigator.mediaSession.setActionHandler('play', () => { setIsPlaying(true); });
        navigator.mediaSession.setActionHandler('pause', () => { setIsPlaying(false); });
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
    const [currentCueSettings, setCurrentCueSettings] = useState<CaptionCueType['settings'] | undefined>(undefined);

    const isDialogue = useMemo(() => {
        if (!currentCueText) return false;
        const lines = currentCueText.split(/\r?\n|<br\s*\/?>/i);
        if (lines.length < 2) return false;
        return lines.some(line => {
            const clean = line.replace(/<\/?[^>]+(>|$)/g, "").trim();
            return clean.startsWith('-') || clean.startsWith('–') || clean.startsWith('—');
        });
    }, [currentCueText]);

    // ——— Manual Autoplay State ———
    const [showAutoplayCountdown, setShowAutoplayCountdown] = useState(false);
    const countdownCancelledRef = useRef(false);

    const [qualityLevels, setQualityLevels] = useState<{ height: number; bitrate: number; level: number }[]>([]);
    const [currentQualityLevel, setCurrentQualityLevel] = useState<number>(-1);
    const [audioTracks, setAudioTracks] = useState<{ id: number; name: string; lang: string }[]>([]);
    const [currentAudioTrack, setCurrentAudioTrack] = useState<number>(-1);

    const { segments: skipSegments } = useSkipTimestamps(movie.imdb_id, mediaType as 'movie' | 'tv', playingSeasonNumber, currentEpisode);

    const handleSkipSegment = useCallback((segment: SkipSegment) => {
        if (useEmbedFallback) {
            embedControllerRef.current?.seek(segment.end);
        } else if (videoRef.current) {
            videoRef.current.currentTime = segment.end;
        }
    }, [useEmbedFallback]);

    const title = movie.title || movie.name || '';
    const formattedDate = movie.release_date || movie.first_air_date || '';
    const currentEpisodeName = currentSeasonEpisodes.find(ep => ep.episode_number === currentEpisode)?.name || '';

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

    const applyStreamResult = useCallback((sources: any[], subtitles: any[], globalReferer?: string | null) => {
        if (!sources || sources.length === 0) return;
        setError(null);

        setAllSources(sources);

        let startIndex = 0;
        for (let i = 0; i < sources.length; i++) {
            const candidate = sources[i];
            const sourceKey = `${candidate.providerId || candidate.provider || 'unknown'}::${candidate.url || ''}`;
            const blockedUntil = sourceFailureCooldownRef.current.get(sourceKey) || 0;
            if (blockedUntil <= Date.now()) {
                startIndex = i;
                break;
            }
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
            const isEnglishTarget = (!user && preferredLang === 'en') || preferredLang === 'en' || !user;

            let finalSub = null;
            if (isEnglishTarget) {
                const enSubs = mappedCaptions.filter((s: any) => s.lang === 'en' || s.label.toLowerCase().includes('english'));
                finalSub = enSubs.length >= 3 ? enSubs[2] : (enSubs[0] || mappedCaptions[0]);
            } else {
                finalSub = mappedCaptions.find((s: any) => s.lang.includes(preferredLang) || s.label.toLowerCase().includes(preferredLang));
                if (!finalSub) {
                    const enSubs = mappedCaptions.filter((s: any) => s.lang === 'en' || s.label.toLowerCase().includes('english'));
                    finalSub = enSubs.length >= 3 ? enSubs[2] : (enSubs[0] || mappedCaptions[0]);
                }
            }

            if (finalSub && settings.showSubtitles) {
                setCurrentCaption(finalSub.url);
            }
        }

        // Keep buffering active until EmbedPlayer communicates playback start
    }, [settings.subtitleLanguage, settings.showSubtitles]);

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
    }, [allSources]);

    const handleEpisodeSelect = useCallback(async (ep: Episode, seasonNum?: number, episodes?: Episode[]) => {
        // Lock out any accidental triggers while mounting
        isTransitioningRef.current = true;
        
        setStreamUrl(null);
        setIsBuffering(true);
        setActivePanel('none');
        
        const targetSeason = seasonNum ?? ep.season_number;
        if (targetSeason && targetSeason !== playingSeasonNumber) {
            setPlayingSeasonNumber(targetSeason);
            setBrowsedSeasonNumber(targetSeason);
            getSeasonDetails(String(movie.id), targetSeason).then(data => {
                if (data?.episodes) setCurrentSeasonEpisodes(data.episodes);
            }).catch(() => { });
        }
        if (episodes) setCurrentSeasonEpisodes(episodes);
        setCurrentEpisode(ep.episode_number);
    }, [playingSeasonNumber, movie.id]);

    const handleNextEpisode = useCallback(() => {
        if (!nextEpisodeInfo) return;
        handleEpisodeSelect(nextEpisodeInfo.episode, nextEpisodeInfo.season);
    }, [nextEpisodeInfo, handleEpisodeSelect]);

    const handlePreviousEpisode = useCallback(() => {
        if (!previousEpisodeInfo) return;

        if (previousEpisodeInfo.episode.id === -1) {
            isTransitioningRef.current = true;
            setStreamUrl(null);
            setIsBuffering(true);
            setActivePanel('none');
            const targetSeason = previousEpisodeInfo.season;
            setPlayingSeasonNumber(targetSeason);
            setBrowsedSeasonNumber(targetSeason);
            getSeasonDetails(String(movie.id), targetSeason).then(data => {
                if (data?.episodes && data.episodes.length > 0) {
                    setCurrentSeasonEpisodes(data.episodes);
                    const lastEp = data.episodes[data.episodes.length - 1]!;
                    setCurrentEpisode(lastEp.episode_number);
                }
            }).catch(() => { });
        } else {
            handleEpisodeSelect(previousEpisodeInfo.episode, previousEpisodeInfo.season);
        }
    }, [previousEpisodeInfo, handleEpisodeSelect, movie.id]);

    // Apply prop sync ONLY if the intended state has actually changed from the parent
    useEffect(() => {
        if (season === lastSyncedUrlRef.current.s && episode === lastSyncedUrlRef.current.e) return;
        
        setPlayingSeasonNumber(season);
        setCurrentEpisode(episode);
        lastSyncedUrlRef.current = { s: season, e: episode };
    }, [season, episode]);

    useEffect(() => {
        standardErrorRef.current = null;
        setIsBuffering(false); 
        setError(null);
        setStreamUrl(null);
        setAllSources([]);
        setCurrentSourceIndex(0);
        setLoadingMessage('Loading player...');
        setCaptions([]);
        setCurrentCaption(null);
        hasPlayedOnceRef.current = false;
        setCurrentTime(0);
        setDuration(0);
        setProgress(0);
        setBufferedAmount(0);
        
        countdownCancelledRef.current = false;
        setShowAutoplayCountdown(false);
        setIsVideoReady(false); // Prevent ghost popup during next-ep load
    }, [movie.id, mediaType, playingSeasonNumber, currentEpisode]);

    useEffect(() => {
        const video = videoRef.current;
        if (!video || !streamUrl) return;
        if (volumeRef.current > 0 && volumeRef.current <= 1) {
            video.volume = volumeRef.current;
        }
    }, [streamUrl]);

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

        setCaptions([]); 

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

            if (targetDuration > 0) {
                mappedCaptions.sort((a, b) => {
                    const diffA = a.duration ? Math.abs(a.duration - targetDuration) : Infinity;
                    const diffB = b.duration ? Math.abs(b.duration - targetDuration) : Infinity;

                    const aIsClose = diffA <= 90;
                    const bIsClose = diffB <= 90;
                    if (aIsClose && !bIsClose) return -1;
                    if (!aIsClose && bIsClose) return 1;

                    if (diffA !== diffB) {
                        return diffA - diffB;
                    }
                    return 0; 
                });
            }

            setCaptions(mappedCaptions);
        }).catch(() => {});

        return () => { cancelled = true; };
    }, [movie.id, mediaType, playingSeasonNumber, currentEpisode, movie.imdb_id]);

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

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;
        const onSeeked = () => {
            const time = video.currentTime;
            const dur = video.duration;
            if (!time || !dur || isNaN(dur)) return;
            lastSavedTimeRef.current = time; 
            if (mediaType === 'tv') {
                updateEpisodeProgress(movie, playingSeasonNumber, currentEpisode, time, dur);
            } else {
                updateVideoState(movie, time, undefined, dur);
            }
        };
        video.addEventListener('seeked', onSeeked);
        return () => video.removeEventListener('seeked', onSeeked);
    }, [mediaType, movie, playingSeasonNumber, currentEpisode, updateEpisodeProgress, updateVideoState]);

    const parsedCuesRef = useRef<CaptionCueType[]>([]);

    useEffect(() => {
        if (!currentCaption) {
            setSubtitleObjectUrl(prev => { if (prev) URL.revokeObjectURL(prev); return null; });
            setCurrentCueText('');
            setCurrentCueSettings(undefined);
            parsedCuesRef.current = [];
            return;
        }
        let isMounted = true;
        const loadSubtitles = async () => {
            try {
                const res = await fetch(currentCaption);
                const text = await res.text();
                if (!text || !isMounted) return;

                const cues = parseSubtitles(text);
                parsedCuesRef.current = cues;

                if (isMounted) {
                    const nowMs = (currentTime - subtitleOffset) * 1000;
                    const immediateCue = cues.find(c => nowMs >= c.start && nowMs <= c.end);
                    setCurrentCueText(immediateCue?.content || '');
                    setCurrentCueSettings(immediateCue?.settings);
                }

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
            setSubtitleObjectUrl(prev => { if (prev) URL.revokeObjectURL(prev); return null; });
        };
    }, [currentCaption]);

    useEffect(() => {
        const nowMs = (currentTime - subtitleOffset) * 1000;
        const cue = parsedCuesRef.current.find(c => nowMs >= c.start && nowMs <= c.end);
        setCurrentCueText(cue ? (cue.content || cue.text || '') : '');
        setCurrentCueSettings(cue ? cue.settings : undefined);
    }, [currentTime, subtitleOffset, subtitleObjectUrl]);

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

    useEffect(() => {
        const handleEmbedMessage = (e: MessageEvent) => {
            // Guard checking for VidAPI broadcast signature
            if (e.data?.type !== 'PLAYER_EVENT' || !e.data?.data) return;

            const { player_status, player_progress, player_duration } = e.data.data;

            // Sync local buffering state once provider initializes and plays
            if (player_status === 'playing') {
                setIsPlaying(true);
                setIsBuffering(false);
                setIsVideoReady(true);
                hasPlayedOnceRef.current = true;
            } else if (player_status === 'paused') {
                setIsPlaying(false);
            }

            // Keep local time tracker in sync for UI control rendering
            if (player_progress != null) {
                setCurrentTime(player_progress);
                currentTimeRef.current = player_progress;
            }
            if (player_duration != null && player_duration > 0) {
                setDuration(player_duration);
                setProgress((player_progress / player_duration) * 100);
            }

            // Handle auto-advancing on episode completion
            if (player_status === 'completed') {
                if (isTransitioningRef.current) return;
                
                // Safety: Only pass if user watched major chunk of video
                if (player_duration > 0 && (player_progress / player_duration) > 0.80) {
                    // Same logic as onEnded: use countdownCancelledRef so a visible
                    // popup doesn't block the advance when the embed fires 'completed'.
                    if (settings.autoplayNextEpisode && !countdownCancelledRef.current) {
                        setShowAutoplayCountdown(false);
                        handleNextEpisode();
                    }
                }
            }
        };

        window.addEventListener('message', handleEmbedMessage);
        return () => window.removeEventListener('message', handleEmbedMessage);
    }, [settings.autoplayNextEpisode, handleNextEpisode]);

    // ——— Manual Autoplay Prompt Effect —————————————————————————————————————
    const TRIGGER_PERCENT = 98.5;
    const currentProgress = duration > 0 ? (currentTime / duration) * 100 : 0;

    useEffect(() => {
        // isVideoReady gates the popup — it is reset to false on every episode change,
        // so the popup can never appear during the initial embed load / transition period.
        // hasCreditsSegment intentionally removed: percentage is the only trigger.
        if (
            !settings.autoplayNextEpisode ||
            !nextEpisodeInfo ||
            duration <= 0 ||
            mediaType !== 'tv' ||
            !isVideoReady
        ) {
            setShowAutoplayCountdown(false);
            return;
        }

        if (currentProgress < TRIGGER_PERCENT - 2) {
            countdownCancelledRef.current = false;
            setShowAutoplayCountdown(false);
        }

        if (currentProgress >= TRIGGER_PERCENT && !countdownCancelledRef.current && !showAutoplayCountdown) {
            setShowAutoplayCountdown(true);
        }
    }, [currentProgress, duration, nextEpisodeInfo, settings.autoplayNextEpisode, mediaType, isVideoReady]);

    const handleCancelAutoplay = useCallback(() => {
        countdownCancelledRef.current = true;
        setShowAutoplayCountdown(false);
    }, []);

    const handlePlayNextNow = useCallback(() => {
        setShowAutoplayCountdown(false);
        handleNextEpisode();
    }, [handleNextEpisode]);

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

    const isControlsHovered = useRef(false);
    const lastTouchTimeRef = useRef(0);

    const showControls = useCallback(() => {
        if (Date.now() - lastTouchTimeRef.current < 900) return;

        setShowUI(true);
        if (isControlsHovered.current || activePanel !== 'none') return;
        if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = setTimeout(() => {
            if (!isControlsHovered.current) setShowUI(false);
        }, 2500);
    }, [activePanel]);

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
                const oldTouch = lastTouchTimeRef.current;
                lastTouchTimeRef.current = 0; 
                showControls();
                lastTouchTimeRef.current = oldTouch; 
            } else {
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
    };

    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (activePanel !== 'none') return;

            const key = e.key.toLowerCase();

            if (e.repeat && !['arrowright', 'arrowleft', 'arrowup', 'arrowdown', 'l', 'j', '[', ']', '{', '}'].includes(key)) {
                return;
            }

            const target = e.target as HTMLElement;
            if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
                return;
            }

            const registeredKeys = [' ', 'k', 'l', 'j', 'arrowright', 'arrowleft', 'arrowup', 'arrowdown', 'f', 'm', 'n', 'p', 's', 'escape', '[', ']', '{', '}', '\\'];

            if (!registeredKeys.includes(key)) {
                showControls();
                return;
            }

            showControls();
            e.preventDefault();

            switch (e.key) { 
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
                            if (currentCaption) {
                                setCurrentCaption(null);
                            } else if (captions.length > 0) {
                                const preferred = captions.find(c => c.lang === 'en' || c.label.toLowerCase().includes('english')) || captions[0];
                                setCurrentCaption(preferred.url);
                            }
                            break;
                        case '[':
                            setSubtitleOffset(prev => parseFloat((prev - 0.1).toFixed(1)));
                            break;
                        case ']':
                            setSubtitleOffset(prev => parseFloat((prev + 0.1).toFixed(1)));
                            break;
                        case '{':
                            setSubtitleOffset(prev => parseFloat((prev - 1.0).toFixed(1)));
                            break;
                        case '}':
                            setSubtitleOffset(prev => parseFloat((prev + 1.0).toFixed(1)));
                            break;
                        case '\\':
                            setSubtitleOffset(0);
                            break;
                    }
                    break;
            }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [onClose, activePanel, nextEpisodeInfo, handleNextEpisode, previousEpisodeInfo, handlePreviousEpisode, isFullscreen, isPseudoFullscreen, toggleFullscreen, captions, currentCaption, showControls, useEmbedFallback, duration, isMuted, setSubtitleOffset]);

    return (
        <div
            ref={containerRef}
            className={`fixed z-[20000] flex flex-col font-sans select-none overflow-hidden bg-black ${isPseudoFullscreen ? 'inset-0' : (isFullscreen ? '' : 'inset-0')}`}
            style={isPseudoFullscreen ? { position: 'fixed', zIndex: 20001 } : {}}
            onMouseMove={showControls}
            onClick={(e) => {
                const target = e.target as HTMLElement;

                if (activePanel !== 'none') {
                    const panelContainer = target.closest('.settings-panel') || target.closest('.settings-panel-touch');
                    if (!panelContainer) {
                        setActivePanel('none');
                        e.stopPropagation();
                        e.preventDefault();
                        return;
                    }
                }

                const isBackgroundClick = target === containerRef.current ||
                    target === videoRef.current ||
                    target.classList.contains('embed-shield');

                if (isBackgroundClick) {
                    if (Date.now() - lastTouchTimeRef.current < 900) return;

                    if (showUIRef.current) {
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

                    showControls();
                } else {
                    showControls();
                }
            }}
            onTouchStart={() => { lastTouchTimeRef.current = Date.now(); }}
            onDoubleClick={(e) => {
                if (useEmbedFallback) return; 
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
                    setIsBuffering(false);
                    hasPlayedOnceRef.current = true;
                    showControls();
                }}
                onPause={() => {
                    setIsPlaying(false);
                    showControls();
                }}
                onEnded={() => {
                    // SAFETY LOCK 3: Double-fire and Provider Failure Cascade guards
                    if (isTransitioningRef.current) return;
                    
                    const currentProgressPct = duration > 0 ? (currentTime / duration) * 100 : 0;
                    if (currentProgressPct < 80) return; // Ignore instant crashes

                    // Use countdownCancelledRef (not showAutoplayCountdown) so that
                    // when the popup is visible and the video ends naturally, we still
                    // advance — instead of freezing forever with the popup showing.
                    if (settings.autoplayNextEpisode && !countdownCancelledRef.current) {
                        setShowAutoplayCountdown(false);
                        handleNextEpisode();
                    }
                }}
                onTimeUpdate={(t, d) => {
                    setIsVideoReady(true);
                    setIsBuffering(false);
                    setCurrentTime(t);
                    if (d > 0) {
                        setDuration(d);
                        setProgress((t / d) * 100);
                    }
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

            {/* ── Custom Subtitle Overlay ── */}
            {(isVideoReady || hasPlayedOnceRef.current) && subtitleObjectUrl && currentCueText && (
                <div
                    className="subtitle-overlay"
                    style={{
                        ...overlayStyle,
                        bottom: useEmbedFallback ? '9rem' : '5.5rem',
                        left: currentCueSettings?.position ? currentCueSettings.position : '50%',
                        transform: currentCueSettings?.position 
                            ? (currentCueSettings.align === 'right' || currentCueSettings.align === 'end' 
                                ? 'translateX(-100%)' 
                                : (currentCueSettings.align === 'center' || currentCueSettings.align === 'middle' 
                                    ? 'translateX(-50%)' 
                                    : 'none'))
                            : 'translateX(-50%)',
                        textAlign: currentCueSettings?.align 
                            ? (currentCueSettings.align === 'middle' 
                                ? 'center' 
                                : (currentCueSettings.align === 'start' 
                                    ? 'left' 
                                    : (currentCueSettings.align === 'end' 
                                        ? 'right' 
                                        : currentCueSettings.align))) as any
                            : 'center',
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
                            fontWeight: overlayStyle.fontWeight,
                            textAlign: isDialogue ? 'left' : 'center',
                            display: 'inline-block',
                            whiteSpace: 'pre-wrap',
                        }}
                    >
                        {parseSubtitleTags(currentCueText)}
                    </span>
                </div>
            )}

            {isBuffering && (
                (hasPlayedOnceRef.current || useEmbedFallback) ? (
                    <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                        <div className="relative w-12 h-12">
                            <div className="absolute inset-0 rounded-full border-[3px] border-white/10" />
                            <div className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-white/90 animate-spin" />
                        </div>
                    </div>
                ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none" style={{ background: 'radial-gradient(ellipse at center, rgba(20,20,20,0.97) 0%, rgba(0,0,0,1) 100%)' }}>
                        <div className="relative w-14 h-14 mb-8">
                            <div className="absolute inset-0 rounded-full border-[3px] border-white/8" />
                            <div className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-white/70 animate-spin" />
                            <div className="absolute inset-[6px] rounded-full border-[2px] border-transparent border-t-[#e50914]/60 animate-spin" style={{ animationDuration: '0.7s', animationDirection: 'reverse' }} />
                        </div>
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
                        showAutoplayCountdown={showAutoplayCountdown}
                        onCancelAutoplay={handleCancelAutoplay}
                        onPlayNextNow={handlePlayNextNow}
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
                            setVolume(v);
                            if (useEmbedFallback) {
                                // Sync mute state with slider (drag to 0 = mute, drag up = unmute)
                                const shouldMute = v === 0;
                                if (shouldMute !== isMuted) {
                                    setIsMuted(shouldMute);
                                    userMutedRef.current = shouldMute;
                                }
                                // ✅ Send volume + mute state to VidFast iframe
                                embedControllerRef.current?.setMuted(shouldMute, v);
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