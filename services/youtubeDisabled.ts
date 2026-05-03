/**
 * YouTube Kill Switch — P-Stream
 * ================================
 * YOUTUBE_SEARCH_DISABLED = true  → disables YouTube Data API v3 search
 *   (the expensive quota-consuming path via YouTubeService)
 *
 * YOUTUBE_IFRAME_DISABLED = true  → disables YouTube iframe embeds entirely
 *   (only used if you want NewPipe-only mode, which has proxy/IP-lock issues)
 *
 * Default: search disabled (no API quota burned), iframes ON (TMDB keys work).
 * NewPipe is still attempted first when NEWPIPE_ENABLED=true.
 */

/** Disable YouTube Data API v3 search — saves quota. TMDB keys still usable. */
export const YOUTUBE_SEARCH_DISABLED = true;

/**
 * Disable YouTube iframes entirely — uses NativeTrailerPlayer instead.
 * Stream is extracted + proxied through giga-backend (same IP = no 403).
 */
export const YOUTUBE_IFRAME_DISABLED = true;

/** Legacy alias */
export const YOUTUBE_DISABLED = YOUTUBE_SEARCH_DISABLED;
