import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { TicketIcon, PlayIcon } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { Movie } from '../types';
import { useIsInTheaters } from '../hooks/useIsInTheaters';

interface CinemaPlayButtonProps {
    movie: Movie;
    variant: 'rectangular' | 'circular';
    isCinemaOnly?: boolean; // Optional override, otherwise checked automatically
    onPlay?: (movie: Movie) => void;
    className?: string;
    label?: string; // Optional custom text for standard play button
    to?: string; // Optional custom link destination
}

const CinemaPlayButton: React.FC<CinemaPlayButtonProps> = ({
    movie,
    variant,
    isCinemaOnly: isCinemaOnlyOverride,
    onPlay,
    className = '',
    label,
    to
}) => {
    const { t } = useTranslation();
    const [isHovered, setIsHovered] = useState(false);
    
    // Check if cinema-only using the hook if override is not provided
    const isCinemaOnlyHook = useIsInTheaters(movie);
    const isCinemaOnly = isCinemaOnlyOverride !== undefined ? isCinemaOnlyOverride : isCinemaOnlyHook;

    if (!movie) return null;

    const isTV = movie.media_type === 'tv' || (!movie.media_type && !movie.title);
    const mediaType = isTV ? 'tv' : 'movie';
    const defaultWatchUrl = `/watch/${mediaType}/${movie.id}`;
    const watchUrl = to || defaultWatchUrl;

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onPlay) {
            e.preventDefault();
            onPlay(movie);
        }
    };

    // Standard play text
    const playLabel = label || t('hero.play', { defaultValue: 'Play' });

    // Gooey filter definition to render once per button
    const gooeyFilter = (
        <svg className="absolute w-0 h-0 pointer-events-none" aria-hidden="true">
            <defs>
                <filter id="liquid-goo-effect">
                    {/* Gaussian blur to melt shapes */}
                    <feGaussianBlur in="SourceGraphic" stdDeviation="4.8" result="blur" />
                    {/* Contrast matrix to sharpen the blurred borders back into a solid shape */}
                    <feColorMatrix
                        in="blur"
                        mode="matrix"
                        values="1 0 0 0 0  
                                0 1 0 0 0  
                                0 0 1 0 0  
                                0 0 0 20 -9"
                        result="goo"
                    />
                    <feBlend in="SourceGraphic" in2="goo" />
                </filter>
            </defs>
        </svg>
    );

    // Splashing liquid droplets that animate on hover
    const renderDroplets = () => {
        if (!isHovered) return null;

        return (
            <>
                {/* Droplet 1 (Left Splash) */}
                <motion.div
                    initial={{ x: 0, y: 0, scale: 0 }}
                    animate={{
                        x: [-2, -14, -18, -12],
                        y: [0, -3, -1, 4],
                        scale: [0.2, 1.2, 0.6, 0]
                    }}
                    transition={{
                        duration: 0.55,
                        ease: "easeOut",
                        times: [0, 0.3, 0.7, 1]
                    }}
                    className="absolute w-2 h-2 rounded-full bg-current pointer-events-none"
                />

                {/* Droplet 2 (Right Splash) */}
                <motion.div
                    initial={{ x: 0, y: 0, scale: 0 }}
                    animate={{
                        x: [2, 14, 18, 12],
                        y: [0, 2, -2, -4],
                        scale: [0.2, 1.2, 0.6, 0]
                    }}
                    transition={{
                        duration: 0.55,
                        ease: "easeOut",
                        times: [0, 0.3, 0.7, 1]
                    }}
                    className="absolute w-2.5 h-2.5 rounded-full bg-current pointer-events-none"
                />

                {/* Droplet 3 (Bottom-Center Drip) */}
                <motion.div
                    initial={{ x: 0, y: 0, scale: 0 }}
                    animate={{
                        x: [0, -1, 2, 0],
                        y: [2, 12, 16, 10],
                        scale: [0.2, 1.4, 0.8, 0]
                    }}
                    transition={{
                        duration: 0.6,
                        ease: "easeOut",
                        times: [0, 0.35, 0.75, 1]
                    }}
                    className="absolute w-2 h-2 rounded-full bg-current pointer-events-none"
                />
            </>
        );
    };

    // ── Variant A: Circular Button ──
    if (variant === 'circular') {
        if (!isCinemaOnly) {
            return (
                <Link
                    to={watchUrl}
                    onClick={handleClick}
                    className={`bg-white text-black rounded-full w-10 h-10 flex items-center justify-center hover:bg-neutral-200 transition-colors duration-150 shadow-md ${className}`}
                    title={playLabel}
                >
                    <PlayIcon size={24} weight="fill" className="ml-0.5" />
                </Link>
            );
        }

        // Cinema-Only morphing circular button
        return (
            <Link
                to={watchUrl}
                onClick={handleClick}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                className={`relative flex items-center justify-center rounded-full w-10 h-10 shadow-lg transition-colors duration-150 overflow-hidden
                    ${isHovered 
                        ? 'bg-white text-black' 
                        : 'bg-[#6d6d6e]/85 text-white hover:bg-neutral-500'
                    } ${className}`}
                title={t('hero.inTheaters', { defaultValue: 'In Theaters' })}
            >
                {gooeyFilter}
                
                {/* Liquid Morphing Icons Container */}
                <div 
                    style={{ filter: 'url(#liquid-goo-effect)' }} 
                    className="relative w-full h-full flex items-center justify-center text-current"
                >
                    {/* Ticket Icon (Rest State) */}
                    <motion.div
                        initial={false}
                        animate={isHovered 
                            ? { scale: 0.05, y: -6, opacity: 0 } 
                            : { scale: 1, y: 0, opacity: 1 }
                        }
                        transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1] }}
                        className="absolute flex items-center justify-center text-current"
                    >
                        <TicketIcon size={22} weight="fill" />
                    </motion.div>

                    {/* Play Icon (Hover State) */}
                    <motion.div
                        initial={false}
                        animate={isHovered 
                            ? { scale: 1, y: 0, opacity: 1 } 
                            : { scale: 0.05, y: 6, opacity: 0 }
                        }
                        transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1] }}
                        className="absolute flex items-center justify-center text-current"
                    >
                        <PlayIcon size={24} weight="fill" className="ml-0.5" />
                    </motion.div>

                    {/* Liquid splatters */}
                    {renderDroplets()}
                </div>
            </Link>
        );
    }

    // ── Variant B: Rectangular Button ──
    if (!isCinemaOnly) {
        return (
            <Link
                to={watchUrl}
                onClick={handleClick}
                className={`flex items-center justify-center bg-white text-black px-5 sm:px-8 h-[35px] md:h-[45px] rounded-[4px] font-bold hover:bg-white/80 transition-colors text-[15px] md:text-[18px] gap-2 shadow-lg ${className}`}
            >
                <PlayIcon size={22} weight="fill" className="text-black" />
                <span>{playLabel}</span>
            </Link>
        );
    }

    // Cinema-Only morphing rectangular button
    return (
        <Link
            to={watchUrl}
            onClick={handleClick}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className={`group/theater relative flex items-center justify-center overflow-hidden rounded-[4px] font-bold shadow-md transition-all duration-300
                ${isHovered 
                    ? 'bg-white text-black px-5 sm:px-7' 
                    : 'bg-[#6d6d6e]/50 text-white px-4 sm:px-6'
                } h-[35px] md:h-[45px] text-[15px] md:text-[18px] ${className}`}
            title={t('hero.inTheaters', { defaultValue: 'In Theaters' })}
        >
            {gooeyFilter}

            {/* Content Wrap */}
            <div className="flex items-center justify-center">
                {/* Liquid Morphing Icons Container */}
                <div 
                    style={{ filter: 'url(#liquid-goo-effect)' }} 
                    className="relative w-6 h-6 md:w-8 md:h-8 flex items-center justify-center text-current"
                >
                    {/* Ticket Icon (Rest State) */}
                    <motion.div
                        initial={false}
                        animate={isHovered 
                            ? { scale: 0.05, y: -6, opacity: 0 } 
                            : { scale: 1, y: 0, opacity: 1 }
                        }
                        transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1] }}
                        className="absolute flex items-center justify-center text-current"
                    >
                        <TicketIcon weight="fill" className="text-[20px] md:text-[25px]" />
                    </motion.div>

                    {/* Play Icon (Hover State) */}
                    <motion.div
                        initial={false}
                        animate={isHovered 
                            ? { scale: 1, y: 0, opacity: 1 } 
                            : { scale: 0.05, y: 6, opacity: 0 }
                        }
                        transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1] }}
                        className="absolute flex items-center justify-center text-current"
                    >
                        <PlayIcon weight="fill" className="text-[20px] md:text-[25px]" />
                    </motion.div>

                    {/* Liquid splatters */}
                    {renderDroplets()}
                </div>

                {/* Text Transition */}
                <div className="relative overflow-hidden h-6 flex items-center ml-2">
                    <AnimatePresence mode="wait">
                        {!isHovered ? (
                            <motion.span
                                key="theaters-txt"
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -12 }}
                                transition={{ duration: 0.25 }}
                                className="whitespace-nowrap"
                            >
                                {t('hero.inTheaters', { defaultValue: 'In Theaters' })}
                            </motion.span>
                        ) : (
                            <motion.span
                                key="play-txt"
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -12 }}
                                transition={{ duration: 0.25 }}
                                className="whitespace-nowrap"
                            >
                                {playLabel}
                            </motion.span>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </Link>
    );
};

export default CinemaPlayButton;
