import React, { useRef, useEffect } from 'react';
import { Episode } from '../types';
import { ArrowLeftIcon, CaretDownIcon, PlayCircleIcon, CheckIcon, CaretRightIcon, XIcon } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { useGlobalContext } from '../context/GlobalContext';
import { useIsMobile } from '../hooks/useIsMobile';

// ─── Shared: compact panel wrapper ────────────────────────────────────────────
// On mobile: slides up from the bottom as a sheet (max 55vh).
// On desktop: small floating overlay anchored above the controls.
const PanelShell: React.FC<{
    title: string;
    onClose: () => void;
    onHover?: () => void;
    onLeave?: () => void;
    children: React.ReactNode;
    /** Override desktop positioning class */
    desktopClass?: string;
}> = ({ title, onClose, onHover, onLeave, children, desktopClass }) => {
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

    // Desktop: floating panel above controls
    return (
        <div
            className={`absolute z-[120] bg-[#1a1a1a] rounded shadow-2xl flex flex-col overflow-hidden animate-fadeIn font-['Consolas'] ${desktopClass || 'bottom-24 right-4 w-[340px] max-h-[50vh]'}`}
            onMouseEnter={onHover}
            onMouseLeave={onLeave}
        >
            <div className="overflow-y-auto flex-1 scrollbar-none">{children}</div>
        </div>
    );
};

// ─── Subtitle / Audio menu ─────────────────────────────────────────────────
const SubtitleMenu: React.FC<{
    captions: Array<{ id: string; label: string; url: string; lang: string }>;
    currentCaption: string | null;
    onSubtitleChange: (url: string | null) => void;
    onClose: () => void;
}> = ({ captions, currentCaption, onSubtitleChange, onClose }) => {
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
        <div className="flex flex-col py-1">
            {/* Off */}
            <div className={rowCls} onClick={() => { onSubtitleChange(null); onClose(); }}>
                <div className="w-5 mr-3 flex-shrink-0 flex justify-center">
                    {currentCaption === null && <CheckIcon size={14} weight="bold" className="text-white" />}
                </div>
                <span className={`text-sm ${currentCaption === null ? 'text-white font-bold' : 'text-white/60'}`}>{t('player.off')}</span>
            </div>

            {groupedCaptions.map(([langKey, caps]) => {
                const isMulti = caps.length > 1;
                const hasActiveChild = caps.some(c => c.url === currentCaption);
                return (
                    <div key={langKey} className={`${rowCls} justify-between`} onClick={() => {
                        if (isMulti) { setActiveLangGroup(langKey); }
                        else { onSubtitleChange(caps[0].url); onClose(); }
                    }}>
                        <div className="flex items-center overflow-hidden">
                            <div className="w-5 mr-3 flex-shrink-0 flex justify-center">
                                {hasActiveChild && <CheckIcon size={14} weight="bold" className="text-white" />}
                            </div>
                            <span className={`text-sm truncate ${hasActiveChild ? 'text-white font-bold' : 'text-white/60'}`}>{caps[0].label}</span>
                        </div>
                        {isMulti && <CaretRightIcon size={14} weight="bold" className="text-white/40 ml-2 flex-shrink-0" />}
                    </div>
                );
            })}
        </div>
    );
};

// ─── Quality menu ──────────────────────────────────────────────────────────
const QualityMenu: React.FC<{
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
        <div className="flex flex-col py-1">
            <div className={rowCls} onClick={() => handleSelect(-1)}>
                <span className={`text-sm ${currentQuality === -1 ? 'text-white font-bold' : 'text-white/60'}`}>Auto</span>
                {currentQuality === -1 && <CheckIcon size={14} weight="bold" className="text-white" />}
            </div>
            {qualities.map((q, i) => (
                <div key={i} className={rowCls} onClick={() => handleSelect(q.level)}>
                    <span className={`text-sm ${currentQuality === q.level ? 'text-white font-bold' : 'text-white/60'}`}>
                        {q.height}p {q.height >= 1080 ? 'HD' : ''}
                    </span>
                    {currentQuality === q.level && <CheckIcon size={14} weight="bold" className="text-white" />}
                </div>
            ))}
        </div>
    );
};

