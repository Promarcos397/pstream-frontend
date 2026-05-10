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
    CornersInIcon,
    ArrowLeftIcon,
    CropIcon,
} from '@phosphor-icons/react';
import { useIsMobile } from '../hooks/useIsMobile';
import { Episode } from '../types';

// ─── Types ───────────────────────────────────────────────────────────────────
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
    title: string;
    episodeNumber?: number;
    episodeName?: string;
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
    currentCaption?: string | null;
    allSources?: any[];
    currentSourceIndex?: number;
    qualities?: Array<{ height: number; bitrate: number; level: number }>;
    currentQuality?: number;
    onQualityChange?: (level: number) => void;
    isMenuOpen?: boolean;
    showUI: boolean;
    activePanel?: 'none' | 'episodes' | 'seasons' | 'audioSubtitles' | 'quality' | 'servers';
    setActivePanel?: (panel: any) => void;
    onInteraction?: () => void;
    onControlsHoverChange?: (isHovered: boolean) => void;
    nextEpisodeData?: {
        episodeNumber: number;
        name: string;
        description?: string;
        stillPath?: string;
    } | null;
    videoFit?: 'contain' | 'cover';
    onToggleFit?: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatTime = (time: number, duration: number): string => {
    if (isNaN(time)) return '0:00';
    const h = Math.floor(time / 3600);
    const m = Math.floor((time % 3600) / 60);
    const s = Math.floor(time % 60);
    if (duration >= 3600) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m}:${s.toString().padStart(2, '0')}`;
};

const formatRemaining = (currentTime: number, duration: number): string => {
    if (!duration || isNaN(duration)) return '';
    const remaining = Math.max(0, duration - currentTime);
    const h = Math.floor(remaining / 3600);
    const m = Math.floor((remaining % 3600) / 60);
    const s = Math.floor(remaining % 60);
    if (duration >= 3600) return `-${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `-${m}:${s.toString().padStart(2, '0')}`;
};

