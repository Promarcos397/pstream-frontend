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
import { initCodecSupport, getCodecProfile, isBrowserSafeCodec } from '../utils/browserCodecSupport';

// Warm the codec detection cache as early as possible
initCodecSupport();

const BACKEND_URL = (import.meta as any).env?.VITE_GIGA_BACKEND_URL || 'https://ibrahimar397-pstream-giga.hf.space';
const ALLDEBRID_KEY = (import.meta as any).env?.VITE_ALLDEBRID_KEY || '';
const ALLDEBRID_API = 'https://api.alldebrid.com/v4';
const AGENT = 'pstream';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h — AllDebrid CDN links don't expire in this window
const MAX_TRY = 6;                   // Try up to 6 sources before giving up

const TRACKERS = [
    'udp://open.demonii.com:1337',
    'udp://tracker.openbittorrent.com:80',
    'udp://tracker.opentrackr.org:1337',
    'udp://tracker.coppersurfer.tk:6969',
].map(t => `tr=${encodeURIComponent(t)}`).join('&');

type MediaType = 'movie' | 'tv';
interface DebridStreamState {
    streamUrl: string | null;
    name: string | null;
    loading: boolean;
    error: string | null;
    seeders: number | null;
    quality: string | null;
    subtitles?: { url: string; label: string; lang: string }[];
    alternatives?: Array<{ url: string; name: string; quality: string; seeders: number; _audio?: string }>;
}

interface CacheEntry {
    url: string;
    name: string;
    quality: string;
    seeders: number;
    ts: number;
    subtitles?: { url: string; label: string; lang: string }[];
    alternatives?: Array<{ url: string; name: string; quality: string; seeders: number; _audio?: string }>;
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
    try { sessionStorage.setItem(key, JSON.stringify({ ...entry, ts: Date.now() })); } catch { }
}

// ── Quality scoring ───────────────────────────────────────────────────────────
// Prefers 1080p variants (smaller files, fast to stream) over 4K remuxes.
// 4K Web-DL/WEB-Rip are smaller than remuxes so they score better than raw remux.
/**
 * qualityScore — browser-aware source ranking.
 *
 * When the browser can play Dolby natively (Safari / Edge-Win), we lift the
 * penalty on AC3/EAC3 sources so high-quality remuxes aren't buried.
 * Chrome/Firefox still get the aggressive AAC preference.
 */
function qualityScore(q: string = '', name: string = ''): number {
    const lc = `${q} ${name}`.toLowerCase();
    const profile = getCodecProfile();
    const isDolbyCapable = profile?.isDolbyCapable ?? false;
    let score = 0;

    // Base resolution ranking
    if      (lc.includes('1080') && lc.includes('web'))                              score = 7;
    else if (lc.includes('1080') && (lc.includes('remux') || lc.includes('bluray'))) score = 6;
    else if (lc.includes('1080') && lc.includes('hdr'))                              score = 5;
    else if (lc.includes('1080'))                                                     score = 4;
    else if ((lc.includes('4k') || lc.includes('2160')) && lc.includes('web'))       score = 3;
    else if (lc.includes('4k') || lc.includes('2160'))                               score = 2;
    else if (lc.includes('720'))                                                      score = 1;

    // Audio compatibility bonus
    const isWebSource = lc.includes('web-dl') || lc.includes('webrip') || lc.includes('web-rip') ||
        lc.includes('amzn') || lc.includes('nf.') || lc.includes('dsnp') ||
        lc.includes('hulu') || lc.includes('hbo') || lc.includes('itunes') || lc.includes('atvp');

    if (lc.includes('aac') || lc.includes('mp3') || lc.includes('opus') ||
        lc.includes('2.0') || lc.includes('stereo') || isWebSource || lc.includes('mp4')) {
        score += 15.0;
    }

    // Dolby/DTS codec penalties — skipped entirely for Safari/Edge-Win
    if (!isDolbyCapable) {
        if (lc.includes('truehd') || lc.includes('atmos') || lc.includes('dts-hd') || lc.includes('dtshd')) {
            score -= 30.0;
        } else if (
            lc.includes('dts') || lc.includes('ac3') || lc.includes('eac3') ||
            lc.includes('dd5.1') || lc.includes('ddp') || lc.includes('dd+') ||
            lc.includes('5.1') || lc.includes('7.1')
        ) {
            if (!lc.includes('aac') && !lc.includes('opus') && !lc.includes('mp3')) {
                score -= 20.0;
            }
        }
    } else {
        // Dolby-capable browser: lossless TrueHD/DTS-HD are actually a bonus — better quality
        if (lc.includes('truehd') || lc.includes('dts-hd') || lc.includes('dtshd')) score += 3.0;
        if (lc.includes('remux')) score += 2.0; // full remux is highest quality
    }

    // Language Scoring (Heavily penalize non-English dubbed versions for default pick)
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
        if (new RegExp(`\\b${kw}\\b`, 'i').test(lc) && !lc.includes('multi')) {
            score -= 100;
        }
    }

    return score;
}

