import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { CaptionCue, getCaptionCues } from '../services/YouTubeCaptionService';

export function useYouTubeCaptions(
  playerRef: MutableRefObject<any>,
  videoId: string | null,
  isPlaying: boolean,
  lang = 'en'
) {
  const [cues, setCues] = useState<CaptionCue[] | null>(null);
  const [activeCue, setActiveCue] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!videoId) {
      setCues(null);
      setActiveCue(null);
      return;
    }

    setCues(null);
    setActiveCue(null);
    getCaptionCues(videoId, lang).then((fetched) => {
      if (!cancelled) setCues(fetched);
    });

    return () => {
      cancelled = true;
    };
  }, [videoId, lang]);

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

  return { activeCue, hasCaptions: !!cues && cues.length > 0 };
}