// ─── Volume Popup ─────────────────────────────────────────────────────────────
// Desktop: vertical slider · Mobile: horizontal slider (easier to use with thumb)
const VolumePopup: React.FC<{
    volume: number;
    isMuted: boolean;
    isMobile: boolean;
    onVolumeChange: (v: number) => void;
    onInteraction?: () => void;
}> = ({ volume, isMuted, isMobile, onVolumeChange, onInteraction }) => {
    const trackRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const effective = isMuted ? 0 : volume;

    // ── Desktop: vertical ────────────────────────────────────────────────────
    const TRACK_H = 110;
    const THUMB_HALF = 12;
    const fillPct = effective * 100;
    const fillPx = Math.round((fillPct / 100) * TRACK_H);
    const thumbBottom = Math.max(THUMB_HALF, Math.min(TRACK_H - THUMB_HALF, fillPx));

    const getVolV = (clientY: number) => {
        if (!trackRef.current) return effective;
        const rect = trackRef.current.getBoundingClientRect();
        return 1 - Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    };

    const getVolH = (clientX: number) => {
        if (!trackRef.current) return effective;
        const rect = trackRef.current.getBoundingClientRect();
        return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    };

    useEffect(() => {
        if (!isDragging) return;
        const onMove = (e: MouseEvent | TouchEvent) => {
            const pt = 'touches' in e ? e.touches[0] : e as MouseEvent;
            onVolumeChange(isMobile ? getVolH(pt.clientX) : getVolV(pt.clientY));
            onInteraction?.();
        };
        const onUp = () => setIsDragging(false);
        window.addEventListener('mousemove', onMove);
        window.addEventListener('touchmove', onMove, { passive: true });
        window.addEventListener('mouseup', onUp);
        window.addEventListener('touchend', onUp);
        return () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('touchmove', onMove);
            window.removeEventListener('mouseup', onUp);
            window.removeEventListener('touchend', onUp);
        };
    }, [isDragging, isMobile]);

    if (isMobile) {
        // Horizontal volume slider for mobile — easier to use  
        return (
            <div
                style={{
                    position: 'absolute',
                    bottom: '100%',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 180,
                    height: 50,
                    backgroundColor: '#262626',
                    borderRadius: 8,
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 16px',
                    zIndex: 100,
                    marginBottom: 8,
                    boxShadow: '0 4px 24px rgba(0,0,0,0.6)',
                }}
                onClick={(e) => { e.stopPropagation(); onInteraction?.(); }}
                onTouchStart={(e) => { e.stopPropagation(); onInteraction?.(); }}
                onTouchEnd={(e) => e.stopPropagation()}
            >
                <div
                    ref={trackRef}
                    style={{
                        flex: 1,
                        height: 6,
                        backgroundColor: '#555',
                        borderRadius: 3,
                        position: 'relative',
                        cursor: 'pointer',
                    }}
                    onClick={(e) => {
                        e.stopPropagation();
                        onVolumeChange(getVolH(e.clientX));
                    }}
                    onMouseDown={() => setIsDragging(true)}
                    onTouchStart={() => setIsDragging(true)}
                >
                    <div style={{
                        position: 'absolute', left: 0, top: 0, bottom: 0,
                        width: `${fillPct}%`,
                        backgroundColor: '#ff0000',
                        borderRadius: 3,
                    }} />
                    <div style={{
                        position: 'absolute',
                        top: '50%',
                        left: `${fillPct}%`,
                        transform: 'translate(-50%, -50%)',
                        width: 20,
                        height: 20,
                        backgroundColor: '#ff0000',
                        borderRadius: '50%',
                        cursor: 'grab',
                    }} />
                </div>
            </div>
        );
    }

    // Desktop: vertical slider (unchanged behavior)
    return (
        <div
            style={{
                position: 'absolute',
                bottom: '100%',
                left: '50%',
                transform: 'translateX(-50%)',
                width: 50,
                height: 160,
                backgroundColor: '#262626',
                borderRadius: 0,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'flex-end',
                paddingBottom: 20,
                zIndex: 100,
            }}
            onClick={(e) => { e.stopPropagation(); onInteraction?.(); }}
            onTouchStart={(e) => { e.stopPropagation(); onInteraction?.(); }}
            onTouchEnd={(e) => e.stopPropagation()}
        >
            <div
                ref={trackRef}
                style={{
                    width: 12,
                    height: TRACK_H,
                    backgroundColor: '#666',
                    position: 'relative',
                    cursor: 'pointer',
                }}
                onClick={(e) => { e.stopPropagation(); onVolumeChange(getVolV(e.clientY)); }}
            >
                <div style={{
                    position: 'absolute', bottom: 0, left: 0, width: '100%',
                    height: `${fillPct}%`,
                    backgroundColor: '#ff0000',
                }} />
                <div
                    style={{
                        position: 'absolute',
                        bottom: thumbBottom - THUMB_HALF,
                        left: -6, width: 24, height: 24,
                        backgroundColor: '#ff0000',
                        borderRadius: '50%',
                        cursor: 'grab',
                    }}
                    onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); setIsDragging(true); }}
                    onTouchStart={(e) => { e.stopPropagation(); setIsDragging(true); }}
                />
            </div>
        </div>
    );
};

