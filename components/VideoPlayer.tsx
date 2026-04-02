import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Movie, Episode } from '../types';
import { getSeasonDetails, getMovieDetails, getStream, getExternalIds } from '../services/api';
import Hls from 'hls.js';
import ISO6391 from 'iso-639-1';

import { useGlobalContext } from '../context/GlobalContext';
import { useTitle } from '../context/TitleContext';
import { convertSubtitlesToObjectUrl } from '../utils/captions';
import { streamCache } from '../utils/streamCache';
import { useTouchGestures } from '../hooks/useTouchGestures';
import { useIsMobile } from '../hooks/useIsMobile';
import { SubtitleService } from '../services/SubtitleService';
import { NetworkPriority } from '../services/NetworkPriority';
import { useHls } from '../hooks/useHls';

// Giga Engine Backend URL
const GIGA_BACKEND_URL = import.meta.env.VITE_GIGA_BACKEND_URL || 'https://ibrahimar397-pstream-giga.hf.space';

// Child Components
import VideoPlayerControls from './VideoPlayerControls';
import VideoPlayerSettings from './VideoPlayerSettings';
import { 
    ArrowLeftIcon, 
    XIcon, 
    PlayIcon, 
    CheckIcon, 
    CaretRightIcon, 
    CaretDownIcon
} from '@phosphor-icons/react';

interface VideoPlayerProps {
    movie: Movie;
    season?: number;
    episode?: number;
    onClose?: () => void;
}

// CaptionCue rendering removed in favor of native <track> elements

// Stream API now handled by getStream from services/api


