/**
 * useAudioSidecar
 *
 * "Decode-to-PCM" architecture for handling AC3/EAC3/DTS audio in MKV files.
 *
 * Architecture:
 *   MKV File (CDN URL)
 *       │
 *       ▼
 *   [HTTP Range Requests] ──► [EBML Probe / web-demuxer]
 *       │
 *       ├──► Video track (H.264) ──► <video muted> (Chrome handles silently)
 *       │
 *       └──► Audio track (AC3/EAC3/DTS) ──► [ffmpeg.audio.wasm] ──► PCM Float32 ──► [Web Audio API]
 *                                      │
 *                                      ▼
 *                            (Decode only. No re-encode to AAC.)
 *
 * Why Decode-to-PCM instead of Decode-to-AAC?
 * - AC3 → AAC requires full decode + re-encode (CPU heavy)
 * - AC3 → PCM only requires decode (faster, lighter)
 * - Web Audio API plays PCM natively
 *
 * Sync: AudioBufferSourceNode scheduled against video.currentTime
 * Drift correction: video.playbackRate adjustment every 2 seconds
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

const FFMPEG_BASE_URL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';

export type SidecarStatus = 'idle' | 'loading' | 'decoding' | 'ready' | 'error';

interface AudioSidecarOptions {
    /** Trigger re-initialization when this changes */
    trigger?: string;
    /** Callback when sync is lost and VLC fallback is recommended */
    onSyncLost?: () => void;
}

