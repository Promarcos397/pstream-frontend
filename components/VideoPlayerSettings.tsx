import React, { useRef, useEffect, useState, useMemo } from 'react';
import { Episode } from '../types';
import { ArrowLeftIcon, CaretDownIcon, PlayCircleIcon, CheckIcon, CaretRightIcon, XIcon } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { useGlobalContext } from '../context/GlobalContext';
import { useIsMobile } from '../hooks/useIsMobile';

interface PopupPanelProps {
    title: string;
    onBack?: () => void;
    onClose: () => void;
    children: React.ReactNode;
    headerContent?: React.ReactNode;
}

const MinimalPanel: React.FC<{
    onClose: () => void;
    onHover?: () => void;
    children: React.ReactNode;
}> = ({ onClose, onHover, children }) => {
    const isMobile = useIsMobile();
    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 md:p-0 pointer-events-none">
            <div className="absolute inset-0 bg-black/40 pointer-events-auto" onClick={onClose} />
            <div
                className={`${isMobile 
                    ? 'relative w-full max-w-[500px] max-h-[80vh] rounded-xl' 
                    : 'absolute bottom-24 right-4 w-auto min-w-[700px] max-w-[800px] max-h-[45vh] rounded'} 
                    bg-[#1a1a1a] flex flex-col font-['Consolas'] shadow-2xl overflow-hidden animate-fadeIn pointer-events-auto border border-white/10`}
                onMouseEnter={!isMobile ? onHover : undefined}
                onMouseLeave={!isMobile ? onClose : undefined}
            >
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#141414]">
                    <span className="text-white text-base md:text-xl font-bold uppercase tracking-widest font-leaner">Settings</span>
                    <button onClick={onClose} className="p-2 -mr-2 text-white/70 hover:text-white transition-colors">
                        <XIcon size={24} weight="bold" />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto scrollbar-none">
                    {children}
                </div>
            </div>
        </div>
    );
};

