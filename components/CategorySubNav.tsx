import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { CaretDownIcon, SquaresFourIcon, RowsIcon } from '@phosphor-icons/react';
import useScroll from '../hooks/useScroll';
import { useIsMobile } from '../hooks/useIsMobile';
import CategorySubNavMobile from './CategorySubNavMobile';

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
    /** Hide title and Genres dropdown on desktop (e.g. Home page) */
    hideGenresOnDesktop?: boolean;
}

const CategorySubNav: React.FC<CategorySubNavProps> = ({
    title,
    genres,
    selectedGenre,
    onGenreSelect,
    viewMode = 'row',
    onViewModeChange,
    hideGenresOnDesktop = false,
}) => {
    const isMobile = useIsMobile();
    const [genreMenuOpen, setGenreMenuOpen] = useState(false);
    const isScrolled = useScroll(0);

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

    if (isMobile) {
        return (
            <CategorySubNavMobile
                title={title}
                genres={genres}
                selectedGenre={selectedGenre}
                onGenreSelect={onGenreSelect}
            />
        );
    }

    if (hideGenresOnDesktop) {
        return null;
    }

    const portalElement = document.getElementById('category-subnav-portal');

    const content = (
        <div className={`relative z-30 flex items-center justify-between pt-4 md:pt-5 pb-0 md:pb-1 select-none w-full`}>
            <div className={`flex items-center ${selectedGenre ? 'gap-3 md:gap-[15px]' : 'gap-3 md:gap-[15px]'}`} ref={containerRef}>
                <h1 className={`font-bold tracking-[-0.5px] text-white flex items-center transition-all duration-300 mt-2 md:mt-3
                    ${selectedGenre ? 'text-2xl md:text-[38px]' : 'text-2xl md:text-[38px]'} leading-tight`}>
                    {selectedGenre ? (
                        <>
                            <span
                                onClick={() => handleGenreClick(null)}
                                className="cursor-pointer hover:underline text-[#e5e5e5] transition-colors whitespace-nowrap"
                            >
                                {title}
                            </span>
                            <span className="text-white/60 font-bold text-2xl md:text-[32px] mx-2 md:mx-4 whitespace-nowrap">&gt;</span>
                            <span className="whitespace-nowrap">{selectedGenre.name}</span>
                        </>
                    ) : (
                        <span>{title}</span>
                    )}
                </h1>

                {!selectedGenre && (
                    <div className="relative mt-[10px] md:mt-[14px] ml-4 md:ml-[24px]">
                        <button
                            onClick={toggleMenu}
                            className={`flex items-center justify-between w-[95px] md:w-[115px] pl-1 pr-2 md:pl-2 md:pr-2 py-[4px] md:py-[6px] leading-none text-[13px] md:text-[14px] font-bold tracking-[-0.2px] text-white bg-black hover:bg-white/5 ${genreMenuOpen ? 'bg-white/5' : ''} border border-white/80 transition-colors rounded-none active:scale-95`}
                            aria-haspopup="listbox"
                            aria-expanded={genreMenuOpen}
                        >
                            Genres
                            <CaretDownIcon
                                size={12}
                                weight="fill"
                                className={`text-white transition-transform duration-200 shrink-0 ${genreMenuOpen ? 'rotate-180' : ''}`}
                            />
                        </button>

                        <div
                            className={`absolute top-full left-0 z-50 transition-all duration-200 translate-x-0
                                ${genreMenuOpen ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 -translate-y-1 pointer-events-none'}`}
                            role="listbox"
                        >
                            <div className="w-max max-w-[90vw] md:max-w-none max-h-[60vh] md:max-h-[400px] overflow-y-auto bg-[rgba(0,0,0,0.85)] border border-white/10 rounded-none pt-1 pb-1 px-4 md:pt-2 md:pb-2 md:px-8 scrollbar-hide">
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3">
                                    {genres.map((genre) => (
                                        <button
                                            key={`${genre.id}-${genre.name}`}
                                            onClick={() => handleGenreClick(genre)}
                                            role="option"
                                            aria-selected={false}
                                            className={`text-left text-[13px] md:text-[14px] transition-colors hover:underline whitespace-nowrap text-[#e5e5e5]`}
                                        >
                                            {genre.name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* View Mode Toggle */}
            {onViewModeChange && (
                <div className="flex items-center bg-[#1a1a1a] rounded-full border border-white/10 p-0.5">
                    <button
                        onClick={() => onViewModeChange('row')}
                        className={`p-1.5 rounded-full transition-all duration-200 ${viewMode === 'row' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/70'}`}
                        title="Row view"
                    >
                        <RowsIcon size={16} weight="bold" />
                    </button>
                    <button
                        onClick={() => onViewModeChange('grid')}
                        className={`p-1.5 rounded-full transition-all duration-200 ${viewMode === 'grid' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/70'}`}
                        title="Grid view"
                    >
                        <SquaresFourIcon size={16} weight="bold" />
                    </button>
                </div>
            )}
        </div>
    );

    if (portalElement) {
        return ReactDOM.createPortal(content, portalElement);
    }

    return content;

};

export default CategorySubNav;