// ── File extraction ───────────────────────────────────────────────────────────
// AllDebrid file structure: folders use "e" for entries, files have "l" (link) + "s" (size)
function isWrongEpisode(name: string, targetSeason: number, targetEpisode: number): boolean {
    const lc = name.toLowerCase();

    // 1. Check for SxxExx or SxEpp pattern (e.g. s02e18, s2e18)
    const seRegex = /[sS](\d+)[eE](\d+)/g;
    let match;
    while ((match = seRegex.exec(lc)) !== null) {
        const s = parseInt(match[1], 10);
        const e = parseInt(match[2], 10);
        if (s !== targetSeason || e !== targetEpisode) {
            return true; // Wrong season or wrong episode
        }
    }

    // 2. Check for Season x Episode pattern (e.g. 2x18, 02x18)
    const xRegex = /\b(\d+)x(\d+)\b/g;
    while ((match = xRegex.exec(lc)) !== null) {
        const s = parseInt(match[1], 10);
        const e = parseInt(match[2], 10);
        if (s !== targetSeason || e !== targetEpisode) {
            return true;
        }
    }

    // 3. Check for standalone Ep / Episode tag (e.g. ep 18, episode 18, ep.18, e18)
    // but only if it's not a range like ep 01-12 or e01-10
    const epRegex = /\b(?:ep|episode|e)[. -]?(\d+)\b/g;
    while ((match = epRegex.exec(lc)) !== null) {
        // Skip if there's a range following it, like e10-12
        const nextCharIdx = match.index + match[0].length;
        const nextChar = lc[nextCharIdx];
        if (nextChar === '-' || nextChar === '~') continue; 
        
        const e = parseInt(match[1], 10);
        if (e !== targetEpisode) {
            // Check if it's part of a range beforehand (e.g. e01-18)
            const prevText = lc.substring(Math.max(0, match.index - 5), match.index);
            if (prevText.includes('-') || prevText.includes('~')) continue;
            
            return true;
        }
    }

    return false;
}

function isWrongSeasonOrEpisode(fullPath: string, targetSeason: number, targetEpisode: number): boolean {
    const segments = fullPath.split('/');
    const folders = segments.slice(0, -1);
    const fileName = segments[segments.length - 1] || '';

    // 1. Check folders first
    for (const folder of folders) {
        let isRange = false;
        // Range check: e.g. S01-S07, Season 1-7
        const rangeMatch = folder.match(/\b(?:season|seasons|series|s)?[. -]*(\d+)[. -]*(?:to|-|~)[. -]*(?:season|seasons|series|s)?[. -]*(\d+)\b/i);
        if (rangeMatch) {
            isRange = true;
            const start = parseInt(rangeMatch[1], 10);
            const end = parseInt(rangeMatch[2], 10);
            if (targetSeason < start || targetSeason > end) {
                return true; // Target season is not in this range folder
            }
        }
        if (!isRange) {
            // Single season check: e.g. Season 7, S07, S7, or folder is exactly a number (e.g. "07", "7")
            const seasonMatch = folder.match(/\b(?:season|series|sezon|[sS])[. -]*0*(\d+)\b/i) || folder.match(/^0*(\d{1,2})$/);
            if (seasonMatch) {
                const s = parseInt(seasonMatch[1], 10);
                if (s !== targetSeason) {
                    return true; // Wrong season folder
                }
            }
        }
    }

    // 2. Check filename
    if (isWrongEpisode(fileName, targetSeason, targetEpisode)) {
        return true;
    }

    return false;
}

