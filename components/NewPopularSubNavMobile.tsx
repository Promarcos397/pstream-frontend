import React from 'react';

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
    return (
        <div className="absolute top-[calc(56px+env(safe-area-inset-top))] left-0 right-0 z-[78] pt-2 pb-4 flex items-center justify-start space-x-2 select-none bg-transparent overflow-x-auto scrollbar-hide max-w-full">
            {/* Left padding spacer */}
            <div className="w-[16px] shrink-0" />

            {TABS.map((tab, i) => {
                const isActive = activeTab === tab.id;
                const isFirst = i === 0;
                const isLast = i === TABS.length - 1;

                const cornerClass = isFirst
                    ? 'rounded-l-[27px] rounded-r-[14px]'
                    : isLast
                        ? 'rounded-l-[14px] rounded-r-[27px]'
                        : 'rounded-[14px]';

                return (
                    <button
                        key={tab.id}
                        onClick={() => onTabChange(tab.id)}
                        className={`flex items-center justify-center h-[54px] px-4 ${cornerClass} text-[14px] font-semibold whitespace-nowrap active:scale-95 transition-all leading-none shrink-0 ${
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
        </div>
    );
};

export { type NewTab };
export default NewPopularSubNavMobile;
