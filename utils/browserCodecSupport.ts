/**
 * Browser Codec Support Detection (Video + Audio)
 *
 * Builds an accurate per-browser profile using MediaCapabilities API + canPlayType().
 *
 * Audio patent context:
 *   AC3  (Dolby Digital)      — patents expired 2017
 *   EAC3 (Dolby Digital Plus) — patents expired January 30, 2026
 *   DTS                       — still patent-protected
 *
 * Video hardware decode context:
 *   H.264/AVC  — hardware-accelerated on every modern device/browser
 *   H.265/HEVC — hardware-accelerated only on:
 *                  Safari/macOS+iOS (Apple Silicon + A/M chips)
 *                  Edge/Windows (via OS HEVC codec / HEVC Video Extensions)
 *                  NOT hardware-accelerated in Chrome on most desktops
 *                  → software-decoding HEVC = CPU spike, lag, dropped frames
 */

export interface AudioCapabilities {
    canPlayAAC: boolean;
    canPlayMP3: boolean;
    canPlayOpus: boolean;
    canPlayAC3: boolean;
    canPlayEAC3: boolean;
    canPlayDTS: boolean;
    /** True when this browser can play Dolby formats natively (Safari / Edge-Win) */
    isDolbyCapable: boolean;
    /**
     * Opus for Chrome/Firefox (royalty-free, better quality at same bitrate, native).
     * AAC for Safari (no Opus support / degraded on older Safari).
     */
    preferredTranscodeTarget: 'opus' | 'aac';
    /** EBML A_* codec IDs this browser can play without transcoding */
    safeEbmlCodecs: Set<string>;
    /**
     * True when MediaCapabilities reports smooth (hardware-accelerated) HEVC decode.
     * When false, HEVC/x265 sources are deprioritised to avoid software-decode lag.
     */
    canHWDecodeHEVC: boolean;
    /** True when MediaCapabilities reports smooth (hardware-accelerated) H.264 decode. */
    canHWDecodeH264: boolean;
}

let _profile: AudioCapabilities | null = null;
let _profilePromise: Promise<AudioCapabilities> | null = null;

function tryCanPlayType(mime: string): boolean {
    try {
        const v = document.createElement('video');
        const r = v.canPlayType(mime);
        return r === 'probably' || r === 'maybe';
    } catch { return false; }
}

async function tryAudioMediaCapabilities(contentType: string): Promise<boolean> {
    if (typeof navigator === 'undefined' || !('mediaCapabilities' in navigator)) return false;
    try {
        const r = await (navigator as any).mediaCapabilities.decodingInfo({
            type: 'file',
            audio: { contentType, samplerate: 48000, channels: 6 },
        });
        return !!r?.supported;
    } catch { return false; }
}

/**
 * Check if the browser can hardware-decode a given video codec at 1080p 10Mbps 24fps.
 * Returns true only when the API reports supported=true AND smooth=true.
 * smooth=true is the browser's signal that hardware acceleration is available.
 */
async function tryVideoHWDecode(contentType: string): Promise<boolean> {
    if (typeof navigator === 'undefined' || !('mediaCapabilities' in navigator)) return false;
    try {
        const r = await (navigator as any).mediaCapabilities.decodingInfo({
            type: 'file',
            video: {
                contentType,
                width: 1920,
                height: 1080,
                bitrate: 10_000_000,
                framerate: 24,
            },
        });
        return !!r?.supported && !!r?.smooth;
    } catch { return false; }
}