const SubtitleMenu: React.FC<{
    captions: Array<{ id: string; label: string; url: string; lang: string }>;
    currentCaption: string | null;
    onSubtitleChange: (url: string | null) => void;
    onClose: () => void;
}> = ({ captions, currentCaption, onSubtitleChange, onClose }) => {
    const { t } = useTranslation();
    const isMobile = useIsMobile();
    const [activeLangGroup, setActiveLangGroup] = useState<string | null>(null);

    const groupedCaptions = useMemo(() => {
        const groups: Record<string, typeof captions> = {};

        captions.forEach(cap => {
            const langKey = cap.lang || cap.label;
            if (!groups[langKey]) groups[langKey] = [];
            groups[langKey].push(cap);
        });

        return Object.entries(groups).sort(([keyA, capsA], [keyB, capsB]) => {
            const labelA = capsA[0].label.toLowerCase();
            const labelB = capsB[0].label.toLowerCase();
            const aIsEnglish = keyA === 'en' || labelA.includes('english');
            const bIsEnglish = keyB === 'en' || labelB.includes('english');

            if (aIsEnglish && !bIsEnglish) return -1;
            if (!aIsEnglish && bIsEnglish) return 1;
            return labelA.localeCompare(labelB);
        });
    }, [captions]);

    if (activeLangGroup) {
        const groupTuple = groupedCaptions.find(([key]) => key === activeLangGroup);
        const groupCaps = groupTuple ? groupTuple[1] : [];
        const langName = groupCaps.length > 0 ? groupCaps[0].label : activeLangGroup;

        return (
            <div className="flex flex-col w-full py-2">
                <div
                    onClick={() => setActiveLangGroup(null)}
                    className="flex items-center px-4 py-3 cursor-pointer hover:bg-white/5 transition border-b border-white/10 mb-2"
                >
                    <ArrowLeftIcon size={20} weight="bold" className="text-white mr-3" />
                    <span className="text-white text-lg font-bold">
                        {langName}
                    </span>
                </div>

                <div className={`grid ${isMobile ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'} gap-x-2 px-2 pb-3 overflow-y-auto max-h-[70vh] md:max-h-[35vh] scrollbar-none`}>
                    {groupCaps.map((cap, index) => {
                        const displayLabel = groupCaps.length > 1 ? `${cap.label} (Track ${index + 1})` : cap.label;

                        return (
                            <div
                                key={cap.id}
                                onClick={() => {
                                    onSubtitleChange(cap.url);
                                    setActiveLangGroup(null);
                                    onClose();
                                }}
                                className="flex items-center px-3 py-3 md:py-2 cursor-pointer hover:bg-white/5 transition rounded"
                            >
                                <div className="w-5 mr-3 md:mr-2 flex justify-center">
                                    {currentCaption === cap.url && <CheckIcon size={16} weight="bold" className="text-white" />}
                                </div>
                                <span className={`text-lg truncate ${currentCaption === cap.url ? 'text-white font-bold' : 'text-white/60'}`} title={displayLabel}>
                                    {displayLabel}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }

    return (
        <div className={`grid ${isMobile ? 'grid-cols-1' : 'grid-cols-2'} gap-x-2 py-3 px-2`}>
            <div
                onClick={() => {
                    onSubtitleChange(null);
                    onClose();
                }}
                className="flex items-center px-3 py-3 md:py-2 cursor-pointer hover:bg-white/5 transition rounded"
            >
                <div className="w-5 mr-3 md:mr-2 flex justify-center">
                    {currentCaption === null && <CheckIcon size={16} weight="bold" className="text-white" />}
                </div>
                <span className={`text-lg ${currentCaption === null ? 'text-white font-bold' : 'text-white/60'}`}>
                    {t('player.off')}
                </span>
            </div>

            {groupedCaptions.map(([langKey, caps]) => {
                const isMulti = caps.length > 1;
                const hasActiveChild = caps.some(c => c.url === currentCaption);

                return (
                    <div
                        key={langKey}
                        onClick={() => {
                            if (isMulti) {
                                setActiveLangGroup(langKey);
                            } else {
                                onSubtitleChange(caps[0].url);
                                onClose();
                            }
                        }}
                        className="flex items-center justify-between px-3 py-3 md:py-2 cursor-pointer hover:bg-white/5 transition rounded group"
                    >
                        <div className="flex items-center overflow-hidden">
                            <div className="w-5 mr-3 md:mr-2 flex-shrink-0 flex justify-center">
                                {hasActiveChild && <CheckIcon size={16} weight="bold" className="text-white" />}
                            </div>
                            <span className={`text-lg truncate ${hasActiveChild ? 'text-white font-bold' : 'text-white/60'}`}>
                                {caps[0].label}
                            </span>
                        </div>

                        {isMulti && (
                            <div className="flex items-center ml-2">
                                <span className="text-xs text-white/30 mr-2 opacity-0 md:group-hover:opacity-100 transition-opacity">
                                    {caps.length}
                                </span>
                                <CaretRightIcon size={16} weight="bold" className="text-white/40 md:group-hover:text-white transition-colors" />
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

const EpisodeExplorer: React.FC<{
    seasonList: number[];
    currentSeasonEpisodes: Episode[];
    selectedSeason: number;
    currentEpisode: number;
    playingSeason?: number;
    showId: number | string;
    onSeasonSelect: (season: number) => void;
    onEpisodeSelect: (ep: Episode) => void;
    onEpisodeExpand?: (season: number, episode: number) => void;
    activePanel: 'seasons' | 'episodes' | string;
    setActivePanel: (panel: any) => void;
    showTitle?: string;
    onPanelHover?: () => void;
    onClose?: () => void;
}> = ({ seasonList, currentSeasonEpisodes, selectedSeason, currentEpisode, playingSeason, showId, onSeasonSelect, onEpisodeSelect, onEpisodeExpand, activePanel, setActivePanel, showTitle, onPanelHover, onClose }) => {
    const { t } = useTranslation();
    const isMobile = useIsMobile();
    const { getEpisodeProgress } = useGlobalContext();
    const [previewSeason, setPreviewSeason] = useState(selectedSeason);
    const [expandedEpisodeId, setExpandedEpisodeId] = useState<number | null>(null);
    const episodesContainerRef = useRef<HTMLDivElement>(null);
    const currentEpisodeRef = useRef<HTMLDivElement>(null);

    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    React.useEffect(() => {
        setPreviewSeason(selectedSeason);
    }, [selectedSeason, activePanel]);

    React.useEffect(() => {
        if (playingSeason === selectedSeason) {
            const playingEp = currentSeasonEpisodes.find(ep => ep.episode_number === currentEpisode);
            if (playingEp) {
                setExpandedEpisodeId(playingEp.id);
            }
        }
    }, [selectedSeason, playingSeason, currentEpisode, currentSeasonEpisodes]);

    const handleSeasonClick = (s: number) => {
        setPreviewSeason(s);
        onSeasonSelect(s);
        setActivePanel('episodes');
    };

    useEffect(() => {
        if (activePanel === 'episodes' && currentEpisodeRef.current && episodesContainerRef.current) {
            setTimeout(() => {
                currentEpisodeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
        }
    }, [activePanel, currentEpisode]);

    const getEpisodeProgressPercent = (season: number, epNumber: number): number => {
        const progress = getEpisodeProgress(showId, season, epNumber);
        if (progress && progress.duration > 0) {
            return Math.min((progress.time / progress.duration) * 100, 100);
        }
        return 0;
    };

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 md:p-0 pointer-events-none">
            <div className="absolute inset-0 bg-black/40 pointer-events-auto" onClick={onClose || (() => setActivePanel('none'))} />
            <div
                className={`${isMobile 
                    ? 'relative w-full max-w-[800px] max-h-[85vh] rounded-xl' 
                    : 'absolute bottom-24 right-2 w-auto min-w-[650px] max-w-[750px] min-h-[40vh] max-h-[70vh] rounded'} 
                    bg-[#1a1a1a] flex flex-col font-['Consolas'] shadow-2xl overflow-hidden animate-fadeIn text-white pointer-events-auto border border-white/10`}
                onMouseEnter={!isMobile ? onPanelHover : undefined}
                onMouseLeave={!isMobile ? (onClose || (() => setActivePanel('none'))) : undefined}
            >
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#141414]">
                    <span className="text-white text-base md:text-xl font-bold uppercase tracking-widest font-leaner">Episodes</span>
                    <button onClick={onClose || (() => setActivePanel('none'))} className="p-2 -mr-2 text-white/70 hover:text-white transition-colors">
                        <XIcon size={24} weight="bold" />
                    </button>
                </div>

            {activePanel === 'seasons' && (
                <div className="flex flex-col py-2 overflow-y-auto max-h-[90vh] md:max-h-[60vh]">
                    {!isMobile && showTitle && (
                        <div className="px-4 py-4 border-b border-white/20">
                            <span className="text-white text-xl">{showTitle}</span>
                        </div>
                    )}
                    {seasonList.map(s => (
                        <div
                            key={s}
                            onClick={() => handleSeasonClick(s)}
                            className={`flex items-center px-4 py-5 cursor-pointer hover:bg-white/5 transition ${selectedSeason === s ? 'border-l-[3px] border-white/60 bg-white/5' : ''}`}
                        >
                            <div className="w-6 mr-3 flex justify-center">
                                {selectedSeason === s && <CheckIcon size={16} weight="bold" className="text-white" />}
                            </div>
                            <span className={`text-lg font-['Consolas'] ${selectedSeason === s ? 'text-white font-bold' : 'text-white/60'}`}>
                                {t('player.season')} {s}
                            </span>
                        </div>
                    ))}
                </div>
            )}
            {activePanel === 'episodes' && (
                <div className="flex flex-col h-full">
                    <div
                        className="flex items-center px-4 py-4 border-b border-white/10 cursor-pointer hover:bg-white/5 transition"
                        onClick={() => setActivePanel('seasons')}
                    >
                        <ArrowLeftIcon size={24} weight="bold" className="text-white mr-4" />
                        <span className="text-white text-xl font-['Consolas'] font-bold">{t('player.season')} {previewSeason}</span>
                    </div>

                    <div ref={episodesContainerRef} className="flex flex-col py-2 flex-1 overflow-y-auto scrollbar-none">
                        {currentSeasonEpisodes.map(ep => {
                            const isPlaying = currentEpisode === ep.episode_number && playingSeason === selectedSeason;
                            const isExpanded = expandedEpisodeId === ep.id;

                            return (
                                <div
                                    key={ep.id}
                                    ref={isPlaying ? currentEpisodeRef : null}
                                    className={`px-4 transition ${isExpanded ? 'bg-black/40 pb-6 pt-4' : 'py-4 hover:bg-white/5'} ${isPlaying ? 'border-l-4 border-[#E50914]' : ''}`}
                                >
                                    <div
                                        className="flex items-center cursor-pointer group"
                                        onClick={() => {
                                            const newExpanded = isExpanded ? null : ep.id;
                                            setExpandedEpisodeId(newExpanded);
                                            if (newExpanded && onEpisodeExpand) {
                                                onEpisodeExpand(selectedSeason, ep.episode_number);
                                            }
                                        }}
                                    >
                                        <span className={`w-8 text-lg font-['Consolas'] ${isPlaying ? 'text-white font-bold' : 'text-white/70'}`}>
                                            {ep.episode_number}
                                        </span>
                                        <span className={`flex-1 text-lg font-['Consolas'] ${isPlaying ? 'text-white font-bold' : 'text-white/90'}`}>
                                            {ep.name}
                                        </span>
                                        {(() => {
                                            const progress = getEpisodeProgress(showId, selectedSeason, ep.episode_number);
                                            if (progress && progress.time > 10 && progress.time < (progress.duration - 30)) {
                                                return (
                                                    <span className="hidden md:inline text-xs text-white/50 mr-3">
                                                        Resume {formatTime(progress.time)}
                                                    </span>
                                                );
                                            }
                                            return null;
                                        })()}
                                        <CaretDownIcon
                                            size={20}
                                            className={`text-white/50 transition-transform duration-300 ${isExpanded ? 'rotate-180' : 'rotate-0'}`}
                                        />
                                    </div>

                                    {isExpanded && (
                                        <div className={`flex flex-col md:flex-row mt-4 gap-4 md:gap-5 ml-2 animate-fadeIn`}>
                                            {ep.still_path && (
                                                <div
                                                    className="relative group cursor-pointer flex-shrink-0"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        const epWithSeason = { ...ep, season_number: selectedSeason };
                                                        onEpisodeSelect(epWithSeason);
                                                        setActivePanel('none');
                                                    }}
                                                >
                                                    <img
                                                        src={`https://image.tmdb.org/t/p/w300${ep.still_path}`}
                                                        alt={ep.name}
                                                        className="w-full md:w-60 h-auto md:h-36 object-cover shadow-lg rounded border border-white/10"
                                                    />
                                                    <div className="absolute inset-0 bg-black/40 md:group-hover:bg-black/20 flex items-center justify-center transition-all">
                                                        <PlayCircleIcon size={isMobile ? 64 : 48} weight="fill" className="text-white drop-shadow-lg transform active:scale-110 md:group-hover:scale-110 transition-transform" />
                                                    </div>

                                                    {getEpisodeProgressPercent(selectedSeason, ep.episode_number) > 0 && (
                                                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
                                                            <div
                                                                className="h-full bg-[#E50914]"
                                                                style={{ width: `${getEpisodeProgressPercent(selectedSeason, ep.episode_number)}%` }}
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            <div className="flex flex-col flex-1">
                                                <p className="text-sm md:text-base text-gray-300 line-clamp-4 leading-relaxed overflow-hidden text-ellipsis mb-2">
                                                    {ep.overview || t('player.noDescription')}
                                                </p>
                                                {isMobile && getEpisodeProgress(showId, selectedSeason, ep.episode_number) && (
                                                    <span className="text-xs text-white/40 mt-1">
                                                        Resume at {formatTime(getEpisodeProgress(showId, selectedSeason, ep.episode_number)!.time)}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
            </div>
        </div>
    );
};

interface VideoPlayerSettingsProps {
    activePanel: 'none' | 'episodes' | 'seasons' | 'audioSubtitles' | 'quality';
    setActivePanel: (panel: 'none' | 'episodes' | 'seasons' | 'audioSubtitles' | 'quality') => void;
    seasonList: number[];
    currentSeasonEpisodes: Episode[];
    selectedSeason: number;
    currentEpisode: number;
    playingSeason?: number;
    showId: number | string;
    onSeasonSelect: (season: number) => void;
    onEpisodeSelect: (ep: Episode) => void;
    onEpisodeExpand?: (season: number, episode: number) => void;
    qualities: Array<{ height: number; bitrate: number; level: number }>;
    currentQuality: number;
    onQualityChange: (level: number) => void;
    captions: Array<{ id: string; label: string; url: string; lang: string }>;
    currentCaption: string | null;
    onSubtitleChange: (url: string | null) => void;
    showTitle?: string;
    onPanelHover?: () => void;
    onStartHide?: () => void;
}

const VideoPlayerSettings: React.FC<VideoPlayerSettingsProps> = ({
    activePanel,
    setActivePanel,
    seasonList,
    currentSeasonEpisodes,
    selectedSeason,
    currentEpisode,
    playingSeason,
    showId,
    onSeasonSelect,
    onEpisodeSelect,
    onEpisodeExpand,
    qualities,
    currentQuality,
    onQualityChange,
    captions,
    currentCaption,
    onSubtitleChange,
    showTitle,
    onPanelHover,
    onStartHide
}) => {
    const isMobile = useIsMobile();
    if (activePanel === 'none') return null;

    const handleMouseLeave = onStartHide || (() => setActivePanel('none'));

    return (
        <>
            {activePanel === 'audioSubtitles' && (
                <MinimalPanel onClose={handleMouseLeave} onHover={onPanelHover}>
                    <SubtitleMenu
                        captions={captions}
                        currentCaption={currentCaption}
                        onSubtitleChange={onSubtitleChange}
                        onClose={handleMouseLeave}
                    />
                </MinimalPanel>
            )}

            {activePanel === 'quality' && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 md:p-0 pointer-events-none">
                    <div className="absolute inset-0 bg-black/40 pointer-events-auto" onClick={handleMouseLeave} />
                    <div
                        className={`${isMobile 
                            ? 'relative w-full max-w-[500px] max-h-[80vh] rounded-xl' 
                            : 'absolute bottom-24 right-4 w-auto min-w-[700px] max-w-[800px] max-h-[50vh] rounded'} 
                            bg-[#1a1a1a] flex flex-col font-['Consolas'] shadow-2xl overflow-hidden animate-fadeIn pointer-events-auto border border-white/10`}
                        onMouseEnter={!isMobile ? onPanelHover : undefined}
                        onMouseLeave={!isMobile ? handleMouseLeave : undefined}
                    >
                        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#141414]">
                            <span className="text-white text-base md:text-xl font-bold uppercase tracking-widest font-leaner">Quality</span>
                            <button onClick={handleMouseLeave} className="p-2 -mr-2 text-white/70 hover:text-white transition-colors">
                                <XIcon size={24} weight="bold" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto scrollbar-none p-4 md:p-2">
                            <div className={`grid ${isMobile ? 'grid-cols-2' : 'grid-cols-2'} gap-3`}>
                                <button
                                    onClick={() => { onQualityChange(-1); isMobile && handleMouseLeave(); }}
                                    className={`p-4 text-center rounded bg-[#222] hover:bg-[#333] transition ${currentQuality === -1 ? 'border-2 border-[#E50914] text-white font-bold' : 'text-white/60'}`}
                                >
                                    Auto
                                </button>
                                {qualities.map((q, i) => (
                                    <button
                                        key={i}
                                        onClick={() => { onQualityChange(q.level); isMobile && handleMouseLeave(); }}
                                        className={`p-4 text-center rounded bg-[#222] hover:bg-[#333] transition ${currentQuality === q.level ? 'border-2 border-[#E50914] text-white font-bold' : 'text-white/60'}`}
                                    >
                                        {q.height}p {q.height >= 1080 && 'HD'}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {(activePanel === 'seasons' || activePanel === 'episodes') && (
                <EpisodeExplorer
                    seasonList={seasonList}
                    currentSeasonEpisodes={currentSeasonEpisodes}
                    selectedSeason={selectedSeason}
                    currentEpisode={currentEpisode}
                    playingSeason={playingSeason}
                    showId={showId}
                    onSeasonSelect={onSeasonSelect}
                    onEpisodeSelect={(ep) => { onEpisodeSelect(ep); setActivePanel('none'); }}
                    onEpisodeExpand={onEpisodeExpand}
                    activePanel={activePanel}
                    setActivePanel={setActivePanel}
                    showTitle={showTitle}
                    onPanelHover={onPanelHover}
                    onClose={handleMouseLeave}
                />
            )}
        </>
    );
};

export default VideoPlayerSettings;