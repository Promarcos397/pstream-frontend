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
    ShareNetworkIcon
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
    isBuffering, showNextEp, title, areSubtitlesOff,
    onPlayPause, onSeek, volume, onVolumeChange, onToggleMute, onTimelineSeek,
    onNextEpisode, onToggleFullscreen, onSettingsClick,
    onSubtitlesClick, onSubtitlesHover, onSettingsHover,
    onShareClick, onEpisodesClick, onEpisodesHover,
    isMenuOpen, showUI
}) => {
    const { t } = useTranslation();
    const isMobile = useIsMobile();
    const timelineRef = useRef<HTMLDivElement>(null);
    const [isHovering, setIsHovering] = useState(false);
    const [hoverPosition, setHoverPosition] = useState(0);
    const [hoverTime, setHoverTime] = useState(0);
    const [isDragging, setIsDragging] = useState(false);

    // Calibrated icon sizes - made slightly larger
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
    const handleTimelineLeave = useCallback(() => { setIsHovering(false); setIsDragging(false); }, []);

    // NOTE: Panel-opening buttons (subtitles, quality, episodes) MUST use onClick, not onPointerDown.
    // Reason: onPointerDown triggers state update → React re-renders backdrop on top → the subsequent
    // click event hits the backdrop and closes the panel immediately.
    // touch-action: manipulation on the container eliminates the 300ms click delay on mobile.
    const btnBase = 'flex items-center justify-center text-white/80 hover:text-white active:text-white transition-all active:scale-90 select-none';

    return (
        <div
            className={`absolute inset-x-0 bottom-0 z-50 transition-opacity duration-300 ${showUI ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
            style={{ touchAction: 'manipulation' }}
        >
            {/* Mobile title — above controls at top of the controls bar */}
            {isMobile && (
                <div className="absolute -top-8 left-0 right-0 flex justify-center pointer-events-none px-16">
                    <span className="text-sm text-white/90 font-semibold drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)] tracking-wide line-clamp-1 text-center">
                        {title}
                    </span>
                </div>
            )}

            {/* Gradient backdrop */}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent pointer-events-none" />

            <div className={`relative px-4 md:px-8 pb-4 md:pb-8 ${isMobile ? 'pt-6' : 'pt-14'}`}>

                {/* Timeline */}
                <div
                    ref={timelineRef}
                    className={`relative w-full cursor-pointer group/timeline mb-1 md:mb-3 ${isMenuOpen ? 'opacity-0 pointer-events-none' : ''}`}
                    onMouseDown={handleTimelineStart}
                    onMouseMove={handleTimelineMove}
                    onMouseUp={handleTimelineEnd}
                    onMouseLeave={handleTimelineLeave}
                    onMouseEnter={() => setIsHovering(true)}
                    onTouchStart={handleTimelineStart}
                    onTouchMove={handleTimelineMove}
                    onTouchEnd={handleTimelineEnd}
                    onTouchCancel={handleTimelineEnd}
                    style={{ touchAction: 'none' }}
                >
                    {/* Hover time tooltip (desktop only) */}
                    {!isMobile && isHovering && !isMenuOpen && (
                        <div
                            className="absolute -top-9 -translate-x-1/2 bg-black/90 text-white text-xs px-2 py-1 rounded pointer-events-none z-50 whitespace-nowrap"
                            style={{ left: `${hoverPosition}%` }}
                        >
                            {formatTime(hoverTime)}
                        </div>
                    )}

                    {/* Track + hit area */}
                    <div className={`relative w-full flex items-center ${isMobile ? 'h-8' : 'h-10'}`}>
                        <div className="absolute left-0 w-full h-[4px] group-hover/timeline:h-[6px] bg-white/20 rounded-full transition-all duration-150" />
                        <div className="absolute left-0 h-[4px] group-hover/timeline:h-[6px] bg-white/40 rounded-full transition-all duration-150" style={{ width: `${buffered}%` }} />
                        {!isMobile && isHovering && (
                            <div className="absolute left-0 h-[4px] bg-white/20 rounded-full" style={{ width: `${hoverPosition}%` }} />
                        )}
                        <div className="absolute left-0 h-[4px] group-hover/timeline:h-[6px] bg-[#E50914] rounded-full transition-all duration-150" style={{ width: `${progress}%` }} />
                        {/* Scrubber knob */}
                        <div
                            className={`absolute h-5 w-5 bg-[#E50914] rounded-full shadow-lg -translate-x-1/2 z-10 transition-transform duration-150 ${isMobile || isDragging ? 'scale-100' : 'scale-0 group-hover/timeline:scale-100'}`}
                            style={{ left: `${progress}%` }}
                        />
                    </div>
                </div>

                {/* Time display */}
                <div className={`flex justify-between text-xs md:text-sm text-white/60 mb-2 md:mb-5 ${isMenuOpen ? 'opacity-0' : ''}`}>
                    <span className="font-medium tracking-wide">{formatTime(currentTime)}</span>
                    <span className="font-medium tracking-wide">{formatTime(duration)}</span>
                </div>

                {/* Controls row
                    Mobile:  [←10] [▶] [10→]   ·   [sub] [⚙] [⤢]
                    Desktop: [▶] [←10] [10→] [🔊]  ·  title  ·  [next] [share] [sub] [⚙] [ep] [⤢]
                */}
                <div className="flex items-center justify-between">

                    {/* LEFT GROUP */}
                    {isMobile ? (
                        <div className="flex items-center gap-7">
                            {/* Seek -10 */}
                            <button
                                onClick={(e) => { e.stopPropagation(); onSeek(-10); }}
                                className={`${btnBase} relative`}
                            >
                                <ArrowCounterClockwiseIcon size={iconSm} weight="bold" />
                                <span className="absolute text-[9px] font-bold pointer-events-none">10</span>
                            </button>

                            {/* Play/Pause — center */}
                            <button
                                onClick={(e) => { e.stopPropagation(); onPlayPause(); }}
                                className={btnBase}
                            >
                                {isPlaying
                                    ? <PauseIcon size={iconCenter} weight="fill" />
                                    : <PlayIcon size={iconCenter} weight="fill" />
                                }
                            </button>

                            {/* Seek +10 */}
                            <button
                                onClick={(e) => { e.stopPropagation(); onSeek(10); }}
                                className={`${btnBase} relative`}
                            >
                                <ArrowClockwiseIcon size={iconSm} weight="bold" />
                                <span className="absolute text-[9px] font-bold pointer-events-none">10</span>
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-4 md:gap-5">
                            <button onClick={(e) => { e.stopPropagation(); onPlayPause(); }} className={btnBase}>
                                {isPlaying ? <PauseIcon size={iconSm} weight="fill" /> : <PlayIcon size={iconSm} weight="fill" />}
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); onSeek(-10); }} className={`${btnBase} relative`}>
                                <ArrowCounterClockwiseIcon size={iconSm} weight="bold" />
                                <span className="absolute text-[10px] font-bold mt-0.5 pointer-events-none">10</span>
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); onSeek(10); }} className={`${btnBase} relative`}>
                                <ArrowClockwiseIcon size={iconSm} weight="bold" />
                                <span className="absolute text-[10px] font-bold mt-0.5 pointer-events-none">10</span>
                            </button>
                            {/* Volume */}
                            <div className="flex items-center group/vol">
                                <button onClick={(e) => { e.stopPropagation(); onToggleMute(); }} className={btnBase}>
                                    {isMuted || volume === 0
                                        ? <SpeakerXIcon size={iconSm} weight="bold" />
                                        : volume < 0.5
                                            ? <SpeakerLowIcon size={iconSm} weight="bold" />
                                            : <SpeakerHighIcon size={iconSm} weight="bold" />
                                    }
                                </button>
                                <div className="w-0 overflow-hidden group-hover/vol:w-24 transition-all duration-300 ml-2 flex items-center">
                                    <input
                                        type="range" min="0" max="1" step="0.05"
                                        value={isMuted ? 0 : volume}
                                        onClick={(e) => e.stopPropagation()}
                                        onChange={(e) => { e.stopPropagation(); onVolumeChange(parseFloat(e.target.value)); }}
                                        className="w-20 h-1 bg-white/30 rounded-full appearance-none cursor-pointer accent-white"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Centre title (desktop only) */}
                    {!isMobile && (
                        <div className="absolute left-1/2 -translate-x-1/2 pointer-events-none text-center max-w-[40vw]">
                            <span className="text-base md:text-lg text-white/80 font-medium whitespace-nowrap overflow-hidden text-ellipsis block tracking-wide">
                                {title}
                            </span>
                        </div>
                    )}

                    {/* RIGHT GROUP — secondary / panel-opening controls
                        IMPORTANT: these use onClick (not onPointerDown) to avoid the close-immediately glitch.
                        The glitch: onPointerDown opens panel → React renders backdrop (z-120) → click hits backdrop → panel closes.
                        onClick fires after the full press cycle, so React re-renders AFTER the event and backdrop can't interfere.
                    */}
                    <div className="flex items-center gap-4 md:gap-5">

                        {/* Next episode */}
                        {onNextEpisode && showNextEp && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onNextEpisode(); }}
                                className={btnBase}
                                title={t('player.nextEp')}
                            >
                                <SkipForwardIcon size={iconSm} weight="bold" />
                            </button>
                        )}

                        {/* Share (desktop only) */}
                        {!isMobile && onShareClick && (
                            <button onClick={(e) => { e.stopPropagation(); onShareClick(); }} className={btnBase} title="Share">
                                <ShareNetworkIcon size={iconSm} weight="bold" />
                            </button>
                        )}

                        {/* Subtitles — onClick only, not onPointerDown */}
                        {onSubtitlesClick && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onSubtitlesClick(); }}
                                onMouseEnter={onSubtitlesHover}
                                className={`${btnBase} ${isMenuOpen ? 'text-white' : ''}`}
                                aria-label="Subtitles"
                            >
                                {areSubtitlesOff
                                    ? <SubtitlesSlashIcon size={iconSm} weight="bold" />
                                    : <SubtitlesIcon size={iconSm} weight="bold" />
                                }
                            </button>
                        )}

                        {/* Quality/Settings — onClick only, not onPointerDown */}
                        {onSettingsClick && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onSettingsClick(); }}
                                onMouseEnter={onSettingsHover}
                                className={`${btnBase} ${isMenuOpen ? 'text-white' : ''}`}
                                aria-label="Quality"
                            >
                                <GearSixIcon size={iconSm} />
                            </button>
                        )}

                        {/* Episodes (TV only) — onClick only, not onPointerDown */}
                        {onEpisodesClick && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onEpisodesClick(); }}
                                onMouseEnter={onEpisodesHover}
                                className={`${btnBase} ${isMenuOpen ? 'text-white' : ''}`}
                                aria-label="Episodes"
                            >
                                <CardsThreeIcon size={iconSm} weight="bold" />
                            </button>
                        )}

                        {/* Fullscreen */}
                        <button
                            onClick={(e) => { e.stopPropagation(); onToggleFullscreen(); }}
                            className={`${btnBase} p-1 -m-1`}
                            aria-label="Fullscreen"
                        >
                            <CornersOutIcon size={iconSm} weight="bold" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VideoPlayerControls;
