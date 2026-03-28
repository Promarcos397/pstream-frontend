import React from 'react';
import { PlayIcon, InfoIcon } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { Movie } from '../types';

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
    return (
        <div className={`absolute top-0 left-0 w-full h-full flex flex-col justify-end z-20 
          pl-6 md:pl-14 lg:pl-16 pr-4 md:pr-12 pointer-events-none pb-[18%] sm:pb-[16%] md:pb-[14%]`}
        >
            <div className="max-w-[90%] sm:max-w-lg md:max-w-xl lg:max-w-2xl space-y-3 md:space-y-4 pointer-events-auto">

                {/* Logo/Title - Anchored lower, scales down during video playback */}
                <div className={`h-14 sm:h-20 md:h-28 flex items-end mb-4 md:mb-5 origin-bottom-left transition-all duration-700 ${isVideoReady && !hasVideoEnded ? 'scale-[0.65] origin-bottom-left translate-y-6' : ''}`}>
                    {logoUrl ? (
                        <img src={logoUrl} alt="title logo" className="h-full object-contain drop-shadow-2xl" />
                    ) : (
                        <h1 className="text-3xl sm:text-5xl md:text-6xl font-black font-leaner drop-shadow-xl leading-none text-white tracking-wide">
                            {movie?.name || movie?.title || ''}
                        </h1>
                    )}
                </div>

                {/* Description - Hides when video plays */}
                <div className={`transition-all duration-700 overflow-hidden ${isVideoReady && !hasVideoEnded ? 'opacity-0 max-h-0' : 'opacity-100 max-h-40 mb-5 md:mb-6'}`}>
                    <p
                        className={`text-[13px] md:text-[15px] font-medium text-white line-clamp-2 md:line-clamp-3 drop-shadow-lg leading-snug max-w-lg transition-all duration-700 ${['ar', 'he'].includes(t('lang', { defaultValue: 'en' }).split('-')[0]) ? 'text-right' : ''}`}
                        dir={['ar', 'he'].includes(useTranslation().i18n.language.split('-')[0]) ? "rtl" : "ltr"}
                    >
                        {movie?.overview}
                    </p>
                </div>

                {/* Netflix-style CTA Buttons */}
                <div className={`flex items-center gap-2 transition-transform duration-700 ${isVideoReady && !hasVideoEnded ? 'translate-y-2' : ''}`}>
                    <button
                        onClick={() => onPlay(movie)}
                        className="flex items-center justify-center bg-white text-black px-4 md:px-6 h-[36px] md:h-[42px] rounded-[4px] font-semibold hover:bg-white/80 transition-colors text-sm md:text-[15px] gap-1.5"
                    >
                        <svg viewBox="0 0 24 24" className="w-[18px] h-[18px] md:w-5 md:h-5 fill-black">
                            <polygon points="6,3 20,12 6,21" />
                        </svg>
                        {t('hero.play')}
                    </button>
                    <button
                        onClick={() => onSelect(movie, undefined, trailerVideoId)}
                        className="flex items-center justify-center bg-[#6d6d6e]/60 text-white px-5 md:px-7 h-[36px] md:h-[42px] rounded-[4px] font-semibold hover:bg-[#6d6d6e]/40 backdrop-blur-sm transition-colors text-sm md:text-[15px] gap-2"
                    >
                        <InfoIcon weight="bold" className="text-lg md:text-xl" />
                        {t('hero.moreInfo')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default HeroCarouselContent;

