import React, { useState, useEffect, useRef } from 'react';
import { SpeakerSlashIcon, SpeakerHighIcon, ArrowCounterClockwiseIcon } from '@phosphor-icons/react';
import HeroMoreInfoButton from './HeroMoreInfoButton';
import { useTranslation } from 'react-i18next';
import { Movie } from '../types';
import CinemaPlayButton from './CinemaPlayButton';
import { MaturityBadge } from './MovieCardBadges';

interface HeroCarouselContentProps {
    movie: Movie;
    logoUrl: string | null;
    isVideoReady: boolean;
    onPlay: (movie: Movie) => void;
    onSelect: (movie: Movie, time?: number, videoId?: string) => void;
    trailerVideoId?: string;
    hasVideoEnded?: boolean;
    onImageLoad?: () => void;
    showMuteButton?: boolean;
    globalMute?: boolean;
    onMuteButtonClick?: () => void;
}

const HeroCarouselContent: React.FC<HeroCarouselContentProps> = ({
    movie,
    logoUrl,
    isVideoReady,
    onSelect,
    trailerVideoId,
    hasVideoEnded = false,
    onImageLoad,
    showMuteButton = false,
    globalMute = false,
    onMuteButtonClick,
}) => {
    const { t } = useTranslation();
    const [showDescription, setShowDescription] = useState(true);
    const [imgFailed, setImgFailed] = useState(false);
    const logoImgRef = useRef<HTMLImageElement>(null);

    useEffect(() => {
        if (logoImgRef.current?.complete) onImageLoad?.();
    }, [logoUrl, onImageLoad]);

    useEffect(() => setImgFailed(false), [logoUrl]);

    useEffect(() => {
        if (isVideoReady && !hasVideoEnded) {
            const timer = setTimeout(() => setShowDescription(false), 7000);
            return () => clearTimeout(timer);
        } else {
            setShowDescription(true);
        }
    }, [isVideoReady, hasVideoEnded]);

    const isShrunken = !showDescription && isVideoReady && !hasVideoEnded;

    return (
        <div className="absolute inset-0 z-20 pointer-events-none flex flex-col justify-end pb-[7%]">
            {/* Single full-width row: meta-layer left, controls right — same Y axis */}
            <div className="flex items-end justify-between px-[var(--app-x)]">

                {/* ── Left: meta-layer (logo + description + CTA buttons) ──── */}
                <div className="max-w-[60%] md:max-w-[52%] lg:max-w-[620px] flex flex-col justify-end gap-3 md:gap-4 pointer-events-auto">

                    {/* Logo / title */}
                    <div className={`relative flex items-end transition-transform duration-700 origin-bottom-left ${isShrunken ? 'scale-[0.65] sm:scale-[0.7]' : ''}`}>
                        {logoUrl && !imgFailed ? (
                            <img
                                ref={logoImgRef}
                                src={logoUrl}
                                alt={movie?.name || movie?.title || 'title logo'}
                                className="object-contain object-bottom drop-shadow-xl"
                                style={{ maxHeight: 'clamp(85px, 20vw, 210px)', maxWidth: '100%' }}
                                onLoad={onImageLoad}
                                onError={() => setImgFailed(true)}
                            />
                        ) : (
                            <h1 className="text-3xl sm:text-5xl md:text-6xl font-black font-leaner drop-shadow-xl leading-none text-white tracking-wide uppercase">
                                {movie?.name || movie?.title || ''}
                            </h1>
                        )}
                    </div>

                    {/* Description */}
                    <div className={`transition-[opacity,max-height] duration-500 ease-in-out overflow-hidden ${isShrunken ? 'opacity-0 max-h-0' : 'opacity-100 max-h-40'}`}>
                        <p className={`max-w-sm md:max-w-md text-[12px] sm:text-[13px] md:text-[15px] font-medium text-white/90 line-clamp-2 md:line-clamp-3 leading-relaxed ${['ar', 'he'].includes(t('lang', { defaultValue: 'en' }).split('-')[0]) ? 'text-right' : ''}`}>
                            {movie?.overview}
                        </p>
                    </div>

                    {/* CTA buttons */}
                    <div className="flex items-center flex-wrap gap-2 md:gap-3">
                        <CinemaPlayButton movie={movie} variant="rectangular" />
                        <HeroMoreInfoButton
                            movie={movie}
                            onSelect={onSelect}
                            trailerVideoId={trailerVideoId}
                        />
                    </div>
                </div>

                {/* ── Right: mute toggle + maturity badge — same Y as CTA buttons ── */}
                <div className="flex items-center pointer-events-auto flex-shrink-0">
                    {showMuteButton && (
                        <button
                            onClick={onMuteButtonClick}
                            className="w-9 h-9 border-[1.8px] border-white/70 rounded-full flex items-center justify-center transition-colors duration-200 hover:bg-white/15"
                            aria-label={hasVideoEnded ? t('hero.replay') : globalMute ? t('hero.unmute') : t('hero.mute')}
                        >
                            {hasVideoEnded
                                ? <ArrowCounterClockwiseIcon size={20} className="text-white" />
                                : globalMute
                                    ? <SpeakerSlashIcon size={20} className="text-white" />
                                    : <SpeakerHighIcon size={20} className="text-white" />
                            }
                        </button>
                    )}
                    <div className="flex items-center bg-[#2e2e2e]/40 h-10 pl-4 -mr-14 lg:-mr-16 pr-14 lg:pr-16 ml-3 border-l-[3px] border-white/40">
                        <MaturityBadge adult={movie.adult} voteAverage={movie.vote_average} certification={movie.certification} size="md" />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HeroCarouselContent;
