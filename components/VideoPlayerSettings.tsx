import React, { useRef, useEffect } from 'react';
import { Episode } from '../types';
import { ArrowLeftIcon, CaretDownIcon, PlayCircleIcon, CheckIcon, CaretRightIcon, XIcon } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { useGlobalContext } from '../context/GlobalContext';
import { useIsMobile } from '../hooks/useIsMobile';

// ─── Shared: compact panel wrapper ────────────────────────────────────────────
// On mobile: slides up from the bottom as a sheet (max 55vh).
// On desktop: small floating overlay anchored above the controls.
export const PanelShell: React.FC<{
    title: string;
    onClose: () => void;
    onHover?: () => void;
    onLeave?: () => void;
    children: React.ReactNode;
    /** Override desktop positioning class */
    desktopClass?: string;
    showHeader?: boolean;
}> = ({ title, onClose, onHover, onLeave, children, desktopClass, showHeader = false }) => {
    const isMobile = useIsMobile();

    if (isMobile) {
        return (
            // Backdrop
            <div
                className="fixed inset-0 z-[120] flex flex-col justify-end"
                onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
            >
                {/* Sheet */}
                <div
                    className="bg-[#1c1c1c] rounded-t-2xl shadow-2xl flex flex-col overflow-hidden animate-slideIn"
                    style={{ maxHeight: '58vh' }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
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

    // Desktop: Premium cinetmatic panel above controls
    // Using sharp corners (rounded-none) and 2px white border per reference
    return (
        <div
            className={`absolute z-[120] bg-[#262626] rounded-none border-2 border-white shadow-[0px_20px_50px_rgba(0,0,0,0.9)] flex flex-col overflow-hidden animate-fadeIn font-sans ${desktopClass || 'bottom-24 right-4 w-[340px] lg:w-[480px] max-h-[70vh]'}`}
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
                {/* Off */}
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
            {audioTracks.length > 0 && renderAudioColumn()}
            {renderSubtitleColumn()}
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

    const handleSelect = (level: number) => {
        onQualityChange(level);
        onClose();
    };

    return (
        <div className="flex flex-col">
            <div className={`flex items-center ${isMobile ? rowCls : 'px-[70px] py-[25px] border-b border-white/5 bg-[#121212] cursor-default'}`} onClick={() => !isMobile ? null : handleSelect(-1)}>
                {!isMobile && <CheckIcon size={20} weight="bold" className="absolute left-[25px] text-white" />}
                <div className="flex flex-col gap-2">
                    <span className={`text-xl font-bold ${currentQuality === -1 ? 'text-white' : 'text-white/60'}`}>Auto</span>
                    {!isMobile && <div className="text-sm text-[#b3b3b3] font-normal">Adjusts automatically to deliver the highest possible quality based on your connection.</div>}
                </div>
                {isMobile && currentQuality === -1 && <CheckIcon size={14} weight="bold" className="text-white" />}
            </div>
            {qualities.map((q, i) => (
                <div key={i} className={`relative flex flex-col gap-2 ${isMobile ? rowCls : 'px-[70px] py-[25px] border-b border-white/5 transition-colors cursor-pointer hover:bg-white/5'} ${currentQuality === q.level ? 'bg-[#121212]' : ''}`} onClick={() => handleSelect(q.level)}>
                    {currentQuality === q.level && (
                        <CheckIcon size={20} weight="bold" className={`absolute left-[25px] text-white ${isMobile ? 'hidden' : 'block'}`} />
                    )}
                    <span className={`text-xl font-bold ${currentQuality === q.level ? 'text-white' : 'text-[#b3b3b3]'}`}>
                        {q.height}p {q.height >= 1080 ? 'HD' : ''}
                    </span>
                    {!isMobile && (
                        <div className="text-sm text-[#b3b3b3] font-normal">
                            {q.height >= 2160 ? 'Ultra HD experience. Highest data usage.' : q.height >= 1080 ? 'Full HD experience. Significant data usage.' : 'Good video quality with moderate data usage.'}
                        </div>
                    )}
                    {isMobile && currentQuality === q.level && <CheckIcon size={14} weight="bold" className="text-white" />}
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
    activePanel: 'seasons' | 'episodes' | string;
    setActivePanel: (panel: any) => void;
    showTitle?: string;
    onPanelHover?: () => void;
    onClose?: () => void;
}> = ({ seasonList, currentSeasonEpisodes, selectedSeason, currentEpisode, playingSeason, showId, onSeasonSelect, onEpisodeSelect, onEpisodeExpand, activePanel, setActivePanel, showTitle, onPanelHover, onClose }) => {
    const { t } = useTranslation();
    const isMobile = useIsMobile();
    const { getEpisodeProgress } = useGlobalContext();
    const [previewSeason, setPreviewSeason] = React.useState(selectedSeason);
    const [expandedEpisodeId, setExpandedEpisodeId] = React.useState<number | null>(null);
    const episodesContainerRef = useRef<HTMLDivElement>(null);
    const currentEpisodeRef = useRef<HTMLDivElement>(null);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    React.useEffect(() => { setPreviewSeason(selectedSeason); }, [selectedSeason, activePanel]);

    React.useEffect(() => {
        if (playingSeason === selectedSeason) {
            const playingEp = currentSeasonEpisodes.find(ep => ep.episode_number === currentEpisode);
            if (playingEp) setExpandedEpisodeId(playingEp.id);
        }
    }, [selectedSeason, playingSeason, currentEpisode, currentSeasonEpisodes]);

    useEffect(() => {
        if (activePanel === 'episodes' && currentEpisodeRef.current && episodesContainerRef.current) {
            setTimeout(() => currentEpisodeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
        }
    }, [activePanel, currentEpisode]);

    const getEpisodeProgressPercent = (season: number, epNumber: number): number => {
        const progress = getEpisodeProgress(showId, season, epNumber);
        return progress && progress.duration > 0 ? Math.min((progress.time / progress.duration) * 100, 100) : 0;
    };

    const handleSeasonClick = (s: number) => {
        setPreviewSeason(s);
        onSeasonSelect(s);
        setActivePanel('episodes');
    };

    const closePanel = onClose || (() => setActivePanel('none'));

    const rowCls = `flex items-center px-4 ${isMobile ? 'py-4' : 'py-3'} cursor-pointer hover:bg-white/5 active:bg-white/10 transition select-none`;

    const innerContent = (
        <div className="flex flex-col h-full bg-[#262626] font-sans">
            {activePanel === 'seasons' && (
                <div className="flex flex-col h-full">
                    {/* Seasons view header matching smallville design reference */}
                    <div className="flex items-center px-[35px] py-[25px] border-b-2 border-white bg-[#262626] flex-shrink-0">
                        <span className="text-[28px] font-bold text-white">{showTitle || 'Seasons'}</span>
                    </div>
                    <div className="overflow-y-auto scroll-list flex-1">
                        {seasonList.map(s => (
                            <div key={s} onClick={() => handleSeasonClick(s)} className={`relative px-[70px] py-[25px] text-[22px] font-bold transition-colors cursor-pointer border-2 border-transparent hover:bg-white/5 ${selectedSeason === s ? 'border-white bg-[#262626]' : ''}`}>
                                {selectedSeason === s && (
                                    <CheckIcon size={20} weight="bold" className="absolute left-[25px] top-1/2 -translate-y-1/2 text-white" />
                                )}
                                {t('player.season')} {s}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {activePanel === 'episodes' && (
                <div className="flex flex-col h-full">
                    <div className="flex items-center px-[35px] py-[25px] border-b-2 border-white bg-[#262626] flex-shrink-0 cursor-pointer hover:text-[#b3b3b3] transition-colors" onClick={() => setActivePanel('seasons')}>
                        <ArrowLeftIcon size={26} weight="light" className="mr-5" />
                        <span className="text-[28px] font-bold">{t('player.season')} {previewSeason}</span>
                    </div>

                    <div ref={episodesContainerRef} className="overflow-y-auto scroll-list flex-1">
                        {currentSeasonEpisodes.map(ep => {
                            const isPlaying = currentEpisode === ep.episode_number && playingSeason === selectedSeason;
                            const isExpanded = expandedEpisodeId === ep.id;
                            const progressPerc = getEpisodeProgressPercent(selectedSeason, ep.episode_number);

                            return (
                                <div
                                    key={ep.id}
                                    ref={isPlaying ? currentEpisodeRef : null}
                                    className={`transition-colors border-b border-transparent ${isPlaying || isExpanded ? 'bg-[#121212]' : 'hover:bg-white/5'}`}
                                >
                                    <div
                                        className="flex items-center px-[35px] py-[30px] cursor-pointer"
                                        onClick={() => {
                                            const newExp = isExpanded ? null : ep.id;
                                            setExpandedEpisodeId(newExp);
                                            if (newExp && onEpisodeExpand) onEpisodeExpand(selectedSeason, ep.episode_number);
                                        }}
                                    >
                                        <span className="text-xl font-bold w-[35px] flex-shrink-0">{ep.episode_number}</span>
                                        <span className="text-xl font-bold flex-1 truncate pr-[30px]">{ep.name}</span>
                                        <div className="w-[140px] h-[2px] bg-[#555] flex-shrink-0 overflow-hidden">
                                            <div className="h-full bg-[#E50914]" style={{ width: `${progressPerc}%` }} />
                                        </div>
                                    </div>

                                    {isExpanded && (
                                        <div className="flex gap-5 px-[35px] pb-[30px] mt-2 animate-fadeIn items-start">
                                            {ep.still_path ? (
                                                <div
                                                    className="relative flex-shrink-0 cursor-pointer group w-[220px]"
                                                    onClick={(e) => { e.stopPropagation(); onEpisodeSelect({ ...ep, season_number: selectedSeason }); setActivePanel('none'); }}
                                                >
                                                    <img
                                                        src={`https://image.tmdb.org/t/p/w300${ep.still_path}`}
                                                        alt={ep.name}
                                                        className="w-full h-[124px] rounded-none object-cover"
                                                    />
                                                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center group-hover:bg-black/40 transition">
                                                        <PlayCircleIcon size={48} weight="fill" className="text-white drop-shadow-md" />
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="w-[220px] h-[124px] bg-[#333] flex items-center justify-center text-white/20">
                                                    <PlayCircleIcon size={48} weight="fill" />
                                                </div>
                                            )}
                                            <div className="flex flex-col flex-1">
                                                <p className="text-[18px] leading-relaxed text-white line-clamp-5">{ep.overview || t('player.noDescription')}</p>
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
            <div
                className="fixed inset-0 z-[120] flex flex-col justify-end"
                onClick={(e) => { if (e.target === e.currentTarget) closePanel(); }}
            >
                <div
                    className="bg-[#1c1c1c] rounded-t-2xl shadow-2xl flex flex-col overflow-hidden animate-slideIn"
                    style={{ maxHeight: '60vh' }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 flex-shrink-0">
                        <span className="text-white text-base font-bold uppercase tracking-widest">
                            {activePanel === 'seasons' ? 'Seasons' : `Season ${previewSeason}`}
                        </span>
                        <button
                            onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); closePanel(); }}
                            className="p-2 -mr-2 text-white/70 active:text-white rounded-full active:bg-white/10"
                        >
                            <XIcon size={22} weight="bold" />
                        </button>
                    </div>
                    <div className="overflow-y-auto flex-1 scrollbar-none text-white">{innerContent}</div>
                </div>
            </div>
        );
    }

    // Desktop — PREMIUM CINEMATIC DESIGN (800px width per reference)
    return (
        <div
            className="absolute bottom-24 rounded-none border-2 border-white shadow-[0px_20px_50px_rgba(0,0,0,0.9)] z-[120] flex flex-col overflow-hidden animate-fadeIn font-sans text-white right-2 w-[400px] lg:w-[800px] h-[90vh] max-h-[700px] bg-[#262626]"
            onMouseEnter={onPanelHover}
            onMouseLeave={closePanel}
        >
            <style dangerouslySetInnerHTML={{ __html: `
                .scroll-list::-webkit-scrollbar { width: 12px; }
                .scroll-list::-webkit-scrollbar-track { background: transparent; border-left: 1px solid rgba(255,255,255,0.05); }
                .scroll-list::-webkit-scrollbar-thumb { background: #666; border-radius: 6px; border: 3px solid #262626; }
            `}} />
            {innerContent}
        </div>
    );
};

// ─── Main export ───────────────────────────────────────────────────────────
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
    audioTracks: Array<{ id: number; name: string; lang: string }>;
    currentAudioTrack: number;
    onAudioChange: (trackId: number) => void;
    showTitle?: string;
    onPanelHover?: () => void;
    onStartHide?: () => void;
}

const VideoPlayerSettings: React.FC<VideoPlayerSettingsProps> = ({
    activePanel, setActivePanel,
    seasonList, currentSeasonEpisodes, selectedSeason, currentEpisode, playingSeason, showId,
    onSeasonSelect, onEpisodeSelect, onEpisodeExpand,
    qualities, currentQuality, onQualityChange,
    captions, currentCaption, onSubtitleChange,
    audioTracks, currentAudioTrack, onAudioChange,
    showTitle, onPanelHover, onStartHide
}) => {
    const isMobile = useIsMobile();
    if (activePanel === 'none') return null;

    const closePanel = () => setActivePanel('none');
    const handleLeave = onStartHide || closePanel;

    return (
        <>
            {activePanel === 'audioSubtitles' && (
                <PanelShell
                    title="Audio & Subtitles"
                    onClose={closePanel}
                    onHover={onPanelHover}
                    onLeave={handleLeave}
                    desktopClass="bottom-24 right-4 w-[400px] lg:w-[550px] h-[480px]"
                >
                    <AudioSubPanel
                        captions={captions}
                        currentCaption={currentCaption}
                        onSubtitleChange={onSubtitleChange}
                        audioTracks={audioTracks}
                        currentAudioTrack={currentAudioTrack}
                        onAudioChange={onAudioChange}
                        onClose={closePanel}
                    />
                </PanelShell>
            )}

            {activePanel === 'quality' && (
                <PanelShell
                    title="Video Quality"
                    onClose={closePanel}
                    onHover={onPanelHover}
                    onLeave={handleLeave}
                    showHeader={!isMobile}
                    desktopClass="bottom-24 right-4 w-[320px] lg:w-[500px] max-h-[70vh]"
                >
                    <QualityMenu
                        qualities={qualities}
                        currentQuality={currentQuality}
                        onQualityChange={onQualityChange}
                        onClose={closePanel}
                    />
                </PanelShell>
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
                    onClose={handleLeave}
                />
            )}
        </>
    );
};

export default VideoPlayerSettings;