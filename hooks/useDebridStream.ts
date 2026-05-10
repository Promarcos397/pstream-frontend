/**
 * useDebridStream — AllDebrid stream resolver for P-Stream.
 *
 * Primary pipeline (fires on every content load):
 *   1. GET /api/torrent/sources → finds best magnet by seeders/quality
 *   2. GET /api/torrent/resolve → backend resolves via AllDebrid → returns { url: cdnUrl }
 *   3. streamUrl is the FINAL AllDebrid CDN URL — loaded directly by the video player
 *
 * Using /resolve instead of /stream avoids CORS issues from following a cross-origin
 * 302 redirect to an AllDebrid CDN host inside a fetch() call.
 *
 * Open to all users — no login required. AllDebrid API key lives on the backend.
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
        _unused?: string,  // kept for call-site compat
        title?:   string,
    ): Promise<string | null> => {
        if (abortRef.current) abortRef.current.abort();
        abortRef.current = new AbortController();

        setState({ streamUrl: null, loading: true, error: null, seeders: null, quality: null });

        try {
            // Step 1: find best torrent source by seeder count
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

            // Step 2: resolve to final AllDebrid CDN URL via /api/torrent/resolve (returns JSON, not a redirect).
            // This pre-validates that AllDebrid has the magnet cached before we hand the URL to the player.
            const resolveParams = new URLSearchParams({ infoHash: best.infoHash, imdbId, type, title: title || '' });
            if (season)               resolveParams.set('season',  String(season));
            if (episode)              resolveParams.set('episode', String(episode));
            if (best.fileIdx != null) resolveParams.set('fileIdx', String(best.fileIdx));

            const resolveRes = await fetch(`${BACKEND_URL}/api/torrent/resolve?${resolveParams}`, {
                signal: abortRef.current.signal,
            });

            if (!resolveRes.ok) {
                const body = await resolveRes.json().catch(() => ({}));
                throw new Error(body.error || `Resolve HTTP ${resolveRes.status}`);
            }

            const { url: finalUrl } = await resolveRes.json();
            if (!finalUrl) throw new Error('No CDN URL returned from backend');

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
