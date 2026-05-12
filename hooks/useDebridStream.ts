/**
 * useDebridStream — AllDebrid stream resolver (browser-direct).
 *
 * Pipeline:
 *   1. Check sessionStorage cache → return immediately if valid CDN URL exists
 *   2. GET /api/torrent/sources (HF backend) → quality-sorted magnet list
 *   3. Cascade through up to 5 sources against AllDebrid until one is cached:
 *      a. POST /v4/magnet/upload  → check ready status (instant cache check)
 *      b. GET  /v4/magnet/files   → extract file list (AllDebrid uses "e" key for entries)
 *      c. GET  /v4/link/unlock    → short alldebrid.com/f/ link → actual CDN URL
 *   4. Write result to sessionStorage (6h TTL) — subsequent refreshes skip all 4 steps
 *
 * Quality priority: 1080p HDR/Web > 1080p > 4K Web > 4K Remux (huge files) > 720p
 * This avoids 50-80 GB remuxes that require 80+ Mbps sustained on typical home connections.
 * Users can always switch to 4K via the source picker in the player.
 */

import { useState, useCallback, useRef } from 'react';

const BACKEND_URL    = (import.meta as any).env?.VITE_GIGA_BACKEND_URL || 'https://ibrahimar397-pstream-giga.hf.space';
const ALLDEBRID_KEY  = (import.meta as any).env?.VITE_ALLDEBRID_KEY   || '';
const ALLDEBRID_API  = 'https://api.alldebrid.com/v4';
const AGENT          = 'pstream';
const CACHE_TTL_MS   = 6 * 60 * 60 * 1000; // 6h — AllDebrid CDN links don't expire in this window
const MAX_TRY        = 6;                   // Try up to 6 sources before giving up

const TRACKERS = [
    'udp://open.demonii.com:1337',
    'udp://tracker.openbittorrent.com:80',
    'udp://tracker.opentrackr.org:1337',
    'udp://tracker.coppersurfer.tk:6969',
].map(t => `tr=${encodeURIComponent(t)}`).join('&');

type MediaType = 'movie' | 'tv';
interface DebridStreamState {
    streamUrl: string | null;
    name:      string | null;
    loading:   boolean;
    error:     string | null;
    seeders:   number | null;
    quality:   string | null;
    subtitles?: { url: string; label: string; lang: string }[];
    alternatives?: Array<{ url: string; name: string; quality: string; seeders: number }>;
}

interface CacheEntry {
    url:     string;
    name:    string;
    quality: string;
    seeders: number;
    ts:      number;
    subtitles?: { url: string; label: string; lang: string }[];
    alternatives?: Array<{ url: string; name: string; quality: string; seeders: number }>;
}

// ── Session cache helpers ─────────────────────────────────────────────────────
function makeCacheKey(imdbId: string, type: string, season?: number, episode?: number): string {
    return `pstream_debrid:${imdbId}:${type}:${season || 0}:${episode || 0}`;
}

function readCache(key: string): CacheEntry | null {
    try {
        const raw = sessionStorage.getItem(key);
        if (!raw) return null;
        const entry: CacheEntry = JSON.parse(raw);
        if (Date.now() - entry.ts > CACHE_TTL_MS) { sessionStorage.removeItem(key); return null; }
        return entry;
    } catch { return null; }
}

function writeCache(key: string, entry: Omit<CacheEntry, 'ts'>): void {
    try { sessionStorage.setItem(key, JSON.stringify({ ...entry, ts: Date.now() })); } catch {}
}

