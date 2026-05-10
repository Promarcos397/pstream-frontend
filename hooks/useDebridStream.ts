/**
 * useDebridStream — AllDebrid stream resolver for P-Stream.
 *
 * Primary pipeline (fires on every content load):
 *   1. GET /api/torrent/sources → finds best magnet by seeders/quality
 *   2. GET /api/torrent/stream  → backend resolves via AllDebrid → direct CDN link
 *   3. streamUrl is fed directly into the video player (no P2P, no WebTorrent)
 *
 * Open to all users — no login required.
 * AllDebrid API key lives on the backend.
 */

import { useState, useCallback, useRef } from 'react';

const BACKEND_URL = (import.meta as any).env?.VITE_GIGA_BACKEND_URL || 'https://ibrahimar397-pstream-giga.hf.space';

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
        _unused?: string,  // kept for call-site compat (was authToken)
        title?:   string,
    ): Promise<string | null> => {
        if (abortRef.current) abortRef.current.abort();
        abortRef.current = new AbortController();

        setState({ streamUrl: null, loading: true, error: null, seeders: null, quality: null });

        try {
            // Step 1: find best torrent source
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

            // Step 2: build stream URL — backend resolves to AllDebrid CDN link
            const streamParams = new URLSearchParams({ infoHash: best.infoHash, imdbId, type, title: title || '' });
            if (season)               streamParams.set('season',  String(season));
            if (episode)              streamParams.set('episode', String(episode));
            if (best.fileIdx != null) streamParams.set('fileIdx', String(best.fileIdx));

            const streamUrl = `${BACKEND_URL}/api/torrent/stream?${streamParams}`;

            setState({ streamUrl, loading: false, error: null, seeders: best.seeders, quality: best.quality || null });
            return JSON.stringify({ streamUrl, quality: best.quality, seeders: best.seeders });

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