export function useAudioSidecar(videoRef: React.RefObject<HTMLVideoElement>, options: AudioSidecarOptions = {}) {
    const [status, setStatus] = useState<SidecarStatus>('idle');
    const [progress, setProgress] = useState(0);
    const [isActive, setIsActive] = useState(false);

    const ffmpegRef = useRef<FFmpeg | null>(null);
    const audioCtxRef = useRef<AudioContext | null>(null);
    const masterGainRef = useRef<GainNode | null>(null);
    const loadedRef = useRef(false);
    const scheduledRef = useRef<AudioBufferSourceNode[]>([]);
    const isRunningRef = useRef(false);

    // Sync state
    const baseVideoTimeRef = useRef(0);
    const baseAudioTimeRef = useRef(0);
    const driftIntervalRef = useRef<number | null>(null);

    /** Load ffmpeg.wasm lazily (only when AC3 audio is detected) */
    const loadFFmpeg = useCallback(async (): Promise<FFmpeg> => {
        if (ffmpegRef.current && loadedRef.current) return ffmpegRef.current;

        setStatus('loading');
        const ffmpeg = new FFmpeg();
        ffmpegRef.current = ffmpeg;

        ffmpeg.on('progress', ({ progress: p }) => {
            setProgress(Math.round(p * 100));
        });

        ffmpeg.on('log', ({ message }) => {
            if (message.includes('Error') || message.includes('error')) {
                console.warn('[AudioSidecar] ffmpeg:', message);
            }
        });

        await ffmpeg.load({
            coreURL: await toBlobURL(`${FFMPEG_BASE_URL}/ffmpeg-core.js`, 'text/javascript'),
            wasmURL: await toBlobURL(`${FFMPEG_BASE_URL}/ffmpeg-core.wasm`, 'application/wasm'),
        });

        loadedRef.current = true;
        return ffmpeg;
    }, []);

    /** Initialize Web Audio API context */
    const initAudioContext = useCallback(() => {
        if (audioCtxRef.current) return audioCtxRef.current;

        const ctx = new AudioContext();
        const gain = ctx.createGain();
        gain.connect(ctx.destination);
        gain.gain.value = 1.0; // Will sync with video volume

        audioCtxRef.current = ctx;
        masterGainRef.current = gain;
        return ctx;
    }, []);

    /** Start audio playback synced to video */
    const start = useCallback(async (mkvUrl: string) => {
        const video = videoRef.current;
        if (!video || isRunningRef.current) return;

        setStatus('decoding');
        isRunningRef.current = true;

        // Initialize
        const ctx = initAudioContext();
        const ffmpeg = await loadFFmpeg();

        // Capture sync baselines
        baseVideoTimeRef.current = video.currentTime;
        baseAudioTimeRef.current = ctx.currentTime + 0.2; // 200ms safety buffer

        // Decode audio chunk from MKV
        try {
            // Fetch first 20MB of MKV (contains audio header + some data)
            console.log('[AudioSidecar] Fetching audio from MKV...');
            const data = await fetchFile(mkvUrl);

            const inputName = 'input.mkv';
            const outputName = 'audio.wav';

            await ffmpeg.writeFile(inputName, data);

            // Extract audio to WAV (48kHz stereo)
            await ffmpeg.exec([
                '-i', inputName,
                '-vn',
                '-acodec', 'pcm_f32le',
                '-ar', '48000',
                '-ac', '2',
                '-t', '60', // First 60 seconds
                outputName
            ]);

            const wavData = await ffmpeg.readFile(outputName);
            let bytes: Uint8Array;
            if (typeof wavData === 'string') {
                bytes = new TextEncoder().encode(wavData);
            } else {
                bytes = new Uint8Array(wavData);
            }

            // Decode WAV to AudioBuffer
            // bytes.buffer is typed as ArrayBufferLike but ffmpeg's readFile always
            // returns a real Uint8Array backed by a plain ArrayBuffer at runtime.
            const audioBuffer = await ctx.decodeAudioData(bytes.buffer as ArrayBuffer);

            // Create AudioBufferSourceNode
            const source = ctx.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(masterGainRef.current!);

            // Schedule playback synced to video time
            const when = baseAudioTimeRef.current;
            const offset = baseVideoTimeRef.current; // Start from current video position
            source.start(when, offset);

            scheduledRef.current.push(source);
            setStatus('ready');
            setIsActive(true);

            console.log('[AudioSidecar] Audio started, synced to video');

            // Start drift correction loop
            startDriftCorrection();

        } catch (err) {
            console.error('[AudioSidecar] Decode failed:', err);
            setStatus('error');
            isRunningRef.current = false;
        }
    }, [videoRef, loadFFmpeg, initAudioContext]);

    /** Drift correction loop - adjusts video playbackRate to stay in sync */
    const startDriftCorrection = useCallback(() => {
        if (driftIntervalRef.current) return;

        driftIntervalRef.current = window.setInterval(() => {
            const video = videoRef.current;
            const ctx = audioCtxRef.current;
            if (!video || !ctx || !isRunningRef.current) return;

            const expectedAudioTime = ctx.currentTime - baseAudioTimeRef.current;
            const actualVideoTime = video.currentTime - baseVideoTimeRef.current;
            const drift = actualVideoTime - expectedAudioTime;

            // If drift > 50ms, adjust video playback rate
            if (Math.abs(drift) > 0.05) {
                video.playbackRate = drift > 0 ? 0.98 : 1.02;
                console.log(`[AudioSidecar] Drift: ${(drift * 1000).toFixed(0)}ms, adjusted playbackRate to ${video.playbackRate}`);
            } else if (video.playbackRate !== 1.0) {
                video.playbackRate = 1.0;
            }
        }, 2000);
    }, [videoRef]);

    /** Stop audio and cleanup */
    const stop = useCallback(() => {
        isRunningRef.current = false;

        // Stop drift correction
        if (driftIntervalRef.current) {
            clearInterval(driftIntervalRef.current);
            driftIntervalRef.current = null;
        }

        // Stop all scheduled sources
        scheduledRef.current.forEach(source => {
            try { source.stop(); } catch {}
        });
        scheduledRef.current = [];

        setStatus('idle');
        setIsActive(false);

        console.log('[AudioSidecar] Stopped');
    }, []);

    /** Cleanup on unmount */
    useEffect(() => {
        return () => {
            stop();
            audioCtxRef.current?.close();
            audioCtxRef.current = null;
            loadedRef.current = false;
        };
    }, [stop]);

    // Mobile gating - skip WASM on mobile
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    return {
        start,
        stop,
        status,
        progress,
        isActive,
        isMobile,
        // Expose audio context for volume sync
        setVolume: (vol: number) => {
            if (masterGainRef.current) {
                masterGainRef.current.gain.value = vol;
            }
        }
    };
}