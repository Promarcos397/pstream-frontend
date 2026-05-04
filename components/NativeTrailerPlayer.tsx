/**
 * components/NativeTrailerPlayer.tsx
 *
 * Renders trailers as either:
 *  A) YouTube iframe  — when streamUrl is a youtube.com/embed URL (primary path)
 *  B) Native <video>  — for any future direct mp4/DASH/HLS stream URLs
 *
 * YouTube iframe is styled to behave like object-fit:cover — fills the hero
 * completely with no letterboxing. Controls and branding are hidden via URL
 * params. pointer-events:none means clicks pass through to P-Stream's own UI.
 *
 * The YouTube logo appears briefly (~2s) in the bottom-right but is covered
 * by the hero gradient overlay so it's not visible to users.
 */

import React, { useRef, useEffect, useState } from 'react';
import Hls from 'hls.js';
import type { MediaPlayerClass } from 'dashjs';
import { useSubtitleStyle } from '../hooks/useSubtitleStyle';
import { useVideoCover } from '../hooks/useVideoCover';

interface NativeTrailerPlayerProps {
    streamUrl:    string;
    isDASH?:      boolean;
    isHLS?:       boolean;
    subtitleUrl?: string | null;
    isMuted:      boolean;
    autoPlay?:    boolean;
    loop?:        boolean;
    className?:   string;
    style?:       React.CSSProperties;
    onReady?:     () => void;
    onEnd?:       () => void;
    onError?:     () => void;
}

const NativeTrailerPlayer: React.FC<NativeTrailerPlayerProps> = ({
    streamUrl,
    isDASH = false,
    isHLS  = false,
    subtitleUrl,
    isMuted,
    autoPlay = true,
    loop     = false,
    className,
    style,
    onReady,
    onEnd,
    onError,
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const videoRef     = useRef<HTMLVideoElement>(null);
    const hlsRef       = useRef<Hls | null>(null);
    const dashRef      = useRef<MediaPlayerClass | null>(null);
    const [activeCue, setActiveCue] = useState<string | null>(null);
    const { overlayStyle, lang, enabled: subtitlesEnabled } = useSubtitleStyle();

    const isYouTube = streamUrl?.includes('youtube.com/embed/');
    // JS-precise cover sizing — ResizeObserver updates on container resize
    // zoomBuffer=1.06 slightly overflows to push YouTube watermark off-screen
    const { width: ytW, height: ytH } = useVideoCover(containerRef, 1.06);

    // ── YouTube iframe path ───────────────────────────────────────────────────
    useEffect(() => {
        if (!isYouTube) return;
        // Signal ready after a short delay (iframe fires no reliable load event)
        const t = setTimeout(() => onReady?.(), 1500);
        return () => clearTimeout(t);
    }, [isYouTube, streamUrl]);

    // ── Native video path (DASH / HLS / mp4) ────────────────────────────────
    useEffect(() => {
        const video = videoRef.current;
        if (!video || !streamUrl || isYouTube) return;

        hlsRef.current?.destroy();  hlsRef.current  = null;
        dashRef.current?.reset();   dashRef.current = null;

        if (isDASH) {
            import('dashjs').then((dashjs) => {
                const player = dashjs.MediaPlayer().create();
                player.initialize(video, streamUrl, autoPlay);
                player.setMute(isMuted);
                player.on(dashjs.MediaPlayer.events['CAN_PLAY'], () => onReady?.());
                player.on(dashjs.MediaPlayer.events['PLAYBACK_ENDED'], () => onEnd?.());
                player.on(dashjs.MediaPlayer.events['ERROR'], () => onError?.());
                dashRef.current = player;
            }).catch(() => onError?.());
        } else if (isHLS && Hls.isSupported()) {
            const hls = new Hls({ maxBufferLength: 30, startLevel: -1 });
            hls.loadSource(streamUrl);
            hls.attachMedia(video);
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                if (autoPlay) video.play().catch(() => {});
            });
            hls.on(Hls.Events.ERROR, (_e, d) => { if (d.fatal) onError?.(); });
            hlsRef.current = hls;
        } else if (isHLS && video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = streamUrl;
            if (autoPlay) video.play().catch(() => {});
        } else {
            // Plain mp4
            video.src = streamUrl;
            if (autoPlay) video.play().catch(() => {});
        }

        return () => {
            hlsRef.current?.destroy();  hlsRef.current  = null;
            dashRef.current?.reset();   dashRef.current = null;
        };
    }, [streamUrl, isDASH, isHLS, isYouTube]);

    useEffect(() => {
        const v = videoRef.current;
        if (v) v.muted = isMuted;
        dashRef.current?.setMute(isMuted);
    }, [isMuted]);

    // ── Subtitle cue tracking ─────────────────────────────────────────────────
    useEffect(() => {
        const v = videoRef.current;
        if (!v || !subtitleUrl) return;
        const t = setTimeout(() => {
            const track = v.textTracks[0];
            if (!track) return;
            track.mode = subtitlesEnabled ? 'hidden' : 'disabled';
            const onCueChange = () => {
                const cues = track.activeCues;
                if (!cues?.length) { setActiveCue(null); return; }
                const cue = cues[cues.length - 1] as VTTCue;
                setActiveCue(cue.text?.replace(/<[^>]+>/g, '').trim() || null);
            };
            track.addEventListener('cuechange', onCueChange);
        }, 100);
        return () => clearTimeout(t);
    }, [subtitleUrl, subtitlesEnabled]);

    const BACKEND = import.meta.env.VITE_GIGA_BACKEND_URL || '';
    const proxySub = (u: string | null | undefined) =>
        u ? (BACKEND ? `${BACKEND}/proxy/subtitle?url=${encodeURIComponent(u)}` : u) : null;

    return (
        <div ref={containerRef} className={`relative w-full h-full ${className || ''}`} style={style}>

            {/* ── YouTube iframe — JS-precise cover fill via useVideoCover ── */}
            {isYouTube && (
                <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
                    <iframe
                        src={streamUrl}
                        style={{
                            position:      'absolute',
                            top:           '50%',
                            left:          '50%',
                            width:         ytW ? `${ytW}px` : '100%',
                            height:        ytH ? `${ytH}px` : '100%',
                            transform:     'translate(-50%, -50%)',
                            border:        'none',
                            pointerEvents: 'none',
                        }}
                        allow="autoplay; encrypted-media"
                        allowFullScreen={false}
                        title="trailer"
                        referrerPolicy="strict-origin"
                    />
                </div>
            )}

            {/* ── Native video ── */}
            {!isYouTube && (
                <video
                    ref={videoRef}
                    muted={isMuted}
                    loop={loop}
                    playsInline
                    className="w-full h-full object-cover"
                    onCanPlay={() => !isDASH && onReady?.()}
                    onEnded={() => onEnd?.()}
                    onError={() => !isDASH && onError?.()}
                >
                    {subtitleUrl && (
                        <track
                            kind="subtitles"
                            src={proxySub(subtitleUrl) || ''}
                            srcLang={lang || 'en'}
                            label="English"
                            default
                        />
                    )}
                </video>
            )}

            {/* ── Subtitle overlay ── */}
            {!isYouTube && subtitlesEnabled && activeCue && (
                <div
                    style={{
                        ...overlayStyle,
                        position:  'absolute',
                        bottom:    '8%',
                        left:      '50%',
                        transform: 'translateX(-50%)',
                        maxWidth:  '80%',
                        textAlign: 'center',
                        pointerEvents: 'none',
                        zIndex: 10,
                    }}
                >
                    {activeCue}
                </div>
            )}
        </div>
    );
};

export default NativeTrailerPlayer;
