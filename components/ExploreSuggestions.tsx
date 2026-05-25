import React from 'react';
import { useIsMobile } from '../hooks/useIsMobile';

interface ExploreSuggestionsProps {
  label: string;
  items: string[];
  onItemClick: (item: string) => void;
}

const ExploreSuggestions: React.FC<ExploreSuggestionsProps> = ({ label, items, onItemClick }) => {
  const isMobile = useIsMobile();
  
  if (!items.length) return null;

  if (isMobile) {
    return (
      <div className="flex flex-col gap-y-4 py-6 text-left font-netflix select-none">
        <span className="text-[#8c8c8c] text-[15px] font-bold uppercase tracking-wider mb-2">{label}</span>
        <div className="flex flex-col gap-y-3">
          {items.map((item) => (
            <button
              key={item}
              onClick={() => onItemClick(item)}
              className="text-white hover:text-[#E50914] text-[22px] font-normal active:scale-95 transition-all text-left w-fit block py-0.5 leading-snug"
            >
              {item}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Desktop horizontal row list style
  return (
    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-2 py-3 text-[14px] md:text-[15px] font-netflix">
      <span className="text-neutral-400 whitespace-nowrap">{label}</span>
      {items.map((item, idx) => (
        <React.Fragment key={item}>
          <button
            onClick={() => onItemClick(item)}
            className="text-white hover:text-[#E50914] transition-colors active:scale-95 px-0.5"
          >
            {item}
          </button>
          {idx < items.length - 1 && (
            <span className="text-neutral-600 font-light select-none">|</span>
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

export default React.memo(ExploreSuggestions);
