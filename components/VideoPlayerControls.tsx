import React, { useRef, useState, useCallback } from 'react';
import {
    PlayIcon,
    PauseIcon,
    ArrowCounterClockwiseIcon,
    ArrowClockwiseIcon,
    SpeakerHighIcon,
    SpeakerLowIcon,
    SpeakerXIcon,
    SkipForwardIcon,
    CardsThreeIcon,
    SubtitlesIcon,
    GearSixIcon,
    CornersOutIcon,
    SubtitlesSlashIcon,
    DatabaseIcon,
    GlobeHemisphereWestIcon
} from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '../hooks/useIsMobile';
import { Episode } from '../types';
import { 
    PanelShell, 
    AudioSubPanel, 
    QualityMenu, 
    EpisodeExplorer,
    ServerPanel
} from './VideoPlayerSettings';

interface VideoPlayerControlsProps {
    isPlaying: boolean;
    isMuted: boolean;
    progress: number;
    duration: number;
    currentTime?: number;
    buffered?: number;
    isBuffering: boolean;
    showNextEp: boolean;
    nextEpisode?: Episode;
    title: React.ReactNode;
    areSubtitlesOff?: boolean;
    onPlayPause: () => void;
    onSeek: (amount: number) => void;
    volume: number;
    onVolumeChange: (volume: number) => void;
    audioBoost?: number;
    onBoostChange?: (boost: number) => void;
    onToggleMute: () => void;
    onTimelineSeek: (percentage: number) => void;
    onNextEpisode?: () => void;
    onClose: () => void;
    onToggleFullscreen: () => void;
    
    // Subtitles & Audio
    onSubtitlesClick?: () => void;
    captions?: Array<{ id: string; label: string; url: string; lang: string }>;
    currentCaption?: string | null;
    onSubtitleChange?: (url: string | null) => void;
    audioTracks?: Array<{ id: number; name: string; lang: string }>;
    currentAudioTrack?: number;
    onAudioChange?: (trackId: number) => void;

    // Quality
    onSettingsClick?: () => void;
    qualities?: Array<{ height: number; bitrate: number; level: number }>;
    currentQuality?: number;
    onQualityChange?: (level: number) => void;

    // Episodes
    onEpisodesClick?: () => void;
    seasonList?: number[];
    currentSeasonEpisodes?: Episode[];
    selectedSeason?: number;
    playingSeason?: number;
    showId?: number | string;
    onSeasonSelect?: (season: number) => void;
    onEpisodeSelect?: (ep: Episode) => void;
    onEpisodeExpand?: (season: number, episode: number) => void;
    activePanel?: 'none' | 'episodes' | 'seasons' | 'audioSubtitles' | 'quality' | 'servers';
    setActivePanel?: (panel: any) => void;
    showTitle?: string;

    // Servers
    allSources?: any[];
    currentSourceIndex?: number;
    onSourceChange?: (index: number) => void;
    onServersClick?: () => void;

    isMenuOpen?: boolean;
    showUI: boolean;
}

