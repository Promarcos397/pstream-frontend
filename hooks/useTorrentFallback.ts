/**
 * useTorrentFallback — Silent torrent stream resolver for P-Stream.
 *
 * This hook implements the last-resort streaming pipeline:
 *   1. Regular providers fail (tracked by VideoPlayer)
 *   2. VideoPlayer calls resolve(imdbId, type, season?, episode?, token)
 *   3. Hook GETs /api/torrent/sources (Torrentio proxy, auth-gated)
 *   4. Picks best stream by seeder count
 *   5. Builds a GET streaming URL with infoHash + token query params
 *   6. streamUrl is fed into the existing video player — user never sees it
 *
 * Requirements:
 *   - User must be logged in (JWT passed in Authorization header)
 *   - imdbId in tt-prefixed format preferred (e.g. "tt1375666")
 */

import { useState, useCallback, useRef } from 'react';

const BACKEND_URL = (import.meta as any).env?.VITE_GIGA_BACKEND_URL || 'https://ibrahimar397-pstream-giga.hf.space';

type MediaType = 'movie' | 'tv';

interface TorrentFallbackState {
    streamUrl:  string | null;   // full GET URL ready for the video player
    loading:    boolean;
    error:      string | null;
    seeders:    number | null;
    quality:    string | null;
}

interface ResolveFn {
    (
        imdbId:    string,
        type:      MediaType,
        season?:   number,
        episode?:  number,
        authToken?: string,
    ): Promise<string | null>;
}

export function useTorrentFallback() {
    const [state, setState] = useState<TorrentFallbackState>({
        streamUrl: null,
        loading:   false,
        error:     null,
        seeders:   null,
        quality:   null,
    });

    const abortRef = useRef<AbortController | null>(null);
    // Store auth token so the player can refresh the URL if needed
    const tokenRef = useRef<string>('');

    const resolve: ResolveFn = useCallback(async (imdbId, type, season, episode, authToken) => {
        // Cancel any in-flight request
        if (abortRef.current) abortRef.current.abort();
        abortRef.current = new AbortController();
        tokenRef.current = authToken || '';

        setState({ streamUrl: null, loading: true, error: null, seeders: null, quality: null });

        try {
            // Step 1: Fetch Torrentio source list (auth-gated endpoint on our backend)
            const params = new URLSearchParams({ imdbId, type });
            if (season)  params.set('season',  String(season));
            if (episode) params.set('episode', String(episode));

            const sourcesRes = await fetch(`${BACKEND_URL}/api/torrent/sources?${params}`, {
                headers: { 'Authorization': authToken ? `Bearer ${authToken}` : '' },
                signal: abortRef.current.signal,
            });

            if (!sourcesRes.ok) {
                const body = await sourcesRes.json().catch(() => ({}));
                throw new Error(body.error || `Torrent sources: HTTP ${sourcesRes.status}`);
            }

            const { streams } = await sourcesRes.json();
            if (!streams?.length) throw new Error('No torrent sources found for this title');

            // Best source = highest seeder count
            const best = streams[0];
            console.log(`[TorrentFallback] ✅ Best: ${best.quality} | ${best.seeders} seeders | hash=${best.infoHash}`);

            // Step 2: Build a GET streaming URL.
            // Backend /api/torrent/stream accepts GET with query params (infoHash, token).
            // Range requests work because the backend sets Content-Range headers.
            const streamParams = new URLSearchParams({
                infoHash: best.infoHash,
                imdbId,
                type,
                token: authToken || '',
            });
            if (season)       streamParams.set('season',  String(season));
            if (episode)      streamParams.set('episode', String(episode));
            if (best.fileIdx != null) streamParams.set('fileIdx', String(best.fileIdx));

            const streamUrl = `${BACKEND_URL}/api/torrent/stream?${streamParams}`;

            setState({
                streamUrl,
                loading:  false,
                error:    null,
                seeders:  best.seeders,
                quality:  best.quality || null,
            });

            return JSON.stringify({ streamUrl, quality: best.quality, seeders: best.seeders });

        } catch (err: any) {
            if (err.name === 'AbortError') return null;

            const msg = err.message || 'Torrent fallback failed';
            setState(prev => ({ ...prev, loading: false, error: msg }));
            console.warn('[TorrentFallback] ❌', msg);
            return null;
        }
    }, []);

    const reset = useCallback(() => {
        if (abortRef.current) abortRef.current.abort();
        tokenRef.current = '';
        setState({ streamUrl: null, loading: false, error: null, seeders: null, quality: null });
    }, []);

    return { ...state, resolve, reset };
}
