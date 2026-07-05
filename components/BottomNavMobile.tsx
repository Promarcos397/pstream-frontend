import React from 'react';

export interface BottomNavItem {
  id: string;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}

interface BottomNavMobileProps {
  items: BottomNavItem[];
  activeId: string;
}

/**
 * Static Netflix-style mobile bottom tab bar: a solid dark rounded-pill
 * container with a lighter highlight pill sitting behind the active tab.
 * No physics/measuring — the highlight is just a background on the active
 * item, so it's rock-solid across tab-set changes (3-tab Kids vs 4-tab).
 *
 * The previous physics-driven "liquid glass" version is archived, verbatim
 * and restorable, in docs/frozen/liquid-glass-bottom-nav.md.
 */
const BottomNavMobile: React.FC<BottomNavMobileProps> = ({ items, activeId }) => {
  const foundIndex = items.findIndex(i => i.id === activeId);
  const activeIndex = foundIndex >= 0 ? foundIndex : 0;

  return (
    <div
      className="
        fixed bottom-[calc(12px+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 z-[10020]
        w-auto max-w-[calc(100%-2rem)]
        bg-[#2a2a2a]/95 backdrop-blur-md border border-white/[0.06] rounded-full
        px-1.5 py-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.55)]
      "
    >
      <div className="flex items-center">
        {items.map((item, idx) => {
          const isActive = idx === activeIndex;
          return (
            <button
              key={item.id}
              onClick={item.onClick}
              className={`relative flex flex-col items-center justify-center gap-1 rounded-full px-6 sm:px-7 py-2 select-none
                transition-colors duration-200 active:scale-95
                ${isActive ? 'bg-white/[0.12] text-white' : 'text-white/55 hover:text-white/80'}`}
            >
              <span className="flex items-center justify-center h-[24px]">{item.icon}</span>
              <span className={`text-[10px] tracking-wide whitespace-nowrap ${isActive ? 'font-medium' : 'font-normal'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default BottomNavMobile;
