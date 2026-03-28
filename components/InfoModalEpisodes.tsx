import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { CaretUpIcon, CaretDownIcon, PlayIcon } from '@phosphor-icons/react';
import { Episode, Movie } from '../types';
import { IMG_PATH } from '../constants';

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
        <div className="mt-10">
            <div className="flex items-center justify-between mb-4 border-b border-gray-700 pb-2">
                <h3 className="text-xl md:text-2xl font-bold text-white">{t('modal.episodes')}</h3>

                {/* Season Dropdown */}
                {totalSeasons > 0 && (
                    <div className="relative" ref={dropdownRef}>
                        <button
                            onClick={() => setIsSeasonDropdownOpen(!isSeasonDropdownOpen)}
                            className="flex items-center bg-[#242424] border border-gray-600 rounded px-3 py-1.5 text-sm font-bold hover:bg-[#333] transition min-w-[120px] justify-between"
                        >
                            {t('player.season')} {selectedSeason}
                            {isSeasonDropdownOpen ? <CaretUpIcon size={16} className="ml-2" /> : <CaretDownIcon size={16} className="ml-2" />}
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

            <div className="space-y-4 max-h-[400px] overflow-y-auto scrollbar-hide pr-2">
                {loadingEpisodes ? (
                    <div className="flex justify-center py-10"><div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div></div>
                ) : episodes.length > 0 ? (
                    episodes.map((ep) => (
                        <div
                            key={ep.id}
                            onClick={() => onPlay(movie, selectedSeason, ep.episode_number)}
                            className="flex items-center group cursor-pointer p-4 rounded-sm hover:bg-[#333] transition border-b border-gray-800 last:border-0"
                        >
                            <div className="text-gray-400 text-xl font-medium w-8 text-center flex-shrink-0 mr-4">
                                {ep.episode_number}
                            </div>
                            <div className="relative w-28 h-16 md:w-36 md:h-20 bg-gray-800 flex-shrink-0 rounded overflow-hidden mr-4">
                                {ep.still_path ? (
                                    <img src={`${IMG_PATH}${ep.still_path}`} className="w-full h-full object-cover" alt={ep.name} />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-600">{t('common.noImage')}</div>
                                )}
                                <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition" />
                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                                    <div className="bg-white/90 rounded-full p-1 shadow-lg">
                                        <PlayIcon size={16} weight="fill" className="text-black" />
                                    </div>
                                </div>
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-1">
                                    <h4 className="text-white font-bold text-sm md:text-base truncate pr-4">{ep.name}</h4>
                                    <span className="text-gray-400 text-xs whitespace-nowrap">{ep.runtime ? `${ep.runtime}m` : ''}</span>
                                </div>
                                <p className={`text-gray-400 text-xs md:text-sm line-clamp-2 leading-relaxed ${isRTL ? 'text-right' : ''}`} dir={isRTL ? 'rtl' : 'ltr'}>
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
