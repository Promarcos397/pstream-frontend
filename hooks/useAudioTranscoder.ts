import { useRef, useCallback, useState } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

const FFMPEG_BASE_URL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';

export type TranscodeStatus = 'idle' | 'loading' | 'transcoding' | 'ready' | 'error';

interface TranscodeResult {
    url: string;      // Object URL pointing to the transcoded audio as AAC
    cleanup: () => void;
}

/**
 * useAudioTranscoder
 *
 * Uses ffmpeg.wasm to decode unsupported audio (AC3, DTS, TrueHD, E-AC3)
 * into AAC entirely in the browser — zero server transcoding.
 *
 * Requirements (handled by vite.config.ts):
 *   Cross-Origin-Opener-Policy: same-origin
 *   Cross-Origin-Embedder-Policy: require-corp
 */
export function useAudioTranscoder() {
    const ffmpegRef = useRef<FFmpeg | null>(null);
    const [status, setStatus] = useState<TranscodeStatus>('idle');
    const [progress, setProgress] = useState(0);
    const loadedRef = useRef(false);

    /** Load ffmpeg core from CDN (lazy, only once) */
    const loadFFmpeg = useCallback(async (): Promise<FFmpeg> => {
        if (ffmpegRef.current && loadedRef.current) return ffmpegRef.current;

        setStatus('loading');
        const ffmpeg = new FFmpeg();
        ffmpegRef.current = ffmpeg;

        ffmpeg.on('progress', ({ progress: p }) => {
            setProgress(Math.round(p * 100));
        });
        ffmpeg.on('log', ({ message }) => {
            // Only log errors to keep console clean
            if (message.includes('Error') || message.includes('error')) {
                console.warn('[ffmpeg]', message);
            }
        });

        await ffmpeg.load({
            coreURL: await toBlobURL(`${FFMPEG_BASE_URL}/ffmpeg-core.js`, 'text/javascript'),
            wasmURL: await toBlobURL(`${FFMPEG_BASE_URL}/ffmpeg-core.wasm`, 'application/wasm'),
        });

        loadedRef.current = true;
        return ffmpeg;
    }, []);

    /**
     * Transcode a remote URL's audio to AAC.
     * Returns a blob URL ready to be used as <audio src="...">
     * or fed into MediaSource.
     */
    const transcode = useCallback(async (
        sourceUrl: string,
        audioTrackIndex = 0,
    ): Promise<TranscodeResult> => {
        setStatus('transcoding');
        setProgress(0);

        const ffmpeg = await loadFFmpeg();
        const inputName = 'input.mkv';
        const outputName = 'output.aac';

        try {
            const gigaBackend = import.meta.env.VITE_GIGA_BACKEND_URL || 'https://ibrahimar397-pstream-giga.hf.space';

            // Use /api/media-probe for the first 2MB (fast, enough for audio track headers)
            // Fall back to /proxy/stream for full file if probe doesn't have enough data
            const probeUrl = `${gigaBackend}/api/media-probe?url=${encodeURIComponent(sourceUrl)}`;
            console.log('[AudioTranscoder] Fetching via backend probe...');

            let fileData: Uint8Array;
            try {
                fileData = await fetchFile(probeUrl);
            } catch {
                // Probe failed (Debrid may block HF) — try full stream proxy
                const streamUrl = `${gigaBackend}/proxy/stream?url=${encodeURIComponent(sourceUrl)}`;
                console.log('[AudioTranscoder] Probe failed, trying stream proxy...');
                fileData = await fetchFile(streamUrl);
            }

            await ffmpeg.writeFile(inputName, fileData);

            // -map 0:a:{audioTrackIndex} selects the specific audio track
            // -c:a aac converts to AAC (universally supported)
            // -vn drops video (audio only output)
            // -b:a 192k good quality AAC
            await ffmpeg.exec([
                '-i', inputName,
                '-map', `0:a:${audioTrackIndex}`,
                '-c:a', 'aac',
                '-b:a', '192k',
                '-vn',
                outputName,
            ]);

            const data = await ffmpeg.readFile(outputName);
            // FileData is Uint8Array | string — handle both without unsafe casts.
            let sourceBytes: Uint8Array;
            if (typeof data === 'string') {
                sourceBytes = new TextEncoder().encode(data);
            } else {
                sourceBytes = new Uint8Array(data);
            }
            // Allocate a plain ArrayBuffer (not SharedArrayBuffer) so Blob is happy
            const plainBuffer = new ArrayBuffer(sourceBytes.byteLength);
            new Uint8Array(plainBuffer).set(sourceBytes);
            const blob = new Blob([plainBuffer], { type: 'audio/aac' });
            const url = URL.createObjectURL(blob);

            // Cleanup temp files from ffmpeg virtual FS
            await ffmpeg.deleteFile(inputName);
            await ffmpeg.deleteFile(outputName);

            setStatus('ready');
            console.log('[AudioTranscoder] ✅ Transcoding complete');

            return {
                url,
                cleanup: () => URL.revokeObjectURL(url),
            };
        } catch (err) {
            setStatus('error');
            console.error('[AudioTranscoder] ❌ Failed:', err);
            throw err;
        }
    }, [loadFFmpeg]);

    const reset = useCallback(() => {
        setStatus('idle');
        setProgress(0);
    }, []);

    return { transcode, status, progress, reset };
}

/**
 * isAudioCodecSupported — determine if the browser can natively play this codec.
 * Exported here since it's tightly coupled to the transcoding decision.
 */
export function isAudioCodecSupported(codec: string): boolean {
    if (!codec) return true;
    const c = codec.toUpperCase();
    // Supported natively by Chrome/Firefox/Safari
    if (c.includes('AAC') || c.includes('MP3') || c.includes('OPUS') || c.includes('VORBIS')) return true;
    if (['A_AAC', 'A_MPEG/L3', 'A_OPUS', 'A_VORBIS', 'MP4-NATIVE'].includes(c)) return true;
    // Unsupported — needs ffmpeg.wasm
    if (c.includes('AC3') || c.includes('DTS') || c.includes('TRUEHD') || c.includes('EAC3')) return false;
    // Unknown — let the browser try
    return true;
}
