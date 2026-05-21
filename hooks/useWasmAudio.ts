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

      // Start worker using Vite worker constructor
      const worker = new Worker(
        new URL('../workers/wasmAudioWorker.ts', import.meta.url),
        { type: 'module' }
      );
      workerRef.current = worker;

      baseRef.current = { video: startTime, audio: ctx.currentTime + 0.3 };
      nextWhenRef.current = baseRef.current.audio;

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

    nextWhenRef.current = actualWhen + duration;

    // Periodically post playhead back to worker so it can throttle properly
    if (workerRef.current && Math.random() < 0.1) {
      workerRef.current.postMessage({
        type: 'updatePlayhead',
        playhead: timestamp,
      });
    }

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
    return baseRef.current.video + (ctx.currentTime - baseRef.current.audio);
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

  const resume = useCallback((time: number) => {
    const ctx = ctxRef.current;
    if (!ctx) return;

    baseRef.current = { video: time, audio: ctx.currentTime + 0.1 };
    nextWhenRef.current = baseRef.current.audio;

    if (workerRef.current) {
      workerRef.current.postMessage({ type: 'resume' });
    }
  }, []);

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
    status,
    bufferedSec,
    isActive: runningRef.current,
  };
}
