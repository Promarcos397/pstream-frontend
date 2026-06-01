import React, { useState, useEffect, useRef } from 'react';

type NewTab = 'watching' | 'justlanded' | 'top10movies' | 'top10series' | 'comingsoon';

interface NewPopularSubNavMobileProps {
    activeTab: NewTab;
    onTabChange: (tab: NewTab) => void;
}

const TABS: { id: NewTab; label: string }[] = [
    { id: 'watching',    label: "Everyone's Watching" },
    { id: 'justlanded',  label: 'Just Landed' },
    { id: 'top10movies', label: 'Top 10 Movies' },
    { id: 'top10series', label: 'Top 10 Series' },
    { id: 'comingsoon',  label: 'Coming Soon' },
];

const NewPopularSubNavMobile: React.FC<NewPopularSubNavMobileProps> = ({
    activeTab,
    onTabChange,
}) => {
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
                        className={`flex items-center justify-center h-[46px] px-3.5 ${cornerClass} text-[14px] font-semibold whitespace-nowrap active:scale-95 transition-all leading-none shrink-0 ${
                            isActive
                                ? 'bg-white/[0.18] backdrop-blur-md text-white border border-white/25'
                                : 'bg-white/[0.06] backdrop-blur-md text-[#e5e5e5] border border-white/10'
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
            <div className="absolute top-[calc(68px+env(safe-area-inset-top))] sm:top-[calc(16px+env(safe-area-inset-top))] left-0 right-0 sm:left-[72px] z-[78] pt-1 pb-3 flex items-center justify-start select-none bg-transparent overflow-x-auto scrollbar-hide max-w-full">
                <div className="w-full max-w-[440px] min-[500px]:w-full min-[500px]:max-w-[680px] mx-auto px-4 flex items-center justify-start space-x-2 shrink-0 overflow-visible">
                    {pills}
                </div>
            </div>

            {/* 2. Temporary fixed sub-nav: fixed at top, slides down on scroll-up, slides up on scroll-down, with solid background */}
            <div
                style={{ backgroundColor: 'rgba(0, 0, 0, 1)' }}
                className={`fixed top-[calc(56px+env(safe-area-inset-top))] sm:top-0 left-0 right-0 sm:left-[72px] z-[79] pt-4 sm:pt-[calc(20px+env(safe-area-inset-top))] pb-3 flex items-center justify-start select-none max-w-full overflow-x-auto scrollbar-hide transition-all duration-300 ease-out ${
                    showTemp 
                        ? 'opacity-100 translate-y-0 pointer-events-auto' 
                        : '-translate-y-full opacity-0 pointer-events-none'
                }`}
            >
                <div className="w-full max-w-[440px] min-[500px]:w-full min-[500px]:max-w-[680px] mx-auto px-4 flex items-center justify-start space-x-2 shrink-0 overflow-visible">
                    {pills}
                </div>
            </div>
        </>
    );
};

export { type NewTab };
export default NewPopularSubNavMobile;
