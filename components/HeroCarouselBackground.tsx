import React from 'react';
import { Movie } from '../types';
import { IMG_PATH } from '../constants';
import { TrailerPlayer } from './TrailerPlayer';

interface HeroCarouselBackgroundProps {
    movie: Movie;
    showVideo: boolean;
    replayCount?: number;
    showBackdropOverlay?: boolean;
    onReady?: () => void;
    onEnded?: () => void;
    onErrored?: () => void;
}

const HeroCarouselBackground: React.FC<HeroCarouselBackgroundProps> = ({
    movie,
    showVideo,
    replayCount = 0,
    showBackdropOverlay = false,
    onReady,
    onEnded,
    onErrored
}) => {
    const isPlayingTrailer = showVideo && !showBackdropOverlay;

    return (
        <>
            {/* Background Image */}
            <div className={`absolute inset-0 transition-opacity duration-700 ease-in-out z-0 ${isPlayingTrailer ? "opacity-0" : "opacity-100"}`}>
                <img
                    src={`${IMG_PATH}${movie.backdrop_path}`}
                    className={`w-full h-full object-cover backdrop-pop ${['series', 'comic', 'manga', 'local'].includes(movie.media_type || '') ? 'object-[50%_15%]' : 'object-[50%_15%]'}`}
                    alt="backdrop"
                />
            </div>

            {/* Background Video Layer */}
            <div
                id="hero-video-layer"
                className={`absolute inset-0 z-0 transition-opacity duration-1000 overflow-hidden ${isPlayingTrailer ? 'opacity-100' : 'opacity-0'}`}
            >
                {showVideo && (
                    <TrailerPlayer 
                        key={`hero-player-${replayCount}`}
                        movie={movie} 
                        variant="hero"
                        onReady={onReady}
                        onEnded={onEnded}
                        onErrored={onErrored}
                    />
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