// ─── Next Episode Popup ───────────────────────────────────────────────────────
const NextEpisodePopup: React.FC<{
    data: NonNullable<VideoPlayerControlsProps['nextEpisodeData']>;
    isMobile: boolean;
    onPlay: () => void;
    onInteraction?: () => void;
}> = ({ data, isMobile, onPlay, onInteraction }) => {
    const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w780';
    const imgSrc = data.stillPath ? `${TMDB_IMAGE_BASE}${data.stillPath}` : null;

    return (
        <div
            style={{
                position: 'absolute',
                bottom: '100%',
                right: isMobile ? 'auto' : -30,
                left: isMobile ? '50%' : 'auto',
                transform: isMobile ? 'translateX(-50%)' : 'none',
                // Responsive width: full-width-minus-padding on mobile, fixed on desktop
                width: isMobile ? 'calc(100vw - 40px)' : 550,
                maxWidth: isMobile ? 360 : 550,
                backgroundColor: '#141414',
                border: '2px solid #ffffff',
                boxShadow: '0px 20px 50px rgba(0,0,0,0.9)',
                borderRadius: isMobile ? 8 : 0,
                overflow: 'hidden',
                zIndex: 100,
                marginBottom: 12,
            }}
            onClick={(e) => { e.stopPropagation(); onInteraction?.(); }}
            onTouchStart={(e) => { e.stopPropagation(); onInteraction?.(); }}
            onTouchEnd={(e) => e.stopPropagation()}
        >
            <div style={{
                backgroundColor: '#262626',
                padding: isMobile ? '12px 16px' : '16px 22px',
                fontSize: isMobile ? 16 : 22,
                fontWeight: 700,
                borderBottom: '1px solid #000',
                fontFamily: 'Consolas, monospace',
            }}>
                Next episode
            </div>

            <div style={{ display: 'flex', padding: isMobile ? 14 : 22, gap: isMobile ? 12 : 22, alignItems: 'flex-start' }}>
                {/* Thumbnail */}
                <div
                    style={{
                        position: 'relative',
                        width: isMobile ? 120 : 220,
                        height: isMobile ? 68 : 124,
                        flexShrink: 0,
                        backgroundColor: '#333',
                        cursor: 'pointer',
                        borderRadius: 2,
                        overflow: 'hidden',
                    }}
                    onClick={onPlay}
                >
                    {imgSrc ? (
                        <img src={imgSrc} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                        <div style={{ width: '100%', height: '100%', backgroundColor: '#2a2a2a' }} />
                    )}
                    <div style={{
                        position: 'absolute', inset: 0,
                        background: 'rgba(0,0,0,0.2)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <svg viewBox="0 0 24 24" style={{ width: isMobile ? 28 : 44, height: isMobile ? 28 : 44, fill: 'rgba(255,255,255,0.85)', filter: 'drop-shadow(0 2px 5px rgba(0,0,0,0.6))' }}>
                            <path d="M8 5v14l11-7z" />
                        </svg>
                    </div>
                </div>

                {/* Text */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 2, flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', fontSize: isMobile ? 14 : 19, fontWeight: 700, fontFamily: 'Consolas, monospace', gap: 8 }}>
                        <span>{data.episodeNumber}</span>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{data.name}</span>
                    </div>
                    {data.description && !isMobile && (
                        <div style={{
                            fontSize: 14, lineHeight: 1.4, color: '#ccc',
                            display: '-webkit-box',
                            WebkitLineClamp: 4,
                            WebkitBoxOrient: 'vertical' as any,
                            overflow: 'hidden',
                        }}>
                            {data.description}
                        </div>
                    )}
                    {/* Mobile: play button */}
                    {isMobile && (
                        <button onClick={onPlay} style={{
                            marginTop: 4,
                            padding: '6px 14px',
                            backgroundColor: '#e50914',
                            color: 'white',
                            border: 'none',
                            borderRadius: 4,
                            fontSize: 13,
                            fontWeight: 700,
                            cursor: 'pointer',
                            alignSelf: 'flex-start',
                        }}>
                            Play Now
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

// ─── Play/Pause Ripple Animation ──────────────────────────────────────────────
const PlayPauseRipple: React.FC<{ isPlaying: boolean; trigger: number }> = ({ isPlaying, trigger }) => {
    const [visible, setVisible] = useState(false);
    useEffect(() => {
        if (trigger === 0) return;
        setVisible(true);
        const t = setTimeout(() => setVisible(false), 600);
        return () => clearTimeout(t);
    }, [trigger]);

    if (!visible) return null;

    return (
        <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 25, pointerEvents: 'none',
        }}>
            <div style={{
                width: 80, height: 80,
                borderRadius: '50%',
                backgroundColor: 'rgba(0,0,0,0.45)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                animation: 'pp-ripple 0.55s ease-out forwards',
            }}>
                {isPlaying
                    ? <PlayIcon size={36} weight="fill" color="white" />
                    : <PauseIcon size={36} weight="fill" color="white" />
                }
            </div>
        </div>
    );
};

// ─── Title Component ──────────────────────────────────────────────────────────
const PlayerTitle: React.FC<{
    title: string;
    episodeNumber?: number;
    episodeName?: string;
    mediaType?: string;
    className?: string;
}> = ({ title, episodeNumber, episodeName, mediaType, className = '' }) => {
    const isTV = mediaType === 'tv';
    return (
        <span className={`font-consolas select-none leading-snug ${className}`}>
            <strong>{title}</strong>
            {isTV && episodeNumber != null && (
                <>
                    <strong>{'  '}E{episodeNumber}</strong>
                    {episodeName && (
                        <span className="font-normal text-white/75">{'  '}{episodeName}</span>
                    )}
                </>
            )}
        </span>
    );
};

// ─── Seek Flash Overlay (double-tap) ─────────────────────────────────────────
const SeekFlash: React.FC<{ side: 'left' | 'right' | null; seconds: number }> = ({ side, seconds }) => {
    if (!side) return null;
    return (
        <div style={{
            position: 'absolute', top: 0, bottom: 0,
            [side]: 0,
            width: '33%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 28, pointerEvents: 'none',
            backgroundColor: 'rgba(255,255,255,0.1)',
            borderRadius: side === 'left' ? '0 80px 80px 0' : '80px 0 0 80px',
            animation: 'seek-flash 0.4s ease-out forwards',
        }}>
            <span style={{
                color: 'white',
                fontFamily: 'Consolas, monospace',
                fontSize: 15,
                fontWeight: 700,
                opacity: 0.95,
                textShadow: '0 1px 4px rgba(0,0,0,0.8)',
            }}>
                {side === 'left' ? `◀◀ ${seconds}s` : `${seconds}s ▶▶`}
            </span>
        </div>
    );
};

// ─── Main Controls Component ──────────────────────────────────────────────────
const VideoPlayerControls: React.FC<VideoPlayerControlsProps> = ({
    isPlaying, isMuted, progress, duration, currentTime = 0, buffered = 0,
    isBuffering, showNextEp, hasNextEpisode, title, episodeNumber, episodeName, mediaType,
    onPlayPause, onSeek, volume, onVolumeChange, onToggleMute, onTimelineSeek,
    onNextEpisode, onToggleFullscreen,
    onSubtitlesClick, onEpisodesClick,
    showUI, onClose,
    activePanel = 'none', setActivePanel,
    onInteraction, onControlsHoverChange,
    nextEpisodeData,
    videoFit, onToggleFit,
}) => {
    const isMobile = useIsMobile();
    const timelineRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [isHovering, setIsHovering] = useState(false);
    const [hoverPosition, setHoverPosition] = useState(0);
    const [hoverTime, setHoverTime] = useState(0);
    const [showVolume, setShowVolume] = useState(false);
    const [showNextEpPopup, setShowNextEpPopup] = useState(false);
    const [ppRippleTrigger, setPpRippleTrigger] = useState(0);
    const [seekFlash, setSeekFlash] = useState<{ side: 'left' | 'right'; ts: number } | null>(null);
    // Track live drag position separately from playback progress for smooth scrubbing
    const [dragProgress, setDragProgress] = useState(0);

    const isTV = mediaType === 'tv';
    const isPanelOpen = activePanel !== 'none' || showVolume || showNextEpPopup;

    const ICON_SIZE = isMobile ? 34 : 30;

    useEffect(() => {
        onControlsHoverChange?.(isHovering || isDragging);
    }, [isHovering, isDragging, onControlsHoverChange]);

    const handleTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
        e.stopPropagation();
        onInteraction?.();
    };

    // ── Global touch/mouse drag for timeline scrubbing ─────────────────────
    // Mirrors legacy useProgressBar — listeners on document so drag works
    // even when finger moves outside the bar (critical on mobile!)
    useEffect(() => {
        if (!isDragging) return;

        const onMove = (e: MouseEvent | TouchEvent) => {
            if (!timelineRef.current) return;
            const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
            const rect = timelineRef.current.getBoundingClientRect();
            const perc = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
            setDragProgress(perc);
            setHoverPosition(perc);
            setHoverTime((perc / 100) * duration);
            // Commit continuously so the video position updates while scrubbing
            onTimelineSeek(perc);
        };

        const onUp = (e: MouseEvent | TouchEvent) => {
            if (!timelineRef.current) return;
            const clientX = 'changedTouches' in e
                ? (e as TouchEvent).changedTouches[0].clientX
                : (e as MouseEvent).clientX;
            const rect = timelineRef.current.getBoundingClientRect();
            const perc = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
            onTimelineSeek(perc);
            setIsDragging(false);
        };

        // Prevent page scroll while scrubbing on mobile
        document.addEventListener('mousemove', onMove);
        document.addEventListener('touchmove', onMove, { passive: false });
        document.addEventListener('mouseup', onUp);
        document.addEventListener('touchend', onUp);

        return () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('touchmove', onMove);
            document.removeEventListener('mouseup', onUp);
            document.removeEventListener('touchend', onUp);
        };
    }, [isDragging, duration, onTimelineSeek]);

    const handleTimelineStart = useCallback((e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
        e.stopPropagation();
        if (!timelineRef.current) return;
        const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
        const rect = timelineRef.current.getBoundingClientRect();
        const perc = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
        setDragProgress(perc);
        setIsDragging(true);
        onTimelineSeek(perc);
    }, [onTimelineSeek]);

    const handleTimelineHover = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (!timelineRef.current) return;
        const rect = timelineRef.current.getBoundingClientRect();
        const perc = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
        setHoverPosition(perc);
        setHoverTime((perc / 100) * duration);
    }, [duration]);

    const handlePlayPause = () => {
        onPlayPause();
        setPpRippleTrigger(t => t + 1);
    };

    const triggerSeekFlash = (side: 'left' | 'right') => {
        setSeekFlash({ side, ts: Date.now() });
        setTimeout(() => setSeekFlash(null), 450);
    };

    const toggleVolume = () => { setShowVolume(p => !p); setShowNextEpPopup(false); setActivePanel?.('none'); };
    const toggleNextEp = () => {
        // If we have episode preview data, show the popup for confirmation
        if (nextEpisodeData) {
            setShowNextEpPopup(p => !p); setShowVolume(false); setActivePanel?.('none');
        } else if (onNextEpisode) {
            // No popup data — fire immediately (this is the common case)
            onNextEpisode();
        }
    };

    const toggleSubtitles = () => {
        if (activePanel === 'audioSubtitles') setActivePanel?.('none');
        else { setActivePanel?.('audioSubtitles'); setShowVolume(false); setShowNextEpPopup(false); }
    };
    const toggleEpisodes = () => {
        if (activePanel === 'episodes' || activePanel === 'seasons') setActivePanel?.('none');
        else { setActivePanel?.('episodes'); setShowVolume(false); setShowNextEpPopup(false); }
    };

    // Display progress: use drag position while dragging for instant feedback
    const displayProgress = isDragging ? dragProgress : progress;

    const btn = 'flex items-center justify-center text-white/80 hover:text-white active:text-white/40 transition-all duration-150 active:scale-90 select-none focus:outline-none rounded-sm p-1.5 hover:scale-110';
    const btnActive = 'text-white';
    const remaining = formatRemaining(currentTime, duration);

    // Responsive progress-bar sizing: thicker track + larger thumb on mobile for touch
    const trackH  = isMobile ? 'h-[6px]' : 'h-[8px]';
    const thumbSz = isMobile ? 'h-[20px] w-[20px]' : 'h-[16px] w-[16px]';

    // ── Safe-area padding for iOS home bar and notch ───────────────────────
    // Uses CSS env() so it's dynamic and works in both portrait and landscape
    const safeBottom = 'max(env(safe-area-inset-bottom, 0px), 8px)';
    const safeLeft = 'env(safe-area-inset-left, 0px)';
    const safeRight = 'env(safe-area-inset-right, 0px)';

    return (
        <>
            {/* ── Ripple on play/pause ── */}
            <PlayPauseRipple isPlaying={isPlaying} trigger={ppRippleTrigger} />

            {/* ── Seek flash ── */}
            {seekFlash && <SeekFlash side={seekFlash.side} seconds={10} />}

            {/* Background layer for dismissal when panels are open */}
            {isPanelOpen && (
                <div
                    className="absolute inset-0 z-10 cursor-default"
                    onClick={(e) => {
                        e.stopPropagation();
                        setActivePanel?.('none');
                        setShowVolume(false);
                        setShowNextEpPopup(false);
                    }}
                    onTouchStart={handleTouchStart}
                    onTouchEnd={(e) => {
                        e.stopPropagation();
                        setActivePanel?.('none');
                        setShowVolume(false);
                        setShowNextEpPopup(false);
                    }}
                />
            )}

            {/* ── TOP: Back + title (mobile) ── */}
            {isMobile && (
                <div
                    className={`absolute top-0 left-0 right-0 z-40 flex items-center gap-3 transition-opacity duration-300 ${showUI ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
                    style={{
                        paddingTop: `max(env(safe-area-inset-top, 0px), 16px)`,
                        paddingLeft: `max(${safeLeft}, 16px)`,
                        paddingRight: `max(${safeRight}, 16px)`,
                        paddingBottom: 16,
                        background: 'linear-gradient(to bottom, rgba(0,0,0,0.85) 0%, transparent 100%)',
                    }}
                    onTouchStart={handleTouchStart}
                    onTouchEnd={(e) => e.stopPropagation()}
                >
                    {/* Larger back button for better touch target (min 44×44) */}
                    <button
                        onClick={(e) => { e.stopPropagation(); onClose(); }}
                        className="flex items-center justify-center text-white transition-all flex-shrink-0"
                        style={{ minWidth: 44, minHeight: 44 }}
                        aria-label="Close player"
                    >
                        <ArrowLeftIcon size={28} weight="bold" />
                    </button>
                    <PlayerTitle
                        title={title}
                        episodeNumber={episodeNumber}
                        episodeName={episodeName}
                        mediaType={mediaType}
                        className="text-white text-sm line-clamp-1 drop-shadow-md"
                    />
                    <div className="flex-1" />
                    {onToggleFit && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onToggleFit(); }}
                            className="flex items-center gap-2 px-3 py-1.5 bg-black/40 backdrop-blur-md border border-white/20 rounded-full text-white/90 hover:bg-white/20 transition-all active:scale-95"
                            style={{ minHeight: 36 }}
                        >
                            <CropIcon size={18} weight="bold" />
                            <span className="text-[11px] font-bold tracking-widest uppercase">{videoFit === 'cover' ? 'Fill' : 'Fit'}</span>
                        </button>
                    )}
                </div>
            )}

            {/* ── CENTER: Mobile Playback Controls ── */}
            {isMobile && (
                <div
                    className={`absolute inset-0 z-30 flex items-center justify-center gap-10 transition-opacity duration-300 pointer-events-none ${showUI ? 'opacity-100' : 'opacity-0'}`}
                >
                    <button
                        onClick={(e) => { e.stopPropagation(); onSeek(-10); triggerSeekFlash('left'); }}
                        onTouchStart={handleTouchStart}
                        onTouchEnd={(e) => e.stopPropagation()}
                        className={`pointer-events-auto flex items-center justify-center text-white/90 hover:text-white hover:scale-110 active:scale-90 transition-all`}
                        style={{ width: 64, height: 64 }}
                        aria-label="Rewind 10s"
                    >
                        <ArrowCounterClockwiseIcon size={44} weight="bold" />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); handlePlayPause(); }}
                        onTouchStart={handleTouchStart}
                        onTouchEnd={(e) => e.stopPropagation()}
                        className={`pointer-events-auto flex items-center justify-center text-white/90 hover:text-white hover:scale-110 active:scale-90 transition-all`}
                        style={{ width: 80, height: 80 }}
                        aria-label={isPlaying ? 'Pause' : 'Play'}
                    >
                        {isPlaying ? <PauseIcon size={64} weight="fill" /> : <PlayIcon size={64} weight="fill" />}
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); onSeek(10); triggerSeekFlash('right'); }}
                        onTouchStart={handleTouchStart}
                        onTouchEnd={(e) => e.stopPropagation()}
                        className={`pointer-events-auto flex items-center justify-center text-white/90 hover:text-white hover:scale-110 active:scale-90 transition-all`}
                        style={{ width: 64, height: 64 }}
                        aria-label="Fast-forward 10s"
                    >
                        <ArrowClockwiseIcon size={44} weight="bold" />
                    </button>
                </div>
            )}

            {/* ── TOP: Back button (desktop only, top-left) ── */}
            {!isMobile && (
                <div className={`absolute top-0 inset-x-0 z-40 px-8 pt-8 flex items-center justify-between transition-opacity duration-300 ${showUI ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
                    <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="flex items-center justify-center text-white/80 hover:text-white hover:scale-110 transition-all p-1.5" aria-label="Close player">
                        <ArrowLeftIcon size={30} weight="bold" />
                    </button>
                    
                    {onToggleFit && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onToggleFit(); }}
                            className="flex items-center gap-2 px-4 py-2 bg-zinc-900/60 backdrop-blur-md border border-white/10 rounded-full text-white/80 hover:text-white hover:bg-zinc-800 transition-all active:scale-95 shadow-xl"
                        >
                            <CropIcon size={20} weight="bold" />
                            <span className="text-xs font-bold tracking-[0.15em] uppercase">{videoFit === 'cover' ? 'Original' : 'Zoom to Fill'}</span>
                        </button>
                    )}
                </div>
            )}

            {/* ── BOTTOM Controls ── */}
            <div
                id="video-controls-container"
                className={`absolute inset-x-0 bottom-0 z-30 transition-opacity duration-300 ${showUI ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
                onClick={(e) => e.stopPropagation()}
                onTouchStart={handleTouchStart}
                onTouchEnd={(e) => e.stopPropagation()}
                onMouseEnter={() => setIsHovering(true)}
                onMouseLeave={() => setIsHovering(false)}
            >
                <div className="absolute inset-0 bg-gradient-to-t from-black/98 via-black/60 to-transparent pointer-events-none" />

                <div
                    className="relative"
                    style={{
                        paddingLeft: `max(${safeLeft}, ${isMobile ? '16px' : '40px'})`,
                        paddingRight: `max(${safeRight}, ${isMobile ? '16px' : '40px'})`,
                        paddingTop: isMobile ? 24 : 40,
                        paddingBottom: `max(${safeBottom}, ${isMobile ? '16px' : '24px'})`,
                    }}
                >
                    {/* ── Progress bar ── */}
                    <div className={`flex items-center gap-3 transition-all duration-200 ${isPanelOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
                        style={{
                            height: isPanelOpen ? 0 : undefined,
                            marginBottom: isPanelOpen ? 0 : (isMobile ? 12 : 20),
                            overflow: isPanelOpen ? 'hidden' : undefined,
                        }}
                    >
                        {/* Current time */}
                        <span className="text-white text-xs font-consolas tabular-nums flex-shrink-0 select-none min-w-[50px] text-left">{formatTime(currentTime, duration)}</span>

                        <div
                            ref={timelineRef}
                            className="relative flex-1 cursor-pointer group/timeline"
                            onMouseDown={handleTimelineStart}
                            onMouseMove={handleTimelineHover}
                            onMouseEnter={() => setIsHovering(true)}
                            onMouseLeave={() => setIsHovering(false)}
                            // Touch: start scrub immediately
                            onTouchStart={handleTimelineStart}
                            // Note: touchmove/touchend handled globally above
                            role="slider"
                            aria-label="Video progress"
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={Math.round(displayProgress)}
                            tabIndex={0}
                            onKeyDown={(e) => {
                                if (e.key === 'ArrowRight') { e.preventDefault(); onTimelineSeek(Math.min(100, progress + 2)); }
                                if (e.key === 'ArrowLeft') { e.preventDefault(); onTimelineSeek(Math.max(0, progress - 2)); }
                            }}
                        >
                            {/* Hover tooltip — timestamp only (desktop) */}
                            {!isMobile && isHovering && !isDragging && (
                                <div className="absolute -top-10 -translate-x-1/2 flex flex-col items-center pointer-events-none z-50" style={{ left: `${hoverPosition}%` }}>
                                    <div className="bg-black/95 text-white text-[13px] px-3 py-1.5 font-consolas shadow-xl border border-white/10" style={{ borderRadius: 2 }}>
                                        {(() => {
                                            const t = hoverTime;
                                            const h = Math.floor(t / 3600);
                                            const m = Math.floor((t % 3600) / 60);
                                            const s = Math.floor(t % 60);
                                            return h > 0 ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}` : `${m}:${s.toString().padStart(2, '0')}`;
                                        })()}
                                    </div>
                                </div>
                            )}

                            {/* Track — flat bars matching InfoModal/card style */}
                            <div className={`relative w-full flex items-center ${isMobile ? 'h-10' : 'h-8'}`}>
                                <div className={`absolute left-0 w-full ${trackH} bg-white/20`} style={{ borderRadius: 0 }} />
                                <div className={`absolute left-0 ${trackH} bg-white/30`} style={{ borderRadius: 0, width: `${buffered}%` }} />
                                <div className={`absolute left-0 ${trackH} bg-[#e50914] transition-all`} style={{ borderRadius: 0, width: `${displayProgress}%` }} />
                                {/* Thumb — square on desktop, round on mobile for thumb-friendliness */}
                                <div
                                    className={`absolute ${thumbSz} bg-white shadow-lg -translate-x-1/2 transition-transform ${isMobile || isDragging ? 'scale-100 rounded-full' : 'scale-0 group-hover/timeline:scale-125 rounded-[2px]'}`}
                                    style={{ left: `${displayProgress}%` }}
                                />
                            </div>
                        </div>
                        {/* Remaining time */}
                        <span className="text-white/60 text-xs font-consolas tabular-nums flex-shrink-0 select-none min-w-[60px] text-right">{remaining}</span>
                    </div>

                    {/* ── Control Buttons Row ── */}
                    <div className="flex items-center justify-between relative">

                        {/* LEFT GROUP */}
                        <div className={`flex items-center gap-5 md:gap-8`}>
                            {!isMobile ? (
                                <>
                                    {/* Desktop: play | rewind | ff | volume */}
                                    <button onClick={handlePlayPause} className={btn} aria-label={isPlaying ? 'Pause' : 'Play'}>
                                        {isPlaying ? <PauseIcon size={ICON_SIZE} weight="fill" /> : <PlayIcon size={ICON_SIZE} weight="fill" />}
                                    </button>
                                    <button onClick={() => onSeek(-10)} className={btn} aria-label="Rewind 10s">
                                        <ArrowCounterClockwiseIcon size={ICON_SIZE} />
                                    </button>
                                    <button onClick={() => onSeek(10)} className={btn} aria-label="Fast-forward 10s">
                                        <ArrowClockwiseIcon size={ICON_SIZE} />
                                    </button>
                                    {/* Volume */}
                                    <div className="relative">
                                        {showVolume && (
                                            <VolumePopup volume={volume} isMuted={isMuted} isMobile={false} onVolumeChange={onVolumeChange} onInteraction={onInteraction} />
                                        )}
                                        <button onClick={(e) => { e.stopPropagation(); toggleVolume(); }} onTouchStart={handleTouchStart} className={btn} aria-label={isMuted ? 'Unmute' : 'Mute'} title="Volume (M)">
                                            {isMuted || volume === 0 ? <SpeakerXIcon size={ICON_SIZE} /> : volume < 0.5 ? <SpeakerLowIcon size={ICON_SIZE} /> : <SpeakerHighIcon size={ICON_SIZE} />}
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    {/* Mobile Left: Episodes & Subtitles */}
                                    {isTV && onEpisodesClick && (
                                        <div className="relative">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); toggleEpisodes(); }}
                                                className={`${btn} ${(activePanel === 'episodes' || activePanel === 'seasons') ? btnActive : ''}`}
                                                style={{ minWidth: 44, minHeight: 44 }}
                                                aria-label="Episode Explorer"
                                            >
                                                <CardsThreeIcon size={ICON_SIZE} weight={(activePanel === 'episodes' || activePanel === 'seasons') ? 'fill' : 'regular'} />
                                            </button>
                                        </div>
                                    )}
                                    {onSubtitlesClick && (
                                        <div className="relative">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); toggleSubtitles(); }}
                                                className={`${btn} ${activePanel === 'audioSubtitles' ? btnActive : ''}`}
                                                style={{ minWidth: 44, minHeight: 44 }}
                                                aria-label="Subtitles & Audio"
                                                title="Subtitles (S)"
                                            >
                                                <SubtitlesIcon size={ICON_SIZE} weight={activePanel === 'audioSubtitles' ? 'fill' : 'regular'} />
                                            </button>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        {/* CENTER: Title (desktop only) */}
                        {!isMobile && (
                            <div className="absolute left-1/2 -translate-x-1/2 pointer-events-none px-4 text-center" style={{ maxWidth: '46%', bottom: 0 }}>
                                <PlayerTitle title={title} episodeNumber={episodeNumber} episodeName={episodeName} mediaType={mediaType} className="text-white/80 text-[22px] drop-shadow-lg line-clamp-2" />
                            </div>
                        )}

                        {/* RIGHT GROUP */}
                        <div className={`flex items-center ${isMobile ? 'gap-4' : 'gap-5 md:gap-8'}`}>

                            {/* Next Episode */}
                            {isTV && hasNextEpisode && onNextEpisode && (
                                <div className="relative">
                                    {showNextEpPopup && nextEpisodeData && (
                                        <NextEpisodePopup
                                            data={nextEpisodeData}
                                            isMobile={isMobile}
                                            onPlay={() => { onNextEpisode(); setShowNextEpPopup(false); }}
                                            onInteraction={onInteraction}
                                        />
                                    )}
                                    <button
                                        onClick={(e) => { e.stopPropagation(); toggleNextEp(); }}
                                        className={`${btn} ${showNextEp ? btnActive : ''}`}
                                        style={isMobile ? { minWidth: 44, minHeight: 44 } : {}}
                                        aria-label="Next episode"
                                    >
                                        <SkipForwardIcon size={ICON_SIZE} weight={showNextEp ? 'fill' : 'regular'} />
                                    </button>
                                </div>
                            )}

                            {/* Subtitles & Audio (Desktop) */}
                            {!isMobile && onSubtitlesClick && (
                                <div className="relative">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); toggleSubtitles(); }}
                                        className={`${btn} ${activePanel === 'audioSubtitles' ? btnActive : ''}`}
                                        aria-label="Subtitles & Audio"
                                        title="Subtitles (S)"
                                    >
                                        <SubtitlesIcon size={ICON_SIZE} weight={activePanel === 'audioSubtitles' ? 'fill' : 'regular'} />
                                    </button>
                                </div>
                            )}

                            {/* Episodes — TV only (Desktop) */}
                            {!isMobile && isTV && onEpisodesClick && (
                                <div className="relative">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); toggleEpisodes(); }}
                                        className={`${btn} ${(activePanel === 'episodes' || activePanel === 'seasons') ? btnActive : ''}`}
                                        aria-label="Episode Explorer"
                                    >
                                        <CardsThreeIcon size={ICON_SIZE} weight={(activePanel === 'episodes' || activePanel === 'seasons') ? 'fill' : 'regular'} />
                                    </button>
                                </div>
                            )}

                            {/* Fullscreen */}
                            <button
                                onClick={(e) => { e.stopPropagation(); onToggleFullscreen(); }}
                                className={btn}
                                style={isMobile ? { minWidth: 44, minHeight: 44 } : {}}
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