const formatTime = (seconds: number): string => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m}:${s.toString().padStart(2, '0')}`;
};

const VideoPlayerControls: React.FC<VideoPlayerControlsProps> = ({
    isPlaying, isMuted, progress, duration, currentTime = 0, buffered = 0,
    isBuffering, showNextEp, nextEpisode, title, areSubtitlesOff,
    onPlayPause, onSeek, volume, onVolumeChange, onToggleMute, onTimelineSeek,
    onNextEpisode, onToggleFullscreen, onSettingsClick,
    onSubtitlesClick, onEpisodesClick,
    isMenuOpen, showUI,
    // Settings state
    captions = [], currentCaption = null, onSubtitleChange,
    audioTracks = [], currentAudioTrack = -1, onAudioChange,
    qualities = [], currentQuality = -1, onQualityChange,
    seasonList = [], currentSeasonEpisodes = [], selectedSeason = 1, playingSeason = 1,
    showId = 0, onSeasonSelect, onEpisodeSelect, onEpisodeExpand,
    activePanel = 'none', setActivePanel, showTitle,
    allSources = [], currentSourceIndex = 0, onSourceChange, onServersClick
}) => {
    const { t } = useTranslation();
    const isMobile = useIsMobile();
    const timelineRef = useRef<HTMLDivElement>(null);
    const [isHovering, setIsHovering] = useState(false);
    const [hoverPosition, setHoverPosition] = useState(0);
    const [hoverTime, setHoverTime] = useState(0);
    const [isDragging, setIsDragging] = useState(false);

    const iconCenter = isMobile ? 46 : 56;
    const iconSm = isMobile ? 32 : 36;

    const getClientX = (e: React.MouseEvent | React.TouchEvent): number => {
        if ('touches' in e && e.touches.length > 0) return e.touches[0].clientX;
        if ('changedTouches' in e && (e as React.TouchEvent).changedTouches.length > 0)
            return (e as React.TouchEvent).changedTouches[0].clientX;
        return (e as React.MouseEvent).clientX;
    };

    const seekFromEvent = useCallback((e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
        if (timelineRef.current) {
            const rect = timelineRef.current.getBoundingClientRect();
            const x = getClientX(e) - rect.left;
            const perc = Math.max(0, Math.min(100, (x / rect.width) * 100));
            onTimelineSeek(perc);
        }
    }, [onTimelineSeek]);

    const handleTimelineStart = useCallback((e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
        e.stopPropagation();
        setIsDragging(true);
        seekFromEvent(e);
    }, [seekFromEvent]);

    const handleTimelineMove = useCallback((e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
        if (timelineRef.current) {
            const rect = timelineRef.current.getBoundingClientRect();
            const x = getClientX(e) - rect.left;
            const perc = Math.max(0, Math.min(100, (x / rect.width) * 100));
            setHoverPosition(perc);
            setHoverTime((perc / 100) * duration);
            if (isDragging) onTimelineSeek(perc);
        }
    }, [duration, isDragging, onTimelineSeek]);

    const handleTimelineEnd = useCallback(() => setIsDragging(false), []);
    const btnBase = 'flex items-center justify-center text-white/80 hover:text-white active:text-white transition-all active:scale-90 select-none';

    return (
        <div className={`absolute inset-x-0 bottom-0 z-50 transition-opacity duration-300 ${showUI ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`} style={{ touchAction: 'manipulation' }}>
            {isMobile && (
                <div className="absolute -top-8 left-0 right-0 flex justify-center pointer-events-none px-16">
                    <span className="text-sm text-white/90 font-semibold drop-shadow-lg tracking-wide line-clamp-1 text-center">{title}</span>
                </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent pointer-events-none" />
            <div className={`relative px-4 md:px-8 pb-4 md:pb-8 ${isMobile ? 'pt-6' : 'pt-14'}`}>
                <div ref={timelineRef} className={`relative w-full cursor-pointer group/timeline mb-1 md:mb-3 ${isMenuOpen ? 'opacity-0' : ''}`} onMouseDown={handleTimelineStart} onMouseMove={handleTimelineMove} onMouseUp={handleTimelineEnd} onMouseLeave={() => setIsHovering(false)} onMouseEnter={() => setIsHovering(true)} onTouchStart={handleTimelineStart} onTouchMove={handleTimelineMove} onTouchEnd={handleTimelineEnd}>
                    {!isMobile && isHovering && !isMenuOpen && (
                        <div className="absolute -top-9 -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded" style={{ left: `${hoverPosition}%` }}>{formatTime(hoverTime)}</div>
                    )}
                    <div className={`relative w-full flex items-center ${isMobile ? 'h-11' : 'h-10'}`}>
                        <div className="absolute left-0 w-full h-[4px] bg-white/20 rounded-full" />
                        <div className="absolute left-0 h-[4px] bg-white/40 rounded-full" style={{ width: `${buffered}%` }} />
                        <div className="absolute left-0 h-[4px] bg-[#e50914] rounded-full" style={{ width: `${progress}%` }} />
                        <div className={`absolute h-4 w-4 bg-[#e50914] rounded-full shadow-lg -translate-x-1/2 transition-transform ${isMobile || isDragging ? 'scale-100' : 'scale-0 group-hover/timeline:scale-125'}`} style={{ left: `${progress}%` }} />
                    </div>
                </div>
                <div className="flex justify-between text-xs text-white/60 mb-2 md:mb-5">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                </div>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-7">
                        {isMobile ? (
                            <>
                                <button onClick={() => onSeek(-10)} className={btnBase}><ArrowCounterClockwiseIcon size={iconSm} /></button>
                                <button onClick={() => onPlayPause()} className={btnBase}>{isPlaying ? <PauseIcon size={iconCenter} weight="fill" /> : <PlayIcon size={iconCenter} weight="fill" />}</button>
                                <button onClick={() => onSeek(10)} className={btnBase}><ArrowClockwiseIcon size={iconSm} /></button>
                            </>
                        ) : (
                            <>
                                <button onClick={() => onPlayPause()} className={btnBase}>{isPlaying ? <PauseIcon size={iconSm} weight="fill" /> : <PlayIcon size={iconSm} weight="fill" />}</button>
                                <button onClick={() => onSeek(-10)} className={btnBase}><ArrowCounterClockwiseIcon size={iconSm} /></button>
                                <button onClick={() => onSeek(10)} className={btnBase}><ArrowClockwiseIcon size={iconSm} /></button>
                                <button onClick={() => onToggleMute()} className={btnBase}>{isMuted || volume === 0 ? <SpeakerXIcon size={iconSm} /> : <SpeakerHighIcon size={iconSm} />}</button>
                            </>
                        )}
                    </div>
                    {!isMobile && <div className="absolute left-1/2 -translate-x-1/2 text-lg font-medium text-white/80">{title}</div>}
                    <div className="flex items-center gap-5">
                        {onNextEpisode && showNextEp && (
                            <button onClick={() => onNextEpisode()} className={btnBase}><SkipForwardIcon size={iconSm} /></button>
                        )}
                        {onSubtitlesClick && (
                            <button onClick={() => onSubtitlesClick()} className={btnBase}>{areSubtitlesOff ? <SubtitlesSlashIcon size={iconSm} /> : <SubtitlesIcon size={iconSm} />}</button>
                        )}
                        {onSettingsClick && (
                            <button onClick={() => onSettingsClick()} className={btnBase}><GearSixIcon size={iconSm} /></button>
                        )}
                        {onServersClick && (
                            <button onClick={() => onServersClick()} className={btnBase}><GlobeHemisphereWestIcon size={iconSm} weight={activePanel === 'servers' ? 'fill' : 'bold'} /></button>
                        )}
                        {onEpisodesClick && (
                            <button onClick={() => onEpisodesClick()} className={btnBase}><CardsThreeIcon size={iconSm} /></button>
                        )}
                        <button onClick={() => onToggleFullscreen()} className={btnBase}><CornersOutIcon size={iconSm} /></button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VideoPlayerControls;
