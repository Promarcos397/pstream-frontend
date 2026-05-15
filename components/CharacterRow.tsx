import React, { useEffect, useState, useRef } from 'react';
import { CaretLeftIcon, CaretRightIcon } from '@phosphor-icons/react';
import { animate } from 'framer-motion';
import { Movie } from '../types';
import { getMovieDetails } from '../services/api';
import { IMG_PATH } from '../constants';

const KIDS_SHOW_IDS = [
    17097, 48433, 1064, 116348, 110906, 65334, 75788, 60572, 116135, 202613, 153520,
    71225, 40075, 59427, 27834,
];

interface CharacterRowProps {
    onSelectMovie: (movie: Movie) => void;
    title?: string;
}

const CharacterRow: React.FC<CharacterRowProps> = ({ onSelectMovie, title = "Characters" }) => {
    const [characters, setCharacters] = useState<Movie[]>([]);
    const rowRef = useRef<HTMLDivElement>(null);
    const [isHovered, setIsHovered] = useState(false);

    useEffect(() => {
        const fetchCharacters = async () => {
            try {
                const promises = KIDS_SHOW_IDS.map(id => getMovieDetails(id, 'tv'));
                const results = await Promise.all(promises);

                const validShows = results.filter(res => res && res.id).map(res => ({
                    ...res,
                    media_type: 'tv'
                }));
                setCharacters(validShows as Movie[]);
            } catch (err) {
                console.error("Failed to load character shows:", err);
            }
        };
        fetchCharacters();
    }, []);

    const handleClick = (direction: 'left' | 'right') => {
        if (!rowRef.current) return;
        const container = rowRef.current;
        const cards = container.querySelectorAll('.group\\/char');
        if (cards.length === 0) return;

        const firstCard = cards[0] as HTMLElement;
        const style = window.getComputedStyle(firstCard);
        const marginRight = parseFloat(style.marginRight) || 0;
        const step = firstCard.offsetWidth + marginRight;

        const visibleWidth = container.clientWidth;
        const amount = Math.max(1, Math.floor(visibleWidth / step)) * step;

        const oneSetWidth = characters.length * step;
        let rawTarget = direction === 'right'
            ? container.scrollLeft + amount
            : container.scrollLeft - amount;

        // --- Infinity Warping Logic ---
        if (direction === 'left' && rawTarget < 0) {
            container.scrollLeft += oneSetWidth;
            rawTarget += oneSetWidth;
        }
        else if (direction === 'right' && rawTarget > oneSetWidth * 2) {
            container.scrollLeft -= oneSetWidth;
            rawTarget -= oneSetWidth;
        }

        // Snap to nearest card
        const target = Math.round(rawTarget / step) * step;

        animate(container.scrollLeft, target, {
            type: "spring",
            stiffness: 100,
            damping: 20,
            onUpdate: (val) => {
                container.scrollLeft = val;
            }
        });
    };

    const handleManualScroll = () => {
        if (!rowRef.current || characters.length === 0) return;
        const container = rowRef.current;
        const firstCard = container.querySelector('.group\\/char') as HTMLElement | null;
        if (!firstCard) return;

        const style = window.getComputedStyle(firstCard);
        const marginRight = parseFloat(style.marginRight) || 0;
        const step = firstCard.offsetWidth + marginRight;
        const oneSetWidth = characters.length * step;

        if (container.scrollLeft > oneSetWidth * 2) {
            container.scrollLeft -= oneSetWidth;
        } else if (container.scrollLeft < 0) {
            container.scrollLeft += oneSetWidth;
        }
    };

    if (characters.length === 0) return null;

    return (
        <div className="pl-6 md:pl-14 lg:pl-20 py-4"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}>
            <h2 className="text-white text-lg md:text-xl font-bold mb-4 drop-shadow-sm px-2">
                {title}
            </h2>

            <div className="relative group/row">
                {/* Left Scroll Arrow */}
                <div
                    className={`absolute top-0 bottom-0 left-0 z-40 bg-black/60 w-6 md:w-14 lg:w-20 items-center justify-center cursor-pointer transition-opacity duration-300 ${isHovered ? 'flex opacity-100 hover:bg-black/80' : 'hidden opacity-0'}`}
                    onClick={() => handleClick('left')}
                >
                    <CaretLeftIcon className="text-white h-8 w-8 transition-transform hover:scale-125" />
                </div>

                {/* Scrolling Container */}
                <div
                    ref={rowRef}
                    onScroll={handleManualScroll}
                    className="flex items-center space-x-0 overflow-x-auto overflow-y-visible scrollbar-hide py-6 pr-10"
                >
                    {[...characters, ...characters, ...characters].map((show, idx) => (
                        <div
                            key={`${show.id}-${idx}`}
                            onClick={() => onSelectMovie(show)}
                            className="flex-shrink-0 cursor-pointer flex flex-col items-center group/char w-32 sm:w-36 md:w-44 lg:w-48 mr-4 md:mr-6"
                        >
                            <div className="w-full aspect-square rounded-full overflow-hidden border-[3px] border-transparent group-hover/char:border-white transition-all duration-300 bg-[#222] shadow-[0_4px_10px_rgba(0,0,0,0.5)] group-hover/char:shadow-[0_0_25px_rgba(255,255,255,0.6)] relative z-10">
                                <img
                                    src={`${IMG_PATH}${show.poster_path}`}
                                    alt={show.name}
                                    className="w-full h-full object-cover object-top scale-[1.15] group-hover/char:scale-[1.4] transition-transform duration-500 ease-out"
                                    loading="lazy"
                                    draggable={false}
                                />
                            </div>
                        </div>
                    ))}
                </div>

                {/* Right Scroll Arrow */}
                <div
                    className={`absolute top-0 bottom-0 right-0 z-40 bg-black/60 w-6 md:w-14 lg:w-20 items-center justify-center cursor-pointer transition-opacity duration-300 ${isHovered ? 'flex opacity-100 hover:bg-black/80' : 'hidden opacity-0'}`}
                    onClick={() => handleClick('right')}
                >
                    <CaretRightIcon className="text-white h-8 w-8 transition-transform hover:scale-125" />
                </div>
            </div>
        </div>
    );
};

export default CharacterRow;
