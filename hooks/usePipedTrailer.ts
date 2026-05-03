/**
 * hooks/usePipedTrailer.ts
 * ──────────────────────────
 * Resolves a trailer stream in two steps:
 *
 *  Step 1 — ID resolution (giga backend /trailer/resolve)
 *    yt-dlp searches YouTube with 4K-first scoring.
 *    TMDB IDs are passed as fallback candidates (not trusted blindly).
 *    Returns the best scored video ID.
 *
 *  Step 2 — Stream resolution (Piped CDN)
 *    Given the video ID, fetch a DASH/HLS manifest from Piped public instances.
 *    Piped delivers the bytes — no YouTube branding, no IP-lock.
 */

import { useState, useEffect, useRef } from 'react';
import { getPipedStream, PipedStream } from '../services/PipedService';
import { fetchTrailers } from '../services/trailers';

const GIGA_BACKEND = import.meta.env.VITE_GIGA_BACKEND_URL || '';

export interface PipedTrailerResult {
  streamUrl:   string | null;
  isDASH:      boolean;
  isHLS:       boolean;
  subtitleUrl: string | null;
  videoId:     string | null;
  loading:     boolean;
  error:       string | null;
}

const EMPTY: PipedTrailerResult = {
  streamUrl: null, isDASH: false, isHLS: false,
  subtitleUrl: null, videoId: null, loading: false, error: null,
};

// Module-level caches — survive re-renders and modal re-opens
const _resolved  = new Map<string, PipedTrailerResult>();   // final result
const _inflight  = new Map<string, Promise<PipedTrailerResult>>(); // dedup parallel calls

async function resolveTrailer(
  tmdbId:    number | string,
  title:     string,
  year:      string,
  mediaType: 'movie' | 'tv',
): Promise<PipedTrailerResult> {
  const key = `${mediaType}:${tmdbId}`;
  if (_resolved.has(key))  return _resolved.get(key)!;
  if (_inflight.has(key))  return _inflight.get(key)!;

  const promise = (async (): Promise<PipedTrailerResult> => {
    try {
      // Step 1a: get TMDB IDs in parallel (used as fallback candidates only)
      const tmdbIdsPromise = fetchTrailers(tmdbId, mediaType).catch(() => [] as string[]);

      // Step 1b: call giga backend to resolve the best video ID
      // Uses yt-dlp: searches "title year 4K trailer" first, then "official trailer"
      let videoId: string | null = null;

      if (GIGA_BACKEND) {
        try {
          const tmdbIds = await tmdbIdsPromise;
          const params = new URLSearchParams({
            title,
            year,
            type: mediaType,
            ...(tmdbIds.length ? { tmdbIds: tmdbIds.join(',') } : {}),
          });
          const res = await fetch(`${GIGA_BACKEND}/trailer/resolve?${params}`, {
            signal: AbortSignal.timeout(25000), // yt-dlp can be slow
          });
          if (res.ok) {
            const data = await res.json();
            videoId = data.videoId || null;
          }
        } catch (_) {
          // Backend unavailable — fall through to TMDB IDs
        }
      }

      // Fallback: use first TMDB ID if backend gave nothing
      if (!videoId) {
        const tmdbIds = await tmdbIdsPromise;
        videoId = tmdbIds[0] || null;
      }

      if (!videoId) {
        return { ...EMPTY, error: 'No trailer found' };
      }

      // Step 2: fetch DASH/HLS manifest from Piped CDN
      const piped: PipedStream = await getPipedStream(videoId);

      const result: PipedTrailerResult = {
        streamUrl:   piped.streamUrl,
        isDASH:      piped.isDASH,
        isHLS:       piped.isHLS,
        subtitleUrl: piped.subtitleUrl,
        videoId:     piped.videoId,
        loading:     false,
        error:       null,
      };

      _resolved.set(key, result);
      return result;

    } catch (e: any) {
      return { ...EMPTY, error: e.message };
    } finally {
      _inflight.delete(key);
    }
  })();

  _inflight.set(key, promise);
  return promise;
}

export function usePipedTrailer(
  tmdbId:    number | string | null | undefined,
  title:     string | null | undefined,
  year:      string | null | undefined,
  mediaType: 'movie' | 'tv',
  enabled    = true,
): PipedTrailerResult {
  const [state, setState] = useState<PipedTrailerResult>(EMPTY);
  const prevKey = useRef('');

  useEffect(() => {
    if (!tmdbId || !title || !enabled) return;
    const key = `${mediaType}:${tmdbId}`;
    if (prevKey.current === key) return;
    prevKey.current = key;

    setState(s => ({ ...s, loading: true, error: null }));
    resolveTrailer(tmdbId, title, year || '', mediaType)
      .then(result => setState({ ...result, loading: false }));
  }, [tmdbId, title, year, mediaType, enabled]);

  return state;
}
