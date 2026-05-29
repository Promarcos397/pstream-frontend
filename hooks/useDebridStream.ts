/**
 * useDebridStream — AllDebrid stream resolver (browser-direct).
 *
 * Pipeline:
 *   1. Check sessionStorage cache → return immediately if valid CDN URL exists
 *   2. Fetch quality-sorted magnet sources from:
 *      a. HF backend  → /api/torrent/sources
 *      b. Frontend addons (Torrentio, Comet, MediaFusion, etc.) in parallel
 *   3. Merge, deduplicate, re-rank, pre-filter wrong TV episodes
 *   4. Waterfall through batches of 10 against AllDebrid until one is cached:
 *      a. POST /v4/magnet/upload  → instant cache check (ready flag)
 *      b. GET  /v4/magnet/files   → extract file list
 *      c. Score + rank individual files (codec, title-match, quality)
 *      d. GET  /v4/link/unlock    → short link → actual CDN URL
 *   5. Write result to sessionStorage (6h TTL)
 *   6. Background cleanup: delete non-winning magnets from AllDebrid account
 *
 * Quality priority: 1080p WEB-DL > 1080p HDR > 1080p BluRay > 4K WEB > 4K Remux > 720p
 * This avoids 50-80 GB remuxes that need 80+ Mbps sustained on home connections.
 *
 * KEY FIXES vs previous version:
 *  - FIX 1: Hash-based magnet→candidate mapping (replaces index-order assumption)
 *  - FIX 2: Comprehensive file-level DD+/EAC3/DDP audio detection
 *  - FIX 3: Hard -3000 penalty for files matching zero title tokens (wrong show)
 *  - FIX 4: alternatives now populated in cache-hit setState (was silently dropped)
 *  - FIX 5: flattenFiles extracted to module level (was duplicated inline)
 *  - FIX 6: parseAddonStream uses full quality line from Torrentio multi-line format
 *  - FIX 7: Retry depth guard prevents infinite self-heal recursion
 *  - FIX 8: AbortController propagation fixed in fetchFrontendSources
 *  - FIX 9: infoHash normalised to lowercase everywhere
 *  - FIX 10: MAX_BATCHES 3→5 (covers top 50 sources)
 */

import { useState, useCallback, useRef } from 'react';
import { initCodecSupport, getCodecProfile } from '../utils/browserCodecSupport';

// Warm codec detection cache as early as possible
initCodecSupport();

const BACKEND_URL  = (import.meta as any).env?.VITE_GIGA_BACKEND_URL || 'https://ibrahimar397-pstream-giga.hf.space';
const ALLDEBRID_KEY = (import.meta as any).env?.VITE_ALLDEBRID_KEY || '';
const ALLDEBRID_API = 'https://api.alldebrid.com/v4';
const AGENT         = 'pstream';
const CACHE_TTL_MS  = 6 * 60 * 60 * 1000; // 6 h
const BATCH_SIZE    = 10;
const MAX_BATCHES   = 5;   // covers top 50 sources (up from 3)
const MAX_ALTS      = 10;  // max CDN links to unlock per resolve

const TRACKERS = [
    'udp://open.demonii.com:1337',
    'udp://tracker.openbittorrent.com:80',
    'udp://tracker.opentrackr.org:1337',
    'udp://tracker.coppersurfer.tk:6969',
].map(t => `tr=${encodeURIComponent(t)}`).join('&');

type MediaType = 'movie' | 'tv';

interface DebridStreamState {
    streamUrl:    string | null;
    name:         string | null;
    loading:      boolean;
    error:        string | null;
    seeders:      number | null;
    quality:      string | null;
    subtitles?:   { url: string; label: string; lang: string }[];
    alternatives?: AltSource[];
}

interface AltSource {
    url:      string;
    name:     string;
    quality:  string;
    seeders:  number;
    _audio?:  string;
}

interface CacheEntry {
    url:          string;
    name:         string;
    quality:      string;
    seeders:      number;
    ts:           number;
    subtitles?:   { url: string; label: string; lang: string }[];
    alternatives?: AltSource[];
}

// ── Session cache ──────────────────────────────────────────────────────────────

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
    try { sessionStorage.setItem(key, JSON.stringify({ ...entry, ts: Date.now() })); } catch { }
}

// ── File flattener (FIX 5: module-level, was duplicated inline) ───────────────

interface FlatFile { name: string; fullPath: string; size: number; url: string; }

