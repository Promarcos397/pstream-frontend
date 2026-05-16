import { useRef, useCallback, useState } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { getCodecProfile, initCodecSupport, isBrowserSafeCodec } from '../utils/browserCodecSupport';

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
 * Architecture:
 * - Fetch MKV directly from AllDebrid CDN (browser can access, backend cannot)
 * - Use HTTP Range requests to get audio packets
 * - Decode AC3->PCM via ffmpeg.audio.wasm
 * - Feed PCM to Web Audio API
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
     *
     * NOW: Fetches directly from AllDebrid CDN (browser can access)
     * NO backend proxy needed - AllDebrid blocks server IPs (NO_SERVER)
     */
    const transcode = useCallback(async (
        sourceUrl: string,
        audioTrackIndex = 0,
        /** Override output codec — defaults to browser preference (Opus for Chrome, AAC for Safari) */
        forceOutputCodec?: 'aac' | 'opus',
    ): Promise<TranscodeResult> => {
        setStatus('transcoding');
        setProgress(0);

        // Use browser-preferred transcode target (Opus for Chrome/FF, AAC for Safari)
        const profile     = getCodecProfile();
        const outputCodec = forceOutputCodec ?? profile?.preferredTranscodeTarget ?? 'aac';
        const outputExt   = outputCodec === 'opus' ? 'ogg'                  : 'aac';
        const outputMime  = outputCodec === 'opus' ? 'audio/ogg; codecs=opus' : 'audio/aac';
        const ffmpegCodec = outputCodec === 'opus' ? 'libopus'              : 'aac';
        const bitrate     = outputCodec === 'opus' ? '128k'                 : '192k';

        const ffmpeg     = await loadFFmpeg();
        const inputName  = 'input.mkv';
        const outputName = `output.${outputExt}`;

        try {
            // DIRECT fetch from CDN - browser can access AllDebrid CDN
            // Server cannot (NO_SERVER error), so we fetch directly in browser
            console.log(`[AudioTranscoder] Fetching directly from CDN → output: ${outputCodec.toUpperCase()}...`);

            let fileData: Uint8Array;
            try {
                // Try direct fetch first (for AllDebrid CDN URLs)
                fileData = await fetchFile(sourceUrl);
            } catch {
                // Fallback: Try with range request for partial content
                console.log('[AudioTranscoder] Direct fetch failed, trying Range request...');
                const res = await fetch(sourceUrl, {
                    headers: { Range: 'bytes=0-10485760' } // First 10MB should contain audio
                });
                if (!res.ok && res.status !== 206) {
                    throw new Error(`Fetch failed with status ${res.status}`);
                }
                const buffer = await res.arrayBuffer();
                fileData = new Uint8Array(buffer);
            }

            await ffmpeg.writeFile(inputName, fileData);

            await ffmpeg.exec([
                '-i', inputName,
                '-map', `0:a:${audioTrackIndex}`,
                '-c:a', ffmpegCodec,
                '-b:a', bitrate,
                '-vn',
                outputName,
            ]);

            const data = await ffmpeg.readFile(outputName);
            let sourceBytes: Uint8Array;
            if (typeof data === 'string') {
                sourceBytes = new TextEncoder().encode(data);
            } else {
                sourceBytes = new Uint8Array(data);
            }
            const plainBuffer = new ArrayBuffer(sourceBytes.byteLength);
            new Uint8Array(plainBuffer).set(sourceBytes);
            const blob = new Blob([plainBuffer], { type: outputMime });
            const url  = URL.createObjectURL(blob);

            await ffmpeg.deleteFile(inputName);
            await ffmpeg.deleteFile(outputName);

            setStatus('ready');
            console.log(`[AudioTranscoder] ✅ Transcoding complete (${outputCodec.toUpperCase()})`);

            return { url, cleanup: () => URL.revokeObjectURL(url) };
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
 * Uses the dynamic browser profile when available; falls back to conservative static check.
 */
export function isAudioCodecSupported(codec: string): boolean {
    if (!codec) return true;
    return isBrowserSafeCodec(codec);
}
