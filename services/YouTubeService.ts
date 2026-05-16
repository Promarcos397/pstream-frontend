import axios from 'axios';


// Parse YouTube API keys from environment variables to avoid hardcoding
const YOUTUBE_API_KEYS: string[] = (import.meta.env.VITE_YOUTUBE_API_KEYS || '').split(',').filter(Boolean);

// Global throttle to prevent spamming Google APIs too hard
let lastSearchTime = 0;
const GLOBAL_SEARCH_THROTTLE_MS = 5;

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

let currentKeyIndex = 0;
let failedKeys = new Set<number>();
let allKeysExhaustedUntil = 0;
const ALL_KEYS_COOLDOWN_MS = 1000 * 60 * 60; // 1 hour

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
    isAnime?: boolean;
    tmdbId?: string;
}

// Full candidate with metadata — needed for local scoring
interface YTCandidate {
    videoId: string;
    title: string;
    channelTitle: string;
    duration?: number;
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
    allKeysExhaustedUntil = Date.now() + ALL_KEYS_COOLDOWN_MS;
    return false;
}

export function resetKeys() {
    failedKeys.clear();
    currentKeyIndex = 0;
    allKeysExhaustedUntil = 0;
}

// ─── Query Building ───────────────────────────────────────────────────────────

/**
 * Build a simple search query for YouTube.
 */
