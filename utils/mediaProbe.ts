
/**
 * MediaProbe Utility
 * Extracts internal audio and subtitle tracks from MKV/MP4 files.
 * Fetches via the Giga backend proxy to bypass Debrid CDN CORS restrictions.
 */

const GIGA_BACKEND_URL = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_GIGA_BACKEND_URL)
    || 'https://ibrahimar397-pstream-giga.hf.space';

export interface InternalTrack {
    id: number;
    type: 'audio' | 'subtitle';
    codec: string;
    language?: string;
    name?: string;
    channels?: number;
    isDefault?: boolean;
}

/**
 * Fetches the first 2MB of a remote URL via the Giga backend (server-side, no CORS).
 */
async function fetchHeaderBytes(url: string): Promise<ArrayBuffer | null> {
    try {
        const probeUrl = `${GIGA_BACKEND_URL}/api/media-probe?url=${encodeURIComponent(url)}`;
        const response = await fetch(probeUrl);
        if (!response.ok) return null;
        return await response.arrayBuffer();
    } catch (e) {
        console.warn('[MediaProbe] Backend probe failed:', e);
        return null;
    }
}

/** 
 * Simple EBML (Matroska) parser to find tracks.
 * Reads the first 2MB of an MKV file to find the Tracks element.
 */
async function probeMKV(url: string, _headers: Record<string, string>): Promise<InternalTrack[]> {
    const tracks: InternalTrack[] = [];
    try {
        const buffer = await fetchHeaderBytes(url);
        if (!buffer) return [];
        const view = new DataView(buffer);
        let pos = 0;

        // Extremely simplified EBML scanner
        // We look for the Segment (0x18538067) and then Tracks (0x1654AE6B)
        while (pos < view.byteLength - 4) {
            const id = view.getUint32(pos);
            if (id === 0x1654AE6B) { // Tracks
                // Found tracks! Now we scan for TrackEntry (0xAE)
                pos += 4;
                const tracksLen = readVINT(view, pos);
                pos += tracksLen.width;
                const endPos = pos + tracksLen.value;

                while (pos < endPos && pos < view.byteLength) {
                    const entryId = view.getUint8(pos);
                    if (entryId === 0xAE) { // TrackEntry
                        const entryLen = readVINT(view, pos + 1);
                        const entryEnd = pos + 1 + entryLen.width + entryLen.value;
                        tracks.push(parseTrackEntry(view, pos + 1 + entryLen.width, entryEnd));
                        pos = entryEnd;
                    } else {
                        pos++;
                    }
                }
                break;
            }
            pos++;
        }
    } catch (e) {
        console.warn('[MediaProbe] MKV probe failed:', e);
    }
    return tracks;
}

/** Simple MP4 parser to find audio tracks */
async function probeMP4(url: string, _headers: Record<string, string>): Promise<InternalTrack[]> {
    const tracks: InternalTrack[] = [];
    try {
        const buffer = await fetchHeaderBytes(url);
        if (!buffer) return [];
        const view = new DataView(buffer);
        let pos = 0;

        // Search for 'moov' -> 'trak' -> 'mdia' -> 'hdlr' (to find type) -> 'stsd' (for codec)
        while (pos < view.byteLength - 8) {
            const size = view.getUint32(pos);
            const type = view.getUint32(pos + 4);
            
            if (type === 0x7472616b) { // 'trak'
                const trakEnd = pos + size;
                const track = parseMP4Track(view, pos + 8, trakEnd);
                if (track) tracks.push(track);
                pos = trakEnd;
            } else if (type === 0x6d6f6f76) { // 'moov'
                pos += 8;
            } else {
                pos += size || 1;
            }
        }
    } catch (e) {
        console.warn('[MediaProbe] MP4 probe failed:', e);
    }
    return tracks;
}

function parseTrackEntry(view: DataView, start: number, end: number): InternalTrack {
    let pos = start;
    const track: InternalTrack = { id: 0, type: 'audio', codec: 'unknown' };
    
    while (pos < end) {
        const id = readEBMLId(view, pos);
        pos += id.width;
        const len = readVINT(view, pos);
        pos += len.width;
        const valEnd = pos + len.value;

        if (id.value === 0xD7) track.id = view.getUint8(pos); // TrackNumber
        else if (id.value === 0x83) track.type = view.getUint8(pos) === 1 ? 'audio' : 'subtitle' as any; // TrackType
        else if (id.value === 0x86) track.codec = readString(view, pos, len.value); // CodecID
        else if (id.value === 0x22B59C) track.language = readString(view, pos, len.value); // Language
        else if (id.value === 0x536E) track.name = readString(view, pos, len.value); // Name
        
        pos = valEnd;
    }
    return track;
}

function parseMP4Track(view: DataView, start: number, end: number): InternalTrack | null {
    // Highly simplified: search for 'hdlr' for type
    let pos = start;
    let type: string | null = null;
    let trackId = 0;

    while (pos < end - 8) {
        const size = view.getUint32(pos);
        const atomType = view.getUint32(pos + 4);
        if (atomType === 0x6d646961) { // 'mdia'
            pos += 8;
        } else if (atomType === 0x68646c72) { // 'hdlr'
            const handler = view.getUint32(pos + 16);
            if (handler === 0x736f756e) type = 'audio';
            else if (handler === 0x73756274 || handler === 0x74657874) type = 'subtitle';
            pos += size;
        } else if (atomType === 0x746b6864) { // 'tkhd'
            trackId = view.getUint32(pos + 20);
            pos += size;
        } else {
            pos += size || 1;
        }
    }

    if (type) return { id: trackId, type: type as any, codec: 'mp4-native' };
    return null;
}

// --- EBML Helpers ---
function readVINT(view: DataView, pos: number): { value: number, width: number } {
    const firstByte = view.getUint8(pos);
    let width = 0;
    while (!(firstByte & (0x80 >> width)) && width < 8) width++;
    width++;
    let value = firstByte & (0xFF >> width);
    for (let i = 1; i < width; i++) {
        value = (value << 8) | view.getUint8(pos + i);
    }
    return { value, width };
}

function readEBMLId(view: DataView, pos: number): { value: number, width: number } {
    const firstByte = view.getUint8(pos);
    let width = 0;
    while (!(firstByte & (0x80 >> width)) && width < 8) width++;
    width++;
    let value = 0;
    for (let i = 0; i < width; i++) {
        value = (value << 8) | view.getUint8(pos + i);
    }
    return { value, width };
}

function readString(view: DataView, pos: number, len: number): string {
    let str = '';
    for (let i = 0; i < len; i++) {
        str += String.fromCharCode(view.getUint8(pos + i));
    }
    return str.replace(/\0/g, '');
}

export const MediaProbe = {
    probe: async (url: string, headers: Record<string, string> = {}): Promise<InternalTrack[]> => {
        const lowerUrl = url.toLowerCase();
        if (lowerUrl.includes('.mkv')) return probeMKV(url, headers);
        if (lowerUrl.includes('.mp4') || lowerUrl.includes('.m4v')) return probeMP4(url, headers);
        return [];
    }
};
