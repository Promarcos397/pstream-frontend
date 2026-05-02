/**
 * NewPipeService — yt-dlp powered trailer & video extractor.
 *
 * This is the zero-quota alternative to the YouTube Data API v3.
 * It calls our own Python microservice (newpipe-service) which uses
 * yt-dlp to search YouTube and extract stream URLs directly.
 *
 * Usage priority in YouTubeService.ts:
 *   1. NewPipe (this service)  — no keys, no limits
 *   2. YouTube Data API v3     — fallback when NewPipe is cold/down
 *   3. Giga backend scraper    — last resort
 *
 * The NewPipe service URL is set via VITE_NEWPIPE_URL env var.
 * If unset, it degrades gracefully to returning empty results.
 */

import axios from 'axios';

const NEWPIPE_URL = (import.meta as any).env?.VITE_NEWPIPE_URL || '';

// In-memory cooldown: if the service is down, don't hammer it
let mutedUntil = 0;
const MUTE_DURATION_MS = 2 * 60 * 1000; // 2 min backoff

export interface NewPipeSearchResult {
    id:       string;
    title:    string;
    url:      string;
    duration: number | null;
    views:    number | null;
    channel:  string | null;
    thumb:    string | null;
}

export interface NewPipeExtractResult {
    id:         string;
    title:      string;
    stream_url: string;
    quality:    string;
    ext:        string;
    duration:   number | null;
    thumb:      string | null;
    channel:    string | null;
    platform:   string;
}

/**
 * Check if the NewPipe service is configured and not in cooldown.
 */
export function isNewPipeAvailable(): boolean {
    return !!NEWPIPE_URL && Date.now() >= mutedUntil;
}

/**
 * Search for trailers via the yt-dlp NewPipe service.
 * Returns video IDs only (compatible with existing YouTubeService interface).
 *
 * @param options - Same options as YouTubeService.searchTrailersWithFallback
 * @returns Array of YouTube video IDs, best match first
 */
export async function newPipeSearch(options: {
    title: string;
    year?:  string;
    type?:  'movie' | 'tv';
}, maxResults: number = 5): Promise<string[]> {
    if (!isNewPipeAvailable()) return [];

    try {
        const query = buildQuery(options);
        const params = new URLSearchParams({
            q:     query,
            type:  options.type || 'movie',
            limit: String(maxResults + 3), // fetch a few extra for ranking
        });
        if (options.year) params.set('year', options.year);

        const res = await axios.get<{ results: NewPipeSearchResult[] }>(`${NEWPIPE_URL}/search?${params}`, {
            timeout: 8000,
        });

        const results = res.data?.results || [];
        if (!results.length) return [];

        // Extract YouTube video IDs from the result URLs
        const ids = results
            .map(r => extractYtId(r.url || r.id))
            .filter((id): id is string => !!id)
            .slice(0, maxResults);

        console.log(`[NewPipe] ✅ ${ids.length} results for "${query}"`);
        return ids;

    } catch (e: any) {
        const status = (e as any)?.response?.status;
        if (!status || status >= 500) {
            // Service is down — mute for a while
            mutedUntil = Date.now() + MUTE_DURATION_MS;
            console.warn(`[NewPipe] ⚠️ Service unavailable — muting for 2 min. (${e.message})`);
        } else {
            console.warn(`[NewPipe] Search failed (${status}): ${e.message}`);
        }
        return [];
    }
}

/**
 * Extract a direct stream URL from a YouTube video URL via the NewPipe service.
 * Use this when you want a direct CDN URL instead of the YouTube embed.
 *
 * ⚠️ Stream URLs from yt-dlp expire (usually ~6h). Don't cache long-term.
 *
 * @param videoId - YouTube video ID
 * @returns Direct CDN stream URL, or null on failure
 */
export async function newPipeExtract(videoId: string): Promise<NewPipeExtractResult | null> {
    if (!isNewPipeAvailable()) return null;

    try {
        const url = `https://www.youtube.com/watch?v=${videoId}`;
        const params = new URLSearchParams({ url });
        const res = await axios.get<NewPipeExtractResult>(`${NEWPIPE_URL}/extract?${params}`, {
            timeout: 12000,
        });
        const data = res.data;
        if (!data?.stream_url) return null;
        console.log(`[NewPipe] 🎬 Extracted stream for ${videoId}: ${data.quality}`);
        return data;
    } catch (e: any) {
        console.warn(`[NewPipe] Extract failed for ${videoId}: ${e.message}`);
        return null;
    }
}

/**
 * Get video metadata only (no stream URL) — faster than extract.
 */
export async function newPipeInfo(videoId: string): Promise<{ title: string; duration: number | null } | null> {
    if (!isNewPipeAvailable()) return null;

    try {
        const url = `https://www.youtube.com/watch?v=${videoId}`;
        const params = new URLSearchParams({ url });
        const res = await axios.get(`${NEWPIPE_URL}/info?${params}`, { timeout: 6000 });
        return { title: res.data.title || '', duration: res.data.duration || null };
    } catch {
        return null;
    }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildQuery(options: { title: string; year?: string; type?: 'movie' | 'tv' }): string {
    const { title, year, type } = options;
    const parts = [`"${title}"`];
    if (year) parts.push(year);
    parts.push(type === 'tv' ? 'official trailer series' : 'official trailer');
    return parts.join(' ');
}

function extractYtId(urlOrId: string): string | null {
    if (!urlOrId) return null;
    // Already a plain video ID (11 chars, no slashes)
    if (/^[A-Za-z0-9_-]{11}$/.test(urlOrId)) return urlOrId;
    // Extract from YouTube URLs
    const m = urlOrId.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([A-Za-z0-9_-]{11})/);
    return m ? m[1] : null;
}
