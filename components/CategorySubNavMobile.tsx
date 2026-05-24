import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { Genre } from './CategorySubNav';

interface CategorySubNavMobileProps {
    genres: Genre[];
    selectedGenre: Genre | null;
    onGenreSelect: (genre: Genre | null) => void;
}

const CategorySubNavMobile: React.FC<CategorySubNavMobileProps> = ({
    genres,
    selectedGenre,
    onGenreSelect,
}) => {
    const location = useLocation();
    const navigate = useNavigate();
    const [genreMenuOpen, setGenreMenuOpen] = useState(false);

    const isTvActive = location.pathname === '/tv';
    const isMovieActive = location.pathname === '/movies';
    const isNewActive = location.pathname === '/new';

    const handlePillClick = (path: string, active: boolean) => {
        if (active) {
            navigate('/');
        } else {
            navigate(path);
        }
    };

    const handleGenreClick = (genre: Genre | null) => {
        // Use a tiny 150ms delay on mobile touch devices to allow the click/touch event lifecycle 
        // to fully finish on the active element before it is unmounted from the DOM.
        // This completely prevents the browser from routing subsequent/trailing click events 
        // to newly exposed background elements (tap-through bug).
        setTimeout(() => {
            setGenreMenuOpen(false);
        }, 150);
        onGenreSelect(genre);
    };

    const toggleMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setGenreMenuOpen(prev => !prev);
    };

    const activeGenreLabel = selectedGenre ? selectedGenre.name : 'Categories';

    return (
        <>
            {genreMenuOpen && (
                <div 
                    className="fixed inset-0 z-[75] bg-black/0 cursor-default"
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setTimeout(() => {
                            setGenreMenuOpen(false);
                        }, 150);
                    }}
                    onTouchStart={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setTimeout(() => {
                            setGenreMenuOpen(false);
                        }, 150);
                    }}
                />
            )}
            <div className="absolute top-[calc(56px+env(safe-area-inset-top))] left-0 right-0 z-[78] pt-2 pb-4 flex items-center justify-start space-x-2 select-none bg-transparent overflow-x-auto scrollbar-hide max-w-full">
                {/* Left padding spacer to match px-6 layout margin (16px spacer + 8px gap = 24px) */}
                <div className="w-[16px] shrink-0" />

                {/* TV Shows Pill */}
                <button
                    onClick={() => handlePillClick('/tv', isTvActive)}
                    className={`flex items-center justify-center h-[54px] px-4 rounded-l-[27px] rounded-r-[14px] text-[14px] font-semibold whitespace-nowrap active:scale-95 transition-all leading-none shrink-0
                        ${isTvActive 
                            ? 'bg-white/[0.18] backdrop-blur-md text-white border border-white/25' 
                            : 'bg-white/[0.06] backdrop-blur-md text-[#e5e5e5] border border-white/10'}`}
                >
                    Series
                </button>

                {/* Movies Pill */}
                <button
                    onClick={() => handlePillClick('/movies', isMovieActive)}
                    className={`flex items-center justify-center h-[54px] px-4 rounded-[14px] text-[14px] font-semibold whitespace-nowrap active:scale-95 transition-all leading-none shrink-0
                        ${isMovieActive 
                            ? 'bg-white/[0.18] backdrop-blur-md text-white border border-white/25' 
                            : 'bg-white/[0.06] backdrop-blur-md text-[#e5e5e5] border border-white/10'}`}
                >
                    Movies
                </button>

                {/* New & Hot Pill */}
                <button
                    onClick={() => handlePillClick('/new', isNewActive)}
                    className={`flex items-center justify-center h-[54px] px-4 rounded-[14px] text-[14px] font-semibold whitespace-nowrap active:scale-95 transition-all leading-none shrink-0
                        ${isNewActive 
                            ? 'bg-white/[0.18] backdrop-blur-md text-white border border-white/25' 
                            : 'bg-white/[0.06] backdrop-blur-md text-[#e5e5e5] border border-white/10'}`}
                >
                    New & Hot
                </button>

                {/* Categories Pill */}
                <div className="relative shrink-0">
                    <button
                        onClick={selectedGenre ? () => handleGenreClick(null) : toggleMenu}
                        className={`flex items-center justify-center space-x-1 h-[54px] px-4 rounded-l-[14px] rounded-r-[27px] text-[14px] font-semibold whitespace-nowrap active:scale-95 transition-all leading-none
                            ${selectedGenre 
                                ? 'bg-white/[0.18] backdrop-blur-md text-white border border-white/25' 
                                : 'bg-white/[0.06] backdrop-blur-md text-[#e5e5e5] border border-white/10'}`}
                    >
                        <span>{activeGenreLabel}</span>
                        {selectedGenre ? (
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-3.5 h-3.5 opacity-80 ml-1">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 opacity-70 ml-1">
                                <path d="M12 15.375L6 9.375L7.4 7.975L12 12.575L16.6 7.975L18 9.375L12 15.375Z" />
                            </svg>
                        )}
                    </button>
                </div>

                {/* Right padding spacer to match px-6 layout margin (8px gap + 16px spacer = 24px) */}
                <div className="w-[16px] shrink-0" />
            </div>

            {/* Genres Dropdown Menu rendered via Portal to prevent clipping inside scroll container */}
            {genreMenuOpen && genres && genres.length > 0 && ReactDOM.createPortal(
                <div
                    className="fixed top-[calc(118px+env(safe-area-inset-top))] right-6 z-[85] animate-fadeIn"
                    role="listbox"
                >
                    <div className="w-max max-w-[calc(100vw-3rem)] max-h-[50vh] overflow-y-auto bg-[#181818] border border-white/10 rounded-lg py-2 px-4 shadow-2xl scrollbar-hide">
                        <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                            {genres.map((genre) => (
                                <button
                                    key={`${genre.id}-${genre.name}`}
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleGenreClick(genre);
                                    }}
                                    role="option"
                                    aria-selected={false}
                                    className="text-left text-[13px] py-1 transition-colors hover:text-white text-[#e5e5e5] active:scale-95"
                                >
                                    {genre.name}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
};

export default CategorySubNavMobile;
