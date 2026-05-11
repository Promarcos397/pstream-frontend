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
let failedKeys = new Set<number>();
let allKeysExhaustedUntil = 0;
const KEY_EXHAUST_COOLDOWN_MS = 15 * 60 * 1000;
let backendFallbackMutedUntil = 0;
const BACKEND_FALLBACK_COOLDOWN_MS = 60 * 1000;

// v3 = new scoring-based selection (invalidates old position-based cache entries)
const CACHE_KEY = 'Pstream-youtube-cache-v3';

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
// In-memory set of videoIds that won because they are teasers (not persisted — resets on reload)
const teaserCache = new Set<string>();

function saveCache() {
    try {
        const obj = Object.fromEntries(resultCache.entries());
        localStorage.setItem(CACHE_KEY, JSON.stringify(obj));
    } catch (e) { }
}

// In-flight dedup: if two hovers for the same title fire at once, only one API call is made.
const inFlight = new Map<string, Promise<string[]>>();

const YOUTUBE_SEARCH_URL = 'https://www.googleapis.com/youtube/v3/search';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SearchOptions {
    title: string;
    year?: string;
    company?: string;
    type?: 'movie' | 'tv';
}

// Full candidate with metadata — needed for local scoring
interface YTCandidate {
    videoId: string;
    title: string;
    channelTitle: string;
}

// ─── Key Rotation ─────────────────────────────────────────────────────────────

function rotateKey(): boolean {
    failedKeys.add(currentKeyIndex);
    for (let i = 0; i < YOUTUBE_API_KEYS.length; i++) {
        const nextIndex = (currentKeyIndex + 1 + i) % YOUTUBE_API_KEYS.length;
        if (!failedKeys.has(nextIndex)) {
            currentKeyIndex = nextIndex;
            console.log('[YouTubeService] Rotated to key index:', currentKeyIndex);
            return true;
        }
    }
    console.warn('[YouTubeService] All keys exhausted!');
    allKeysExhaustedUntil = Date.now() + KEY_EXHAUST_COOLDOWN_MS;
    return false;
}

export function resetKeys() {
    failedKeys.clear();
    currentKeyIndex = 0;
    allKeysExhaustedUntil = 0;
    backendFallbackMutedUntil = 0;
}

// ─── Query Building ───────────────────────────────────────────────────────────

/**
 * Build a tiered list of search queries from least to most specific.
 *
 * Strategy:
 * - Start from a single simple "4K trailer" query (user-friendly baseline)
 * - Add a tiny set of dynamic fallbacks only when needed
 * - Keep query count low to reduce API pressure and noisy results
 *
 * company and type are intentionally excluded from queries — they hurt recall
 * for most titles. company is used in scoring instead.
 */