function flattenFiles(items: any[], currentPath = ''): FlatFile[] {
    const result: FlatFile[] = [];
    for (const item of items || []) {
        const name     = item.n || '';
        const fullPath = currentPath ? `${currentPath}/${name}` : name;
        if (item.l && /\.(mp4|mkv|m4v|avi|webm|flv|mov|ts|m2ts|ogv)$/i.test(name)) {
            result.push({ name, fullPath, size: item.s || 0, url: item.l });
        }
        if (item.e)     result.push(...flattenFiles(item.e,     fullPath));
        if (item.files) result.push(...flattenFiles(item.files, fullPath));
    }
    return result;
}

// ── Quality scoring ────────────────────────────────────────────────────────────

/**
 * qualityScore — browser-aware source ranking.
 *
 * Dolby-capable browsers (Safari, Edge-Win) skip audio penalties so high-quality
 * remuxes aren't buried for users who can actually play them.
 *
 * HEVC-aware: when the browser cannot hardware-decode H.265, HEVC/x265 sources
 * are penalised heavily (-25) to avoid software-decode lag and stuttering.
 */
function qualityScore(q: string = '', name: string = ''): number {
    const lc = `${q} ${name}`.toLowerCase();
    const profile          = getCodecProfile();
    const isDolbyCapable   = profile?.isDolbyCapable   ?? false;
    const canHWDecodeHEVC  = profile?.canHWDecodeHEVC  ?? false;
    let score = 0;

    // Resolution × source type (WEB-DL bumped over generic 1080p)
    if      (lc.includes('1080') && (lc.includes('web-dl') || lc.includes('webrip') || lc.includes('web-rip'))) score = 8;
    else if (lc.includes('1080') && lc.includes('hdr'))                                                          score = 7;
    else if (lc.includes('1080') && (lc.includes('remux')  || lc.includes('bluray')))                            score = 6;
    else if (lc.includes('1080'))                                                                                  score = 5;
    else if ((lc.includes('4k') || lc.includes('2160')) && (lc.includes('web-dl') || lc.includes('webrip')))     score = 4;
    else if ((lc.includes('4k') || lc.includes('2160')) && lc.includes('hdr'))                                    score = 3;
    else if (lc.includes('4k') || lc.includes('2160'))                                                            score = 2;
    else if (lc.includes('720'))                                                                                   score = 1;

    const isWebSource = lc.includes('web-dl')  || lc.includes('webrip')  || lc.includes('web-rip') ||
        lc.includes('amzn') || lc.includes('nf.')  || lc.includes('dsnp')  ||
        lc.includes('hulu') || lc.includes('hbo')  || lc.includes('itunes') ||
        lc.includes('atvp') || lc.includes('pcok') || lc.includes('pmtp')  ||
        lc.includes('stan') || lc.includes('crav');

    const hasAacOpus = lc.includes('aac') || lc.includes('opus') || lc.includes('mp3');

    if (hasAacOpus || lc.includes('2.0') || lc.includes('stereo') || isWebSource || lc.includes('mp4')) {
        score += 15.0;
    }

    // ── Video codec: HEVC/H.265 ──────────────────────────────────────────────
    // HW decode available  → small bonus (better compression = fewer network stalls).
    // HW decode NOT available → heavy penalty: CPU software decode causes lag / dropped frames.
    const isHEVC = lc.includes('x265') || lc.includes('hevc') || lc.includes('h265') || lc.includes('h.265');
    if (isHEVC) {
        score += canHWDecodeHEVC ? 2.0 : -25.0;
    }
    if (lc.includes('hdr10') || lc.includes('dovi') || lc.includes('dolby vision')) score += 0.5;

    // Audio penalties (skip on Dolby-capable browsers)
    if (!isDolbyCapable) {
        if (lc.includes('truehd') || lc.includes('atmos') ||
            lc.includes('dts-hd') || lc.includes('dtshd') || lc.includes('dts-ma')) {
            score -= 30.0;  // Lossless — won't decode in Chrome/Firefox
        } else if (
            lc.includes('dts')   || lc.includes('ac3')  || lc.includes('eac3') ||
            lc.includes('dd5.1') || lc.includes('ddp')  || /\bdd[+p]\b/.test(lc) ||
            lc.includes('5.1')   || lc.includes('7.1')
        ) {
            if (!hasAacOpus) score -= 20.0;  // Only penalise if no safe fallback track mentioned
        }
    } else {
        if (lc.includes('truehd') || lc.includes('dts-hd') || lc.includes('dtshd')) score += 3.0;
        if (lc.includes('remux'))                                                      score += 2.0;
    }

    // Non-English dub penalty (heavy — avoid foreign dubs for default pick)
    const nonEngKeywords = [
        'french', 'truefrench', 'vf', 'vostfr', 'multi-vf',
        'ita', 'italian', 'german', 'ger', 'deutsch',
        'spa', 'espanol', 'latino', 'spanish',
        'rus', 'russian', 'hindi', 'tamil', 'telugu', 'kannada', 'malayalam',
        'por', 'portuguese', 'brazilian', 'pol', 'polish', 'tur', 'turkish',
        'nld', 'dutch', 'flemish', 'cze', 'czech',
        'swe', 'swedish', 'dan', 'danish', 'fin', 'finnish', 'nor', 'norwegian',
        'kor', 'korean', 'jpn', 'japanese', 'chi', 'chinese', 'zho', 'mandarin', 'cantonese',
        'dubbed',
    ];
    for (const kw of nonEngKeywords) {
        if (new RegExp(`\\b${kw}\\b`, 'i').test(lc) && !lc.includes('multi')) score -= 100;
    }

    return score;
}

