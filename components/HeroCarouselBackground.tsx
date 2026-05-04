import React, { useEffect } from 'react';
import YouTube from 'react-youtube';
import { Movie } from '../types';
import { IMG_PATH } from '../constants';
import { useYouTubeCaptions } from '../hooks/useYouTubeCaptions';
import { useSubtitleStyle } from '../hooks/useSubtitleStyle';
import { useVideoCover } from '../hooks/useVideoCover';
import { YOUTUBE_IFRAME_DISABLED } from '../services/youtubeDisabled';
import { usePipedTrailer } from '../hooks/usePipedTrailer';
import NativeTrailerPlayer from './NativeTrailerPlayer';
import { useVideoPlayer } from '../hooks/useVideoPlayer';

interface HeroCarouselBackgroundProps {
    movie: Movie;
    showVideo: boolean;
    trailerQueue: string[];
    setTrailerQueue: React.Dispatch<React.SetStateAction<string[]>>;
    setShowVideo: (show: boolean) => void;
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
    player: any;
}

const HeroCarouselBackground: React.FC<HeroCarouselBackgroundProps> = ({
    movie,
    showVideo,
    trailerQueue,
    setTrailerQueue,
    setShowVideo,
    playerRef,
    isHovered,
    onSyncCheck,
    onVideoEnd,
    youtubeQuality = 'highres',
    replayCount = 0,
    onUpdateState,
    showBackdropOverlay = false,
    player
}) => {
    const containerRef = React.useRef<HTMLDivElement>(null);
    const coverDimensions = useVideoCover(containerRef, 1.30);

    const currentVideoId = trailerQueue[0] || null;
    const isCaptionsPlaying = showVideo && player.isReady;
    const { overlayStyle, lang, enabled: subtitlesEnabled } = useSubtitleStyle();
    const { activeCue, onApiChange } = useYouTubeCaptions(player.playerRef, currentVideoId, isCaptionsPlaying, lang);

    const movieTitle = movie.title || movie.name || movie.original_title || movie.original_name || '';
    const movieYear  = (movie.release_date || (movie as any).first_air_date || '').slice(0, 4);
    const mediaType  = (movie.media_type === 'tv' ? 'tv' : 'movie') as 'movie' | 'tv';
    const piped      = usePipedTrailer(movie.id, movieTitle, movieYear, mediaType, YOUTUBE_IFRAME_DISABLED && showVideo);

    useEffect(() => {
        if (YOUTUBE_IFRAME_DISABLED && piped.streamUrl && !piped.loading) {
            player.setIsVideoReady?.(true) || player.setIsReady(true);
        }
    }, [piped.streamUrl, piped.loading]);

    return (
        <>
            {/* Background Image */}
            <div className={`absolute inset-0 transition-opacity duration-700 ease-in-out z-0 ${showVideo && player.isReady ? "opacity-0" : "opacity-100"}`}>
                <img
                    src={`${IMG_PATH}${movie.backdrop_path}`}
                    className={`w-full h-full object-cover backdrop-pop ${['series', 'comic', 'manga', 'local'].includes(movie.media_type || '') ? 'object-[50%_15%]' : 'object-[50%_15%]'}`}
                    alt="backdrop"
                />
            </div>

            {/* Background Video Layer */}
            <div
                id="hero-video-layer"
                ref={containerRef}
                className={`absolute inset-0 z-0 transition-opacity duration-1000 overflow-hidden ${(showVideo && player.isReady && !showBackdropOverlay) ? 'opacity-100' : 'opacity-0'}`}
            >
                {/* Piped CDN native stream */}
                {YOUTUBE_IFRAME_DISABLED && showVideo && piped.streamUrl && (
                    <div
                        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-0"
                        style={{ width: coverDimensions.width || '100%', height: coverDimensions.height || '100%' }}
                    >
                        <NativeTrailerPlayer
                            streamUrl={piped.streamUrl}
                            isDASH={piped.isDASH}
                            isHLS={piped.isHLS}
                            subtitleUrl={piped.subtitleUrl}
                            isMuted={player.isMuted}
                            autoPlay
                            className="w-full h-full"
                            onReady={() => player.setIsReady(true)}
                            onEnd={() => { player.setIsReady(false); setShowVideo(false); onVideoEnd?.(); }}
                            onError={() => { player.setIsReady(false); setShowVideo(false); }}
                        />
                    </div>
                )}

                {/* YouTube iframe — primary path */}
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
                                player.onReady(e);
                                // Restoration: Sync position if we have a saved state
                                const syncTime = onSyncCheck?.(trailerQueue[0]);
                                if (syncTime && syncTime > 0) {
                                  try { e.target.seekTo(syncTime, true); } catch (_) {}
                                }
                            }}
                            onStateChange={(e) => {
                                player.onStateChange(e);
                                // Extra visibility gate for hero
                                if (e.data === 1 && !player.isReady) {
                                    player.setIsReady(true);
                                }
                            }}
                            onError={player.onError}
                            onEnd={player.onEnd}
                            opts={{
                                width: '100%',
                                height: '100%',
                                playerVars: {
                                    autoplay: 1,
                                    mute: 1,
                                    controls: 0,
                                    showinfo: 0,
                                    rel: 0,
                                    modestbranding: 1,
                                    iv_load_policy: 3,
                                    playsinline: 1,
                                    enablejsapi: 1,
                                    origin: typeof window !== 'undefined' ? window.location.origin : '',
                                    color: 'white',
                                    disablekb: 1,
                                    playlist: trailerQueue[0],
                                },
                            }}
                        />
                        <div className="absolute inset-0 z-[1] pointer-events-none" />
                    </div>
                )}
                {subtitlesEnabled && activeCue && (
                    <div style={overlayStyle}>
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