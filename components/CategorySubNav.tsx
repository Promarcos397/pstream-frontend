import React, { useState, useRef, useEffect } from 'react';
import { CaretDownIcon, XIcon } from '@phosphor-icons/react';

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
    const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

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
        setGenreMenuOpen(prev => !prev);
    };

    const handleGenreClick = (genre: Genre | null) => {
        setGenreMenuOpen(false);
        if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
        onGenreSelect(genre);
    };

    // Tap-outside to close on mobile
    useEffect(() => {
        if (!genreMenuOpen) return;
        const handleOutside = (e: MouseEvent | TouchEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setGenreMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleOutside);
        document.addEventListener('touchstart', handleOutside, { passive: true });
        return () => {
            document.removeEventListener('mousedown', handleOutside);
            document.removeEventListener('touchstart', handleOutside);
        };
    }, [genreMenuOpen]);

    return (
        <div className="relative z-30 flex items-center justify-between px-6 md:px-14 lg:px-16 pt-2 pb-3 select-none">
            {/* Left side: Title + Genres dropdown */}
            <div className={`flex items-center ${selectedGenre ? 'gap-2 md:gap-6' : 'gap-4 md:gap-6'}`} ref={containerRef}>

                {/* Dynamic Title / Breadcrumb */}
                <h1 className={`font-bold text-white flex items-center transition-all duration-300 
                    ${selectedGenre ? 'text-lg md:text-3xl' : 'text-xl md:text-3xl lg:text-4xl'}`}>
                    {selectedGenre ? (
                        <>
                            <span
                                onClick={() => handleGenreClick(null)}
                                className="cursor-pointer hover:underline text-[#e5e5e5] transition-colors truncate max-w-[80px] sm:max-w-[120px] md:max-w-none"
                            >
                                {title}
                            </span>
                            <span className="text-[#808080] font-normal text-lg md:text-2xl mx-1.5 md:mx-3">&gt;</span>
                            <span className="truncate max-w-[100px] sm:max-w-[180px] md:max-w-none">{selectedGenre.name}</span>
                        </>
                    ) : (
                        <span>{title}</span>
                    )}
                </h1>

                {/* Genres Dropdown */}
                <div
                    className="relative"
                    onMouseEnter={openMenu}
                    onMouseLeave={scheduleClose}
                >
                    <button
                        onClick={toggleMenu}
                        className={`flex items-center gap-2 px-3 py-[5px] text-[13px] font-medium text-white bg-transparent border transition-colors rounded-[2px] active:scale-95
                            ${selectedGenre ? 'border-white/70 bg-white/5' : 'border-white/40 hover:border-white/70'}`}
                        aria-haspopup="listbox"
                        aria-expanded={genreMenuOpen}
                    >
                        {selectedGenre ? (
                            <span className="max-w-[80px] truncate">{selectedGenre.name}</span>
                        ) : 'Genres'}
                        <CaretDownIcon
                            size={10}
                            weight="bold"
                            className={`text-white/70 transition-transform duration-200 shrink-0 ${genreMenuOpen ? 'rotate-180' : ''}`}
                        />
                    </button>

                    {/* Dropdown Panel */}
                    <div
                        className={`absolute top-full left-0 md:left-0 mt-1 z-50 transition-all duration-200 
                            ${selectedGenre ? '-translate-x-12 md:translate-x-0' : 'translate-x-0'}
                            ${genreMenuOpen ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 -translate-y-1 pointer-events-none'}`}
                        onMouseEnter={openMenu}
                        onMouseLeave={scheduleClose}
                        role="listbox"
                    >
                        {/* Shorter panel: max-h reduced from 60vh to 42vh on mobile, 320px on desktop */}
                        <div className="w-[80vw] max-w-[280px] md:w-[440px] md:max-w-none max-h-[42vh] md:max-h-[320px] overflow-y-auto bg-[#141414]/[0.98] backdrop-blur-xl border border-white/20 rounded-[2px] shadow-[0_8px_48px_rgba(0,0,0,0.9)] p-3 scrollbar-hide">
                            {/* "All" reset option */}
                            {selectedGenre && (
                                <button
                                    onClick={() => handleGenreClick(null)}
                                    className="w-full text-left text-[13px] py-[8px] mb-2 border-b border-white/10 text-white/50 hover:text-white transition-colors flex items-center gap-2"
                                >
                                    <span className="text-base">←</span> All {title}
                                </button>
                            )}
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-3 gap-y-[1px]">
                                {genres.map((genre) => (
                                    <button
                                        key={genre.id}
                                        onClick={() => handleGenreClick(genre)}
                                        role="option"
                                        aria-selected={selectedGenre?.id === genre.id}
                                        className={`text-left text-[13px] py-[8px] md:py-[6px] transition-colors hover:text-white whitespace-nowrap px-2 rounded-sm hover:bg-white/5 active:bg-white/10
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
