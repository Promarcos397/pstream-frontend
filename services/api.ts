/**
 * services/api.ts — Backward-Compatibility Shim
 * ───────────────────────────────────────────────
 * This file re-exports everything from the proper service modules.
 * All existing imports of `../services/api` continue to work without changes.
 *
 * Original monolith split into:
 *   services/tmdb.ts     — TMDB fetch functions + axios instance
 *   services/stream.ts   — getStream, buildTorrentStreamUrl
 *   services/prefetch.ts — prefetchStream, schedulePrefetchQueue
 *   data/genres.ts       — GENRES, MICRO_GENRES, DAY_STREAMS
 *   data/languages.ts    — DISPLAY_LANGUAGES, SUBTITLE_LANGUAGES
 *   data/avatars.ts      — AVATAR_CATEGORIES, Avatar types
 */

// ─── TMDB ─────────────────────────────────────────────────────────────────────
export {
  getMovieImages,
  getMovieDetails,
  getMovieCredits,
  getSeasonDetails,
  getExternalIds,
  getRecommendations,
  getReleaseDates,
  searchMovies,
  fetchData,
  setTmdbLanguage as setApiLanguage,
  default,
} from './tmdb';

// ─── Stream ───────────────────────────────────────────────────────────────────
export { getStream, buildTorrentStreamUrl } from './stream';

// ─── Prefetch ─────────────────────────────────────────────────────────────────
export { prefetchStream, schedulePrefetchQueue } from './prefetch';

// ─── Trailers ─────────────────────────────────────────────────────────────────
// fetchTrailers now delegates to YouTubeService (which checks NewPipe first).
// Kept here for backward compat — components can import from api.ts unchanged.
export { fetchTrailers, fetchTrailer } from './trailers';