async function buildProfile(): Promise<AudioCapabilities> {
    const ua = navigator.userAgent;
    const isSafari  = /Safari/i.test(ua) && !/Chrome|Chromium/i.test(ua);
    const isEdgeWin = /Edg\//i.test(ua) && /Windows/i.test(ua);

    const canPlayAAC  = tryCanPlayType('audio/mp4; codecs="mp4a.40.2"') || tryCanPlayType('audio/aac');
    const canPlayMP3  = tryCanPlayType('audio/mpeg');
    const canPlayOpus = tryCanPlayType('audio/ogg; codecs="opus"') || tryCanPlayType('audio/webm; codecs="opus"');

    const [
        ac3Type, eac3Type, ac3Cap, eac3Cap, dtsType,
        hevcHvc1, hevcHev1, h264Smooth,
    ] = await Promise.all([
        // Audio
        Promise.resolve(tryCanPlayType('audio/ac3') || tryCanPlayType('audio/x-ac3')),
        Promise.resolve(tryCanPlayType('audio/eac3') || tryCanPlayType('audio/x-eac3')),
        tryAudioMediaCapabilities('audio/mp4; codecs="ac-3"'),
        tryAudioMediaCapabilities('audio/mp4; codecs="ec-3"'),
        Promise.resolve(tryCanPlayType('audio/x-dts')),
        // Video HEVC — two codec string variants used by different browsers/containers
        tryVideoHWDecode('video/mp4; codecs="hvc1.1.6.L93.B0"'),
        tryVideoHWDecode('video/mp4; codecs="hev1.1.6.L93.B0"'),
        // Video H.264 baseline reference
        tryVideoHWDecode('video/mp4; codecs="avc1.640028"'),
    ]);

    const canPlayAC3     = ac3Type || ac3Cap;
    const canPlayEAC3    = eac3Type || eac3Cap;
    const canPlayDTS     = dtsType;
    const canHWDecodeHEVC = hevcHvc1 || hevcHev1;
    const canHWDecodeH264 = h264Smooth;

    const isDolbyCapable = canPlayAC3 || canPlayEAC3 || isSafari || isEdgeWin;

    const safeEbmlCodecs = new Set<string>([
        'A_AAC', 'A_OPUS', 'A_VORBIS', 'A_MPEG/L3', 'A_MPEG/L2', 'A_MPEG/L1',
    ]);
    if (canPlayAC3)  safeEbmlCodecs.add('A_AC3');
    if (canPlayEAC3) { safeEbmlCodecs.add('A_EAC3'); safeEbmlCodecs.add('A_AC3/EAC3'); }
    if (canPlayDTS)  { safeEbmlCodecs.add('A_DTS'); safeEbmlCodecs.add('A_DTS/MA'); safeEbmlCodecs.add('A_DTS/ES'); }

    const profile: AudioCapabilities = {
        canPlayAAC,
        canPlayMP3,
        canPlayOpus,
        canPlayAC3,
        canPlayEAC3,
        canPlayDTS,
        isDolbyCapable,
        preferredTranscodeTarget: isDolbyCapable ? 'aac' : 'opus',
        safeEbmlCodecs,
        canHWDecodeHEVC,
        canHWDecodeH264,
    };

    console.log('[CodecSupport] 🎵 Browser codec profile:', {
        AC3: canPlayAC3, EAC3: canPlayEAC3, DTS: canPlayDTS,
        AAC: canPlayAAC, Opus: canPlayOpus,
        Safari: isSafari, EdgeWin: isEdgeWin,
        transcodeTarget: profile.preferredTranscodeTarget,
        'HW HEVC': canHWDecodeHEVC,
        'HW H264': canHWDecodeH264,
    });

    return profile;
}

/**
 * Kick off codec detection (async, cached). Safe to call multiple times.
 * Call early (e.g. in App.tsx) to warm the cache before it's needed.
 */
export function initCodecSupport(): Promise<AudioCapabilities> {
    if (_profile) return Promise.resolve(_profile);
    if (_profilePromise) return _profilePromise;
    _profilePromise = buildProfile().then(p => { _profile = p; return p; });
    return _profilePromise;
}

/** Synchronous — returns null if initCodecSupport() hasn't resolved yet */
export function getCodecProfile(): AudioCapabilities | null { return _profile; }

/**
 * Can this browser natively play the given EBML A_* codec ID?
 * Conservative fallback (AAC-only) before initCodecSupport() resolves.
 */
export function isBrowserSafeCodec(ebmlCodecId: string): boolean {
    const id = ebmlCodecId.toUpperCase();
    if (_profile) return _profile.safeEbmlCodecs.has(id);
    const defaultSafe = new Set(['A_AAC', 'A_OPUS', 'A_VORBIS', 'A_MPEG/L3', 'A_MPEG/L2', 'A_MPEG/L1']);
    return defaultSafe.has(id);
}
