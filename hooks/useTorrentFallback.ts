/**
 * useTorrentFallback — Silent torrent stream resolver for P-Stream.
 *
 * This hook implements the last-resort streaming pipeline:
 *   1. Regular providers fail 2 times (tracked by parent component)
 *   2. Parent calls resolve(imdbId, type, season?, episode?)
 *   3. Hook POSTs to /api/torrent/stream (login-gated on backend)
 *   4. Backend returns a streaming HTTP URL (byte-pipe from WebTorrent)
 *   5. URL is fed into existing HLS player — user never sees it happening
 *
 * Requirements:
 *   - User must be logged in (JWT passed in Authorization header)
 *   - imdbId must be in tt-prefixed format (e.g. "tt1375666")
 *
 * Usage:
 *   const { resolve, streamUrl, loading, error } = useTorrentFallback();
 *
 *   // In your error handler after 2 source failures:
 *   if (failCount >= 2 && user && imdbId) {
 *       resolve(imdbId, 'movie');
 *   }
 *
 *   // Then pass streamUrl to your video player
 */

import { useState, useCallback, useRef } from 'react';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://ibrahimar397-pstream-giga.hf.space';

type MediaType = 'movie' | 'tv' | 'film' | 'series';

interface TorrentFallbackState {
    streamUrl:  string | null;
    loading:    boolean;
    error:      string | null;
    seeders:    number | null;
    quality:    string | null;
}

interface ResolveFn {
    (
        imdbId:   string,
        type:     MediaType,
        season?:  number | string,
        episode?: number | string,
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

    const resolve: ResolveFn = useCallback(async (imdbId, type, season, episode, authToken) => {
        // Cancel any pending request
        if (abortRef.current) abortRef.current.abort();
        abortRef.current = new AbortController();

        setState({ streamUrl: null, loading: true, error: null, seeders: null, quality: null });

        try {
            // Step 1: Get sources list from Torrentio proxy
            const sourcesRes = await fetch(
                `${BACKEND_URL}/api/torrent/sources?imdbId=${imdbId}&type=${type}` +
                (season  ? `&season=${season}`   : '') +
                (episode ? `&episode=${episode}` : ''),
                {
                    headers: {
                        'Authorization': authToken ? `Bearer ${authToken}` : '',
                    },
                    signal: abortRef.current.signal,
                }
            );

            if (!sourcesRes.ok) {
                const err = await sourcesRes.json().catch(() => ({ error: 'Torrent sources unavailable' }));
                throw new Error(err.error || `HTTP ${sourcesRes.status}`);
            }

            const sourcesData = await sourcesRes.json();

            if (!sourcesData.streams?.length) {
                throw new Error('No torrent sources found for this title');
            }

            const best = sourcesData.streams[0];

            // Step 2: Build the streaming URL
            // The backend /api/torrent/stream accepts POST and pipes bytes back.
            // We construct a URL that the video player can range-request against.
            // Since video players need a GET URL (not a POST), we pass the magnet
            // as a query param to a dedicated GET streaming endpoint.
            //
            // IMPORTANT: For now we return the backend stream URL with token in header.
            // The HLS player (hls.js) supports custom headers via xhrSetup.
            const streamEndpoint = `${BACKEND_URL}/api/torrent/stream`;

            // We store the metadata and let the player component call the endpoint
            // directly with the POST body + auth header
            setState({
                streamUrl:  streamEndpoint,
                loading:    false,
                error:      null,
                seeders:    best.seeders,
                quality:    best.quality,
            });

            // Return the metadata needed to make the POST request
            return JSON.stringify({
                endpoint: streamEndpoint,
                body: {
                    imdbId,
                    type,
                    season:   season  ? parseInt(String(season))  : undefined,
                    episode:  episode ? parseInt(String(episode)) : undefined,
                    infoHash: best.infoHash,
                    fileIdx:  best.fileIdx,
                },
                quality:  best.quality,
                seeders:  best.seeders,
                title:    best.title,
            });

        } catch (err: any) {
            if (err.name === 'AbortError') return null;

            const msg = err.message || 'Torrent fallback failed';
            setState(prev => ({ ...prev, loading: false, error: msg }));
            console.warn('[TorrentFallback]', msg);
            return null;
        }
    }, []);

    const reset = useCallback(() => {
        if (abortRef.current) abortRef.current.abort();
        setState({ streamUrl: null, loading: false, error: null, seeders: null, quality: null });
    }, []);

    return {
        ...state,
        resolve,
        reset,
    };
}
