import axios from 'axios';

// Parse YouTube API keys from environment variables to avoid hardcoding
const YOUTUBE_API_KEYS: string[] = (import.meta.env.VITE_YOUTUBE_API_KEYS || '').split(',').filter(Boolean);

// Fallback keys if env is empty (legacy safety)
if (YOUTUBE_API_KEYS.length === 0) {
    YOUTUBE_API_KEYS.push('AIzaSyAPYK_Miisu65B_rzwUH8FoI83AVgmXA50');
}

// Global throttle to prevent spamming Google APIs too hard
let lastSearchTime = 0;
const GLOBAL_SEARCH_THROTTLE_MS = 500; 

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

let currentKeyIndex = 0;
let failedKeys = new Set<number>(); // Track keys that have failed this session

const CACHE_KEY = 'pstream-youtube-cache';

// Shared instance to handle the memory data
const loadInitialCache = (): [string, string[]][] => {
    try {
        const saved = localStorage.getItem(CACHE_KEY);
        if (saved) {
            const data = JSON.parse(saved);
            return Object.entries(data) as [string, string[]][];
        }
    } catch (e) { console.error('[YouTubeService] Cache load failed', e); }
    return [];
};

const resultCache = new Map<string, string[]>(loadInitialCache());

function saveCache() {
    try {
        const obj = Object.fromEntries(resultCache.entries());
        localStorage.setItem(CACHE_KEY, JSON.stringify(obj));
    } catch (e) { }
}

// In-flight dedup: if two hovers for the same title fire at once, only one API call is made.
const inFlight = new Map<string, Promise<string[]>>();

const YOUTUBE_SEARCH_URL = 'https://www.googleapis.com/youtube/v3/search';

/**
 * Rotate to next available API key
 */
function rotateKey(): boolean {
    failedKeys.add(currentKeyIndex);

    // Find next key that hasn't failed
    for (let i = 0; i < YOUTUBE_API_KEYS.length; i++) {
        const nextIndex = (currentKeyIndex + 1 + i) % YOUTUBE_API_KEYS.length;
        if (!failedKeys.has(nextIndex)) {
            currentKeyIndex = nextIndex;
            console.log('[YouTubeService] Rotated to key index:', currentKeyIndex);
            return true;
        }
    }

    console.warn('[YouTubeService] All keys exhausted!');
    return false;
}

/**
 * Reset failed keys (call at start of new session/day)
 */
export function resetKeys() {
    failedKeys.clear();
    currentKeyIndex = 0;
}

interface SearchOptions {
    title: string;
    year?: string;           // Release year for accuracy
    company?: string;        // Production company (Netflix, HBO, etc.)
    type?: 'movie' | 'tv';   // Content type
}

/**
 * Build search queries with fallbacks
 * More specific queries first, fallback to simpler ones
 */
function buildSearchQueries(options: SearchOptions): string[] {
    const { title, year, company } = options;
    
    // USER REQUEST: [Production company name + media title + release year + official trailer]
    // Consolidate into a single, high-precision query to save maximum API quota.
    const queryParts = [];
    if (company) queryParts.push(company);
    queryParts.push(title);
    if (year) queryParts.push(year);
    queryParts.push('official trailer');

    return [queryParts.join(' ')];
}

/**
 * Execute a single YouTube search
 */
async function executeSearch(query: string, maxResults: number): Promise<string[]> {
    const key = YOUTUBE_API_KEYS[currentKeyIndex];
    if (!key) return [];

    try {
        const response = await axios.get(YOUTUBE_SEARCH_URL, {
            params: {
                part: 'snippet',
                q: query,
                key: key,
                type: 'video',
                maxResults: maxResults,
                relevanceLanguage: 'en',
                videoEmbeddable: 'true'
            }
        });

        if (response.data.items && response.data.items.length > 0) {
            return response.data.items.map((item: any) => item.id.videoId);
        }
        return [];
    } catch (error: any) {
        if (error.response?.status === 403) {
            console.warn('[YouTubeService] Key', currentKeyIndex, 'rate limited, rotating...');
            if (rotateKey()) {
                return executeSearch(query, maxResults); // Retry with new key
            }
        }
        throw error;
    }
}

/**
 * Smart search with fallback queries + session cache + in-flight dedup
 */
export const searchTrailersWithFallback = async (
    options: SearchOptions,
    maxResults: number = 5
): Promise<string[]> => {
    const cacheKey = `${options.title}::${options.year || ''}::${options.type || ''}`;

    // Cache hit — zero quota cost, instant result
    if (resultCache.has(cacheKey)) {
        return resultCache.get(cacheKey)!;
    }

    // In-flight dedup — if the same title is already being searched, share that promise
    if (inFlight.has(cacheKey)) {
        return inFlight.get(cacheKey)!;
    }

    const searchPromise = (async () => {
        // APPLY GLOBAL SEARCH THROTTLE
        // If many cards/heroes trigger at once, they queue up here
        const now = Date.now();
        const timeSinceLast = now - lastSearchTime;
        if (timeSinceLast < GLOBAL_SEARCH_THROTTLE_MS) {
            await sleep(GLOBAL_SEARCH_THROTTLE_MS - timeSinceLast);
        }
        lastSearchTime = Date.now();

        const queries = buildSearchQueries(options);

        for (const query of queries) {
            try {
                // Execute search with immediate key-rotation retry logic
                const results = await executeSearch(query, maxResults);
                if (results.length > 0) {
                    resultCache.set(cacheKey, results);
                    saveCache(); // Persist to storage
                    return results;
                }
            } catch (error: any) {
                console.error('[YouTubeService] Query failed:', query, error.message);
            }
        }

        // Cache the empty result too — don't retry titles that have no trailers
        resultCache.set(cacheKey, []);
        saveCache();
        return [];
    })();

    inFlight.set(cacheKey, searchPromise);
    const result = await searchPromise;
    inFlight.delete(cacheKey);
    return result;
};

/**
 * Simple search (backward compat)
 */
export const searchTrailers = async (query: string, maxResults: number = 5): Promise<string[]> => {
    return searchTrailersWithFallback({ title: query }, maxResults);
};

/**
 * Search for a single trailer (backward compat)
 */
export const searchTrailer = async (query: string): Promise<string | null> => {
    const results = await searchTrailers(query, 1);
    return results.length > 0 ? results[0] : null;
};
