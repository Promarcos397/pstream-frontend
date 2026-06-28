import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { useTranslation } from 'react-i18next';

type NewTab = 'watching' | 'justlanded' | 'top10movies' | 'top10series' | 'comingsoon';
// removing tablet and ipad styles and sidebar

interface NewPopularSubNavMobileProps {
    activeTab: NewTab;
    onTabChange: (tab: NewTab) => void;
}

const NewPopularSubNavMobile: React.FC<NewPopularSubNavMobileProps> = ({
    activeTab,
    onTabChange,
}) => {
    const { t } = useTranslation();
    const TABS: { id: NewTab; label: string }[] = [
        { id: 'watching',    label: t('newPopular.everyoneWatching', { defaultValue: "Everyone's Watching" }) },
        { id: 'justlanded',  label: t('newPopular.justLanded',       { defaultValue: 'Just Landed' }) },
        { id: 'top10movies', label: t('newPopular.top10Movies',      { defaultValue: 'Top 10 Movies' }) },
        { id: 'top10series', label: t('newPopular.top10Series',      { defaultValue: 'Top 10 Series' }) },
        { id: 'comingsoon',  label: t('newPopular.comingSoon',       { defaultValue: 'Coming Soon' }) },
    ];
    const [scrollY, setScrollY] = useState(0);
    const [subNavVisible, setSubNavVisible] = useState(false);
    const lastScrollY = useRef(0);

    useEffect(() => {
        const SCROLL_DOWN_THRESHOLD = 10;
        const SCROLL_UP_THRESHOLD = 10;
        const TRIGGER_LIMIT = 140;

        const handleScroll = () => {
            const currentY = window.scrollY;
            setScrollY(currentY);

            const delta = currentY - lastScrollY.current;

            if (currentY < TRIGGER_LIMIT) {
                setSubNavVisible(false);
            } else if (delta > SCROLL_DOWN_THRESHOLD) {
                setSubNavVisible(false);
            } else if (delta < -SCROLL_UP_THRESHOLD) {
                setSubNavVisible(true);
            }

            lastScrollY.current = currentY;
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        handleScroll();
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const pills = (
        <>
            {TABS.map((tab, i) => {
                const isActive = activeTab === tab.id;
                const isFirst = i === 0;
                const isLast = i === TABS.length - 1;

                const cornerClass = isFirst
                    ? 'rounded-l-[23px] rounded-r-[12px]'
                    : isLast
                        ? 'rounded-l-[12px] rounded-r-[23px]'
                        : 'rounded-[12px]';

                return (
                    <button
                        key={tab.id}
                        onClick={() => onTabChange(tab.id)}
                        className={`flex items-center justify-center h-[48px] sm:h-[56px] px-3.5 sm:px-5 ${cornerClass} text-[14px] sm:text-[15px] font-semibold whitespace-nowrap active:scale-95 transition-all leading-none shrink-0 ${
                            isActive
                                ? 'bg-white/[0.18] backdrop-blur-md text-white border-[1.6px] border-white/40'
                                : 'bg-white/[0.06] backdrop-blur-md text-[#e5e5e5] border-[1.6px] border-white/15'
                        }`}
                    >
                        {tab.label}
                    </button>
                );
            })}

            {/* Right padding spacer */}
            <div className="w-[16px] shrink-0" />
        </>
    );

    const showTemp = scrollY >= 140 && subNavVisible;

    return (
        <>
            {/* 1. Original sub-nav: absolute at the top, scrolls naturally with the page content */}
            <div className="absolute top-[calc(57px+env(safe-area-inset-top))] left-0 right-0 z-[78] pt-[3px] pb-[4px] flex items-center justify-start select-none bg-transparent overflow-x-auto scrollbar-hide max-w-full">
                <div className="w-full max-w-[440px] min-[500px]:w-full min-[500px]:max-w-[680px] mx-auto px-4 flex items-center justify-start space-x-1 shrink-0 overflow-visible">
                    {pills}
                </div>
            </div>

            {/* 2. Temporary fixed sub-nav: fixed at top, slides down on scroll-up, slides up on scroll-down, with solid black background */}
            {ReactDOM.createPortal(
                <div
                    style={{ 
                        backgroundColor: '#000000'
                    }}
                    className={`fixed top-[calc(55px+env(safe-area-inset-top))] left-0 right-0 z-[79] pt-[3px] pb-[4px] flex items-center justify-start select-none max-w-full overflow-x-auto scrollbar-hide transition-all duration-300 ease-out ${
                        showTemp 
                            ? 'opacity-100 translate-y-0 pointer-events-auto' 
                            : '-translate-y-full opacity-0 pointer-events-none'
                    }`}
                >
                    <div className="w-full max-w-[440px] min-[500px]:w-full min-[500px]:max-w-[680px] mx-auto px-4 flex items-center justify-start space-x-1 shrink-0 overflow-visible">
                        {pills}
                    </div>
                </div>,
                document.body
            )}
        </>
    );
};

export { type NewTab };
export default NewPopularSubNavMobile;
