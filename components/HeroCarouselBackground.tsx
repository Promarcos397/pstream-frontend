import React, { useRef, useEffect } from 'react';
import YouTube from 'react-youtube';
import { Movie } from '../types';
import { IMG_PATH } from '../constants';
import { useYouTubeCaptions } from '../hooks/useYouTubeCaptions';
import { useSubtitleStyle } from '../hooks/useSubtitleStyle';
import { useVideoCover } from '../hooks/useVideoCover';
import { YOUTUBE_IFRAME_DISABLED } from '../services/youtubeDisabled';
import { useNewPipeTrailer } from '../hooks/useNewPipeTrailer';
import NativeTrailerPlayer from './NativeTrailerPlayer';

interface HeroCarouselBackgroundProps {
    movie: Movie;
    showVideo: boolean;
    trailerQueue: string[];
    isVideoReady: boolean;
    setIsVideoReady: (ready: boolean) => void;
    setTrailerQueue: React.Dispatch<React.SetStateAction<string[]>>;
    setShowVideo: (show: boolean) => void;
    isMuted: boolean;
    videoDimensions: { width: string | number, height: string | number };
    playerRef: any;
    isHovered: boolean;
    onSyncCheck?: (videoId: string) => number | undefined;
    onVideoEnd?: () => void;
    youtubeQuality?:
  | 'hd720'
  | 'hd1080'
  | 'hd1440'
  | 'hd2160'
  | 'highres'
  | 'default';
    replayCount?: number;
    onUpdateState?: (id: number, time: number, videoId: string) => void;
    showBackdropOverlay?: boolean;
}

