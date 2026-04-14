/**
 * Stream Cache for Pstream
 * 
 * Caches stream URLs with TTL to avoid re-fetching.
 * Token-aware: checks URL expiry timestamp before returning cached results.
 * 
 * IMPORTANT: Cookie persistence removed — it was causing stale streams to
 * survive page navigation and conflict with search results.
 */

interface CachedStream {
    sources: Array<{ url: string; quality: string; isM3U8?: boolean; referer?: string; expires?: number }>;
    subtitles: Array<{ url: string; lang: string }>;
    provider: string;
    cachedAt: number;
}

interface CacheKey {
    title: string;
    type: 'movie' | 'tv';
    year?: number;
    season?: number;
    episode?: number;
    tmdbId?: string;
}

// VixSrc tokens expire after ~60 minutes. Cache for 45 minutes max to be safe.
const CACHE_TTL_MS = 45 * 60 * 1000;
const MAX_CACHE_SIZE = 20;

/**
 * Extracts token expiry from a URL's ?expires= param (VixSrc, VidLink-style tokens).
 * Returns ms timestamp or Infinity if not found.
 */
function extractTokenExpiry(url: string): number {
    try {
        const urlObj = new URL(url);
        const expiresParam = urlObj.searchParams.get('expires') || urlObj.searchParams.get('exp') || urlObj.searchParams.get('e');
        if (expiresParam) {
            const expiresTs = parseInt(expiresParam, 10);
            // If it looks like Unix seconds (10 digits), convert to ms
            if (!isNaN(expiresTs) && expiresTs > 1_000_000_000) {
                return expiresTs * 1000;
            }
        }
    } catch {}
    return Infinity; // No expiry found — assume it doesn't expire
}

class StreamCache {
    private cache: Map<string, CachedStream> = new Map();
    private prefetchQueue: Set<string> = new Set();

    // No cookie persistence — prevents stale cross-navigation cache pollution
    constructor() {}

    private generateKey(key: CacheKey): string {
        const idStr = key.tmdbId ? `:${key.tmdbId}` : '';
        if (key.type === 'movie') {
            return `movie:${key.title}${idStr}:${key.year || ''}`;
        }
        return `tv:${key.title}${idStr}:${key.year || ''}:S${key.season}E${key.episode}`;
    }

    get(key: CacheKey): CachedStream | null {
        const cacheKey = this.generateKey(key);
        const cached = this.cache.get(cacheKey);
        if (!cached) return null;

        const now = Date.now();

        // 1. Check TTL
        if (now - cached.cachedAt > CACHE_TTL_MS) {
            this.cache.delete(cacheKey);
            console.log(`[StreamCache] EXPIRED (TTL) ${cacheKey}`);
            return null;
        }

        // 2. Check token expiry in the actual URL (catches VixSrc short-lived tokens)
        //    If the primary source URL's token has expired, invalidate the entry.
        const primaryUrl = cached.sources[0]?.url;
        if (primaryUrl) {
            const tokenExpiry = extractTokenExpiry(primaryUrl);
            if (tokenExpiry !== Infinity && now > tokenExpiry) {
                this.cache.delete(cacheKey);
                console.log(`[StreamCache] EXPIRED (token) ${cacheKey}`);
                return null;
            }
        }

        console.log(`[StreamCache] HIT for ${cacheKey}`);
        return cached;
    }

    remove(key: CacheKey): void {
        this.cache.delete(this.generateKey(key));
        this.prefetchQueue.delete(this.generateKey(key));
    }

    set(key: CacheKey, stream: Omit<CachedStream, 'cachedAt'>): void {
        const cacheKey = this.generateKey(key);

        // Evict oldest entry if at capacity
        if (this.cache.size >= MAX_CACHE_SIZE) {
            const oldestKey = this.cache.keys().next().value;
            if (oldestKey) this.cache.delete(oldestKey);
        }

        this.cache.set(cacheKey, { ...stream, cachedAt: Date.now() });
        console.log(`[StreamCache] STORED ${cacheKey}`);
    }

    // Prefetch is intentionally disabled — token-signed URLs expire before use
    async prefetchNextEpisodes(): Promise<void> { return; }

    clear(): void {
        this.cache.clear();
        this.prefetchQueue.clear();
    }

    stats(): { size: number; keys: string[] } {
        return { size: this.cache.size, keys: Array.from(this.cache.keys()) };
    }
}

export const streamCache = new StreamCache();
export type { CacheKey, CachedStream };
