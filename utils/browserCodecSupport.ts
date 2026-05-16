/**
 * Browser Audio Codec Support Detection
 *
 * Builds an accurate per-browser profile using MediaCapabilities API + canPlayType().
 *
 * Patent context (why this matters):
 *   AC3  (Dolby Digital)      — patents expired 2017
 *   EAC3 (Dolby Digital Plus) — patents expired January 30, 2026
 *   DTS                       — still patent-protected
 *
 * Who can play what natively in a browser:
 *   Safari (Apple paid Dolby at OS level)       → AC3 ✅  EAC3 ✅
 *   Edge on Windows (inherits OS Dolby license) → AC3 ✅  EAC3 ✅
 *   Chrome everywhere (Google chose not to pay) → AC3 ❌  EAC3 ❌
 *   Firefox (non-profit, can't afford it)        → AC3 ❌  EAC3 ❌
 *   Samsung Internet on Android                  → AC3 ❌  EAC3 ❌
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

async function tryMediaCapabilities(contentType: string): Promise<boolean> {
    if (typeof navigator === 'undefined' || !('mediaCapabilities' in navigator)) return false;
    try {
        const r = await (navigator as any).mediaCapabilities.decodingInfo({
            type: 'file',
            audio: { contentType, samplerate: 48000, channels: 6 },
        });
        return !!r?.supported;
    } catch { return false; }
}

async function buildProfile(): Promise<AudioCapabilities> {
    const ua = navigator.userAgent;
    const isSafari  = /Safari/i.test(ua) && !/Chrome|Chromium/i.test(ua);
    const isEdgeWin = /Edg\//i.test(ua) && /Windows/i.test(ua);

    const canPlayAAC  = tryCanPlayType('audio/mp4; codecs="mp4a.40.2"') || tryCanPlayType('audio/aac');
    const canPlayMP3  = tryCanPlayType('audio/mpeg');
    const canPlayOpus = tryCanPlayType('audio/ogg; codecs="opus"') || tryCanPlayType('audio/webm; codecs="opus"');

    // AC3/EAC3: check both APIs — MediaCapabilities is more reliable for Dolby
    const [ac3Type, eac3Type, ac3Cap, eac3Cap, dtsType] = await Promise.all([
        Promise.resolve(tryCanPlayType('audio/ac3') || tryCanPlayType('audio/x-ac3')),
        Promise.resolve(tryCanPlayType('audio/eac3') || tryCanPlayType('audio/x-eac3')),
        tryMediaCapabilities('audio/mp4; codecs="ac-3"'),
        tryMediaCapabilities('audio/mp4; codecs="ec-3"'),
        Promise.resolve(tryCanPlayType('audio/x-dts')),
    ]);

    const canPlayAC3  = ac3Type || ac3Cap;
    const canPlayEAC3 = eac3Type || eac3Cap;
    const canPlayDTS  = dtsType;

    // isDolbyCapable: either detected via API OR we know it from UA heuristics.
    // UA heuristic is the fallback because some browsers lie in canPlayType for Dolby.
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
    };

    console.log('[CodecSupport] 🎵 Browser audio profile:', {
        AC3: canPlayAC3, EAC3: canPlayEAC3, DTS: canPlayDTS,
        AAC: canPlayAAC, Opus: canPlayOpus,
        Safari: isSafari, EdgeWin: isEdgeWin,
        transcodeTarget: profile.preferredTranscodeTarget,
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
