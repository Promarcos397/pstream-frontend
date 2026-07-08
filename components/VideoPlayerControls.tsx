import React, { useRef, useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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
    GearIcon,
} from '@phosphor-icons/react';
import { useIsMobile } from '../hooks/useIsMobile';
import { Episode } from '../types';
import { SkipSegment } from '../hooks/useSkipTimestamps';
import { AutoplayCountdown } from './AutoplayCountdown';

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
    hasPreviousEpisode?: boolean;
    nextEpisode?: Episode;
    title: string;
    episodeNumber?: number;
    episodeName?: string;
    mediaType?: string;
    showAutoplayCountdown?: boolean;
    onCancelAutoplay?: () => void;
    onPlayNextNow?: () => void;
    onPlayPause: () => void;
    onSeek: (amount: number) => void;
    volume: number;
    onVolumeChange: (volume: number) => void;
    onToggleMute: () => void;
    onTimelineSeek: (percentage: number) => void;
    onNextEpisode?: () => void;
    onPrevEpisode?: () => void;
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
    activePanel?: 'none' | 'episodes' | 'seasons' | 'audioSubtitles' | 'quality' | 'servers' | 'playback';
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
    ppRippleTrigger?: number;
    setPpRippleTrigger?: React.Dispatch<React.SetStateAction<number>>;
    seekFlash?: { side: 'left' | 'right'; ts: number } | null;
    setSeekFlash?: React.Dispatch<React.SetStateAction<{ side: 'left' | 'right'; ts: number } | null>>;
    skipSegments?: SkipSegment[];
    onSkipSegment?: (segment: SkipSegment) => void;
    isEmbedFallback?: boolean;
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
const disableAutoNextButton = true;    // temporly hide and disable the next and watch credits buttons

// ─── Volume Popup ─────────────────────────────────────────────────────────────
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
    const { t } = useTranslation();
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
                width: isMobile ? 'calc(100vw - 40px)' : 550,
                maxWidth: isMobile ? 360 : 550,
                backgroundColor: '#141414',
                border: '1px solid rgba(255,255,255,0.1)',
                boxShadow: '0px 10px 30px rgba(0,0,0,0.8)',
                borderRadius: isMobile ? 8 : 4,
                overflow: 'hidden',
                zIndex: 100,
                marginBottom: 12,
            }}
            onClick={(e) => { e.stopPropagation(); onInteraction?.(); }}
            onTouchStart={(e) => { e.stopPropagation(); onInteraction?.(); }}
            onTouchEnd={(e) => e.stopPropagation()}
        >
            <div style={{
                backgroundColor: '#141414',
                padding: isMobile ? '12px 16px' : '16px 22px',
                fontSize: isMobile ? 14 : 18,
                fontWeight: 800,
                color: '#fff',
                borderBottom: '1px solid rgba(255,255,255,0.1)',
                textTransform: 'uppercase',
                letterSpacing: '1px',
            }}>
                {t('player.nextEpisode')}
            </div>

            <div style={{ display: 'flex', padding: isMobile ? 14 : 22, gap: isMobile ? 12 : 22, alignItems: 'flex-start' }}>
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
                        <PlayIcon size={isMobile ? 28 : 44} weight="fill" color="white" style={{ opacity: 0.9, filter: 'drop-shadow(0 2px 10px rgba(0,0,0,0.8))' }} />
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 2, flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', fontSize: isMobile ? 14 : 18, fontWeight: 700, gap: 8 }}>
                        <span className="text-red-600">E{data.episodeNumber}</span>
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
        const t = setTimeout(() => setVisible(false), 500);
        return () => clearTimeout(t);
    }, [trigger]);

    if (!visible) return null;

    return (
        <div key={trigger} style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 25, pointerEvents: 'none',
        }}>
            <div style={{
                width: 80, height: 80,
                borderRadius: '50%',
                backgroundColor: 'rgba(0,0,0,0.45)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                animation: 'pp-ripple 0.45s ease-out forwards',
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
        <span className={`select-none leading-snug ${className}`}>
            <strong className="font-bold text-white">{title}</strong>
            {isTV && episodeNumber != null && (
                <>
                    <strong className="text-white ml-3 font-bold">E{episodeNumber}</strong>
                    {episodeName && (
                        <span className="font-semibold text-white ml-3">{episodeName}</span>
                    )}
                </>
            )}
        </span>
    );
};