// ─── Episode explorer ──────────────────────────────────────────────────────
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
        <>
            {activePanel === 'seasons' && (
                <div className="flex flex-col py-1">
                    {!isMobile && showTitle && (
                        <div className="px-4 py-3 border-b border-white/10 text-white text-sm font-bold opacity-60">{showTitle}</div>
                    )}
                    {seasonList.map(s => (
                        <div key={s} onClick={() => handleSeasonClick(s)} className={`${rowCls} ${selectedSeason === s ? 'border-l-2 border-white/50 bg-white/5' : ''}`}>
                            <div className="w-5 mr-3 flex-shrink-0 flex justify-center">
                                {selectedSeason === s && <CheckIcon size={14} weight="bold" className="text-white" />}
                            </div>
                            <span className={`text-sm ${selectedSeason === s ? 'text-white font-bold' : 'text-white/60'}`}>
                                {t('player.season')} {s}
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {activePanel === 'episodes' && (
                <div className="flex flex-col h-full">
                    <div onClick={() => setActivePanel('seasons')} className={`${rowCls} border-b border-white/10 flex-shrink-0`}>
                        <ArrowLeftIcon size={18} weight="bold" className="text-white mr-3 flex-shrink-0" />
                        <span className="text-white font-bold text-sm">{t('player.season')} {previewSeason}</span>
                    </div>

                    <div ref={episodesContainerRef} className="flex flex-col py-1 overflow-y-auto flex-1 scrollbar-none">
                        {currentSeasonEpisodes.map(ep => {
                            const isPlaying = currentEpisode === ep.episode_number && playingSeason === selectedSeason;
                            const isExpanded = expandedEpisodeId === ep.id;
                            const progress = getEpisodeProgress(showId, selectedSeason, ep.episode_number);

                            return (
                                <div
                                    key={ep.id}
                                    ref={isPlaying ? currentEpisodeRef : null}
                                    className={`transition ${isPlaying ? 'border-l-2 border-[#E50914]' : ''}`}
                                >
                                    <div
                                        className={`flex items-center px-4 ${isMobile ? 'py-4' : 'py-3'} cursor-pointer hover:bg-white/5 active:bg-white/10 select-none`}
                                        onClick={() => {
                                            const newExp = isExpanded ? null : ep.id;
                                            setExpandedEpisodeId(newExp);
                                            if (newExp && onEpisodeExpand) onEpisodeExpand(selectedSeason, ep.episode_number);
                                        }}
                                    >
                                        <span className={`w-7 text-sm flex-shrink-0 ${isPlaying ? 'text-white font-bold' : 'text-white/50'}`}>{ep.episode_number}</span>
                                        <span className={`flex-1 text-sm ${isPlaying ? 'text-white font-bold' : 'text-white/90'} truncate mr-2`}>{ep.name}</span>
                                        {progress && progress.time > 10 && (
                                            <span className="text-[10px] text-white/40 mr-2 flex-shrink-0 hidden sm:inline">
                                                {formatTime(progress.time)}
                                            </span>
                                        )}
                                        <CaretDownIcon size={16} className={`text-white/40 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                    </div>

                                    {isExpanded && (
                                        <div className={`flex ${isMobile ? 'flex-col' : 'flex-row'} gap-3 px-4 pb-4 mt-1 animate-fadeIn`}>
                                            {ep.still_path && (
                                                <div
                                                    className="relative flex-shrink-0 cursor-pointer group"
                                                    style={{ width: isMobile ? '100%' : '160px' }}
                                                    onClick={(e) => { e.stopPropagation(); onEpisodeSelect({ ...ep, season_number: selectedSeason }); setActivePanel('none'); }}
                                                >
                                                    <img
                                                        src={`https://image.tmdb.org/t/p/w300${ep.still_path}`}
                                                        alt={ep.name}
                                                        className="w-full h-auto rounded object-cover"
                                                        style={{ aspectRatio: '16/9' }}
                                                    />
                                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded group-hover:bg-black/20 transition">
                                                        <PlayCircleIcon size={36} weight="fill" className="text-white drop-shadow-lg" />
                                                    </div>
                                                    {getEpisodeProgressPercent(selectedSeason, ep.episode_number) > 0 && (
                                                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20 rounded-b">
                                                            <div className="h-full bg-[#E50914] rounded-b" style={{ width: `${getEpisodeProgressPercent(selectedSeason, ep.episode_number)}%` }} />
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                            <div className="flex flex-col flex-1 justify-center">
                                                <p className="text-xs text-white/60 line-clamp-4 leading-relaxed">{ep.overview || t('player.noDescription')}</p>
                                                {!ep.still_path && (
                                                    <button
                                                        className="mt-2 text-xs text-white border border-white/20 rounded px-3 py-1.5 hover:bg-white/10 transition self-start active:scale-95"
                                                        onClick={(e) => { e.stopPropagation(); onEpisodeSelect({ ...ep, season_number: selectedSeason }); setActivePanel('none'); }}
                                                    >
                                                        Play
                                                    </button>
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
        </>
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

    // Desktop
    return (
        <div
            className="absolute bottom-24 right-2 w-[340px] max-h-[60vh] bg-[#1a1a1a] rounded shadow-2xl z-[120] flex flex-col overflow-hidden animate-fadeIn font-['Consolas'] text-white"
            onMouseEnter={onPanelHover}
            onMouseLeave={closePanel}
        >
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
    showTitle, onPanelHover, onStartHide
}) => {
    if (activePanel === 'none') return null;

    const closePanel = () => setActivePanel('none');
    const handleLeave = onStartHide || closePanel;

    return (
        <>
            {activePanel === 'audioSubtitles' && (
                <PanelShell
                    title="Subtitles"
                    onClose={closePanel}
                    onHover={onPanelHover}
                    onLeave={handleLeave}
                    desktopClass="bottom-24 right-4 w-[320px] max-h-[50vh]"
                >
                    <SubtitleMenu
                        captions={captions}
                        currentCaption={currentCaption}
                        onSubtitleChange={onSubtitleChange}
                        onClose={closePanel}
                    />
                </PanelShell>
            )}

            {activePanel === 'quality' && (
                <PanelShell
                    title="Quality"
                    onClose={closePanel}
                    onHover={onPanelHover}
                    onLeave={handleLeave}
                    desktopClass="bottom-24 right-4 w-[220px] max-h-[50vh]"
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