// ── File extraction ───────────────────────────────────────────────────────────
// AllDebrid file structure: folders use "e" for entries, files have "l" (link) + "s" (size)"
function findBestFileUrl(files: any[], targetIdx: number | null = null, season?: number, episode?: number): string | null {
    const flat: { name: string; fullPath: string; size: number; url: string }[] = [];

    function flatten(items: any[], currentPath: string = '') {
        for (const item of items || []) {
            const name = item.n || '';
            const fullPath = currentPath ? `${currentPath}/${name}` : name;
            if (item.l) {
                // Only consider actual playable video files (skip .nfo, .txt, .srt, image files, etc.)
                if (/\.(mp4|mkv|m4v|avi|webm|flv|mov|ts|m2ts|ogv)$/i.test(name)) {
                    flat.push({ name, fullPath, size: item.s || 0, url: item.l });
                }
            }
            if (item.e) flatten(item.e, fullPath);
            if (item.files) flatten(item.files, fullPath);
        }
    }

    flatten(files);
    if (!flat.length) return null;


    // 1. If it's a TV show, try to find the specific episode file by name
    if (season != null && episode != null) {
        let candidates = flat;
        const filteredFlat = flat.filter(f => !isWrongSeasonOrEpisode(f.fullPath, season, episode));
        if (filteredFlat.length > 0) {
            candidates = filteredFlat;
        } else {
            console.log('[DebridStream] ⚠️ Season/episode filtering returned 0 candidates, falling back to all files.');
        }

        let lookbehind = '(?<![0-9]\\.|h[.-]?|x[.-]?';
        let lookahead = '(?!\\.[0-9]|bit|k\\b|p\\b|fps|hz';
        
        if (episode === 1) {
            lookbehind += '|\\b[57]\\b[ . -]*';
        } else if (episode === 2) {
            lookbehind += '|\\b[57]\\b[ . -]*1\\b[ . -]*';
            lookahead += '|[ . -]*0\\b';
        } else if (episode === 5) {
            lookahead += '|[ . -]*1\\b';
        } else if (episode === 7) {
            lookahead += '|[ . -]*1\\b';
        }
        
        lookbehind += ')';
        lookahead += ')';

        const patterns = [
            // S02E02, S2E2, S02 E02, S2 E2, S02 - E02, s02.e02, etc.
            new RegExp(`[sS]0*${season}[. -]*[eE]0*${episode}\\b`, 'i'),
            // 2x02, 2x2, 02x02
            new RegExp(`\\b0*${season}x0*${episode}\\b`, 'i'),
            // Episode 2, Ep 02, Ep.2, Ep-2
            new RegExp(`\\b(?:ep|episode)[. -]*0*${episode}\\b`, 'i'),
            // E02, E2, e02
            new RegExp(`\\b[eE]0*${episode}\\b`, 'i'),
            // Standalone number (e.g. 02, 2), protected from version markers (2.0, 5.1) and resolutions/specs
            new RegExp(`${lookbehind}\\b0*${episode}${lookahead}\\b`, 'i')
        ];

        for (const regex of patterns) {
            const matches = candidates.filter(f => regex.test(f.name));
            if (matches.length === 1) return matches[0].url; // Perfect single match
            if (matches.length > 1) {
                // If multiple matches (e.g. sample files), pick the largest
                matches.sort((a, b) => b.size - a.size);
                return matches[0].url;
            }
        }
        
        // If we found no matches, but this is a single-episode torrent (<= 2 video files total),
        // we can safely fall back to the largest video file!
        if (flat.length <= 2) {
            flat.sort((a, b) => b.size - a.size);
            return flat[0].url;
        }

        // If it's a season pack (> 2 video files) and we found no episode matches, 
        // try to fallback to Torrentio's targetIdx BEFORE giving up.
        if (targetIdx != null && flat[targetIdx]) {
            console.log(`[DebridStream] ⚠️ TV regex failed on Season Pack. Falling back to targetIdx ${targetIdx}`);
            return flat[targetIdx].url;
        }

        // Complete failure
        return null;
    }

    // 2. Fallback to Torrentio's targetIdx if provided
    if (targetIdx != null && flat[targetIdx]) return flat[targetIdx].url;

    // 3. Absolute fallback: Largest video file
    flat.sort((a, b) => b.size - a.size);

    return flat[0].url;
}

