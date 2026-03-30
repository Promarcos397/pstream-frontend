import axios from 'axios';

// YouTube API keys with rotation
const YOUTUBE_API_KEYS = [
    'AIzaSyAPYK_Miisu65B_rzwUH8FoI83AVgmXA50',
    'AIzaSyDUfzBoybcjWFUkA7jqVV1UP45jOWz4L1g',
    'AIzaSyCCNJoPIJVB7r2AOIFn0C-UELpvZrK9AM4',
    'AIzaSyD8URfM0IqZDT4dgl9dpLfQcnJ42q4_XCs',
    'AIzaSyBJHthTDYf9lot4KvH9NONo_lcUBF9SbUY',
];

let currentKeyIndex = 0;
let failedKeys = new Set<number>(); // Track keys that have failed this session

// Session cache: title → videoIds. Prevents re-searching the same title.
const resultCache = new Map<string, string[]>();

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
    const { title, year, company, type } = options;
    const queries: string[] = [];

    // TV shows use different search patterns
    if (type === 'tv') {
        // Most specific: Title + Year + Studio + "Official 4K"
        if (year && company) {
            queries.push(`${title} ${year} ${company} official 4k trailer`);
            queries.push(`${title} ${year} ${company} trailer`);
        }
        if (year) {
            queries.push(`${title} ${year} tv series official trailer`);
        }
        queries.push(`${title} official trailer 4k`);
        queries.push(`${title} tv show trailer`);
        queries.push(`${title} series trailer`);
    } else {
        // Movies
        // Most specific: Title + Year + Company + "Official 4K"
        if (year && company) {
            queries.push(`${title} ${year} ${company} official 4k trailer`);
            queries.push(`${title} ${year} ${company} movie trailer`);
        }
        if (year) {
            queries.push(`${title} ${year} official trailer 4k`);
            queries.push(`${title} ${year} movie trailer`);
        }
        queries.push(`${title} official trailer 4k`);
        queries.push(`${title} movie trailer`);
    }

    return queries;
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
        const queries = buildSearchQueries(options);

        for (const query of queries) {
            try {
                const results = await executeSearch(query, maxResults);
                if (results.length > 0) {
                    resultCache.set(cacheKey, results);
                    return results;
                }
            } catch (error: any) {
                console.error('[YouTubeService] Query failed:', query, error.message);
            }
        }

        // Cache the empty result too — don't retry titles that have no trailers
        resultCache.set(cacheKey, []);
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