// ── Quality scoring ───────────────────────────────────────────────────────────
// Prefers 1080p variants (smaller files, fast to stream) over 4K remuxes.
// 4K Web-DL/WEB-Rip are smaller than remuxes so they score better than raw remux.
function qualityScore(q: string = '', name: string = ''): number {
    const lc = `${q} ${name}`.toLowerCase();
    let score = 0;

    // Base resolution ranking
    if (lc.includes('1080') && (lc.includes('remux') || lc.includes('bluray'))) score = 7;
    else if (lc.includes('1080') && lc.includes('hdr'))  score = 6;
    else if (lc.includes('1080') && lc.includes('web'))  score = 5;
    else if (lc.includes('1080'))                        score = 4;
    else if ((lc.includes('4k') || lc.includes('2160')) && lc.includes('web')) score = 3;
    else if (lc.includes('4k') || lc.includes('2160'))   score = 2; // likely huge remux
    else if (lc.includes('720'))                         score = 1;

    // Audio Compatibility & Source Reliability (Browsers cannot play AC3, EAC3, TrueHD, DTS natively)
    // WEB-DL/WEB-Rip from streaming services (AMZN, NF, DSNP, etc.) almost always use AAC or Opus.
    const isWebSource = lc.includes('web-dl') || lc.includes('webrip') || lc.includes('web-rip') || 
                        lc.includes('amzn') || lc.includes('nf.') || lc.includes('dsnp') || 
                        lc.includes('hulu') || lc.includes('hbo') || lc.includes('itunes') ||
                        lc.includes('atvp');

    if (lc.includes('aac') || lc.includes('mp3') || lc.includes('opus') || 
        lc.includes('2.0') || lc.includes('stereo') || isWebSource) {
        score += 15.0; // Heavily prefer browser-native codecs and streaming-optimized sources
    }
    
    // Penalize unsupported surround codecs aggressively
    if (lc.includes('truehd') || lc.includes('atmos') || lc.includes('dts-hd') || lc.includes('dtshd')) {
        score -= 30.0;
    } else if (lc.includes('dts') || lc.includes('ac3') || lc.includes('eac3') || 
               lc.includes('dd5.1') || lc.includes('ddp') || lc.includes('dd+') || 
               lc.includes('5.1') || lc.includes('7.1')) {
        // Bluray rips often have AC3/DTS even if not explicitly labeled, 
        // so we penalize generic 5.1/7.1 tags unless a supported codec is also present.
        if (!lc.includes('aac') && !lc.includes('opus')) {
            score -= 20.0;
        }
    }

    // Language Scoring (Heavily penalize non-English dubbed versions for default pick)
    const nonEngKeywords = [
        'french', 'truefrench', 'vf', 'vostfr', 'multi-vf',
        'ita', 'italian',
        'german', 'ger', 'deutsch',
        'spa', 'espanol', 'latino', 'spanish',
        'rus', 'russian', 'hindi', 'tamil', 'telugu', 'kannada', 'malayalam',
        'por', 'portuguese', 'brazilian',
        'pol', 'polish', 
        'tur', 'turkish', 
        'nld', 'dutch', 'flemish',
        'cze', 'czech', 
        'swe', 'swedish', 'dan', 'danish', 'fin', 'finnish', 'nor', 'norwegian',
        'kor', 'korean', 'jpn', 'japanese', 'chi', 'chinese', 'zho', 'mandarin', 'cantonese',
        'dubbed' // heavily penalize generic "dubbed" tags unless explicitly multi
    ];
    for (const kw of nonEngKeywords) {
        const regex = new RegExp(`\\b${kw}\\b`, 'i');
        if (regex.test(lc) && !lc.includes('multi')) {
            score -= 100;
        }
    }

    return score;
}

