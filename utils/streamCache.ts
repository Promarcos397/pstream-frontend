/**
 * Stream Cache for P-Stream
 * 
 * Caches stream URLs with TTL to avoid re-fetching.
 * Also handles prefetching for next episodes.
 */
import Cookies from 'js-cookie';

interface CachedStream {
    sources: Array<{ url: string; quality: string; isM3U8?: boolean }>;
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

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_CACHE_SIZE = 20;

class StreamCache {
    private cache: Map<string, CachedStream> = new Map();
    private prefetchQueue: Set<string> = new Set();

    constructor() {
        this.loadFromCookies();
    }

    private loadFromCookies(): void {
        try {
            const data = Cookies.get('pstream-stream-cache');
            if (data) {
                const parsed = JSON.parse(data) as Array<[string, CachedStream]>;
                const now = Date.now();
                parsed.forEach(([key, val]) => {
                    if (now - val.cachedAt < CACHE_TTL_MS) {
                        this.cache.set(key, val);
                    }
                });
            }
        } catch (e) { }
    }

    private saveToCookies(): void {
        try {
            const entries = Array.from(this.cache.entries());
            Cookies.set('pstream-stream-cache', JSON.stringify(entries), { expires: 1/24 }); // 1 hour
        } catch (e) { }
    }

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

        if (Date.now() - cached.cachedAt > CACHE_TTL_MS) {
            this.cache.delete(cacheKey);
            return null;
        }

        console.log(`[StreamCache] HIT for ${cacheKey}`);
        return cached;
    }

    remove(key: CacheKey): void {
        const cacheKey = this.generateKey(key);
        this.cache.delete(cacheKey);
        this.prefetchQueue.delete(cacheKey);
        this.saveToCookies();
    }

    set(key: CacheKey, stream: Omit<CachedStream, 'cachedAt'>): void {
        const cacheKey = this.generateKey(key);

        if (this.cache.size >= MAX_CACHE_SIZE) {
            const oldestKey = this.cache.keys().next().value;
            if (oldestKey) {
                this.cache.delete(oldestKey);
            }
        }

        this.cache.set(cacheKey, {
            ...stream,
            cachedAt: Date.now()
        });

        this.saveToCookies();
        console.log(`[StreamCache] STORED ${cacheKey}`);
    }

    async prefetchNextEpisodes(
        api: any,
        title: string,
        year: number | undefined,
        currentSeason: number,
        currentEpisode: number,
        totalEpisodes: number,
        tmdbId?: string
    ): Promise<void> {
        const episodesToPrefetch: Array<{ season: number; episode: number }> = [];

        for (let i = 1; i <= 2; i++) {
            const nextEp = currentEpisode + i;
            if (nextEp <= totalEpisodes) {
                episodesToPrefetch.push({ season: currentSeason, episode: nextEp });
            }
        }

        for (const { season, episode } of episodesToPrefetch) {
            const key: CacheKey = { title, type: 'tv', year, season, episode, tmdbId };
            const cacheKey = this.generateKey(key);

            if (this.cache.has(cacheKey) || this.prefetchQueue.has(cacheKey)) {
                continue;
            }

            this.prefetchQueue.add(cacheKey);

            this.fetchAndCache(api, key).finally(() => {
                this.prefetchQueue.delete(cacheKey);
            });
        }
    }

    private async fetchAndCache(api: any, key: CacheKey): Promise<void> {
        try {
            console.log(`[StreamCache] Prefetching S${key.season}E${key.episode}...`);

            const result = await api.getStream(
                key.title,
                key.type,
                key.year,
                key.season,
                key.episode,
                key.tmdbId
            );

            if (result.success && result.sources?.length > 0) {
                this.set(key, {
                    sources: result.sources,
                    subtitles: result.subtitles || [],
                    provider: result.provider || 'unknown'
                });
                console.log(`[StreamCache] ✅ Prefetched S${key.season}E${key.episode}`);
            }
        } catch (err) {
            console.warn(`[StreamCache] Prefetch failed for S${key.season}E${key.episode}:`, err);
        }
    }

    clear(): void {
        this.cache.clear();
        this.prefetchQueue.clear();
        Cookies.remove('pstream-stream-cache');
    }

    stats(): { size: number; keys: string[] } {
        return {
            size: this.cache.size,
            keys: Array.from(this.cache.keys())
        };
    }
}

export const streamCache = new StreamCache();
export type { CacheKey, CachedStream };