function buildSearchQueries(options: SearchOptions): string[] {
    return [`${options.title} ${options.year || ''} trailer`];
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

const BANLIST_PATTERNS = [
    /fan[\s-]?made/i,
    /\breaction\b/i,
    /\breview\b/i,
    /\bmovieclips\b/i,
    /\bclips\b/i,
    /\bmovieclip\b/i,
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
    /\brotten\s+tomatoes\b/i,
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
    const isAnime = !!options.isAnime;

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
        if (/\bseason\b/.test(t)) score += 25;
        if (/\bmovie\b|\bfilm\b|\bepisode\b/.test(t)) score -= 40;
    } else if (isMovie) {
        if (/\bmovie\b|\bfilm\b/.test(t)) score += 20;
        if (/\bseason\b|\bepisode\b|\btv\b|\bseries\b/.test(t)) score -= 40;
    }
    if (isAnime) {
        if (/\banime\b/.test(t)) score += 50;
        if (/\bfull\s+episode\b|\bfull\s+episodes\b|full\s+anime\b|full\s+movie\b|full\s+anime\s+movie|\blive\s+action\b/.test(t)) score -= 100;
    }

    // ── Trailer quality signals ──────────────────────────────────────────────

    if (/\btrailer\b/.test(t)) score += 45;
    if (/\bteaser\b/.test(t)) score += 100;
    if (/\bofficial\b/i.test(t)) score += 25;

    // Quality/resolution keywords are secondary to relevance
    if (/\b4k\b/.test(t)) score += 120;
    if (/\bhdr\b/.test(t)) score += 50;
    if (/\bhd\b/.test(t)) score += 75;
    // ── Regional & Annoying Content Penalties (Smart Ban) ──────────────────

    // 1. Regional / Localized Versions — title-level ban
    //    Any of these keywords in the title strongly signals a non-English dub/sub version
    if (/\b(India|Indian|Hindi|Tamil|Telugu|Malayalam|Kannada|Bengali|Punjabi|Marathi|Gujarati|Bhojpuri|Urdu|Pakistan|Pakistani|Bangladesh|Sri\s*Lanka|Nepal|Nepali)\b/i.test(t) ||
        /\b(Brazil|Brasil|Brazilian|Brasileira|Português|Portuguese|Portugal)\b/i.test(t) ||
        /\b(Español|Spanish|Espanol|Castellano|Latino|Latin\s*America|Mexico|México|Argentina|Chile|Colombia|Venezuela|Peru)\b/i.test(t) ||
        /\b(Français|French|France|Québec|Quebec|VOSTFR|VF\b)\b/i.test(t) ||
        /\b(Deutsch|German|Germany|Österreich|Austria|Schweiz|Switzerland)\b/i.test(t) ||
        /\b(Italiano|Italian|Italy|Italia)\b/i.test(t) ||
        /\b(Türk|Turkish|Turkey|Türkiye)\b/i.test(t) ||
        /\b(Русский|Russian|Russia|Россия)\b/i.test(t) ||
        /\b(Arabic|العربية|Arab|Kuwait|Saudi|UAE|Egypt|Mısır)\b/i.test(t) ||
        /\b(Korean|한국어|Korea|Kore)\b/i.test(t) ||
        /\b(Thai|Thailand|ภาษาไทย)\b/i.test(t) ||
        /\b(Vietnamese|Vietnam|Việt)\b/i.test(t) ||
        /\b(Indonesian|Bahasa|Indonesia)\b/i.test(t) ||
        /\b(Malay|Malaysia|Melayu)\b/i.test(t) ||
        /\b(Filipino|Philippines|Tagalog)\b/i.test(t) ||
        /\b(Polish|Polski|Poland|Polska)\b/i.test(t) ||
        /\b(Dutch|Nederlands|Holland)\b/i.test(t) ||
        /\b(Swedish|Svenska|Sweden)\b/i.test(t) ||
        /\b(Romanian|Română|Romania)\b/i.test(t) ||
        /\b(Czech|Česky|Čeština)\b/i.test(t) ||
        /\b(Hungarian|Magyar|Hungary)\b/i.test(t) ||
        /\b(Greek|Ελληνικά|Greece)\b/i.test(t) ||
        /\b(Rotten Tomatoes|rotton|tomatoes)\b/i.test(t) ||
        /\b(Dubbed|Dub\b|Subbed|Sub\b|Subtitulado|Legendado|Dublado|Altyazı|Subtitrare)\b/i.test(t)
    ) {
        score -= 150;
    }

    // 1b. Channel-name regional ban — catches localized channels with clean-looking titles
    if (/\b(India|Indian|Bollywood|Hindi|Tamil|Telugu|Malayalam|Kannada|Bengali|Punjabi|Bhojpuri|Desi)\b/i.test(c) ||
        /\b(Brazil|Brasil|Brasileiro|Brasileira|Português|Lusofon)\b/i.test(c) ||
        /\b(Español|Latino|Latinoamerica|Mexico|México|Argentina|Colombia|Chile)\b/i.test(c) ||
        /\b(Français|French|France)\b/i.test(c) ||
        /\b(Deutsch|German|Germany)\b/i.test(c) ||
        /\b(Louisiana|Cajun|Acadian)\b/i.test(c) ||
        /\b(Texas|Texan)\b/i.test(c) ||
        /\b(Florida|Floridian)\b/i.test(c) ||
        /\b(New York|New Yorker)\b/i.test(c) ||
        /\b(Los Angeles|Los Angeles)\b/i.test(c) ||
        /\b(Egyptian|egypt)\b/i.test(c) ||
        /\b(Türk|Turkish|Turkey)\b/i.test(c) ||
        /\b(Arab|Arabic|Saudi|Kuwait|Egyptian)\b/i.test(c) ||
        /\b(Korean|한국|Korea)\b/i.test(c) ||
        /\b(Thai|Thailand)\b/i.test(c) ||
        /\b(Vietnam|Viet|Việt)\b/i.test(c) ||
        /\b(Indonesia|Bahasa|Melayu|Malaysia)\b/i.test(c) ||
        /\b(Filipino|Pinoy|Philippines)\b/i.test(c) ||
        /\b(Russian|Россия|Русский)\b/i.test(c) ||
        /\b(Polish|Polska)\b/i.test(c) ||
        /\b(Dubbed|Dub|Dubbing|Subbed)\b/i.test(c) ||
        /\b(Rotten Tomatoes|rotton|tomatoes)\b/i.test(c)
    ) {
        score -= 150;
    }

    // 2. Meta-Content & Analysis (Not the actual trailer)
    if (/\b(Reaction|Review|Breakdown|Explained|Ending\s*Explained|Hidden\s*Details|Easter\s*Eggs|Theory|Analysis|Discussion|specials|special|fake|hot_take|hot_takes|hot\s*takes|hot\s*take|hotstar|hotstar\s*specials|recap|cast|how\s*they\s*look|then\s*and\s*now)\b/i.test(t)) {
        score -= 200;
    }

    // 3. Alternative Media & Snippets
    if (/\b(Song|Music\s*Video|Soundtrack|OST|Lyrics|Karaoke|Full\s*Movie|Full\s*Episode|Clip|Scene|Gameplay|Game|Walkthrough|Playthrough)\b/i.test(t)) {
        score -= 120;
    }

    // 4. Fake / Fan / Concept Content & Vertical "Shorts"
    if (/\b(Fan\s*Made|Concept|Edit|Fake|Parody|Spoof|Re-cut|Pitch|#Shorts|Shorts|TikTok|Reels|Vertical|Portrait)\b/i.test(t)) {
        score -= 250;
    }

    // 5. Boosting Major Studios / Official Channels
    const studios = /\b(hbo|max|hulu|Crunchyroll|BBC|Paramount|Netflix|WB|Sony|Universal|Fox|MGM|Lionsgate|Miramax|prime|adult\s*swim|cartoon\s*network|disney|apple\s*tv|peacock|amc|the\s*cw|cw\b)\b/i;
    if (studios.test(t) || studios.test(c)) {
        score += 80; // Increased boost for verified studio presence
    }

    // 6. Year boost: Exact match or one year before (trailers often release the year prior)

    if (options.year) {
        const targetYear = parseInt(options.year);
        if (!isNaN(targetYear)) {
            const yearRegex = new RegExp(`\\b${targetYear}\\b`);
            const prevYearRegex = new RegExp(`\\b${targetYear - 1}\\b`);

            if (yearRegex.test(t)) {
                score += 15; // Strong match
            } else if (prevYearRegex.test(t)) {
                score += 15; // Valid trailer window
            }
        }
    }

    // Penalize non-trailer content
    for (const pattern of BANLIST_PATTERNS) {
        if (pattern.test(candidate.title)) { score -= 50; break; }
    }




    return score;
}

// ─── Search Execution ─────────────────────────────────────────────────────────

/**
 * Execute a single YouTube search query.
 * Returns full YTCandidate objects (videoId + snippet metadata) for scoring.
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

    return [];
}

// ─── Main Export ──────────────────────────────────────────────────────────────

/**
 * Smart search with:
 * - Specific title + year query optimization
 * - Local scoring (title relevance + quality signals + banlist penalties)
 * - Session cache + in-flight dedup
 *
 * Returns video IDs sorted by score descending. The caller should use index [0].
 */
export interface TrailerResult {
    videoId: string;
    isTeaser: boolean;
    title?: string;
    channelTitle?: string;
    isDirect?: boolean;
}

export const searchTrailers = async (
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
        const effectiveQueries = queries;
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

                // SPEED OPTIMIZATION: If first query gave us ANY results, 
                // stop here immediately. Sequential queries add 1-2s of latency.
                if (allCandidates.length >= 1) break;

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

        // ── Smarter, Structured Logging ──────────────────────────────────────
        const logTitle = `[YouTubeService] 🔍 "${options.title}" (${options.type ?? 'unknown'}${options.year ? `, ${options.year}` : ''})`;
        console.groupCollapsed(logTitle);
        console.log("Context:", { ...options, queries: effectiveQueries });
        
        const tableData = scored.slice(0, 10).map((c, i) => ({
            Rank: i === 0 ? '🏆 Winner' : `#${i + 1}`,
            Score: c.score,
            Title: c.title,
            Channel: c.channelTitle,
            Link: `https://youtu.be/${c.videoId}`
        }));
        
        console.table(tableData);
        if (scored.length > 10) console.log(`... and ${scored.length - 10} more candidates found.`);
        console.groupEnd();

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

// Manual Premium Overrides: Map TMDB IDs to direct high-quality video URLs
// Format: "tmdb-ID": "URL"
const PREMIUM_OVERRIDES: Record<string, string> = {
    "tmdb-4586": "https://res.cloudinary.com/dadwuvdhr/video/upload/v1778862129/1923066622425686017_1_hoiud9.mp4", // Gilmore Girls
};

/**
 * Like searchTrailers but returns the top result with metadata.
 * Used by useTrailer to surface isTeaser so TrailerPlayer can adjust skip time.
 */
export const searchTrailerWithMeta = async (
    options: SearchOptions
): Promise<TrailerResult | null> => {
    const { title, year, type, tmdbId } = options;
    const overrideKey = tmdbId ? `tmdb-${tmdbId}` : null;
    
    // Check for Premium Overrides first
    if (overrideKey && PREMIUM_OVERRIDES[overrideKey]) {
        console.log(`[YouTubeService] 💎 Premium Override found for ${title} (${tmdbId})`);
        return {
            videoId: PREMIUM_OVERRIDES[overrideKey],
            title: `${title} (Premium 4K Trailer)`,
            channelTitle: "P-Stream Premium",
            isDirect: true,
            isTeaser: false
        };
    }

    const ids = await searchTrailers(options, 5);
    if (ids.length === 0) return null;

    // The real detection: if the winner's score came primarily from 'teaser', flag it
    // Since we can't re-read per-candidate titles post-cache, we flag via a secondary teaser cache
    const winnerIsTeaser = teaserCache.has(ids[0]);
    return { videoId: ids[0], isTeaser: winnerIsTeaser };
};