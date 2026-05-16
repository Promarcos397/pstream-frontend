import React from 'react';

interface ExploreSuggestionsProps {
  label: string;
  items: string[];
  onItemClick: (item: string) => void;
}

const ExploreSuggestions: React.FC<ExploreSuggestionsProps> = ({ label, items, onItemClick }) => {
  if (!items.length) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-2 py-3 text-[14px] md:text-[15px] font-netflix">
      <span className="text-neutral-400  whitespace-nowrap">{label}</span>
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

export default ExploreSuggestions;
