import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { Genre } from './CategorySubNav';

interface CategorySubNavMobileProps {
    title?: string;
    genres: Genre[];
    selectedGenre: Genre | null;
    onGenreSelect: (genre: Genre | null) => void;
}

const CategorySubNavMobile: React.FC<CategorySubNavMobileProps> = ({
    title,
    genres,
    selectedGenre,
    onGenreSelect,
}) => {
    const location = useLocation();
    const navigate = useNavigate();
    const [genreMenuOpen, setGenreMenuOpen] = useState(false);
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

    useEffect(() => {
        if (!genreMenuOpen) return;

        const handleScrollClose = () => {
            setGenreMenuOpen(false);
        };

        window.addEventListener('scroll', handleScrollClose, { passive: true });
        return () => window.removeEventListener('scroll', handleScrollClose);
    }, [genreMenuOpen]);

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

    const pills = (
        <>
            <div className="w-[16px] shrink-0" />
            <button
                onClick={() => handlePillClick('/tv', isTvActive)}
                className={`flex items-center justify-center h-[54px] px-4 rounded-l-[27px] rounded-r-[14px] text-[14px] font-semibold whitespace-nowrap active:scale-95 transition-all leading-none shrink-0
                    ${isTvActive 
                        ? 'bg-white/[0.18] backdrop-blur-md text-white border border-white/25' 
                        : 'bg-white/[0.06] backdrop-blur-md text-[#e5e5e5] border border-white/10'}`}
            >
                Series
            </button>
            <button
                onClick={() => handlePillClick('/movies', isMovieActive)}
                className={`flex items-center justify-center h-[54px] px-4 rounded-[14px] text-[14px] font-semibold whitespace-nowrap active:scale-95 transition-all leading-none shrink-0
                    ${isMovieActive 
                        ? 'bg-white/[0.18] backdrop-blur-md text-white border border-white/25' 
                        : 'bg-white/[0.06] backdrop-blur-md text-[#e5e5e5] border border-white/10'}`}
            >
                Movies
            </button>
            <button
                onClick={() => handlePillClick('/new', isNewActive)}
                className={`flex items-center justify-center h-[54px] px-4 rounded-[14px] text-[14px] font-semibold whitespace-nowrap active:scale-95 transition-all leading-none shrink-0
                    ${isNewActive 
                        ? 'bg-white/[0.18] backdrop-blur-md text-white border border-white/25' 
                        : 'bg-white/[0.06] backdrop-blur-md text-[#e5e5e5] border border-white/10'}`}
            >
                New & Hot
            </button>
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
            <div className="w-[16px] shrink-0" />
        </>
    );

    const showTemp = scrollY >= 140 && subNavVisible;

    return (
        <>
            {genreMenuOpen && (
                <div 
                    className="fixed inset-0 z-[110] bg-black/0 cursor-default"
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

            {/* 1. Original sub-nav: absolute at the top, scrolls naturally with the page content */}
            <div className="absolute top-[calc(56px+env(safe-area-inset-top))] left-0 right-0 z-[78] pt-2 pb-4 flex items-center justify-start space-x-2 select-none bg-transparent overflow-x-auto scrollbar-hide max-w-full">
                {pills}
            </div>

            {/* 2. Temporary fixed sub-nav: fixed at top, slides down on scroll-up, slides up on scroll-down, with solid background */}
            <div
                style={{ backgroundColor: 'rgba(0, 0, 0, 1)' }}
                className={`fixed top-[calc(56px+env(safe-area-inset-top))] left-0 right-0 z-[79] pt-2 pb-4 flex items-center justify-start space-x-2 select-none overflow-x-auto scrollbar-hide max-w-full transition-all duration-300 ease-out ${
                    showTemp 
                        ? 'opacity-100 translate-y-0 pointer-events-auto' 
                        : '-translate-y-full opacity-0 pointer-events-none'
                }`}
            >
                {pills}
            </div>

            {/* Genres Dropdown Menu rendered via Portal to prevent clipping inside scroll container */}
            {genreMenuOpen && genres && genres.length > 0 && ReactDOM.createPortal(
                <div
                    className="fixed top-[calc(118px+env(safe-area-inset-top))] right-6 z-[115] animate-fadeIn"
                    role="listbox"
                >
                    <div className="w-[290px] sm:w-[330px] max-w-[calc(100vw-3rem)] max-h-[78vh] overflow-y-auto bg-black border border-white/10 rounded-lg py-4 px-6 shadow-2xl scrollbar-hide">
                        <div className="flex flex-col gap-y-4">
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
                                    className="text-left text-[18px] font-semibold py-2 transition-colors hover:text-white text-[#e5e5e5] active:scale-95 whitespace-nowrap"
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