const HeroCarouselBackground: React.FC<HeroCarouselBackgroundProps> = ({
    movie,
    showVideo,
    trailerQueue,
    isVideoReady,
    setIsVideoReady,
    setTrailerQueue,
    setShowVideo,
    isMuted,
    videoDimensions,
    playerRef,
    isHovered,
    onSyncCheck,
    onVideoEnd,
    youtubeQuality = 'highres',
    replayCount = 0,
    onUpdateState,
    showBackdropOverlay = false
}) => {
    const syncIntervalRef = React.useRef<NodeJS.Timeout | null>(null);
    const containerRef = React.useRef<HTMLDivElement>(null);
    const coverDimensions = useVideoCover(containerRef, 1.30);
    const currentVideoId = trailerQueue[0] || null;
    const isCaptionsPlaying = showVideo && isVideoReady;
    const { overlayStyle, lang, enabled: subtitlesEnabled } = useSubtitleStyle();
    const { activeCue, onApiChange } = useYouTubeCaptions(playerRef, currentVideoId, isCaptionsPlaying, lang);

    // NewPipe trailer resolution (used when iframes are fully disabled)
    const movieTitle = movie.original_title || movie.original_name || movie.title || movie.name || '';
    const movieYear  = (movie.release_date || (movie as any).first_air_date || '').slice(0, 4) || undefined;
    const mediaType  = (movie.media_type === 'tv' ? 'tv' : 'movie') as 'movie' | 'tv';
    const newpipe    = useNewPipeTrailer(movieTitle, movieYear, mediaType, YOUTUBE_IFRAME_DISABLED && showVideo);

    // When NewPipe resolves (iframe-disabled mode), mark video as ready
    useEffect(() => {
        if (YOUTUBE_IFRAME_DISABLED && newpipe.streamUrl && !newpipe.loading) {
            setIsVideoReady(true);
        }
    }, [newpipe.streamUrl, newpipe.loading]);

    // Clean up sync interval on unmount
    React.useEffect(() => {
        return () => {
            if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
        };
    }, []);

    // 1. Sync Mute State — only fire once the player is confirmed ready
    useEffect(() => {
        const player = playerRef.current;
        // Guard: player must be initialised and attached to DOM
        if (!player || typeof player.getPlayerState !== 'function') return;
        try {
            if (isMuted) player.mute();
            else player.unMute();
        } catch (e) {}
    }, [isMuted, playerRef.current]);

    return (
        <>
            {/* Background Image */}
            <div className={`absolute inset-0 transition-opacity duration-700 ease-in-out z-0 ${showVideo && isVideoReady ? "opacity-0" : "opacity-100"}`}>
                <img
                    src={`${IMG_PATH}${movie.backdrop_path}`}
                    className={`w-full h-full object-cover backdrop-pop ${['series', 'comic', 'manga', 'local'].includes(movie.media_type || '') ? 'object-[50%_15%]' : 'object-[50%_15%]'}`}
                    alt="backdrop"
                />
            </div>

            {/* Background Video Layer - YouTube Trailer (Matching InfoModal Logic) */}
            <div
                id="hero-video-layer"
                ref={containerRef}
                className={`absolute inset-0 z-0 transition-opacity duration-1000 overflow-hidden ${(showVideo && isVideoReady && !showBackdropOverlay) ? 'opacity-100' : 'opacity-0'}`}
            >
                {/* NewPipe native stream (when iframes fully disabled — experimental) */}
                {YOUTUBE_IFRAME_DISABLED && showVideo && newpipe.streamUrl && (
                    <div
                        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-0"
                        style={{ width: coverDimensions.width || '100%', height: coverDimensions.height || '100%' }}
                    >
                        <NativeTrailerPlayer
                            streamUrl={newpipe.streamUrl}
                            subtitleUrl={newpipe.subtitleUrl}
                            isMuted={isMuted}
                            autoPlay
                            className="w-full h-full"
                            onReady={() => setIsVideoReady(true)}
                            onEnd={() => { setIsVideoReady(false); setShowVideo(false); onVideoEnd?.(); }}
                            onError={() => { setIsVideoReady(false); setShowVideo(false); }}
                        />
                    </div>
                )}

                {/* YouTube iframe — primary working trailer path */}
                {/* Renders when: iframes enabled (default) AND we have a trailer ID */}
                {!YOUTUBE_IFRAME_DISABLED && showVideo && trailerQueue.length > 0 && (
                    <div
                        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-0"
                        style={{ width: coverDimensions.width || '100%', height: coverDimensions.height || '100%' }}
                    >
                        <YouTube
                            key={`${trailerQueue[0]}-${replayCount}`}
                            videoId={trailerQueue[0]}
                            className="w-full h-full"
                            onReady={(e) => {
                                playerRef.current = e.target;
                                
                                // Wire onApiChange via IFrame Player API
                                // react-youtube doesn't type this prop, so we use addEventListener
                                try { e.target.addEventListener('onApiChange', onApiChange); } catch {}

                                // FORCE MUTE FIRST: This is critical for browser autoplay bypass
                                try {
                                    e.target.mute(); 
                                } catch (err) {}

                                // Sync check: Resume from last known position (Bidirectional Sync)
                                const syncTime = onSyncCheck?.(trailerQueue[0]);
                                if (syncTime && syncTime > 0) {
                                  e.target.seekTo(syncTime, true);
                                }

                                // FORCE START with Retry logic
                                // Note: setPlaybackQuality is a deprecated no-op per YouTube IFrame API docs.
                                // Quality is determined by YouTube's adaptive logic based on viewport/network.
                                const playWithRetry = () => {
                                    try {
                                        if (e.target.playVideo) e.target.playVideo();
                                    } catch (err) {
                                        setTimeout(playWithRetry, 500);
                                    }
                                };
                                playWithRetry();
                                // Note: setIsVideoReady is deferred to onStateChange YT_PLAYING=1
                                // so backdrop stays until the player actually starts rendering frames
                            }}
                            onStateChange={(e) => {
                                const YT_PLAYING = 1;
                                const YT_PAUSED = 2;

                                // Watchdog: Trigger play if player is stuck in "Cued" or "Unstarted"
                                if (e.data === 5 || e.data === -1) {
                                    try { e.target.playVideo(); } catch(err) {}
                                }

                                // Mark video ready ONLY when player actually starts rendering
                                if (e.data === YT_PLAYING && !isVideoReady) {
                                    setIsVideoReady(true);
                                }

                                if (e.data === YT_PLAYING) {
                                    // 1-second sync interval: save time to GlobalContext
                                    if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
                                    syncIntervalRef.current = setInterval(() => {
                                        try {
                                            const time = e.target.getCurrentTime();
                                            const videoId = trailerQueue[0];
                                            if (time > 0 && videoId) {
                                                (window as any).__last_hero_time = time;
                                                if (onUpdateState && movie.id) {
                                                    onUpdateState(Number(movie.id), time, videoId);
                                                }
                                            }
                                        } catch (err) {}
                                    }, 1000);

                                    // Early stop: 5s before end so YouTube overlay never shows
                                    const checkEnd = () => {
                                        if (!playerRef.current) return;
                                        try {
                                            const remaining = playerRef.current.getDuration() - playerRef.current.getCurrentTime();
                                            if (remaining <= 5) {
                                                if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
                                                playerRef.current.pauseVideo();
                                                setIsVideoReady(false);
                                                setShowVideo(false);
                                                if (onVideoEnd) onVideoEnd();
                                                return;
                                            }
                                        } catch (_) {}
                                        setTimeout(checkEnd, 1000);
                                    };
                                    checkEnd();
                                }

                                if (e.data === YT_PAUSED) {
                                    if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
                                    // Also save final time on pause
                                    try {
                                        const time = e.target.getCurrentTime();
                                        const videoId = trailerQueue[0];
                                        if (time > 0 && videoId && onUpdateState && movie.id) {
                                            onUpdateState(Number(movie.id), time, videoId);
                                        }
                                    } catch (_) {}
                                }
                            }}
                            onEnd={() => {
                                // Philosophy: No auto-looping. Give user back their room or a choice to Replay.
                                if (onVideoEnd) onVideoEnd();
                            }}
                            onError={() => {
                                console.warn("[HeroCarousel] Trailer error. Rolling back to static.");
                                setTrailerQueue(prev => {
                                    const next = prev.slice(1);
                                    if (next.length === 0) setShowVideo(false);
                                    return next;
                            
                                });
                            }}
                            opts={{
                                width: '100%',
                                height: '100%',
                                playerVars: {
                                    autoplay: 1,
                                    mute: 1, // <--- Hardcode to 1. Your useEffect will handle the live toggling!
                                    modestbranding: 1,
                                    rel: 0,
                                    controls: 0,
                                    iv_load_policy: 3, 
                                    cc_load_policy: 0,
                                    disablekb: 1,
                                    fs: 0,
                                    loop: 0,
                                    origin: window.location.origin,
                                    widget_referrer: window.location.origin,
                                    start: 5,
                                    playsinline: 1,
                                }
                            }}
                        />
                        {/* Transparent shield — sits in the parent stacking context directly
                            in front of the iframe, visually covering YouTube's native pause
                            overlay/play button which we cannot suppress from inside the iframe. */}
                        <div className="absolute inset-0 z-[1] pointer-events-none" />
                    </div>
                )}
                {subtitlesEnabled && activeCue && (
                    <div
                        style={overlayStyle}
                    >
                        {activeCue}
                    </div>
                )}
            </div>

            {/* Netflix-style gradients */}
            <div className="absolute inset-0 bg-gradient-to-r from-black/30 via-transparent to-transparent z-10 pointer-events-none" />
            <div className="absolute inset-0 z-10 pointer-events-none" style={{
                background: 'linear-gradient(to top, #141414 0%, #14141480 14%, #14141433 26%, transparent 40%)'
            }} />
        </>
    );
};

export default HeroCarouselBackground;