const VideoPlayer: React.FC<VideoPlayerProps> = ({ movie, season = 1, episode = 1, onClose }) => {
    const navigate = (window as any).reactNavigate || (() => window.history.back());
    const { settings, updateEpisodeProgress, getEpisodeProgress, updateVideoState, addToHistory, getVideoState } = useGlobalContext();
    const { setPageTitle } = useTitle();
    const isMobile = useIsMobile();
    const videoRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Player State
    const [isPlaying, setIsPlaying] = useState(false);
    const [isBuffering, setIsBuffering] = useState(true);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [progress, setProgress] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [showUI, setShowUI] = useState(true);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('Finding stream...');
    const [streamUrl, setStreamUrl] = useState<string | null>(null);
    const [streamReferer, setStreamReferer] = useState<string | null>(null);
    const [allSources, setAllSources] = useState<any[]>([]);
    const [currentSourceIndex, setCurrentSourceIndex] = useState(0);
    const [isStreamM3U8, setIsStreamM3U8] = useState<boolean>(true);
    const [isEmbed, setIsEmbed] = useState<boolean>(false);
    const [alternativeSources, setAlternativeSources] = useState<any[]>([]);
    const [retryCount, setRetryCount] = useState(0); // bumped on 403 to force re-fetch
    const [error, setError] = useState<string | null>(null);

    // TV Show state - PLAYBACK state
    const mediaType = movie.media_type || (movie.first_air_date ? 'tv' : 'movie');
    const [currentEpisode, setCurrentEpisode] = useState(episode);
    const [playingSeasonNumber, setPlayingSeasonNumber] = useState(season);
    const [seasonList, setSeasonList] = useState<number[]>([]);
    const [currentSeasonEpisodes, setCurrentSeasonEpisodes] = useState<Episode[]>([]);

    const [exploredSeasonEpisodes, setExploredSeasonEpisodes] = useState<Episode[]>([]);
    const [exploredSeasonNumber, setExploredSeasonNumber] = useState(season);

    // Sync Props to State (Allows external navigation to update player)
    useEffect(() => {
        if (season !== playingSeasonNumber) setPlayingSeasonNumber(season);
        if (episode !== currentEpisode) setCurrentEpisode(episode);
    }, [season, episode]);

    // Settings Panel - use correct panel types
    const [activePanel, setActivePanel] = useState<'none' | 'episodes' | 'seasons' | 'audioSubtitles' | 'quality'>('none');
    const [isPanelHovered, setIsPanelHovered] = useState(false);

    // Subtitles
    const [captions, setCaptions] = useState<{ id: string; label: string; url: string; lang: string }[]>([]);
    const [currentCaption, setCurrentCaption] = useState<string | null>(null);
    const [subtitleObjectUrl, setSubtitleObjectUrl] = useState<string | null>(null);
    const [currentCueText, setCurrentCueText] = useState<string>('');

    // Quality levels from HLS
    const [qualityLevels, setQualityLevels] = useState<{ height: number; bitrate: number; level: number }[]>([]);
    const [currentQualityLevel, setCurrentQualityLevel] = useState<number>(-1); // -1 = auto

    // Audio tracks from HLS
    const [audioTracks, setAudioTracks] = useState<{ id: number; name: string; lang: string }[]>([]);
    const [currentAudioTrack, setCurrentAudioTrack] = useState<number>(-1); // -1 = default

    // Mobile touch gesture state
    const [skipIndicator, setSkipIndicator] = useState<{ direction: 'left' | 'right' | null; visible: boolean }>({
        direction: null,
        visible: false
    });

    const handleAbsoluteSeek = useCallback((time: number) => {
        const video = videoRef.current;
        if (video) {
            video.currentTime = time;
        }
    }, []);

    const handleRelativeSeek = useCallback((amount: number) => {
        const video = videoRef.current;
        if (video) {
            const newTime = video.currentTime + amount;
            video.currentTime = Math.max(0, Math.min(video.duration || 0, newTime));
        }
    }, []);

    // Touch gesture handlers
    const showSkipIndicator = useCallback((direction: 'left' | 'right') => {
        setSkipIndicator({ direction, visible: true });
        setTimeout(() => setSkipIndicator({ direction: null, visible: false }), 500);
    }, []);

    const handleSkipBack = useCallback(() => {
        handleRelativeSeek(-10);
        showSkipIndicator('left');
    }, [handleRelativeSeek, showSkipIndicator]);

    const handleSkipForward = useCallback(() => {
        handleRelativeSeek(10);
        showSkipIndicator('right');
    }, [handleRelativeSeek, showSkipIndicator]);

    // Wire up touch gestures
    useTouchGestures(containerRef as React.RefObject<HTMLElement>, {
        onDoubleTapLeft: handleSkipBack,
        onDoubleTapRight: handleSkipForward,
        onDoubleTapCenter: () => {
            const video = videoRef.current;
            if (video) {
                video.paused ? video.play() : video.pause();
            }
        },
        onSingleTap: () => setShowUI(prev => !prev),
        onSwipeLeft: (distance) => {
            const video = videoRef.current;
            if (video) {
                const seekAmount = Math.min(30, distance / 10);
                video.currentTime = Math.max(0, video.currentTime - seekAmount);
            }
        },
        onSwipeRight: (distance) => {
            const video = videoRef.current;
            if (video) {
                const seekAmount = Math.min(30, distance / 10);
                video.currentTime = Math.min(video.duration, video.currentTime + seekAmount);
            }
        }
    });

    // Find active episode data
    const activeEpisodeData = useMemo(() => {
        if (mediaType !== 'tv' || !currentSeasonEpisodes.length) return null;
        return currentSeasonEpisodes.find(ep => ep.episode_number === currentEpisode);
    }, [mediaType, currentSeasonEpisodes, currentEpisode]);

    // Manage Network Priority and Kill Background Hero Videos
    const { setActiveVideoId } = useGlobalContext();
    useEffect(() => {
        // Stop any background Hero videos immediately
        setActiveVideoId('playing-movie-mode');
        NetworkPriority.setVideoActive(true);
        
        return () => {
             setActiveVideoId(null);
             NetworkPriority.setVideoActive(false);
        };
    }, [setActiveVideoId]);


    // --- Fetch Stream using Puppeteer ---
    // Definitions for title and release date
    const title = movie.title || movie.name || '';
    const formattedDate = movie.release_date || movie.first_air_date || '';

    // --- Subtitle Track Event Syncing ---
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const onCueChange = (e: any) => {
            const track = e.target as TextTrack;
            const activeCues = track.activeCues;
            if (activeCues && activeCues.length > 0) {
                const parts: string[] = [];
                for (let i = 0; i < activeCues.length; i++) {
                    const cue = activeCues[i] as VTTCue;
                    // Clean HTML tags and strip double spacing
                    parts.push(cue.text.replace(/<[^>]*>/g, '').replace(/\r?\n/g, ' '));
                }
                setCurrentCueText(parts.join(' '));
            } else {
                setCurrentCueText('');
            }
        };

        // Find the subtitle track and attach
        const checkTracks = () => {
            const tracks = video.textTracks;
            for (let i = 0; i < tracks.length; i++) {
                if (tracks[i].kind === 'subtitles') {
                    tracks[i].oncuechange = onCueChange;
                    tracks[i].mode = 'hidden'; // Hide native browser rendering to use our custom overlay
                }
            }
        };

        checkTracks();
        const observer = new MutationObserver(checkTracks);
        observer.observe(video, { childList: true });

        return () => {
            observer.disconnect();
            const tracks = video.textTracks;
            for (let i = 0; i < tracks.length; i++) {
                tracks[i].oncuechange = null;
            }
        };
    }, [subtitleObjectUrl]);

    // Handle initial stream and subtitles logic
    useEffect(() => {
        const fetchStream = async () => {
            setIsBuffering(true);
            setError(null);
            setLoadingMessage('Searching for stream...');


            // Get release year from air date
            const releaseYear = formattedDate ? parseInt(formattedDate.split('-')[0]) : undefined;

            // Build cache key
            const cacheKey = {
                title,
                type: (mediaType === 'tv' ? 'tv' : 'movie') as 'tv' | 'movie',
                year: releaseYear,
                season: playingSeasonNumber,
                episode: currentEpisode,
                tmdbId: String(movie.id || '')
            };

            // Check cache first
            const cached = streamCache.get(cacheKey);
            if (cached && cached.sources && cached.sources.length > 0) {
                // INSTANT PATH: If cached within last 5 minutes, trust it immediately
                const isVeryRecent = (Date.now() - (cached as any).cachedAt) < 5 * 60 * 1000;

                if (isVeryRecent) {
                    console.log(`[VideoPlayer] ⚡ Extremely recent cache found. Instant play.`);
                    applyStreamResult(cached.sources, cached.subtitles);
                    return;
                }

                setLoadingMessage('Optimizing cached stream...');
                console.log(`[VideoPlayer] ⚡ Found cached stream. Applying S${playingSeasonNumber}E${currentEpisode}...`);

                // Directly apply cached result for now (browser fetch(HEAD) is brittle with CORS)
                applyStreamResult(cached.sources, cached.subtitles);
                return;
            }

            console.log(`[VideoPlayer] Fetching stream for ${mediaType}/${title} (${releaseYear})`);

            try {
                // Fetch Legacy OpenSubtitles (bypass 5-request limit) in parallel with stream
                const openSubPromise = settings.showSubtitles
                    ? SubtitleService.getOpenSubtitles(String(movie.id), mediaType === 'tv' ? 'tv' : 'movie', playingSeasonNumber, currentEpisode).catch(() => [])
                    : Promise.resolve([]);

                let imdbId = movie.imdb_id;
                if (!imdbId) {
                    try {
                        const ext = await getExternalIds(movie.id, mediaType === 'tv' ? 'tv' : 'movie');
                        if (ext && ext.imdb_id) imdbId = ext.imdb_id;
                    } catch (e) { console.warn("Could not fetch IMDb ID", e); }
                }

                const result = await getStream(
                    title,
                    mediaType === 'tv' ? 'tv' : 'movie',
                    releaseYear,
                    playingSeasonNumber,
                    currentEpisode,
                    String(movie.id || ''),
                    imdbId || ''
                );

                if (result?.success && result.sources && result.sources.length > 0) {
                    console.log(`[VideoPlayer] Stream found from ${result.provider}:`, result.sources);

                    let osSubs: any[] = [];
                    try {
                        osSubs = await openSubPromise;
                    } catch (e) { }

                    const combinedSubs = [...(result.subtitles || []), ...osSubs];

                    // Cache for future use
                    streamCache.set(cacheKey, {
                        sources: result.sources,
                        subtitles: combinedSubs,
                        provider: result.provider || 'unknown'
                    });

                    applyStreamResult(result.sources, combinedSubs, result.referer);
                    setAlternativeSources(result.alternativeSources || []);

                    // Prefetch next episodes in background (TV only)
                    if (mediaType === 'tv' && currentSeasonEpisodes.length > 0) {
                        // Prefetch handled globally by streamCache
                        streamCache.prefetchNextEpisodes(
                            { getStream },
                            title,
                            releaseYear,
                            playingSeasonNumber,
                            currentEpisode,
                            currentSeasonEpisodes.length,
                            String(movie.id || '')
                        );
                    }
                } else {
                    console.error('[VideoPlayer] No stream found:', result.error);
                    setError(result.error || 'No stream found. Try another server?');
                    setIsBuffering(false);
                }
            } catch (err: any) {
                console.error('[VideoPlayer] Stream fetch error:', err);
                setError(err.message || 'Failed to fetch stream');
                setIsBuffering(false);
            }
        };

        // Helper to apply stream result (used by both cached and fresh fetches)
        const applyStreamResult = (sources: any[], subtitles: any[], globalReferer?: string | null) => {
            setAllSources(sources);
            setCurrentSourceIndex(0);

            // Find HLS source (m3u8) or fallback to first
            const hlsSource = sources[0];
            const isEmbedFallback = !!hlsSource.isEmbed;
            setIsEmbed(isEmbedFallback);

            // Use the source-specific referer if available, otherwise use the global one passed by the resolver
            const activeReferer = hlsSource.referer || globalReferer || '';            let finalUrl = hlsSource.url;
            if (!isEmbedFallback) {
                if (hlsSource.directManifest) {
                    const blob = new Blob([hlsSource.directManifest], { type: 'application/vnd.apple.mpegurl' });
                    finalUrl = URL.createObjectURL(blob);
                    console.log(`[VideoPlayer] 🧠 Using pre-fetched manifest Blob URL`);
                } else {
                    const headers = JSON.stringify({ referer: activeReferer, origin: new URL(activeReferer).origin });
                    finalUrl = `${GIGA_BACKEND_URL}/proxy/stream?url=${encodeURIComponent(hlsSource.url)}&headers=${encodeURIComponent(headers)}`;
                }
            }

            console.log(`[VideoPlayer] Selected source (${hlsSource.isM3U8 ? 'M3U8' : 'Video'}):`, finalUrl);
            if (activeReferer) console.log(`[VideoPlayer] Using Referer:`, activeReferer);

            setStreamUrl(finalUrl);
            setIsStreamM3U8(!!hlsSource.isM3U8);
            setStreamReferer(activeReferer || null);
            setLoadingMessage('Loading video...');

            // Handle subtitles if present
            if (subtitles && subtitles.length > 0) {
                const mappedCaptions = subtitles.map((sub: any, index: number) => ({
                    id: `sub-${index}`,
                    label: ISO6391.getName((sub.lang || 'en').toLowerCase().split('-')[0]) || sub.label || sub.lang || `Subtitle ${index + 1}`,
                    url: sub.url,
                    lang: (sub.lang || 'en').toLowerCase().split('-')[0]
                }));
                setCaptions(mappedCaptions);

                const preferredLang = settings.subtitleLanguage?.toLowerCase() || 'en';
                const matchingSub = mappedCaptions.find((s: any) => s.lang.includes(preferredLang) || s.label.toLowerCase().includes(preferredLang));
                const fallbackSub = mappedCaptions.find((s: any) => s.lang === 'en' || s.label.toLowerCase().includes('english'));

                const finalSub = matchingSub || fallbackSub || mappedCaptions[0];
                if (finalSub && settings.showSubtitles) {
                    console.log(`[VideoPlayer] 🌐 Selecting subtitle: ${finalSub.label} (${finalSub.lang})`);
                    setCurrentCaption(finalSub.url);
                }
            }

            if (isEmbedFallback) {
                // Iframes don't report load accurately, stop the infinite loading spinner
                setTimeout(() => setIsBuffering(false), 1500);
            }
        };

        fetchStream();
    }, [movie.id, mediaType, playingSeasonNumber, currentEpisode, retryCount]);

    // --- Native Subtitle Loading Effect ---
    useEffect(() => {
        if (!currentCaption) {
            setSubtitleObjectUrl(null);
            return;
        }

        let currentObjectUrl: string | null = null;
        let isMounted = true;

        const loadSubtitles = async () => {
            try {
                console.log('[VideoPlayer] Loading subtitle for native track:', currentCaption);

                // Use main process proxy to bypass CORS
                const electron = (window as any).electron;
                let text = '';

                if (electron?.fetchSubtitle) {
                    const result = await electron.fetchSubtitle(currentCaption);
                    if (result.success) {
                        text = result.text;
                    } else {
                        console.error('[VideoPlayer] Subtitle proxy error:', result.error);
                        return;
                    }
                } else {
                    // Fallback to direct fetch (may fail due to CORS)
                    const response = await fetch(currentCaption);
                    text = await response.text();
                }

                if (text && isMounted) {
                    // Convert raw subtitle to a WebVTT ObjectURL for native parsing
                    const objectUrl = convertSubtitlesToObjectUrl(text);
                    if (objectUrl) {
                        console.log(`[VideoPlayer] Converted subtitle to WebVTT Object URL`);
                        currentObjectUrl = objectUrl;
                        setSubtitleObjectUrl(objectUrl);
                    }
                }
            } catch (err) {
                console.error('[VideoPlayer] Failed to load subtitles:', err);
                if (isMounted) setSubtitleObjectUrl(null);
            }
        };

        loadSubtitles();

        return () => {
            isMounted = false;
            if (currentObjectUrl) {
                URL.revokeObjectURL(currentObjectUrl);
            }
        };
    }, [currentCaption]);

    // --- Use Standalone HLS Manager Hook ---
    const { 
        isBuffering: hlsBuffering, 
        qualityLevels: hlsLevels, 
        currentQuality: hlsQuality,
        audioTracks: hlsAudios, 
        currentAudioTrack: hlsAudio,
        changeQuality, 
        changeAudioTrack 
    } = useHls(videoRef, {
        streamUrl,
        isM3U8: isStreamM3U8,
        onManifestParsed: () => {
            // Re-apply saved position (optional, can also be done inside useHls but safer here)
            const video = videoRef.current;
            if (video) {
                const saved = mediaType === 'tv' 
                    ? getEpisodeProgress(movie.id, playingSeasonNumber, currentEpisode)
                    : getVideoState(movie.id);
                if (saved && saved.time > 10 && saved.time < (video.duration - 30)) {
                    video.currentTime = saved.time;
                }
            }
        },
        onTokenExpired: () => {
            console.log('[VideoPlayer] Token expired, refreshing stream...');
            const releaseYear = formattedDate ? parseInt(formattedDate.split('-')[0]) : undefined;
            streamCache.remove({
                title, type: (mediaType === 'tv' ? 'tv' : 'movie') as 'tv' | 'movie',
                year: releaseYear, season: playingSeasonNumber, episode: currentEpisode,
                tmdbId: String(movie.id || '')
            });
            setRetryCount(c => c + 1);
        },
        onError: (errMsg) => {
            // Try mirror switching before giving up
            if (currentSourceIndex < allSources.length - 1) {
                const nextIndex = currentSourceIndex + 1;
                const nextSource = allSources[nextIndex];
                setCurrentSourceIndex(nextIndex);
                setLoadingMessage(`Switching to mirror ${nextIndex + 1}...`);
                setIsEmbed(!!nextSource.isEmbed);
                let nextUrl = nextSource.url;
                if (!nextSource.isEmbed) {
                    const headers = JSON.stringify({ referer: streamReferer || '', origin: streamReferer ? new URL(streamReferer).origin : '' });
                    nextUrl = `${GIGA_BACKEND_URL}/proxy/stream?url=${encodeURIComponent(nextSource.url)}&headers=${encodeURIComponent(headers)}`;
                }
                setStreamUrl(nextUrl);
                setIsStreamM3U8(!!nextSource.isM3U8);
            } else {
                setError(errMsg);
            }
        }
    });

    // Sync HLS hook states to component states for the UI controls
    useEffect(() => {
        setQualityLevels(hlsLevels);
    }, [hlsLevels]);

    useEffect(() => {
        setCurrentQualityLevel(hlsQuality);
    }, [hlsQuality]);

    useEffect(() => {
        setAudioTracks(hlsAudios);
    }, [hlsAudios]);

    useEffect(() => {
        setCurrentAudioTrack(hlsAudio);
    }, [hlsAudio]);

    useEffect(() => {
        if (!isEmbed) setIsBuffering(hlsBuffering);
    }, [hlsBuffering, isEmbed]);


    // --- Fetch TV Show Details ---
    useEffect(() => {
        const initialize = async () => {
            if (mediaType === 'tv') {
                try {
                    const details = await getMovieDetails(String(movie.id), 'tv');
                    if (details.seasons) {
                        const filteredSeasons = details.seasons.filter(
                            (s: any) => s.season_number > 0 && s.episode_count > 0
                        );
                        setSeasonList(filteredSeasons.map((s: any) => s.season_number));
                    }
                    const seasonData = await getSeasonDetails(String(movie.id), season);
                    if (seasonData?.episodes) {
                        setCurrentSeasonEpisodes(seasonData.episodes);
                    }
                } catch (error) {
                    console.error('[VideoPlayer] Error fetching TV details:', error);
                }
            }
        };
        initialize();
    }, [movie.id, mediaType, season]);

    // --- Video Event Handlers ---
    const lastSaveRef = useRef<number>(0);
    const handleTimeUpdate = useCallback(() => {
        const video = videoRef.current;
        if (!video || !video.src) return; // Robust check against 'src of null' during mid-switch
        
        // Ensure duration is valid before proceeding
        if (isNaN(video.duration) || video.duration === 0) return;

        setCurrentTime(video.currentTime);
        setDuration(video.duration);
        setProgress((video.currentTime / video.duration) * 100);

        // Save progress & history every 5 seconds
        if (video.duration > 0) {
            const now = Date.now();
            const currentProgress = (video.currentTime / video.duration) * 100;

            // Auto-trigger next episode at 99.85% (Smart Autoplay - less aggressive)
            if (mediaType === 'tv' && settings.autoplayNextEpisode && currentProgress >= 99.85) {
                const nextEp = currentSeasonEpisodes.find(e => e.episode_number === currentEpisode + 1);
                if (nextEp) {
                    console.log('[VideoPlayer] 🍿 Autoplay: 99.85% reached, switching to next episode...');
                    handleEpisodeSelect(nextEp, playingSeasonNumber, currentSeasonEpisodes);
                    return; // Stop further updates for this episode
                }
            }

            if (now - lastSaveRef.current > 2000) {
                lastSaveRef.current = now;

                // Add to Continue Watching
                addToHistory(movie);

                if (mediaType === 'tv') {
                    updateEpisodeProgress(movie.id, playingSeasonNumber, currentEpisode, video.currentTime, video.duration);
                    // Also save for InfoModal resume compatibility
                    localStorage.setItem(`pstream-last-watched-${movie.id}`, JSON.stringify({
                        season: playingSeasonNumber,
                        episode: currentEpisode
                    }));
                } else {
                    // Save Movie progress
                    updateVideoState(movie.id, video.currentTime, undefined, video.duration);
                }
            }
        }

        // Native track handles synchronization directly
    }, [mediaType, movie.id, playingSeasonNumber, currentEpisode, updateEpisodeProgress]);

    const togglePlay = useCallback(() => {
        const video = videoRef.current;
        if (!video) return;

        if (video.paused) {
            video.play();
            setIsPlaying(true);
        } else {
            video.pause();
            setIsPlaying(false);
        }
    }, []);



    const handleVolumeChange = useCallback((newVolume: number) => {
        const video = videoRef.current;
        if (video) {
            video.volume = newVolume;
            setVolume(newVolume);
            setIsMuted(newVolume === 0);
        }
    }, []);



    const toggleMute = useCallback(() => {
        const video = videoRef.current;
        if (video) {
            video.muted = !video.muted;
            setIsMuted(video.muted);
        }
    }, []);

    const toggleFullscreen = useCallback(() => {
        if (!containerRef.current) return;
        if (!document.fullscreenElement) {
            containerRef.current.requestFullscreen();
            setIsFullscreen(true);
        } else {
            document.exitFullscreen();
            setIsFullscreen(false);
        }
    }, []);

    // --- Inactivity Timer ---
    const isMobilePlayer = useIsMobile();
    const resetInactivityTimer = useCallback(() => {
        setShowUI(true);
        if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
        // Mobile: 5s so controls don't vanish immediately after a tap
        const hideDelay = isMobilePlayer ? 5000 : 3000;
        inactivityTimerRef.current = setTimeout(() => {
            if (activePanel === 'none' && !isPanelHovered) {
                setShowUI(false);
            }
        }, hideDelay);
    }, [activePanel, isPanelHovered, isMobilePlayer]);

    useEffect(() => {
        resetInactivityTimer();
        return () => {
            if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
        };
    }, [resetInactivityTimer]);

    // --- Keyboard Shortcuts ---
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

            switch (e.key.toLowerCase()) {
                case ' ':
                case 'k':
                    e.preventDefault();
                    togglePlay();
                    break;
                case 'arrowleft':
                    e.preventDefault();
                    handleRelativeSeek(-10);
                    break;
                case 'arrowright':
                    e.preventDefault();
                    handleRelativeSeek(10);
                    break;
                case 'arrowup':
                    e.preventDefault();
                    handleVolumeChange(Math.min(1, volume + 0.1));
                    break;
                case 'arrowdown':
                    e.preventDefault();
                    handleVolumeChange(Math.max(0, volume - 0.1));
                    break;
                case 'm':
                    toggleMute();
                    break;
                case 'f':
                    toggleFullscreen();
                    break;
                case 'escape':
                    if (activePanel !== 'none') {
                        setActivePanel('none');
                    } else {
                        onClose && onClose();
                    }
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [togglePlay, handleAbsoluteSeek, handleRelativeSeek, handleVolumeChange, toggleMute, toggleFullscreen, currentTime, volume, activePanel, onClose]);

    // Episode navigation - SELECT = actually play
    const handleEpisodeSelect = useCallback((ep: Episode, overrideSeasonNumber?: number, overrideSeasonEpisodes?: Episode[]) => {
        // Reset state for new episode
        setStreamUrl(null);
        setIsBuffering(true);
        setLoadingMessage(`Preparing ${ep.name}...`);
        setCaptions([]);
        setError(null);

        const targetSeason = overrideSeasonNumber || ep.season_number || exploredSeasonNumber;
        const targetEpisodes = overrideSeasonEpisodes || 
           ((targetSeason === exploredSeasonNumber && exploredSeasonEpisodes.length > 0) 
               ? exploredSeasonEpisodes 
               : currentSeasonEpisodes);

        // Update PLAYBACK state - this triggers stream fetch useEffect
        setPlayingSeasonNumber(targetSeason);
        setCurrentSeasonEpisodes(targetEpisodes);
        setCurrentEpisode(ep.episode_number);
        setActivePanel('none');

        // Update URL for deep linking without page reload
        const newUrl = `/watch/tv/${movie.id}?season=${targetSeason}&episode=${ep.episode_number}`;
        window.history.replaceState(null, '', newUrl);
    }, [exploredSeasonNumber, exploredSeasonEpisodes, currentSeasonEpisodes, movie.id]);

    const [isLoadingEpisodes, setIsLoadingEpisodes] = useState(false);

    // Season EXPLORATION - just browse, don't trigger playback
    const handleSeasonExplore = useCallback(async (s: number) => {
        setExploredSeasonNumber(s);
        setIsLoadingEpisodes(true);
        setExploredSeasonEpisodes([]); // Clear stale data
        try {
            const seasonData = await getSeasonDetails(String(movie.id), s);
            if (seasonData?.episodes) {
                setExploredSeasonEpisodes(seasonData.episodes);
            }
        } catch (error) {
            console.error('[VideoPlayer] Error fetching season for exploration:', error);
        } finally {
            setIsLoadingEpisodes(false);
        }
    }, [movie.id]);

    // Initialize exploration state when panel opens
    useEffect(() => {
        if (activePanel === 'episodes' || activePanel === 'seasons') {
            // Sync exploration to current playback season
            if (exploredSeasonEpisodes.length === 0) {
                // Try to copy from current playback episodes first
                if (currentSeasonEpisodes.length > 0) {
                    setExploredSeasonNumber(playingSeasonNumber);
                    setExploredSeasonEpisodes(currentSeasonEpisodes);
                } else {
                    // If no episodes loaded yet, fetch them
                    getSeasonDetails(String(movie.id), playingSeasonNumber).then(seasonData => {
                        if (seasonData?.episodes) {
                            setExploredSeasonNumber(playingSeasonNumber);
                            setExploredSeasonEpisodes(seasonData.episodes);
                            // Also update current season episodes for playback
                            setCurrentSeasonEpisodes(seasonData.episodes);
                        }
                    }).catch(err => console.error('[VideoPlayer] Failed to fetch episodes for explorer:', err));
                }
            }
        }

        if (mediaType === 'tv') {
            const nextEp = currentEpisode + 1;
            const yearStr = (movie.release_date || movie.first_air_date || '').split('-')[0];
            const year = yearStr ? parseInt(yearStr) : undefined;
            // Prefetch handled by streamCache
        }
    }, [activePanel, playingSeasonNumber, currentSeasonEpisodes, exploredSeasonEpisodes.length, mediaType, currentEpisode, movie]);


    // Legacy handler kept for compatibility but now just explores
    const handleSeasonSelect = handleSeasonExplore;

    // Build title
    const displayTitle = useMemo(() => {
        if (mediaType === 'tv' && activeEpisodeData) {
            return `${movie.name || movie.title} | ${activeEpisodeData.name}`;
        }
        return movie.title || movie.name || '';
    }, [movie, mediaType, activeEpisodeData]);

    // Update app bar title when playing
    useEffect(() => {
        if (mediaType === 'tv' && activeEpisodeData) {
            setPageTitle(`${movie.name || movie.title} - S${playingSeasonNumber}E${currentEpisode}`);
        } else {
            setPageTitle(movie.title || movie.name || 'Now Playing');
        }
        return () => setPageTitle('Home'); // Reset on unmount
    }, [setPageTitle, movie, mediaType, playingSeasonNumber, currentEpisode, activeEpisodeData]);

    // --- Subtitle Dynamic Style Mapping ---
    const cueStyles = useMemo(() => {
        const { subtitleSize, subtitleColor, subtitleFontFamily, subtitleOpacity, subtitleEdgeStyle, subtitleBackground, subtitleWindowColor, subtitleBlur } = settings;

        let fontSize = '24px';
        if (subtitleSize === 'tiny') fontSize = '16px';
        if (subtitleSize === 'small') fontSize = '20px';
        if (subtitleSize === 'medium') fontSize = '28px'; // Slightly smaller for better screen real estate
        if (subtitleSize === 'large') fontSize = '42px';
        if (subtitleSize === 'huge') fontSize = '58px';

        let edge = 'none';
        if (subtitleEdgeStyle === 'drop-shadow') edge = '0 2px 4px rgba(0,0,0,0.8)';
        if (subtitleEdgeStyle === 'outline') edge = '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000';
        if (subtitleEdgeStyle === 'raised') edge = '0 1px 0 #ccc, 0 2px 0 #c9c9c9, 0 3px 0 #bbb, 0 8px 1px rgba(0,0,0,0.3)';
        if (subtitleEdgeStyle === 'depressed') edge = '1px 1px 0 #fff, -1px -1px 0 #000';

        let bgColor = 'transparent';
        if (subtitleBackground === 'box') {
            const opacity = (subtitleOpacity || 80) / 100;
            bgColor = `rgba(0,0,0,${opacity})`;
        }

        // Font Family Mapping
        const fallbacks = ', "Inter", sans-serif';
        let fontFamily = 'Inter, sans-serif';
        if (subtitleFontFamily === 'monospace') fontFamily = '"Consolas", "Monaco", monospace';
        if (subtitleFontFamily === 'typewriter') fontFamily = '"Courier New", Courier, monospace';
        if (subtitleFontFamily === 'cursive') fontFamily = '"Comic Sans MS", "Apple Chancery", cursive';
        if (subtitleFontFamily === 'casual') fontFamily = '"Ubuntu Medium", "Segoe UI", sans-serif';
        if (subtitleFontFamily === 'small-caps') fontFamily = 'sans-serif; font-variant: small-caps';

        return {
            fontSize,
            color: subtitleColor || 'white',
            fontFamily,
            textShadow: edge,
            backgroundColor: bgColor,
            backdropFilter: subtitleBackground === 'box' && subtitleBlur ? `blur(${subtitleBlur}px)` : 'none',
            padding: subtitleBackground === 'box' ? '0.2em 0.5em' : '0',
            borderRadius: '4px'
        };
    }, [settings]);

    const subtitleStyles = useMemo(() => {
        // Keeps native cues hidden to prevent double-display
        return `video::cue { visibility: hidden !important; opacity: 0 !important; }`;
    }, []);

    return (
        <div
            ref={containerRef}
            className={`fixed inset-0 z-[100] bg-black font-['Consolas'] text-white overflow-hidden select-none ${showUI ? '' : 'cursor-none'}`}
            onMouseMove={resetInactivityTimer}
            onClick={(e) => {
                // If clicking directly on the container (not a child element like settings panel)
                if (e.target === e.currentTarget || (e.target as HTMLElement).closest('.video-player-main-area')) {
                    if (activePanel !== 'none') {
                        // Close panel without toggling play
                        setActivePanel('none');
                    } else {
                        // Toggle play only when no panel is open
                        togglePlay();
                    }
                }
            }}
        >
            {/* Dynamic CSS for Subtitles */}
            <style>{subtitleStyles}</style>

            {/* Back Button */}
            <div className={`absolute top-10 left-6 z-50 transition-opacity duration-300 ${showUI ? 'opacity-100' : 'opacity-0'}`}>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        if (onClose) onClose();
                        else if ((window as any).reactNavigate) (window as any).reactNavigate(-1);
                        else window.history.back();
                    }}
                    className="flex items-center justify-center w-12 h-12 text-white/70 hover:text-white transition-all duration-300"
                    title="Back"
                >
                    <ArrowLeftIcon size={48} weight="bold" />
                </button>
            </div>

            {/* Native Video Element */}
            <video
                ref={videoRef}
                className="absolute inset-0 w-full h-full object-contain bg-black"
                onTimeUpdate={handleTimeUpdate}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onWaiting={() => setIsBuffering(true)}
                onPlaying={() => setIsBuffering(false)}
                onEnded={() => {
                    if (mediaType === 'tv' && currentEpisode < currentSeasonEpisodes.length) {
                        const nextEp = currentSeasonEpisodes.find(e => e.episode_number === currentEpisode + 1);
                        if (nextEp) handleEpisodeSelect(nextEp, playingSeasonNumber, currentSeasonEpisodes);
                    }
                }}
                playsInline
                onContextMenu={(e) => e.preventDefault()}
            >
                {subtitleObjectUrl && (
                    <track
                        kind="subtitles"
                        label="Captions"
                        srcLang={captions.find(c => c.url === currentCaption)?.lang || 'en'}
                        src={subtitleObjectUrl}
                        default
                    />
                )}
            </video>

            {/* Loading Overlay */}
            {isBuffering && (
                <div className={`absolute z-30 transition-opacity duration-500 pointer-events-none ${streamUrl ? 'bottom-28 right-12' : 'inset-0'}`}>
                    {/* Blurred Backdrop - Only show during initial stream finding phase */}
                    {!streamUrl && (
                        <>
                            <div
                                className="absolute inset-0 bg-cover bg-center brightness-[0.3] scale-110"
                                style={{
                                    backgroundImage: `url(https://image.tmdb.org/t/p/original${movie.backdrop_path || movie.poster_path})`,
                                    filter: 'blur(20px)'
                                }}
                            />

                            <div className="relative h-screen w-screen flex items-center justify-center">
                                <div className="text-center">
                                    <div className="relative inline-block">
                                        <div className="w-16 h-16 border-4 border-white/10 rounded-full" />
                                        <div className="absolute top-0 left-0 w-16 h-16 border-4 border-[#E50914] border-t-transparent rounded-full animate-spin" />
                                    </div>
                                    <p className="mt-6 text-white text-lg font-medium tracking-wide drop-shadow-lg">{loadingMessage}</p>
                                </div>
                            </div>
                        </>
                    )}

                    {/* Minimal Buffering Spinner During Playback */}
                    {streamUrl && (
                        <div className="relative inline-block opacity-70">
                            <div className="w-10 h-10 border-4 border-white/10 rounded-full" />
                            <div className="absolute top-0 left-0 w-10 h-10 border-4 border-[#E50914] border-t-transparent rounded-full animate-spin" />
                        </div>
                    )}
                </div>
            )}

            {/* Error Display */}
            {error && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-30">
                    <div className="text-center max-w-md">
                        <p className="text-red-500 text-xl mb-4">Stream Error</p>
                        <p className="text-white/60 mb-6">{error}</p>
                        <div className="flex items-center justify-center gap-4">
                            {alternativeSources.length > 0 && (
                                <button
                                    onClick={() => {
                                        const next = alternativeSources[0];
                                        setAlternativeSources(prev => prev.slice(1));
                                        setError(null);
                                        setIsBuffering(true);
                                        const referer = next.referer || '';
                                        const url = next.isM3U8
                                            ? `${GIGA_BACKEND_URL}/proxy/m3u8?url=${encodeURIComponent(next.url)}&referer=${encodeURIComponent(referer)}`
                                            : `${GIGA_BACKEND_URL}/proxy/video?url=${encodeURIComponent(next.url)}&referer=${encodeURIComponent(referer)}`;
                                        setStreamUrl(url);
                                        setIsStreamM3U8(!!next.isM3U8);
                                    }}
                                    className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded border border-white/20 transition"
                                >
                                    Try Next Source
                                </button>
                            )}
                            <button
                                onClick={onClose}
                                className="px-6 py-2 bg-red-600 hover:bg-red-700 rounded transition"
                            >
                                Go Back
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Custom Subtitle Overlay */}
            {settings.showSubtitles && currentCueText && (
                <div 
                    className={`absolute bottom-24 left-0 right-0 z-40 flex justify-center items-center px-10 pointer-events-none transition-all duration-300 ${showUI ? 'mb-16' : 'mb-0'}`}
                >
                    <div 
                        className="text-center font-bold leading-normal animate-fadeIn"
                        style={{
                            ...cueStyles,
                            maxWidth: '85%',
                            transition: 'margin-bottom 0.3s ease'
                        }}
                    >
                        {currentCueText}
                    </div>
                </div>
            )}

            {/* Video Controls */}
            <div className={`absolute bottom-0 left-0 right-0 z-50 transition-opacity duration-300 ${showUI ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                <VideoPlayerControls
                    isPlaying={isPlaying}
                    isMuted={isMuted}
                    progress={progress}
                    duration={duration}
                    currentTime={currentTime}
                    buffered={progress + 5} // Approximate buffered for UI
                    isBuffering={isBuffering}
                    title={displayTitle}
                    showNextEp={mediaType === 'tv' && (
                        currentSeasonEpisodes.some(e => e.episode_number === currentEpisode + 1) ||
                        seasonList.includes(playingSeasonNumber + 1)
                    )}
                    nextEpisode={currentSeasonEpisodes.find(e => e.episode_number === currentEpisode + 1)}
                    onPlayPause={togglePlay}
                    onSeek={handleRelativeSeek}
                    volume={volume}
                    onVolumeChange={handleVolumeChange}
                    onToggleMute={toggleMute}
                    onTimelineSeek={handleAbsoluteSeek}
                    onNextEpisode={() => {
                        const nextEp = currentSeasonEpisodes.find(e => e.episode_number === currentEpisode + 1);
                        if (nextEp) handleEpisodeSelect(nextEp, playingSeasonNumber, currentSeasonEpisodes);
                    }}
                    onClose={onClose || (() => navigate(-1))}
                    onToggleFullscreen={toggleFullscreen}
                    onSettingsClick={() => isMobile && setActivePanel('quality')}
                    onSubtitlesClick={() => isMobile && setActivePanel('audioSubtitles')}
                    onEpisodesClick={() => isMobile && setActivePanel('episodes')}
                    isMenuOpen={activePanel !== 'none'}
                    showUI={showUI}
                    // Pass settings state for hover panels
                    captions={captions}
                    currentCaption={currentCaption}
                    onSubtitleChange={setCurrentCaption}
                    audioTracks={audioTracks}
                    currentAudioTrack={currentAudioTrack}
                    onAudioChange={changeAudioTrack}
                    qualities={qualityLevels}
                    currentQuality={currentQualityLevel}
                    onQualityChange={changeQuality}
                    seasonList={seasonList}
                    currentSeasonEpisodes={exploredSeasonEpisodes.length > 0 ? exploredSeasonEpisodes : currentSeasonEpisodes}
                    selectedSeason={exploredSeasonNumber}
                    playingSeason={playingSeasonNumber}
                    showId={movie.id}
                    onSeasonSelect={handleSeasonExplore}
                    onEpisodeSelect={(ep) => handleEpisodeSelect(ep, exploredSeasonNumber, exploredSeasonEpisodes)}
                    onEpisodeExpand={() => {}}
                    activePanel={activePanel}
                    setActivePanel={setActivePanel}
                    showTitle={movie.name || movie.title}
                />
            </div>

            {/* Settings Panel (Mobile Sheets only) */}
            {isMobile && activePanel !== 'none' && (
                <VideoPlayerSettings
                    activePanel={activePanel}
                    setActivePanel={setActivePanel}
                    captions={captions}
                    currentCaption={currentCaption}
                    onSubtitleChange={setCurrentCaption}
                    audioTracks={audioTracks}
                    currentAudioTrack={currentAudioTrack}
                    onAudioChange={changeAudioTrack}
                    seasonList={seasonList}
                    selectedSeason={exploredSeasonNumber}
                    playingSeason={playingSeasonNumber}
                    showId={movie.id}
                    currentSeasonEpisodes={exploredSeasonEpisodes.length > 0 ? exploredSeasonEpisodes : currentSeasonEpisodes}
                    currentEpisode={currentEpisode}
                    onSeasonSelect={handleSeasonExplore}
                    onEpisodeSelect={handleEpisodeSelect}
                    onEpisodeExpand={() => {}}
                    qualities={qualityLevels}
                    currentQuality={currentQualityLevel}
                    onQualityChange={changeQuality}
                    showTitle={displayTitle}
                />
            )}
        </div>
    );
};

export default VideoPlayer;