import React, { useRef, useState, useCallback, useEffect } from 'react';
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
    CornersOutIcon,
    ArrowLeftIcon,
} from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '../hooks/useIsMobile';
import { Episode } from '../types';

interface VideoPlayerControlsProps {
    isPlaying: boolean;
    isMuted: boolean;
    progress: number;
    duration: number;
    currentTime?: number;
    buffered?: number;
    isBuffering: boolean;
    showNextEp: boolean;
    hasNextEpisode?: boolean;
    nextEpisode?: Episode;
    title: React.ReactNode;
    mediaType?: string;
    onPlayPause: () => void;
    onSeek: (amount: number) => void;
    volume: number;
    onVolumeChange: (volume: number) => void;
    onToggleMute: () => void;
    onTimelineSeek: (percentage: number) => void;
    onNextEpisode?: () => void;
    onClose: () => void;
    onToggleFullscreen: () => void;
    onSubtitlesClick?: () => void;
    onEpisodesClick?: () => void;
    activePanel?: 'none' | 'episodes' | 'seasons' | 'audioSubtitles' | 'quality' | 'servers';
    setActivePanel?: (panel: any) => void;
    // subtitles toggle for keyboard shortcut 'S'
    currentCaption?: string | null;
    onSubtitleToggle?: () => void;
    // kept for compat
    allSources?: any[];
    currentSourceIndex?: number;
    onSourceChange?: (index: number) => void;
    onServersClick?: () => void;
    onSettingsClick?: () => void;
    qualities?: Array<{ height: number; bitrate: number; level: number }>;
    currentQuality?: number;
    onQualityChange?: (level: number) => void;
    isMenuOpen?: boolean;
    showUI: boolean;
}

