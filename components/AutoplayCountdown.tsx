import React from 'react';
import { PlayIcon } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';

interface AutoplayCountdownProps {
    showAutoplayCountdown: boolean;
    onCancelAutoplay?: () => void;
    onPlayNextNow?: () => void;
    isMobile: boolean;
}

export const AutoplayCountdown: React.FC<AutoplayCountdownProps> = ({
    showAutoplayCountdown,
    onCancelAutoplay,
    onPlayNextNow,
    isMobile,
}) => {
    const { t } = useTranslation();
    if (!showAutoplayCountdown || !onCancelAutoplay || !onPlayNextNow) return null;

    return (
        <div className="pointer-events-auto flex items-center gap-3 animate-fadeIn">
            {/* On mobile, only show the Next Episode button (skip Watch Credits button) */}
            {!isMobile && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onCancelAutoplay();
                    }}
                    className="flex items-center justify-center px-5 sm:px-6 h-[39px] md:h-[50px] bg-black/60 hover:bg-black/80 backdrop-blur-md text-white font-bold text-[15px] md:text-[17px] rounded-[4px] transition-colors shadow-lg active:scale-95 border border-white/10"
                >
                    {t('player.skipCredits')}
                </button>
            )}

            <button
                onClick={(e) => {
                    e.stopPropagation();
                    onPlayNextNow();
                }}
                className={`flex items-center justify-center gap-2 ${
                    isMobile ? 'px-3.5 h-[34px] text-[13px]' : 'px-6 sm:px-8 h-[40px] md:h-[50px] text-[16px] md:text-[20px]'
                } bg-neutral-200 hover:bg-white text-black font-bold rounded-[4px] shadow-lg active:scale-95 transition-colors`}
            >
                <PlayIcon size={isMobile ? 15 : 25} weight="fill" className="text-black" />
                {t('player.nextEpisode')}
            </button>
        </div>
    );
};
