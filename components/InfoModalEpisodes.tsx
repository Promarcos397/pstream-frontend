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
    const dropdownRef = useRef<HTMLDivElement>(null);
    const { t, i18n } = useTranslation();
    const isRTL = ['ar', 'he'].includes(i18n.language.split('-')[0]);
    const { getEpisodeProgress } = useGlobalContext();

    // Close on click outside (dropdown)
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

    return (
        <div className="mt-8">
            <div className="flex items-center justify-between mb-5">
                {/* 'Episodes' title — no underline, no border, matches Netflix */}
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
                                        {selectedSeason === s && <span className="hidden">✓</span>}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="space-y-2 max-h-[480px] overflow-y-auto scrollbar-hide pr-1">
                {loadingEpisodes ? (
                    <div className="flex justify-center py-10"><div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div></div>
                ) : episodes.length > 0 ? (
                    episodes.map((ep) => (
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
                                {/* Play circle — always visible, brightens on hover */}
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="w-9 h-9 rounded-full bg-black/30 border border-white/60 flex items-center justify-center group-hover:bg-white/20 group-hover:scale-110 transition-all duration-200 shadow">
                                        <div className="w-0 h-0 ml-0.5" style={{ borderTop: '6px solid transparent', borderBottom: '6px solid transparent', borderLeft: '10px solid white' }} />
                                    </div>
                                </div>
                                {/* Per-episode progress bar — flat, Midnight Precision */}
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
                                            <div
                                                className="h-full bg-[#e50914]"
                                                style={{ width: `${pct}%`, borderRadius: 0 }}
                                            />
                                        </div>
                                    );
                                })()}
                            </div>
                            <div className="flex-1 min-w-0 py-0.5">
                                <div className="flex items-center justify-between mb-1">
                                    <h4 className="text-white font-semibold text-sm md:text-base truncate pr-4">{ep.name}</h4>
                                    <span className="text-white/40 text-xs whitespace-nowrap flex-shrink-0">{ep.runtime ? `${ep.runtime}m` : ''}</span>
                                </div>
                                <p className={`text-white/50 text-xs md:text-sm line-clamp-2 leading-relaxed ${isRTL ? 'text-right' : ''}`} dir={isRTL ? 'rtl' : 'ltr'}>
                                    {ep.overview || t('common.noDesc')}
                                </p>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="text-gray-500 text-center py-6">{t('common.noEpisodes')}</div>
                )}
            </div>
        </div>
    );
};

export default InfoModalEpisodes;
