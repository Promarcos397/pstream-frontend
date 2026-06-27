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
  getCachedMovieImages,
  isUrlCached,
  getCachedData,
  getMovieDetails,
  getMovieVideos,
  getMovieCredits,
  getSeasonDetails,
  getExternalIds,
  getRecommendations,
  getReleaseDates,
  searchMovies,
  fetchData,
  isBlacklisted,
  setTmdbLanguage as setApiLanguage,
  default,
} from './tmdb';

// Stream functions removed — AllDebrid is handled client-side via useDebridStream
// No server-side stream proxy needed (AllDebrid blocks server IPs with NO_SERVER)