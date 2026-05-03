/**
 * components/NativeTrailerPlayer.tsx
 * ─────────────────────────────────────
 * Plays Piped CDN streams in a native HTML5 <video> element.
 *
 * Piped returns:
 *  - DASH manifest (regular videos) → played via dash.js
 *  - HLS  manifest (livestreams)    → played via hls.js
 *
 * No YouTube branding. No YouTube iframe. Stream delivered by Piped CDN.
 */

import React, { useRef, useEffect, useState } from 'react';
import Hls from 'hls.js';
import type { MediaPlayerClass } from 'dashjs';
import { useSubtitleStyle } from '../hooks/useSubtitleStyle';

const BACKEND = import.meta.env.VITE_GIGA_BACKEND_URL || '';
function proxySubtitleUrl(url: string | null | undefined): string | null {
    if (!url) return null;
    if (!BACKEND) return url;
    return `${BACKEND}/proxy/subtitle?url=${encodeURIComponent(url)}`;
}

interface NativeTrailerPlayerProps {
    streamUrl:    string;
    isDASH?:      boolean;   // true → dashjs   (Piped regular videos)
    isHLS?:       boolean;   // true → hls.js   (Piped livestreams)
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
    const videoRef  = useRef<HTMLVideoElement>(null);
    const hlsRef    = useRef<Hls | null>(null);
    const dashRef   = useRef<MediaPlayerClass | null>(null);
    const [activeCue, setActiveCue] = useState<string | null>(null);
    const { overlayStyle, lang, enabled: subtitlesEnabled } = useSubtitleStyle();

    // ── DASH / HLS / plain setup ─────────────────────────────────────────
    useEffect(() => {
        const video = videoRef.current;
        if (!video || !streamUrl) return;

        // Tear down previous players
        hlsRef.current?.destroy();  hlsRef.current  = null;
        dashRef.current?.reset();   dashRef.current = null;

        if (isDASH) {
            // Lazy-load dashjs to keep initial bundle lean
            import('dashjs').then((dashjs) => {
                const player = dashjs.MediaPlayer().create();
                player.initialize(video, streamUrl, autoPlay);
                player.setMute(isMuted);
                player.on(dashjs.MediaPlayer.events['CAN_PLAY'], () => onReady?.());
                player.on(dashjs.MediaPlayer.events['PLAYBACK_ENDED'], () => onEnd?.());
                player.on(dashjs.MediaPlayer.events['ERROR'], () => onError?.());
                dashRef.current = player;
            }).catch(() => onError?.());

        } else if (isHLS) {
            if (Hls.isSupported()) {
                const hls = new Hls({ maxBufferLength: 30, startLevel: -1 });
                hls.loadSource(streamUrl);
                hls.attachMedia(video);
                hls.on(Hls.Events.MANIFEST_PARSED, () => {
                    if (autoPlay) video.play().catch(() => {});
                });
                hls.on(Hls.Events.ERROR, (_e, d) => { if (d.fatal) onError?.(); });
                hlsRef.current = hls;
            } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                // Safari native HLS
                video.src = streamUrl;
                if (autoPlay) video.play().catch(() => {});
            } else {
                onError?.();
            }
        } else {
            // Plain mp4 fallback
            video.src = streamUrl;
            if (autoPlay) video.play().catch(() => {});
        }

        return () => {
            hlsRef.current?.destroy();  hlsRef.current  = null;
            dashRef.current?.reset();   dashRef.current = null;
        };
    }, [streamUrl, isDASH, isHLS]);

    // ── Mute sync ─────────────────────────────────────────────────────────
    useEffect(() => {
        const v = videoRef.current;
        if (v) v.muted = isMuted;
        dashRef.current?.setMute(isMuted);
    }, [isMuted]);

    // ── Subtitle cue tracking ─────────────────────────────────────────────
    useEffect(() => {
        const v = videoRef.current;
        if (!v || !subtitleUrl) return;
        // Wait a tick for the <track> element to register
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

    return (
        <div className={`relative w-full h-full ${className || ''}`} style={style}>
            <video
                ref={videoRef}
                muted={isMuted}
                loop={loop}
                playsInline
                className="w-full h-full object-cover"
                onCanPlay={() => !isDASH && onReady?.()}   // DASH fires its own event
                onEnded={() => onEnd?.()}
                onError={() => !isDASH && onError?.()}     // DASH fires its own event
            >
                {subtitleUrl && (
                    <track
                        kind="subtitles"
                        src={proxySubtitleUrl(subtitleUrl) || ''}
                        srcLang={lang || 'en'}
                        label="English"
                        default
                    />
                )}
            </video>

            {subtitlesEnabled && activeCue && (
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
                        zIndex:    10,
                    }}
                >
                    {activeCue}
                </div>
            )}
        </div>
    );
};

export default NativeTrailerPlayer;
