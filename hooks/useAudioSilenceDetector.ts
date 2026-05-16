/**
 * useAudioSilenceDetector
 *
 * Detects truly-silent audio during active playback using a Web Audio
 * AnalyserNode connected to the video element.
 *
 * This catches the "video plays but no sound" scenario that happens when
 * a browser loads an MKV with AC3/DTS audio it can't decode — the video
 * element reports no error, but the audio output is silence.
 *
 * Architecture:
 *   video element → MediaElementAudioSourceNode → AnalyserNode → AudioContext.destination
 *
 * The AnalyserNode is read every `pollIntervalMs`. If RMS stays below
 * `minRmsLevel` for `silenceThresholdSeconds` while the video is actively
 * playing (not paused, not muted), `silenceDetected` is set to true.
 */

import { useEffect, useRef, useState, useCallback } from 'react';

interface SilenceDetectorOptions {
    /** Seconds of continuous silence before firing (default: 6) */
    silenceThresholdSeconds?: number;
    /** RMS below this = silent (0–1, default: 0.004) */
    minRmsLevel?: number;
    /** Poll interval in ms (default: 1000) */
    pollIntervalMs?: number;
    /** Only start detecting after this many ms of playback (default: 4000) */
    startDelayMs?: number;
}

export function useAudioSilenceDetector(
    videoRef: React.RefObject<HTMLVideoElement>,
    enabled: boolean,
    options: SilenceDetectorOptions = {}
) {
    const {
        silenceThresholdSeconds = 6,
        minRmsLevel             = 0.004,
        pollIntervalMs          = 1000,
        startDelayMs            = 2000,
    } = options;

    const [silenceDetected, setSilenceDetected] = useState(false);

    const ctxRef      = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const bufferRef   = useRef<Uint8Array | null>(null);
    const silentSecs  = useRef(0);
    const dismissed   = useRef(false);
    const ready       = useRef(false);

    const dismiss = useCallback(() => {
        dismissed.current = true;
        setSilenceDetected(false);
    }, []);

    // Reset on source change
    useEffect(() => {
        dismissed.current = false;
        silentSecs.current = 0;
        setSilenceDetected(false);
    }, [enabled]);

    useEffect(() => {
        if (!enabled) return;

        const video = videoRef.current;
        if (!video || typeof AudioContext === 'undefined') return;

        dismissed.current = false;
        silentSecs.current = 0;
        ready.current = false;

        // Delay startup so initial buffering silence doesn't false-trigger
        const startTimer = setTimeout(() => { ready.current = true; }, startDelayMs);

        const setupGraph = () => {
            if (ctxRef.current) return; // already set up
            try {
                const ctx = new AudioContext();
                const analyser = ctx.createAnalyser();
                analyser.fftSize = 512;
                const source = ctx.createMediaElementSource(video);
                source.connect(analyser);
                analyser.connect(ctx.destination);
                ctxRef.current   = ctx;
                analyserRef.current = analyser;
                bufferRef.current   = new Uint8Array(analyser.frequencyBinCount);
            } catch (e) {
                console.warn('[SilenceDetector] AudioContext setup failed:', e);
            }
        };

        const intervalId = window.setInterval(() => {
            if (!ready.current || !video || video.paused || video.muted || video.volume === 0 || dismissed.current) {
                silentSecs.current = 0;
                return;
            }

            // Lazy setup — only after actual playback begins
            if (!ctxRef.current) setupGraph();

            const analyser = analyserRef.current;
            const buffer   = bufferRef.current;
            if (!analyser || !buffer) return;

            // Respect browser autoplay policy
            if (ctxRef.current?.state === 'suspended') {
                ctxRef.current.resume().catch(() => {});
                return;
            }

            (analyser as any).getByteTimeDomainData(buffer as any);

            // Root-mean-square of the waveform
            let sumSq = 0;
            for (const v of buffer) {
                const norm = (v - 128) / 128;
                sumSq += norm * norm;
            }
            const rms = Math.sqrt(sumSq / buffer.length);

            if (rms < minRmsLevel) {
                silentSecs.current += pollIntervalMs / 1000;
                if (silentSecs.current >= silenceThresholdSeconds && !dismissed.current) {
                    setSilenceDetected(true);
                }
            } else {
                silentSecs.current = 0;
                if (!dismissed.current) setSilenceDetected(false);
            }
        }, pollIntervalMs);

        return () => {
            clearTimeout(startTimer);
            clearInterval(intervalId);
        };
    }, [enabled, videoRef, silenceThresholdSeconds, minRmsLevel, pollIntervalMs, startDelayMs]);

    // Tear down AudioContext when component unmounts
    useEffect(() => {
        return () => {
            try { ctxRef.current?.close(); } catch (_) {}
            ctxRef.current    = null;
            analyserRef.current = null;
            bufferRef.current   = null;
        };
    }, []);

    return { silenceDetected, dismiss };
}