// ─── Frontend Scraping (Stremio Addons) ───────────────────────────────────────────
async function fetchFrontendSources(imdbId: string, type: MediaType, season?: number, episode?: number, signal?: AbortSignal) {
    const isMovie = type === 'movie';
    const idParam = isMovie ? imdbId : `${imdbId}:${season || 1}:${episode || 1}`;
    
    const addons = [
        `https://torrentio.strem.fun/providers=yts,eztv,rarbg,1337x,thepiratebay,kickasstorrents,torrentgalaxy,magnetdl,horriblesubs,nyaasi,tokyotosho,anidex|qualityfilter=scr,cam|sort=qualityseeders/stream/${type}/${idParam}.json`,
        `https://comet.elfhosted.com/stream/${type}/${idParam}.json`,
        `https://mediafusion.elfhosted.com/stream/${type}/${idParam}.json`,
        `https://jackettio.elfhosted.com/stream/${type}/${idParam}.json`,
        `https://stremio-jackett.strem.fun/stream/${type}/${idParam}.json`
    ];

    let results: any[] = [];
    const fetchPromises = addons.map(async (url) => {
        try {
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), 2500); // Super fast 2.5s timeout!
            const combinedSignal = signal ? (signal.aborted ? signal : controller.signal) : controller.signal;
            if (signal) signal.addEventListener('abort', () => controller.abort());
            
            const res = await fetch(url, { signal: combinedSignal });
            clearTimeout(id);
            if (!res.ok) return [];
            const data = await res.json();
            return data.streams || [];
        } catch { return []; }
    });

    const settled = await Promise.allSettled(fetchPromises);
    settled.forEach((r) => {
        if (r.status === 'fulfilled' && r.value) {
            results = results.concat(r.value);
        }
    });

    // Parse and normalize results
    const normalized = results.map(s => {
        if (!s.infoHash) return null;
        const titleLine = s.title || s.description || '';
        const nameLine = s.name || '';
        const seedMatch = titleLine.match(/👤\s*(\d+)/) || titleLine.match(/Seeders:\s*(\d+)/i) || nameLine.match(/👤\s*(\d+)/);
        const seeders = seedMatch ? parseInt(seedMatch[1]) : 0;
        
        let quality = 'unknown';
        const combinedText = `${titleLine} ${nameLine}`.toLowerCase();
        if (combinedText.includes('4k') || combinedText.includes('2160')) quality = '4k';
        else if (combinedText.includes('1080')) quality = '1080p';
        else if (combinedText.includes('720')) quality = '720p';
        else if (combinedText.includes('480')) quality = '480p';

        return {
            name: titleLine.split('\n')[0] || nameLine.replace('\n', ' '),
            infoHash: s.infoHash.toLowerCase(),
            seeders,
            quality,
            fileIdx: s.fileIdx ?? null
        };
    }).filter(Boolean);

    // Deduplicate by infoHash
    const unique = new Map();
    for (const item of normalized) {
        if (!item) continue;
        if (!unique.has(item.infoHash) || item.seeders > unique.get(item.infoHash).seeders) {
            unique.set(item.infoHash, item);
        }
    }

    return Array.from(unique.values());
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useDebridStream() {
    const [state, setState] = useState<DebridStreamState>({
        streamUrl: null,
        name: null,
        loading: false,
        error: null,
        seeders: null,
        quality: null,
        subtitles: [],
    });

    const abortRef = useRef<AbortController | null>(null);

    const resolve = useCallback(async (
        imdbId: string,
        type: MediaType,
        season?: number,
        episode?: number,
        title?: string,
        tmdbId?: string,
        forceFresh?: boolean
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
            if (!forceFresh) {
                const cached = readCache(ck);
                if (cached) {
                    console.log(`[DebridStream] 💾 Cache: ${cached.quality} | ${cached.url.substring(0, 60)}...`);
                    setState({ streamUrl: cached.url, name: cached.name, loading: false, error: null, seeders: cached.seeders, quality: cached.quality, subtitles: cached.subtitles || [] });
                    return JSON.stringify({ streamUrl: cached.url, name: cached.name, quality: cached.quality, seeders: cached.seeders });
                }
            }

            // ── Step 1: Fetch quality-sorted sources from frontend addons ──────────────────
            const params = new URLSearchParams({ imdbId, type });
            if (season) params.set('season', String(season));
            if (episode) params.set('episode', String(episode));
            if (title) params.set('title', title);
            if (tmdbId) params.set('tmdbId', tmdbId);
            if (forceFresh) params.set('nocache', 'true');

            // Fetch backend streams and subtitles in parallel
            let subtitles: any[] = [];
            const backendPromise = fetch(`${BACKEND_URL}/api/torrent/sources?${params}`, { signal })
                .then(r => r.json())
                .then(d => {
                    if (d.subtitles?.length) {
                        subtitles = d.subtitles;
                        setState(s => ({ ...s, subtitles: d.subtitles }));
                    }
                    return d.streams || [];
                }).catch(() => []);

            // Fetch high-speed streams from frontend addons directly!
            const frontendPromise = fetchFrontendSources(imdbId, type, season, episode, signal);

            const [backendStreams, frontendStreams] = await Promise.all([backendPromise, frontendPromise]);
            
            // Combine, filter out wrong episodes, and deduplicate
            const combined = [...backendStreams, ...frontendStreams];
            const unique = new Map();
            for (const item of combined) {
                if (!item?.infoHash) continue;

                // CRITICAL: Filter out wrong single episode torrents
                if (type === 'tv' && season != null && episode != null) {
                    if (isWrongEpisode(item.name || '', season, episode)) {
                        console.log(`[DebridStream] 🚫 Filtered out wrong episode torrent: "${item.name}"`);
                        continue;
                    }
                }

                if (!unique.has(item.infoHash) || item.seeders > unique.get(item.infoHash).seeders) {
                    unique.set(item.infoHash, item);
                }
            }
            const streams = Array.from(unique.values());
            
            if (!streams?.length) throw new Error('No torrent sources found');

            // Re-sort: prefer 1080p streamable over 4K remux
            const sorted = [...streams].sort((a, b) => {
                const sd = qualityScore(b.quality, b.name) - qualityScore(a.quality, a.name);
                return sd !== 0 ? sd : (b.seeders || 0) - (a.seeders || 0);
            });

            console.log(`[DebridStream] ${sorted.length} sources. Top: ${sorted.slice(0, 3).map(s => s.quality).join(', ')}`);

            // ── Steps 2–4: Bulk cache check and intelligent file selection ───
            let upData: any = null;
            let readyMagnets: any[] = [];
            let currentCandidates: any[] = [];
            let batchIndex = 0;
            const batchSize = 10;
            const maxBatches = 3;

            while (batchIndex < maxBatches && batchIndex * batchSize < sorted.length) {
                if (signal?.aborted) throw new Error('Aborted');
                
                const batch = sorted.slice(batchIndex * batchSize, (batchIndex + 1) * batchSize);
                const uploadParams = batch.map(c => `magnets[]=${encodeURIComponent(`magnet:?xt=urn:btih:${c.infoHash}&${TRACKERS}`)}`).join('&');
                
                const upRes = await fetch(`${ALLDEBRID_API}/magnet/upload?agent=${AGENT}&apikey=${ALLDEBRID_KEY}&${uploadParams}`, { signal });
                const batchUpData = await upRes.json();
                
                if (batchUpData?.status === 'success' && batchUpData?.data?.magnets) {
                    const batchReady = batchUpData.data.magnets.filter((m: any) => m.ready);
                    if (batchReady.length > 0) {
                        upData = batchUpData;
                        readyMagnets = batchReady;
                        currentCandidates = batch;
                        console.log(`[DebridStream] Waterfall hit at batch ${batchIndex + 1}: ${readyMagnets.length} cached sources found`);
                        break;
                    }
                }
                
                console.log(`[DebridStream] Waterfall batch ${batchIndex + 1} empty, trying next...`);
                batchIndex++;
            }

            if (!readyMagnets.length || !upData) {
                throw new Error('No cached sources available');
            }

            const fileParams = readyMagnets.map((m: any) => `id[]=${m.id}`).join('&');
            const fRes = await fetch(`${ALLDEBRID_API}/magnet/files?agent=${AGENT}&apikey=${ALLDEBRID_KEY}&${fileParams}`, { signal });
            const fData = await fRes.json();
            
            const fileMagnets = fData?.data?.magnets || readyMagnets; // Fallback to upload data if file fetch fails
            
            const playableFiles: Array<{ candidate: any; fileUrl: string; fileName: string; magnetId?: any }> = [];

            for (const mInfo of fileMagnets) {
                const cIndex = upData.data.magnets.findIndex((m: any) => String(m.id) === String(mInfo.id));
                if (cIndex === -1) {
                    console.warn(`[DebridStream] ⚠️ Missing magnet ID mapping for ${mInfo.id}`);
                    continue;
                }
                
                const candidate = currentCandidates[cIndex];
                const fList = mInfo.files || [];
                if (!mInfo.files || fList.length === 0) {
                    console.warn(`[DebridStream] ⚠️ Magnet ${mInfo.id} has no files or empty array. Fallback issue? mInfo:`, mInfo);
                }
                const bestUrl = findBestFileUrl(fList, candidate.fileIdx ?? null, type === 'tv' ? season : undefined, type === 'tv' ? episode : undefined);
                
                if (bestUrl) {
                    // Extract filename from the AllDebrid short link or find it in fList
                    let fileName = '';
                    const flat: any[] = [];
                    function flatten(items: any[]) {
                        for (const item of items || []) {
                            if (item.l) flat.push({ name: item.n || '', url: item.l });
                            if (item.e) flatten(item.e);
                            if (item.files) flatten(item.files);
                        }
                    }
                    flatten(fList);
                    const fileObj = flat.find(f => f.url === bestUrl);
                    fileName = fileObj ? fileObj.name : candidate.name;
                    
                    playableFiles.push({ candidate, fileUrl: bestUrl, fileName, magnetId: mInfo.id });
                }
            }

            const isDolbyCapable = getCodecProfile()?.isDolbyCapable ?? false;

            // SCORE THE ACTUAL FILES! (This is much smarter than scoring torrent names)
            playableFiles.sort((a, b) => {
                const aName = a.fileName.toLowerCase();
                const bName = b.fileName.toLowerCase();
                
                let aFileScore = 0;
                let bFileScore = 0;
                
                // Boost browser-native containers/codecs gently
                if (aName.endsWith('.mp4') || aName.includes('aac') || aName.includes('h264') || aName.includes('x264')) {
                    aFileScore += 8;
                }
                if (bName.endsWith('.mp4') || bName.includes('aac') || bName.includes('h264') || bName.includes('x264')) {
                    bFileScore += 8;
                }
                
                // Penalize heavy/incompatible codecs gently ONLY if the browser is NOT Dolby capable
                if (!isDolbyCapable) {
                    if (aName.endsWith('.mkv') || aName.includes('ac3') || aName.includes('dts') || aName.includes('truehd')) {
                        aFileScore -= 5;
                    }
                    if (bName.endsWith('.mkv') || bName.includes('ac3') || bName.includes('dts') || bName.includes('truehd')) {
                        bFileScore -= 5;
                    }
                }

                // Base candidate score (resolution + source keywords) is paramount!
                // We multiply candidate quality score by 20 so it dominates the file-level codec tweaks,
                // ensuring we never downgrade resolution (e.g. 1080p -> 720p) just for a codec.
                const aCandidateScore = qualityScore(a.candidate.quality, a.candidate.name) * 20 + aFileScore;
                const bCandidateScore = qualityScore(b.candidate.quality, b.candidate.name) * 20 + bFileScore;
                
                if (aCandidateScore !== bCandidateScore) return bCandidateScore - aCandidateScore;
                return (b.candidate.seeders || 0) - (a.candidate.seeders || 0);
            });

            const alternatives: Array<{ url: string; name: string; quality: string; seeders: number; _audio?: string }> = [];
            let winnerFile: any = null;

            for (const file of playableFiles.slice(0, 10)) {
                if (signal.aborted) break;

                try {
                    const uRes = await fetch(
                        `${ALLDEBRID_API}/link/unlock?agent=${AGENT}&apikey=${ALLDEBRID_KEY}&link=${encodeURIComponent(file.fileUrl)}`,
                        { signal }
                    );
                    const uData = await uRes.json();
                    const cdnUrl = uData?.data?.link;
                    if (!cdnUrl) {
                        console.warn(`[DebridStream] ⚠️ Unlock failed for ${file.fileName}:`, uData);
                        continue;
                    }

                    alternatives.push({
                        url: cdnUrl,
                        name: file.fileName,
                        quality: file.candidate.quality || 'Auto',
                        seeders: file.candidate.seeders || 0,
                        _audio: 'unknown',
                    });

                    if (alternatives.length === 1) {
                        winnerFile = file;
                        // Start playback immediately on the first (best) file found!
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
                    }
                } catch (e: any) {
                    if (e.name === 'AbortError') throw e;
                    console.warn(`[DebridStream] Candidate failed: ${e.message}`);
                }
            }

            // Smart Cleanup: Delete all non-winning magnets from the user's account in the background
            if (winnerFile) {
                const winningMagnetId = winnerFile.magnetId;
                const idsToDelete = upData.data.magnets
                    .map((m: any) => m.id)
                    .filter((id: any) => id && id !== winningMagnetId);

                if (idsToDelete.length > 0) {
                    const deleteParams = idsToDelete.map((id: any) => `id[]=${id}`).join('&');
                    fetch(`${ALLDEBRID_API}/magnet/delete?agent=${AGENT}&apikey=${ALLDEBRID_KEY}&${deleteParams}`)
                        .then(res => res.json())
                        .then(() => console.log('[DebridStream] 🧹 Smart Cleanup complete. Deleted losing magnets:', idsToDelete))
                        .catch(err => console.warn('[DebridStream] Smart Cleanup failed:', err));
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
            
            // Self-healing retry with fresh scraping!
            if (!forceFresh && (msg.includes('cached') || msg.includes('torrent') || msg.includes('sources'))) {
                console.log('[DebridStream] 🔄 Retrying with fresh live scraping (forceFresh)...');
                return resolve(imdbId, type, season, episode, title, tmdbId, true);
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

    /** Clear the session cache for a specific piece of content (e.g. after a broken link). */
    const clearCache = useCallback((imdbId: string, type: string, season?: number, episode?: number) => {
        try { sessionStorage.removeItem(makeCacheKey(imdbId, type, season, episode)); } catch { }
    }, []);

    return { ...state, resolve, reset, clearCache };
}
