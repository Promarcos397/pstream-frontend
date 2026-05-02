/**
 * hooks/useNewPipeTrailer.ts
 * ──────────────────────────
 * Resolves a native video stream URL for a movie/TV trailer via the
 * NewPipe microservice (yt-dlp powered, zero quota, no iframes).
 *
 * Flow:
 *   1. Search NewPipe for "<title> <year> official trailer"
 *   2. Pick highest-scored result (index [0])
 *   3. Extract the direct stream URL + subtitle VTT URLs
 *   4. Return { streamUrl, subtitleUrl, loading, error }
 *
 * Used by HeroCarouselBackground and InfoModal when YOUTUBE_DISABLED=true.
 */

import { useState, useEffect, useRef } from 'react';

const NEWPIPE_URL = (import.meta as any).env?.VITE_NEWPIPE_URL || '';

export interface NewPipeTrailerResult {
  streamUrl:   string | null;
  subtitleUrl: string | null; // WebVTT URL (auto-caption or manual)
  videoId:     string | null;
  quality:     string | null;
  loading:     boolean;
  error:       string | null;
}

// Module-level LRU cache (survives re-renders, cleared on page refresh)
const _cache = new Map<string, NewPipeTrailerResult>();
const _inflight = new Map<string, Promise<NewPipeTrailerResult>>();

async function resolveTrailer(
  title: string,
  year?: string,
  type: 'movie' | 'tv' = 'movie',
): Promise<NewPipeTrailerResult> {
  const EMPTY: NewPipeTrailerResult = {
    streamUrl: null, subtitleUrl: null, videoId: null, quality: null,
    loading: false, error: null,
  };

  if (!NEWPIPE_URL) return { ...EMPTY, error: 'VITE_NEWPIPE_URL not set' };

  const cacheKey = `${title}::${year || ''}::${type}`;
  if (_cache.has(cacheKey)) return _cache.get(cacheKey)!;
  if (_inflight.has(cacheKey)) return _inflight.get(cacheKey)!;

  const promise = (async (): Promise<NewPipeTrailerResult> => {
    try {
      // ── Fast path: /trailer (search + extract in one call) ──────────────
      const trailerParams = new URLSearchParams({ title, type });
      if (year) trailerParams.set('year', year);
      const trailerR = await fetch(
        `${NEWPIPE_URL}/trailer?${trailerParams}`,
        { signal: AbortSignal.timeout(18000) }  // single combined call
      );

      let extractData: any = null;
      if (trailerR.ok) {
        extractData = await trailerR.json();
      } else {
        // ── Slow path fallback: /search then /extract ────────────────────
        const q       = encodeURIComponent(`${title} ${year || ''} trailer`);
        const searchR = await fetch(
          `${NEWPIPE_URL}/search?q=${q}&type=${type}&year=${year || ''}&limit=1`,
          { signal: AbortSignal.timeout(6000) }
        );
        if (!searchR.ok) throw new Error(`Search HTTP ${searchR.status}`);
        const searchData = await searchR.json();
        const topResult  = searchData.results?.[0];
        if (!topResult?.url && !topResult?.id) throw new Error('No results');
        const videoUrl = topResult.url || `https://www.youtube.com/watch?v=${topResult.id}`;
        const extractR = await fetch(
          `${NEWPIPE_URL}/extract?url=${encodeURIComponent(videoUrl)}`,
          { signal: AbortSignal.timeout(12000) }
        );
        if (!extractR.ok) throw new Error(`Extract HTTP ${extractR.status}`);
        extractData = await extractR.json();
      }

      if (!extractData?.stream_url) throw new Error('No stream URL in response');

      const subs       = extractData.subtitles || {};
      const subtitleUrl = subs['en']?.url || subs['en-US']?.url || subs['en-GB']?.url || null;

      const result: NewPipeTrailerResult = {
        streamUrl:   extractData.stream_url,
        subtitleUrl,
        videoId:     extractData.id,
        quality:     extractData.quality,
        loading:     false,
        error:       null,
      };

      _cache.set(cacheKey, result);
      return result;

    } catch (e: any) {
      console.warn('[NewPipeTrailer] Failed:', e.message);
      return { ...EMPTY, error: e.message };
    } finally {
      _inflight.delete(cacheKey);
    }
  })();

  _inflight.set(cacheKey, promise);
  return promise;
}

export function useNewPipeTrailer(
  title: string | null,
  year?: string,
  type: 'movie' | 'tv' = 'movie',
  enabled = true,
): NewPipeTrailerResult {
  const INIT: NewPipeTrailerResult = {
    streamUrl: null, subtitleUrl: null, videoId: null, quality: null,
    loading: false, error: null,
  };
  const [state, setState] = useState<NewPipeTrailerResult>(INIT);
  const prevKey = useRef<string>('');

  useEffect(() => {
    if (!title || !enabled || !NEWPIPE_URL) return;
    const key = `${title}::${year || ''}::${type}`;
    if (prevKey.current === key) return;
    prevKey.current = key;

    setState(s => ({ ...s, loading: true, error: null }));

    resolveTrailer(title, year, type).then(result => {
      setState({ ...result, loading: false });
    });
  }, [title, year, type, enabled]);

  return state;
}
