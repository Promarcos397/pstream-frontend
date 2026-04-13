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
    onSourceChange?: (index: number) => void;
    qualities?: Array<{ height: number; bitrate: number; level: number }>;
    currentQuality?: number;
    onQualityChange?: (level: number) => void;
    isMenuOpen?: boolean;
    showUI: boolean;
    activePanel?: 'none' | 'episodes' | 'seasons' | 'audioSubtitles' | 'quality' | 'servers';
    setActivePanel?: (panel: any) => void;
    // For next episode popup data
    nextEpisodeData?: {
        episodeNumber: number;
        name: string;
        description?: string;
        stillPath?: string;
    } | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatRemaining = (currentTime: number, duration: number): string => {
    if (!duration || isNaN(duration)) return '';
    const remaining = Math.max(0, duration - currentTime);
    const h = Math.floor(remaining / 3600);
    const m = Math.floor((remaining % 3600) / 60);
    const s = Math.floor(remaining % 60);
    if (h > 0) return `-${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `-${m}:${s.toString().padStart(2, '0')}`;
};

// ─── Volume Popup (matches reference design exactly) ─────────────────────────
// Design: #262626 bg, no border-radius, 12px track, red fill, red circle thumb above fill
const VolumePopup: React.FC<{
    volume: number;
    isMuted: boolean;
    onVolumeChange: (v: number) => void;
}> = ({ volume, isMuted, onVolumeChange }) => {
    const trackRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);

    const TRACK_H = 110; // px — matches reference .vol-track-vertical height
    const THUMB_HALF = 12; // half of 24px thumb

    const effective = isMuted ? 0 : volume;
    const fillPct = effective * 100;
    // Thumb sits above the fill end. Clamp so it stays inside the track.
    const fillPx = Math.round((fillPct / 100) * TRACK_H);
    const thumbBottom = Math.max(THUMB_HALF, Math.min(TRACK_H - THUMB_HALF, fillPx));

    const getVol = (clientY: number) => {
        if (!trackRef.current) return effective;
        const rect = trackRef.current.getBoundingClientRect();
        return 1 - Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    };

    useEffect(() => {
        if (!isDragging) return;
        const onMove = (e: MouseEvent | TouchEvent) => {
            const y = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
            onVolumeChange(getVol(y));
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
    }, [isDragging]);

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
            onClick={(e) => e.stopPropagation()}
        >
            {/* Track */}
            <div
                ref={trackRef}
                style={{
                    width: 12,
                    height: TRACK_H,
                    backgroundColor: '#666',
                    position: 'relative',
                    cursor: 'pointer',
                }}
                onClick={(e) => { e.stopPropagation(); onVolumeChange(getVol(e.clientY)); }}
            >
                {/* Fill */}
                <div style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    width: '100%',
                    height: `${fillPct}%`,
                    backgroundColor: '#ff0000',
                }} />
                {/* Thumb — sits at the top of the fill (reference: top:-8px, left:-6px) */}
                <div
                    style={{
                        position: 'absolute',
                        bottom: thumbBottom - THUMB_HALF,
                        left: -6,
                        width: 24,
                        height: 24,
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

// ─── Next Episode Popup (matches reference design exactly) ────────────────────
// Design: 650px wide, dark bg, white heavy border, header bar, thumbnail, title, description
const NextEpisodePopup: React.FC<{
    data: NonNullable<VideoPlayerControlsProps['nextEpisodeData']>;
    onPlay: () => void;
}> = ({ data, onPlay }) => {
    const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w400';
    const imgSrc = data.stillPath ? `${TMDB_IMAGE_BASE}${data.stillPath}` : null;

    return (
        <div
            style={{
                position: 'absolute',
                bottom: '100%',
                // Right-aligned but pushed slightly out to exactly match user preference
                right: -30,
                width: 550,
                backgroundColor: '#141414',
                border: '2px solid #ffffff',
                boxShadow: '0px 20px 50px rgba(0,0,0,0.9)',
                borderRadius: 0,
                overflow: 'hidden',
                zIndex: 100,
                marginBottom: 12,
            }}
            onClick={(e) => e.stopPropagation()}
        >
            {/* Header */}
            <div style={{
                backgroundColor: '#262626',
                padding: '16px 22px',
                fontSize: 22,
                fontWeight: 700,
                borderBottom: '1px solid #000',
                fontFamily: 'Consolas, monospace',
            }}>
                Next episode
            </div>

            {/* Content */}
            <div style={{ display: 'flex', padding: 22, gap: 22, alignItems: 'flex-start' }}>
                {/* Thumbnail */}
                <div
                    style={{
                        position: 'relative',
                        width: 220,
                        height: 124,
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
                    {/* Overlay with play icon */}
                    <div style={{
                        position: 'absolute', inset: 0,
                        background: 'rgba(0,0,0,0.2)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'background 0.2s',
                    }}>
                        <svg viewBox="0 0 24 24" style={{ width: 44, height: 44, fill: 'rgba(255,255,255,0.85)', filter: 'drop-shadow(0 2px 5px rgba(0,0,0,0.6))' }}>
                            <path d="M8 5v14l11-7z" />
                        </svg>
                    </div>
                </div>

                {/* Text */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 2, flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', fontSize: 19, fontWeight: 700, fontFamily: 'Consolas, monospace' }}>
                        <span style={{ marginRight: 14 }}>{data.episodeNumber}</span>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{data.name}</span>
                    </div>
                    {data.description && (
                        <div style={{
                            fontSize: 14,
                            lineHeight: 1.4,
                            color: '#ccc',
                            display: '-webkit-box',
                            WebkitLineClamp: 4,
                            WebkitBoxOrient: 'vertical' as any,
                            overflow: 'hidden',
                        }}>
                            {data.description}
                        </div>
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
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 25,
            pointerEvents: 'none',
        }}>
            <div style={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                backgroundColor: 'rgba(0,0,0,0.45)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
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

// ─── Title Component ─────────────────────────────────────────────────────────
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
            position: 'absolute',
            top: 0, bottom: 0,
            [side]: 0,
            width: '30%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 28,
            pointerEvents: 'none',
            backgroundColor: 'rgba(255,255,255,0.08)',
            borderRadius: side === 'left' ? '0 100px 100px 0' : '100px 0 0 100px',
            animation: 'seek-flash 0.4s ease-out forwards',
        }}>
            <span style={{
                color: 'white',
                fontFamily: 'Consolas, monospace',
                fontSize: 14,
                fontWeight: 700,
                opacity: 0.9,
                textShadow: '0 1px 3px rgba(0,0,0,0.7)',
            }}>
                {side === 'left' ? `◀ ${seconds}s` : `${seconds}s ▶`}
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
    nextEpisodeData,
}) => {
    const isMobile = useIsMobile();
    const timelineRef = useRef<HTMLDivElement>(null);
    const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [isHovering, setIsHovering] = useState(false);
    const [hoverPosition, setHoverPosition] = useState(0);
    const [hoverTime, setHoverTime] = useState(0);
    const [showVolume, setShowVolume] = useState(false);
    const [showNextEpPopup, setShowNextEpPopup] = useState(false);
    const [ppRippleTrigger, setPpRippleTrigger] = useState(0);
    const [seekFlash, setSeekFlash] = useState<{ side: 'left' | 'right'; ts: number } | null>(null);

    const volumeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const nextEpTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const subtitleTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const episodeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const isTV = mediaType === 'tv';
    const isPanelOpen = activePanel !== 'none' || showVolume || showNextEpPopup;

    // Bigger icons per your request
    const ICON_SIZE = isMobile ? 25 : 46    ;

    // ── Hover extends UI timeout ──────────────────────────────────────────────
    const resetInactivity = useCallback(() => {
        if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
        // Don't hide if a panel is open or user is hovering
    }, []);

    // ── Timeline ──────────────────────────────────────────────────────────────
    const getClientX = (e: React.MouseEvent | React.TouchEvent): number => {
        if ('touches' in e && e.touches.length > 0) return e.touches[0].clientX;
        if ('changedTouches' in e && (e as React.TouchEvent).changedTouches.length > 0)
            return (e as React.TouchEvent).changedTouches[0].clientX;
        return (e as React.MouseEvent).clientX;
    };

    const doSeek = useCallback((e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
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
        doSeek(e);
    }, [doSeek]);

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

    // ── Play/pause with ripple ────────────────────────────────────────────────
    const handlePlayPause = () => {
        onPlayPause();
        setPpRippleTrigger(t => t + 1);
    };

    // ── Seek flash for double-tap feedback ───────────────────────────────────
    const triggerSeekFlash = (side: 'left' | 'right') => {
        setSeekFlash({ side, ts: Date.now() });
        setTimeout(() => setSeekFlash(null), 450);
    };

    // ── Hover popup helpers (hover bridge pattern) ────────────────────────────
    const openVolume = () => { if (isMobile) return; if (volumeTimeoutRef.current) clearTimeout(volumeTimeoutRef.current); setShowVolume(true); };
    const closeVolume = () => { if (isMobile) return; volumeTimeoutRef.current = setTimeout(() => setShowVolume(false), 700); };
    const keepVolume = () => { if (isMobile) return; if (volumeTimeoutRef.current) clearTimeout(volumeTimeoutRef.current); };

    const openNextEp = () => { if (isMobile || !hasNextEpisode || !nextEpisodeData) return; if (nextEpTimeoutRef.current) clearTimeout(nextEpTimeoutRef.current); setShowNextEpPopup(true); };
    const closeNextEp = () => { if (isMobile) return; nextEpTimeoutRef.current = setTimeout(() => setShowNextEpPopup(false), 700); };
    const keepNextEp = () => { if (isMobile) return; if (nextEpTimeoutRef.current) clearTimeout(nextEpTimeoutRef.current); };

    const openSubtitles = () => { 
        if (subtitleTimeoutRef.current) clearTimeout(subtitleTimeoutRef.current); 
        setActivePanel?.('audioSubtitles'); 
    };
    const closeSubtitles = () => { 
        subtitleTimeoutRef.current = setTimeout(() => {
            if (!document.getElementById('video-panel-shell')?.matches(':hover')) {
                setActivePanel?.('none');
            }
        }, 800); 
    };
    const keepSubtitles = () => { if (subtitleTimeoutRef.current) clearTimeout(subtitleTimeoutRef.current); };

    const openEpisodes = () => { if (episodeTimeoutRef.current) clearTimeout(episodeTimeoutRef.current); setActivePanel?.('episodes'); };
    const closeEpisodes = () => { 
        episodeTimeoutRef.current = setTimeout(() => {
            if (!document.getElementById('video-panel-shell')?.matches(':hover')) {
                setActivePanel?.('none');
            }
        }, 800); 
    };
    const keepEpisodes = () => { if (episodeTimeoutRef.current) clearTimeout(episodeTimeoutRef.current); };

    // ── Base styles ───────────────────────────────────────────────────────────
    const btn = 'flex items-center justify-center text-white/80 hover:text-white active:text-white/40 transition-all duration-150 active:scale-90 select-none focus:outline-none rounded-sm p-1.5 hover:scale-110';
    const btnActive = 'text-white';

    const remaining = formatRemaining(currentTime, duration);

    return (
        <>
            {/* ── Ripple on play/pause ── */}
            <PlayPauseRipple isPlaying={isPlaying} trigger={ppRippleTrigger} />

            {/* ── Seek flash ── */}
            {seekFlash && <SeekFlash side={seekFlash.side} seconds={10} />}

            {/* ── Click-to-pause overlay ── */}
            <div
                className="absolute inset-0 z-20 cursor-pointer"
                onClick={handlePlayPause}
                aria-label={isPlaying ? 'Pause' : 'Play'}
            />

            {/* ── TOP: Back + title (mobile) ── */}
            {isMobile && (
                <div
                    className={`absolute top-0 left-0 right-0 z-40 px-5 pt-5 flex items-center gap-3 transition-opacity duration-300 ${showUI ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
                    style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.8) 0%, transparent 100%)' }}
                >
                    <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="flex items-center justify-center text-white transition-all p-1 flex-shrink-0" aria-label="Close player">
                        <ArrowLeftIcon size={26} weight="bold" />
                    </button>
                    <PlayerTitle title={title} episodeNumber={episodeNumber} episodeName={episodeName} mediaType={mediaType} className="text-white text-sm line-clamp-1 drop-shadow-md" />
                </div>
            )}

            {/* ── TOP: Back button (desktop only, top-left) ── */}
            {!isMobile && (
                <div className={`absolute top-0 left-0 z-40 px-8 pt-8 transition-opacity duration-300 ${showUI ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
                    <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="flex items-center justify-center text-white/80 hover:text-white hover:scale-110 transition-all p-1.5" aria-label="Close player">
                        <ArrowLeftIcon size={30} weight="bold" />
                    </button>
                </div>
            )}

            {/* ── BOTTOM Controls ── */}
            <div
                id="video-controls-container"
                className={`absolute inset-x-0 bottom-0 z-30 transition-opacity duration-300 ${showUI ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
                onClick={(e) => e.stopPropagation()}
                // Hovering over controls: suspend the auto-hide timer
                onMouseEnter={() => {
                    if (typeof resetInactivity === 'function') resetInactivity();
                }}
            >
                <div className="absolute inset-0 bg-gradient-to-t from-black/98 via-black/60 to-transparent pointer-events-none" />

                <div className="relative px-5 md:px-10 pb-5 md:pb-7 pt-8 md:pt-12">

                    {/* ── Progress bar (hidden when panel open) ── */}
                    <div className={`flex items-center gap-3 mb-5 transition-all duration-200 ${isPanelOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`} style={{ height: isPanelOpen ? 0 : undefined, marginBottom: isPanelOpen ? 0 : undefined, overflow: isPanelOpen ? 'hidden' : undefined }}>
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
                            {/* Hover tooltip — with Image Preview as requested */}
                            {!isMobile && isHovering && (
                                <div className="absolute -top-32 -translate-x-1/2 flex flex-col items-center pointer-events-none z-50 animate-fadeIn" style={{ left: `${hoverPosition}%` }}>
                                    <div className="w-[180px] aspect-video bg-zinc-900 rounded-md border border-white/20 shadow-2xl overflow-hidden mb-2 relative">
                                        {/* Use high-res backdrop for movies, or episode still if available */}
                                        <img 
                                            src={nextEpisodeData?.stillPath ? `https://image.tmdb.org/t/p/w300${nextEpisodeData.stillPath}` : (window as any).__video_backdrop} 
                                            alt="Preview"
                                            className="w-full h-full object-cover brightness-75"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                                        <div className="absolute bottom-2 left-2 right-2 text-white font-bold text-[10px] uppercase tracking-widest truncate">
                                            {title}
                                        </div>
                                    </div>
                                    <div className="bg-black/95 text-white text-[13px] px-3 py-1 rounded-sm font-consolas shadow-xl border border-white/10">
                                        {(() => {
                                            const t = hoverTime;
                                            const h = Math.floor(t / 3600);
                                            const m = Math.floor((t % 3600) / 60);
                                            const s = Math.floor(t % 60);
                                            return h > 0 ? `${h}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}` : `${m}:${s.toString().padStart(2,'0')}`;
                                        })()}
                                    </div>
                                </div>
                            )}
                            {/* Track — 6px tall = thicker progress bar */}
                            <div className={`relative w-full flex items-center ${isMobile ? 'h-10' : 'h-8'}`}>
                                <div className="absolute left-0 w-full h-[6px] bg-white/20 rounded-full" />
                                <div className="absolute left-0 h-[6px] bg-white/35 rounded-full" style={{ width: `${buffered}%` }} />
                                <div className="absolute left-0 h-[6px] bg-[#e50914] rounded-full" style={{ width: `${progress}%` }} />
                                <div className={`absolute h-4 w-4 bg-[#e50914] rounded-full shadow-lg -translate-x-1/2 transition-transform ${isMobile || isDragging ? 'scale-100' : 'scale-0 group-hover/timeline:scale-125'}`} style={{ left: `${progress}%` }} />
                            </div>
                        </div>
                        {/* Remaining time */}
                        <span className="text-white/60 text-xs font-consolas tabular-nums flex-shrink-0 select-none min-w-[60px] text-right">{remaining}</span>
                    </div>

                    {/* ── Control Buttons Row ── */}
                    <div className="flex items-center justify-between relative">

                        {/* LEFT GROUP */}
                        <div className="flex items-center gap-5 md:gap-8">
                            {isMobile ? (
                                <>
                                    {/* Mobile: seek | play | seek */}
                                    <button onClick={() => { onSeek(-10); triggerSeekFlash('left'); }} className={btn} aria-label="Rewind 10s">
                                        <ArrowCounterClockwiseIcon size={ICON_SIZE} />
                                    </button>
                                    <button onClick={handlePlayPause} className={btn} aria-label={isPlaying ? 'Pause' : 'Play'}>
                                        {isPlaying ? <PauseIcon size={ICON_SIZE} weight="fill" /> : <PlayIcon size={ICON_SIZE} weight="fill" />}
                                    </button>
                                    <button onClick={() => { onSeek(10); triggerSeekFlash('right'); }} className={btn} aria-label="Fast-forward 10s">
                                        <ArrowClockwiseIcon size={ICON_SIZE} />
                                    </button>
                                </>
                            ) : (
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

                                    {/* Volume — hover to open popup, bridge keeps it open */}
                                    <div className="relative" onMouseEnter={openVolume} onMouseLeave={closeVolume}>
                                        {showVolume && (
                                            <div onMouseEnter={keepVolume} onMouseLeave={closeVolume}>
                                                <VolumePopup volume={volume} isMuted={isMuted} onVolumeChange={onVolumeChange} />
                                            </div>
                                        )}
                                        {/* Invisible bridge between button and popup */}
                                        {showVolume && (
                                            <div style={{ position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)', width: 60, height: 20, zIndex: 99 }} onMouseEnter={keepVolume} />
                                        )}
                                        <button onClick={(e) => { e.stopPropagation(); onToggleMute(); }} className={btn} aria-label={isMuted ? 'Unmute' : 'Mute'} title="Volume (M)">
                                            {isMuted || volume === 0 ? <SpeakerXIcon size={ICON_SIZE} /> : volume < 0.5 ? <SpeakerLowIcon size={ICON_SIZE} /> : <SpeakerHighIcon size={ICON_SIZE} />}
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* CENTER: Title (desktop only, absolute so it doesn't push groups) */}
                        {!isMobile && (
                            <div className="absolute left-1/2 -translate-x-1/2 pointer-events-none px-4 text-center" style={{ maxWidth: '46%', bottom: 0 }}>
                                <PlayerTitle title={title} episodeNumber={episodeNumber} episodeName={episodeName} mediaType={mediaType} className="text-white/80 text-[22px] drop-shadow-lg line-clamp-2" />
                            </div>
                        )}

                        {/* RIGHT GROUP */}
                        <div className="flex items-center gap-5 md:gap-8">

                            {/* Next Episode button with popup */}
                            {isTV && hasNextEpisode && onNextEpisode && (
                                <div className="relative" onMouseEnter={openNextEp} onMouseLeave={closeNextEp}>
                                    {/* Popup */}
                                    {showNextEpPopup && nextEpisodeData && (
                                        <div onMouseEnter={keepNextEp} onMouseLeave={closeNextEp}>
                                            <NextEpisodePopup data={nextEpisodeData} onPlay={() => { onNextEpisode(); setShowNextEpPopup(false); }} />
                                        </div>
                                    )}
                                    {/* Invisible bridge */}
                                    {showNextEpPopup && (
                                        <div style={{ position: 'absolute', bottom: '100%', right: -30, width: 550, height: 20, zIndex:  99}} onMouseEnter={keepNextEp} />
                                    )}
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onNextEpisode(); }}
                                        className={`${btn} ${showNextEp ? btnActive : ''}`}
                                        aria-label="Next episode"
                                        title="Next Episode (N)"
                                    >
                                        <SkipForwardIcon size={ICON_SIZE} weight={showNextEp ? 'fill' : 'regular'} />
                                    </button>
                                </div>
                            )}

                            {/* Subtitles — hover on desktop */}
                            {onSubtitlesClick && (
                                <div className="relative" onMouseEnter={openSubtitles} onMouseLeave={closeSubtitles}>
                                    {/* Invisible bridge between button and panel */}
                                    <div style={{ position: 'absolute', bottom: '100%', left: -20, right: -20, height: 20, zIndex: 99 }} onMouseEnter={keepSubtitles} />
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (activePanel === 'audioSubtitles') setActivePanel?.('none');
                                            else setActivePanel?.('audioSubtitles');
                                        }}
                                        className={`${btn} ${activePanel === 'audioSubtitles' ? btnActive : ''}`}
                                        aria-label="Subtitles & Audio"
                                        title="Subtitles (S)"
                                    >
                                        <SubtitlesIcon size={ICON_SIZE} weight={activePanel === 'audioSubtitles' ? 'fill' : 'regular'} />
                                    </button>
                                </div>
                            )}

                            {/* Episodes — TV only */}
                            {isTV && onEpisodesClick && (
                                <div className="relative" onMouseEnter={openEpisodes} onMouseLeave={closeEpisodes}>
                                    <div style={{ position: 'absolute', bottom: '100%', left: -20, right: -20, height: 20, zIndex: 99 }} onMouseEnter={keepEpisodes} />
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (activePanel === 'episodes' || activePanel === 'seasons') setActivePanel?.('none');
                                            else setActivePanel?.('episodes');
                                        }}
                                        className={`${btn} ${(activePanel === 'episodes' || activePanel === 'seasons') ? btnActive : ''}`}
                                        aria-label="Episode Explorer"
                                        title="Episodes"
                                    >
                                        <CardsThreeIcon size={ICON_SIZE} weight={(activePanel === 'episodes' || activePanel === 'seasons') ? 'fill' : 'regular'} />
                                    </button>
                                </div>
                            )}

                            {/* Fullscreen */}
                            <button onClick={(e) => { e.stopPropagation(); onToggleFullscreen(); }} className={btn} aria-label="Toggle fullscreen" title="Fullscreen (F)">
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
