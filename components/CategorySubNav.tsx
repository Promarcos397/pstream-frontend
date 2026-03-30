import React, { useState, useRef } from 'react';
import { CaretDownIcon } from '@phosphor-icons/react';

export interface Genre {
    id: number;
    name: string;
}

interface CategorySubNavProps {
    title: string;
    genres: Genre[];
    selectedGenre: Genre | null;
    onGenreSelect: (genre: Genre | null) => void;
    viewMode?: 'row' | 'grid';
    onViewModeChange?: (mode: 'row' | 'grid') => void;
}

const CategorySubNav: React.FC<CategorySubNavProps> = ({
    title,
    genres,
    selectedGenre,
    onGenreSelect,
    viewMode = 'row',
    onViewModeChange,
}) => {
    const [genreMenuOpen, setGenreMenuOpen] = useState(false);
    // Delay closing so accidental mouse-exit doesn't flicker the panel shut
    const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const openMenu = () => {
        if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
        setGenreMenuOpen(true);
    };

    const scheduleClose = () => {
        closeTimerRef.current = setTimeout(() => setGenreMenuOpen(false), 220);
    };

    const toggleMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (genreMenuOpen) {
            setGenreMenuOpen(false);
        } else {
            openMenu();
        }
    };

    const handleGenreClick = (genre: Genre | null) => {
        setGenreMenuOpen(false);
        if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
        onGenreSelect(genre);
    };

    return (
        <div className="relative z-30 flex items-center justify-between px-6 md:px-14 lg:px-16 pt-2 pb-3 select-none">
            {/* Left side: Title + breadcrumb + Genres dropdown */}
            <div className="flex items-center gap-4 md:gap-6">

                {/* Dynamic Title / Breadcrumb */}
                <h1 className="text-xl md:text-3xl lg:text-4xl font-bold text-white flex items-center">
                    {selectedGenre ? (
                        <>
                            <span
                                onClick={() => handleGenreClick(null)}
                                className="cursor-pointer hover:underline text-[#e5e5e5] transition-colors"
                            >
                                {title}
                            </span>
                            <span className="text-[#808080] font-normal text-xl md:text-2xl mx-3">&gt;</span>
                            <span className="truncate max-w-[150px] md:max-w-none">{selectedGenre.name} {title}</span>
                        </>
                    ) : (
                        <span>{title}</span>
                    )}
                </h1>

                {/* Genres Dropdown — always visible (not hidden when genre is selected) */}
                <div
                    className="relative"
                    onMouseEnter={openMenu}
                    onMouseLeave={scheduleClose}
                >
                    <button
                        onClick={toggleMenu}
                        className={`flex items-center gap-2 px-3 py-[6px] md:py-[5px] text-[13px] font-medium text-white bg-transparent border transition-colors rounded-[2px] active:scale-95
                            ${selectedGenre ? 'border-white/70 bg-white/5' : 'border-white/40 hover:border-white/70'}`}
                        aria-haspopup="listbox"
                        aria-expanded={genreMenuOpen}
                    >
                        {selectedGenre ? selectedGenre.name : 'Genres'}
                        <CaretDownIcon
                            size={10}
                            weight="bold"
                            className={`text-white/70 transition-transform duration-200 ${genreMenuOpen ? 'rotate-180' : ''}`}
                        />
                    </button>

                    {/* Genre Dropdown Panel — delayed close prevents accidental flicker */}
                    <div
                        className={`absolute top-full left-0 mt-1 z-50 transition-all duration-200 ${
                            genreMenuOpen ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 -translate-y-1 pointer-events-none'
                        }`}
                        onMouseEnter={openMenu}
                        onMouseLeave={scheduleClose}
                        role="listbox"
                    >
                        <div className="w-[85vw] max-w-[320px] md:w-[480px] md:max-w-none max-h-[60vh] md:max-h-[460px] overflow-y-auto bg-[#141414]/[0.98] backdrop-blur-xl border border-white/20 rounded-[2px] shadow-[0_8px_48px_rgba(0,0,0,0.9)] p-4 scrollbar-hide">
                            {/* "All" reset option when a genre is active */}
                            {selectedGenre && (
                                <button
                                    onClick={() => handleGenreClick(null)}
                                    className="w-full text-left text-[14px] py-[10px] mb-2 border-b border-white/10 text-white/50 hover:text-white transition-colors flex items-center gap-2"
                                >
                                    <span className="text-lg">←</span> All {title}
                                </button>
                            )}
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-[1px]">
                                {genres.map((genre) => (
                                    <button
                                        key={genre.id}
                                        onClick={() => handleGenreClick(genre)}
                                        role="option"
                                        aria-selected={selectedGenre?.id === genre.id}
                                        className={`text-left text-[14px] md:text-[13px] py-[10px] md:py-[7px] transition-colors hover:text-white whitespace-nowrap px-2 rounded-sm hover:bg-white/5
                                            ${selectedGenre?.id === genre.id ? 'text-white font-semibold bg-white/5' : 'text-[#b3b3b3]'}`}
                                    >
                                        {genre.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CategorySubNav;
