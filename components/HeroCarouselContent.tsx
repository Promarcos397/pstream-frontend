import React, { useState, useEffect, useRef } from 'react';
import { InfoIcon } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { Movie } from '../types';
import CinemaPlayButton from './CinemaPlayButton';

interface HeroCarouselContentProps {
    movie: Movie;
    logoUrl: string | null;
    isVideoReady: boolean;
    onPlay: (movie: Movie) => void;
    onSelect: (movie: Movie, time?: number, videoId?: string) => void;
    trailerVideoId?: string;
    hasVideoEnded?: boolean;
    onImageLoad?: () => void;
}

const HeroCarouselContent: React.FC<HeroCarouselContentProps> = ({
    movie,
    logoUrl,
    isVideoReady,
    onPlay,
    onSelect,
    trailerVideoId,
    hasVideoEnded = false,
    onImageLoad
}) => {
    const { t } = useTranslation();
    const [showDescription, setShowDescription] = useState(true);
    const [imgFailed, setImgFailed] = useState(false);
    const logoImgRef = useRef<HTMLImageElement>(null);

    useEffect(() => {
        if (logoImgRef.current?.complete) {
            onImageLoad?.();
        }
    }, [logoUrl, onImageLoad]);

    // Reset image failure if logo URL changes (navigating between heroes)
    useEffect(() => setImgFailed(false), [logoUrl]);

    // 1. Netflix-style description fade delay (7 seconds)
    useEffect(() => {
        if (isVideoReady && !hasVideoEnded) {
            const timer = setTimeout(() => {
                setShowDescription(false);
            }, 7000); // 7s delay
            return () => clearTimeout(timer);
        } else {
            setShowDescription(true);
        }
    }, [isVideoReady, hasVideoEnded]);

    return (
        <div className={`absolute top-0 left-0 w-full h-full flex flex-col justify-end z-20 
          pl-[calc(1.5rem+env(safe-area-inset-left))] md:pl-14 lg:pl-16 pr-4 md:pr-12 pointer-events-none 
          /* THEME_TOGGLE: HERO_CTA_POSITION - Adjust pb to move Play/Info buttons up or down */
          pb-[18%] sm:pb-[14%] md:pb-[10%]`}
        >
            <div className="max-w-[95%] sm:max-w-lg md:max-w-xl lg:max-w-2xl space-y-4 md:space-y-4 pointer-events-auto">

                {/* Logo/Title - Anchored lower, scales down after delay */}
                {/* Logo/Title */}
                <div className={`relative flex items-end mb-3 md:mb-5 origin-bottom-left transition-all duration-700 ${!showDescription && isVideoReady && !hasVideoEnded ? 'scale-[0.6] sm:scale-[0.65] origin-bottom-left translate-y-8 md:translate-y-6' : ''}`}>
                    {logoUrl && !imgFailed ? (
                        <div className="relative inline-flex items-end">
                            {/* Dual-layer premium shadow for perfect legibility on any background */}
                            <img
                                src={logoUrl}
                                aria-hidden
                                className="absolute object-contain object-bottom"
                                style={{
                                    filter: 'blur(25px) brightness(0) opacity(0.5)',
                                    transform: 'translate(4px, 12px) scale(1.08)',
                                    pointerEvents: 'none',
                                    zIndex: 0,
                                    width: '100%', height: '100%', inset: 0
                                }}
                            />
                            <img
                                src={logoUrl}
                                aria-hidden
                                className="absolute object-contain object-bottom"
                                style={{
                                    filter: 'blur(4px) brightness(0) opacity(0.35)',
                                    transform: 'translate(2px, 4px) scale(1.02)',
                                    pointerEvents: 'none',
                                    zIndex: 0,
                                    width: '100%', height: '100%', inset: 0
                                }}
                            />
                            <img
                                ref={logoImgRef}
                                src={logoUrl}
                                alt={movie?.name || movie?.title || 'title logo'}
                                className="relative object-contain object-bottom"
                                style={{ 
                                    zIndex: 1,
                                    maxHeight: 'clamp(85px, 20vw, 210px)', 
                                    maxWidth: 'clamp(260px, 60vw, 620px)' 
                                }}
                                onLoad={onImageLoad}
                                onError={() => setImgFailed(true)}
                            />
                        </div>
                    ) : (
                        <h1 className="text-3xl sm:text-5xl md:text-6xl font-black font-leaner drop-shadow-xl leading-none text-white tracking-wide uppercase">
                            {movie?.name || movie?.title || ''}
                        </h1>
                    )}
                </div>

                {/* Description - Hides after 7 seconds of video play */}
                <div className={`transition-all duration-700 overflow-hidden ${!showDescription && isVideoReady && !hasVideoEnded ? 'opacity-0 max-h-0' : 'opacity-100 max-h-40 mb-4 md:mb-6'}`}>
                    <p
                        className={`text-[12px] sm:text-[13px] md:text-[15px] font-medium text-white/90 line-clamp-2 md:line-clamp-3 leading-relaxed max-w-[90%] sm:max-w-lg transition-all duration-700 ${['ar', 'he'].includes(t('lang', { defaultValue: 'en' }).split('-')[0]) ? 'text-right' : ''}`}
                    >
                        {movie?.overview}
                    </p>
                </div>

                {/* Netflix-style CTA Buttons */}
                <div className={`flex items-center flex-wrap gap-2 md:gap-3 transition-transform duration-700 ${!showDescription && isVideoReady && !hasVideoEnded ? 'translate-y-4 md:translate-y-2' : ''}`}>
                    <CinemaPlayButton movie={movie} variant="rectangular" />

                    <button
                        onClick={(e) => {
                            const rawRect = e.currentTarget.getBoundingClientRect();
                            if (rawRect) (window as any).__last_card_rect = rawRect;
                            onSelect(movie, undefined, trailerVideoId);
                        }}
                        className="flex items-center justify-center bg-[#6d6d6e]/50 text-white px-4 sm:px-6 h-[34px] md:h-[45px] rounded-[4px] font-bold hover:bg-[#6d6d6e]/35 transition-all duration-300 text-[15px] md:text-[18px] gap-2 md:gap-2 pointer-events-auto active:scale-95"
                    >
                        <InfoIcon weight="bold" className="text-xl md:text-[26px]" />
                        <span className="whitespace-nowrap">{t('hero.moreInfo')}</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default HeroCarouselContent;