function buildSearchQueries(options: SearchOptions): string[] {
    const { title, year, type } = options;
    const clean = title.trim();
    const yearTerm = year ? ` ${year}` : '';
    const typeTerm = type === 'tv' ? 'tv series' : 'movie';
    return [`"${clean}" ${typeTerm} ${yearTerm} trailer`];
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

const BANLIST_PATTERNS = [
    /fan[\s-]?made/i,
    /\breaction\b/i,
    /\breview\b/i,
    /explained/i,
    /\bspoof\b/i,
    /\bparody\b/i,
    /\bai[\s-]?generated\b/i,
    /\bai\s+trailer/i,
    /\bconcept\s+trailer/i,
    /\bfan\s+trailer/i,
    /\bfan\s+film/i,
    /\bfan\s+edit/i,
    /movie\s+recap/i,
    /ending\s+explained/i,
    /scene\s+explained/i,
    /behind\s+the\s+scenes/i,
    /featurette/i,
    /interview/i,
    /making\s+of/i,
    /\banalysis\b/i,
    /\bclip\b/i,             // Clips are not trailers
    /\bshort\s+film\b/i,
];

function normalizeText(s: string): string {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/**
 * Score a YouTube candidate against intended title/type.
 * Higher = better match + quality signals.
 */
function scoreCandidate(options: SearchOptions, candidate: YTCandidate): number {
    const q = normalizeText(options.title);
    const t = normalizeText(candidate.title);
    const c = normalizeText(candidate.channelTitle);
    const isTv = options.type === 'tv';
    const isMovie = options.type === 'movie';

    let score = 0;

    // ── Title relevance ──────────────────────────────────────────────────────

    // Strong signal: full normalized title appears in the video title
    if (t.includes(q)) {
        score += 50;
    } else {
        // Partial word overlap fallback
        const qWords = q.split(/\s+/).filter(w => w.length > 2); // skip "a", "of", etc.
        const tWords = new Set(t.split(/\s+/));
        let overlap = 0;
        for (const w of qWords) {
            if (tWords.has(w)) overlap++;
        }
        // Normalize: full overlap = 30pts, partial scales down
        score += qWords.length > 0 ? Math.round((overlap / qWords.length) * 30) : 0;
    }

    // Type signal: soft guidance, never hard-fail
    if (isTv) {
        if (/\btv\b|\bseries\b|\bshow\b/.test(t)) score += 20;
        if (/\bseason\b/.test(t)) score += 20;
        if (/\bmovie\b|\bfilm\b|\bepisode\b/.test(t)) score -= 40;
    } else if (isMovie) {
        if (/\bmovie\b|\bfilm\b/.test(t)) score += 20;
        if (/\bseason\b|\bepisode\b|\btv\b|\bseries\b/.test(t)) score -= 40;
    }

    // ── Trailer quality signals ──────────────────────────────────────────────
    
    if (/\btrailer\b/.test(t)) score += 18;
    if (/\bteaser\b/.test(t)) score += 25;

    // Quality/resolution keywords are secondary to relevance
    if (/\b4k\b/.test(t)) score += 25;
    if (/\bhdr\b/.test(t)) score += 15;
    if (/\bhd\b/.test(t)) score += 15;
    if (/\bimax\b/.test(t)) score += 20;
    if (/\bblu[\s-]?ray\b/.test(t)) score += 20;
    if (/\b(hbo|max|hulu|apple|prime|disney|Crunchyroll|BBC|Paramount|Rotten\s*Tomatoes)\b/i.test(t)) score += 10;
    if (t.length > 50 && q.length > 10) score += 15; // avoid very short titles
    
    // Year boost: Exact match or one year before (trailers often release the year prior)
    
    if (options.year) {
        const targetYear = parseInt(options.year);
        if (!isNaN(targetYear)) {
            const yearRegex = new RegExp(`\\b${targetYear}\\b`);
            const prevYearRegex = new RegExp(`\\b${targetYear - 1}\\b`);

            if (yearRegex.test(t)) {
                score += 35; // Strong match
            } else if (prevYearRegex.test(t)) {
                score += 25; // Valid trailer window
            }
        }
    }

    // Penalize non-trailer content
    for (const pattern of BANLIST_PATTERNS) {
        if (pattern.test(candidate.title)) { score -= 50; break; }
    }

    // No-metadata candidates (backend fallback) can't be scored — push them last
    if (!candidate.title && !candidate.channelTitle) score -= 100;

    return score;
}

// ─── Search Execution ─────────────────────────────────────────────────────────

/**
 * Execute a single YouTube search query.
 * Returns full YTCandidate objects (videoId + snippet metadata) for scoring.
 * Falls back to scraper proxy if all API keys are exhausted.
 */
async function executeSearch(query: string, maxResults: number): Promise<YTCandidate[]> {

    if (allKeysExhaustedUntil > 0 && Date.now() >= allKeysExhaustedUntil) {
        // Cooldown window elapsed, allow keys to be retried (daily quotas may have reset).
        resetKeys();
    }

    const key = YOUTUBE_API_KEYS[currentKeyIndex];

    if (key && Date.now() >= allKeysExhaustedUntil) {
        try {
            const response = await axios.get(YOUTUBE_SEARCH_URL, {
                params: {
                    part: 'snippet',
                    q: query,
                    key,
                    type: 'video',
                    maxResults,
                    relevanceLanguage: 'en',
                    videoEmbeddable: 'true',
                    videoDefinition: 'high',
                }
            });

            if (response.data.items?.length > 0) {
                return response.data.items.map((item: any): YTCandidate => ({
                    videoId: item.id.videoId,
                    title: item.snippet?.title || '',
                    channelTitle: item.snippet?.channelTitle || '',
                }));
            }
        } catch (error: any) {
            const status = error.response?.status;
            const reason = error.response?.data?.error?.message || error.message;

            if (status === 403 || status === 429) {
                console.warn(`[YouTubeService] Key ${currentKeyIndex} failed (${status}): ${reason}. Rotating...`);
                if (rotateKey()) {
                    return executeSearch(query, maxResults);
                }
            } else {
                console.error(`[YouTubeService] API Error: ${reason}`);
            }
        }
    }

    const GIGA_URL = import.meta.env.VITE_GIGA_BACKEND_URL || 'https://ibrahimar397-pstream-giga.hf.space';

    // ── Dedicated backend no-key fallback ─────────────────────────────────────
    if (Date.now() >= backendFallbackMutedUntil) {
        try {
            const params = new URLSearchParams({ q: query, maxResults: String(maxResults) });
            const response = await axios.get(`${GIGA_URL}/api/youtube/search?${params.toString()}`);
            const ids: string[] = Array.isArray(response.data?.videoIds) ? response.data.videoIds : [];
            if (ids.length > 0) {
                console.log(`[YouTubeService] ✅ Backend fallback found ${ids.length} videos (${response.data?.source || 'unknown'})`);
                return ids.map(id => ({ videoId: id, title: '', channelTitle: '' }));
            }
        } catch (e: any) {
            backendFallbackMutedUntil = Date.now() + BACKEND_FALLBACK_COOLDOWN_MS;
            console.warn(`[YouTubeService] Backend fallback failed: ${e.message}`);
        }
    }

    return [];
}

// ─── Main Export ──────────────────────────────────────────────────────────────

/**
 * Smart search with:
 * - Tiered query fallbacks (clean queries first, "4K" only as last resort)
 * - Local scoring (title relevance + quality signals + banlist penalties)
 * - Session cache + in-flight dedup
 *
 * Returns video IDs sorted by score descending. The caller should use index [0].
 */
export interface TrailerResult {
    videoId: string;
    isTeaser: boolean;
}

export const searchTrailersWithFallback = async (
    options: SearchOptions,
    maxResults: number = 5
): Promise<string[]> => {

    const cacheKey = `${options.title}::${options.year || ''}::${options.type || ''}::${maxResults}`;

    if (resultCache.has(cacheKey)) {
        const cached = resultCache.get(cacheKey)!;
        if (cached.length >= Math.min(maxResults, 1)) return cached;
        resultCache.delete(cacheKey);
    }

    if (inFlight.has(cacheKey)) {
        return inFlight.get(cacheKey)!;
    }

    const searchPromise = (async () => {
        // Global throttle — queues concurrent card/hero requests
        const now = Date.now();
        const timeSinceLast = now - lastSearchTime;
        if (timeSinceLast < GLOBAL_SEARCH_THROTTLE_MS) {
            await sleep(GLOBAL_SEARCH_THROTTLE_MS - timeSinceLast);
        }
        lastSearchTime = Date.now();

        const queries = buildSearchQueries(options);
        const underQuotaPressure = allKeysExhaustedUntil > Date.now();
        const effectiveQueries = underQuotaPressure ? queries.slice(0, 2) : queries;
        const seenIds = new Set<string>();
        const allCandidates: YTCandidate[] = [];

        // Run queries in order, stopping early if we have enough strong candidates.
        // We continue past the first query because later queries (e.g. unquoted fallback)
        // can surface different high-quality candidates, and scoring will pick the best one.
        for (const query of effectiveQueries) {
            try {
                const results = await executeSearch(query, maxResults);
                for (const candidate of results) {
                    if (!seenIds.has(candidate.videoId)) {
                        seenIds.add(candidate.videoId);
                        allCandidates.push(candidate);
                    }
                }

                // If we already have enough candidates with real metadata, stop early
                const withMeta = allCandidates.filter(c => c.title.length > 0);
                if (withMeta.length >= maxResults * 2) break;

            } catch (error: any) {
                console.error('[YouTubeService] Query failed:', query, error.message);
            }
        }

        if (allCandidates.length === 0) {
            resultCache.set(cacheKey, []);
            saveCache();
            return [];
        }

        // Score and sort — best match + quality signals wins
        const scored = allCandidates
            .map(c => ({ ...c, score: scoreCandidate(options, c) }))
            .sort((a, b) => b.score - a.score);

        if (import.meta.env.DEV) {
            console.log(`[YouTubeService] Scored candidates for "${options.title}":`,
                scored.slice(0, 5).map(c => `[${c.score}] ${c.title} — ${c.channelTitle}`)
            );
        }

        const videoIds = scored.map(c => c.videoId).slice(0, maxResults);

        // Track which winning video was a teaser so useTrailer can adjust skip time
        if (scored.length > 0) {
            const winner = scored[0];
            if (/\bteaser\b/i.test(winner.title) && !/\btrailer\b/i.test(winner.title)) {
                teaserCache.add(winner.videoId);
            } else {
                teaserCache.delete(winner.videoId);
            }
        }

        resultCache.set(cacheKey, videoIds);
        saveCache();
        return videoIds;
    })();

    inFlight.set(cacheKey, searchPromise);
    const result = await searchPromise;
    inFlight.delete(cacheKey);
    return result;
};

/**
 * Like searchTrailersWithFallback but returns the top result with metadata.
 * Used by useTrailer to surface isTeaser so TrailerPlayer can adjust skip time.
 */
export const searchTrailerWithMeta = async (
    options: SearchOptions
): Promise<TrailerResult | null> => {
    const ids = await searchTrailersWithFallback(options, 5);
    if (ids.length === 0) return null;
    // Re-fetch the scored list from cache to get the title of the winner
    const cacheKey = `${options.title}::${options.year || ''}::${options.type || ''}::5`;
    // Winner is the first id; detect teaser from candidate title if still in the result cache
    // We don't persist titles in cache, so we use the query title as a heuristic
    // The real detection: if the winner's score came primarily from 'teaser', flag it
    // Since we can't re-read per-candidate titles post-cache, we flag via a secondary teaser cache
    const winnerIsTeaser = teaserCache.has(ids[0]);
    return { videoId: ids[0], isTeaser: winnerIsTeaser };
};

// ─── Backward Compatibility ───────────────────────────────────────────────────

export const searchTrailers = async (query: string, maxResults: number = 5): Promise<string[]> => {
    return searchTrailersWithFallback({ title: query }, maxResults);
};

export const searchTrailer = async (query: string): Promise<string | null> => {
    const results = await searchTrailers(query, 1);
    return results.length > 0 ? results[0] : null;
};