// ── Episode / season detection ─────────────────────────────────────────────────

function isWrongEpisode(name: string, targetSeason: number, targetEpisode: number): boolean {
    const lc = name.toLowerCase();

    // 1. SxxExx — most reliable; if found, trust it fully
    const seRegex = /[sS](\d+)[eE](\d+)/g;
    let match: RegExpExecArray | null;
    let foundSe = false;
    while ((match = seRegex.exec(lc)) !== null) {
        foundSe = true;
        if (parseInt(match[1], 10) !== targetSeason || parseInt(match[2], 10) !== targetEpisode) return true;
    }
    if (foundSe) return false; // Matched and passed — no need to check further

    // 2. NxMM (2x18, 02x18) — skip resolution-like patterns (1920x1080)
    const xRegex = /\b(\d+)x(\d+)\b/g;
    let foundX = false;
    while ((match = xRegex.exec(lc)) !== null) {
        if (parseInt(match[1], 10) > 99) continue; // e.g. 1920x1080 — skip
        foundX = true;
        if (parseInt(match[1], 10) !== targetSeason || parseInt(match[2], 10) !== targetEpisode) return true;
    }
    if (foundX) return false;

    // 3. Ep/Episode standalone — skip ranges (ep 01-12) and codec/tech false positives
    // Negative lookbehind ensures we're not matching inside a codec name (e.g. "hevc" → "e")
    const epRegex = /(?<![a-z])ep(?:isode)?[. -]?0*(\d+)(?![0-9])/gi;
    while ((match = epRegex.exec(lc)) !== null) {
        const nextChar = lc[match.index + match[0].length];
        if (nextChar === '-' || nextChar === '~') continue; // Range — skip
        if (parseInt(match[1], 10) !== targetEpisode) return true;
    }

    return false;
}

function isWrongSeasonOrEpisode(fullPath: string, targetSeason: number, targetEpisode: number): boolean {
    const segments = fullPath.split('/');
    const folders  = segments.slice(0, -1);
    const fileName = segments[segments.length - 1] || '';

    // Check folder names for season markers
    for (const folder of folders) {
        const rangeMatch = folder.match(
            /\b(?:season|seasons|series|s)?[. -]*(\d+)[. -]*(?:to|-|~)[. -]*(?:season|seasons|series|s)?[. -]*(\d+)\b/i
        );
        if (rangeMatch) {
            const start = parseInt(rangeMatch[1], 10);
            const end   = parseInt(rangeMatch[2], 10);
            if (targetSeason < start || targetSeason > end) return true;
            continue; // Range is valid — skip single-season check for this folder
        }
        const seasonMatch =
            folder.match(/\b(?:season|series|sezon|[sS])[. -]*0*(\d+)\b/i) ||
            folder.match(/^0*(\d{1,2})$/);
        if (seasonMatch && parseInt(seasonMatch[1], 10) !== targetSeason) return true;
    }

    return isWrongEpisode(fileName, targetSeason, targetEpisode);
}

// ── Best file selection ────────────────────────────────────────────────────────

const SEQUEL_NUMBERS: Record<string, number> = {
    '1': 1, 'i': 1, 'one': 1,
    '2': 2, 'ii': 2, 'two': 2,
    '3': 3, 'iii': 3, 'three': 3,
    '4': 4, 'iv': 4, 'four': 4,
    '5': 5, 'v': 5, 'five': 5,
    '6': 6, 'vi': 6, 'six': 6,
    '7': 7, 'vii': 7, 'seven': 7,
    '8': 8, 'viii': 8, 'eight': 8,
};

