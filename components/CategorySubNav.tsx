import React, { useState } from 'react';
import { CaretDownIcon, SquaresFourIcon, ListBulletsIcon } from '@phosphor-icons/react';

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

    const handleGenreClick = (genre: Genre | null) => {
        setGenreMenuOpen(false);
        onGenreSelect(genre);
    };

    return (
        <div className="relative z-30 flex items-center justify-between px-6 md:px-14 lg:px-16 pt-2 pb-3">
            {/* Left side: Title + Genres dropdown */}
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
                            <span>{selectedGenre.name} {title}</span>
                        </>
                    ) : (
                        <span>{title}</span>
                    )}
                </h1>

                {/* Genres Dropdown (Hidden when a genre is selected) */}
                {!selectedGenre && (
                    <div
                        className="relative"
                        onMouseEnter={() => setGenreMenuOpen(true)}
                        onMouseLeave={() => setGenreMenuOpen(false)}
                    >
                        <button className="flex items-center gap-2 px-3 py-[5px] text-[13px] font-medium text-white bg-transparent border border-white/40 hover:border-white/70 transition-colors rounded-[2px]">
                            Genres
                            <CaretDownIcon
                                size={10}
                                weight="bold"
                                className={`text-white/70 transition-transform duration-200 ${genreMenuOpen ? 'rotate-180' : ''}`}
                            />
                        </button>

                        {/* Genre Dropdown Panel */}
                        <div
                            className={`absolute top-full left-0 mt-1 z-50 transition-all duration-200 ${genreMenuOpen ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 -translate-y-1 pointer-events-none'
                                }`}
                        >
                            <div className="w-[320px] md:w-[480px] max-h-[400px] overflow-y-auto bg-[#141414]/[0.97] border border-[#454545] rounded-[2px] shadow-[0_8px_32px_rgba(0,0,0,0.8)] p-4">
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-[2px]">
                                    {genres.map((genre) => (
                                        <button
                                            key={genre.id}
                                            onClick={() => handleGenreClick(genre)}
                                            className={`text-left text-[13px] py-[6px] transition-colors hover:text-white whitespace-nowrap text-[#b3b3b3]`}
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

        </div>
    );
};

export default CategorySubNav;
