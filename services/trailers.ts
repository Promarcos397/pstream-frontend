/**
 * services/trailers.ts
 * ─────────────────────
 * Trailer lookup with 3-tier fallback:
 *
 *   1. NewPipe (yt-dlp, zero quota) — primary when YOUTUBE_DISABLED=true
 *      → Returns [] fast (6s timeout), signals useNewPipeTrailer hook
 *   2. TMDB /videos — no YouTube API key needed, just TMDB key
 *      → Returns YouTube video IDs from TMDB's curated trailer list
 *   3. YouTube Data API v3 — when YOUTUBE_DISABLED=false
 *      → Key rotation pool via YouTubeService
 *
 * Note: NewPipe direct-stream path is handled by useNewPipeTrailer hook.
 * This file manages the ID-based path (YouTube iframe fallback).
 */

import { YOUTUBE_SEARCH_DISABLED } from './youtubeDisabled';
import { getMovieDetails } from './tmdb';
import { searchTrailersWithFallback } from './YouTubeService';
import tmdb from './tmdb';

// Block repeated failures for 5 minutes per item
const unavailableUntil = new Map<string, number>();
const UNAVAILABLE_TTL  = 5 * 60 * 1000;

/** Fetch YouTube video IDs from TMDB's curated trailer list — no YouTube API quota. */
async function getTmdbTrailerKeys(id: number | string, type: 'movie' | 'tv'): Promise<string[]> {
  try {
    const path = type === 'tv'
      ? `/tv/${id}/videos?language=en-US`
      : `/movie/${id}/videos?language=en-US`;
    const { data } = await tmdb.get(path);
    const results: any[] = data?.results || [];
    return results
      .filter(v => v.type === 'Trailer' && v.site === 'YouTube' && v.key)
      .sort((a, b) => (b.official ? 1 : 0) - (a.official ? 1 : 0))
      .map(v => v.key)
      .slice(0, 5);
  } catch {
    return [];
  }
}

export const fetchTrailers = async (
  id:   number | string,
  type: 'movie' | 'tv',
): Promise<string[]> => {
  const trailerKey = `${type}:${id}`;
  if ((unavailableUntil.get(trailerKey) || 0) > Date.now()) return [];

  // Primary: TMDB /videos endpoint — free, no YouTube API quota, returns video IDs
  // for YouTube iframes. Always try this first (fast, reliable).
  const tmdbKeys = await getTmdbTrailerKeys(id, type);
  if (tmdbKeys.length > 0) return tmdbKeys;

  // If TMDB has nothing AND YouTube search is disabled, give up
  if (YOUTUBE_SEARCH_DISABLED) return [];

  try {
    const details = await getMovieDetails(id, type);
    if (!details) return [];

    const title   = details.original_title || details.original_name || details.title || details.name || '';
    const year    = (details.release_date || details.first_air_date)
      ? new Date(details.release_date || details.first_air_date).getFullYear().toString()
      : undefined;
    const company = details.production_companies?.[0]?.name;

    const trailers = await searchTrailersWithFallback({ title, year, company, type }, 8);
    if (!trailers.length) {
      // TMDB key fallback even for YouTube mode
      const tmdbKeys = await getTmdbTrailerKeys(id, type);
      if (tmdbKeys.length) return tmdbKeys;
      unavailableUntil.set(trailerKey, Date.now() + UNAVAILABLE_TTL);
      return [];
    }
    return trailers;

  } catch (e) {
    console.error('[Trailers] fetchTrailers error:', e);
    // Try TMDB as last resort
    const tmdbKeys = await getTmdbTrailerKeys(id, type);
    if (tmdbKeys.length) return tmdbKeys;
    unavailableUntil.set(trailerKey, Date.now() + UNAVAILABLE_TTL);
    return [];
  }
};

/** Backward-compat: returns first result only */
export const fetchTrailer = async (
  id:   number | string,
  type: 'movie' | 'tv',
): Promise<string | null> => {
  const results = await fetchTrailers(id, type);
  return results[0] ?? null;
};

