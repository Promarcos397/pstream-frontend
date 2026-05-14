import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { CaretUpIcon, CaretDownIcon, CheckIcon } from '@phosphor-icons/react';
import { Episode, Movie } from '../types';
import { IMG_PATH } from '../constants';
import { useGlobalContext } from '../context/GlobalContext';

interface InfoModalEpisodesProps {
    movie: Movie;
    mediaType: 'movie' | 'tv';
    episodes: Episode[];
    loadingEpisodes: boolean;
    selectedSeason: number;
    setSelectedSeason: (season: number) => void;
    onPlay: (movie: Movie, season?: number, episode?: number) => void;
    totalSeasons: number;
}

const BATCH_SIZE = 6; // episodes revealed per "Show More" press

const InfoModalEpisodes: React.FC<InfoModalEpisodesProps> = ({
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
    const { t, i18n } = useTranslation();
    const isRTL = ['ar', 'he'].includes(i18n.language.split('-')[0]);
    const { getEpisodeProgress } = useGlobalContext();

    // Reset visible count when season changes
    useEffect(() => {
        setVisibleCount(BATCH_SIZE);
    }, [selectedSeason]);

    // Close dropdown on click outside
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
    const remaining = episodes.length - visibleCount;

    return (
        <div className="mt-8">
            <div className="flex items-center justify-between mb-5">
                {/* 'Episodes' title */}
                <h3 className="text-xl md:text-2xl font-bold text-white tracking-tight">{t('modal.episodes')}</h3>

                {/* Season Dropdown */}
                {totalSeasons > 0 && (
                    <div className="relative" ref={dropdownRef}>
                        <button
                            onClick={() => setIsSeasonDropdownOpen(!isSeasonDropdownOpen)}
                            className="flex items-center bg-transparent border border-white/30 hover:border-white/70 rounded px-4 py-1.5 text-sm font-bold transition min-w-[130px] justify-between text-white"
                        >
                            {t('player.season')} {selectedSeason}
                            {isSeasonDropdownOpen ? <CaretUpIcon size={14} className="ml-2" /> : <CaretDownIcon size={14} className="ml-2" />}
                        </button>

                        {isSeasonDropdownOpen && (
                            <div className="absolute right-0 top-full mt-1 w-32 bg-[#242424] border border-gray-700 rounded shadow-xl z-50 max-h-60 overflow-y-auto scrollbar-hide">
                                {Array.from({ length: totalSeasons }, (_, i) => i + 1).map(s => (
                                    <div
                                        key={s}
                                        onClick={() => {
                                            setSelectedSeason(s);
                                            setIsSeasonDropdownOpen(false);
                                        }}
                                        className={`px-4 py-2 text-sm cursor-pointer hover:bg-[#404040] ${selectedSeason === s ? 'bg-[#333] font-bold text-white' : 'text-gray-300'}`}
                                    >
                                        {t('player.season')} {s}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Episode list — no fixed max-h, no scroll container */}
            <div className="space-y-1">
                {loadingEpisodes ? (
                    // Premium episode skeleton
                    <div className="space-y-2">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="flex items-start p-4 rounded-sm border-b border-white/5 gap-4">
                                <div className="w-8 h-5 bg-white/[0.06] rounded animate-pulse flex-shrink-0" />
                                <div className="w-28 md:w-36 h-16 md:h-20 bg-white/[0.06] rounded-sm animate-pulse flex-shrink-0" />
                                <div className="flex-1 space-y-2 py-1">
                                    <div className="h-3 bg-white/[0.08] rounded-full w-2/3 animate-pulse" />
                                    <div className="h-2.5 bg-white/[0.05] rounded-full w-full animate-pulse" />
                                    <div className="h-2.5 bg-white/[0.05] rounded-full w-4/5 animate-pulse" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : episodes.length > 0 ? (
                    <>
                        {visibleEpisodes.map((ep) => (
                            <div
                                key={ep.id}
                                onClick={() => onPlay(movie, selectedSeason, ep.episode_number)}
                                className="flex items-start group cursor-pointer p-4 rounded-sm hover:bg-[#2a2a2a] transition border-b border-white/5 last:border-0"
                            >
                                <div className="text-white/50 text-lg font-semibold w-8 text-center flex-shrink-0 mr-4 mt-1">
                                    {ep.episode_number}
                                </div>
                                <div className="relative w-28 h-16 md:w-36 md:h-20 bg-gray-800 flex-shrink-0 rounded-sm overflow-hidden mr-4">
                                    {ep.still_path ? (
                                        <img src={`${IMG_PATH}${ep.still_path}`} className="w-full h-full object-cover group-hover:brightness-50 transition duration-200" alt={ep.name} />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-600">{t('common.noImage')}</div>
                                    )}
                                    {/* Play circle */}
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="w-9 h-9 rounded-full bg-black/30 border border-white/60 flex items-center justify-center group-hover:bg-white/20 group-hover:scale-110 transition-all duration-200 shadow">
                                            <div className="w-0 h-0 ml-0.5" style={{ borderTop: '6px solid transparent', borderBottom: '6px solid transparent', borderLeft: '10px solid white' }} />
                                        </div>
                                    </div>
                                    {/* Per-episode progress bar */}
                                    {(() => {
                                        const prog = getEpisodeProgress(movie.id, selectedSeason, ep.episode_number);
                                        if (!prog || !prog.duration || prog.time < 5) return null;
                                        const pct = Math.min(100, (prog.time / prog.duration) * 100);
                                        const done = pct >= 95;
                                        return done ? (
                                            <div className="absolute top-1 right-1 bg-black/70 rounded-full p-0.5">
                                                <CheckIcon size={10} className="text-white" weight="bold" />
                                            </div>
                                        ) : (
                                            <div className="absolute bottom-0 left-0 w-full h-[3px] bg-white/20" style={{ borderRadius: 0 }}>
                                                <div className="h-full bg-[#e50914]" style={{ width: `${pct}%`, borderRadius: 0 }} />
                                            </div>
                                        );
                                    })()}
                                </div>
                                <div className="flex-1 min-w-0 py-0.5">
                                    <div className="flex items-center justify-between mb-1">
                                        <h4 className="text-white font-semibold text-sm md:text-base truncate pr-4">{ep.name}</h4>
                                        <span className="text-white/40 text-xs whitespace-nowrap flex-shrink-0">{ep.runtime ? `${ep.runtime}m` : ''}</span>
                                    </div>
                                    <p className={`text-white/60 text-xs md:text-sm line-clamp-2 leading-relaxed ${isRTL ? 'text-right' : ''}`} dir={isRTL ? 'rtl' : 'ltr'}>
                                        {ep.overview || t('common.noDesc')}
                                    </p>
                                </div>
                            </div>
                        ))}

                        {/* Circular chevron toggle — load more / collapse */}
                        {(hasMore || visibleCount > BATCH_SIZE) && (
                            <div className="flex justify-center mt-4">
                                <button
                                    onClick={() => {
                                        if (hasMore) {
                                            setVisibleCount(c => c + BATCH_SIZE);
                                        } else {
                                            setVisibleCount(BATCH_SIZE);
                                        }
                                    }}
                                    title={hasMore ? 'Show more episodes' : 'Show less'}
                                    className="w-10 h-10 rounded-full border border-white/20 bg-[#2a2a2a] hover:border-white/50 hover:bg-[#3a3a3a] flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95 group/btn"
                                >
                                    {hasMore
                                        ? <CaretDownIcon size={18} className="text-white/60 group-hover/btn:text-white transition-colors" />
                                        : <CaretUpIcon   size={18} className="text-white/60 group-hover/btn:text-white transition-colors" />
                                    }
                                </button>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="text-gray-500 text-center py-6">{t('common.noEpisodes')}</div>
                )}
            </div>
        </div>
    );
};

export default InfoModalEpisodes;
