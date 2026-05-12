/**
 * PStream Service Worker — Transparent Proxy + MKV Track Probe
 *
 * For /sw-proxy?url=... requests:
 *  1. Fetches the real URL (SW is not subject to CORS)
 *  2. Tees the response body: one branch streams to the <video> element,
 *     the other branch reads the first 128KB to detect the audio codec via EBML.
 *  3. Posts { type: 'MKV_TRACKS', tracks: [...] } to all clients.
 */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    if (url.pathname === '/sw-proxy') {
        event.respondWith(handleProxy(event.request));
    }
});

async function handleProxy(request) {
    const url = new URL(request.url);
    const targetUrl = url.searchParams.get('url');
    if (!targetUrl) return new Response('Missing ?url=', { status: 400 });

    const isFirstChunk = !request.headers.get('Range') ||
        request.headers.get('Range') === 'bytes=0-';

    const upstreamHeaders = new Headers();
    const range = request.headers.get('Range');
    if (range) upstreamHeaders.set('Range', range);

    try {
        const upstream = await fetch(targetUrl, { headers: upstreamHeaders });

        const responseHeaders = new Headers(upstream.headers);
        responseHeaders.set('Access-Control-Allow-Origin', '*');
        responseHeaders.set('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges');

        const isMkv = targetUrl.toLowerCase().includes('.mkv') ||
            (upstream.headers.get('Content-Type') || '').includes('matroska');

        // Only probe on first request chunk (not seeks)
        if (isMkv && isFirstChunk && upstream.body) {
            const [videoStream, probeStream] = upstream.body.tee();

            // Read probe data in background — don't block the video stream
            readAndProbe(probeStream, targetUrl);

            return new Response(videoStream, {
                status: upstream.status,
                statusText: upstream.statusText,
                headers: responseHeaders,
            });
        }

        return new Response(upstream.body, {
            status: upstream.status,
            statusText: upstream.statusText,
            headers: responseHeaders,
        });
    } catch (err) {
        return new Response(`Proxy error: ${err.message}`, { status: 502 });
    }
}

async function readAndProbe(stream, sourceUrl) {
    try {
        const PROBE_BYTES = 256 * 1024; // Read up to 256KB to find Tracks element
        const reader = stream.getReader();
        const chunks = [];
        let totalRead = 0;

        while (totalRead < PROBE_BYTES) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            totalRead += value.byteLength;
        }

        // Cancel the rest — we don't need it
        reader.cancel().catch(() => {});

        // Combine chunks into one buffer
        const combined = new Uint8Array(totalRead);
        let offset = 0;
        for (const chunk of chunks) {
            combined.set(chunk, offset);
            offset += chunk.byteLength;
        }

        const tracks = parseMKVTracks(combined.buffer);

        // Broadcast to all page clients
        const clients = await self.clients.matchAll({ type: 'window' });
        for (const client of clients) {
            client.postMessage({ type: 'MKV_TRACKS', sourceUrl, tracks });
        }
    } catch (e) {
        console.warn('[SW] Probe error:', e.message);
    }
}

// ─── Minimal EBML Parser ────────────────────────────────────────────────────

function readVint(view, pos) {
    if (pos >= view.byteLength) return { value: 0, length: 1 };
    const first = view.getUint8(pos);
    let n = 1, mask = 0x80;
    while (n < 8 && !(first & mask)) { n++; mask >>= 1; }
    let value = first & (mask - 1);
    for (let i = 1; i < n; i++) {
        if (pos + i < view.byteLength) value = value * 256 + view.getUint8(pos + i);
    }
    return { value, length: n };
}

function readEBMLId(view, pos) {
    if (pos >= view.byteLength) return { id: 0, length: 1 };
    const first = view.getUint8(pos);
    let n = 1, mask = 0x80;
    while (n < 4 && !(first & mask)) { n++; mask >>= 1; }
    let id = 0;
    for (let i = 0; i < n; i++) {
        if (pos + i < view.byteLength) id = (id << 8) | view.getUint8(pos + i);
    }
    return { id: id >>> 0, length: n };
}

function readString(view, pos, len) {
    const bytes = new Uint8Array(view.buffer, pos, Math.min(len, view.byteLength - pos));
    return new TextDecoder().decode(bytes).replace(/\0/g, '').trim();
}

// EBML element IDs we care about
const ID_TRACKS      = 0x1654AE6B;
const ID_TRACK_ENTRY = 0x000000AE;
const ID_TRACK_TYPE  = 0x00000083;
const ID_CODEC_ID    = 0x00000086;
const ID_LANGUAGE    = 0x0022B59C;
const ID_FLAG_DEF    = 0x00000088;
const ID_TRACK_NUM   = 0x000000D7;

function parseMKVTracks(buffer) {
    const view = new DataView(buffer);
    const limit = buffer.byteLength;
    const tracks = [];
    let pos = 0;

    while (pos < limit - 8) {
        const { id, length: idLen } = readEBMLId(view, pos);
        if (idLen === 0) break;
        pos += idLen;

        const { value: size, length: sizeLen } = readVint(view, pos);
        pos += sizeLen;

        if (id === ID_TRACKS) {
            parseTrackEntries(view, pos, Math.min(size, limit - pos), tracks);
            break; // Found what we need
        }

        // Skip giant elements (Clusters start after Tracks, no need to parse)
        if (size > 50 * 1024 * 1024 || pos + size > limit) break;
        pos += size;
    }

    return tracks;
}

function parseTrackEntries(view, start, size, tracks) {
    let pos = start;
    const end = Math.min(start + size, view.byteLength);

    while (pos < end - 4) {
        const { id, length: idLen } = readEBMLId(view, pos);
        pos += idLen;
        const { value: elemSize, length: sizeLen } = readVint(view, pos);
        pos += sizeLen;

        if (id === ID_TRACK_ENTRY) {
            const track = parseOneTrack(view, pos, Math.min(elemSize, end - pos));
            if (track) tracks.push(track);
        }

        pos += elemSize;
    }
}

function parseOneTrack(view, start, size) {
    let pos = start;
    const end = Math.min(start + size, view.byteLength);
    let trackNum = 0, trackType = 0, codecId = '', language = 'und', flagDefault = false;

    while (pos < end - 2) {
        const { id, length: idLen } = readEBMLId(view, pos);
        pos += idLen;
        const { value: elemSize, length: sizeLen } = readVint(view, pos);
        pos += sizeLen;

        if (pos + elemSize > view.byteLength) break;

        if      (id === ID_TRACK_NUM)  { const v = readVint(view, pos); trackNum = v.value; }
        else if (id === ID_TRACK_TYPE) { trackType = view.getUint8(pos); }
        else if (id === ID_CODEC_ID)   { codecId = readString(view, pos, elemSize); }
        else if (id === ID_LANGUAGE)   { language = readString(view, pos, elemSize) || 'und'; }
        else if (id === ID_FLAG_DEF)   { flagDefault = view.getUint8(pos) !== 0; }

        pos += elemSize;
    }

    if (trackType === 1) return { id: trackNum, type: 'video', codec: codecId, language, isDefault: flagDefault };
    if (trackType === 2) return { id: trackNum, type: 'audio', codec: codecId, language, isDefault: flagDefault };
    if (trackType === 17) return { id: trackNum, type: 'subtitle', codec: codecId, language, isDefault: flagDefault };
    return null;
}
