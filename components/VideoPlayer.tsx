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
import { SubtitleService } from '../services/SubtitleService';
import { NetworkPriority } from '../services/NetworkPriority';

// Giga Engine Backend URL
const GIGA_BACKEND_URL = import.meta.env.VITE_GIGA_BACKEND_URL || 'https://ibrahimar397-pstream-giga.hf.space';

// Child Components
import VideoPlayerControls from './VideoPlayerControls';
import VideoPlayerSettings from './VideoPlayerSettings';
import { ArrowLeftIcon } from '@phosphor-icons/react';

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
    const videoRef = useRef<HTMLVideoElement>(null);
    const hlsRef = useRef<Hls | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Player State
    const [isPlaying, setIsPlaying] = useState(false);
    const [isBuffering, setIsBuffering] = useState(true);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [progress, setProgress] = useState(0);
    const [volume, setVolume] = useState(1);
    const [audioBoost, setAudioBoost] = useState(1);
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
    const [error, setError] = useState<string | null>(null);

    // TV Show state - PLAYBACK state
    const mediaType = movie.media_type || (movie.first_air_date ? 'tv' : 'movie');
    const [currentEpisode, setCurrentEpisode] = useState(episode);
    const [playingSeasonNumber, setPlayingSeasonNumber] = useState(season);
    const [seasonList, setSeasonList] = useState<number[]>([]);
    const [currentSeasonEpisodes, setCurrentSeasonEpisodes] = useState<Episode[]>([]);

    // TV Show state - EXPLORATION state (for browsing without triggering playback)
    const [exploredSeasonNumber, setExploredSeasonNumber] = useState(season);
    const [exploredSeasonEpisodes, setExploredSeasonEpisodes] = useState<Episode[]>([]);

    // Settings Panel - use correct panel types
    const [activePanel, setActivePanel] = useState<'none' | 'episodes' | 'seasons' | 'audioSubtitles' | 'quality'>('none');
    const [isPanelHovered, setIsPanelHovered] = useState(false);

    // Subtitles
    const [captions, setCaptions] = useState<{ id: string; label: string; url: string; lang: string }[]>([]);
    const [currentCaption, setCurrentCaption] = useState<string | null>(null);
    const [subtitleObjectUrl, setSubtitleObjectUrl] = useState<string | null>(null);

    // Quality levels from HLS
    const [qualityLevels, setQualityLevels] = useState<{ height: number; bitrate: number; level: number }[]>([]);
    const [currentQualityLevel, setCurrentQualityLevel] = useState<number>(-1); // -1 = auto

    // Mobile touch gesture state
    const [skipIndicator, setSkipIndicator] = useState<{ direction: 'left' | 'right' | null; visible: boolean }>({
        direction: null,
        visible: false
    });

    // Touch gesture handlers
    const showSkipIndicator = useCallback((direction: 'left' | 'right') => {
        setSkipIndicator({ direction, visible: true });
        setTimeout(() => setSkipIndicator({ direction: null, visible: false }), 500);
    }, []);

    const handleSkipBack = useCallback(() => {
        const video = videoRef.current;
        if (video) {
            video.currentTime = Math.max(0, video.currentTime - 10);
            showSkipIndicator('left');
        }
    }, [showSkipIndicator]);

    const handleSkipForward = useCallback(() => {
        const video = videoRef.current;
        if (video) {
            video.currentTime = Math.min(video.duration, video.currentTime + 10);
            showSkipIndicator('right');
        }
    }, [showSkipIndicator]);

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
    
    // Manage Network Priority
    useEffect(() => {
        NetworkPriority.setVideoActive(true);
        return () => NetworkPriority.setVideoActive(false);
    }, []);


    // --- Fetch Stream using Puppeteer ---
    // Definitions for title and release date
    const title = movie.title || movie.name || '';
    const formattedDate = movie.release_date || movie.first_air_date || '';

    // --- Fetch Stream using Consumet API with Smart Caching ---
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
                    ? SubtitleService.getOpenSubtitles(String(movie.id), playingSeasonNumber, currentEpisode).catch(() => [])
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

                if (result.success && result.sources && result.sources.length > 0) {
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
            const activeReferer = hlsSource.referer || globalReferer || '';

            let finalUrl = hlsSource.url;
            if (!isEmbedFallback) {
                finalUrl = hlsSource.isM3U8 
                    ? `${GIGA_BACKEND_URL}/proxy/m3u8?url=${encodeURIComponent(hlsSource.url)}&referer=${encodeURIComponent(activeReferer)}`
                    : `${GIGA_BACKEND_URL}/proxy/video?url=${encodeURIComponent(hlsSource.url)}&referer=${encodeURIComponent(activeReferer)}`;
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
                if (matchingSub && settings.showSubtitles) {
                    setCurrentCaption(matchingSub.url);
                }
            }
        };

        fetchStream();

        // Cleanup on unmount
        return () => {
            if (hlsRef.current) {
                hlsRef.current.destroy();
                hlsRef.current = null;
            }
        };
    }, [movie.id, mediaType, playingSeasonNumber, currentEpisode]);

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

    // --- Initialize HLS.js when stream    // HLS Initialization
    useEffect(() => {
        if (!streamUrl || !videoRef.current || isEmbed) {
            // For embeds, we stop buffering immediately because the iframe handles its own loading.
            if (isEmbed && isBuffering) {
                setTimeout(() => setIsBuffering(false), 500); 
            }
            return;
        }

        const video = videoRef.current;

        // Destroy previous HLS instance
        if (hlsRef.current) {
            hlsRef.current.destroy();
            hlsRef.current = null;
        }

        // Check if HLS is supported or if it's a direct MP4
        if (!isStreamM3U8) {
            console.log('[VideoPlayer] Direct MP4 stream detected, bypassing HLS.js');
            video.src = streamUrl;
            video.addEventListener('loadedmetadata', () => {
                setIsBuffering(false);
                video.play().catch(err => console.warn('Autoplay blocked:', err));
            });
        } else if (Hls.isSupported()) {
            const hls = new Hls();
            hlsRef.current = hls;
            hls.loadSource(streamUrl);
            hls.attachMedia(video);

            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                console.log('[VideoPlayer] HLS manifest parsed, starting playback');
                setIsBuffering(false);

                // Extract quality levels from HLS
                if (hls.levels && hls.levels.length > 0) {
                    const levels = hls.levels.map((level, index) => ({
                        height: level.height || 0,
                        bitrate: level.bitrate || 0,
                        level: index
                    })).sort((a, b) => b.height - a.height);
                    setQualityLevels(levels);
                    console.log('[VideoPlayer] Quality levels:', levels.map(l => `${l.height}p`));
                }

                // Resume from saved position
                if (mediaType === 'tv') {
                    const saved = getEpisodeProgress(movie.id, playingSeasonNumber, currentEpisode);
                    if (saved && saved.time > 10 && saved.time < (saved.duration - 30)) {
                        console.log('[VideoPlayer] Resuming TV from', saved.time);
                        video.currentTime = saved.time;
                    }
                } else {
                    const saved = getVideoState(movie.id);
                    if (saved && saved.time > 10) {
                        console.log('[VideoPlayer] Resuming Movie from', saved.time);
                        video.currentTime = saved.time;
                    }
                }

                video.play().catch(err => {
                    console.warn('[VideoPlayer] Autoplay blocked:', err);
                });
            });

            hls.on(Hls.Events.ERROR, (event, data) => {
                if (data.fatal) {
                    console.error('[VideoPlayer] HLS fatal error:', data);

                    // Invisible Mirror-Switching
                    if (currentSourceIndex < allSources.length - 1) {
                        const nextIndex = currentSourceIndex + 1;
                        const nextSource = allSources[nextIndex];
                        setCurrentSourceIndex(nextIndex);
                        setLoadingMessage(`Switching to mirror ${nextIndex + 1}...`);
                        const nextIsEmbed = !!nextSource.isEmbed;
                        setIsEmbed(nextIsEmbed);
                        let nextUrl = nextSource.url;
                        if (!nextIsEmbed) {
                            nextUrl = nextSource.isM3U8 
                                ? `${GIGA_BACKEND_URL}/proxy/m3u8?url=${encodeURIComponent(nextSource.url)}&referer=${encodeURIComponent(streamReferer || '')}`
                                : `${GIGA_BACKEND_URL}/proxy/video?url=${encodeURIComponent(nextSource.url)}&referer=${encodeURIComponent(streamReferer || '')}`;
                        }
                        
                        setStreamUrl(nextUrl);
                        setIsStreamM3U8(!!nextSource.isM3U8);
                        return;
                    }

                    setError(`Playback error: ${data.details || data.type}. Try again later.`);
                    hls.destroy();
                }
            });

        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            // Native HLS support (Safari)
            video.src = streamUrl;
            video.addEventListener('loadedmetadata', () => {
                setIsBuffering(false);
                video.play();
            });
        } else {
            setError('HLS playback not supported in this browser');
        }

        return () => {
            if (hlsRef.current) {
                hlsRef.current.destroy();
                hlsRef.current = null;
            }
        };
    }, [streamUrl, streamReferer, isStreamM3U8]);

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
        if (!video) return;

        setCurrentTime(video.currentTime);
        setDuration(video.duration || 0);
        setProgress(video.duration > 0 ? (video.currentTime / video.duration) * 100 : 0);

        // Save progress & history every 5 seconds
        if (video.duration > 0) {
            const now = Date.now();
            const currentProgress = (video.currentTime / video.duration) * 100;
            
            // Auto-trigger next episode at 99.5% (Smart Autoplay)
            if (mediaType === 'tv' && settings.autoplayNextEpisode && currentProgress >= 99.5) {
                const nextEp = currentSeasonEpisodes.find(e => e.episode_number === currentEpisode + 1);
                if (nextEp) {
                    console.log('[VideoPlayer] 🍿 Autoplay: 99.5% reached, switching to next episode...');
                    handleEpisodeSelect(nextEp);
                    return; // Stop further updates for this episode
                }
            }

            if (now - lastSaveRef.current > 5000) {
                lastSaveRef.current = now;

                // Add to Continue Watching
                addToHistory(movie);

                if (mediaType === 'tv') {
                    updateEpisodeProgress(movie.id, playingSeasonNumber, currentEpisode, video.currentTime, video.duration);
                    // Also save for InfoModal resume compatibility
                    localStorage.setItem(`kinemora-last-watched-${movie.id}`, JSON.stringify({
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

    const handleSeek = useCallback((time: number) => {
        const video = videoRef.current;
        if (video) {
            video.currentTime = time;
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

    const handleBoostChange = useCallback((newBoost: number) => {
        setAudioBoost(newBoost);
        const electron = (window as any).electron;
        if (electron?.audio?.setBoost) {
            electron.audio.setBoost(newBoost);
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
    const resetInactivityTimer = useCallback(() => {
        setShowUI(true);
        if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = setTimeout(() => {
            if (activePanel === 'none' && !isPanelHovered) {
                setShowUI(false);
            }
        }, 3000);
    }, [activePanel, isPanelHovered]);

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
                    handleSeek(currentTime - 10);
                    break;
                case 'arrowright':
                    e.preventDefault();
                    handleSeek(currentTime + 10);
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
    }, [togglePlay, handleSeek, handleVolumeChange, toggleMute, toggleFullscreen, currentTime, volume, activePanel, onClose]);

    // Episode navigation - SELECT = actually play
    const handleEpisodeSelect = useCallback((ep: Episode) => {
        // Update PLAYBACK state - this triggers stream fetch
        setPlayingSeasonNumber(exploredSeasonNumber);
        setCurrentSeasonEpisodes(exploredSeasonEpisodes);
        setCurrentEpisode(ep.episode_number);
        setActivePanel('none');

        // Update URL for deep linking (so refresh maintains episode)
        if (mediaType === 'tv') {
            const newUrl = `/watch/tv/${movie.id}?season=${exploredSeasonNumber}&episode=${ep.episode_number}`;
            window.history.replaceState(null, '', newUrl);
        }
    }, [exploredSeasonNumber, exploredSeasonEpisodes, mediaType, movie.id]);

    const handleShare = useCallback(() => {
        const type = mediaType === 'tv' ? 'tv' : 'movie';
        const url = `${window.location.protocol}//${window.location.host}/watch/${type}/${movie.id}${mediaType === 'tv' ? `?season=${playingSeasonNumber}&episode=${currentEpisode}` : ''}`;
        
        navigator.clipboard.writeText(url).then(() => {
            // Provide visual feedback via the loading message (temporary 2s toast)
            const oldMessage = loadingMessage;
            setLoadingMessage('✨ Link Copied to Clipboard!');
            setTimeout(() => setLoadingMessage(oldMessage), 2000);
        }).catch(err => {
            console.error('Failed to copy link:', err);
        });
    }, [mediaType, movie.id, playingSeasonNumber, currentEpisode, loadingMessage]);

    // Season EXPLORATION - just browse, don't trigger playback
    const handleSeasonExplore = useCallback(async (s: number) => {
        setExploredSeasonNumber(s);
        try {
            const seasonData = await getSeasonDetails(String(movie.id), s);
            if (seasonData?.episodes) {
                setExploredSeasonEpisodes(seasonData.episodes);
            }
        } catch (error) {
            console.error('[VideoPlayer] Error fetching season for exploration:', error);
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

    // --- Subtitle Dynamic Style Injection ---
    const subtitleStyles = useMemo(() => {
        const { subtitleSize, subtitleColor, subtitleFontFamily, subtitleOpacity, subtitleEdgeStyle, subtitleBackground, subtitleWindowColor } = settings;
        
        let fontSize = '24px';
        if (subtitleSize === 'tiny') fontSize = '16px';
        if (subtitleSize === 'small') fontSize = '20px';
        if (subtitleSize === 'medium') fontSize = '32px';
        if (subtitleSize === 'large') fontSize = '48px';
        if (subtitleSize === 'huge') fontSize = '64px';

        let edge = 'none';
        if (subtitleEdgeStyle === 'drop-shadow') edge = '2px 2px 4px rgba(0,0,0,0.8)';
        if (subtitleEdgeStyle === 'outline') edge = '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000';
        if (subtitleEdgeStyle === 'raised') edge = '0 1px 0 #ccc, 0 2px 0 #c9c9c9, 0 3px 0 #bbb, 0 4px 0 #b9b9b9, 0 5px 0 #aaa, 0 6px 1px rgba(0,0,0,.1), 0 0 5px rgba(0,0,0,.1), 0 1px 3px rgba(0,0,0,.3), 0 3px 5px rgba(0,0,0,.2), 0 5px 10px rgba(0,0,0,.25), 0 10px 10px rgba(0,0,0,.2), 0 20px 20px rgba(0,0,0,.15)';

        let bgColor = 'transparent';
        if (subtitleBackground === 'box') {
            bgColor = subtitleWindowColor === 'black' ? `rgba(0,0,0,${subtitleOpacity / 100})` : `rgba(0,0,255,${subtitleOpacity / 100})`;
        }

        return `
            video::cue {
                background-color: ${bgColor};
                color: ${subtitleColor};
                font-family: ${subtitleFontFamily};
                font-size: ${fontSize};
                text-shadow: ${edge};
                font-weight: bold;
            }
        `;
    }, [settings]);

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

            {/* Server Switcher (Only visible for embeds) */}
            {isEmbed && allSources.length > 1 && (
                <div className={`absolute top-10 right-6 z-50 transition-opacity duration-300 ${showUI ? 'opacity-100' : 'opacity-0'}`}>
                    <div className="bg-black/80 backdrop-blur-md rounded-lg p-2 flex gap-2 border border-white/10 shadow-2xl">
                        <span className="text-white/50 text-xs uppercase tracking-wider font-bold self-center px-2">Servers</span>
                        {allSources.map((src, idx) => (
                            <button
                                key={idx}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setCurrentSourceIndex(idx);
                                    setStreamUrl(src.url);
                                    setLoadingMessage(`Loading ${src.serverName || src.name || `Server ${idx + 1}`}...`);
                                    setIsBuffering(true);
                                    // Iframes don't report when they finish loading reliably, so we fake it after 1.5s
                                    setTimeout(() => setIsBuffering(false), 1500);
                                }}
                                className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${
                                    currentSourceIndex === idx 
                                    ? 'bg-[#E50914] text-white shadow-[0_0_10px_rgba(229,9,20,0.5)]' 
                                    : 'bg-white/10 text-white hover:bg-white/20'
                                }`}
                            >
                                {src.serverName || src.name || `Server ${idx + 1}`}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Native Video Element or Embedded Iframe */}
            {isEmbed ? (
                <iframe
                    src={streamUrl || undefined}
                    className="absolute inset-0 w-full h-full border-none pointer-events-auto"
                    style={{ zIndex: 25, backgroundColor: 'black' }}
                    allowFullScreen
                    allow="autoplay; fullscreen"
                    // Sandbox tag completely removed to prevent blocking 3rd party providers
                />
            ) : (
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
                        if (nextEp) handleEpisodeSelect(nextEp);
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
            )}

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
                        <p className="text-white/60">{error}</p>
                        <button
                            onClick={onClose}
                            className="mt-6 px-6 py-2 bg-red-600 hover:bg-red-700 rounded"
                        >
                            Go Back
                        </button>
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
                    isBuffering={isBuffering}
                    title={displayTitle}
                    showNextEp={mediaType === 'tv' && (
                        currentSeasonEpisodes.some(e => e.episode_number === currentEpisode + 1) ||
                        seasonList.includes(playingSeasonNumber + 1)
                    )}
                    onPlayPause={togglePlay}
                    onSeek={handleSeek}
                    volume={volume}
                    onVolumeChange={handleVolumeChange}
                    onToggleMute={toggleMute}
                    onTimelineSeek={(pct) => {
                        const video = videoRef.current;
                        if (video && duration > 0) {
                            video.currentTime = (pct / 100) * duration;
                        }
                    }}
                    onNextEpisode={() => {
                        const nextEp = currentSeasonEpisodes.find(e => e.episode_number === currentEpisode + 1);
                        if (nextEp) {
                            handleEpisodeSelect(nextEp);
                        } else {
                            // Try next season
                            const nextSeason = playingSeasonNumber + 1;
                            if (seasonList.includes(nextSeason)) {
                                // Fetch first episode of next season
                                getSeasonDetails(String(movie.id), nextSeason).then(seasonData => {
                                    if (seasonData?.episodes?.length > 0) {
                                        const firstEp = seasonData.episodes[0].episode_number;
                                        setPlayingSeasonNumber(nextSeason);
                                        setCurrentSeasonEpisodes(seasonData.episodes);
                                        setCurrentEpisode(firstEp);
                                        // Update URL for deep linking
                                        window.history.replaceState(null, '', `/watch/tv/${movie.id}?season=${nextSeason}&episode=${firstEp}`);
                                    }
                                });
                            }
                        }
                    }}
                    onClose={onClose || (() => window.history.back())}
                    onToggleFullscreen={toggleFullscreen}
                    onSettingsClick={() => setActivePanel(activePanel === 'quality' ? 'none' : 'quality')}
                    onSubtitlesClick={() => setActivePanel(activePanel === 'audioSubtitles' ? 'none' : 'audioSubtitles')}
                    onSubtitlesHover={() => setIsPanelHovered(true)}
                    onSettingsHover={() => setIsPanelHovered(true)}
                    onEpisodesClick={mediaType === 'tv' ? () => setActivePanel(activePanel === 'episodes' ? 'none' : 'episodes') : undefined}
                    onEpisodesHover={mediaType === 'tv' ? () => setIsPanelHovered(true) : undefined}
                    showUI={showUI}
                />
            </div>

            {/* Settings Panel */}
            {activePanel !== 'none' && (
                <VideoPlayerSettings
                    activePanel={activePanel}
                    setActivePanel={setActivePanel}
                    captions={captions}
                    currentCaption={currentCaption}
                    onSubtitleChange={setCurrentCaption}
                    seasonList={seasonList}
                    selectedSeason={exploredSeasonNumber}
                    playingSeason={playingSeasonNumber}
                    showId={movie.id}
                    currentSeasonEpisodes={exploredSeasonEpisodes.length > 0 ? exploredSeasonEpisodes : currentSeasonEpisodes}
                    currentEpisode={currentEpisode}
                    onSeasonSelect={handleSeasonExplore}
                    onEpisodeSelect={handleEpisodeSelect}
                    onEpisodeExpand={(season, ep) => {
                        console.log(`[VideoPlayer] Prefetching S${season}E${ep} for faster playback`);
                        // Future: could prefetch stream info here
                    }}
                    qualities={qualityLevels}
                    currentQuality={currentQualityLevel}
                    onQualityChange={(level) => {
                        if (hlsRef.current) {
                            hlsRef.current.currentLevel = level;
                            setCurrentQualityLevel(level);
                            console.log('[VideoPlayer] Quality changed to level:', level);
                        }
                    }}
                    showTitle={displayTitle}
                    onPanelHover={() => setIsPanelHovered(true)}
                    onStartHide={() => setIsPanelHovered(false)}
                />
            )}
        </div>
    );
};

export default VideoPlayer;