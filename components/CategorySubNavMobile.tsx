import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Genre } from './CategorySubNav';

interface CategorySubNavMobileProps {
    title?: string;
    genres: Genre[];
    selectedGenre: Genre | null;
    onGenreSelect: (genre: Genre | null) => void;
    dropdownLabel?: string;
}

const CategorySubNavMobile: React.FC<CategorySubNavMobileProps> = ({
    title,
    genres,
    selectedGenre,
    onGenreSelect,
    dropdownLabel,
}) => {
    const { t } = useTranslation();
    const location = useLocation();
    const navigate = useNavigate();
    const [genreMenuOpen, setGenreMenuOpen] = useState(false);
    const [scrollY, setScrollY] = useState(0);
    const [subNavVisible, setSubNavVisible] = useState(false);
    const lastScrollY = useRef(0);
    const [shouldAnimate, setShouldAnimate] = useState(false);
    const initialPathname = useRef(location.pathname);

    useEffect(() => {
        if (location.pathname !== initialPathname.current) {
            setShouldAnimate(true);
        }
    }, [location.pathname]);

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

    const activeGenreLabel = selectedGenre ? selectedGenre.name : (dropdownLabel || t('nav.categories', { defaultValue: 'Categories' }));

    const isSubPage = isTvActive || isMovieActive || isNewActive;

    const pills = (
        <>
            <div className={`flex items-center gap-2 shrink-0 overflow-hidden ${
                shouldAnimate ? 'transition-all duration-300 ease-out' : 'transition-none'
            } ${
                isSubPage 
                    ? 'max-w-0 opacity-0 pointer-events-none' 
                    : 'max-w-[400px] opacity-100'
            }`}>
                <button
                    onClick={() => handlePillClick('/tv', isTvActive)}
                    className={`flex items-center justify-center h-[52px] sm:h-[56px] px-3.5 sm:px-5 rounded-l-[23px] rounded-r-[12px] text-[14px] sm:text-[15px] font-semibold whitespace-nowrap active:scale-95 transition-all leading-none shrink-0
                        ${isTvActive 
                            ? 'bg-white/[0.18] backdrop-blur-md text-white border-[1.6px] border-white/40' 
                            : 'bg-white/[0.06] backdrop-blur-md text-[#e5e5e5] border-[1.6px] border-white/15'}`}
                >
                    {t('nav.shows', { defaultValue: 'Series' })}
                </button>
                <button
                    onClick={() => handlePillClick('/movies', isMovieActive)}
                    className={`flex items-center justify-center h-[52px] sm:h-[56px] px-3.5 sm:px-5 rounded-[12px] text-[14px] sm:text-[15px] font-semibold whitespace-nowrap active:scale-95 transition-all leading-none shrink-0
                        ${isMovieActive 
                            ? 'bg-white/[0.18] backdrop-blur-md text-white border-[1.6px] border-white/40' 
                            : 'bg-white/[0.06] backdrop-blur-md text-[#e5e5e5] border-[1.6px] border-white/15'}`}
                >
                    {t('nav.movies', { defaultValue: 'Movies' })}
                </button>
                <button
                    onClick={() => handlePillClick('/new', isNewActive)}
                    className={`flex items-center justify-center h-[52px] sm:h-[56px] px-3.5 sm:px-5 rounded-[12px] text-[14px] sm:text-[15px] font-semibold whitespace-nowrap active:scale-95 transition-all leading-none shrink-0
                        ${isNewActive 
                            ? 'bg-white/[0.18] backdrop-blur-md text-white border-[1.6px] border-white/40' 
                            : 'bg-white/[0.06] backdrop-blur-md text-[#e5e5e5] border-[1.6px] border-white/15'}`}
                >
                    {t('nav.newPopular', { defaultValue: 'New & Hot' })}
                </button>
            </div>
            <div className="relative shrink-0">
                <button
                    onClick={selectedGenre ? () => handleGenreClick(null) : toggleMenu}
                    className={`flex items-center justify-center space-x-1 h-[52px] sm:h-[56px] px-3.5 sm:px-5 rounded-r-[23px] text-[14px] sm:text-[15px] font-semibold whitespace-nowrap active:scale-95 leading-none
                        ${shouldAnimate ? 'transition-all duration-300 ease-out' : 'transition-none'}
                        ${isSubPage ? 'rounded-l-[23px]' : 'rounded-l-[12px]'}
                        ${selectedGenre 
                            ? 'bg-white/[0.18] backdrop-blur-md text-white border-[1.6px] border-white/40' 
                            : 'bg-white/[0.06] backdrop-blur-md text-[#e5e5e5] border-[1.6px] border-white/15'}`}
                >
                    <span>{activeGenreLabel}</span>
                    {selectedGenre ? (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-3.5 h-3.5 opacity-80 ml-1">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 opacity-70 ml-1">
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
            <div className="absolute top-[calc(60px+env(safe-area-inset-top))] sm:top-[calc(16px+env(safe-area-inset-top))] left-0 right-0 sm:left-[72px] z-[78] pt-0 pb-[4px] flex items-center justify-start select-none bg-transparent overflow-x-auto scrollbar-hide max-w-full">
                <div className="w-full max-w-[440px] min-[500px]:w-full min-[500px]:max-w-[680px] mx-auto px-4 flex items-center justify-start gap-2 shrink-0 overflow-visible">
                    {pills}
                </div>
            </div>

            {/* 2. Temporary fixed sub-nav: fixed at top, slides down on scroll-up, slides up on scroll-down, with solid black background */}
            {ReactDOM.createPortal(
                <div
                    style={{ 
                        backgroundColor: '#000000'
                    }}
                    className={`fixed top-[calc(58px+env(safe-area-inset-top))] sm:top-0 left-0 right-0 sm:left-[144px] z-[79] pt-0 sm:pt-[calc(20px+env(safe-area-inset-top))] pb-[4px] flex items-center justify-start select-none max-w-full overflow-x-auto scrollbar-hide transition-all duration-300 ease-out ${
                        showTemp 
                            ? 'opacity-100 translate-y-0 pointer-events-auto' 
                            : '-translate-y-full opacity-0 pointer-events-none'
                    }`}
                >
                    <div className="w-full max-w-[440px] min-[500px]:w-full min-[500px]:max-w-[680px] mx-auto px-4 flex items-center justify-start gap-2 shrink-0 overflow-visible">
                        {pills}
                    </div>
                </div>,
                document.body
            )}

            {/* Genres Dropdown Menu rendered via Portal to prevent clipping inside scroll container */}
            {genreMenuOpen && genres && genres.length > 0 && ReactDOM.createPortal(
                <div
                    className={`fixed top-[calc(118px+env(safe-area-inset-top))] z-[10030] animate-fadeIn ${
                        isSubPage ? 'left-4' : 'right-4'
                    }`}
                    role="listbox"
                >
                    <div className="w-max min-w-[160px] max-w-[calc(100vw-3rem)] max-h-[85vh] overflow-y-auto bg-[#141414] border border-white/10 rounded-lg py-4 pl-4 pr-6 shadow-2xl scrollbar-hide">
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
                                    className="text-left text-[18px] font-semibold py-2 transition-colors hover:text-white text-white active:scale-95 whitespace-nowrap"
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