// ─── Seek Flash Overlay (double-tap) ─────────────────────────────────────────
const SeekFlash: React.FC<{ side: 'left' | 'right' | null; seconds: number; ts?: number }> = ({ side, seconds, ts }) => {
    const isMobile = useIsMobile();
    if (!side || isMobile) return null;

    const Icon = side === 'left' ? ArrowCounterClockwiseIcon : ArrowClockwiseIcon;
    return (
        <div key={side + '-' + (ts || 0)} style={{
            position: 'absolute',
            top: '50%',
            [side === 'left' ? 'left' : 'right']: '10%',
            transform: 'translate(-50%, -50%)',
            zIndex: 100,
            pointerEvents: 'none',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            width: 80,
            height: 80,
            backgroundColor: 'rgba(0,0,0,0.45)',
            borderRadius: '50%',
            animation: 'seek-circle-flash 0.45s ease-out forwards',
        }}>
            <div className="relative flex items-center justify-center">
                <Icon size={36} weight="fill" className="text-white" />
                <span style={{
                    position: 'absolute',
                    top: '55%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    color: 'white',
                    fontSize: 12,
                    fontWeight: 600,
                    fontFamily: 'Inter, sans-serif',
                    textShadow: '0 1px 4px rgba(0,0,0,0.4)',
                }}>{seconds}</span>
            </div>
        </div>
    );
};

