import React, { useState, useEffect } from 'react';
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
 * Single recommendation card — matches the Netflix "More Like This" design.
 *
 * Logo sizing strategy (user requirement):
 *   Each card fetches its title logo from TMDB independently.
 *   The logo renders at a fixed height (h-10) with object-contain so the
 *   natural aspect ratio is preserved — a wide Batman-style logo stays wide,
 *   a tall two-line logo stays compact. No forced squishing.
 *   While fetching: skeleton shimmer. If no logo exists: plain text title.
 */
const RecCard: React.FC<RecCardProps> = ({ rec, onClick }) => {
    const { myList, toggleList } = useGlobalContext();

    // null  = loading, '' = no logo found, '/path' = found
    const [logoPath, setLogoPath] = useState<string | null>(null);
    const [logoFailed, setLogoFailed] = useState(false);
    const [logoLoading, setLogoLoading] = useState(true);

    const isAdded = !!myList.find(m => m.id === rec.id);
    const mediaType = (rec.media_type || (rec.title ? 'movie' : 'tv')) as 'movie' | 'tv';
    const year = (rec.release_date || rec.first_air_date)?.substring(0, 4) || '';
    const title = rec.title || rec.name || '';

    // Season / runtime badge
    const durationBadge = rec.number_of_seasons
        ? `${rec.number_of_seasons} Season${rec.number_of_seasons > 1 ? 's' : ''}`
        : rec.runtime
        ? `${Math.floor(rec.runtime / 60)}h ${rec.runtime % 60}m`
        : mediaType === 'tv' ? 'Series' : '';

    // Fetch title logo from TMDB
    useEffect(() => {
        let cancelled = false;
        setLogoPath(null);
        setLogoFailed(false);
        setLogoLoading(true);
        getMovieImages(rec.id, mediaType)
            .then(images => {
                if (cancelled) return;
                const logo = images?.logos?.find(
                    (l: any) => l.iso_639_1 === 'en' || l.iso_639_1 === null
                );
                setLogoPath(logo ? `${TMDB_IMG}/w300${logo.file_path}` : '');
            })
            .catch(() => { if (!cancelled) setLogoPath(''); })
            .finally(() => { if (!cancelled) setLogoLoading(false); });
        return () => { cancelled = true; };
    }, [rec.id, mediaType]);

    const backdrop = rec.backdrop_path
        ? `${TMDB_IMG}/w500${rec.backdrop_path}`
        : rec.poster_path
        ? `${TMDB_IMG}/w500${rec.poster_path}`
        : null;

    const stopProp = (e: React.MouseEvent) => e.stopPropagation();

    const hasLogo = !logoLoading && logoPath && !logoFailed;
    const noLogo  = !logoLoading && (!logoPath || logoFailed);

    return (
        <div
            className="bg-[#2f2f2f] rounded-sm overflow-hidden shadow-lg cursor-pointer group hover:bg-[#3a3a3a] transition-colors duration-200"
            onClick={onClick}
        >
            {/* ── Image area ─────────────────────────────────────────── */}
            <div className="relative aspect-video bg-[#1a1a1a] overflow-hidden">
                {backdrop ? (
                    <img
                        src={backdrop}
                        alt={title}
                        className="w-full h-full object-cover opacity-85 group-hover:opacity-100 group-hover:scale-[1.02] transition-all duration-300"
                        loading="lazy"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-[#222]" />
                )}

                {/* Gradient so text/logo is readable over any backdrop */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent pointer-events-none" />

                {/* Top-right: duration / season badge */}
                {durationBadge && (
                    <div className="absolute top-2 right-2 text-white text-[11px] font-semibold drop-shadow-md bg-black/50 px-1.5 py-0.5 rounded-[2px]">
                        {durationBadge}
                    </div>
                )}

                {/* Bottom-left: logo or title text */}
                <div className="absolute bottom-2 left-2 right-2 max-w-[75%]">
                    {/* Shimmer while logo is loading */}
                    {logoLoading && (
                        <div className="h-8 w-24 rounded bg-white/10 animate-pulse" />
                    )}

                    {/* Logo image — fixed height, natural width (object-contain) */}
                    {hasLogo && (
                        <img
                            src={logoPath!}
                            alt={title}
                            className="h-9 max-w-full object-contain object-left-bottom drop-shadow-lg"
                            style={{ maxHeight: '40px' }}
                            onError={() => setLogoFailed(true)}
                        />
                    )}

                    {/* Text fallback — only if no logo was found at all */}
                    {noLogo && (
                        <p className="text-white font-bold text-sm leading-tight drop-shadow-md line-clamp-2">
                            {title}
                        </p>
                    )}
                </div>
            </div>

            {/* ── Card body ──────────────────────────────────────────── */}
            <div className="p-3">
                <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                        {/* Maturity badge — same component as MovieCard & InfoModal */}
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

                    {/* +List button — stops propagation so click doesn't open the modal */}
                    <button
                        onClick={(e) => { stopProp(e); toggleList(rec); }}
                        title={isAdded ? 'Remove from My List' : 'Add to My List'}
                        className={`shrink-0 w-7 h-7 rounded-full border-2 flex items-center justify-center
                            transition-all duration-150 hover:scale-110 active:scale-95
                            ${isAdded
                                ? 'border-white bg-white/10 text-white'
                                : 'border-gray-500 text-gray-400 hover:border-white hover:text-white'
                            }`}
                    >
                        {isAdded
                            ? <CheckIcon size={13} weight="bold" />
                            : <PlusIcon  size={13} weight="bold" />
                        }
                    </button>
                </div>

                {/* Overview */}
                <p className="text-[#bbb] text-[12px] leading-relaxed line-clamp-3">
                    {rec.overview || 'No description available.'}
                </p>
            </div>
        </div>
    );
};

/* ─── Main section ────────────────────────────────────────────── */

interface InfoModalRecommendationsProps {
    recommendations: Movie[];
    onRecommendationClick: (rec: Movie) => void;
}

const InfoModalRecommendations: React.FC<InfoModalRecommendationsProps> = ({
    recommendations,
    onRecommendationClick,
}) => {
    const { t } = useTranslation();
    if (!recommendations?.length) return null;

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
