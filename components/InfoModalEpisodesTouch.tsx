import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { CaretUpIcon, CaretDownIcon, CheckIcon, PlayIcon } from '@phosphor-icons/react';
import { Episode, Movie } from '../types';
import { useGlobalContext } from '../context/GlobalContext';

interface InfoModalEpisodesTouchProps {
    movie: Movie;
    mediaType: 'movie' | 'tv';
    episodes: Episode[];
    loadingEpisodes: boolean;
    selectedSeason: number;
    setSelectedSeason: (season: number) => void;
    onPlay: (movie: Movie, season?: number, episode?: number) => void;
    totalSeasons: number;
}

const BATCH_SIZE = 6;

const InfoModalEpisodesTouch: React.FC<InfoModalEpisodesTouchProps> = ({
    movie,
    mediaType,
    episodes,
    loadingEpisodes,
    selectedSeason,
    setSelectedSeason,
    onPlay,
    totalSeasons
}) => {
    const [isSeasonDropdownOpen, setIsSeasonDropdownOpen] = useState(false);
    const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const { t } = useTranslation();
    const { getEpisodeProgress } = useGlobalContext();

    useEffect(() => {
        setVisibleCount(BATCH_SIZE);
    }, [selectedSeason]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsSeasonDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    if (mediaType !== 'tv') return null;

    const visibleEpisodes = episodes.slice(0, visibleCount);
    const hasMore = visibleCount < episodes.length;

    return (
        <div className="mt-4">
            {/* Season Selector Button */}
            {totalSeasons > 0 && (
                <div className="relative mb-5" ref={dropdownRef}>
                    <button
                        onClick={() => setIsSeasonDropdownOpen(!isSeasonDropdownOpen)}
                        className="flex items-center bg-[#2a2a2a] border border-white/10 rounded-[4px] px-4 py-2 text-sm font-extrabold transition min-w-[140px] justify-between text-white"
                    >
                        <span>{t('player.season')} {selectedSeason}</span>
                        {isSeasonDropdownOpen ? <CaretUpIcon size={16} className="ml-2 text-white/70" weight="bold" /> : <CaretDownIcon size={16} className="ml-2 text-white/70" weight="bold" />}
                    </button>

                    {isSeasonDropdownOpen && (
                        <div className="absolute left-0 top-full mt-1 w-44 bg-[#1e1e1e] border border-white/10 rounded-[6px] shadow-2xl z-50 max-h-64 overflow-y-auto scrollbar-hide py-1 animate-in fade-in slide-in-from-top-2 duration-200">
                            {Array.from({ length: totalSeasons }, (_, i) => i + 1).map(s => (
                                <button
                                    key={s}
                                    onClick={() => {
                                        setSelectedSeason(s);
                                        setIsSeasonDropdownOpen(false);
                                    }}
                                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${selectedSeason === s ? 'bg-[#333333] font-black text-white' : 'text-gray-300 hover:bg-white/5'}`}
                                >
                                    {t('player.season')} {s}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Episode List */}
            <div className="space-y-6">
                {loadingEpisodes ? (
                    <div className="space-y-5">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="flex flex-col gap-y-2 border-b border-white/5 pb-4 last:border-0">
                                <div className="flex items-center gap-3">
                                    <div className="w-32 aspect-video bg-white/[0.06] rounded-[4px] animate-pulse flex-shrink-0" />
                                    <div className="flex-1 space-y-2 py-1">
                                        <div className="h-4 bg-white/[0.08] rounded-full w-2/3 animate-pulse" />
                                        <div className="h-3 bg-white/[0.05] rounded-full w-1/3 animate-pulse" />
                                    </div>
                                </div>
                                <div className="h-3 bg-white/[0.05] rounded-full w-full animate-pulse mt-1" />
                                <div className="h-3 bg-white/[0.05] rounded-full w-4/5 animate-pulse" />
                            </div>
                        ))}
                    </div>
                ) : episodes.length > 0 ? (
                    <>
                        {visibleEpisodes.map((ep) => {
                            const prog = getEpisodeProgress(movie.id, selectedSeason, ep.episode_number);
                            const hasProg = prog && prog.duration && prog.time >= 5;
                            const pct = hasProg ? Math.min(100, (prog.time / prog.duration) * 100) : 0;
                            const isDone = pct >= 95;

                            return (
                                <div
                                    key={ep.id}
                                    onClick={() => onPlay(movie, selectedSeason, ep.episode_number)}
                                    className="flex flex-col pb-5 border-b border-white/[0.06] last:border-0"
                                >
                                    {/* Main Row: Still + Title Info */}
                                    <div className="flex items-center gap-x-3.5 cursor-pointer">
                                        {/* Still Image Container */}
                                        <div className="relative w-32 aspect-video bg-zinc-900 rounded-[4px] overflow-hidden flex-shrink-0 shadow-md">
                                            {ep.still_path ? (
                                                <img
                                                    src={
                                                        ep.still_path.startsWith('http') ||
                                                        ep.still_path.startsWith('/assets') ||
                                                        ep.still_path.includes('/404_assets') ||
                                                        ep.still_path.startsWith('data:')
                                                            ? ep.still_path
                                                            : `https://image.tmdb.org/t/p/w300${ep.still_path}`
                                                    }
                                                    className="w-full h-full object-cover"
                                                    alt={ep.name}
                                                    loading="lazy"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center bg-zinc-850 text-[10px] text-zinc-500 font-bold uppercase">{t('common.noImage')}</div>
                                            )}

                                            {/* Play Icon Overlay */}
                                            <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                                                <div className="w-9 h-9 rounded-full bg-black/40 border border-white/60 flex items-center justify-center active:scale-95 transition-transform shadow-md">
                                                    <PlayIcon size={18} weight="fill" className="text-white ml-0.5" />
                                                </div>
                                            </div>

                                            {/* Progress Bar or Checkmark */}
                                            {hasProg && (
                                                isDone ? (
                                                    <div className="absolute top-1.5 right-1.5 bg-black/75 rounded-full p-0.5">
                                                        <CheckIcon size={10} className="text-white" weight="bold" />
                                                    </div>
                                                ) : (
                                                    <div className="absolute bottom-0 left-0 w-full h-[3px] bg-white/20">
                                                        <div className="h-full bg-[#e50914]" style={{ width: `${pct}%` }} />
                                                    </div>
                                                )
                                            )}
                                        </div>

                                        {/* Right Side: Ep Number, Title, Runtime */}
                                        <div className="flex-1 min-w-0 flex flex-col gap-y-0.5 justify-center py-1">
                                            <h4 className="text-white font-extrabold text-[14px] leading-snug line-clamp-2">
                                                {ep.episode_number}. {ep.name}
                                            </h4>
                                            <span className="text-[#a3a3a3] text-[12px] font-bold">
                                                {ep.runtime ? `${ep.runtime}m` : ''}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Sub-row: Episode Overview/Description */}
                                    <p className="text-white/60 text-[12.5px] leading-[1.6] mt-2.5 font-normal select-text line-clamp-3">
                                        {ep.overview || t('common.noDesc')}
                                    </p>
                                </div>
                            );
                        })}

                        {/* Pagination Trigger */}
                        {hasMore && (
                            <button
                                onClick={() => setVisibleCount(c => c + BATCH_SIZE)}
                                className="w-full h-11 bg-[#2a2a2a] hover:bg-[#333333] border border-white/5 text-white rounded-[4px] text-[13.5px] font-extrabold transition active:scale-[0.98] mt-2"
                            >
                                Show More Episodes
                            </button>
                        )}
                    </>
                ) : (
                    <div className="text-zinc-500 text-center py-8 font-bold text-sm">{t('common.noEpisodes')}</div>
                )}
            </div>
        </div>
    );
};

export default React.memo(InfoModalEpisodesTouch);
