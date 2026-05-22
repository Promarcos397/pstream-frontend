import { useEffect, useRef, useState, useCallback } from 'react';

export type WasmAudioStatus = 'idle' | 'loading' | 'buffering' | 'ready' | 'error';

interface Options {
  onError?: (msg: string) => void;
}

export function useWasmAudio(videoRef: React.RefObject<HTMLVideoElement | null>, options: Options = {}) {
  const [status, setStatus] = useState<WasmAudioStatus>('idle');
  const [bufferedSec, setBufferedSec] = useState(0);

  const workerRef = useRef<Worker | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const runningRef = useRef(false);

  const baseRef = useRef({ video: 0, audio: 0 });
  const nextWhenRef = useRef(0);
  const sourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const currentVolumeRef = useRef(1.0);
  const lastScheduledRef = useRef({ timestamp: 0, actualWhen: 0, duration: 0 });

  const initCtx = useCallback(() => {
    if (ctxRef.current) return ctxRef.current;
    const ctx = new AudioContext({ latencyHint: 'playback' });
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    gain.gain.value = currentVolumeRef.current;
    ctxRef.current = ctx;
    gainRef.current = gain;
    return ctx;
  }, []);

  const ensureActivated = useCallback(() => {
    try {
      const ctx = initCtx();
      if (ctx.state === 'suspended') {
        ctx.resume().catch(err => console.warn('[WasmAudio] Failed to resume AudioContext in ensureActivated:', err));
      }
    } catch (err) {
      console.warn('[WasmAudio] Failed to initialize AudioContext in ensureActivated:', err);
    }
  }, [initCtx]);

  const stop = useCallback(() => {
    runningRef.current = false;
    if (workerRef.current) {
      workerRef.current.postMessage({ type: 'stop' });
      workerRef.current.terminate();
      workerRef.current = null;
    }
    sourcesRef.current.forEach((s) => {
      try {
        s.stop();
      } catch (err) {}
    });
    sourcesRef.current = [];
    lastScheduledRef.current = { timestamp: 0, actualWhen: 0, duration: 0 };
    setStatus('idle');
    setBufferedSec(0);
  }, []);

  const seek = useCallback((time: number, url: string) => {
    const ctx = ctxRef.current;
    if (!ctx) return;

    sourcesRef.current.forEach((s) => {
      try {
        s.stop();
      } catch (err) {}
    });
    sourcesRef.current = [];

    baseRef.current = { video: time, audio: ctx.currentTime + 0.15 };
    nextWhenRef.current = baseRef.current.audio;
    lastScheduledRef.current = { timestamp: time, actualWhen: 0, duration: 0 };

    if (workerRef.current) {
      workerRef.current.postMessage({ type: 'seek', url, time });
    }
  }, []);

  const start = useCallback(async (proxiedUrl: string, startTime: number) => {
    const video = videoRef.current;
    if (!video || runningRef.current) return;

    runningRef.current = true;
    setStatus('loading');

    try {
      const ctx = initCtx();
      if (ctx.state === 'suspended') {
        await ctx.resume().catch(err => console.warn('[WasmAudio] Failed to resume AudioContext in start:', err));
      }

      // Start worker using Vite worker constructor
      const worker = new Worker(
        new URL('../workers/wasmAudioWorker.ts', import.meta.url),
        { type: 'module' }
      );
      workerRef.current = worker;

      baseRef.current = { video: startTime, audio: ctx.currentTime + 0.3 };
      nextWhenRef.current = baseRef.current.audio;
      lastScheduledRef.current = { timestamp: startTime, actualWhen: 0, duration: 0 };

      worker.onmessage = (e) => {
        if (!runningRef.current) return;
        const { type, left, right, timestamp, duration, sampleRate, message } = e.data;

        switch (type) {
          case 'metadata':
            setStatus('ready');
            break;

          case 'pcm':
            schedulePCM(left, right, timestamp, duration, sampleRate);
            break;

          case 'error':
            console.error('[WasmAudio Hook] Worker error:', message);
            setStatus('error');
            options.onError?.(message);
            stop();
            break;
        }
      };

      worker.postMessage({ type: 'start', url: proxiedUrl, time: startTime });

    } catch (err: any) {
      console.error('[WasmAudio Hook] Start failed:', err);
      setStatus('error');
      options.onError?.(err.message || 'Failed to start WASM audio');
      stop();
    }
  }, [videoRef, initCtx, stop, options]);

  const schedulePCM = useCallback((
    left: Float32Array,
    right: Float32Array,
    timestamp: number,
    duration: number,
    sampleRate: number
  ) => {
    const ctx = ctxRef.current;
    if (!ctx || !runningRef.current) return;

    const numFrames = left.length;
    const buffer = ctx.createBuffer(2, numFrames, sampleRate);
    buffer.copyToChannel(left, 0);
    buffer.copyToChannel(right, 1);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(gainRef.current!);

    const offset = timestamp - baseRef.current.video;
    const when = baseRef.current.audio + Math.max(0, offset);
    const now = ctx.currentTime;
    const actualWhen = Math.max(when, now + 0.05);

    source.start(actualWhen);
    sourcesRef.current.push(source);

    lastScheduledRef.current = { timestamp, actualWhen, duration };
    nextWhenRef.current = actualWhen + duration;

    source.onended = () => {
      const idx = sourcesRef.current.indexOf(source);
      if (idx > -1) sourcesRef.current.splice(idx, 1);
    };

    setBufferedSec(Math.max(0, nextWhenRef.current - ctx.currentTime));
  }, []);

  const setVolume = useCallback((v: number) => {
    currentVolumeRef.current = v;
    if (gainRef.current) {
      gainRef.current.gain.value = v;
    }
  }, []);

  const getCurrentTime = useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx || !runningRef.current) return 0;
    const last = lastScheduledRef.current;
    if (last.actualWhen === 0) {
      return baseRef.current.video;
    }
    const elapsed = ctx.currentTime - last.actualWhen;
    const clampedElapsed = Math.max(0, Math.min(elapsed, last.duration));
    return last.timestamp + clampedElapsed;
  }, []);

  const pause = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.postMessage({ type: 'pause' });
    }
    sourcesRef.current.forEach((s) => {
      try {
        s.stop();
      } catch (err) {}
    });
    sourcesRef.current = [];
  }, []);

  const resume = useCallback(async (time: number) => {
    const ctx = ctxRef.current;
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      await ctx.resume().catch(err => console.warn('[WasmAudio] Failed to resume AudioContext in resume:', err));
    }

    baseRef.current = { video: time, audio: ctx.currentTime + 0.1 };
    nextWhenRef.current = baseRef.current.audio;
    lastScheduledRef.current = { timestamp: time, actualWhen: 0, duration: 0 };

    if (workerRef.current) {
      workerRef.current.postMessage({ type: 'resume' });
    }
  }, []);

  // Sync real-time video playhead to the worker to prevent throttling deadlocks
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      if (runningRef.current && workerRef.current) {
        workerRef.current.postMessage({
          type: 'updatePlayhead',
          playhead: video.currentTime,
        });
      }
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [videoRef]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stop();
      if (ctxRef.current) {
        ctxRef.current.close().catch(() => {});
        ctxRef.current = null;
      }
    };
  }, [stop]);

  return {
    start,
    stop,
    seek,
    pause,
    resume,
    setVolume,
    getCurrentTime,
    ensureActivated,
    status,
    bufferedSec,
    isActive: runningRef.current,
  };
}
