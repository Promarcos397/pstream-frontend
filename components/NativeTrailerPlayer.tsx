/**
 * components/NativeTrailerPlayer.tsx
 * ────────────────────────────────────
 * Plays a direct-stream trailer URL (from NewPipe/yt-dlp) in a native
 * HTML5 <video> element. Supports:
 *  - Autoplay muted (required by browsers for autoplaying video)
 *  - WebVTT subtitle track (fetched from NewPipe /extract response)
 *  - Styled caption overlay matching the app's subtitle settings
 *  - Cover-fill sizing (same as YouTube iframe was doing)
 *  - onReady / onEnd / onError callbacks for parent state management
 *
 * Used by HeroCarouselBackground and InfoModal when YOUTUBE_DISABLED=true.
 */

import React, { useRef, useEffect, useState } from 'react';
import { useSubtitleStyle } from '../hooks/useSubtitleStyle';

// yt-dlp subtitle URLs come from YouTube's CDN (googlevideo.com) which blocks
// cross-origin requests from browsers. We proxy them through our backend so
// the response has proper CORS headers.
const BACKEND = import.meta.env.VITE_GIGA_BACKEND_URL || '';
function proxySubtitleUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (!BACKEND) return url; // dev fallback — may not work in browser
  return `${BACKEND}/proxy/subtitle?url=${encodeURIComponent(url)}`;
}

interface NativeTrailerPlayerProps {
  streamUrl:    string;
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
  const videoRef = useRef<HTMLVideoElement>(null);
  const [activeCue, setActiveCue] = useState<string | null>(null);
  const { overlayStyle, lang, enabled: subtitlesEnabled } = useSubtitleStyle();

  // Sync mute state without reloading
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = isMuted;
  }, [isMuted]);

  // Wire subtitle cue tracking
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !subtitleUrl) return;

    const track = v.textTracks[0];
    if (!track) return;

    track.mode = subtitlesEnabled ? 'hidden' : 'disabled';

    const onCueChange = () => {
      const cues = track.activeCues;
      if (!cues || cues.length === 0) { setActiveCue(null); return; }
      const cue = cues[cues.length - 1] as VTTCue;
      // Strip VTT tags (<c>, <b>, etc.) for clean text
      setActiveCue(cue.text?.replace(/<[^>]+>/g, '').trim() || null);
    };

    track.addEventListener('cuechange', onCueChange);
    return () => track.removeEventListener('cuechange', onCueChange);
  }, [subtitleUrl, subtitlesEnabled]);

  return (
    <div className={`relative w-full h-full ${className || ''}`} style={style}>
      <video
        ref={videoRef}
        src={streamUrl}
        autoPlay={autoPlay}
        muted={isMuted}
        loop={loop}
        playsInline
        className="w-full h-full object-cover"
        onCanPlay={() => onReady?.()}
        onEnded={() => onEnd?.()}
        onError={() => onError?.()}
        crossOrigin="anonymous"
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

      {/* Caption overlay — mirrors the existing subtitle styling system */}
      {subtitlesEnabled && activeCue && (
        <div
          style={{
            ...overlayStyle,
            position: 'absolute',
            bottom: '8%',
            left: '50%',
            transform: 'translateX(-50%)',
            maxWidth: '80%',
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
