/**
 * hooks/usePipedTrailer.ts
 *
 * Resolves the best YouTube trailer for a movie/show via:
 *   YouTubeService.searchTrailersWithFallback (YouTube Data API + local scoring)
 *
 * The giga backend /trailer/resolve path has been removed — it 500s on HF
 * because yt-dlp is blocked by datacenter IP filters for YouTube requests.
 *
 * TMDB video IDs are intentionally NOT used — they are often low-quality,
 * wrong, or missing for newer/non-English titles.
 *
 * Returns a YouTube embed URL ready for <iframe> or the react-youtube component.
 */

import { useState, useEffect, useRef } from 'react';
import { searchTrailersWithFallback } from '../services/YouTubeService';

export interface PipedTrailerResult {
  streamUrl:   string | null;   // YouTube embed URL (https://youtube.com/embed/...)
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

// Module-level cache — survives re-renders and React StrictMode double-invokes
const _resolved = new Map<string, PipedTrailerResult>();
const _inflight = new Map<string, Promise<PipedTrailerResult>>();

/** YouTube embed URL with all controls / branding hidden */
function ytEmbedUrl(videoId: string): string {
  const p = new URLSearchParams({
    autoplay:       '1',
    mute:           '1',
    controls:       '0',
    loop:           '1',
    playlist:       videoId,       // required for loop=1
    showinfo:       '0',
    rel:            '0',
    modestbranding: '1',
    iv_load_policy: '3',
    playsinline:    '1',
    enablejsapi:    '1',
    origin:         typeof window !== 'undefined' ? window.location.origin : '',
    color:          'white',
    disablekb:      '1',
  });
  return `https://www.youtube.com/embed/${videoId}?${p}`;
}

async function resolveTrailer(
  tmdbId:    number | string,
  title:     string,
  year:      string,
  mediaType: 'movie' | 'tv',
): Promise<PipedTrailerResult> {
  const key = `${mediaType}:${tmdbId}`;
  if (_resolved.has(key)) return _resolved.get(key)!;
  if (_inflight.has(key)) return _inflight.get(key)!;

  const promise = (async (): Promise<PipedTrailerResult> => {
    try {
      // YouTube Data API scored search — most reliable source
      const results = await searchTrailersWithFallback(
        { title, year: year || undefined, type: mediaType },
        5,
      );

      const videoId = results[0] || null;
      if (!videoId) return { ...EMPTY, error: 'No trailer found' };

      const result: PipedTrailerResult = {
        streamUrl:   ytEmbedUrl(videoId),
        isDASH:      false,
        isHLS:       false,
        subtitleUrl: null,
        videoId,
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
