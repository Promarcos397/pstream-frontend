import axios from 'axios';
import { newPipeSearch, isNewPipeAvailable } from './NewPipeService';
import { YOUTUBE_DISABLED } from './youtubeDisabled';

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

    const isTv = type === 'tv';
    const primary = isTv
        ? `"${clean}" tv show season trailer 4k`
        : `"${clean}" movie trailer 4k`;

    const queries: string[] = [primary];

    // Dynamic fallbacks: keep simple and resilient when primary query is noisy.
    queries.push(`"${clean}" official trailer`);
    queries.push(`"${clean}" trailer`);

    if (year) {
        queries.push(`"${clean}" ${year} official trailer`);
        queries.push(`"${clean}" ${year} trailer`);
    }

    if (isTv) {
        queries.push(`"${clean}" tv show trailer`);
    } else {
        queries.push(`"${clean}" movie official trailer`);
    }

    // Deduplicate while preserving order
    return [...new Set(queries)];
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

// Known official / high-quality channels — bump score for these
const TRUSTED_CHANNEL_PATTERNS = [
    /official/i,
    /studios?/i,
    /entertainment/i,
    /pictures/i,
    /marvel/i,
    /warner/i,
    /disney/i,
    /paramount/i,
    /sony/i,
    /universal/i,
    /netflix/i,
    /amazon/i,
    /hbo/i,
    /hulu/i,
    /apple tv/i,
    /a24/i,
    /lionsgate/i,
    /mgm/i,
    /20th century/i,
    /dreamworks/i,
    /pixar/i,
    /hdrx/i,     // HDR/4K reupload channels known to post quality content
    /dolby/i,
    /imax/i,
];

// Words that strongly suggest the video is NOT a clean official trailer
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
    /\bclips?\b/i,
    /\bscene\b/i,
    /behind\s+the\s+scenes/i,
    /featurette/i,
    /interview/i,
    /making\s+of/i,
    /\banalysis\b/i,
    /top\s+\d+/i,
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

    // Type-aware relevance: soft guidance (never hard-fail)
    if (isTv) {
        if (/\btv\b|\bseries\b|\bseason\b|\bshow\b/.test(t)) score += 12;
        if (/\bmovie\b|\bfilm\b/.test(t)) score -= 8;
    } else if (isMovie) {
        if (/\bmovie\b|\bfilm\b/.test(t)) score += 10;
        if (/\bseason\b|\bepisode\b|\btv\b|\bseries\b/.test(t)) score -= 8;
    }

    // ── Trailer quality signals ──────────────────────────────────────────────

    if (/official\s+trailer/.test(t)) score += 20;
    else if (/trailer/.test(t)) score += 12;

    if (/final\s+trailer/.test(t)) score += 6;
    if (/\bteaser\b/.test(t)) score += 5;

    // Bonus for old classics that got a community upgrade
    if (/remaster(ed)?/i.test(candidate.title) || /restored/i.test(candidate.title)) score += 8;

    // Quality/resolution keywords are secondary to relevance
    if (/\b4k\b/.test(t) || /\b2160p\b/.test(t)) score += 10;
    if (/\bhdr\b/.test(t)) score += 6;
    if (/\bimax\b/.test(t)) score += 6;
    if (/\b1440p\b/.test(t)) score += 4;
    if (/\b1080p\b/.test(t)) score += 3;

    // ── Channel trust ────────────────────────────────────────────────────────

    for (const pattern of TRUSTED_CHANNEL_PATTERNS) {
        if (pattern.test(candidate.channelTitle)) {
            score += 10;
            break; // Only count once
        }
    }

    // ── Penalize non-trailer content ─────────────────────────────────────────

    for (const pattern of BANLIST_PATTERNS) {
        if (pattern.test(candidate.title)) {
            score -= 40;
            break; // One penalty is enough — don't stack
        }
    }

    return score;
}

// ─── Search Execution ─────────────────────────────────────────────────────────

/**
 * Execute a single YouTube search query.
 * Returns full YTCandidate objects (videoId + snippet metadata) for scoring.
 * Falls back to scraper proxy if all API keys are exhausted.
 */
async function executeSearch(query: string, maxResults: number): Promise<YTCandidate[]> {
    // ── 0. NewPipe (yt-dlp) — zero quota, our own infrastructure ────────────
    if (isNewPipeAvailable()) {
        try {
            // Build structured options from raw query string for better scoring
            const nResults = await newPipeSearch(
                { title: query, type: query.toLowerCase().includes('season') ? 'tv' : 'movie' },
                maxResults
            );
            if (nResults.length > 0) {
                console.log(`[YouTubeService] ⚡ NewPipe returned ${nResults.length} results`);
                // Return with empty title/channel — scoring will use score 0 baseline,
                // which is fine since NewPipe already scored them server-side.
                return nResults.map(id => ({ videoId: id, title: '', channelTitle: '' }));
            }
        } catch (e: any) {
            console.warn('[YouTubeService] NewPipe search failed, falling through:', e.message);
        }
    }

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
                    videoDefinition: 'high', // Filter to HD-capable videos at search level
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

    // Important: avoid legacy /proxy/stream YouTube scraping fallback.
    // That route is stream-oriented and can flood logs with 500s on HTML fetches.
    // Keep trailer lookup quiet here when backend no-key fallback returns empty.
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
export const searchTrailersWithFallback = async (
    options: SearchOptions,
    maxResults: number = 5
): Promise<string[]> => {
    // ── Kill switch: YouTube entirely disabled ──────────────────────────────
    if (YOUTUBE_DISABLED) return [];

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

        if (process.env.NODE_ENV === 'development') {
            console.log(`[YouTubeService] Scored candidates for "${options.title}":`,
                scored.slice(0, 5).map(c => `[${c.score}] ${c.title} — ${c.channelTitle}`)
            );
        }

        const videoIds = scored.map(c => c.videoId).slice(0, maxResults);
        resultCache.set(cacheKey, videoIds);
        saveCache();
        return videoIds;
    })();

    inFlight.set(cacheKey, searchPromise);
    const result = await searchPromise;
    inFlight.delete(cacheKey);
    return result;
};

// ─── Backward Compatibility ───────────────────────────────────────────────────

export const searchTrailers = async (query: string, maxResults: number = 5): Promise<string[]> => {
    return searchTrailersWithFallback({ title: query }, maxResults);
};

export const searchTrailer = async (query: string): Promise<string | null> => {
    const results = await searchTrailers(query, 1);
    return results.length > 0 ? results[0] : null;
};