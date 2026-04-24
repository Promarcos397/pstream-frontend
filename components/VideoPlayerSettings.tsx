import React, { useRef, useEffect } from 'react';
import { Episode } from '../types';
import { ArrowLeftIcon, CheckIcon, CaretRightIcon, XIcon } from '@phosphor-icons/react';

import { useTranslation } from 'react-i18next';
import { useGlobalContext } from '../context/GlobalContext';
import { useIsMobile } from '../hooks/useIsMobile';

const commonPanelCls = "bg-[#1a1a1a]/95 backdrop-blur-md border border-white/10 shadow-[0px_20px_60px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden animate-fadeIn fixed z-[120] bottom-5 md:bottom-24 right-5 rounded-xl";

// ─── Shared: compact panel wrapper ────────────────────────────────────────────
export const PanelShell: React.FC<{
    title: string;
    onClose: () => void;
    onHover?: () => void;
    onLeave?: () => void;
    children: React.ReactNode;
    desktopClass?: string;
    showHeader?: boolean;
}> = ({ title, onClose, onHover, onLeave, children, desktopClass, showHeader = false }) => {
    const isMobile = useIsMobile();
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const handleMouseEnter = () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        if (onHover) onHover();
    };

    const handleMouseLeave = () => {
        if (onLeave) onLeave();
        timeoutRef.current = setTimeout(() => {
            if (!document.getElementById('video-controls-container')?.matches(':hover')) {
                onClose();
            }
        }, 700);
    };

    if (isMobile) {
        return (
            <div
                className="fixed inset-0 z-[120] pointer-events-auto"
                style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
                onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
            >
                <div
                    className={`${commonPanelCls} ${desktopClass || 'w-full max-w-[550px] h-fit max-h-[80svh]'} pointer-events-auto shadow-2xl`}
                    style={{ 
                        bottom: 'max(1.25rem, env(safe-area-inset-bottom))', 
                        left: '1rem', 
                        right: '1rem',
                        width: 'auto' 
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="flex items-center justify-between px-6 py-5 border-b border-white/5 flex-shrink-0">
                        <span className="text-white text-xl font-bold tracking-wide uppercase">{title}</span>
                        <button
                            onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); onClose(); }}
                            className="w-10 h-10 flex items-center justify-center text-white/50 active:text-white"
                        >
                            <XIcon size={20} weight="bold" />
                        </button>
                    </div>
                    <div className="overflow-y-auto flex-1 scrollbar-none">{children}</div>
                </div>
            </div>
        );
    }

    return (
        <div
            id="video-panel-shell"
            className={`${commonPanelCls} ${desktopClass || 'w-[550px] h-[480px]'}`}
        >
            {showHeader && (
                 <div className="flex items-center px-8 py-6 border-b border-white/5 bg-[#1a1a1a]/50 flex-shrink-0">
                    <span className="text-white text-2xl font-bold tracking-tight">{title}</span>
                </div>
            )}
            <div className="overflow-y-auto flex-1 scrollbar-thin scrollbar-thumb-[#666] scrollbar-track-transparent">
                {children}
            </div>
        </div>
    );
};

