import { useEffect, useRef, useState, useCallback, type MutableRefObject } from 'react';
import { CaptionCue, getCaptionCues, extractTrackLangs } from '../services/YouTubeCaptionService';

export function useYouTubeCaptions(
  playerRef: MutableRefObject<any>,
  videoId: string | null,
  isPlaying: boolean,
  lang = 'en'
) {
  const [cues, setCues] = useState<CaptionCue[] | null>(null);
  const [activeCue, setActiveCue] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);
  // Language codes reported by the player's captions module (via onApiChange)
  const availableLangsRef = useRef<string[]>([]);

  // ─── Load cues when videoId changes ──────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    availableLangsRef.current = [];

    if (!videoId) {
      setCues(null);
      setActiveCue(null);
      return;
    }

    setCues(null);
    setActiveCue(null);

    getCaptionCues(videoId, lang, availableLangsRef.current).then((fetched) => {
      if (!cancelled) setCues(fetched);
    });

    return () => {
      cancelled = true;
    };
  }, [videoId, lang]);

  // ─── Poll player time to sync active cue ─────────────────────────────────
  useEffect(() => {
    if (pollRef.current !== null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }

    if (!isPlaying || !cues || cues.length === 0 || !playerRef?.current) {
      setActiveCue(null);
      return;
    }

    pollRef.current = window.setInterval(() => {
      try {
        const t: number = playerRef.current?.getCurrentTime?.() ?? -1;
        if (t < 0) return;
        const match = cues.find((cue) => t >= cue.start && t <= cue.end);
        setActiveCue(match?.text ?? null);
      } catch (_) {}
    }, 200);

    return () => {
      if (pollRef.current !== null) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [isPlaying, cues, playerRef]);

  // ─── onApiChange handler (export to <YouTube> component) ─────────────────
  // When YouTube's captions module fires onApiChange, we get the tracklist.
  // This lets us know exactly which language codes are available, and re-fetch
  // with smarter language selection if the initial fetch returned null.
  const handleApiChange = useCallback(
    (event: any) => {
      try {
        const player = event?.target;
        if (!player) return;

        const modules: string[] = player.getOptions?.() || [];
        if (!modules.includes('captions')) return;

        const tracklist = player.getOption?.('captions', 'tracklist');
        const langs = extractTrackLangs(tracklist);
        if (langs.length === 0) return;

        availableLangsRef.current = langs;
        console.info('[YTCaptions] Tracklist from player:', langs);

        // If we previously got nothing, retry with the player's known lang list
        if (!cues && videoId) {
          getCaptionCues(videoId, lang, langs).then((fetched) => {
            if (fetched && fetched.length > 0) setCues(fetched);
          });
        }
      } catch (_) {}
    },
    [cues, videoId, lang]
  );

  return {
    activeCue,
    hasCaptions: !!cues && cues.length > 0,
    /** Pass this to the <YouTube> component's onApiChange prop */
    onApiChange: handleApiChange,
  };
}
