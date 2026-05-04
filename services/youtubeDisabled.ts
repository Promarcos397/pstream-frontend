/**
 * YouTube Kill Switch — P-Stream
 * ================================
 * YOUTUBE_SEARCH_DISABLED = true  → disables YouTube Data API v3 search
 *   (the expensive quota-consuming path via YouTubeService)
 *
 * YOUTUBE_IFRAME_DISABLED = true  → disables YouTube iframe embeds entirely
 *   (only used if you want NativeTrailerPlayer-only mode)
 *
 * Current mode: BOTH OFF — YouTube iframes + Data API search are fully active.
 * The app uses <YouTube> iframes for all three trailer surfaces (Hero, InfoModal,
 * MovieCard hover). usePipedTrailer resolves IDs via YouTube Data API search.
 */

/** Disable YouTube Data API v3 search — set true only to save quota. */
export const YOUTUBE_SEARCH_DISABLED = false;

/**
 * Disable YouTube iframes — forces NativeTrailerPlayer fallback.
 * Keep false unless you are specifically debugging the native player path.
 */
export const YOUTUBE_IFRAME_DISABLED = false;

/** Legacy alias used by YouTubeService kill switch. */
export const YOUTUBE_DISABLED = YOUTUBE_SEARCH_DISABLED;
