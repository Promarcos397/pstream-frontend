import React from 'react';
import { InfoIcon } from '../icons';
import { useTranslation } from 'react-i18next';
import { Movie } from '../types';

interface HeroMoreInfoButtonProps {
    movie: Movie;
    onSelect: (movie: Movie, time?: number, videoId?: string) => void;
    trailerVideoId?: string;
    className?: string;
}

const HeroMoreInfoButton: React.FC<HeroMoreInfoButtonProps> = ({
    movie,
    onSelect,
    trailerVideoId,
    className = '',
}) => {
    const { t } = useTranslation();

    return (
        <button
            onClick={(e) => {
                const rawRect = e.currentTarget.getBoundingClientRect();
                if (rawRect) (window as any).__last_card_rect = rawRect;
                onSelect(movie, undefined, trailerVideoId);
            }}
            className={`flex items-center justify-center bg-[#6d6d6e]/50 text-white px-5 sm:px-8 h-[35px] md:h-[45px] rounded-[4px] font-bold hover:bg-[#6d6d6e]/35 transition-colors duration-200 text-[15px] md:text-[18px] gap-2 pointer-events-auto ${className}`}
        >
            <InfoIcon size="1em" weight="regular" className="text-[22px] md:text-[30px]" />
            <span className="whitespace-nowrap">{t('hero.moreInfo')}</span>
        </button>
    );
};

export default HeroMoreInfoButton;