// ── File extraction ───────────────────────────────────────────────────────────
// AllDebrid file structure: folders use "e" for entries, files have "l" (link) + "s" (size)
function findBestFileUrl(files: any[], targetIdx: number | null = null, season?: number, episode?: number): string | null {
    const flat: { name: string; size: number; url: string }[] = [];

    function flatten(items: any[]) {
        for (const item of items || []) {
            if (item.l) flat.push({ name: item.n || '', size: item.s || 0, url: item.l });
            if (item.e)     flatten(item.e);
            if (item.files) flatten(item.files);
        }
    }

    flatten(files);
    if (!flat.length) return null;

    // 1. If it's a TV show, try to find the specific episode file by name
    if (season != null && episode != null) {
        const sPad = String(season).padStart(2, '0');
        const ePad = String(episode).padStart(2, '0');
        
        const patterns = [
            new RegExp(`[sS]${sPad}[eE]${ePad}\\b`), // S01E02
            new RegExp(`[sS]${season}[eE]${ePad}\\b`), // S1E02
            new RegExp(`\\b${season}x${ePad}\\b`), // 1x02
            new RegExp(`[eE]${ePad}\\b`), // E02
            new RegExp(`\\b${ePad}\\b`) // 02
        ];

        for (const regex of patterns) {
            const matches = flat.filter(f => regex.test(f.name) && /\.(mp4|mkv|m4v|avi)$/i.test(f.name));
            if (matches.length === 1) return matches[0].url; // Perfect single match
            if (matches.length > 1) {
                // If multiple matches (e.g. sample files), pick the largest
                matches.sort((a, b) => b.size - a.size);
                return matches[0].url;
            }
        }
    }

    // 2. Fallback to Torrentio's targetIdx if provided
    if (targetIdx != null && flat[targetIdx]) return flat[targetIdx].url;

    // 3. Absolute fallback: Largest video file
    flat.sort((a, b) => b.size - a.size);

    return flat[0].url;
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useDebridStream() {
    const [state, setState] = useState<DebridStreamState>({
        streamUrl: null,
        name:      null,
        loading:   false,
        error:     null,
        seeders:   null,
        quality:   null,
        subtitles: [],
    });

    const abortRef = useRef<AbortController | null>(null);

    const resolve = useCallback(async (
        imdbId:   string,
        type:     MediaType,
        season?:  number,
        episode?: number,
        title?:   string,
        tmdbId?:  string
    ): Promise<string | null> => {
        if (!ALLDEBRID_KEY) {
            console.warn('[DebridStream] No VITE_ALLDEBRID_KEY — skipping');
            return null;
        }

        if (abortRef.current) abortRef.current.abort();
        abortRef.current = new AbortController();
        const signal = abortRef.current.signal;

        setState({ streamUrl: null, name: null, loading: true, error: null, seeders: null, quality: null, subtitles: [] });

        const ck = makeCacheKey(imdbId, type, season, episode);

        try {
            // ── Cache hit ──────────────────────────────────────────────────────────
            const cached = readCache(ck);
            if (cached) {
                console.log(`[DebridStream] 💾 Cache: ${cached.quality} | ${cached.url.substring(0, 60)}...`);
                setState({ streamUrl: cached.url, name: cached.name, loading: false, error: null, seeders: cached.seeders, quality: cached.quality, subtitles: cached.subtitles || [] });
                return JSON.stringify({ streamUrl: cached.url, name: cached.name, quality: cached.quality, seeders: cached.seeders });
            }

            // ── Step 1: Fetch quality-sorted sources from backend ──────────────────
            const params = new URLSearchParams({ imdbId, type });
            if (season)  params.set('season',  String(season));
            if (episode) params.set('episode', String(episode));
            if (title)   params.set('title',   title);
            if (tmdbId)  params.set('tmdbId',  tmdbId);

            const sourcesRes = await fetch(`${BACKEND_URL}/api/torrent/sources?${params}`, { signal });
            if (!sourcesRes.ok) {
                const body = await sourcesRes.json().catch(() => ({}));
                throw new Error(body.error || `Sources ${sourcesRes.status}`);
            }

            const { streams, subtitles } = await sourcesRes.json();
            if (!streams?.length) throw new Error('No torrent sources found');

            // Re-sort: prefer 1080p streamable over 4K remux
            const sorted = [...streams].sort((a, b) => {
                const sd = qualityScore(b.quality, b.name) - qualityScore(a.quality, a.name);
                return sd !== 0 ? sd : (b.seeders || 0) - (a.seeders || 0);
            });

            console.log(`[DebridStream] ${sorted.length} sources. Top: ${sorted.slice(0, 3).map(s => s.quality).join(', ')}`);

            // ── Steps 2–4: Cascade through sources until one is AllDebrid-cached ───
            const alternatives: Array<{ url: string; name: string; quality: string; seeders: number }> = [];

            for (const candidate of sorted.slice(0, MAX_TRY)) {
                if (signal.aborted) break;
                if (alternatives.length >= 10) break;

                try {
                    // 2a: Upload magnet (idempotent) — tells us if it's instant
                    const magnet = `magnet:?xt=urn:btih:${candidate.infoHash}&${TRACKERS}`;
                    const upRes  = await fetch(
                        `${ALLDEBRID_API}/magnet/upload?agent=${AGENT}&apikey=${ALLDEBRID_KEY}&magnets[]=${encodeURIComponent(magnet)}`,
                        { signal }
                    );
                    const upData = await upRes.json();
                    if (upData?.status !== 'success') continue;

                    const mInfo = upData?.data?.magnets?.[0];
                    if (!mInfo?.ready) {
                        console.log(`[DebridStream] ⏳ ${candidate.quality} not cached → next`);
                        continue;
                    }

                    // 2b: Fetch file list
                    const fRes  = await fetch(
                        `${ALLDEBRID_API}/magnet/files?agent=${AGENT}&apikey=${ALLDEBRID_KEY}&id[]=${mInfo.id}`,
                        { signal }
                    );
                    const fData = await fRes.json();
                    const fInfo = fData?.data?.magnets?.[0];
                    const fList = fInfo?.files ?? mInfo.files ?? [];

                    const shortUrl = findBestFileUrl(fList, candidate.fileIdx ?? null, type === 'tv' ? season : undefined, type === 'tv' ? episode : undefined);
                    if (!shortUrl) continue;

                    // 2c: Unlock short link → CDN URL
                    const uRes  = await fetch(
                        `${ALLDEBRID_API}/link/unlock?agent=${AGENT}&apikey=${ALLDEBRID_KEY}&link=${encodeURIComponent(shortUrl)}`,
                        { signal }
                    );
                    const uData = await uRes.json();
                    const cdnUrl = uData?.data?.link;
                    if (!cdnUrl) continue;

                    alternatives.push({
                        url: cdnUrl,
                        name: candidate.name,
                        quality: candidate.quality || 'Auto',
                        seeders: candidate.seeders || 0
                    });

                    // Update state progressively as we find them
                    setState(prev => ({
                        ...prev,
                        streamUrl: alternatives[0].url,
                        name: alternatives[0].name,
                        quality: alternatives[0].quality,
                        seeders: alternatives[0].seeders,
                        loading: false,
                        subtitles: subtitles || [],
                        alternatives: [...alternatives]
                    }));

                } catch (e: any) {
                    if (e.name === 'AbortError') throw e;
                    console.warn(`[DebridStream] Candidate failed: ${e.message}`);
                }
            }

            if (alternatives.length === 0) throw new Error('None of the top sources are cached on AllDebrid');

            const winner = alternatives[0];
            console.log(`[DebridStream] ✅ Found ${alternatives.length} alternatives. Best: ${winner.quality}`);

            writeCache(ck, { 
                url: winner.url, 
                name: winner.name || '',
                quality: winner.quality || 'auto', 
                seeders: winner.seeders || 0,
                subtitles: subtitles || [],
                alternatives: alternatives
            });

            setState({ 
                streamUrl: winner.url, 
                name: winner.name || null, 
                loading: false, 
                error: null, 
                seeders: winner.seeders, 
                quality: winner.quality || null,
                subtitles: subtitles || [],
                alternatives: alternatives
            });
            return JSON.stringify({ streamUrl: winner.url, quality: winner.quality, seeders: winner.seeders, alternatives });

        } catch (err: any) {
            if (err.name === 'AbortError') return null;
            const msg = err.message || 'AllDebrid resolution failed';
            setState(prev => ({ ...prev, loading: false, error: msg }));
            console.warn('[DebridStream] ❌', msg);
            return null;
        }
    }, []);

    const reset = useCallback(() => {
        if (abortRef.current) abortRef.current.abort();
        setState({ streamUrl: null, name: null, loading: false, error: null, seeders: null, quality: null });
    }, []);

    /** Clear the session cache for a specific piece of content (e.g. after a broken link). */
    const clearCache = useCallback((imdbId: string, type: string, season?: number, episode?: number) => {
        try { sessionStorage.removeItem(makeCacheKey(imdbId, type, season, episode)); } catch {}
    }, []);

    return { ...state, resolve, reset, clearCache };
}
