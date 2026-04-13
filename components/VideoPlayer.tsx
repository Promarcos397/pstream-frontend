import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Movie, Episode } from '../types';
import { getSeasonDetails, getMovieDetails, getStream, getExternalIds, prefetchStream } from '../services/api';
import Hls from 'hls.js';
import ISO6391 from 'iso-639-1';

import { useGlobalContext } from '../context/GlobalContext';
import { useTitle } from '../context/TitleContext';
import { streamCache } from '../utils/streamCache';
import { useTouchGestures } from '../hooks/useTouchGestures';
import { useIsMobile } from '../hooks/useIsMobile';
import { SubtitleService } from '../services/SubtitleService';
import { SkipService, SkipSegment } from '../services/SkipService';
import { NetworkPriority } from '../services/NetworkPriority';
import { useHls } from '../hooks/useHls';

// Giga Engine Backend URL
const GIGA_BACKEND_URL = import.meta.env.VITE_GIGA_BACKEND_URL || 'https://ibrahimar397-pstream-giga.hf.space';

// Child Components
import VideoPlayerControls from './VideoPlayerControls';
import VideoPlayerSettings from './VideoPlayerSettings';
import { CaretRightIcon } from '@phosphor-icons/react';

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
    const { settings, updateEpisodeProgress, getEpisodeProgress, updateVideoState, addToHistory, getVideoState, setActiveVideoId } = useGlobalContext();
    const { setPageTitle } = useTitle();
    const isMobile = useIsMobile();
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
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('Finding stream...');
    const [streamUrl, setStreamUrl] = useState<string | null>(null);
    const [streamReferer, setStreamReferer] = useState<string | null>(null);
    const [allSources, setAllSources] = useState<any[]>([]);
    const [currentSourceIndex, setCurrentSourceIndex] = useState(0);
    const [isStreamM3U8, setIsStreamM3U8] = useState<boolean>(true);
    const [isEmbed, setIsEmbed] = useState<boolean>(false);
    const [retryCount, setRetryCount] = useState(0);
    const [error, setError] = useState<string | null>(null);

    // TV Show state
    const mediaType = movie.media_type || (movie.first_air_date ? 'tv' : 'movie');
    const [currentEpisode, setCurrentEpisode] = useState(episode);
    const [playingSeasonNumber, setPlayingSeasonNumber] = useState(season);
    const [browsedSeasonNumber, setBrowsedSeasonNumber] = useState(season);
    const [seasonList, setSeasonList] = useState<number[]>([]);
    const [currentSeasonEpisodes, setCurrentSeasonEpisodes] = useState<Episode[]>([]);

    // Navigation state
    const [activePanel, setActivePanel] = useState<'none' | 'episodes' | 'seasons' | 'audioSubtitles' | 'quality' | 'servers'>('none');

    // Subtitles
    const [captions, setCaptions] = useState<{ id: string; label: string; url: string; lang: string }[]>([]);
    const [currentCaption, setCurrentCaption] = useState<string | null>(null);
    const [subtitleObjectUrl, setSubtitleObjectUrl] = useState<string | null>(null);

    // Store Backdrop globally for Tooltip Previews
    useEffect(() => {
        const backdrop = movie.backdrop_path ? `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}` : '';
        (window as any).__video_backdrop = backdrop;
    }, [movie.id]);
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

    // ─── Touch gestures ──────────────────────────────────────────────────────────
    // Double-tap left/right = ±10s seek; double-tap center = play/pause
    useTouchGestures(containerRef, {
        onDoubleTapLeft: () => { if (videoRef.current) videoRef.current.currentTime -= 10; },
        onDoubleTapRight: () => { if (videoRef.current) videoRef.current.currentTime += 10; },
        onDoubleTapCenter: () => { videoRef.current?.paused ? videoRef.current.play() : videoRef.current?.pause(); },
        onSingleTap: () => { setShowUI(v => !v); },
    });

    // ─── Compute next episode / season ─────────────────────────────────────────
    const nextEpisodeInfo = useMemo<{ episode: Episode; season: number } | null>(() => {
        if (mediaType !== 'tv') return null;
        const currentIdx = currentSeasonEpisodes.findIndex(ep => ep.episode_number === currentEpisode);
        if (currentIdx !== -1 && currentIdx < currentSeasonEpisodes.length - 1) {
            return { episode: currentSeasonEpisodes[currentIdx + 1], season: playingSeasonNumber };
        }
        // End of season — try next season
        if (seasonList.length > 0) {
            const nextSeason = seasonList.find(s => s > playingSeasonNumber);
            if (nextSeason !== undefined) {
                // We don't have the episodes for the next season yet, so we return a placeholder
                return { episode: { id: -1, episode_number: 1, name: 'Next Season', season_number: nextSeason } as Episode, season: nextSeason };
            }
        }
        return null;
    }, [mediaType, currentSeasonEpisodes, currentEpisode, playingSeasonNumber, seasonList]);

    // ─── Apply stream result ────────────────────────────────────────────────────
    const applyStreamResult = useCallback((sources: any[], subtitles: any[], globalReferer?: string | null) => {
        if (!sources || sources.length === 0) return;

        setAllSources(sources);
        const hlsSource = sources[0];
        const isEmbedFallback = !!hlsSource.isEmbed;
        setIsEmbed(isEmbedFallback);

        const activeReferer = hlsSource.referer || globalReferer || '';
        let finalUrl = hlsSource.url;

        if (!isEmbedFallback) {
            if (hlsSource.directManifest) {
                const blob = new Blob([hlsSource.directManifest], { type: 'application/vnd.apple.mpegurl' });
                finalUrl = URL.createObjectURL(blob);
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
        setLoadingMessage('Loading video...');

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
                setCurrentCaption(finalSub.url);
            }
        }

        if (isEmbedFallback) {
            setTimeout(() => setIsBuffering(false), 1500);
        }
    }, [settings.subtitleLanguage, settings.showSubtitles]);

    // ─── Manual source change ────────────────────────────────────────────────────
    const handleSourceChange = useCallback((index: number) => {
        if (!allSources[index]) return;
        console.log(`[VideoPlayer] 🔄 Manual server change to: ${allSources[index].provider}`);
        setCurrentSourceIndex(index);
        setError(null);
        setIsBuffering(true);
        setLoadingMessage(`Switching to ${allSources[index].provider || 'Server'}...`);
        applyStreamResult([allSources[index]], captions);
    }, [allSources, applyStreamResult, captions]);

    // ─── Play next episode ──────────────────────────────────────────────────────
    const handleNextEpisode = useCallback(async () => {
        if (!nextEpisodeInfo) return;
        const { episode: nextEp, season: nextSeason } = nextEpisodeInfo;

        setStreamUrl(null);
        setIsBuffering(true);
        setActivePanel('none');

        // If we need to load a new season's episodes first
        if (nextSeason !== playingSeasonNumber) {
            try {
                const seasonData = await getSeasonDetails(String(movie.id), nextSeason);
                if (seasonData?.episodes) {
                    setCurrentSeasonEpisodes(seasonData.episodes);
                    const firstEp = seasonData.episodes[0];
                    setPlayingSeasonNumber(nextSeason);
                    setCurrentEpisode(firstEp?.episode_number ?? 1);
                }
            } catch (e) {
                setPlayingSeasonNumber(nextSeason);
                setCurrentEpisode(1);
            }
        } else {
            setPlayingSeasonNumber(nextSeason);
            setCurrentEpisode(nextEp.episode_number);
        }
    }, [nextEpisodeInfo, playingSeasonNumber, movie.id]);

    // ─── Track episode/season prop changes ─────────────────────────────────────
    useEffect(() => {
        if (season !== playingSeasonNumber) setPlayingSeasonNumber(season);
        if (episode !== currentEpisode) setCurrentEpisode(episode);
    }, [season, episode]);

    // ─── Keyboard shortcuts ─────────────────────────────────────────────────────
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (activePanel !== 'none') return;
            switch (e.key) {
                case 'Escape':
                    e.preventDefault();
                    if (onClose) onClose();
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
                    e.preventDefault();
                    if (videoRef.current) videoRef.current.volume = Math.min(1, videoRef.current.volume + 0.1);
                    break;
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
    }, [onClose, activePanel, nextEpisodeInfo, handleNextEpisode]);

    // ─── Fetch Stream ───────────────────────────────────────────────────────────
    useEffect(() => {
        const fetchStream = async () => {
            setIsBuffering(true);
            setError(null);
            setStreamUrl(null);
            setLoadingMessage('Searching for stream...');

            const releaseYear = formattedDate ? parseInt(formattedDate.split('-')[0]) : undefined;
            const cacheKey = {
                title,
                type: (mediaType === 'tv' ? 'tv' : 'movie') as 'tv' | 'movie',
                year: releaseYear,
                season: playingSeasonNumber,
                episode: currentEpisode,
                tmdbId: String(movie.id || '')
            };

            const cached = streamCache.get(cacheKey);
            if (cached && cached.sources?.length > 0) {
                applyStreamResult(cached.sources, cached.subtitles);
                return;
            }

            try {
                const openSubPromise = settings.showSubtitles
                    ? SubtitleService.getSubtitleTracks(
                        String(movie.id),
                        mediaType === 'tv' ? 'tv' : 'movie',
                        playingSeasonNumber,
                        currentEpisode,
                        // Pass browser language as preferred so we get native subtitles
                        settings.subtitleLanguage || navigator.language?.split('-')[0] || 'en'
                      ).catch(() => [])
                    : Promise.resolve([]);

                let imdbId = movie.imdb_id;
                if (!imdbId) {
                    try {
                        const ext = await getExternalIds(movie.id, mediaType === 'tv' ? 'tv' : 'movie');
                        if (ext?.imdb_id) imdbId = ext.imdb_id;
                    } catch (e) {}
                }

                const result = await getStream(title, mediaType === 'tv' ? 'tv' : 'movie', releaseYear, playingSeasonNumber, currentEpisode, String(movie.id || ''), imdbId || '');

                if (result?.success && result.sources?.length > 0) {
                    const osSubs = await openSubPromise;
                    const combinedSubs = [...(result.subtitles || []), ...osSubs];
                    streamCache.set(cacheKey, { sources: result.sources, subtitles: combinedSubs, provider: result.provider || 'unknown' });
                    applyStreamResult(result.sources, combinedSubs, result.referer);
                } else {
                    setError(result?.error || 'No stream found for this title.');
                    setIsBuffering(false);
                }
            } catch (err: any) {
                setError(err.message || 'Failed to fetch stream');
                setIsBuffering(false);
            }
        };

        fetchStream();
    }, [movie.id, mediaType, playingSeasonNumber, currentEpisode, retryCount, applyStreamResult]);

    // ─── Skip Segments (TV only) ────────────────────────────────────────────────
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

    // ─── Prefetch next episode when 50%+ through a long episode ─────────────────
    useEffect(() => {
        if (mediaType !== 'tv' || !nextEpisodeInfo || duration < 3600) return;
        if (progress < 50) return;

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

        if (!streamCache.get(cacheKey)) {
            console.log(`[VideoPlayer] Prefetching next episode S${nextSeason}E${nextEp.episode_number}...`);
            prefetchStream(title, releaseYear || 0, String(movie.id), 'tv', nextSeason, nextEp.episode_number)
                .catch(() => {});
        }
    }, [progress, duration, mediaType, nextEpisodeInfo]);

    // ─── HLS Hook ────────────────────────────────────────────────────────────────
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
        onTokenExpired: () => setRetryCount(c => c + 1),
        onError: (errMsg) => {
            if (currentSourceIndex < allSources.length - 1) {
                handleSourceChange(currentSourceIndex + 1);
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

    // ─── Seek to resume time on load ─────────────────────────────────────────────
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
        };

        video.addEventListener('canplay', handleCanPlay, { once: true });
        return () => video.removeEventListener('canplay', handleCanPlay);
    }, [streamUrl, mediaType, playingSeasonNumber, currentEpisode]);

    // ─── Time Update & History ────────────────────────────────────────────────────
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

    const handleEpisodeSelect = useCallback((ep: Episode, seasonNum?: number, episodes?: Episode[]) => {
        setStreamUrl(null);
        setIsBuffering(true);
        setPlayingSeasonNumber(seasonNum || ep.season_number || playingSeasonNumber);
        if (episodes) setCurrentSeasonEpisodes(episodes);
        setCurrentEpisode(ep.episode_number);
        setActivePanel('none');
    }, [playingSeasonNumber]);

    // ─── Custom Subtitle Cue Engine ───────────────────────────────────────────────
    // We parse the VTT file directly and drive currentCueText via a polling ref.
    const parsedCuesRef = useRef<Array<{ start: number; end: number; text: string }>>([]);

    useEffect(() => {
        if (!currentCaption) {
            setSubtitleObjectUrl(null);
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

                // Also produce a blob URL for any other consumers
                const { convertSubtitlesToObjectUrl } = await import('../utils/captions');
                const url = convertSubtitlesToObjectUrl(text);
                if (url && isMounted) setSubtitleObjectUrl(url);
            } catch (e) {
                console.error('[VideoPlayer] Subtitle load failed', e);
            }
        };
        loadSubtitles();
        return () => { isMounted = false; };
    }, [currentCaption]);

    // Poll video currentTime to update the active cue text
    useEffect(() => {
        const update = () => {
            const video = videoRef.current;
            if (!video) return;
            const t = video.currentTime;
            const cue = parsedCuesRef.current.find(c => t >= c.start && t <= c.end);
            setCurrentCueText(cue ? cue.text : '');
        };
        const vid = videoRef.current;
        vid?.addEventListener('timeupdate', update);
        return () => vid?.removeEventListener('timeupdate', update);
    }, [subtitleObjectUrl]);



    // ─── TV Details init ──────────────────────────────────────────────────────────
    useEffect(() => {
        const init = async () => {
            if (mediaType === 'tv') {
                try {
                    const details = await getMovieDetails(String(movie.id), 'tv');
                    if (details.seasons) {
                        const validSeasons = details.seasons
                            .filter((s: any) => s.season_number > 0)
                            .map((s: any) => s.season_number);
                        setSeasonList(validSeasons);
                    }
                    const seasonData = await getSeasonDetails(String(movie.id), playingSeasonNumber);
                    if (seasonData?.episodes) setCurrentSeasonEpisodes(seasonData.episodes);
                } catch (e) {}
            }
        };
        init();
    }, [movie.id, mediaType, playingSeasonNumber]);

    // ─── UI show/hide ─────────────────────────────────────────────────────────────
    const isControlsHovered = useRef(false);

    const showControls = useCallback(() => {
        setShowUI(true);
        // Don't start a hide timer if a panel is open or mouse is over controls
        if (isControlsHovered.current || activePanel !== 'none') return;
        if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = setTimeout(() => {
            if (!isControlsHovered.current) setShowUI(false);
        }, 3500);
    }, [activePanel]);

    // When panel opens, cancel the hide timer
    useEffect(() => {
        if (activePanel !== 'none') {
            if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
            setShowUI(true);
        }
    }, [activePanel]);

    // ─── Fullscreen toggle ────────────────────────────────────────────────────────
    const toggleFullscreen = useCallback(() => {
        const el = containerRef.current as any;
        const doc = document as any;
        if (doc.fullscreenElement || doc.webkitFullscreenElement) {
            if (doc.exitFullscreen) doc.exitFullscreen();
            else if (doc.webkitExitFullscreen) doc.webkitExitFullscreen();
            setIsFullscreen(false);
            // Unlock orientation on exit
            try { (screen.orientation as any)?.unlock?.(); } catch (e) {}
        } else {
            if (el?.requestFullscreen) {
                el.requestFullscreen().then(() => {
                    if ((screen.orientation as any)?.lock) {
                        (screen.orientation as any).lock('landscape').catch(() => {});
                    }
                }).catch(() => {});
            } else if (el?.webkitRequestFullscreen) el.webkitRequestFullscreen();
            else if (el?.webkitEnterFullscreen) el.webkitEnterFullscreen();
            setIsFullscreen(true);
        }
    }, []);

    // ─── Track fullscreen state changes from browser ──────────────────────────────
    useEffect(() => {
        const onFsChange = () => {
            const doc = document as any;
            setIsFullscreen(!!(doc.fullscreenElement || doc.webkitFullscreenElement));
        };
        document.addEventListener('fullscreenchange', onFsChange);
        document.addEventListener('webkitfullscreenchange', onFsChange);
        return () => {
            document.removeEventListener('fullscreenchange', onFsChange);
            document.removeEventListener('webkitfullscreenchange', onFsChange);
        };
    }, []);

    return (
        <div
            ref={containerRef}
            className="fixed inset-0 bg-black z-[100] flex flex-col font-sans select-none overflow-hidden"
            onMouseMove={showControls}
            onTouchStart={showControls}
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
                className="w-full h-full object-contain"
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

            {/* ── Custom Subtitle Overlay (replaces native <track> for full style control) ── */}
            {subtitleObjectUrl && currentCueText && (
                <div
                    className="subtitle-overlay"
                    style={{
                        bottom: showUI ? '7rem' : '2.5rem',
                        fontFamily: settings.subtitleFontFamily || "'Consolas', monospace",
                        fontSize: settings.subtitleSize === 'small' ? 'clamp(12px, 1.6vw, 17px)' :
                                  settings.subtitleSize === 'large' ? 'clamp(18px, 2.8vw, 28px)' :
                                  'clamp(14px, 2.2vw, 22px)',
                    }}
                >
                    <span
                        className="subtitle-line"
                        style={{
                            color: settings.subtitleColor || 'white',
                            backgroundColor: (settings.subtitleBackground as string) !== 'none'
                                ? ((settings.subtitleBackground as string) === 'black' ? 'rgba(0,0,0,0.75)' :
                                   (settings.subtitleBackground as string) === 'white' ? 'rgba(255,255,255,0.15)' :
                                   (settings.subtitleBackground as string) === 'box' ? 'rgba(0,0,0,0.75)' : 'transparent')
                                : 'transparent',
                            textShadow: settings.subtitleEdgeStyle === 'drop-shadow'
                                ? '0 1px 4px rgba(0,0,0,0.95), 0 0 12px rgba(0,0,0,0.8)'
                                : settings.subtitleEdgeStyle === 'outline'
                                    ? '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000'
                                    : 'none',
                        }}
                        dangerouslySetInnerHTML={{ __html: currentCueText.replace(/\n/g, '<br/>') }}
                    />
                </div>
            )}

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
                showNextEp={showSkipOutro && !!nextEpisodeInfo}
                onSubtitlesClick={() => setActivePanel(p => p === 'audioSubtitles' ? 'none' : 'audioSubtitles')}
                currentCaption={currentCaption}
                onEpisodesClick={mediaType === 'tv'
                    ? () => {
                        setBrowsedSeasonNumber(playingSeasonNumber);
                        setActivePanel(p => (p === 'episodes' || p === 'seasons') ? 'none' : 'episodes');
                      }
                    : undefined}
                // Next episode popup data
                nextEpisodeData={nextEpisodeInfo ? {
                    episodeNumber: nextEpisodeInfo.episode.episode_number,
                    name: nextEpisodeInfo.episode.name || `Episode ${nextEpisodeInfo.episode.episode_number}`,
                    description: (nextEpisodeInfo.episode as any).overview || '',
                    stillPath: (nextEpisodeInfo.episode as any).still_path || null,
                } : null}
            />

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
                    // Load season episodes when switching seasons in the explorer
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
                audioTracks={audioTracks}
                currentAudioTrack={currentAudioTrack}
                onAudioChange={changeAudioTrack}
                allSources={allSources}
                currentSourceIndex={currentSourceIndex}
                onSourceChange={handleSourceChange}
            />

            {/* Skip Intro Button */}
            {showSkipIntro && activeSkipSegment && (
                <button
                    onClick={() => {
                        if (videoRef.current) videoRef.current.currentTime = activeSkipSegment.endTime;
                        setShowSkipIntro(false);
                    }}
                    className="absolute bottom-32 left-8 px-6 py-3 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 text-white font-bold rounded flex items-center gap-2 transition-all active:scale-95 z-30"
                >
                    <CaretRightIcon weight="bold" /> Skip Intro
                </button>
            )}

            {/* Skip Outro / Next Episode Button */}
            {showSkipOutro && nextEpisodeInfo && (
                <button
                    onClick={handleNextEpisode}
                    className="absolute bottom-32 right-8 px-6 py-3 bg-white text-black font-bold rounded flex items-center gap-2 hover:bg-white/90 transition-all active:scale-95 z-30 shadow-lg"
                >
                    <CaretRightIcon weight="bold" />
                    Next Episode
                </button>
            )}
        </div>
    );
};

export default VideoPlayer;