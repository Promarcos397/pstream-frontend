/**
 * useAudioSidecar
 * 
 * "Decode-to-PCM" architecture — rebuilt.
 * 
 * Pipeline:
 *   Video: <video src="cdnUrl" muted> (Chrome plays MKV silently, free)
 *   Audio: MkvAudioExtractor → HTTP Range clusters → raw AC3 frames → ffmpeg.wasm → PCM WAV → Web Audio API
 * 
 * NEVER downloads the full file. Only pulls audio clusters on demand.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';
import { MkvAudioExtractor } from '../utils/mkvAudioExtractor';

const FFMPEG_BASE_URL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';

export type SidecarStatus = 'idle' | 'loading' | 'buffering' | 'ready' | 'error' | 'mobile-fallback';

interface Options {
  onError?: (msg: string) => void;
  onVlcFallback?: () => void;
}

export function useAudioSidecar(videoRef: React.RefObject<HTMLVideoElement | null>, options: Options = {}) {
  const [status, setStatus] = useState<SidecarStatus>('idle');
  const [bufferedSec, setBufferedSec] = useState(0);

  const ffmpegRef = useRef<FFmpeg | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const extractorRef = useRef<MkvAudioExtractor | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const baseRef = useRef({ video: 0, audio: 0 });
  const nextWhenRef = useRef(0);
  const runningRef = useRef(false);
  const sourcesRef = useRef<AudioBufferSourceNode[]>([]);

  /** Lazy-load ffmpeg.wasm once */
  const loadFfmpeg = useCallback(async () => {
    if (ffmpegRef.current) return ffmpegRef.current;
    setStatus('loading');
    const ffmpeg = new FFmpeg();
    ffmpeg.on('log', ({ message }) => {
      if (message.toLowerCase().includes('error')) console.warn('[Sidecar]', message);
    });
    await ffmpeg.load({
      coreURL: await toBlobURL(`${FFMPEG_BASE_URL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${FFMPEG_BASE_URL}/ffmpeg-core.wasm`, 'application/wasm'),
    });
    ffmpegRef.current = ffmpeg;
    return ffmpeg;
  }, []);

  const initCtx = useCallback(() => {
    if (ctxRef.current) return ctxRef.current;
    const ctx = new AudioContext({ latencyHint: 'playback' });
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    gain.gain.value = 1.0;
    ctxRef.current = ctx;
    gainRef.current = gain;
    return ctx;
  }, []);

  /** Decode raw AC3/EAC3 frames → AudioBuffer */
  const decodeFrames = useCallback(async (ffmpeg: FFmpeg, raw: Uint8Array, codec: string): Promise<AudioBuffer | null> => {
    const ext = codec.includes('EAC3') || codec.includes('E-AC-3') ? 'eac3' : 'ac3';
    const input = `in.${ext}`;
    const output = 'out.wav';

    await ffmpeg.writeFile(input, raw);
    await ffmpeg.exec([
      '-i', input,
      '-vn',
      '-acodec', 'pcm_f32le',
      '-ar', '48000',
      '-ac', '2',
      '-f', 'wav',
      output,
    ]);

    const data = await ffmpeg.readFile(output);
    const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data);
    await ffmpeg.deleteFile(input);
    await ffmpeg.deleteFile(output);

    const ctx = ctxRef.current!;
    return ctx.decodeAudioData(bytes.buffer.slice(0));
  }, []);

  /** Start sidecar for an MKV URL */
  const start = useCallback(async (mkvUrl: string) => {
    const video = videoRef.current;
    if (!video || runningRef.current) return;

    // Gate: WASM kills mobile. Skip entirely.
    if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
      setStatus('mobile-fallback');
      options.onVlcFallback?.();
      return;
    }

    runningRef.current = true;
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;

    try {
      setStatus('buffering');

      // 1. Init MKV extractor (header + cues, ~3 fetches max)
      const extractor = new MkvAudioExtractor(mkvUrl);
      const ok = await extractor.init(signal);
      if (!ok) throw new Error('MKV parse failed — not a valid MKV or no audio track');

      const codec = extractor.getCodec();
      console.log('[AudioSidecar] Codec:', codec);

      // 2. Init audio pipeline
      const ctx = initCtx();
      const ffmpeg = await loadFfmpeg();

      // 3. Baseline sync
      baseRef.current = { video: video.currentTime, audio: ctx.currentTime + 0.3 };
      nextWhenRef.current = baseRef.current.audio;

      extractorRef.current = extractor;
      setStatus('ready');

      // 4. Decode-ahead loop
      runDecodeLoop(extractor, ffmpeg, video, ctx, signal);

    } catch (err: any) {
      console.error('[AudioSidecar]', err);
      setStatus('error');
      options.onError?.(err.message);
      runningRef.current = false;
    }
  }, [videoRef, loadFfmpeg, initCtx, options]);

  /** Background loop: keep ~45s of audio buffered */
  const runDecodeLoop = useCallback(async (
    extractor: MkvAudioExtractor,
    ffmpeg: FFmpeg,
    video: HTMLVideoElement,
    ctx: AudioContext,
    signal: AbortSignal
  ) => {
    const CHUNK_SEC = 15; // smaller chunks = faster decode
    const TARGET_SEC = 45;

    while (runningRef.current && !signal.aborted) {
      const videoTime = video.currentTime;
      const buffered = Math.max(0, nextWhenRef.current - ctx.currentTime);
      setBufferedSec(buffered);

      if (buffered < TARGET_SEC / 3) {
        try {
          const raw = await extractor.extractRange(videoTime + buffered, CHUNK_SEC, signal);
          if (raw && raw.length > 10) {
            const codec = extractor.getCodec() || 'A_AC3';
            const buf = await decodeFrames(ffmpeg, raw, codec);
            if (buf && !signal.aborted) schedule(buf, videoTime + buffered);
          } else {
            // End of stream or gap
            await sleep(1000);
          }
        } catch (e) {
          console.warn('[AudioSidecar] chunk failed:', e);
          await sleep(2000);
        }
      } else {
        await sleep(1000);
      }
    }
  }, [decodeFrames]);

  const schedule = useCallback((buffer: AudioBuffer, videoStartSec: number) => {
    const ctx = ctxRef.current;
    if (!ctx || !runningRef.current) return;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(gainRef.current!);

    const offset = videoStartSec - baseRef.current.video;
    const when = baseRef.current.audio + Math.max(0, offset);
    const now = ctx.currentTime;
    const actualWhen = Math.max(when, now + 0.05); // 50ms safety

    source.start(actualWhen);
    sourcesRef.current.push(source);
    nextWhenRef.current = actualWhen + buffer.duration;

    source.onended = () => {
      const idx = sourcesRef.current.indexOf(source);
      if (idx > -1) sourcesRef.current.splice(idx, 1);
    };
  }, []);

  /** Video seeked: flush audio, reset baseline, restart loop */
  const onSeeked = useCallback(() => {
    const video = videoRef.current;
    const ctx = ctxRef.current;
    if (!video || !ctx) return;

    sourcesRef.current.forEach(s => { try { s.stop(); } catch {} });
    sourcesRef.current = [];

    baseRef.current = { video: video.currentTime, audio: ctx.currentTime + 0.1 };
    nextWhenRef.current = baseRef.current.audio;
  }, [videoRef]);

  const stop = useCallback(() => {
    runningRef.current = false;
    abortRef.current?.abort();
    sourcesRef.current.forEach(s => { try { s.stop(); } catch {} });
    sourcesRef.current = [];
    setStatus('idle');
    setBufferedSec(0);
  }, []);

  const setVolume = useCallback((v: number) => {
    if (gainRef.current) gainRef.current.gain.value = v;
  }, []);

  // Wire seek events
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.addEventListener('seeked', onSeeked);
    return () => v.removeEventListener('seeked', onSeeked);
  }, [videoRef, onSeeked]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stop();
      ctxRef.current?.close();
      ctxRef.current = null;
    };
  }, [stop]);

  return { start, stop, status, bufferedSec, setVolume, isActive: runningRef.current };
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}