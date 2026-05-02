/**
 * YouTube Kill Switch — P-Stream
 * ================================
 * Set YOUTUBE_DISABLED = true to mute ALL YouTube functionality:
 *   - Trailer search (YouTubeService)
 *   - Embed player (react-youtube in HeroCarousel, InfoModal, MovieCard)
 *   - Captions polling (useYouTubeCaptions)
 *   - YouTube Caption Service HTTP calls
 *
 * Re-enable by setting this to false (or deleting the import in each file).
 *
 * WHY: NewPipe service is the active trailer path. YouTube embeds are suspended
 * while we evaluate direct-stream playback via yt-dlp extraction.
 */

export const YOUTUBE_DISABLED = true;
