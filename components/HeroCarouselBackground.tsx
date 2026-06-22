import React, { useState, useEffect, useRef } from 'react';
import { Movie } from '../types';
import { TrailerPlayer } from './TrailerPlayer';

interface HeroCarouselBackgroundProps {
    movie: Movie;
    showVideo: boolean;
    isActuallyPlaying?: boolean;
    replayCount?: number;
    showBackdropOverlay?: boolean;
    onReady?: () => void;
    onPlay?: () => void;
    onEnded?: () => void;
    onErrored?: () => void;
    onImageLoad?: () => void;
    /** Fires ~every 500ms with the current trailer playback position */
    onTimeUpdate?: (currentTime: number, duration: number) => void;
    /** Fires once when the YT player instance is ready */
    onPlayerReady?: (player: any) => void;
}

const HeroCarouselBackground: React.FC<HeroCarouselBackgroundProps> = ({
    movie,
    showVideo,
    isActuallyPlaying = false,
    replayCount = 0,
    showBackdropOverlay = false,
    onReady,
    onPlay,
    onEnded,
    onErrored,
    onImageLoad,
    onTimeUpdate,
    onPlayerReady,
}) => {
    // Only fade out the backdrop and fade in the video once it's ACTUALLY playing frames.
    // This eliminates the 1-2s black screen delay.
    const isPlayingTrailer = showVideo && isActuallyPlaying && !showBackdropOverlay;

    const imgRef = useRef<HTMLImageElement>(null);

    useEffect(() => {
        if (imgRef.current?.complete) {
            onImageLoad?.();
        }
    }, [onImageLoad]);

    return (
        <>
            {/* Background Image */}
            <div className={`absolute inset-0 transition-opacity duration-400 ease-in-out z-0 ${isPlayingTrailer ? "opacity-0" : "opacity-100"}`}>
                <img
                    ref={imgRef}
                    src={`https://image.tmdb.org/t/p/w780${movie.backdrop_path}`}
                    srcSet={`
                        https://image.tmdb.org/t/p/w780${movie.backdrop_path} 1280w,
                        https://image.tmdb.org/t/p/w1280${movie.backdrop_path} 1920w
                    `}
                    sizes="100vw"
                    fetchPriority="high"
                    loading="eager"
                    className={`w-full h-full object-cover backdrop-pop ${['series', 'comic', 'manga', 'local'].includes(movie.media_type || '') ? 'object-[50%_15%]' : 'object-[50%_15%]'}`}
                    alt="backdrop"
                    onLoad={onImageLoad}
                />
            </div>

            {/* Background Video Layer */}
            <div
                id="hero-video-layer"
                className={`absolute inset-0 z-0 transition-opacity duration-300 overflow-hidden ${isPlayingTrailer ? 'opacity-100' : 'opacity-0'}`}
            >
                {showVideo && (
                    <TrailerPlayer 
                        key={`hero-player-${replayCount}`}
                        movie={movie} 
                        variant="hero"
                        onReady={onReady}
                        onPlay={onPlay}
                        onEnded={onEnded}
                        onErrored={onErrored}
                        onTimeUpdate={onTimeUpdate}
                        onPlayerReady={onPlayerReady}
                    />
                )}
            </div>

            {/* Left vignette — diagonal gradient matching Netflix's 77deg vignette-layer */}
            <div
                className="absolute inset-y-0 left-0 z-10 pointer-events-none"
                style={{ right: '26%', background: 'linear-gradient(77deg, rgba(0,0,0,0.72) 0%, transparent 85%)' }}
            />
            {/* Bottom fade — pulls content area out of the image */}
            <div className="absolute inset-0 z-10 pointer-events-none" style={{
                background: 'linear-gradient(to top, #141414 0%, rgba(20,20,20,0.6) 14%, rgba(20,20,20,0.2) 26%, transparent 40%)'
            }} />
        </>
    );
};

export default HeroCarouselBackground;