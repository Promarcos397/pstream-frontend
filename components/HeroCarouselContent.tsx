import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { InfoIcon, TicketIcon, PlayCircle } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { Movie } from '../types';
import { useIsInTheaters } from '../hooks/useIsInTheaters';

interface HeroCarouselContentProps {
    movie: Movie;
    logoUrl: string | null;
    isVideoReady: boolean;
    onPlay: (movie: Movie) => void;
    onSelect: (movie: Movie, time?: number, videoId?: string) => void;
    trailerVideoId?: string;
    hasVideoEnded?: boolean;
}

const HeroCarouselContent: React.FC<HeroCarouselContentProps> = ({
    movie,
    logoUrl,
    isVideoReady,
    onPlay,
    onSelect,
    trailerVideoId,
    hasVideoEnded = false
}) => {
    const { t } = useTranslation();
    const [showDescription, setShowDescription] = useState(true);
    const [imgFailed, setImgFailed] = useState(false);
    const isCinemaOnly = useIsInTheaters(movie);

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
                <div className={`h-12 sm:h-20 md:h-28 flex items-end mb-3 md:mb-5 origin-bottom-left transition-all duration-700 ${!showDescription && isVideoReady && !hasVideoEnded ? 'scale-[0.6] sm:scale-[0.65] origin-bottom-left translate-y-8 md:translate-y-6' : ''}`}>
                    {logoUrl && !imgFailed ? (
                        <img
                            src={logoUrl}
                            alt={movie?.name || movie?.title || "title logo"}
                            className="h-full object-contain drop-shadow-2xl"
                            onError={() => setImgFailed(true)}
                        />
                    ) : (
                        <h1 className="text-3xl sm:text-5xl md:text-6xl font-black font-leaner drop-shadow-xl leading-none text-white tracking-wide uppercase">
                            {movie?.name || movie?.title || ''}
                        </h1>
                    )}
                </div>

                {/* Description - Hides after 7 seconds of video play */}
                <div className={`transition-all duration-700 overflow-hidden ${!showDescription && isVideoReady && !hasVideoEnded ? 'opacity-0 max-h-0' : 'opacity-100 max-h-40 mb-4 md:mb-6'}`}>
                    <p
                        className={`text-[12px] sm:text-[13px] md:text-[15px] font-medium text-white/90 line-clamp-2 md:line-clamp-3 drop-shadow-lg leading-relaxed max-w-[90%] sm:max-w-lg transition-all duration-700 ${['ar', 'he'].includes(t('lang', { defaultValue: 'en' }).split('-')[0]) ? 'text-right' : ''}`}
                    >
                        {movie?.overview}
                    </p>
                </div>

                {/* Netflix-style CTA Buttons */}
                <div className={`flex items-center flex-wrap gap-2 md:gap-3 transition-transform duration-700 ${!showDescription && isVideoReady && !hasVideoEnded ? 'translate-y-4 md:translate-y-2' : ''}`}>
                    {isCinemaOnly ? (
                        <button
                            onClick={() => onSelect(movie, undefined, trailerVideoId)}
                            className="flex items-center justify-center bg-[#6d6d6e]/80 text-white px-4 sm:px-8 h-[34px] md:h-[40px] rounded-[4px] font-semibold hover:bg-[#6d6d6e]/60 transition-colors text-[14px] md:text-[17px] gap-2 md:gap-2.5 blur-[0.2px] active:scale-95"
                        >
                            <TicketIcon weight="bold" className="text-lg md:text-2xl" />
                            <span className="whitespace-nowrap">{t('hero.inTheaters', { defaultValue: 'In Theaters' })}</span>
                        </button>
                    ) : (
                        <Link
                            to={`/watch/${movie?.media_type === 'tv' || (!movie?.media_type && !movie?.title) ? 'tv' : 'movie'}/${movie?.id}`}
                            className="flex items-center justify-center bg-white text-black px-5 sm:px-8 h-[34px] md:h-[40px] rounded-[4px] font-bold hover:bg-white/80 transition-colors text-[14px] md:text-[17px] gap-2 active:scale-95 shadow-lg"
                        >
                            <svg viewBox="0 0 24 24" className="w-[18px] h-[18px] md:w-6 md:h-6 fill-black">
                                <polygon points="6,3 20,12 6,21" />
                            </svg>
                            <span>{t('hero.play')}</span>
                        </Link>
                    )}

                    <button
                        onClick={() => onSelect(movie, undefined, trailerVideoId)}
                        className="flex items-center justify-center bg-[#6d6d6e]/80 text-white px-5 sm:px-9 h-[34px] md:h-[42px] rounded-[4px] font-semibold hover:bg-[#6d6d6e]/60 transition-all duration-300 text-[14px] md:text-[17px] gap-2 md:gap-2.5 pointer-events-auto blur-[0.2px] active:scale-95"
                    >
                        <InfoIcon weight="bold" className="text-lg md:text-2xl" />
                        <span className="whitespace-nowrap">{t('hero.moreInfo')}</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default HeroCarouselContent;
