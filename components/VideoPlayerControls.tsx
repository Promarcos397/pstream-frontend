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
    GearSixIcon,
    CornersOutIcon,
    SubtitlesIcon,
    SubtitlesSlashIcon,
    CardsThreeIcon,
    ShareNetworkIcon,
    TelevisionIcon
} from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '../hooks/useIsMobile';

interface VideoPlayerControlsProps {
    isPlaying: boolean;
    isMuted: boolean;
    progress: number;
    duration: number;
    currentTime?: number;
    buffered?: number;
    isBuffering: boolean;
    showNextEp: boolean;
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
    onSettingsClick: () => void;
    onSubtitlesClick?: () => void;
    onSubtitlesHover?: () => void;
    onSettingsHover?: () => void;
    onShareClick?: () => void;
    onEpisodesClick?: () => void;
    onEpisodesHover?: () => void;
    onMenuClose?: () => void;
    isMenuOpen?: boolean;
    showUI: boolean;
    onTogglePiP?: () => void;
    isPiP?: boolean;
}

// Format time as MM:SS or HH:MM:SS
const formatTime = (seconds: number): string => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) {
        return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
};

const VideoPlayerControls: React.FC<VideoPlayerControlsProps> = ({
    isPlaying,
    isMuted,
    progress,
    duration,
    currentTime = 0,
    buffered = 0,
    isBuffering,
    showNextEp,
    title,
    areSubtitlesOff,
    onPlayPause,
    onSeek,
    volume,
    onVolumeChange,
    onToggleMute,
    onTimelineSeek,
    onNextEpisode,
    onToggleFullscreen,
    onSettingsClick,
    onSubtitlesClick,
    onSubtitlesHover,
    onSettingsHover,
    onShareClick,
    onEpisodesClick,
    onEpisodesHover,
    isMenuOpen,
    showUI,
    onTogglePiP,
    isPiP
}) => {
    const { t } = useTranslation();
    const isMobile = useIsMobile();
    const iconSize = isMobile ? 32 : 48;
    const timelineRef = useRef<HTMLDivElement>(null);
    const [isHovering, setIsHovering] = useState(false);
    const [hoverPosition, setHoverPosition] = useState(0);
    const [hoverTime, setHoverTime] = useState(0);
    const [isDragging, setIsDragging] = useState(false);

    const handleTimelineClick = useCallback((e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
        e.stopPropagation();
        if (timelineRef.current) {
            const rect = timelineRef.current.getBoundingClientRect();
            let clientX: number;
            if ('touches' in e) {
                clientX = e.touches[0].clientX;
            } else {
                clientX = (e as React.MouseEvent).clientX;
            }
            const x = clientX - rect.left;
            const perc = Math.max(0, Math.min(100, (x / rect.width) * 100));
            onTimelineSeek(perc);
        }
    }, [onTimelineSeek]);

    const handleInteraction = useCallback((e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
        if (timelineRef.current) {
            const rect = timelineRef.current.getBoundingClientRect();
            let clientX: number;
            if ('touches' in e) {
                clientX = e.touches[0].clientX;
            } else {
                clientX = (e as React.MouseEvent).clientX;
            }
            const x = clientX - rect.left;
            const perc = Math.max(0, Math.min(100, (x / rect.width) * 100));
            setHoverPosition(perc);
            setHoverTime((perc / 100) * duration);

            // If dragging, seek in real-time
            if (isDragging) {
                onTimelineSeek(perc);
            }
        }
    }, [duration, isDragging, onTimelineSeek]);

    const handleStart = useCallback((e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
        e.stopPropagation();
        setIsDragging(true);
        handleTimelineClick(e);
    }, [handleTimelineClick]);

    const handleEnd = useCallback(() => {
        setIsDragging(false);
    }, []);

    const handleLeave = useCallback(() => {
        setIsHovering(false);
        setIsDragging(false);
    }, []);

    return (
        <div className={`absolute inset-x-0 bottom-0 z-50 bg-gradient-to-t from-black via-black/80 to-transparent px-4 md:px-8 pb-4 md:pb-8 pt-10 md:pt-20 transition-opacity duration-300 ${showUI ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
            {/* Timeline - Improved for Touch */}
            <div
                ref={timelineRef}
                className={`relative w-full cursor-pointer group/timeline mb-2 md:mb-4 ${isMenuOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
                onMouseDown={handleStart}
                onMouseMove={handleInteraction}
                onMouseUp={handleEnd}
                onMouseLeave={handleLeave}
                onMouseEnter={() => setIsHovering(true)}
                onTouchStart={handleStart}
                onTouchMove={handleInteraction}
                onTouchEnd={handleEnd}
                onTouchCancel={handleEnd}
            >
                {/* Hover Time Preview (only on desktop/hover) */}
                {!isMobile && isHovering && !isMenuOpen && (
                    <div
                        className="absolute -top-10 transform -translate-x-1/2 bg-black/90 text-white text-sm px-2 py-1 rounded pointer-events-none z-50 whitespace-nowrap"
                        style={{ left: `${hoverPosition}%` }}
                    >
                        {formatTime(hoverTime)}
                    </div>
                )}

                {/* Track Container - taller hit area */}
                <div className="relative w-full h-8 flex items-center">
                    {/* Background Track */}
                    <div className="absolute left-0 w-full h-1 md:h-1 group-hover/timeline:h-1.5 bg-white/20 rounded-full transition-all duration-150" />

                    {/* Buffered Progress */}
                    <div
                        className="absolute left-0 h-1 md:h-1 group-hover/timeline:h-1.5 bg-white/40 rounded-full transition-all duration-150"
                        style={{ width: `${buffered}%` }}
                    />

                    {/* Hover Preview (ghost progress) */}
                    {!isMobile && isHovering && (
                        <div
                            className="absolute left-0 h-1 group-hover/timeline:h-1.5 bg-white/20 rounded-full transition-all duration-150"
                            style={{ width: `${hoverPosition}%` }}
                        />
                    )}

                    {/* Filled Progress */}
                    <div
                        className="absolute left-0 h-1 md:h-1 group-hover/timeline:h-1.5 bg-[#E50914] rounded-full transition-all duration-150"
                        style={{ width: `${progress}%` }}
                    />

                    {/* Scrubber Handle */}
                    <div
                        className={`absolute h-4 w-4 bg-[#E50914] rounded-full shadow-lg transform -translate-x-1/2 transition-transform duration-150 z-10 
                            ${isMobile || isDragging ? 'scale-100' : 'scale-0 group-hover/timeline:scale-100'}`}
                        style={{ left: `${progress}%` }}
                    />
                </div>
            </div>

            {/* Time Display */}
            <div className={`flex justify-between text-xs md:text-sm text-white/70 mb-2 md:mb-4 ${isMenuOpen ? 'opacity-0' : 'opacity-100'}`}>
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
            </div>

            {/* Centered Title - Positioned at top for mobile, bottom for desktop */}
            {isMobile ? (
                <div className="absolute top-8 left-1/2 transform -translate-x-1/2 z-50 pointer-events-none text-center w-full px-12">
                    <span className="text-sm sm:text-base text-white/90 font-bold drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] tracking-wide line-clamp-1 uppercase">
                        {title}
                    </span>
                </div>
            ) : (
                <div className="absolute left-1/2 transform -translate-x-1/2 z-0 pointer-events-none text-center w-full flex justify-center px-4">
                    <span className="text-base md:text-2xl text-white select-none whitespace-nowrap overflow-hidden text-ellipsis max-w-[40vw] md:max-w-[60vw] block font-medium">
                        {title}
                    </span>
                </div>
            )}

            <div className="relative flex items-center justify-between">
                <div className="flex items-center space-x-3 md:space-x-6 z-10">
                    <button onClick={(e) => { e.stopPropagation(); onPlayPause(); }} className="text-gray-300 hover:text-white transition transform active:scale-95">
                        {isPlaying ? <PauseIcon size={iconSize} weight="fill" /> : <PlayIcon size={iconSize} weight="fill" />}
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); onSeek(-10); }} className="text-gray-300 hover:text-white transition transform active:scale-95 relative flex items-center justify-center">
                        <ArrowCounterClockwiseIcon size={iconSize} weight="bold" />
                        <span className={`absolute text-white select-none pointer-events-none ${isMobile ? 'text-[0.4rem] mt-0.5' : 'text-[0.6rem] mt-1'}`}>10</span>
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); onSeek(10); }} className="text-gray-300 hover:text-white transition transform active:scale-95 relative flex items-center justify-center">
                        <ArrowClockwiseIcon size={iconSize} weight="bold" />
                        <span className={`absolute text-white select-none pointer-events-none ${isMobile ? 'text-[0.4rem] mt-0.5' : 'text-[0.6rem] mt-1'}`}>10</span>
                    </button>

                    {/* Volume Control - hide on mobile, use device buttons */}
                    {!isMobile && (
                        <div className="flex items-center group/vol relative">
                            <button onClick={(e) => { e.stopPropagation(); onToggleMute(); }} className="text-gray-300 hover:text-white transition transform hover:scale-110 z-20">
                                {isMuted || volume === 0
                                    ? <SpeakerXIcon size={iconSize} weight="bold" />
                                    : volume < 0.5
                                        ? <SpeakerLowIcon size={iconSize} weight="bold" />
                                        : <SpeakerHighIcon size={iconSize} weight="bold" />
                                }
                            </button>
                            <div className="w-0 overflow-hidden group-hover/vol:w-24 transition-all duration-300 ease-in-out flex items-center ml-2">
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.05"
                                    value={isMuted ? 0 : volume}
                                    onChange={(e) => { e.stopPropagation(); onVolumeChange(parseFloat(e.target.value)); }}
                                    className="w-20 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-white hover:accent-red-600"
                                />
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex items-center space-x-3 md:space-x-6 z-10">
                    {onNextEpisode && showNextEp && (
                        <button 
                            onClick={(e) => { e.stopPropagation(); onNextEpisode(); }} 
                            className="text-gray-300 hover:text-white transition transform active:scale-95"
                            title={t('player.nextEp')}
                        >
                            <SkipForwardIcon size={iconSize} weight="bold" />
                        </button>
                    )}

                    {!isMobile && onShareClick && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onShareClick(); }}
                            className="text-gray-300 hover:text-white transition transform active:scale-95"
                            title="Share Link"
                        >
                            <ShareNetworkIcon size={iconSize} weight="bold" />
                        </button>
                    )}

                    {onSubtitlesClick && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onSubtitlesClick(); }}
                            onMouseEnter={onSubtitlesHover}
                            className={`text-gray-300 hover:text-white transition transform active:scale-95 ${isMenuOpen ? 'text-white' : ''}`}
                        >
                            {areSubtitlesOff ? <SubtitlesSlashIcon size={iconSize} weight="bold" /> : <SubtitlesIcon size={iconSize} weight="bold" />}
                        </button>
                    )}

                    {onSettingsClick && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onSettingsClick(); }}
                            onMouseEnter={onSettingsHover}
                            className={`text-gray-300 hover:text-white transition transform active:scale-95 ${isMenuOpen ? 'text-white' : ''}`}
                        >
                            <GearSixIcon size={iconSize} />
                        </button>
                    )}

                    {onEpisodesClick && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onEpisodesClick(); }}
                            onMouseEnter={onEpisodesHover}
                            className={`text-gray-300 hover:text-white transition transform active:scale-95 ${isMenuOpen ? 'text-white' : ''}`}
                        >
                            <CardsThreeIcon size={iconSize} weight="bold" />
                        </button>
                    )}
                    {onTogglePiP && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onTogglePiP(); }}
                            className={`text-gray-300 hover:text-white transition transform active:scale-95 ${isPiP ? 'text-white' : ''}`}
                            title="Picture in Picture"
                        >
                            <TelevisionIcon size={iconSize} weight={isPiP ? 'fill' : 'bold'} />
                        </button>
                    )}

                    <button 
                        onClick={(e) => { e.stopPropagation(); onToggleFullscreen(); }} 
                        className="text-gray-300 hover:text-white transition transform active:scale-95 p-1 -m-1"
                    >
                        <CornersOutIcon size={iconSize} weight="bold" />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default VideoPlayerControls;