const formatRemaining = (currentTime: number, duration: number): string => {
    if (!duration || isNaN(duration)) return '';
    const remaining = Math.max(0, duration - currentTime);
    const h = Math.floor(remaining / 3600);
    const m = Math.floor((remaining % 3600) / 60);
    const s = Math.floor(remaining % 60);
    if (h > 0) return `-${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `-${m}:${s.toString().padStart(2, '0')}`;
};

// ── Vertical Volume Slider Popup ──────────────────────────────────────────────
const VolumePopup: React.FC<{
    volume: number;
    isMuted: boolean;
    onVolumeChange: (v: number) => void;
    onToggleMute: () => void;
}> = ({ volume, isMuted, onVolumeChange, onToggleMute }) => {
    const trackRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);

    const effectiveVolume = isMuted ? 0 : volume;

    const getVolumeFromY = (clientY: number) => {
        if (!trackRef.current) return effectiveVolume;
        const rect = trackRef.current.getBoundingClientRect();
        const ratio = 1 - Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
        return ratio;
    };

    const handleTrackClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        const v = getVolumeFromY(e.clientY);
        onVolumeChange(v);
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        setIsDragging(true);
    };

    useEffect(() => {
        if (!isDragging) return;
        const onMove = (e: MouseEvent) => {
            const v = getVolumeFromY(e.clientY);
            onVolumeChange(v);
        };
        const onUp = () => setIsDragging(false);
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        return () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
    }, [isDragging]);

    const fillPercent = effectiveVolume * 100;

    return (
        <div
            className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 px-3 py-4 bg-[#1f1f1f]/95 backdrop-blur-md rounded-lg border border-white/10 shadow-2xl z-50"
            onClick={(e) => e.stopPropagation()}
        >
            {/* Volume percentage label */}
            <span className="text-white/60 text-xs font-mono tabular-nums">{Math.round(effectiveVolume * 100)}%</span>

            {/* Vertical track */}
            <div
                ref={trackRef}
                className="relative w-4 h-28 flex items-center justify-center cursor-pointer"
                onClick={handleTrackClick}
            >
                {/* Track background */}
                <div className="absolute inset-x-0 mx-auto w-1 h-full bg-white/20 rounded-full" />
                {/* Fill */}
                <div
                    className="absolute bottom-0 inset-x-0 mx-auto w-1 bg-[#e50914] rounded-full transition-none"
                    style={{ height: `${fillPercent}%` }}
                />
                {/* Thumb */}
                <div
                    className="absolute w-3.5 h-3.5 bg-white rounded-full shadow-lg cursor-grab active:cursor-grabbing transition-transform hover:scale-125"
                    style={{ bottom: `calc(${fillPercent}% - 7px)` }}
                    onMouseDown={handleMouseDown}
                />
            </div>

            {/* Mute toggle icon at bottom */}
            <button
                onClick={(e) => { e.stopPropagation(); onToggleMute(); }}
                className="text-white/60 hover:text-white transition"
                aria-label={isMuted ? 'Unmute' : 'Mute'}
            >
                {isMuted || volume === 0
                    ? <SpeakerXIcon size={16} />
                    : volume < 0.5
                        ? <SpeakerLowIcon size={16} />
                        : <SpeakerHighIcon size={16} />
                }
            </button>
        </div>
    );
};

// ── Main Controls ─────────────────────────────────────────────────────────────
const VideoPlayerControls: React.FC<VideoPlayerControlsProps> = ({
    isPlaying, isMuted, progress, duration, currentTime = 0, buffered = 0,
    isBuffering, showNextEp, hasNextEpisode, title, mediaType,
    onPlayPause, onSeek, volume, onVolumeChange, onToggleMute, onTimelineSeek,
    onNextEpisode, onToggleFullscreen,
    onSubtitlesClick, onEpisodesClick, onSubtitleToggle,
    isMenuOpen, showUI, onClose,
    activePanel = 'none', setActivePanel,
}) => {
    const { t } = useTranslation();
    const isMobile = useIsMobile();
    const timelineRef = useRef<HTMLDivElement>(null);
    const volumeBtnRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [isHovering, setIsHovering] = useState(false);
    const [hoverPosition, setHoverPosition] = useState(0);
    const [hoverTime, setHoverTime] = useState(0);
    const [showVolume, setShowVolume] = useState(false);
    const volumeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const isTV = mediaType === 'tv';

    // Consistent icon size for all buttons
    const ICON_SIZE = isMobile ? 28 : 22;

    // ── Timeline helpers ──────────────────────────────────────────────────────
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

    // ── Volume hover helpers ──────────────────────────────────────────────────
    const handleVolumeEnter = () => {
        if (isMobile) return;
        if (volumeTimeoutRef.current) clearTimeout(volumeTimeoutRef.current);
        setShowVolume(true);
    };
    const handleVolumeLeave = () => {
        if (isMobile) return;
        volumeTimeoutRef.current = setTimeout(() => setShowVolume(false), 300);
    };

    // ── Panel hover for desktop ───────────────────────────────────────────────
    // Panels (subtitles, episodes) open on hover on desktop, close on mouse-leave
    const subtitleHoverTimeout = useRef<NodeJS.Timeout | null>(null);
    const episodesHoverTimeout = useRef<NodeJS.Timeout | null>(null);

    const handleSubtitleEnter = () => {
        if (isMobile) return;
        if (subtitleHoverTimeout.current) clearTimeout(subtitleHoverTimeout.current);
        setActivePanel?.('audioSubtitles');
    };
    const handleSubtitleLeave = () => {
        if (isMobile) return;
        // Longer timeout so user can move cursor into the panel without it closing
        subtitleHoverTimeout.current = setTimeout(() => {
            setActivePanel?.('none');
        }, 500);
    };

    const handleEpisodesEnter = () => {
        if (isMobile) return;
        if (episodesHoverTimeout.current) clearTimeout(episodesHoverTimeout.current);
        setActivePanel?.('episodes');
    };
    const handleEpisodesLeave = () => {
        if (isMobile) return;
        episodesHoverTimeout.current = setTimeout(() => {
            setActivePanel?.('none');
        }, 500);
    };

    // ── Base button style ─────────────────────────────────────────────────────
    const btn = 'flex items-center justify-center text-white/75 hover:text-white active:text-white/50 transition-all duration-150 active:scale-90 select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 rounded-sm';
    const btnActive = 'text-white';

    // ── Remaining time ────────────────────────────────────────────────────────
    const remaining = formatRemaining(currentTime, duration);

    return (
        <>
            {/* ── Clickable video overlay (center tap to pause) ── */}
            <div
                className={`absolute inset-0 z-20 cursor-pointer ${showUI ? '' : ''}`}
                onClick={onPlayPause}
                // Don't intercept clicks on actual controls
                style={{ pointerEvents: 'auto' }}
                aria-label={isPlaying ? 'Pause' : 'Play'}
            />

            {/* ── Back Button + Title (top-left, all platforms) ── */}
            <div
                className={`absolute top-0 left-0 right-0 z-40 px-4 md:px-8 pt-4 md:pt-5 flex items-center gap-3 transition-opacity duration-300 ${showUI ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
                style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, transparent 100%)' }}
            >
                <button
                    onClick={(e) => { e.stopPropagation(); onClose(); }}
                    className="flex items-center justify-center text-white/80 hover:text-white transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 rounded-sm flex-shrink-0"
                    aria-label="Close player"
                >
                    <ArrowLeftIcon size={isMobile ? 22 : 24} weight="bold" />
                </button>
                <span className="text-white font-semibold text-sm md:text-base tracking-wide line-clamp-1 drop-shadow-md">
                    {title}
                </span>
            </div>

            {/* ── Bottom Controls ── */}
            <div
                className={`absolute inset-x-0 bottom-0 z-30 transition-opacity duration-300 ${showUI ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
                style={{ touchAction: 'manipulation' }}
                onClick={(e) => e.stopPropagation()} // Don't bubble to click-to-pause overlay
            >
                {/* Gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none rounded-b-sm" />

                <div className={`relative px-4 md:px-8 pb-4 md:pb-6 pt-8`}>

                    {/* ── Progress Bar + Remaining Time on same row ── */}
                    <div className="flex items-center gap-3 mb-3 md:mb-4">
                        {/* Timeline */}
                        <div
                            ref={timelineRef}
                            className="relative flex-1 cursor-pointer group/timeline"
                            onMouseDown={handleTimelineStart}
                            onMouseMove={handleTimelineMove}
                            onMouseUp={handleTimelineEnd}
                            onMouseLeave={() => { setIsHovering(false); handleTimelineEnd(); }}
                            onMouseEnter={() => setIsHovering(true)}
                            onTouchStart={handleTimelineStart}
                            onTouchMove={handleTimelineMove}
                            onTouchEnd={handleTimelineEnd}
                            role="slider"
                            aria-label="Video progress"
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={Math.round(progress)}
                            tabIndex={0}
                            onKeyDown={(e) => {
                                if (e.key === 'ArrowRight') { e.preventDefault(); onTimelineSeek(Math.min(100, progress + 2)); }
                                if (e.key === 'ArrowLeft') { e.preventDefault(); onTimelineSeek(Math.max(0, progress - 2)); }
                            }}
                        >
                            {/* Hover time tooltip */}
                            {!isMobile && isHovering && (
                                <div
                                    className="absolute -top-8 -translate-x-1/2 bg-black/90 text-white text-xs px-2 py-1 rounded pointer-events-none"
                                    style={{ left: `${hoverPosition}%` }}
                                >
                                    {(() => {
                                        const t = hoverTime;
                                        const h = Math.floor(t / 3600);
                                        const m = Math.floor((t % 3600) / 60);
                                        const s = Math.floor(t % 60);
                                        return h > 0
                                            ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
                                            : `${m}:${s.toString().padStart(2, '0')}`;
                                    })()}
                                </div>
                            )}

                            {/* Track */}
                            <div className={`relative w-full flex items-center ${isMobile ? 'h-10' : 'h-8'}`}>
                                <div className="absolute left-0 w-full h-1 bg-white/20 rounded-full" />
                                <div className="absolute left-0 h-1 bg-white/35 rounded-full transition-none" style={{ width: `${buffered}%` }} />
                                <div className="absolute left-0 h-1 bg-[#e50914] rounded-full transition-none" style={{ width: `${progress}%` }} />
                                {/* Thumb */}
                                <div
                                    className={`absolute h-3.5 w-3.5 bg-[#e50914] rounded-full shadow-lg -translate-x-1/2 transition-transform ${isMobile || isDragging ? 'scale-100' : 'scale-0 group-hover/timeline:scale-110'}`}
                                    style={{ left: `${progress}%` }}
                                />
                            </div>
                        </div>

                        {/* Remaining time — right of progress bar */}
                        <span className="text-white/55 text-xs font-mono tabular-nums flex-shrink-0 select-none">
                            {remaining}
                        </span>
                    </div>

                    {/* ── Control Buttons Row ── */}
                    <div className="flex items-center justify-between">

                        {/* Left side */}
                        <div className="flex items-center gap-5 md:gap-6">
                            {isMobile ? (
                                <>
                                    <button onClick={() => onSeek(-10)} className={btn} aria-label="Rewind 10s">
                                        <ArrowCounterClockwiseIcon size={ICON_SIZE} />
                                    </button>
                                    <button onClick={onPlayPause} className={btn} aria-label={isPlaying ? 'Pause' : 'Play'}>
                                        {isPlaying
                                            ? <PauseIcon size={ICON_SIZE} weight="fill" />
                                            : <PlayIcon size={ICON_SIZE} weight="fill" />}
                                    </button>
                                    <button onClick={() => onSeek(10)} className={btn} aria-label="Fast-forward 10s">
                                        <ArrowClockwiseIcon size={ICON_SIZE} />
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button onClick={onPlayPause} className={btn} aria-label={isPlaying ? 'Pause' : 'Play'}>
                                        {isPlaying
                                            ? <PauseIcon size={ICON_SIZE} weight="fill" />
                                            : <PlayIcon size={ICON_SIZE} weight="fill" />}
                                    </button>
                                    <button onClick={() => onSeek(-10)} className={btn} aria-label="Rewind 10s">
                                        <ArrowCounterClockwiseIcon size={ICON_SIZE} />
                                    </button>
                                    <button onClick={() => onSeek(10)} className={btn} aria-label="Fast-forward 10s">
                                        <ArrowClockwiseIcon size={ICON_SIZE} />
                                    </button>

                                    {/* Volume button with hover popup */}
                                    <div
                                        ref={volumeBtnRef}
                                        className="relative flex items-center justify-center"
                                        onMouseEnter={handleVolumeEnter}
                                        onMouseLeave={handleVolumeLeave}
                                    >
                                        {showVolume && (
                                            <VolumePopup
                                                volume={volume}
                                                isMuted={isMuted}
                                                onVolumeChange={onVolumeChange}
                                                onToggleMute={onToggleMute}
                                            />
                                        )}
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onToggleMute(); }}
                                            className={btn}
                                            aria-label={isMuted ? 'Unmute' : 'Mute'}
                                            title="Volume (M)"
                                        >
                                            {isMuted || volume === 0
                                                ? <SpeakerXIcon size={ICON_SIZE} />
                                                : volume < 0.5
                                                    ? <SpeakerLowIcon size={ICON_SIZE} />
                                                    : <SpeakerHighIcon size={ICON_SIZE} />}
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Right side */}
                        <div className="flex items-center gap-5 md:gap-6">

                            {/* Next Episode — TV only, has next */}
                            {isTV && hasNextEpisode && onNextEpisode && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); onNextEpisode(); }}
                                    className={`${btn} ${showNextEp ? btnActive : ''}`}
                                    aria-label="Next episode"
                                    title="Next Episode (N)"
                                >
                                    <SkipForwardIcon size={ICON_SIZE} weight={showNextEp ? 'fill' : 'regular'} />
                                </button>
                            )}

                            {/* Subtitles — hover on desktop, click on mobile */}
                            {onSubtitlesClick && (
                                <div
                                    className="relative"
                                    onMouseEnter={handleSubtitleEnter}
                                    onMouseLeave={handleSubtitleLeave}
                                >
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (isMobile) onSubtitlesClick();
                                        }}
                                        className={`${btn} ${activePanel === 'audioSubtitles' ? btnActive : ''}`}
                                        aria-label="Subtitles & Audio"
                                        title="Subtitles (S)"
                                    >
                                        <SubtitlesIcon size={ICON_SIZE} weight={activePanel === 'audioSubtitles' ? 'fill' : 'regular'} />
                                    </button>
                                </div>
                            )}

                            {/* Episodes — TV only, hover on desktop, click on mobile */}
                            {isTV && onEpisodesClick && (
                                <>
                                    <div
                                        className="relative"
                                        onMouseEnter={handleEpisodesEnter}
                                        onMouseLeave={handleEpisodesLeave}
                                    >
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (isMobile) onEpisodesClick();
                                            }}
                                            className={`${btn} ${(activePanel === 'episodes' || activePanel === 'seasons') ? btnActive : ''}`}
                                            aria-label="Episode Explorer"
                                            title="Episodes"
                                        >
                                            <CardsThreeIcon size={ICON_SIZE} weight={(activePanel === 'episodes' || activePanel === 'seasons') ? 'fill' : 'regular'} />
                                        </button>
                                    </div>
                                    {/* Intentional gap before fullscreen when episodes button is present */}
                                    <span className="w-2 md:w-3 flex-shrink-0" aria-hidden="true" />
                                </>
                            )}

                            {/* Fullscreen */}
                            <button
                                onClick={(e) => { e.stopPropagation(); onToggleFullscreen(); }}
                                className={btn}
                                aria-label="Toggle fullscreen"
                                title="Fullscreen (F)"
                            >
                                <CornersOutIcon size={ICON_SIZE} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default VideoPlayerControls;
