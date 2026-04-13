import React, { useRef, useEffect } from 'react';
import { Episode } from '../types';
import { ArrowLeftIcon, PlayCircleIcon, CheckIcon, CaretRightIcon, XIcon } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { useGlobalContext } from '../context/GlobalContext';
import { useIsMobile } from '../hooks/useIsMobile';

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

    if (isMobile) {
        return (
            <div
                className="fixed inset-0 z-[120] flex flex-col justify-end"
                onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
            >
                <div
                    className="bg-[#1c1c1c] rounded-t-2xl shadow-2xl flex flex-col overflow-hidden animate-slideIn"
                    style={{ maxHeight: '58vh' }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 flex-shrink-0">
                        <span className="text-white text-base font-bold uppercase tracking-widest">{title}</span>
                        <button
                            onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); onClose(); }}
                            className="p-2 -mr-2 text-white/70 active:text-white rounded-full active:bg-white/10"
                        >
                            <XIcon size={22} weight="bold" />
                        </button>
                    </div>
                    <div className="overflow-y-auto flex-1 scrollbar-none">{children}</div>
                </div>
            </div>
        );
    }

    return (
        <div
            className={`absolute z-[120] bg-[#262626] rounded-none border-2 border-white shadow-[0px_20px_50px_rgba(0,0,0,0.9)] flex flex-col overflow-hidden animate-fadeIn font-sans ${desktopClass || 'bottom-16 right-0 w-[340px] lg:w-[480px] max-h-[70vh]'}`}
            onMouseEnter={onHover}
            onMouseLeave={onLeave}
        >
            {showHeader && (
                 <div className="flex items-center px-8 py-6 border-b-2 border-white bg-[#262626] flex-shrink-0">
                    <span className="text-white text-2xl font-bold">{title}</span>
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
}> = ({ captions, currentCaption, onSubtitleChange, audioTracks, currentAudioTrack, onAudioChange, onClose }) => {
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

    const rowCls = `flex items-center px-4 ${isMobile ? 'py-4' : 'py-2.5'} cursor-pointer hover:bg-white/5 active:bg-white/10 transition rounded select-none`;

    const renderAudioColumn = () => (
        <div className="flex flex-col flex-1 border-r border-white/10 min-w-[200px] h-full">
            <div className={`text-white font-bold mb-6 ${isMobile ? 'px-4 py-3 text-xs uppercase tracking-widest border-b border-white/5 opacity-50' : 'px-8 py-0 text-[22px]'}`}>
                Audio
            </div>
            <div className="overflow-y-auto scrollbar-thin scrollbar-thumb-[#555] scrollbar-track-transparent">
                {audioTracks.map((track) => (
                    <div key={track.id} className={rowCls} onClick={() => onAudioChange(track.id)}>
                        <div className="w-8 flex-shrink-0 flex justify-center">
                            {currentAudioTrack === track.id && <CheckIcon size={20} weight="bold" className="text-white" />}
                        </div>
                        <span className={`text-base truncate transition-colors ${currentAudioTrack === track.id ? 'text-white font-bold' : 'text-[#b3b3b3] hover:text-white'}`}>
                            {track.name} {track.lang && track.lang.toLowerCase() !== 'unknown' ? `[${track.lang.toUpperCase()}]` : ''}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );

    const renderSubtitleColumn = () => (
        <div className="flex flex-col flex-1 min-w-[200px] h-full">
             <div className={`text-white font-bold mb-6 ${isMobile ? 'px-4 py-3 text-xs uppercase tracking-widest border-b border-white/5 opacity-50' : 'px-8 py-0 text-[22px]'}`}>
                Subtitles
             </div>
             <div className="overflow-y-auto scrollbar-thin scrollbar-thumb-[#555] scrollbar-track-transparent">
                <div className={rowCls} onClick={() => onSubtitleChange(null)}>
                    <div className="w-8 flex-shrink-0 flex justify-center">
                        {currentCaption === null && <CheckIcon size={20} weight="bold" className="text-white" />}
                    </div>
                    <span className={`text-base transition-colors ${currentCaption === null ? 'text-white font-bold' : 'text-[#b3b3b3] hover:text-white'}`}>{t('player.off')}</span>
                </div>

                {groupedCaptions.map(([langKey, caps]) => {
                    const isMulti = caps.length > 1;
                    const hasActiveChild = caps.some(c => c.url === currentCaption);
                    return (
                        <div key={langKey} className={`${rowCls} justify-between`} onClick={() => {
                            if (isMulti) { setActiveLangGroup(langKey); }
                            else { onSubtitleChange(caps[0].url); }
                        }}>
                            <div className="flex items-center overflow-hidden">
                                <div className="w-8 flex-shrink-0 flex justify-center">
                                    {hasActiveChild && <CheckIcon size={20} weight="bold" className="text-white" />}
                                </div>
                                <span className={`text-base truncate transition-colors ${hasActiveChild ? 'text-white font-bold' : 'text-[#b3b3b3] hover:text-white'}`}>{caps[0].label}</span>
                            </div>
                            {isMulti && <CaretRightIcon size={14} weight="bold" className="text-white/40 ml-2 flex-shrink-0" />}
                        </div>
                    );
                })}
             </div>
        </div>
    );

    if (activeLangGroup) {
        const groupTuple = groupedCaptions.find(([key]) => key === activeLangGroup);
        const groupCaps = groupTuple ? groupTuple[1] : [];
        const langName = groupCaps[0]?.label ?? activeLangGroup;

        return (
            <div className="flex flex-col w-full py-1">
                <div onClick={() => setActiveLangGroup(null)} className={`${rowCls} border-b border-white/10 mb-1`}>
                    <ArrowLeftIcon size={18} weight="bold" className="text-white mr-3 flex-shrink-0" />
                    <span className="text-white font-bold">{langName}</span>
                </div>
                {groupCaps.map((cap, index) => {
                    const displayLabel = groupCaps.length > 1 ? `${cap.label} (Track ${index + 1})` : cap.label;
                    return (
                        <div key={cap.id} className={rowCls} onClick={() => { onSubtitleChange(cap.url); setActiveLangGroup(null); onClose(); }}>
                            <div className="w-5 mr-3 flex-shrink-0 flex justify-center">
                                {currentCaption === cap.url && <CheckIcon size={14} weight="bold" className="text-white" />}
                            </div>
                            <span className={`text-sm truncate ${currentCaption === cap.url ? 'text-white font-bold' : 'text-white/60'}`}>{displayLabel}</span>
                        </div>
                    );
                })}
            </div>
        );
    }

    return (
        <div className={`flex ${isMobile ? 'flex-col' : 'flex-row w-full h-full py-6'}`}>
            {/* Audio column */}
            <div className="flex flex-col flex-1 border-r border-white/10 min-w-[200px] h-full">
                <div className={`text-white font-bold mb-6 ${isMobile ? 'px-4 py-3 text-xs uppercase tracking-widest border-b border-white/5 opacity-50' : 'px-8 py-0 text-[22px]'}`}>
                    Audio
                </div>
                <div className="overflow-y-auto scrollbar-thin scrollbar-thumb-[#555] scrollbar-track-transparent">
                    {audioTracks.length > 0 ? audioTracks.map((track) => (
                        <div key={track.id} className={rowCls} onClick={() => onAudioChange(track.id)}>
                            <div className="w-8 flex-shrink-0 flex justify-center">
                                {currentAudioTrack === track.id && <CheckIcon size={20} weight="bold" className="text-white" />}
                            </div>
                            <span className={`text-base truncate transition-colors ${currentAudioTrack === track.id ? 'text-white font-bold' : 'text-[#b3b3b3] hover:text-white'}`}>
                                {track.name} {track.lang && track.lang.toLowerCase() !== 'unknown' ? `[${track.lang.toUpperCase()}]` : ''}
                            </span>
                        </div>
                    )) : (
                        <div className="px-8 py-4 text-white/30 text-sm italic">No audio tracks available</div>
                    )}
                </div>
            </div>
            {/* Subtitle column */}
            <div className="flex flex-col flex-1 min-w-[200px] h-full">
                <div className={`text-white font-bold mb-6 ${isMobile ? 'px-4 py-3 text-xs uppercase tracking-widest border-b border-white/5 opacity-50' : 'px-8 py-0 text-[22px]'}`}>
                    Subtitles
                </div>
                <div className="overflow-y-auto scrollbar-thin scrollbar-thumb-[#555] scrollbar-track-transparent">
                    <div className={rowCls} onClick={() => onSubtitleChange(null)}>
                        <div className="w-8 flex-shrink-0 flex justify-center">
                            {currentCaption === null && <CheckIcon size={20} weight="bold" className="text-white" />}
                        </div>
                        <span className={`text-base transition-colors ${currentCaption === null ? 'text-white font-bold' : 'text-[#b3b3b3] hover:text-white'}`}>Off</span>
                    </div>
                    {groupedCaptions.length === 0 && (
                        <div className="px-8 py-4 text-white/30 text-sm italic">No subtitles found</div>
                    )}
                    {groupedCaptions.map(([langKey, caps]) => {
                        const isMulti = caps.length > 1;
                        const hasActiveChild = caps.some(c => c.url === currentCaption);
                        return (
                            <div key={langKey} className={`${rowCls} justify-between`} onClick={() => {
                                if (isMulti) { setActiveLangGroup(langKey); }
                                else { onSubtitleChange(caps[0].url); }
                            }}>
                                <div className="flex items-center overflow-hidden">
                                    <div className="w-8 flex-shrink-0 flex justify-center">
                                        {hasActiveChild && <CheckIcon size={20} weight="bold" className="text-white" />}
                                    </div>
                                    <span className={`text-base truncate transition-colors ${hasActiveChild ? 'text-white font-bold' : 'text-[#b3b3b3] hover:text-white'}`}>{caps[0].label}</span>
                                </div>
                                {isMulti && <CaretRightIcon size={14} weight="bold" className="text-white/40 ml-2 flex-shrink-0" />}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

// ─── Server Selection menu ────────────────────────────────────────────────
export const ServerPanel: React.FC<{
    allSources: any[];
    currentSourceIndex: number;
    onSourceChange: (index: number) => void;
    onClose: () => void;
}> = ({ allSources, currentSourceIndex, onSourceChange, onClose }) => {
    const isMobile = useIsMobile();
    const rowCls = `flex items-center justify-between px-4 ${isMobile ? 'py-4' : 'py-3'} cursor-pointer hover:bg-white/5 active:bg-white/10 transition rounded select-none`;

    return (
        <div className="flex flex-col h-full bg-[#262626]">
            {!isMobile && (
                <div className="px-8 py-6 border-b border-white/10 flex-shrink-0">
                    <span className="text-white text-2xl font-bold">Select Streaming Server</span>
                    <p className="text-sm text-white/40 mt-1">Switch servers if you experience buffering or if the current one is offline.</p>
                </div>
            )}
            <div className="overflow-y-auto scrollbar-thin scrollbar-thumb-[#555] scrollbar-track-transparent py-2">
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
    const rowCls = `flex items-center justify-between px-4 ${isMobile ? 'py-4' : 'py-2.5'} cursor-pointer hover:bg-white/5 active:bg-white/10 transition rounded select-none`;

    return (
        <div className="flex flex-col">
            <div className={`flex items-center ${isMobile ? rowCls : 'px-[70px] py-[25px] border-b border-white/5 bg-[#121212] cursor-default'}`} onClick={() => { onQualityChange(-1); onClose(); }}>
                {!isMobile && <CheckIcon size={20} weight="bold" className="absolute left-[25px] text-white" />}
                <div className="flex flex-col gap-2">
                    <span className={`text-xl font-bold ${currentQuality === -1 ? 'text-white' : 'text-white/60'}`}>Auto</span>
                    {!isMobile && <div className="text-sm text-[#b3b3b3] font-normal">Adjusts automatically.</div>}
                </div>
            </div>
            {qualities.map((q, i) => (
                <div key={i} className={`relative flex flex-col gap-2 ${isMobile ? rowCls : 'px-[70px] py-[25px] border-b border-white/5 transition-colors cursor-pointer hover:bg-white/5'} ${currentQuality === q.level ? 'bg-[#121212]' : ''}`} onClick={() => { onQualityChange(q.level); onClose(); }}>
                    {!isMobile && currentQuality === q.level && <CheckIcon size={20} weight="bold" className="absolute left-[25px] text-white" />}
                    <span className={`text-xl font-bold ${currentQuality === q.level ? 'text-white' : 'text-[#b3b3b3]'}`}>{q.height}p</span>
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
    // Two-click state: null = collapsed, number = expanded (info shown), 'ready:{id}' = second click plays
    const [expandedEpisodeId, setExpandedEpisodeId] = React.useState<number | null>(null);
    const episodesContainerRef = useRef<HTMLDivElement>(null);
    const currentEpisodeRef = useRef<HTMLDivElement>(null);

    React.useEffect(() => { setPreviewSeason(selectedSeason); }, [selectedSeason, activePanel]);

    // Auto-scroll to current episode when panel opens
    useEffect(() => {
        if (activePanel === 'episodes' && currentEpisodeRef.current && episodesContainerRef.current) {
            setTimeout(() => currentEpisodeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 120);
        }
    }, [activePanel, currentEpisode]);

    // Two-click handler:
    // First click on a collapsed episode → expand info
    // First click on an already-expanded episode → play it
    // Clicking a different episode → collapse the old one, expand the new one
    const handleEpisodeClick = (ep: Episode) => {
        if (expandedEpisodeId === ep.id) {
            // Second click → play
            onEpisodeSelect(ep);
            setActivePanel('none');
            setExpandedEpisodeId(null);
        } else {
            // First click → expand
            setExpandedEpisodeId(ep.id);
        }
    };

    const innerContent = (
        <div className="flex flex-col h-full bg-[#262626] font-sans text-white">
            {activePanel === 'seasons' && (
                <div className="flex flex-col h-full">
                    <div className="flex items-center px-[35px] py-[25px] border-b-2 border-white bg-[#262626] flex-shrink-0">
                        <span className="text-[28px] font-bold">{showTitle || 'Seasons'}</span>
                    </div>
                    <div className="overflow-y-auto scroll-list flex-1">
                        {seasonList.map(s => (
                            <div key={s} onClick={() => { setPreviewSeason(s); onSeasonSelect(s); setActivePanel('episodes'); }} className={`relative px-[70px] py-[25px] text-[22px] font-bold transition-colors cursor-pointer border-2 border-transparent hover:bg-white/5 ${selectedSeason === s ? 'border-white bg-[#262626]' : ''}`}>
                                {selectedSeason === s && <CheckIcon size={20} weight="bold" className="absolute left-[25px] top-1/2 -translate-y-1/2 text-white" />}
                                Season {s}
                            </div>
                        ))}
                    </div>
                </div>
            )}
            {activePanel === 'episodes' && (
                <div className="flex flex-col h-full">
                    {/* Clicking the season header goes back to season list */}
                    <div
                        className="flex items-center gap-3 px-[35px] py-[25px] border-b-2 border-white bg-[#262626] flex-shrink-0 cursor-pointer hover:text-[#b3b3b3] transition-colors"
                        onClick={() => setActivePanel('seasons')}
                        title="Switch season"
                    >
                        <ArrowLeftIcon size={22} weight="bold" className="text-white/60" />
                        <span className="text-[28px] font-bold">Season {previewSeason}</span>
                    </div>
                    <div ref={episodesContainerRef} className="overflow-y-auto scroll-list flex-1">
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
                                        className="flex items-center px-[35px] py-[28px] cursor-pointer gap-4"
                                        onClick={() => handleEpisodeClick(ep)}
                                        title={isExpanded ? `Play ${ep.name}` : `Expand ${ep.name}`}
                                    >
                                        {/* Episode number */}
                                        <span className={`text-xl font-bold w-[35px] flex-shrink-0 ${isCurrentlyPlaying ? 'text-[#e50914]' : 'text-white/60'}`}>
                                            {ep.episode_number}
                                        </span>
                                        {/* Name */}
                                        <span className={`text-xl font-bold flex-1 truncate ${isCurrentlyPlaying ? 'text-white' : 'text-white/90'}`}>
                                            {ep.name}
                                        </span>
                                        {/* Progress bar */}
                                        {perc > 0 && (
                                            <div className="w-[80px] h-[3px] bg-white/20 flex-shrink-0 rounded-full overflow-hidden">
                                                <div className="h-full bg-red-600 rounded-full" style={{ width: `${Math.min(100, perc)}%` }} />
                                            </div>
                                        )}
                                        {/* Expand/play caret */}
                                        <CaretRightIcon
                                            size={16}
                                            weight="bold"
                                            className={`flex-shrink-0 transition-transform text-white/40 ${isExpanded ? 'rotate-90' : ''}`}
                                        />
                                    </div>

                                    {/* Expanded info — click thumbnail or the row again to play */}
                                    {isExpanded && (
                                        <div
                                            className="px-[35px] pb-[28px] flex gap-5 cursor-pointer group/ep-play"
                                            onClick={() => { onEpisodeSelect(ep); setActivePanel('none'); setExpandedEpisodeId(null); }}
                                            title={`Play ${ep.name}`}
                                        >
                                            {ep.still_path && (
                                                <div className="relative flex-shrink-0">
                                                    <img
                                                        src={`https://image.tmdb.org/t/p/w300${ep.still_path}`}
                                                        className="w-[180px] h-[101px] object-cover rounded-sm group-hover/ep-play:brightness-75 transition"
                                                        alt={ep.name}
                                                    />
                                                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/ep-play:opacity-100 transition">
                                                        <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center">
                                                            <PlayCircleIcon size={28} weight="fill" className="text-black" />
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                            <p className="text-sm text-white/60 line-clamp-4 leading-relaxed">{ep.overview || 'No description available.'}</p>
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
            <div className="fixed inset-0 z-[120] flex flex-col justify-end" onClick={(e) => { if (e.target === e.currentTarget) onClose ? onClose() : setActivePanel('none'); }}>
                <div className="bg-[#1c1c1c] rounded-t-2xl shadow-2xl flex flex-col overflow-hidden animate-slideIn" style={{ maxHeight: '65vh' }} onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                        <span className="text-white text-base font-bold uppercase">{activePanel === 'seasons' ? 'Seasons' : `Season ${previewSeason}`}</span>
                        <button onClick={() => onClose ? onClose() : setActivePanel('none')} className="p-2 text-white/70"><XIcon size={22} weight="bold" /></button>
                    </div>
                    <div className="overflow-y-auto flex-1">{innerContent}</div>
                </div>
            </div>
        );
    }

    return (
        <div className="absolute bottom-16 rounded-none border-2 border-white shadow-2xl z-[120] flex flex-col animate-fadeIn right-0 w-[400px] lg:w-[800px] h-[70vh] bg-[#262626]" onMouseLeave={() => onClose ? onClose() : setActivePanel('none')}>
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
                    onLeave={close}
                    desktopClass="bottom-16 right-0 w-[400px] lg:w-[550px] h-[480px]"
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