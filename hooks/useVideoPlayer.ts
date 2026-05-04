import { useRef, useState, useEffect } from 'react';
import { useGlobalContext } from '../context/GlobalContext';

interface UseVideoPlayerOptions {
  movieId: number | string;
  videoId: string | null;
  autoSync?: boolean;
  earlyStop?: number;
  startMuted?: boolean;
  loop?: boolean;
  onEnded?: () => void;
  onErrored?: () => void;
  onProgress?: (time: number) => void;
}

export const useVideoPlayer = ({
  movieId,
  videoId: initialVideoId,
  autoSync = true,
  earlyStop = 3,
  startMuted = false,
  loop = false,
  onEnded,
  onErrored,
  onProgress,
}: UseVideoPlayerOptions) => {
  const { globalMute, setGlobalMute, updateVideoState } = useGlobalContext();
  const [videoId, setVideoId] = useState<string | null>(initialVideoId);
  const playerRef = useRef<any>(null);
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const checkEndRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [hasEnded, setHasEnded] = useState(false);

  // Sync internal state if prop changes
  useEffect(() => {
    setVideoId(initialVideoId);
  }, [initialVideoId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
      if (checkEndRef.current) clearTimeout(checkEndRef.current);
    };
  }, []);

  // Sync mute state to player whenever it changes
  useEffect(() => {
    const player = playerRef.current;
    if (!player || typeof player.getPlayerState !== 'function') return;
    try {
      if (globalMute) player.mute();
      else player.unMute();
    } catch (_) {}
  }, [globalMute]);

  const stopSync = () => {
    if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
    if (checkEndRef.current) clearTimeout(checkEndRef.current);
  };

  const startSync = (getTime: () => number) => {
    stopSync();

    // 1s interval — write current time to GlobalContext
    syncIntervalRef.current = setInterval(() => {
      try {
        const time = getTime();
        if (autoSync && time > 0 && videoId && !(window as any).__modal_active) {
          updateVideoState(Number(movieId), time, videoId);
        }
        onProgress?.(time);
      } catch (_) {}
    }, 1000);

    // Early stop — pause or loop N seconds before end (to avoid YouTube overlays)
    if (earlyStop > 0) {
      const scheduleCheckEnd = () => {
        if (checkEndRef.current) clearTimeout(checkEndRef.current);
        checkEndRef.current = setTimeout(() => {
          if (!playerRef.current) return;
          try {
            const remaining = playerRef.current.getDuration() - playerRef.current.getCurrentTime();
            if (remaining <= earlyStop) {
              if (loop) {
                playerRef.current.seekTo(0);
                playerRef.current.playVideo();
              } else {
                stopSync();
                playerRef.current.pauseVideo();
                setIsReady(false);
                setHasEnded(true);
                onEnded?.();
                return;
              }
            }
          } catch (_) {}
          scheduleCheckEnd();
        }, 1000);
      };
      scheduleCheckEnd();
    }
  };

  const onReady = (e: any) => {
    playerRef.current = e.target;
    // Add dummy API change listener to wake up captions logic in some browsers
    try { e.target.addEventListener('onApiChange', () => {}); } catch {}
    
    try {
      if (startMuted || globalMute) e.target.mute();
      else e.target.unMute();
    } catch (_) {}
    
    try { e.target.playVideo(); } catch (_) {}
  };

  const onStateChange = (e: any) => {
    const YT_PLAYING = 1;
    const YT_PAUSED = 2;

    // Watchdog: Trigger play if player is stuck in "Cued" (5) or "Unstarted" (-1)
    if (e.data === 5 || e.data === -1) {
      try { e.target.playVideo(); } catch (_) {}
    }

    if (e.data === YT_PLAYING) {
      if (!isReady) setIsReady(true);
      setHasEnded(false);
      startSync(() => e.target.getCurrentTime());
    }

    if (e.data === YT_PAUSED) {
      stopSync();
      // Save final time on pause
      if (autoSync && videoId && !(window as any).__modal_active) {
        try {
          const time = e.target.getCurrentTime();
          if (time > 0) updateVideoState(Number(movieId), time, videoId);
        } catch (_) {}
      }
    }
  };

  const onError = () => {
    setIsReady(false);
    stopSync();
    onErrored?.();
  };

  const onEnd = () => {
    stopSync();
    setIsReady(false);
    setHasEnded(true);
    onEnded?.();
  };

  return {
    videoId,
    setVideoId,
    playerRef,
    isMuted: globalMute,
    setIsMuted: setGlobalMute,
    isReady,
    setIsReady,
    hasEnded,
    setHasEnded,
    onReady,
    onStateChange,
    onError,
    onEnd,
    stopSync,
  };
};
