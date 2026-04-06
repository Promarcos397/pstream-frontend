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

const VideoPlayer: React.FC<VideoPlayerProps> = ({ movie, season = 1, episode = 1, onClose }) => {
    const { settings, updateEpisodeProgress, getEpisodeProgress, updateVideoState, addToHistory, getVideoState, setActiveVideoId } = useGlobalContext();
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
    const [retryCount, setRetryCount] = useState(0);
    const [error, setError] = useState<string | null>(null);

    // TV Show state
    const mediaType = movie.media_type || (movie.first_air_date ? 'tv' : 'movie');
    const [currentEpisode, setCurrentEpisode] = useState(episode);
    const [playingSeasonNumber, setPlayingSeasonNumber] = useState(season);
    const [seasonList, setSeasonList] = useState<number[]>([]);
    const [currentSeasonEpisodes, setCurrentSeasonEpisodes] = useState<Episode[]>([]);
    const [exploredSeasonEpisodes, setExploredSeasonEpisodes] = useState<Episode[]>([]);
    const [exploredSeasonNumber, setExploredSeasonNumber] = useState(season);

    // Navigation state
    const [activePanel, setActivePanel] = useState<'none' | 'episodes' | 'seasons' | 'audioSubtitles' | 'quality' | 'servers'>('none');
    const [isPanelHovered, setIsPanelHovered] = useState(false);

    // Subtitles
    const [captions, setCaptions] = useState<{ id: string; label: string; url: string; lang: string }[]>([]);
    const [currentCaption, setCurrentCaption] = useState<string | null>(null);
    const [subtitleObjectUrl, setSubtitleObjectUrl] = useState<string | null>(null);
    const [currentCueText, setCurrentCueText] = useState<string>('');

    // HLS state
    const [qualityLevels, setQualityLevels] = useState<{ height: number; bitrate: number; level: number }[]>([]);
    const [currentQualityLevel, setCurrentQualityLevel] = useState<number>(-1);
    const [audioTracks, setAudioTracks] = useState<{ id: number; name: string; lang: string }[]>([]);
    const [currentAudioTrack, setCurrentAudioTrack] = useState<number>(-1);

    // Skips
    const [showSkipIntro, setShowSkipIntro] = useState(false);
    const [showSkipOutro, setShowSkipOutro] = useState(false);

    // Derived data
    const title = movie.title || movie.name || '';
    const formattedDate = movie.release_date || movie.first_air_date || '';

    // Apply stream result logic
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
                } catch (e) { }
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

    // Handle Manual Source Change
    const handleSourceChange = useCallback((index: number) => {
        if (!allSources[index]) return;
        
        console.log(`[VideoPlayer] 🔄 Manual server change to: ${allSources[index].provider}`);
        setCurrentSourceIndex(index);
        setError(null);
        setIsBuffering(true);
        setLoadingMessage(`Switching to ${allSources[index].provider || 'Server'}...`);
        
        // Construct a temporary list with the selected source at index 0 for applyStreamResult
        const selectedSource = allSources[index];
        applyStreamResult([selectedSource], captions);
    }, [allSources, applyStreamResult, captions]);

    // Track state changes
    useEffect(() => {
        if (season !== playingSeasonNumber) setPlayingSeasonNumber(season);
        if (episode !== currentEpisode) setCurrentEpisode(episode);
    }, [season, episode]);

    // Fetch Stream Effect
    useEffect(() => {
        const fetchStream = async () => {
            setIsBuffering(true);
            setError(null);
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
                    ? SubtitleService.getSubtitleTracks(String(movie.id), mediaType === 'tv' ? 'tv' : 'movie', playingSeasonNumber, currentEpisode).catch(() => [])
                    : Promise.resolve([]);

                let imdbId = movie.imdb_id;
                if (!imdbId) {
                    try {
                        const ext = await getExternalIds(movie.id, mediaType === 'tv' ? 'tv' : 'movie');
                        if (ext?.imdb_id) imdbId = ext.imdb_id;
                    } catch (e) { }
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

    // HLS Hook Integration
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
            const video = videoRef.current;
            if (video) {
                const saved = mediaType === 'tv' ? getEpisodeProgress(movie.id, playingSeasonNumber, currentEpisode) : getVideoState(movie.id);
                if (saved?.time > 10 && saved.time < (video.duration - 30)) {
                    video.currentTime = saved.time;
                }
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
    }, [hlsLevels, hlsQuality, hlsAudios, hlsAudio, hlsBuffering, isEmbed]);

    // Time Update & History
    const handleTimeUpdate = useCallback(() => {
        const video = videoRef.current;
        if (!video || isNaN(video.duration) || video.duration === 0) return;

        const time = video.currentTime;
        const dur = video.duration;
        setCurrentTime(time);
        setDuration(dur);
        setProgress((time / dur) * 100);

        setShowSkipIntro(time > 20 && time < 120);
        setShowSkipOutro(time > (dur - 130));

        if (time > 0 && Math.abs(time - (window as any).lastSavedTime || 0) > 5) {
            (window as any).lastSavedTime = time;
            addToHistory(movie);
            if (mediaType === 'tv') {
                updateEpisodeProgress(movie.id, playingSeasonNumber, currentEpisode, time, dur);
            } else {
                updateVideoState(movie.id, time, undefined, dur);
            }
        }
    }, [mediaType, movie.id, playingSeasonNumber, currentEpisode, addToHistory, updateEpisodeProgress, updateVideoState]);

    const handleEpisodeSelect = useCallback((ep: Episode, seasonNum?: number, episodes?: Episode[]) => {
        setStreamUrl(null);
        setIsBuffering(true);
        setPlayingSeasonNumber(seasonNum || ep.season_number || playingSeasonNumber);
        if (episodes) setCurrentSeasonEpisodes(episodes);
        setCurrentEpisode(ep.episode_number);
        setActivePanel('none');
    }, [playingSeasonNumber]);

    // Native Subtitle Loading
    useEffect(() => {
        if (!currentCaption) {
            setSubtitleObjectUrl(null);
            return;
        }

        let isMounted = true;
        const loadSubtitles = async () => {
            try {
                const electron = (window as any).electron;
                let text = '';
                if (electron?.fetchSubtitle) {
                    const res = await electron.fetchSubtitle(currentCaption);
                    if (res.success) text = res.text;
                } else {
                    const res = await fetch(currentCaption);
                    text = await res.text();
                }
                if (text && isMounted) {
                    const url = convertSubtitlesToObjectUrl(text);
                    if (url) setSubtitleObjectUrl(url);
                }
            } catch (e) {
                console.error('[VideoPlayer] Subtitle load failed', e);
            }
        };
        loadSubtitles();
        return () => { isMounted = false; };
    }, [currentCaption]);

    // TV Details initialization
    useEffect(() => {
        const init = async () => {
            if (mediaType === 'tv') {
                try {
                    const details = await getMovieDetails(String(movie.id), 'tv');
                    if (details.seasons) {
                        setSeasonList(details.seasons.filter((s: any) => s.season_number > 0).map((s: any) => s.season_number));
                    }
                    const seasonData = await getSeasonDetails(String(movie.id), playingSeasonNumber);
                    if (seasonData?.episodes) setCurrentSeasonEpisodes(seasonData.episodes);
                } catch (e) { }
            }
        };
        init();
    }, [movie.id, mediaType, playingSeasonNumber]);

    return (
        <div ref={containerRef} className="fixed inset-0 bg-black z-[100] flex flex-col font-sans select-none overflow-hidden" onMouseMove={() => setShowUI(true)}>
            <video 
                ref={videoRef} 
                className="w-full h-full object-contain" 
                onTimeUpdate={handleTimeUpdate} 
                onPlay={() => setIsPlaying(true)} 
                onPause={() => setIsPlaying(false)}
                playsInline
            >
                {subtitleObjectUrl && (
                    <track kind="subtitles" src={subtitleObjectUrl} default label="Subtitles" />
                )}
            </video>

            {isBuffering && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 z-10">
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
                buffered={0}
                isBuffering={isBuffering}
                title={mediaType === 'tv' ? `${title} - S${playingSeasonNumber} E${currentEpisode}` : title}
                onPlayPause={() => videoRef.current?.paused ? videoRef.current.play() : videoRef.current?.pause()}
                onSeek={(amt) => videoRef.current && (videoRef.current.currentTime += amt)}
                volume={volume}
                onVolumeChange={(v) => videoRef.current && (videoRef.current.volume = v)}
                onToggleMute={() => videoRef.current && (videoRef.current.muted = !videoRef.current.muted)}
                onTimelineSeek={(p) => videoRef.current && (videoRef.current.currentTime = (p / 100) * videoRef.current.duration)}
                onToggleFullscreen={() => document.fullscreenElement ? document.exitFullscreen() : containerRef.current?.requestFullscreen()}
                onClose={onClose || (() => window.history.back())}
                activePanel={activePanel}
                setActivePanel={setActivePanel}
                allSources={allSources}
                currentSourceIndex={currentSourceIndex}
                onSourceChange={handleSourceChange}
                onServersClick={() => setActivePanel(activePanel === 'servers' ? 'none' : 'servers')}
                onSettingsClick={() => setActivePanel(activePanel === 'quality' ? 'none' : 'quality')}
                onEpisodesClick={() => setActivePanel(activePanel === 'episodes' ? 'none' : 'episodes')}
                onSubtitlesClick={() => setActivePanel(activePanel === 'audioSubtitles' ? 'none' : 'audioSubtitles')}
                qualities={qualityLevels}
                currentQuality={currentQualityLevel}
                onQualityChange={changeQuality}
                showNextEp={showSkipOutro}
            />

            <VideoPlayerSettings
                activePanel={activePanel}
                setActivePanel={setActivePanel}
                seasonList={seasonList}
                currentSeasonEpisodes={currentSeasonEpisodes}
                selectedSeason={playingSeasonNumber}
                currentEpisode={currentEpisode}
                playingSeason={playingSeasonNumber}
                showId={movie.id}
                onSeasonSelect={(s) => setPlayingSeasonNumber(s)}
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

            {showSkipIntro && (
                <button onClick={() => videoRef.current && (videoRef.current.currentTime = 90)} className="absolute bottom-32 left-8 px-6 py-3 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 text-white font-bold rounded flex items-center gap-2 transition-all active:scale-95 z-30">
                    Skip Intro
                </button>
            )}
        </div>
    );
};

export default VideoPlayer;