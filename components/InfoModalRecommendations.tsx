import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { PlusIcon, CheckIcon, PlayIcon, CaretDownIcon, CaretUpIcon } from '@phosphor-icons/react';
import { Movie } from '../types';
import { getMovieImages } from '../services/api';
import { MaturityBadge } from './MovieCardBadges';
import { useGlobalContext } from '../context/GlobalContext';

const TMDB_IMG = 'https://image.tmdb.org/t/p';

interface RecCardProps {
    rec: Movie;
    onPlay: (rec: Movie) => void;
    onOpenModal: (rec: Movie) => void;
}

const RecCard: React.FC<RecCardProps> = ({ rec, onPlay, onOpenModal }) => {
    const { myList, toggleList } = useGlobalContext();

    // Three-state logo: null=loading | ''=not found | 'url'=found
    const [logoPath, setLogoPath] = useState<string | null>(null);
    const [logoDim, setLogoDim] = useState<{ ratio: number; isSquare: boolean }>({ ratio: 2, isSquare: false });
    const [logoFailed, setLogoFailed] = useState(false);
    const [logoLoading, setLogoLoading] = useState(true);

    const isAdded = !!myList.find(m => m.id === rec.id);
    const mediaType = (rec.media_type || (rec.title ? 'movie' : 'tv')) as 'movie' | 'tv';
    const year = (rec.release_date || rec.first_air_date)?.substring(0, 4) || '';
    const title = rec.title || rec.name || '';

    // Fetch title logo
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
                setLogoPath(logo ? `${TMDB_IMG}/w500${logo.file_path}` : '');
            })
            .catch(() => { if (!cancelled) setLogoPath(''); })
            .finally(() => { if (!cancelled) setLogoLoading(false); });
        return () => { cancelled = true; };
    }, [rec.id, mediaType]);

    const handleLogoLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
        const { naturalWidth, naturalHeight } = e.currentTarget;
        const ratio = naturalWidth / naturalHeight;
        setLogoDim({ ratio, isSquare: ratio < 1.35 });
    };

    // w780 backdrop for higher quality, poster fallback
    const backdrop = rec.backdrop_path
        ? `${TMDB_IMG}/w780${rec.backdrop_path}`
        : rec.poster_path
        ? `${TMDB_IMG}/w500${rec.poster_path}`
        : null;

    const hasLogo = !logoLoading && logoPath && !logoFailed;
    const noLogo  = !logoLoading && (!logoPath || logoFailed);

    const logoHeight = logoDim.isSquare ? 'max-h-10' : 'max-h-14';

    return (
        <div className="bg-[#2f2f2f] rounded-sm overflow-hidden shadow-lg group">

            {/* ── Image area — click → direct play ─────────────── */}
            <div
                className="relative aspect-video bg-[#1a1a1a] overflow-hidden cursor-pointer"
                onClick={() => onPlay(rec)}
            >
                {backdrop ? (
                    <img
                        src={backdrop}
                        alt={title}
                        // NO zoom animation, just a clean brightness lift on hover
                        className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity duration-300"
                        loading="lazy"
                    />
                ) : (
                    <div className="w-full h-full bg-[#222]" />
                )}

                {/* NO gradient overlay — clean image */}

                {/* Play icon overlay on hover — clean, no backdrop-blur */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                    <div className="w-11 h-11 rounded-full bg-black/50 border border-white/50 flex items-center justify-center">
                        <PlayIcon size={20} weight="fill" className="text-white ml-0.5" />
                    </div>
                </div>

                {/* Bottom-left: adaptive title logo */}
                <div className="absolute bottom-2 left-2 right-2 max-w-[78%]">
                    {logoLoading && (
                        <div className="h-9 w-20 rounded bg-white/10 animate-pulse" />
                    )}
                    {hasLogo && (
                        <img
                            src={logoPath!}
                            alt={title}
                            onLoad={handleLogoLoad}
                            className={`${logoHeight} max-w-full object-contain object-left-bottom drop-shadow-lg`}
                            onError={() => setLogoFailed(true)}
                        />
                    )}
                    {noLogo && (
                        <p className="text-white font-bold text-sm leading-tight drop-shadow-md line-clamp-2">
                            {title}
                        </p>
                    )}
                </div>
            </div>

            {/* ── Card body — click → open InfoModal ───────────── */}
            <div
                className="p-3 cursor-pointer hover:bg-[#3a3a3a] transition-colors duration-150"
                onClick={() => onOpenModal(rec)}
            >
                {/* Metadata row — wider tags, consistent with InfoModal */}
                <div className="flex items-center justify-between gap-2 mb-2.5">
                    <div className="flex items-center gap-2 flex-wrap">
                        <MaturityBadge adult={rec.adult} voteAverage={rec.vote_average} size="sm" />
                        {/* HD tag — matches InfoModal's badge style */}
                        <span className="border border-gray-400 px-1.5 py-0.5 text-[10px] rounded-[2px] text-gray-300 h-fit leading-none font-extrabold">
                            HD
                        </span>
                        {year && (
                            <span className="text-gray-300 text-xs font-medium px-0.5">{year}</span>
                        )}
                    </div>

                    {/* +/- List button — matches InfoModal's button size */}
                    <button
                        onClick={(e) => { e.stopPropagation(); toggleList(rec); }}
                        title={isAdded ? 'Remove from My List' : 'Add to My List'}
                        className={`shrink-0 w-8 h-8 rounded-full border-2 flex items-center justify-center
                            transition-all duration-150 hover:scale-110 active:scale-95
                            ${isAdded
                                ? 'border-white bg-white/10 text-white'
                                : 'border-gray-500 text-gray-400 hover:border-white hover:text-white'
                            }`}
                    >
                        {isAdded
                            ? <CheckIcon size={14} weight="bold" />
                            : <PlusIcon  size={14} weight="bold" />
                        }
                    </button>
                </div>

                {/* Overview — white/80, readable */}
                <p className="text-white/80 text-[12px] leading-relaxed line-clamp-5 min-h-[72px]">
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
    onPlay: (rec: Movie) => void;
}

const BATCH_REC = 9; // 3 rows of 3

const InfoModalRecommendations: React.FC<InfoModalRecommendationsProps> = ({
    recommendations,
    onRecommendationClick,
    onPlay,
}) => {
    const { t } = useTranslation();
    const [visibleCount, setVisibleCount] = useState(BATCH_REC);

    if (!recommendations?.length) return null;

    const visible = recommendations.slice(0, visibleCount);
    const hasMore = visibleCount < recommendations.length;
    const remaining = recommendations.length - visibleCount;

    return (
        <div className="mt-10">
            <h3 className="text-xl md:text-2xl font-bold text-white mb-5">
                {t('modal.similar', { defaultValue: 'More Like This' })}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                {visible.map(rec => (
                    <RecCard
                        key={rec.id}
                        rec={rec}
                        onPlay={onPlay}
                        onOpenModal={onRecommendationClick}
                    />
                ))}
            </div>

            {/* Circular chevron toggle — load more / collapse */}
            {(hasMore || visibleCount > BATCH_REC) && (
                <div className="flex justify-center mt-5">
                    <button
                        onClick={() => {
                            if (hasMore) {
                                setVisibleCount(c => c + BATCH_REC);
                            } else {
                                setVisibleCount(BATCH_REC);
                            }
                        }}
                        title={hasMore ? 'Show more' : 'Show less'}
                        className="w-10 h-10 rounded-full border border-white/20 bg-[#2a2a2a] hover:border-white/50 hover:bg-[#3a3a3a] flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95 group/btn"
                    >
                        {hasMore
                            ? <CaretDownIcon size={18} className="text-white/60 group-hover/btn:text-white transition-colors" />
                            : <CaretUpIcon   size={18} className="text-white/60 group-hover/btn:text-white transition-colors" />
                        }
                    </button>
                </div>
            )}
        </div>
    );
};

export default InfoModalRecommendations;