// ─── Main Controls Component ──────────────────────────────────────────────────
const VideoPlayerControls: React.FC<VideoPlayerControlsProps> = ({
    isPlaying, isMuted, progress, duration, currentTime = 0, buffered = 0,
    isBuffering, showNextEp, hasNextEpisode, hasPreviousEpisode, title, episodeNumber, episodeName, mediaType,
    showAutoplayCountdown = false, onCancelAutoplay, onPlayNextNow,
    onPlayPause, onSeek, volume, onVolumeChange, onToggleMute, onTimelineSeek,
    onNextEpisode, onPrevEpisode, onToggleFullscreen,
    onSubtitlesClick, onEpisodesClick,
    showUI, onClose,
    activePanel = 'none', setActivePanel,
    onInteraction, onControlsHoverChange,
    nextEpisodeData,
    videoFit, onToggleFit,
    ppRippleTrigger = 0, setPpRippleTrigger,
    seekFlash = null, setSeekFlash,
    skipSegments = [], onSkipSegment,
    isEmbedFallback = false,
}) => {
    const { t } = useTranslation();
    const isMobile = useIsMobile();
    const timelineRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [isHovering, setIsHovering] = useState(false);
    const [hoverPosition, setHoverPosition] = useState(0);
    const [hoverTime, setHoverTime] = useState(0);
    const [showVolume, setShowVolume] = useState(false);
    const [showNextEpPopup, setShowNextEpPopup] = useState(false);
    const [dragProgress, setDragProgress] = useState(0);

    const isTV = mediaType === 'tv';
    const isPanelOpen = activePanel !== 'none' || showVolume || showNextEpPopup;

    const ICON_SIZE = isMobile ? 40 : 48;
    const isAnyLocalPopupOpen = showVolume || showNextEpPopup;

    useEffect(() => {
        onControlsHoverChange?.(isHovering || isDragging || isAnyLocalPopupOpen);
    }, [isHovering, isDragging, isAnyLocalPopupOpen, onControlsHoverChange]);

    const handleTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
        e.stopPropagation();
        onInteraction?.();
    };

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
        setPpRippleTrigger?.(t => t + 1);
        onInteraction?.();
    };

    const seekTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const triggerSeekFlash = (side: 'left' | 'right') => {
        if (seekTimeoutRef.current) clearTimeout(seekTimeoutRef.current);
        setSeekFlash?.({ side, ts: Date.now() });
        seekTimeoutRef.current = setTimeout(() => setSeekFlash?.(null), 500);
    };

    const toggleVolume = () => {
        setShowVolume(p => !p);
        setShowNextEpPopup(false);
        setActivePanel?.('none');
        onInteraction?.();
    };
    
    const toggleNextEp = () => {
        if (onNextEpisode) {
            onNextEpisode();
            setShowNextEpPopup(false);
            setShowVolume(false);
            onInteraction?.();
        }
    };

    const toggleSubtitles = () => {
        if (activePanel === 'audioSubtitles') setActivePanel?.('none');
        else { setActivePanel?.('audioSubtitles'); setShowVolume(false); setShowNextEpPopup(false); }
        onInteraction?.();
    };
    const toggleEpisodes = () => {
        if (activePanel === 'episodes' || activePanel === 'seasons') setActivePanel?.('none');
        else { setActivePanel?.('episodes'); setShowVolume(false); setShowNextEpPopup(false); }
        onInteraction?.();
    };
    const togglePlayback = () => {
        if (activePanel === 'playback') setActivePanel?.('none');
        else { setActivePanel?.('playback'); setShowVolume(false); setShowNextEpPopup(false); }
        onInteraction?.();
    };

    const displayProgress = isDragging ? dragProgress : progress;

    const isEpisodesActive = activePanel === 'episodes' || activePanel === 'seasons';
    const isSubtitlesActive = activePanel === 'audioSubtitles';
    const isPlaybackActive = activePanel === 'playback';
    const isAnyPanelOpen = isEpisodesActive || isSubtitlesActive || isPlaybackActive;

    const getMobileIconOpacity = (isActive: boolean) => {
        if (!isMobile) return '';
        if (isActive) return 'opacity-100';
        return isAnyPanelOpen ? 'opacity-30' : 'opacity-90';
    };

    const btn = 'flex items-center justify-center text-white hover:text-white active:text-white/40 transition-all duration-150 active:scale-95 select-none focus:outline-none rounded-sm p-2.5';
    const btnActive = 'text-white';

    const mobileBtnCls = (isActive: boolean) => {
        const base = "flex items-center gap-2 px-2 py-1.5 text-white transition-all duration-150 active:scale-95 select-none focus:outline-none text-[11px] font-bold tracking-wide uppercase";
        const opacity = getMobileIconOpacity(isActive);
        return `${base} ${opacity}`;
    };

    const getHoverTimeText = () => {
        const t = hoverTime;
        const h = Math.floor(t / 3600);
        const m = Math.floor((t % 3600) / 60);
        const s = Math.floor(t % 60);
        return h > 0 ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}` : `${m}:${s.toString().padStart(2, '0')}`;
    };

    const isInteracting = isHovering || isDragging;
    const trackH  = isMobile 
        ? (isDragging ? 'h-[7px]' : 'h-[3.2px]') 
        : (isInteracting ? 'h-[7px]' : 'h-[4px]');
    const thumbSz = isMobile ? 'h-[22px] w-[22px]' : 'h-[14px] w-[14px]';
    const thumbScale = isDragging ? 'scale-[1.5]' : (isHovering ? 'scale-[1.3]' : 'scale-100');

    const safeBottom = 'max(env(safe-area-inset-bottom, 0px), 8px)';
    const safeLeft = 'env(safe-area-inset-left, 0px)';
    const safeRight = 'env(safe-area-inset-right, 0px)';

    const activeSkipSegment = skipSegments.find(s => currentTime >= s.start && currentTime <= s.end);

    return (
        <>
            {!isMobile && <PlayPauseRipple isPlaying={isPlaying} trigger={ppRippleTrigger} />}

            {seekFlash && <SeekFlash side={seekFlash.side} seconds={10} ts={seekFlash.ts} />}

            {isPanelOpen && !isEmbedFallback && (
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
                    className={`relative absolute top-0 left-0 right-0 z-40 flex items-center transition-opacity duration-300 ${showUI ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
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
                    <button
                        onClick={(e) => { e.stopPropagation(); onClose(); }}
                        className="flex items-center justify-center text-white transition-all flex-shrink-0"
                        style={{ minWidth: 44, minHeight: 44 }}
                        aria-label={t('player.closePlayer')}
                    >
                        <ArrowLeftIcon size={40} weight="bold" />
                    </button>

                    {/* Title — absolutely centred so it's always mid-screen regardless of button widths */}
                    <div className="absolute inset-x-0 flex justify-center items-center pointer-events-none px-14">
                        <PlayerTitle
                            title={title}
                            episodeNumber={episodeNumber}
                            episodeName={episodeName}
                            mediaType={mediaType}
                            className="text-white text-sm line-clamp-1 drop-shadow-md text-center"
                        />
                    </div>

                    <div className="flex-1" />
                    {onToggleFit && !isEmbedFallback && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onToggleFit(); }}
                            className="flex items-center gap-2 px-3 py-1.5 bg-black/40 backdrop-blur-md border border-white/20 rounded-full text-white hover:bg-white/20 transition-all active:scale-95"
                            style={{ minHeight: 36 }}
                        >
                            <CropIcon size={18} weight="bold" />
                            <span className="text-[11px] font-bold tracking-widest uppercase">{videoFit === 'cover' ? t('player.fill') : t('player.fit')}</span>
                        </button>
                    )}
                </div>
            )}

            {/* ── CENTER: Mobile Playback Controls ── */}
            {isMobile && (
                <div
                    className={`absolute inset-0 z-30 flex items-center justify-center gap-[150px] transition-opacity duration-300 pointer-events-none ${showUI ? 'opacity-100' : 'opacity-0'}`}
                >
                    <button
                        onClick={(e) => { e.stopPropagation(); onSeek(-10); triggerSeekFlash('left'); }}
                        onTouchStart={handleTouchStart}
                        onTouchEnd={(e) => e.stopPropagation()}
                        className={`pointer-events-auto flex items-center justify-center text-white hover:text-white hover:scale-110 active:scale-90 transition-all`}
                        style={{ width: 50, height: 50 }}
                        aria-label={t('player.rewind10s')}
                    >
                        <div 
                            key={seekFlash?.side === 'left' ? `mobile-left-${seekFlash.ts}` : 'mobile-left-idle'}
                            className={`relative flex items-center justify-center ${seekFlash?.side === 'left' ? 'animate-seek-rotate-left' : ''}`}
                        >
                            <ArrowCounterClockwiseIcon size={44} weight="regular" />
                            <span style={{
                                position: 'absolute',
                                top: '52%',
                                left: '50%',
                                transform: 'translate(-50%, -50%)',
                                fontSize: '11px',
                                fontWeight: 700,
                                fontFamily: 'Inter, sans-serif',
                            }}>10</span>
                        </div>
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); handlePlayPause(); }}
                        onTouchStart={handleTouchStart}
                        onTouchEnd={(e) => e.stopPropagation()}
                        className={`pointer-events-auto flex items-center justify-center text-white hover:text-white hover:scale-110 active:scale-90 transition-all`}
                        style={{ width: 50, height: 50 }}
                        aria-label={isPlaying ? t('player.pause') : t('player.play')}
                    >
                        {isPlaying ? <PauseIcon size={44} weight="fill" /> : <PlayIcon size={44} weight="fill" />}
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); onSeek(10); triggerSeekFlash('right'); }}
                        onTouchStart={handleTouchStart}
                        onTouchEnd={(e) => e.stopPropagation()}
                        className={`pointer-events-auto flex items-center justify-center text-white hover:text-white hover:scale-110 active:scale-90 transition-all`}
                        style={{ width: 50, height: 50 }}
                        aria-label={t('player.fastForward10s')}
                    >
                        <div 
                            key={seekFlash?.side === 'right' ? `mobile-right-${seekFlash.ts}` : 'mobile-right-idle'}
                            className={`relative flex items-center justify-center ${seekFlash?.side === 'right' ? 'animate-seek-rotate-right' : ''}`}
                        >
                            <ArrowClockwiseIcon size={44} weight="regular" />
                            <span style={{
                                position: 'absolute',
                                top: '52%',
                                left: '50%',
                                transform: 'translate(-50%, -50%)',
                                fontSize: '11px',
                                fontWeight: 700,
                                fontFamily: 'Inter, sans-serif',
                            }}>10</span>
                        </div>
                    </button>
                </div>
            )}

            {/* ── TOP: Back button (desktop only, always interactive) ── */}
            {!isMobile && (
                <>
                    {/* Back arrow — always clickable, fades with UI but pointer-events stay on */}
                    <div className={`absolute top-0 left-0 z-40 px-8 pt-8 transition-opacity duration-300 pointer-events-auto ${showUI ? 'opacity-100' : 'opacity-0'}`}>
                        <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="flex items-center justify-center text-white hover:text-white hover:scale-110 transition-all p-1.5" aria-label={t('player.closePlayer')}>
                            <ArrowLeftIcon size={42} weight="bold" />
                        </button>
                    </div>

                    {/* Fit toggle — only when UI is visible */}
                    {onToggleFit && !isEmbedFallback && (
                        <div className={`absolute top-0 right-0 z-40 px-8 pt-8 transition-opacity duration-300 ${showUI ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
                            <button
                                onClick={(e) => { e.stopPropagation(); onToggleFit(); }}
                                className="flex items-center gap-2 px-4 py-2 bg-zinc-900/60 backdrop-blur-md border border-white/10 rounded-full text-white hover:text-white hover:bg-zinc-800 transition-all active:scale-95 shadow-xl"
                            >
                                <CropIcon size={20} weight="bold" />
                                <span className="text-xs font-bold tracking-[0.15em] uppercase">{videoFit === 'cover' ? t('player.fill') : t('player.fit')}</span>
                            </button>
                        </div>
                    )}
                </>
            )}

            {/* ── BOTTOM Controls Container ── */}
            <div
                id="video-controls-container"
                className="absolute inset-x-0 bottom-0 z-30 pointer-events-none"
                onMouseEnter={() => setIsHovering(true)}
                onMouseLeave={() => setIsHovering(false)}
            >
                {/* Background Gradient (Fades with UI) */}
                <div className={`absolute inset-0 bg-gradient-to-t from-black/98 via-black/60 to-transparent pointer-events-none transition-opacity duration-300 ${showUI ? 'opacity-100' : 'opacity-0'}`} />

                <div
                    className="relative pointer-events-none"
                    style={{
                        paddingLeft: `max(${safeLeft}, 8px)`,
                        paddingRight: `max(${safeRight}, ${isMobile ? '16px' : '16px'})`,
                        paddingTop: isMobile ? 24 : 40,
                        paddingBottom: `max(${safeBottom}, ${isMobile ? '16px' : '24px'})`,
                    }}
                >
                    {/* ── PERSISTENT FLOATING BUTTONS (Skip & Manual Autoplay) ── */}
                    {/* These completely ignore the showUI opacity so they stay on screen after controls hide */}
                    <div className="absolute right-4 md:right-8 bottom-full mb-[-8px] md:mb-[-4px] z-40 pointer-events-none flex flex-col items-end gap-2">
                        
                        {/* Manual Autoplay Popup */}
                        <AutoplayCountdown
                            showAutoplayCountdown={showAutoplayCountdown}
                            onCancelAutoplay={onCancelAutoplay}
                            onPlayNextNow={onPlayNextNow}
                            isMobile={isMobile}
                        />

                        {/* Standard Skip Button */}
                        {activeSkipSegment && onSkipSegment && !showAutoplayCountdown && (
                            <div className="pointer-events-auto animate-fadeIn">
                                <button
                                    onClick={(e) => { e.stopPropagation(); onSkipSegment(activeSkipSegment); }}
                                    className="px-5 py-2 md:py-2.5 bg-white text-black font-bold text-[13px] md:text-sm rounded-[4px] hover:bg-neutral-200 active:scale-95 transition-all flex items-center gap-2 uppercase tracking-wider shadow-lg"
                                >
                                    {activeSkipSegment.type === 'credits' ? t('player.skipCredits') : t('player.skipIntro')}
                                    <SkipForwardIcon size={18} weight="bold" />
                                </button>
                            </div>
                        )}
                    </div>

                    {/* ── FADING CONTROLS (Progress Bar + Row) ── */}
                    <div className={`transition-opacity duration-300 pointer-events-none ${showUI ? 'opacity-100' : 'opacity-0'}`}>
                        
                        {/* Progress bar */}
                        <div className={`pointer-events-auto flex items-center gap-2 transition-all duration-200 px-3 ${isPanelOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
                            style={{
                                height: isPanelOpen ? 0 : undefined,
                                marginBottom: isPanelOpen ? 0 : (isMobile ? -10 : 20),
                                overflow: isPanelOpen ? 'hidden' : undefined,
                            }}
                        >
                            <div
                                ref={timelineRef}
                                className="relative flex-1 cursor-pointer group/timeline"
                                onMouseDown={handleTimelineStart}
                                onMouseMove={handleTimelineHover}
                                onMouseEnter={() => setIsHovering(true)}
                                onMouseLeave={() => setIsHovering(false)}
                                onTouchStart={handleTimelineStart}
                                role="slider"
                                aria-label={t('player.videoProgress', { defaultValue: 'Video progress' })}
                                aria-valuemin={0}
                                aria-valuemax={100}
                                aria-valuenow={Math.round(displayProgress)}
                                tabIndex={0}
                                onKeyDown={(e) => {
                                    if (e.key === 'ArrowRight') { e.preventDefault(); onTimelineSeek(Math.min(100, progress + 2)); }
                                    if (e.key === 'ArrowLeft') { e.preventDefault(); onTimelineSeek(Math.max(0, progress - 2)); }
                                }}
                            >
                                {!isMobile && isHovering && !isDragging && (
                                    <div className="absolute -top-10 -translate-x-1/2 flex flex-col items-center pointer-events-none z-50" style={{ left: `${hoverPosition}%` }}>
                                        <div className="bg-black/95 text-white text-[13px] px-3 py-1.5 font-consolas shadow-xl border border-white/10" style={{ borderRadius: 2 }}>
                                            {getHoverTimeText()}
                                        </div>
                                    </div>
                                )}

                                <div className={`relative w-full flex items-center ${isMobile ? 'h-10' : 'h-8'}`}>
                                    <div className={`absolute left-0 w-full ${trackH} bg-[#808080] transition-all duration-200`} style={{ borderRadius: 0 }} />
                                    <div className={`absolute left-0 ${trackH} bg-white/30 transition-all duration-200`} style={{ borderRadius: 0, width: `${buffered}%` }} />
                                    <div className={`absolute left-0 ${trackH} bg-[#e50914] transition-all duration-200`} style={{ borderRadius: 0, width: `${displayProgress}%` }} />
                                    <div
                                        className={`absolute ${thumbSz} bg-[#e50914] shadow-lg -translate-x-1/2 rounded-full transition-transform duration-200 ${isMobile ? (isDragging ? 'scale-[1.5]' : 'scale-100') : thumbScale}`}
                                        style={{ left: `${displayProgress}%` }}
                                    />
                                </div>
                            </div>
                            <span className="text-white/60 text-xs font-consolas tabular-nums flex-shrink-0 select-none min-w-[50px] text-right">{formatTime(currentTime, duration)}</span>
                        </div>

                        {/* Control Buttons Row */}
                        <div className="pointer-events-auto flex items-center justify-between relative">
                            {isMobile ? (
                                <div className="w-full flex items-center justify-around gap-2 px-3 sm:px-6 min-w-0">
                                    {/* Episodes explorer */}
                                    {isTV && onEpisodesClick && (
                                        <div className="relative">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); toggleEpisodes(); }}
                                                className={mobileBtnCls(isEpisodesActive)}
                                                aria-label={t('player.episodesBtn')}
                                            >
                                                <CardsThreeIcon size={24} weight={isEpisodesActive ? "fill" : "bold"} className="flex-shrink-0" />
                                                <span className="font-netflix truncate">{t('player.episodesBtn')}</span>
                                            </button>
                                        </div>
                                    )}

                                    {/* Audio & Subtitles */}
                                    {onSubtitlesClick && (
                                        <div className="relative">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); toggleSubtitles(); }}
                                                className={mobileBtnCls(isSubtitlesActive)}
                                                aria-label={t('player.subtitleBtn')}
                                                title={t('player.subtitleTitle')}
                                            >
                                                <SubtitlesIcon size={24} weight={isSubtitlesActive ? "fill" : "bold"} className="flex-shrink-0" />
                                                <span className="font-netflix truncate">{t('player.subtitleBtn')}</span>
                                            </button>
                                        </div>
                                    )}

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
                                                onMouseDown={() => onInteraction?.()}
                                                className={mobileBtnCls(showNextEp)}
                                                aria-label={t('player.nextEpisodeTitle')}
                                                title={t('player.nextEpisodeTitle')}
                                            >
                                                <svg width={24} height={24} viewBox="0 0 256 256" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
                                                    <path d="M72,60 V196 L160,128 Z" stroke="currentColor" strokeWidth="24" strokeLinecap="round" strokeLinejoin="round"/>
                                                    <line x1="208" y1="56" x2="208" y2="200" stroke="currentColor" strokeWidth="24" strokeLinecap="round"/>
                                                </svg>
                                                <span className="font-netflix truncate">{t('player.nextEpisodeTitle')}</span>
                                            </button>
                                        </div>
                                    )}

                                    {/* Playback Settings */}
                                    <div className="relative">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); togglePlayback(); }}
                                            onMouseDown={() => onInteraction?.()}
                                            className={mobileBtnCls(isPlaybackActive)}
                                            aria-label={t('player.playbackSettingsBtn')}
                                            title={t('player.playbackSettingsTitle')}
                                        >
                                            <GearIcon size={24} weight={isPlaybackActive ? "fill" : "bold"} className="flex-shrink-0" />
                                            <span className="font-netflix truncate">{t('player.playbackSettingsBtn')}</span>
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {/* LEFT GROUP */}
                                    <div className="flex items-center min-w-0 gap-5 md:gap-8" style={{ flex: '1 1 0%' }}>
                                        <button onClick={handlePlayPause} onMouseDown={() => onInteraction?.()} className={`${btn} ml-2 md:ml-3`} aria-label={isPlaying ? 'Pause' : 'Play'}>
                                            {isPlaying ? <PauseIcon size={ICON_SIZE} weight="fill" /> : <PlayIcon size={ICON_SIZE} weight="fill" />}
                                        </button>
                                        <button onClick={() => { onSeek(-10); onInteraction?.(); triggerSeekFlash('left'); }} className={`${btn} -ml-4 md:-ml-6`} aria-label={t('player.rewind10s')}>
                                            <div 
                                                key={seekFlash?.side === 'left' ? `desktop-left-${seekFlash.ts}` : 'desktop-left-idle'}
                                                className={`relative flex items-center justify-center ${seekFlash?.side === 'left' ? 'animate-seek-rotate-left' : ''}`}
                                            >
                                                <ArrowCounterClockwiseIcon size={ICON_SIZE} weight="bold" />
                                                <span style={{
                                                    position: 'absolute',
                                                    top: '52%',
                                                    left: '50%',
                                                    transform: 'translate(-50%, -50%)',
                                                    fontSize: '11px',
                                                    fontWeight: 800,
                                                    fontFamily: 'Inter, sans-serif',
                                                }}>10</span>
                                            </div>
                                        </button>
                                        <button onClick={() => { onSeek(10); onInteraction?.(); triggerSeekFlash('right'); }} className={btn} aria-label={t('player.fastForward10s')}>
                                            <div 
                                                key={seekFlash?.side === 'right' ? `desktop-right-${seekFlash.ts}` : 'desktop-right-idle'}
                                                className={`relative flex items-center justify-center ${seekFlash?.side === 'right' ? 'animate-seek-rotate-right' : ''}`}
                                            >
                                                <ArrowClockwiseIcon size={ICON_SIZE} weight="bold" />
                                                <span style={{
                                                    position: 'absolute',
                                                    top: '52%',
                                                    left: '50%',
                                                    transform: 'translate(-50%, -50%)',
                                                    fontSize: '11px',
                                                    fontWeight: 800,
                                                    fontFamily: 'Inter, sans-serif',
                                                }}>10</span>
                                            </div>
                                        </button>
                                        <div className="relative">
                                            {showVolume && (
                                                <VolumePopup volume={volume} isMuted={isMuted} isMobile={false} onVolumeChange={onVolumeChange} onInteraction={onInteraction} />
                                            )}
                                            <button onClick={(e) => { e.stopPropagation(); toggleVolume(); }} onMouseDown={() => onInteraction?.()} className={btn} aria-label={isMuted ? t('player.unmute') : t('player.mute')} title={t('player.volume')}>
                                                {isMuted || volume === 0 ? <SpeakerXIcon size={ICON_SIZE} weight="bold" /> : volume < 0.5 ? <SpeakerLowIcon size={ICON_SIZE} weight="bold" /> : <SpeakerHighIcon size={ICON_SIZE} weight="bold" />}
                                            </button>
                                        </div>
                                    </div>

                                    {/* CENTER: Title (desktop only) */}
                                    <div className="flex justify-center px-4 text-center items-center pointer-events-none min-w-0 overflow-hidden" style={{ flex: '2 1 0%', maxWidth: '50%', transform: 'translateX(-20px)' }}>
                                        {/* Block wrapper so line-clamp-2 works on a proper box (spans can't -webkit-box clamp) */}
                                        <div className="line-clamp-2 overflow-hidden text-center w-full">
                                            <PlayerTitle title={title} episodeNumber={episodeNumber} episodeName={episodeName} mediaType={mediaType} className="text-white/80 text-[21px] drop-shadow-lg" />
                                        </div>
                                    </div>

                                    {/* RIGHT GROUP */}
                                    <div className="flex items-center min-w-0 gap-5 md:gap-8 justify-end" style={{ flex: '1 1 0%' }}>
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
                                                    onMouseDown={() => onInteraction?.()}
                                                    className={`${btn} ${showNextEp ? btnActive : ''}`}
                                                    aria-label={t('player.nextEpisodeTitle')}
                                                    title={t('player.nextEpisodeTitle')}
                                                >
                                                    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 256 256" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                        <path d="M72,60 V196 L160,128 Z" stroke="currentColor" strokeWidth="24" strokeLinecap="round" strokeLinejoin="round"/>
                                                        <line x1="208" y1="56" x2="208" y2="200" stroke="currentColor" strokeWidth="24" strokeLinecap="round"/>
                                                    </svg>
                                                </button>
                                            </div>
                                        )}

                                        {onSubtitlesClick && (
                                            <div className="relative">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); toggleSubtitles(); }}
                                                    onMouseDown={() => onInteraction?.()}
                                                    className={`${btn} ${activePanel === 'audioSubtitles' ? btnActive : ''}`}
                                                    aria-label={t('player.subtitleBtn')}
                                                    title={t('player.subtitleTitle')}
                                                >
                                                    <SubtitlesIcon size={ICON_SIZE} weight="bold" />
                                                </button>
                                            </div>
                                        )}

                                        {isTV && onEpisodesClick && (
                                            <div className="relative">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); toggleEpisodes(); }}
                                                    onMouseDown={() => onInteraction?.()}
                                                    className={`${btn} ${(activePanel === 'episodes' || activePanel === 'seasons') ? btnActive : ''}`}
                                                    aria-label={t('player.episodesBtn')}
                                                >
                                                    <CardsThreeIcon size={ICON_SIZE} weight="bold" />
                                                </button>
                                            </div>
                                        )}

                                        <div className="relative">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); togglePlayback(); }}
                                                onMouseDown={() => onInteraction?.()}
                                                className={`${btn} ${getMobileIconOpacity(isPlaybackActive)}`}
                                                aria-label={t('player.playbackSettingsBtn')}
                                                title={t('player.playbackSettingsTitle')}
                                            >
                                                <GearIcon size={ICON_SIZE} weight="bold" />
                                            </button>
                                        </div>

                                        <button
                                            onClick={(e) => { e.stopPropagation(); onToggleFullscreen(); onInteraction?.(); }}
                                            className={btn}
                                            aria-label={t('player.fullscreenTitle')}
                                            title={t('player.fullscreenTitle')}
                                        >
                                            <CornersOutIcon size={ICON_SIZE} weight="bold" />
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default VideoPlayerControls;