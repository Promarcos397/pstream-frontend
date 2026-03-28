import React, { useRef, useEffect } from 'react';
import YouTube from 'react-youtube';
import { Movie } from '../types';
import { IMG_PATH } from '../constants';

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
    youtubeQuality?: 'hd720' | 'hd1080' | 'default';
    replayCount?: number;
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
    youtubeQuality = 'hd1080',
    replayCount = 0
}) => {
    // 1. Sync Mute State
    useEffect(() => {
        if (playerRef.current && typeof playerRef.current.mute === 'function') {
            try {
                if (isMuted) playerRef.current.mute();
                else playerRef.current.unMute();
            } catch (e) {}
        }
    }, [isMuted]);

    return (
        <>
            {/* Background Image */}
            <div className={`absolute inset-0 transition-opacity duration-700 ease-in-out z-0 ${showVideo && isVideoReady ? "opacity-0" : "opacity-100"}`}>
                <img
                    src={`${IMG_PATH}${movie.backdrop_path}`}
                    className={`w-full h-full object-cover ${['series', 'comic', 'manga', 'local'].includes(movie.media_type || '') ? 'object-[50%_30%]' : 'object-center'}`}
                    alt="backdrop"
                />
            </div>

            {/* Background Video Layer - YouTube Trailer (Matching InfoModal Logic) */}
            <div
                id="hero-video-layer"
                className={`absolute inset-0 z-0 transition-opacity duration-1000 ${showVideo && isVideoReady ? 'opacity-100' : 'opacity-0'}`}
            >
                {showVideo && trailerQueue.length > 0 && (
                    <div
                        className="absolute top-0 left-1/2 -translate-x-1/2 pointer-events-none z-0 overflow-hidden"
                        style={{ width: videoDimensions.width, height: videoDimensions.height }}
                    >
                        <YouTube
                            key={`${trailerQueue[0]}-${replayCount}`}
                            videoId={trailerQueue[0]}
                            className="w-full h-full"
                            onReady={(e) => {
                                playerRef.current = e.target;
                                
                                // Apply settings
                                if (isMuted) e.target.mute();
                                else e.target.unMute();

                                // Cinematic: Force Highest Quality
                                if (typeof e.target.setPlaybackQuality === 'function') {
                                    e.target.setPlaybackQuality('hd1080');
                                }
                                
                                // Sync check: Resume from last known position (Bidirectional Sync)
                                const syncTime = onSyncCheck?.(trailerQueue[0]);
                                if (syncTime && syncTime > 0) {
                                  e.target.seekTo(syncTime, true);
                                }

                                setIsVideoReady(true);
                            }}
                            onEnd={(e) => {
                                // Netflix logic: Loop trailer or trigger onVideoEnd
                                if (onVideoEnd) onVideoEnd();
                                else {
                                  e.target.seekTo(0);
                                  e.target.playVideo();
                                }
                            }}
                            onError={(e) => {
                                console.warn("[HeroCarousel] Video error, trying next...", e);
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
                                    modestbranding: 1,
                                    rel: 0,
                                    controls: 0,
                                    iv_load_policy: 3, // Disable annotations
                                    cc_load_policy: 0,
                                    disablekb: 1,
                                    fs: 0,
                                    loop: 1,
                                    playlist: trailerQueue[0],
                                }
                            }}
                        />
                    </div>
                )}
            </div>

            {/* Netflix-style gradients */}
            <div className="absolute inset-0 bg-gradient-to-r from-black/30 via-transparent to-transparent z-10 pointer-events-none" />
            <div className="absolute inset-0 z-10 pointer-events-none" style={{
                background: 'linear-gradient(to top, #141414 0%, #14141499 15%, #14141433 30%, transparent 50%)'
            }} />
        </>
    );
};

export default HeroCarouselBackground;