// ─── Audio & Subtitle combined menu ─────────────────────────────────────────
export const AudioSubPanel: React.FC<{
    captions: Array<{ id: string; label: string; url: string; lang: string }>;
    currentCaption: string | null;
    onSubtitleChange: (url: string | null) => void;
    audioTracks: Array<{ id: number; name: string; lang: string }>;
    currentAudioTrack: number;
    onAudioChange: (trackId: number) => void;
    onClose: () => void;
    subtitleOffset?: number;
    onSubtitleOffsetChange?: (offset: number) => void;
}> = ({ captions, currentCaption, onSubtitleChange, audioTracks, currentAudioTrack, onAudioChange, onClose, subtitleOffset = 0, onSubtitleOffsetChange }) => {
    const { t } = useTranslation();
    const isMobile = useIsMobile();
    const [activeLangGroup, setActiveLangGroup] = React.useState<string | null>(null);

    const groupedCaptions = React.useMemo(() => {
        const groups: Record<string, typeof captions> = {};
        captions.forEach(cap => {
            const langKey = cap.lang || cap.label;
            if (!groups[langKey]) groups[langKey] = [];
            groups[langKey].push(cap);
        });
        return Object.entries(groups).sort(([keyA, capsA], [keyB, capsB]) => {
            const aIsEnglish = keyA === 'en' || capsA[0].label.toLowerCase().includes('english');
            const bIsEnglish = keyB === 'en' || capsB[0].label.toLowerCase().includes('english');
            if (aIsEnglish && !bIsEnglish) return -1;
            if (!aIsEnglish && bIsEnglish) return 1;
            return capsA[0].label.toLowerCase().localeCompare(capsB[0].label.toLowerCase());
        });
    }, [captions]);

    const rowCls = `flex items-center px-5 py-3 cursor-pointer hover:bg-white/5 active:bg-white/10 transition-all duration-150 select-none group rounded-md mx-2 my-0.5`;

    const STEP = 0.5; // seconds per +/- press
    const offsetLabel = subtitleOffset === 0 ? '0.0s' : `${subtitleOffset > 0 ? '+' : ''}${subtitleOffset.toFixed(1)}s`;


    const renderAudioColumn = () => (
        <div className="flex flex-col flex-1 border-r border-white/10 min-w-[160px] h-full py-3">
            <div className="text-white font-bold mb-3 px-4 pt-2 text-sm uppercase tracking-wider text-white/60">
                Audio
            </div>
            <ul className="overflow-y-auto flex-1 menu-list list-none p-0 m-0">
                {audioTracks.map((track) => (
                    <li 
                        key={track.id} 
                        className={`${rowCls} ${currentAudioTrack === track.id ? 'text-white' : 'text-[#b3b3b3]'}`} 
                        onClick={(e) => { e.stopPropagation(); onAudioChange(track.id); }}
                    >
                        <div className="w-6 flex-shrink-0 flex justify-center">
                            {currentAudioTrack === track.id && <span className="text-white font-light text-base">✓</span>}
                        </div>
                        <span className="text-sm truncate">{track.name} {track.lang && track.lang.toLowerCase() !== 'unknown' ? `[${track.lang.toUpperCase()}]` : ''}</span>
                    </li>
                ))}
            </ul>
        </div>
    );

    const renderSubtitleColumn = () => (
        <div className="flex flex-col flex-1 min-w-[160px] h-full py-3">
            {/* Header + offset adjuster */}
            <div className="flex items-center justify-between px-4 pt-2 mb-1 flex-shrink-0">
                <span className="text-sm uppercase tracking-wider text-white/60 font-bold">Subtitles</span>
                {onSubtitleOffsetChange && (
                    <div className="flex items-center gap-1">
                        <button
                            onClick={(e) => { e.stopPropagation(); onSubtitleOffsetChange(parseFloat((subtitleOffset - STEP).toFixed(1))); }}
                            className="w-6 h-6 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 rounded transition text-base font-bold leading-none"
                            title="Earlier (-0.5s)"
                        >−</button>
                        <span className="text-xs text-white/60 w-10 text-center font-mono select-none">{offsetLabel}</span>
                        <button
                            onClick={(e) => { e.stopPropagation(); onSubtitleOffsetChange(parseFloat((subtitleOffset + STEP).toFixed(1))); }}
                            className="w-6 h-6 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 rounded transition text-base font-bold leading-none"
                            title="Later (+0.5s)"
                        >+</button>
                    </div>
                )}
            </div>
             <ul className="overflow-y-auto flex-1 menu-list list-none p-0 m-0">
                <li 
                    className={`${rowCls} ${currentCaption === null ? 'text-white' : 'text-[#b3b3b3]'}`} 
                    onClick={(e) => { e.stopPropagation(); onSubtitleChange(null); }}
                >
                    <div className="w-6 flex-shrink-0 flex justify-center">
                        {currentCaption === null && <span className="text-white font-light text-base">✓</span>}
                    </div>
                    <span className="text-sm">{t('player.off')}</span>
                </li>

                {groupedCaptions.map(([langKey, caps]) => {
                    const isMulti = caps.length > 1;
                    const hasActiveChild = caps.some(c => c.url === currentCaption);
                    return (
                        <li 
                            key={langKey} 
                            className={`${rowCls} justify-between ${hasActiveChild ? 'text-white' : 'text-[#b3b3b3]'}`} 
                            onClick={(e) => {
                                e.stopPropagation();
                                if (isMulti) { setActiveLangGroup(langKey); }
                                else { onSubtitleChange(caps[0].url); }
                            }}
                        >
                            <div className="flex items-center overflow-hidden">
                                <div className="w-6 flex-shrink-0 flex justify-center">
                                    {hasActiveChild && <span className="text-white font-light text-base">✓</span>}
                                </div>
                                <span className="text-sm truncate">{caps[0].label}</span>
                            </div>
                            {isMulti && <CaretRightIcon size={12} weight="bold" className="text-[#b3b3b3] group-hover:text-white ml-2 flex-shrink-0" />}
                        </li>
                    );
                })}
             </ul>
        </div>
    );

    if (activeLangGroup) {
        const groupTuple = groupedCaptions.find(([key]) => key === activeLangGroup);
        const groupCaps = groupTuple ? groupTuple[1] : [];
        const langName = groupCaps[0]?.label ?? activeLangGroup;

        return (
            <div className="flex flex-col w-full py-6">
                <div onClick={(e) => { e.stopPropagation(); setActiveLangGroup(null); }} className={`${rowCls} border-b border-white/10 mb-2 pb-4`}>
                    <ArrowLeftIcon size={18} weight="bold" className="text-white mr-3 flex-shrink-0" />
                    <span className="text-white font-bold text-xl">{langName}</span>
                </div>
                <ul className="overflow-y-auto flex-1 menu-list list-none p-0 m-0">
                    {groupCaps.map((cap, index) => {
                        const displayLabel = groupCaps.length > 1 ? `${cap.label} (Track ${index + 1})` : cap.label;
                        const isSelected = currentCaption === cap.url;
                        return (
                            <li 
                                key={cap.id} 
                                className={`${rowCls} ${isSelected ? 'text-white' : 'text-[#b3b3b3]'}`} 
                                onClick={(e) => { e.stopPropagation(); onSubtitleChange(cap.url); setActiveLangGroup(null); onClose(); }}
                            >
                                <div className="w-8 flex-shrink-0 flex justify-center">
                                    {isSelected && <span className="text-white font-light text-lg">✓</span>}
                                </div>
                                <span className="text-base truncate">{displayLabel}</span>
                            </li>
                        );
                    })}
                </ul>
            </div>
        );
    }

    return (
        <div className="flex flex-row w-full h-full">
            {renderAudioColumn()}
            {renderSubtitleColumn()}
        </div>
    );
};

