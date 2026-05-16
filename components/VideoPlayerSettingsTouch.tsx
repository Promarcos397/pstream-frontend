import React, { useRef, useEffect, useState } from 'react';
import { Episode, InternalTrack } from '../types';
import { ArrowLeftIcon, CheckIcon, CaretRightIcon, XIcon, PlayIcon } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { useGlobalContext } from '../context/GlobalContext';

const commonPanelCls = "bg-[#262626] flex flex-col overflow-hidden animate-fadeIn fixed z-[120]";

// ─── Shared: compact panel wrapper ────────────────────────────────────────────
export const PanelShellTouch: React.FC<{
    title: string;
    onClose: () => void;
    children: React.ReactNode;
}> = ({ title, onClose, children }) => {
    return (
        <div
            className="fixed inset-0 z-[120] pointer-events-auto bg-black/60 backdrop-blur-sm"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
            onTouchStart={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div
                id="video-panel-shell-touch"
                className={`${commonPanelCls} w-[90vw] max-w-[400px] max-h-[80svh] pointer-events-auto rounded-xl shadow-2xl left-1/2 -translate-x-1/2`}
                style={{ bottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
                onClick={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 flex-shrink-0">
                    <span className="text-white text-lg font-bold tracking-wide uppercase">{title}</span>
                    <button
                        onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); onClose(); }}
                        className="w-10 h-10 flex items-center justify-center text-white/50 active:text-white bg-white/5 rounded-full"
                    >
                        <XIcon size={30} weight="bold" />
                    </button>
                </div>
                <div className="overflow-y-auto flex-1 scrollbar-none">{children}</div>
            </div>
        </div>
    );
};

export const AudioSubPanelTouch: React.FC<{
    captions: Array<{ id: string; label: string; url: string; lang: string }>;
    currentCaption: string | null;
    onSubtitleChange: (url: string | null) => void;
    audioTracks: Array<{ id: number; name: string; lang: string }>;
    currentAudioTrack: number;
    onAudioChange: (trackId: number) => void;
    internalTracks?: InternalTrack[];
    selectedAudioTrackId?: number | null;
    selectedSubtitleTrackId?: number | null;
    onInternalAudioChange?: (id: number) => void;
    onInternalSubtitleChange?: (id: number) => void;
    onClose: () => void;
    subtitleOffset?: number;
    onSubtitleOffsetChange?: (offset: number) => void;
}> = ({ captions, currentCaption, onSubtitleChange, audioTracks, currentAudioTrack, onAudioChange, internalTracks = [], selectedAudioTrackId, selectedSubtitleTrackId, onInternalAudioChange, onInternalSubtitleChange, onClose, subtitleOffset = 0, onSubtitleOffsetChange }) => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<'audio' | 'subtitles'>('subtitles');

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

    const rowCls = `flex items-center px-4 py-4 cursor-pointer active:bg-white/10 transition-colors duration-150 select-none group border-b border-white/5`;

    return (
        <div className="flex flex-col h-full">
            <div className="flex border-b border-white/10 shrink-0">
                <button 
                    className={`flex-1 py-3 text-sm font-bold uppercase tracking-wider transition-colors ${activeTab === 'audio' ? 'text-white border-b-2 border-red-500' : 'text-white/50'}`}
                    onClick={() => setActiveTab('audio')}
                >
                    Audio
                </button>
                <button 
                    className={`flex-1 py-3 text-sm font-bold uppercase tracking-wider transition-colors ${activeTab === 'subtitles' ? 'text-white border-b-2 border-red-500' : 'text-white/50'}`}
                    onClick={() => setActiveTab('subtitles')}
                >
                    Subtitles
                </button>
            </div>

            {activeTab === 'audio' ? (
                <ul className="flex-1 overflow-y-auto scrollbar-none">
                    {audioTracks.map((track) => (
                        <li 
                            key={track.id} 
                            className={`${rowCls} ${currentAudioTrack === track.id ? 'text-white bg-white/5' : 'text-[#b3b3b3]'}`} 
                            onClick={(e) => { e.stopPropagation(); onAudioChange(track.id); }}
                        >
                            <div className="w-8 flex-shrink-0 flex justify-center">
                                {currentAudioTrack === track.id && <CheckIcon size={30} weight="bold" className="text-red-500" />}
                            </div>
                            <span className="text-base truncate">{track.name} {track.lang && track.lang.toLowerCase() !== 'unknown' ? `[${track.lang.toUpperCase()}]` : ''}</span>
                        </li>
                    ))}

                    {/* Internal Audio Tracks */}
                    {internalTracks.filter(t => t.type === 'audio').map((track) => (
                        <li 
                            key={`internal-${track.id}`} 
                            className={`${rowCls} ${selectedAudioTrackId === track.id ? 'text-white bg-white/5' : 'text-[#b3b3b3]'}`} 
                            onClick={(e) => { e.stopPropagation(); onInternalAudioChange?.(track.id); }}
                        >
                            <div className="w-8 flex-shrink-0 flex justify-center">
                                {selectedAudioTrackId === track.id && <CheckIcon size={30} weight="bold" className="text-red-500" />}
                            </div>
                            <div className="flex flex-col overflow-hidden">
                                <span className="text-base truncate font-bold">{track.name || `Audio Track ${track.id}`}</span>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs opacity-60 uppercase">{track.language || 'Unknown'}</span>
                                    <span className="text-xs bg-white/10 px-1 rounded uppercase">{track.codec.replace('A_', '')}</span>
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>
            ) : (
                <div className="flex flex-col flex-1 overflow-hidden">
                    {onSubtitleOffsetChange && (
                        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 bg-white/5 shrink-0">
                            <div className="flex flex-col">
                                <span className="text-sm font-bold text-white">Sync Subtitles</span>
                                <span className="text-xs text-white/50">{subtitleOffset === 0 ? 'Default timing' : `${subtitleOffset > 0 ? '+' : ''}${subtitleOffset.toFixed(1)}s delay`}</span>
                            </div>
                            <div className="flex items-center gap-2 bg-black/40 rounded-full p-1">
                                <button
                                    onClick={(e) => { e.stopPropagation(); onSubtitleOffsetChange(parseFloat((subtitleOffset - 0.5).toFixed(1))); }}
                                    className="w-10 h-10 flex items-center justify-center text-white/80 hover:text-white bg-white/5 hover:bg-white/10 active:scale-95 rounded-full transition font-bold text-xl"
                                    title="Show Earlier"
                                >−</button>
                                <span className="text-sm text-white font-mono w-12 text-center select-none font-bold">
                                    {subtitleOffset === 0 ? '0.0s' : `${subtitleOffset > 0 ? '+' : ''}${subtitleOffset.toFixed(1)}s`}
                                </span>
                                <button
                                    onClick={(e) => { e.stopPropagation(); onSubtitleOffsetChange(parseFloat((subtitleOffset + 0.5).toFixed(1))); }}
                                    className="w-10 h-10 flex items-center justify-center text-white/80 hover:text-white bg-white/5 hover:bg-white/10 active:scale-95 rounded-full transition font-bold text-xl"
                                    title="Show Later"
                                >+</button>
                            </div>
                        </div>
                    )}
                    <ul className="overflow-y-auto flex-1 menu-list list-none p-0 m-0">
                        <li 
                            className={`${rowCls} ${currentCaption === null ? 'text-white bg-white/5' : 'text-[#b3b3b3]'}`} 
                            onClick={(e) => { e.stopPropagation(); onSubtitleChange(null); onClose(); }}
                        >
                            <div className="w-8 flex-shrink-0 flex justify-center">
                                {currentCaption === null && <CheckIcon size={30} weight="bold" className="text-red-500" />}
                            </div>
                            <span className="text-base">{t('player.off')}</span>
                        </li>

                        {groupedCaptions.flatMap(([langKey, caps]) => {
                            return caps.map((cap, index) => {
                                const displayLabel = caps.length > 1 ? `${cap.label} (Track ${index + 1})` : cap.label;
                                const isSelected = cap.url === currentCaption;
                                return (
                                    <li 
                                        key={cap.id || `${langKey}-${index}`} 
                                        className={`${rowCls} ${isSelected ? 'text-white bg-white/5' : 'text-[#b3b3b3]'}`} 
                                        onClick={(e) => { e.stopPropagation(); onSubtitleChange(cap.url); onClose(); }}
                                    >
                                        <div className="w-8 flex-shrink-0 flex justify-center">
                                            {isSelected && <CheckIcon size={30} weight="bold" className="text-red-500" />}
                                        </div>
                                        <span className="text-base truncate">{displayLabel}</span>
                                    </li>
                                );
                            });
                        })}

                        {/* Internal Subtitles */}
                        {internalTracks.filter(t => t.type === 'subtitle').map((track) => (
                            <li 
                                key={`internal-sub-${track.id}`} 
                                className={`${rowCls} ${selectedSubtitleTrackId === track.id ? 'text-white bg-white/5' : 'text-[#b3b3b3]'}`} 
                                onClick={(e) => { e.stopPropagation(); onInternalSubtitleChange?.(track.id); }}
                            >
                                <div className="w-8 flex-shrink-0 flex justify-center">
                                    {selectedSubtitleTrackId === track.id && <CheckIcon size={30} weight="bold" className="text-red-500" />}
                                </div>
                                <div className="flex flex-col overflow-hidden">
                                    <span className="text-base truncate font-bold">{track.name || `Internal Subtitle ${track.id}`}</span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs opacity-60 uppercase">{track.language || 'Unknown'}</span>
                                        <span className="text-xs bg-white/10 px-1 rounded uppercase">{track.codec.replace('S_TEXT/', '')}</span>
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

// ─── Server Selection menu ────────────────────────────────────────────────
export const ServerPanelTouch: React.FC<{
    allSources: any[];
    currentSourceIndex: number;
    onSourceChange: (index: number) => void;
    onClose: () => void;
}> = ({ allSources, currentSourceIndex, onSourceChange, onClose }) => {
    const rowCls = `flex items-center justify-between px-4 py-4 cursor-pointer active:bg-white/10 transition border-b border-white/5 select-none`;

    return (
        <div className="overflow-y-auto py-2">
            {allSources.map((source, i) => (
                <div key={i} className={`${rowCls} ${currentSourceIndex === i ? 'bg-white/5' : ''}`} onClick={() => { onSourceChange(i); onClose(); }}>
                    <div className="flex items-center gap-4 overflow-hidden">
                        <div className="w-8 flex-shrink-0 flex justify-center">
                            {currentSourceIndex === i && <CheckIcon size={30} weight="bold" className="text-red-500" />}
                        </div>
                        <div className="flex flex-col overflow-hidden">
                            <span className={`text-base font-bold ${currentSourceIndex === i ? 'text-white' : 'text-white/80'}`}>
                                {source.name || source.provider || `Server ${i + 1}`}
                            </span>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] uppercase font-bold text-white/30">{source.provider || 'External'}</span>
                                <span className="text-[10px] text-white/30">•</span>
                                <span className="text-xs text-white/40 truncate">{source.quality || 'Auto'} • {source.isM3U8 ? 'Adaptive' : 'Direct'}</span>
                            </div>
                        </div>
                    </div>
                </div>
            ))}
            

        </div>
    );
};

// ─── Playback settings panel ───────────────────────────────────────────────
export const PlaybackPanelTouch: React.FC<{
    onClose: () => void;
}> = ({ onClose }) => {
    const { settings, updateSettings } = useGlobalContext();

    const rowCls = "flex items-center justify-between px-6 py-5 cursor-pointer active:bg-white/10 transition-colors duration-150 select-none group border-b border-white/5";

    return (
        <div className="flex flex-col h-full bg-[#262626]">
            {/* Autoplay Video */}
            <div 
                className={rowCls}
                onClick={() => updateSettings({ autoplayVideo: !settings.autoplayVideo })}
            >
                <div className="flex flex-col">
                    <span className="text-white text-base font-bold">Autoplay Video</span>
                    <span className="text-white/40 text-xs">Start video immediately when content loads</span>
                </div>
                <div className={`w-12 h-6 rounded-full relative transition-colors duration-200 ${settings.autoplayVideo ? 'bg-red-600' : 'bg-zinc-700'}`}>
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-200 ${settings.autoplayVideo ? 'left-7' : 'left-1'}`} />
                </div>
            </div>

            {/* Autoplay Next Episode */}
            <div 
                className={rowCls}
                onClick={() => updateSettings({ autoplayNextEpisode: !settings.autoplayNextEpisode })}
            >
                <div className="flex flex-col">
                    <span className="text-white text-base font-bold">Autoplay Next Episode</span>
                    <span className="text-white/40 text-xs">Automatically transition to the next episode</span>
                </div>
                <div className={`w-12 h-6 rounded-full relative transition-colors duration-200 ${settings.autoplayNextEpisode ? 'bg-red-600' : 'bg-zinc-700'}`}>
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-200 ${settings.autoplayNextEpisode ? 'left-7' : 'left-1'}`} />
                </div>
            </div>
        </div>
    );
};

// ─── Quality menu ──────────────────────────────────────────────────────────
export const QualityMenuTouch: React.FC<{
    qualities: Array<{ height: number; bitrate: number; level: number }>;
    currentQuality: number;
    onQualityChange: (level: number) => void;
    onClose: () => void;
    allSources?: any[];
    currentSourceIndex?: number;
    onSourceChange?: (index: number) => void;
    onRequestFallback?: () => void;
}> = ({ qualities, currentQuality, onQualityChange, onClose, allSources, currentSourceIndex, onSourceChange, onRequestFallback }) => {
    const rowCls = `flex items-center px-4 py-4 cursor-pointer active:bg-white/10 transition border-b border-white/5 select-none`;

    // 1. If it's a Debrid/Direct stream, show all sources as quality levels
    if (allSources && allSources.length > 0 && (!qualities || qualities.length === 0)) {
        const uniqueQualities = allSources.reduce((acc: any[], src, idx) => {
            const label = src.quality || 'Auto';
            if (!acc.find(a => a.label === label)) {
                acc.push({ label, index: idx, seeders: src.seeders || 0 });
            }
            return acc;
        }, []);

        return (
            <div className="flex flex-col">
                {uniqueQualities.map((q) => {
                    const isSelected = currentSourceIndex === q.index || (allSources[currentSourceIndex || 0]?.quality === q.label);
                    return (
                        <div key={q.index} className={`${rowCls} ${isSelected ? 'bg-white/5' : ''}`} onClick={() => { if (onSourceChange) onSourceChange(q.index); onClose(); }}>
                            <div className="w-8 flex-shrink-0 flex justify-center">
                                {isSelected && <CheckIcon size={30} weight="bold" className="text-red-500" />}
                            </div>
                            <div className="flex flex-col">
                                <span className={`text-base font-bold ${isSelected ? 'text-white' : 'text-white/80'}`}>{q.label}</span>
                                {q.seeders > 0 && <span className="text-[10px] text-white/40 uppercase font-bold">{q.seeders} SEEDERS</span>}
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    }

    // 2. Fallback for HLS streams
    if (qualities && qualities.length > 0) {
        return (
            <div className="flex flex-col">
                <div className={`${rowCls} ${currentQuality === -1 ? 'bg-white/5' : ''}`} onClick={() => { onQualityChange(-1); onClose(); }}>
                    <div className="w-8 flex-shrink-0 flex justify-center">
                        {currentQuality === -1 && <CheckIcon size={30} weight="bold" className="text-red-500" />}
                    </div>
                    <div className="flex flex-col gap-0.5">
                        <span className={`text-base font-bold ${currentQuality === -1 ? 'text-white' : 'text-white/60'}`}>Auto</span>
                    </div>
                </div>
                {qualities.map((q, i) => (
                    <div
                        key={i}
                        className={`${rowCls} ${currentQuality === q.level ? 'bg-white/5' : ''}`}
                        onClick={() => { onQualityChange(q.level); onClose(); }}
                    >
                        <div className="w-8 flex-shrink-0 flex justify-center">
                            {currentQuality === q.level && <CheckIcon size={30} weight="bold" className="text-red-500" />}
                        </div>
                        <span className={`text-base font-bold ${currentQuality === q.level ? 'text-white' : 'text-white/60'}`}>
                            {q.height > 0 ? `${q.height}p` : 'Unknown'}
                        </span>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="p-8 text-center text-white/40 text-sm">
            Quality selection is unavailable for this source.
        </div>
    );
};

// ─── Episode explorer ──────────────────────────────────────────────────────
export const EpisodeExplorerTouch: React.FC<{
    seasonList: number[];
    currentSeasonEpisodes: Episode[];
    selectedSeason: number;
    currentEpisode: number;
    playingSeason?: number;
    showId: number | string;
    onSeasonSelect: (season: number) => void;
    onEpisodeSelect: (ep: Episode) => void;
    activePanel: string;
    setActivePanel: (panel: any) => void;
    onClose?: () => void;
}> = ({ seasonList, currentSeasonEpisodes, selectedSeason, currentEpisode, playingSeason, showId, onSeasonSelect, onEpisodeSelect, activePanel, setActivePanel, onClose }) => {
    const { getEpisodeProgress } = useGlobalContext();
    const [previewSeason, setPreviewSeason] = React.useState(selectedSeason);
    const [expandedEpisodeId, setExpandedEpisodeId] = React.useState<number | null>(null);
    const episodesContainerRef = useRef<HTMLDivElement>(null);
    const currentEpisodeRef = useRef<HTMLDivElement>(null);

    React.useEffect(() => { setPreviewSeason(playingSeason || selectedSeason); }, [selectedSeason, playingSeason, activePanel]);

    useEffect(() => {
        if (activePanel === 'episodes' && currentSeasonEpisodes.length > 0) {
            const playingEp = currentSeasonEpisodes.find(e => e.episode_number === currentEpisode);
            if (playingEp) setExpandedEpisodeId(playingEp.id);
            if (currentEpisodeRef.current && episodesContainerRef.current) {
                setTimeout(() => currentEpisodeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 150);
            }
        }
    }, [activePanel, currentEpisode, currentSeasonEpisodes.length]);

    const handleEpisodeClick = (ep: Episode) => {
        setExpandedEpisodeId(expandedEpisodeId === ep.id ? null : ep.id);
    };

    const innerContent = (
        <div className="flex flex-col h-full bg-[#262626] font-sans text-white">
            {activePanel === 'seasons' && (
                <div className="overflow-y-auto flex-1">
                    {seasonList.map(s => (
                        <div 
                            key={s} 
                            onClick={(e) => { 
                                e.stopPropagation(); 
                                setPreviewSeason(s); 
                                onSeasonSelect(s); 
                                setActivePanel('episodes'); 
                            }} 
                            className={`flex items-center px-6 py-4 text-lg font-bold transition-colors active:bg-white/10 border-b border-white/5 ${selectedSeason === s ? 'bg-white/5' : ''}`}
                        >
                            <div className="w-8 flex-shrink-0">
                                {selectedSeason === s && <CheckIcon size={30} weight="bold" className="text-red-500" />}
                            </div>
                            Season {s}
                        </div>
                    ))}
                </div>
            )}
            {activePanel === 'episodes' && (
                <div className="flex flex-col h-full">
                    <div
                        className="flex items-center gap-3 px-5 py-4 border-b border-white/10 bg-[#262626] flex-shrink-0 active:bg-white/5 transition-colors"
                        onClick={(e) => { e.stopPropagation(); setActivePanel('seasons'); }}
                    >
                        <ArrowLeftIcon size={28} weight="bold" className="text-white" />
                        <span className="text-lg font-bold">Season {previewSeason}</span>
                    </div>
                    <div ref={episodesContainerRef} className="overflow-y-auto flex-1 scrollbar-hide pb-8">
                        {currentSeasonEpisodes.map(ep => {
                            const isCurrentlyPlaying = currentEpisode === ep.episode_number && playingSeason === selectedSeason;
                            const isExpanded = expandedEpisodeId === ep.id;
                            const prog = getEpisodeProgress(showId, selectedSeason, ep.episode_number);
                            const perc = prog && prog.duration > 0 ? (prog.time / prog.duration) * 100 : 0;

                            return (
                                <div
                                    key={ep.id}
                                    ref={isCurrentlyPlaying ? currentEpisodeRef : null}
                                    className={`transition-colors border-b border-white/5 ${isCurrentlyPlaying || isExpanded ? 'bg-[#1a1a1a]' : 'active:bg-white/5'}`}
                                >
                                    <div
                                        className="flex items-center px-5 py-4 gap-3"
                                        onClick={(e) => { e.stopPropagation(); handleEpisodeClick(ep); }}
                                    >
                                        <span className={`flex-shrink-0 text-xl w-[36px] font-bold ${isCurrentlyPlaying ? 'text-red-500' : 'text-white/60'}`}>
                                            {ep.episode_number}
                                        </span>
                                        <div className="flex-1 flex flex-col overflow-hidden">
                                            <span className={`font-bold text-base truncate ${isCurrentlyPlaying ? 'text-white' : 'text-white/90'}`}>
                                                {ep.name}
                                            </span>
                                            {perc > 0 && (
                                                <div className="w-[100px] h-1 bg-white/20 rounded-full overflow-hidden mt-2">
                                                    <div className="h-full bg-red-500 rounded-full" style={{ width: `${Math.min(100, perc)}%` }} />
                                                </div>
                                            )}
                                        </div>
                                        <CaretRightIcon
                                            size={26}
                                            weight="bold"
                                            className={`flex-shrink-0 transition-transform text-white/40 ${isExpanded ? 'rotate-90' : ''}`}
                                        />
                                    </div>

                                    {/* Expanded info - FIXED HIT AREA */}
                                    {isExpanded && (
                                        <div className="px-5 pb-5 flex flex-col gap-3">
                                            <div className="flex gap-4">
                                                {ep.still_path && (
                                                    <div className="relative flex-shrink-0 w-[120px] rounded-lg overflow-hidden border border-white/10">
                                                        <img
                                                            src={`https://image.tmdb.org/t/p/w300${ep.still_path}`}
                                                            className="w-full h-auto aspect-video object-cover"
                                                            alt={ep.name}
                                                        />
                                                    </div>
                                                )}
                                                <div className="flex-1 flex flex-col justify-center">
                                                    <p className="text-sm text-white/60 leading-snug line-clamp-3">
                                                        {ep.overview || 'No description available.'}
                                                    </p>
                                                </div>
                                            </div>
                                            
                                            {/* EXPLICIT PLAY BUTTON FOR EPISODE */}
                                            <button 
                                                className="mt-2 w-full py-3 bg-white text-black font-bold text-base rounded-full flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
                                                onClick={(e) => { 
                                                    e.stopPropagation(); 
                                                    onEpisodeSelect(ep); 
                                                    setActivePanel('none'); 
                                                    setExpandedEpisodeId(null); 
                                                }}
                                            >
                                                <PlayIcon size={30} weight="fill" />
                                                Play Episode {ep.episode_number}
                                            </button>
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

    return (
        <div 
            className="fixed inset-0 z-[120] pointer-events-auto bg-black/60 backdrop-blur-sm" 
            onClick={(e) => { if (e.target === e.currentTarget) onClose ? onClose() : setActivePanel('none'); }}
            onTouchStart={(e) => { if (e.target === e.currentTarget) onClose ? onClose() : setActivePanel('none'); }}
        >
            <div
                id="video-panel-shell-touch"
                className={`${commonPanelCls} w-full max-h-[85svh] rounded-t-2xl shadow-[0_-10px_40px_rgba(0,0,0,0.5)]`}
                style={{ bottom: 0, right: 0, left: 0 }}
                onClick={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 flex-shrink-0">
                    <span className="text-white text-lg font-bold uppercase tracking-wider">{activePanel === 'seasons' ? 'Seasons' : 'Episodes'}</span>
                    <button onClick={() => onClose ? onClose() : setActivePanel('none')} className="w-10 h-10 flex items-center justify-center text-white/60 active:text-white bg-white/5 rounded-full">
                        <XIcon size={30} weight="bold" />
                    </button>
                </div>
                <div className="overflow-y-auto flex-1">{innerContent}</div>
            </div>
        </div>
    );
};

// ─── Main export ───────────────────────────────────────────────────────────
interface VideoPlayerSettingsTouchProps {
    activePanel: 'none' | 'episodes' | 'seasons' | 'audioSubtitles' | 'quality' | 'servers' | 'playback';
    setActivePanel: (panel: any) => void;
    seasonList: number[];
    currentSeasonEpisodes: Episode[];
    selectedSeason: number;
    currentEpisode: number;
    playingSeason?: number;
    showId: number | string;
    onSeasonSelect: (season: number) => void;
    onEpisodeSelect: (ep: Episode) => void;
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
    internalTracks: InternalTrack[];
    selectedAudioTrackId: number | null;
    selectedSubtitleTrackId: number | null;
    onInternalAudioChange: (id: number) => void;
    onInternalSubtitleChange: (id: number) => void;
    allSources: any[];
    currentSourceIndex: number;
    onSourceChange: (index: number) => void;
}

const VideoPlayerSettingsTouch: React.FC<VideoPlayerSettingsTouchProps> = (props) => {
    if (props.activePanel === 'none') return null;
    const close = () => props.setActivePanel('none');

    return (
        <>
            {props.activePanel === 'audioSubtitles' && (
                <PanelShellTouch title="Audio & Subtitles" onClose={close}>
                    <AudioSubPanelTouch {...props} onClose={close} />
                </PanelShellTouch>
            )}
            {props.activePanel === 'quality' && (
                <PanelShellTouch title="Video Quality" onClose={close}>
                    <QualityMenuTouch {...props} onClose={close} />
                </PanelShellTouch>
            )}
            {(props.activePanel === 'seasons' || props.activePanel === 'episodes') && (
                <EpisodeExplorerTouch {...props} onClose={close} />
            )}
            {props.activePanel === 'servers' && (
                <PanelShellTouch title="Servers" onClose={close}>
                    <ServerPanelTouch {...props} onClose={close} />
                </PanelShellTouch>
            )}
            {props.activePanel === 'playback' && (
                <PanelShellTouch title="Playback Settings" onClose={close}>
                    <PlaybackPanelTouch onClose={close} />
                </PanelShellTouch>
            )}
        </>
    );
};

export default VideoPlayerSettingsTouch;
