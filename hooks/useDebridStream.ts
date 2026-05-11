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
}

interface CacheEntry {
    url:     string;
    name:    string;
    quality: string;
    seeders: number;
    ts:      number;
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

    // Audio Compatibility Adjustments
    if (lc.includes('aac') || lc.includes('stereo') || lc.includes('2.0') || lc.includes('mp3')) {
        score += 0.5;
    }
    if (lc.includes('dts-hd') || lc.includes('truehd') || lc.includes('atmos')) {
        score -= 1.5;
    }
    if (lc.includes('dts') && !lc.includes('aac')) {
        score -= 0.5;
    }

    // Language Scoring (Heavily penalize non-English dubbed versions for default pick)
    const nonEngKeywords = [
        'french', 'truefrench', 'vf', 'vostfr', 'fr', 
        'ita', 'italian', 'german', 'ger', 'deutsch', 
        'spa', 'spanish', 'espanol', 'latino', 'hindi'
    ];
    
    // Check for exact word matches to avoid false positives (e.g., "transformer" vs "fr")
    const isExplicitlyNonEnglish = nonEngKeywords.some(keyword => {
        const regex = new RegExp(`\\b${keyword}\\b`, 'i');
        return regex.test(lc);
    });

    if (isExplicitlyNonEnglish) {
        if (lc.includes('multi')) {
            score -= 1.0; // Multi has English but might default to wrong track in browser
        } else {
            score -= 10.0; // Purely dubbed version — almost never desired as default
        }
    }

    // Boost for Original Version / English keywords
    if (lc.includes('english') || lc.includes('eng') || /\bvo\b/i.test(lc)) {
        score += 0.5;
    }

    return score;
}

// ── File extraction ───────────────────────────────────────────────────────────
// AllDebrid file structure: folders use "e" for entries, files have "l" (link) + "s" (size)
function findBestFileUrl(files: any[], targetIdx: number | null = null): string | null {
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
    if (targetIdx != null && flat[targetIdx]) return flat[targetIdx].url;

    // Primary sort: Size (largest = main feature)
    // Secondary tie-breaker: Browser-friendly formats (.mp4, .m4v)
    flat.sort((a, b) => {
        if (Math.abs(a.size - b.size) > 1024 * 1024) { // > 1MB difference
            return b.size - a.size;
        }
        const isA_MP4 = /\.(mp4|m4v)$/i.test(a.name);
        const isB_MP4 = /\.(mp4|m4v)$/i.test(b.name);
        if (isA_MP4 && !isB_MP4) return -1;
        if (!isA_MP4 && isB_MP4) return 1;
        return b.size - a.size;
    });

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
                setState({ streamUrl: cached.url, name: cached.name, loading: false, error: null, seeders: cached.seeders, quality: cached.quality });
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
            let finalUrl: string | null = null;
            let winner: any            = null;

            for (const candidate of sorted.slice(0, MAX_TRY)) {
                if (signal.aborted) break;

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

                    const shortUrl = findBestFileUrl(fList, candidate.fileIdx ?? null);
                    if (!shortUrl) continue;

                    // 2c: Unlock short link → CDN URL
                    const uRes  = await fetch(
                        `${ALLDEBRID_API}/link/unlock?agent=${AGENT}&apikey=${ALLDEBRID_KEY}&link=${encodeURIComponent(shortUrl)}`,
                        { signal }
                    );
                    const uData = await uRes.json();
                    const cdnUrl = uData?.data?.link;
                    if (!cdnUrl) continue;

                    finalUrl = cdnUrl;
                    winner   = candidate;
                    
                    // 5. Finalize state
                    setState(prev => ({
                        ...prev,
                        streamUrl: cdnUrl,
                        name: winner.name,
                        quality: winner.quality,
                        seeders: winner.seeders,
                        loading: false
                    }));
                    break;
                } catch (e: any) {
                    if (e.name === 'AbortError') throw e;
                    console.warn(`[DebridStream] Candidate failed: ${e.message}`);
                }
            }

            if (!finalUrl || !winner) throw new Error('None of the top sources are cached on AllDebrid');

            console.log(`[DebridStream] ✅ ${winner.quality} | ${winner.seeders} seeders`);

            writeCache(ck, { 
                url: finalUrl, 
                name: winner.name || '',
                quality: winner.quality || 'auto', 
                seeders: winner.seeders || 0 
            });

            setState({ 
                streamUrl: finalUrl, 
                name: winner.name || null, 
                loading: false, 
                error: null, 
                seeders: winner.seeders, 
                quality: winner.quality || null,
                subtitles: subtitles || []
            });
            return JSON.stringify({ streamUrl: finalUrl, quality: winner.quality, seeders: winner.seeders });

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
