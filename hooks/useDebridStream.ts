/**
 * useDebridStream — AllDebrid stream resolver via Cloudflare Worker.
 *
 * Pipeline:
 *   1. GET /api/torrent/sources (HF backend) → best magnet by seeders
 *   2. POST to Cloudflare Worker /resolve    → Worker calls AllDebrid securely
 *   3. streamUrl = final AllDebrid CDN URL   → fed directly to the video player
 *
 * The AllDebrid API key is stored as a Cloudflare Worker secret — never in the browser.
 * Requests use Cloudflare's stable IPs, avoiding AllDebrid's "new location" blocks.
 */

import { useState, useCallback, useRef } from 'react';

const BACKEND_URL  = (import.meta as any).env?.VITE_GIGA_BACKEND_URL   || 'https://ibrahimar397-pstream-giga.hf.space';
const WORKER_URL   = (import.meta as any).env?.VITE_DEBRID_WORKER_URL  || 'https://pstream-debrid.ibrahimar397.workers.dev';

type MediaType = 'movie' | 'tv';

interface DebridStreamState {
    streamUrl: string | null;
    loading:   boolean;
    error:     string | null;
    seeders:   number | null;
    quality:   string | null;
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
        if (abortRef.current) abortRef.current.abort();
        abortRef.current = new AbortController();

        setState({ streamUrl: null, loading: true, error: null, seeders: null, quality: null });

        try {
            // ── Step 1: Get best torrent source from our backend (Torrentio scrape) ──
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

            // ── Step 2: Resolve via Cloudflare Worker (key stays server-side) ──
            const workerRes = await fetch(`${WORKER_URL}/resolve`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                signal:  abortRef.current.signal,
                body:    JSON.stringify({
                    infoHash: best.infoHash,
                    fileIdx:  best.fileIdx ?? null,
                }),
            });

            if (!workerRes.ok) {
                const body = await workerRes.json().catch(() => ({}));
                throw new Error(body.error || `Worker HTTP ${workerRes.status}`);
            }

            const { url: finalUrl } = await workerRes.json();
            if (!finalUrl) throw new Error('Worker returned no URL');

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
