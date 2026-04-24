import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { PlusIcon, CheckIcon } from '@phosphor-icons/react';
import { Movie } from '../types';
import { getMovieImages } from '../services/api';
import { MaturityBadge } from './MovieCardBadges';
import { useGlobalContext } from '../context/GlobalContext';

const TMDB_IMG = 'https://image.tmdb.org/t/p';

interface RecCardProps {
    rec: Movie;
    onClick: () => void;
}

/**
 * A single recommendation card.
 * Mirrors the Netflix "More Like This" card design from the screenshot:
 * - Backdrop image fills the top, with a season/episode/runtime badge in the top-right
 * - Title logo overlaid bottom-left of image (falls back to text title)
 * - Below: maturity badge + year + HD + +list button
 * - Overview text (2 lines)
 *
 * Logo aspect-ratio adaptation:
 *   The title logo is rendered inside a fixed height container (h-10 md:h-12).
 *   `object-contain` keeps the aspect ratio intact — wide logos like Batman's
 *   stay wide, tall stacked logos stay compact. No forced squishing.
 */
const RecCard: React.FC<RecCardProps> = ({ rec, onClick }) => {
    const { myList, toggleList } = useGlobalContext();
    const [logoUrl, setLogoUrl] = useState<string | null>(null);
    const [logoFailed, setLogoFailed] = useState(false);
    const isAdded = !!myList.find(m => m.id === rec.id);
    const mediaType = (rec.media_type || (rec.title ? 'movie' : 'tv')) as 'movie' | 'tv';
    const year = (rec.release_date || rec.first_air_date)?.substring(0, 4) || '';
    const title = rec.title || rec.name || '';

    // Duration badge — seasons or runtime
    const durationBadge = rec.number_of_seasons
        ? `${rec.number_of_seasons} Season${rec.number_of_seasons > 1 ? 's' : ''}`
        : rec.runtime
        ? `${Math.floor(rec.runtime / 60)}h ${rec.runtime % 60}m`
        : mediaType === 'tv' ? 'Series' : null;

    // Fetch logo for this rec
    useEffect(() => {
        let cancelled = false;
        getMovieImages(rec.id, mediaType).then(images => {
            if (cancelled || !images?.logos?.length) return;
            const logo = images.logos.find((l: any) => l.iso_639_1 === 'en' || l.iso_639_1 === null);
            if (logo) setLogoUrl(`${TMDB_IMG}/w300${logo.file_path}`);
        }).catch(() => {});
        return () => { cancelled = true; };
    }, [rec.id, mediaType]);

    const backdrop = rec.backdrop_path
        ? `${TMDB_IMG}/w500${rec.backdrop_path}`
        : rec.poster_path
        ? `${TMDB_IMG}/w500${rec.poster_path}`
        : null;

    const handleAddClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        toggleList(rec);
    };

    return (
        <div
            className="bg-[#2f2f2f] rounded-sm overflow-hidden shadow-lg cursor-pointer group hover:bg-[#3a3a3a] transition-colors duration-200"
            onClick={onClick}
        >
            {/* Image area */}
            <div className="relative aspect-video bg-[#1a1a1a] overflow-hidden">
                {backdrop ? (
                    <img
                        src={backdrop}
                        alt={title}
                        className="w-full h-full object-cover opacity-85 group-hover:opacity-100 group-hover:scale-[1.02] transition-all duration-300"
                        loading="lazy"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-[#222]">
                        <span className="text-gray-600 text-xs">No image</span>
                    </div>
                )}

                {/* Top-right: duration / season badge */}
                {durationBadge && (
                    <div className="absolute top-2 right-2 text-white text-[11px] font-semibold drop-shadow-md bg-black/40 backdrop-blur-[2px] px-1.5 py-0.5 rounded-[2px]">
                        {durationBadge}
                    </div>
                )}

                {/* Bottom-left: title logo (adaptive width, fixed height) */}
                <div className="absolute bottom-2 left-2 max-w-[70%]">
                    {logoUrl && !logoFailed ? (
                        <img
                            src={logoUrl}
                            alt={title}
                            // Fixed container height — object-contain keeps aspect ratio.
                            // max-w-full means wide logos (Batman) stay wide, tall logos stay compact.
                            className="h-9 md:h-11 max-w-full object-contain object-bottom-left drop-shadow-lg"
                            style={{ maxHeight: '44px' }}
                            onError={() => setLogoFailed(true)}
                        />
                    ) : (
                        <p className="text-white font-bold text-sm leading-tight drop-shadow-md line-clamp-2">
                            {title}
                        </p>
                    )}
                </div>
            </div>

            {/* Card body */}
            <div className="p-3">
                <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                        {/* Maturity badge — same component as MovieCard */}
                        <MaturityBadge
                            adult={rec.adult}
                            voteAverage={rec.vote_average}
                            size="sm"
                        />
                        {/* HD pill */}
                        <span className="border border-gray-500 px-1 py-px text-[9px] rounded-[2px] text-gray-400 font-bold leading-none">
                            HD
                        </span>
                        {/* Year */}
                        {year && (
                            <span className="text-gray-400 text-xs font-medium">{year}</span>
                        )}
                    </div>

                    {/* +List button */}
                    <button
                        onClick={handleAddClick}
                        title={isAdded ? 'Remove from My List' : 'Add to My List'}
                        className={`shrink-0 w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all duration-150 hover:scale-110 active:scale-95
                            ${isAdded
                                ? 'border-white bg-white/10 text-white'
                                : 'border-gray-500 text-gray-400 hover:border-white hover:text-white'
                            }`}
                    >
                        {isAdded ? <CheckIcon size={13} weight="bold" /> : <PlusIcon size={13} weight="bold" />}
                    </button>
                </div>

                {/* Overview */}
                <p className="text-[#ccc] text-[12px] leading-relaxed line-clamp-3">
                    {rec.overview || 'No description available.'}
                </p>
            </div>
        </div>
    );
};

/* ─── Main component ──────────────────────────────────────────── */

interface InfoModalRecommendationsProps {
    recommendations: Movie[];
    onRecommendationClick: (rec: Movie) => void;
}

const InfoModalRecommendations: React.FC<InfoModalRecommendationsProps> = ({
    recommendations,
    onRecommendationClick,
}) => {
    const { t } = useTranslation();
    if (!recommendations || recommendations.length === 0) return null;

    return (
        <div className="mt-10">
            <h3 className="text-xl md:text-2xl font-bold text-white mb-5">
                {t('modal.similar', { defaultValue: 'More Like This' })}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                {recommendations.map(rec => (
                    <RecCard
                        key={rec.id}
                        rec={rec}
                        onClick={() => onRecommendationClick(rec)}
                    />
                ))}
            </div>
        </div>
    );
};

export default InfoModalRecommendations;