function findBestFileUrl(
    files:       any[],
    targetIdx:   number | null = null,
    season?:     number,
    episode?:    number,
    targetTitle?: string
): string | null {
    const flat = flattenFiles(files);
    if (!flat.length) return null;

    // ── TV: find specific episode ────────────────────────────────────────────
    if (season != null && episode != null) {
        const filtered = flat.filter(f => !isWrongSeasonOrEpisode(f.fullPath, season, episode));
        const candidates = filtered.length > 0 ? filtered : flat;

        if (filtered.length === 0) {
            console.log('[DebridStream] ⚠️ Episode filter returned 0 — using all files as candidates');
        }

        const patterns = [
            new RegExp(`[sS]0*${season}[. _-]*[eE]0*${episode}(?![0-9])`, 'i'),
            new RegExp(`\\b0*${season}x0*${episode}(?![0-9])`, 'i'),
            new RegExp(`\\bep(?:isode)?[. -]*0*${episode}(?![0-9])`, 'i'),
            new RegExp(`\\b[eE]0*${episode}(?![0-9])`, 'i'),
        ];

        for (const regex of patterns) {
            const matches = candidates.filter(f => regex.test(f.name));
            if (matches.length === 1) return matches[0].url;
            if (matches.length > 1)  return matches.sort((a, b) => b.size - a.size)[0].url;
        }

        // Single-file torrent → safely assume it's the right episode
        if (flat.length <= 2) return flat.sort((a, b) => b.size - a.size)[0].url;

        // Season pack + Torrentio fileIdx fallback
        if (targetIdx != null && flat[targetIdx]) {
            console.log(`[DebridStream] ⚠️ TV regex exhausted on season pack — using targetIdx ${targetIdx}`);
            return flat[targetIdx].url;
        }

        return null;
    }

    // ── Movie: Torrentio fileIdx ─────────────────────────────────────────────
    if (targetIdx != null && flat[targetIdx]) return flat[targetIdx].url;

    // ── Movie: smart title matching ──────────────────────────────────────────
    if (targetTitle) {
        const cleanTarget  = targetTitle.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
        const targetTokens = cleanTarget.split(' ').filter(t => t.length > 1);
        const targetNums   = targetTokens.map(t => SEQUEL_NUMBERS[t]).filter(Boolean);

        flat.sort((a, b) => {
            const stripNoise = (n: string) => n.toLowerCase()
                .replace(/\b\d+\.\d+\b/g, '')      // 5.1, 2.0, 7.1
                .replace(/\b\d+-?bit\b/g, '')        // 10-bit, 8bit
                .replace(/\b\d{3,4}p\b/g, '');       // 1080p, 720p

            const tokA = stripNoise(a.name).replace(/[^a-z0-9]/g, ' ').trim().split(' ');
            const tokB = stripNoise(b.name).replace(/[^a-z0-9]/g, ' ').trim().split(' ');

            let sA = 0, sB = 0;
            for (const t of targetTokens) {
                if (tokA.includes(t)) sA++;
                if (tokB.includes(t)) sB++;
            }
            // Penalise sequel numbers not present in the target title
            for (const [numStr, numVal] of Object.entries(SEQUEL_NUMBERS)) {
                if (!targetNums.includes(numVal)) {
                    if (tokA.includes(numStr)) sA -= 50;
                    if (tokB.includes(numStr)) sB -= 50;
                }
            }
            return sA !== sB ? sB - sA : b.size - a.size;
        });

        return flat[0].url;
    }

    // ── Absolute fallback: largest file ──────────────────────────────────────
    return flat.sort((a, b) => b.size - a.size)[0].url;
}

// ── Torrentio / addon stream name parser ──────────────────────────────────────

/**
 * FIX 6: Extract the FULL quality line from Torrentio's multi-line format.
 *
 * Torrentio format:
 *   line 0 — "Top Gear S01E01 ..."
 *   line 1 — "1080p WEB-DL AAC x264"   ← quality detail we want
 *   line 2 — "👤 150 💾 2.4 GB ⚙️ …"
 *
 * Old code used only line 0, losing all quality/codec info for scoring.
 */
function parseAddonStream(titleLine: string, nameLine: string): { name: string; quality: string; seeders: number } {
    const lines = titleLine.split('\n').map(l => l.trim()).filter(Boolean);

    let seeders = 0;
    for (const line of [...lines, nameLine]) {
        const m = line.match(/👤\s*(\d+)/) || line.match(/Seeders:\s*(\d+)/i);
        if (m) { seeders = parseInt(m[1]); break; }
    }

    const titlePart   = lines[0] || nameLine.split('\n')[0] || '';
    const qualityPart = lines[1] || '';  // "1080p WEB-DL AAC x264"
    const name        = qualityPart ? `${titlePart} ${qualityPart}`.trim() : titlePart;

    const combined = `${name} ${nameLine}`.toLowerCase();
    let quality = 'unknown';
    if      (combined.includes('2160') || combined.includes('4k'))  quality = '4k';
    else if (combined.includes('1080'))                               quality = '1080p';
    else if (combined.includes('720'))                                quality = '720p';
    else if (combined.includes('480'))                                quality = '480p';

    return { name, quality, seeders };
}