// ─── Server Selection menu ────────────────────────────────────────────────
const ServerPanel: React.FC<{
    allSources: any[];
    currentSourceIndex: number;
    onSourceChange: (index: number) => void;
    onClose: () => void;
}> = ({ allSources, currentSourceIndex, onSourceChange, onClose }) => {
    const isMobile = useIsMobile();
    const rowCls = `flex items-center justify-between px-5 ${isMobile ? 'py-4' : 'py-3'} cursor-pointer hover:bg-white/5 active:bg-white/10 transition-all rounded-lg select-none mx-2 my-1`;

    return (
        <div className="flex flex-col h-full">
            {!isMobile && (
                <div className="px-8 py-5 border-b border-white/5 flex-shrink-0">
                    <span className="text-white text-xl font-bold tracking-tight">Select Server</span>
                    <p className="text-xs text-white/40 mt-1">Switch if current server is buffering or offline.</p>
                </div>
            )}
            <div className="overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent py-2">
                {allSources.map((source, i) => (
                    <div key={i} className={`${rowCls} ${currentSourceIndex === i ? 'bg-white/10' : ''}`} onClick={() => { onSourceChange(i); onClose(); }}>
                        <div className="flex items-center gap-4 overflow-hidden">
                            <div className="w-8 flex-shrink-0 flex justify-center">
                                {currentSourceIndex === i && <CheckIcon size={20} weight="bold" className="text-white" />}
                            </div>
                            <div className="flex flex-col overflow-hidden">
                                <span className={`text-base font-bold ${currentSourceIndex === i ? 'text-white' : 'text-white/60'}`}>
                                    {source.provider || `Server ${i + 1}`}
                                </span>
                                <span className="text-xs text-white/30 truncate">{source.quality || 'Auto'} • {source.isM3U8 ? 'Adaptive' : 'Direct'}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// ─── Quality menu ──────────────────────────────────────────────────────────
export const QualityMenu: React.FC<{
    qualities: Array<{ height: number; bitrate: number; level: number }>;
    currentQuality: number;
    onQualityChange: (level: number) => void;
    onClose: () => void;
}> = ({ qualities, currentQuality, onQualityChange, onClose }) => {
    const isMobile = useIsMobile();
    const rowCls = `flex items-center justify-between px-6 ${isMobile ? 'py-5' : 'py-4'} cursor-pointer hover:bg-white/10 active:bg-white/20 transition-all rounded-lg select-none mx-2 my-1`;

    return (
        <div className="flex flex-col py-2">
            <div className={`relative ${rowCls} ${currentQuality === -1 ? 'bg-white/10 text-white' : 'text-white/60'}`} onClick={() => { onQualityChange(-1); onClose(); }}>
                <div className="flex flex-col">
                    <span className="text-lg font-bold">Auto</span>
                    {!isMobile && <div className="text-xs opacity-60">Best quality for your connection</div>}
                </div>
                {currentQuality === -1 && <CheckIcon size={20} weight="bold" />}
            </div>
            {qualities.map((q, i) => (
                <div key={i} className={`${rowCls} ${currentQuality === q.level ? 'bg-white/10 text-white' : 'text-white/60'}`} onClick={() => { onQualityChange(q.level); onClose(); }}>
                    <span className="text-lg font-bold">{q.height}p</span>
                    {currentQuality === q.level && <CheckIcon size={20} weight="bold" />}
                </div>
            ))}
        </div>
    );
};

// ─── Episode explorer ──────────────────────────────────────────────────────
export const EpisodeExplorer: React.FC<{
    seasonList: number[];
    currentSeasonEpisodes: Episode[];
    selectedSeason: number;
    currentEpisode: number;
    playingSeason?: number;
    showId: number | string;
    onSeasonSelect: (season: number) => void;
    onEpisodeSelect: (ep: Episode) => void;
    onEpisodeExpand?: (season: number, episode: number) => void;
    activePanel: string;
    setActivePanel: (panel: any) => void;
    showTitle?: string;
    onPanelHover?: () => void;
    onClose?: () => void;
}> = ({ seasonList, currentSeasonEpisodes, selectedSeason, currentEpisode, playingSeason, showId, onSeasonSelect, onEpisodeSelect, onEpisodeExpand, activePanel, setActivePanel, showTitle, onPanelHover, onClose }) => {
    const isMobile = useIsMobile();
    const { getEpisodeProgress } = useGlobalContext();
    const [previewSeason, setPreviewSeason] = React.useState(selectedSeason);
    const [expandedEpisodeId, setExpandedEpisodeId] = React.useState<number | null>(null);
    const episodesContainerRef = useRef<HTMLDivElement>(null);
    const currentEpisodeRef = useRef<HTMLDivElement>(null);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    React.useEffect(() => { setPreviewSeason(playingSeason || selectedSeason); }, [selectedSeason, playingSeason, activePanel]);

    // Auto-scroll AND auto-expand current episode when panel opens
    useEffect(() => {
        if (activePanel === 'episodes' && currentSeasonEpisodes.length > 0) {
            // Find current episode object to get its ID for expansion
            const playingEp = currentSeasonEpisodes.find(e => e.episode_number === currentEpisode);
            if (playingEp) {
                setExpandedEpisodeId(playingEp.id);
            }

            if (currentEpisodeRef.current && episodesContainerRef.current) {
                setTimeout(() => currentEpisodeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 150);
            }
        }
    }, [activePanel, currentEpisode, currentSeasonEpisodes.length]);

    // Two-click handler
    const handleEpisodeClick = (ep: Episode) => {
        if (expandedEpisodeId === ep.id) {
            onEpisodeSelect(ep);
            setActivePanel('none');
            setExpandedEpisodeId(null);
        } else {
            setExpandedEpisodeId(ep.id);
        }
    };


    const innerContent = (
        <div className="flex flex-col h-full font-sans text-white">
            {activePanel === 'seasons' && (
                <div className="flex flex-col h-full">
                    <div className="flex items-center px-6 py-5 border-b border-white/5 flex-shrink-0">
                        <span className="text-xl font-bold tracking-tight">{showTitle || 'Seasons'}</span>
                    </div>
                    <div className="overflow-y-auto scroll-list flex-1 py-2">
                            <div 
                                key={s} 
                                onClick={(e) => { 
                                    e.stopPropagation(); 
                                    setPreviewSeason(s); 
                                    onSeasonSelect(s); 
                                    setActivePanel('episodes'); 
                                }} 
                                className={`group flex items-center justify-between px-6 py-4 mx-2 my-1 text-lg font-bold transition-all cursor-pointer rounded-lg hover:bg-white/5 active:scale-[0.98] ${selectedSeason === s ? 'bg-white/10 text-white' : 'text-white/60'}`}
                            >
                                <span>Season {s}</span>
                                {selectedSeason === s && <CheckIcon size={20} weight="bold" />}
                            </div>
                        ))}
                    </div>
                </div>
            )}
            {activePanel === 'episodes' && (
                <div className="flex flex-col h-full">
                    {/* Clicking the season header goes back to season list */}
                    <div
                        className="flex items-center gap-3 px-6 py-5 border-b border-white/5 flex-shrink-0 cursor-pointer text-white/90 hover:text-white transition-all bg-white/5"
                        onClick={(e) => { e.stopPropagation(); setActivePanel('seasons'); }}
                    >
                        <ArrowLeftIcon size={20} weight="bold" />
                        <span className="text-xl font-bold tracking-tight">Season {previewSeason}</span>
                    </div>
                    <div ref={episodesContainerRef} className="overflow-y-auto scroll-list flex-1 scrollbar-hide">
                        {currentSeasonEpisodes.map(ep => {
                            const isCurrentlyPlaying = currentEpisode === ep.episode_number && playingSeason === selectedSeason;
                            const isExpanded = expandedEpisodeId === ep.id;
                            const prog = getEpisodeProgress(showId, selectedSeason, ep.episode_number);
                            const perc = prog && prog.duration > 0 ? (prog.time / prog.duration) * 100 : 0;

                            return (
                                <div
                                    key={ep.id}
                                    ref={isCurrentlyPlaying ? currentEpisodeRef : null}
                                    className={`transition-colors border-b border-white/5 ${isCurrentlyPlaying || isExpanded ? 'bg-[#121212]' : 'hover:bg-white/5'}`}
                                >
                                    <div
                                        className="flex items-center px-6 py-3 cursor-pointer gap-3"
                                        onClick={(e) => { e.stopPropagation(); handleEpisodeClick(ep); }}
                                    >
                                         {/* Episode number */}
                                        <span className={`flex-shrink-0 ${isMobile ? 'text-xl w-[38px]' : 'text-base w-[28px]'} font-bold ${isCurrentlyPlaying ? 'text-[#e50914]' : 'text-white/60'}`}>
                                            {ep.episode_number}
                                        </span>
                                        {/* Name */}
                                        <span className={`font-bold flex-1 truncate ${isMobile ? 'text-base' : 'text-sm'} ${isCurrentlyPlaying ? 'text-white' : 'text-white/90'}`}>
                                            {ep.name}
                                        </span>
                                        {/* Progress bar */}
                                        {perc > 0 && (
                                            <div className={`${isMobile ? 'w-[80px] h-1' : 'w-[60px] h-[3px]'} bg-white/20 flex-shrink-0 rounded-full overflow-hidden`}>
                                                <div className="h-full bg-red-500 rounded-full" style={{ width: `${Math.min(100, perc)}%` }} />
                                            </div>
                                        )}
                                        {/* Expand/play caret */}
                                        <CaretRightIcon
                                            size={isMobile ? 16 : 13}
                                            weight="bold"
                                            className={`flex-shrink-0 transition-transform text-white/40 ${isExpanded ? 'rotate-90' : ''}`}
                                        />
                                    </div>

                                    {/* Expanded info */}
                                    {isExpanded && (
                                        <div
                                            className="px-6 pb-4 flex flex-col md:flex-row gap-4 cursor-pointer group/ep-play"
                                            onClick={(e) => { e.stopPropagation(); onEpisodeSelect(ep); setActivePanel('none'); setExpandedEpisodeId(null); }}
                                        >
                                            {ep.still_path && (
                                                <div className="relative flex-shrink-0 w-full md:w-[180px]">
                                                    <img
                                                        src={`https://image.tmdb.org/t/p/w300${ep.still_path}`}
                                                        className="w-full h-auto aspect-video object-cover rounded-sm group-hover/ep-play:brightness-50 transition duration-200"
                                                        alt={ep.name}
                                                    />
                                                    <div className="absolute inset-0 flex items-center justify-center transition duration-200">
                                                        <div className="w-9 h-9 rounded-full bg-white/20 border-2 border-white/80 flex items-center justify-center group-hover/ep-play:bg-white/30 group-hover/ep-play:scale-110 transition-all duration-200 shadow-lg">
                                                            <div className="w-0 h-0 ml-0.5" style={{ borderTop: '6px solid transparent', borderBottom: '6px solid transparent', borderLeft: '11px solid white' }} />
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                            <div className="flex-1 flex flex-col justify-center">
                                                <p className="text-xs text-white/60 leading-relaxed line-clamp-4">
                                                    {ep.overview || 'No description available.'}
                                                </p>
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
    );

    if (isMobile) {
        return (
            <div className="fixed inset-0 z-[120] pointer-events-auto" onClick={(e) => { if (e.target === e.currentTarget) onClose ? onClose() : setActivePanel('none'); }}>
                <div
                    className={`${commonPanelCls} w-full max-h-[85svh] pointer-events-auto`}
                    style={{ borderRadius: 0, bottom: 0, right: 0, left: 0 }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="flex items-center justify-between px-6 py-4 border-b-2 border-white flex-shrink-0">
                        <span className="text-white text-lg font-bold uppercase">{activePanel === 'seasons' ? 'Seasons' : `Season ${previewSeason}`}</span>
                        <button onClick={() => onClose ? onClose() : setActivePanel('none')} className="w-10 h-10 flex items-center justify-center text-white active:text-white/50"><XIcon size={20} weight="bold" /></button>
                    </div>
                    <div className="overflow-y-auto flex-1">{innerContent}</div>
                </div>
            </div>
        );
    }

    const handlePanelEnter = () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        if (onPanelHover) onPanelHover();
    };
    
    const handlePanelLeave = () => {
        timeoutRef.current = setTimeout(() => {
            if (!document.getElementById('video-controls-container')?.matches(':hover')) {
                onClose ? onClose() : setActivePanel('none');
            }
        }, 700);
    };

    return (
        <div
            id="video-panel-shell"
            className={`${commonPanelCls} ${activePanel === 'audioSubtitles' ? 'w-[480px]' : (activePanel === 'episodes' || activePanel === 'seasons' ? 'w-[700px]' : 'w-[380px]')} h-[420px] lg:h-[65vh]`}
        >
            {innerContent}
        </div>
    );
};

// ─── Main export ───────────────────────────────────────────────────────────
interface VideoPlayerSettingsProps {
    activePanel: 'none' | 'episodes' | 'seasons' | 'audioSubtitles' | 'quality' | 'servers';
    setActivePanel: (panel: any) => void;
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
    subtitleOffset?: number;
    onSubtitleOffsetChange?: (offset: number) => void;
    audioTracks: Array<{ id: number; name: string; lang: string }>;
    currentAudioTrack: number;
    onAudioChange: (trackId: number) => void;
    showTitle?: string;
    onPanelHover?: () => void;
    onStartHide?: () => void;
    allSources: any[];
    currentSourceIndex: number;
    onSourceChange: (index: number) => void;
}

const VideoPlayerSettings: React.FC<VideoPlayerSettingsProps> = (props) => {
    if (props.activePanel === 'none') return null;
    const close = () => props.setActivePanel('none');

    return (
        <>
            {props.activePanel === 'audioSubtitles' && (
                <PanelShell
                    title="Audio & Subtitles"
                    onClose={close}
                    onHover={() => { /* keep panel open */ }}
                    onLeave={() => { /* handled via hover timeout in controls */ }}
                    desktopClass="bottom-16 right-0 w-[380px] lg:w-[480px] h-[380px]"
                >
                    <AudioSubPanel {...props} onClose={close} />
                </PanelShell>
            )}
            {props.activePanel === 'quality' && (
                <PanelShell title="Video Quality" onClose={close} desktopClass="bottom-16 right-0 w-[320px] lg:w-[500px] max-h-[70vh]">
                    <QualityMenu {...props} onClose={close} />
                </PanelShell>
            )}
            {(props.activePanel === 'seasons' || props.activePanel === 'episodes') && (
                <EpisodeExplorer {...props} onClose={close} />
            )}
            {props.activePanel === 'servers' && (
                <PanelShell title="Servers" onClose={close} desktopClass="bottom-16 right-0 w-[340px] lg:w-[450px] max-h-[60vh] h-auto">
                    <ServerPanel {...props} onClose={close} />
                </PanelShell>
            )}
        </>
    );
};

export default VideoPlayerSettings;