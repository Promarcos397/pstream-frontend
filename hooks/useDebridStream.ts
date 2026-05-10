/**
 * useDebridStream — AllDebrid stream resolver (browser-direct).
 *
 * Pipeline:
 *   1. GET /api/torrent/sources (HF backend) → best magnet by seeders
 *   2. GET api.alldebrid.com/v4/magnet/instant (browser → AllDebrid directly)
 *      → uses the user's residential IP, which AllDebrid never blocks
 *   3. streamUrl = final AllDebrid CDN URL → fed directly to the video player
 *
 * The API key is in VITE_ALLDEBRID_KEY (Cloudflare Pages env var).
 * It's in the bundle but only allows magnet resolution — regenerate if abused.
 */

import { useState, useCallback, useRef } from 'react';

const BACKEND_URL   = (import.meta as any).env?.VITE_GIGA_BACKEND_URL || 'https://ibrahimar397-pstream-giga.hf.space';
const ALLDEBRID_KEY = (import.meta as any).env?.VITE_ALLDEBRID_KEY   || '';
const ALLDEBRID_API = 'https://api.alldebrid.com/v4';
const AGENT         = 'pstream';

const TRACKERS = [
    'udp://open.demonii.com:1337',
    'udp://tracker.openbittorrent.com:80',
    'udp://tracker.opentrackr.org:1337',
    'udp://tracker.coppersurfer.tk:6969',
].map(t => `tr=${encodeURIComponent(t)}`).join('&');

type MediaType = 'movie' | 'tv';

interface DebridStreamState {
    streamUrl: string | null;
    loading:   boolean;
    error:     string | null;
    seeders:   number | null;
    quality:   string | null;
}

/**
 * Recursively find the best video file URL in AllDebrid's nested file structure.
 * Files are: { n, s, l } or { n, files: [...] }
 */
function findBestFileUrl(files: any[], targetIdx: number | null = null): string | null {
    const flat: { name: string; size: number; url: string }[] = [];

    function flatten(items: any[]) {
        for (const item of items || []) {
            if (item.l) {
                flat.push({ name: item.n || '', size: item.s || 0, url: item.l });
            } else if (item.files) {
                flatten(item.files);
            }
        }
    }

    flatten(files);
    if (!flat.length) return null;

    if (targetIdx != null && flat[targetIdx]) return flat[targetIdx].url;

    // Largest file = main video (not a sample/subtitle)
    flat.sort((a, b) => b.size - a.size);
    return flat[0].url;
}

export function useDebridStream() {
    const [state, setState] = useState<DebridStreamState>({
        streamUrl: null,
        loading:   false,
        error:     null,
        seeders:   null,
        quality:   null,
    });

    const abortRef = useRef<AbortController | null>(null);

    const resolve = useCallback(async (
        imdbId:   string,
        type:     MediaType,
        season?:  number,
        episode?: number,
        _unused?: string,
        title?:   string,
    ): Promise<string | null> => {
        if (!ALLDEBRID_KEY) {
            console.warn('[DebridStream] No VITE_ALLDEBRID_KEY set — skipping');
            return null;
        }

        if (abortRef.current) abortRef.current.abort();
        abortRef.current = new AbortController();

        setState({ streamUrl: null, loading: true, error: null, seeders: null, quality: null });

        try {
            // ── Step 1: Get best torrent source (Torrentio via backend) ──────────
            const params = new URLSearchParams({ imdbId, type });
            if (season)  params.set('season',  String(season));
            if (episode) params.set('episode', String(episode));
            if (title)   params.set('title',   title);

            const sourcesRes = await fetch(`${BACKEND_URL}/api/torrent/sources?${params}`, {
                signal: abortRef.current.signal,
            });

            if (!sourcesRes.ok) {
                const body = await sourcesRes.json().catch(() => ({}));
                throw new Error(body.error || `Sources HTTP ${sourcesRes.status}`);
            }

            const { streams } = await sourcesRes.json();
            if (!streams?.length) throw new Error('No torrent sources found');

            const best = streams[0];
            console.log(`[DebridStream] ✅ Best: ${best.quality} | ${best.seeders} seeders | ${best.infoHash}`);

            // ── Step 2: Check AllDebrid instant cache (browser → AllDebrid) ──────
            // Browser uses residential IP → AllDebrid never blocks it
            const magnet = `magnet:?xt=urn:btih:${best.infoHash}&${TRACKERS}`;
            const instantUrl = `${ALLDEBRID_API}/magnet/instant?agent=${AGENT}&apikey=${ALLDEBRID_KEY}&magnets[]=${encodeURIComponent(magnet)}`;

            const instantRes = await fetch(instantUrl, { signal: abortRef.current.signal });
            const instantData = await instantRes.json();

            if (instantData?.status !== 'success') {
                const msg = instantData?.error?.message || 'AllDebrid API error';
                throw new Error(msg);
            }

            const magnetInfo = instantData?.data?.magnets?.[0];

            if (!magnetInfo?.instant) {
                // Submit for background caching, then fall back to extractors
                fetch(`${ALLDEBRID_API}/magnet/upload?agent=${AGENT}&apikey=${ALLDEBRID_KEY}&magnets[]=${encodeURIComponent(magnet)}`)
                    .catch(() => {});
                throw new Error('Not cached yet — submitted. Try again in a moment.');
            }

            // ── Step 3: Extract the best file URL ────────────────────────────────
            const finalUrl = findBestFileUrl(magnetInfo.files, best.fileIdx ?? null);
            if (!finalUrl) throw new Error('No playable file found in cached torrent');

            console.log(`[DebridStream] ✅ CDN URL: ${finalUrl.substring(0, 80)}...`);
            setState({ streamUrl: finalUrl, loading: false, error: null, seeders: best.seeders, quality: best.quality || null });
            return JSON.stringify({ streamUrl: finalUrl, quality: best.quality, seeders: best.seeders });

        } catch (err: any) {
            if (err.name === 'AbortError') return null;
            const msg = err.message || 'AllDebrid resolution failed';
            setState(prev => ({ ...prev, loading: false, error: msg }));
            console.warn('[DebridStream] ❌', msg);
            return null;
        }
    }, []);

    const reset = useCallback(() => {
        if (abortRef.current) abortRef.current.abort();
        setState({ streamUrl: null, loading: false, error: null, seeders: null, quality: null });
    }, []);

    return { ...state, resolve, reset };
}