// ── Frontend addon scraping ────────────────────────────────────────────────────

async function fetchFrontendSources(
    imdbId:  string,
    type:    MediaType,
    season?: number,
    episode?: number,
    signal?: AbortSignal
): Promise<any[]> {
    const idParam = type === 'movie' ? imdbId : `${imdbId}:${season || 1}:${episode || 1}`;

    const addons = [
        `https://torrentio.strem.fun/providers=yts,eztv,rarbg,1337x,thepiratebay,kickasstorrents,torrentgalaxy,magnetdl,horriblesubs,nyaasi,tokyotosho,anidex|qualityfilter=scr,cam|sort=qualityseeders/stream/${type}/${idParam}.json`,
        `https://comet.elfhosted.com/stream/${type}/${idParam}.json`,
        `https://mediafusion.elfhosted.com/stream/${type}/${idParam}.json`,
        `https://jackettio.elfhosted.com/stream/${type}/${idParam}.json`,
        `https://stremio-jackett.strem.fun/stream/${type}/${idParam}.json`,
    ];

    const fetchPromises = addons.map(async (url) => {
        const ctrl  = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 2500);

        // FIX 8: proper abort propagation — check already-aborted, use { once: true }
        if (signal) {
            if (signal.aborted) { clearTimeout(timer); return []; }
            signal.addEventListener('abort', () => ctrl.abort(), { once: true });
        }

        try {
            const res = await fetch(url, { signal: ctrl.signal });
            clearTimeout(timer);
            if (!res.ok) return [];
            const data = await res.json();
            return data.streams || [];
        } catch { clearTimeout(timer); return []; }
    });

    const settled = await Promise.allSettled(fetchPromises);
    const allStreams: any[] = [];
    settled.forEach(r => { if (r.status === 'fulfilled') allStreams.push(...r.value); });

    // Normalise + deduplicate by infoHash
    const unique = new Map<string, any>();
    for (const s of allStreams) {
        if (!s.infoHash) continue;
        const hash = s.infoHash.toLowerCase().trim(); // FIX 9: normalise hash
        const { name, quality, seeders } = parseAddonStream(s.title || s.description || '', s.name || '');
        const existing = unique.get(hash);
        if (!existing || seeders > existing.seeders) {
            unique.set(hash, { name, infoHash: hash, seeders, quality, fileIdx: s.fileIdx ?? null });
        }
    }

    return Array.from(unique.values());
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useDebridStream() {
    const [state, setState] = useState<DebridStreamState>({
        streamUrl: null, name: null, loading: false,
        error: null, seeders: null, quality: null, subtitles: [],
    });

    const abortRef = useRef<AbortController | null>(null);

    const resolve = useCallback(async (
        imdbId:      string,
        type:        MediaType,
        season?:     number,
        episode?:    number,
        title?:      string,
        tmdbId?:     string,
        forceFresh?: boolean,
        _retryDepth = 0   // FIX 7: guard against infinite self-heal recursion
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
            // ── Cache hit ─────────────────────────────────────────────────────
            if (!forceFresh) {
                const cached = readCache(ck);
                if (cached) {
                    console.log(`[DebridStream] 💾 Cache hit: ${cached.quality} | ${cached.url.substring(0, 60)}…`);
                    setState({
                        streamUrl:    cached.url,
                        name:         cached.name,
                        loading:      false,
                        error:        null,
                        seeders:      cached.seeders,
                        quality:      cached.quality,
                        subtitles:    cached.subtitles    || [],
                        alternatives: cached.alternatives || [],  // FIX 4: was silently missing
                    });
                    return JSON.stringify({
                        streamUrl: cached.url, name: cached.name,
                        quality: cached.quality, seeders: cached.seeders,
                    });
                }
            }

            // ── Step 1: Fetch sources from backend + addons in parallel ────────
            const params = new URLSearchParams({ imdbId, type });
            if (season)     params.set('season',   String(season));
            if (episode)    params.set('episode',  String(episode));
            if (title)      params.set('title',    title);
            if (tmdbId)     params.set('tmdbId',   tmdbId);
            if (forceFresh) params.set('nocache',  'true');

            let subtitles: any[] = [];

            const backendPromise = fetch(`${BACKEND_URL}/api/torrent/sources?${params}`, { signal })
                .then(r => r.json())
                .then(d => {
                    if (d.subtitles?.length) {
                        subtitles = d.subtitles;
                        setState(s => ({ ...s, subtitles: d.subtitles }));
                    }
                    // FIX 9: normalise infoHash from backend too
                    return (d.streams || []).map((s: any) => ({
                        ...s,
                        infoHash: (s.infoHash || '').toLowerCase(),
                    }));
                }).catch(() => []);

            const frontendPromise = fetchFrontendSources(imdbId, type, season, episode, signal);
            const [backendStreams, frontendStreams] = await Promise.all([backendPromise, frontendPromise]);

            // Merge, dedup, pre-filter wrong TV episodes
            const mergedMap = new Map<string, any>();
            for (const item of [...backendStreams, ...frontendStreams]) {
                if (!item?.infoHash) continue;
                const hash = item.infoHash.toLowerCase();

                if (type === 'tv' && season != null && episode != null) {
                    if (isWrongEpisode(item.name || '', season, episode)) {
                        console.log(`[DebridStream] 🚫 Pre-filter wrong episode: "${(item.name || '').substring(0, 60)}"`);
                        continue;
                    }
                }

                if (!mergedMap.has(hash) || (item.seeders || 0) > (mergedMap.get(hash).seeders || 0)) {
                    mergedMap.set(hash, { ...item, infoHash: hash });
                }
            }

            const streams = Array.from(mergedMap.values());
            if (!streams.length) throw new Error('No torrent sources found');

            const sorted = [...streams].sort((a, b) => {
                const sd = qualityScore(b.quality, b.name) - qualityScore(a.quality, a.name);
                return sd !== 0 ? sd : (b.seeders || 0) - (a.seeders || 0);
            });

            console.log(`[DebridStream] 📋 ${sorted.length} sources. Top 3: ${sorted.slice(0, 3).map(s => s.quality).join(', ')}`);

            // ── Steps 2–4: AllDebrid waterfall ────────────────────────────────
            let upData:             any = null;
            let readyMagnets:       any[] = [];
            let currentCandidates:  any[] = [];
            // FIX 1: hash→candidate map (replaces fragile findIndex on unreliable response order)
            let magnetIdToCandidate = new Map<string, any>();
            let batchIndex = 0;

            while (batchIndex < MAX_BATCHES && batchIndex * BATCH_SIZE < sorted.length) {
                if (signal.aborted) throw new Error('Aborted');

                const batch       = sorted.slice(batchIndex * BATCH_SIZE, (batchIndex + 1) * BATCH_SIZE);
                const uploadParam = batch
                    .map(c => `magnets[]=${encodeURIComponent(`magnet:?xt=urn:btih:${c.infoHash}&${TRACKERS}`)}`)
                    .join('&');

                const upRes      = await fetch(`${ALLDEBRID_API}/magnet/upload?agent=${AGENT}&apikey=${ALLDEBRID_KEY}&${uploadParam}`, { signal });
                const batchUpData = await upRes.json();

                if (batchUpData?.status === 'success' && batchUpData?.data?.magnets) {
                    const batchReady = batchUpData.data.magnets.filter((m: any) => m.ready);
                    if (batchReady.length > 0) {
                        upData            = batchUpData;
                        readyMagnets      = batchReady;
                        currentCandidates = batch;

                        // Build hash→candidate mapping
                        magnetIdToCandidate = new Map();
                        for (const uploadedMagnet of batchUpData.data.magnets) {
                            const rawHashField = uploadedMagnet.hash || uploadedMagnet.magnet || '';
                            // hash field can be a bare hash or a magnet URI — handle both
                            const hash = (
                                rawHashField.match(/xt=urn:btih:([a-f0-9]+)/i)?.[1] || rawHashField
                            ).toLowerCase();
                            const candidate = batch.find(c => c.infoHash === hash);
                            if (candidate && uploadedMagnet.id != null) {
                                magnetIdToCandidate.set(String(uploadedMagnet.id), candidate);
                            }
                        }

                        console.log(`[DebridStream] ✅ Waterfall hit at batch ${batchIndex + 1}: ${readyMagnets.length} cached`);
                        break;
                    }
                }

                console.log(`[DebridStream] Batch ${batchIndex + 1} empty — trying next…`);
                batchIndex++;
            }

            if (!readyMagnets.length || !upData) throw new Error('No cached sources available');

            // Fetch file lists for all ready magnets
            const fileParams = readyMagnets.map((m: any) => `id[]=${m.id}`).join('&');
            const fRes       = await fetch(`${ALLDEBRID_API}/magnet/files?agent=${AGENT}&apikey=${ALLDEBRID_KEY}&${fileParams}`, { signal });
            const fData      = await fRes.json();
            const fileMagnets = fData?.data?.magnets || readyMagnets;

            // Build scored playable file list
            const playableFiles: Array<{
                candidate: any;
                fileUrl:   string;
                fileName:  string;
                magnetId:  any;
            }> = [];

            for (const mInfo of fileMagnets) {
                // FIX 1: Use hash-based map, not fragile index lookup
                const candidate = magnetIdToCandidate.get(String(mInfo.id));
                if (!candidate) {
                    console.warn(`[DebridStream] ⚠️ No candidate mapping for magnet ID ${mInfo.id}`);
                    continue;
                }

                const fList  = mInfo.files || [];
                const bestUrl = findBestFileUrl(
                    fList,
                    candidate.fileIdx ?? null,
                    type === 'tv' ? season : undefined,
                    type === 'tv' ? episode : undefined,
                    title
                );
                if (!bestUrl) continue;

                // Resolve the filename from the flat list
                const allFiles = flattenFiles(fList);
                const fileObj  = allFiles.find(f => f.url === bestUrl);
                const fileName = fileObj?.name || candidate.name || '';

                playableFiles.push({ candidate, fileUrl: bestUrl, fileName, magnetId: mInfo.id });
            }

            // Score and rank actual files
            const isDolbyCapable = getCodecProfile()?.isDolbyCapable ?? false;
            const cleanTarget    = (title || '').toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
            const targetTokens   = cleanTarget.split(' ').filter(t => t.length > 1);

            playableFiles.sort((a, b) => {
                const aName     = a.fileName.toLowerCase();
                const bName     = b.fileName.toLowerCase();
                const aCandName = (a.candidate.name || '').toLowerCase();
                const bCandName = (b.candidate.name || '').toLowerCase();

                let aFileScore = 0;
                let bFileScore = 0;

                // Container / codec boost
                if (aName.endsWith('.mp4') || aName.includes('aac') || aName.includes('h264') || aName.includes('x264')) aFileScore += 8;
                if (bName.endsWith('.mp4') || bName.includes('aac') || bName.includes('h264') || bName.includes('x264')) bFileScore += 8;

                // FIX 2: Comprehensive audio incompatibility check at file level
                // Checks BOTH the filename AND the candidate/torrent name
                if (!isDolbyCapable) {
                    const isIncompat = (n: string) =>
                        n.includes('truehd')  || n.includes('atmos')  ||
                        n.includes('dts-hd')  || n.includes('dtshd')  || n.includes('dts-ma') ||
                        n.includes('dts')     || n.includes('ac3')    ||
                        n.includes('eac3')    || n.includes('dd5')    ||
                        /\bdd[+p]\b/.test(n)  || n.includes('ddp')   ||
                        /\b[57]\.1\b/.test(n);

                    if      (isIncompat(aName) || isIncompat(aCandName)) aFileScore -= 25;
                    else if (aName.endsWith('.mkv'))                      aFileScore -=  3;

                    if      (isIncompat(bName) || isIncompat(bCandName)) bFileScore -= 25;
                    else if (bName.endsWith('.mkv'))                      bFileScore -=  3;
                } else {
                    // Dolby-capable: lossless tracks are a bonus
                    if (aName.includes('truehd') || aName.includes('dts-hd') || aName.includes('dtshd')) aFileScore += 3;
                    if (bName.includes('truehd') || bName.includes('dts-hd') || bName.includes('dtshd')) bFileScore += 3;
                }

                // FIX 3: Title token matching + hard zero-match penalty
                if (targetTokens.length > 0) {
                    // CRITICAL FIX: Torrentio prepends the show name to the first line of stream.title.
                    // We MUST ignore the first line, otherwise EVERY torrent gets a 100% title match!
                    const aCandText = (a.candidate.name || '').split('\n').slice(1).join(' ').toLowerCase();
                    const bCandText = (b.candidate.name || '').split('\n').slice(1).join(' ').toLowerCase();

                    let aMatches = 0, bMatches = 0;
                    for (const t of targetTokens) {
                        const re = new RegExp(`\\b${t}\\b`, 'i');
                        if (re.test(aCandText) || re.test(aName)) { aFileScore += 500; aMatches++; }
                        if (re.test(bCandText) || re.test(bName)) { bFileScore += 500; bMatches++; }
                    }
                    // Hard-penalise files that match NONE of the title tokens — likely a wrong show entirely
                    if (targetTokens.length >= 2) {
                        if (aMatches === 0) aFileScore -= 3000;
                        if (bMatches === 0) bFileScore -= 3000;
                    }
                }

                // Combine candidate quality score (×20 to dominate file-level tweaks) with file score
                const aTotalScore = qualityScore(a.candidate.quality, a.candidate.name) * 20 + aFileScore;
                const bTotalScore = qualityScore(b.candidate.quality, b.candidate.name) * 20 + bFileScore;

                if (aTotalScore !== bTotalScore) return bTotalScore - aTotalScore;
                return (b.candidate.seeders || 0) - (a.candidate.seeders || 0);
            });

            // Unlock top files and collect alternatives
            const alternatives: AltSource[] = [];
            let winnerFile: any = null;

            for (const file of playableFiles.slice(0, MAX_ALTS)) {
                if (signal.aborted) break;
                try {
                    const uRes = await fetch(
                        `${ALLDEBRID_API}/link/unlock?agent=${AGENT}&apikey=${ALLDEBRID_KEY}&link=${encodeURIComponent(file.fileUrl)}`,
                        { signal }
                    );
                    const uData  = await uRes.json();
                    const cdnUrl = uData?.data?.link;
                    if (!cdnUrl) {
                        console.warn(`[DebridStream] ⚠️ Unlock failed for ${file.fileName}:`, uData);
                        continue;
                    }

                    alternatives.push({
                        url:     cdnUrl,
                        name:    file.fileName,
                        quality: file.candidate.quality || 'Auto',
                        seeders: file.candidate.seeders || 0,
                        _audio:  'unknown',
                    });

                    if (alternatives.length === 1) {
                        winnerFile = file;
                        // Start playback immediately on the first (best) file
                        setState(prev => ({
                            ...prev,
                            streamUrl:    cdnUrl,
                            name:         file.fileName,
                            quality:      file.candidate.quality,
                            seeders:      file.candidate.seeders || 0,
                            loading:      false,
                            subtitles:    subtitles || [],
                            alternatives: [...alternatives],
                        }));
                    }
                } catch (e: any) {
                    if (e.name === 'AbortError') throw e;
                    console.warn(`[DebridStream] Candidate failed: ${e.message}`);
                }
            }

            // Background cleanup: delete non-winning magnets from the user's account
            if (winnerFile) {
                const winningId  = String(winnerFile.magnetId);
                const idsToDelete = upData.data.magnets
                    .map((m: any) => m.id)
                    .filter((id: any) => id != null && String(id) !== winningId);

                if (idsToDelete.length > 0) {
                    const delParams = idsToDelete.map((id: any) => `id[]=${id}`).join('&');
                    fetch(`${ALLDEBRID_API}/magnet/delete?agent=${AGENT}&apikey=${ALLDEBRID_KEY}&${delParams}`)
                        .then(r => r.json())
                        .then(() => console.log('[DebridStream] 🧹 Cleanup: deleted', idsToDelete))
                        .catch(err => console.warn('[DebridStream] Cleanup failed:', err));
                }
            }

            if (alternatives.length === 0) throw new Error('None of the top sources are cached on AllDebrid');

            const winner = alternatives[0];
            console.log(`[DebridStream] 🎬 ${alternatives.length} alt(s). Best: ${winner.quality} — ${winner.name.substring(0, 60)}`);

            writeCache(ck, {
                url:          winner.url,
                name:         winner.name || '',
                quality:      winner.quality || 'auto',
                seeders:      winner.seeders || 0,
                subtitles:    subtitles || [],
                alternatives,
            });

            setState({
                streamUrl:    winner.url,
                name:         winner.name || null,
                loading:      false,
                error:        null,
                seeders:      winner.seeders,
                quality:      winner.quality || null,
                subtitles:    subtitles || [],
                alternatives,
            });

            return JSON.stringify({ streamUrl: winner.url, quality: winner.quality, seeders: winner.seeders, alternatives });

        } catch (err: any) {
            if (err.name === 'AbortError') return null;
            const msg = err.message || 'AllDebrid resolution failed';

            // FIX 7: Self-heal retry exactly once with fresh scraping
            if (_retryDepth === 0 && !forceFresh &&
                (msg.includes('cached') || msg.includes('torrent') || msg.includes('sources'))) {
                console.log('[DebridStream] 🔄 Retrying with fresh live scrape…');
                return resolve(imdbId, type, season, episode, title, tmdbId, true, 1);
            }

            setState(prev => ({ ...prev, loading: false, error: msg }));
            console.warn('[DebridStream] ❌', msg);
            return null;
        }
    }, []);

    const reset = useCallback(() => {
        if (abortRef.current) abortRef.current.abort();
        setState({ streamUrl: null, name: null, loading: false, error: null, seeders: null, quality: null });
    }, []);

    const clearCache = useCallback((imdbId: string, type: string, season?: number, episode?: number) => {
        try { sessionStorage.removeItem(makeCacheKey(imdbId, type, season, episode)); } catch { }
    }, []);

    return { ...state, resolve, reset, clearCache };
}