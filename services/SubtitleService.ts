import { getExternalIds } from './api';
import { LANG_LABELS } from '../constants';
import { GoatAPIService } from './GoatAPIService';
import ISO6391 from 'iso-639-1';

export interface SubtitleTrack {
    url: string;
    lang: string;
    label: string;
    duration?: number;
    provider?: string;
}

const ISO3_TO_LANG: Record<string, string> = {
    eng: 'en',
    fre: 'fr', fra: 'fr',
    ger: 'de', deu: 'de',
    spa: 'es', esp: 'es',
    ita: 'it',
    por: 'pt',
    rus: 'ru',
    jpn: 'ja',
    kor: 'ko',
    chi: 'zh', zho: 'zh',
    ara: 'ar',
    tur: 'tr',
    nld: 'nl', dut: 'nl',
    pol: 'pl',
    swe: 'sv',
    dan: 'da',
    fin: 'fi',
    nno: 'no', nob: 'no', nor: 'no',
    hun: 'hu',
    ell: 'el', gre: 'el',
    heb: 'he',
    cze: 'cs', ces: 'cs',
    rum: 'ro', ron: 'ro',
    tha: 'th',
    vie: 'vi',
    ind: 'id',
    ukr: 'uk',
    hrv: 'hr',
    slo: 'sk', slk: 'sk',
    bul: 'bg',
    srp: 'sr',
    hin: 'hi',
};

const NATIVE_NAMES_TO_LANG: Record<string, string> = {
    english: 'en',
    spanish: 'es', español: 'es', espanol: 'es', castilian: 'es', castellano: 'es',
    french: 'fr', français: 'fr', francais: 'fr',
    german: 'de', deutsch: 'de',
    italian: 'it', italiano: 'it',
    portuguese: 'pt', português: 'pt', portugues: 'pt',
    russian: 'ru', русский: 'ru',
    japanese: 'ja', 日本語: 'ja', nihongo: 'ja',
    korean: 'ko', 한국어: 'ko', hangugeo: 'ko',
    chinese: 'zh', 中文: 'zh', 汉语: 'zh', 漢語: 'zh',
    arabic: 'ar', العربية: 'ar',
    turkish: 'tr', türkçe: 'tr', turkce: 'tr',
    dutch: 'nl', nederlands: 'nl',
    polish: 'pl', polski: 'pl',
    swedish: 'sv', svenska: 'sv',
    danish: 'da', dansk: 'da',
    finnish: 'fi', suomi: 'fi',
    norwegian: 'no', norsk: 'no',
    hungarian: 'hu', magyar: 'hu',
    greek: 'el', ελληνικά: 'el',
    hebrew: 'he', עברית: 'he',
    czech: 'cs', čeština: 'cs',
    romanian: 'ro', română: 'ro',
    thai: 'th', ไทย: 'th',
    vietnamese: 'vi', 'tiếng việt': 'vi',
    indonesian: 'id', 'bahasa indonesia': 'id',
    ukrainian: 'uk', українська: 'uk',
    croatian: 'hr', hrvatski: 'hr',
    slovak: 'sk', slovenčina: 'sk',
    bulgarian: 'bg', български: 'bg',
    serbian: 'sr', srpski: 'sr',
    hindi: 'hi', हिन्दी: 'hi',
};

function labelToLangCode(label: string): string {
    if (!label) return 'en';
    const trimmed = label.trim().toLowerCase();

    if (LANG_LABELS[trimmed]) return trimmed;

    const cleanForISO = trimmed
        .replace(/\(.*\)/g, '')
        .replace(/\[.*\]/g, '')
        .replace(/\b(forced|sdh|cc|hi|hearing impaired|impaired|hearing|full|default|subtitles|subtitle|lyrics|commentary)\b/gi, '')
        .replace(/[^a-z\s]/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    if (!cleanForISO) return 'en';

    const isoCode = ISO6391.getCode(cleanForISO);
    if (isoCode) return isoCode;

    const tokens = cleanForISO.split(/\s+/);
    const cleanWord = tokens[0] || '';

    if (cleanWord && NATIVE_NAMES_TO_LANG[cleanWord]) return NATIVE_NAMES_TO_LANG[cleanWord];
    if (NATIVE_NAMES_TO_LANG[cleanForISO]) return NATIVE_NAMES_TO_LANG[cleanForISO];

    if (cleanWord && ISO3_TO_LANG[cleanWord]) return ISO3_TO_LANG[cleanWord];
    if (ISO3_TO_LANG[cleanForISO]) return ISO3_TO_LANG[cleanForISO];

    const entry = Object.entries(LANG_LABELS).find(([, name]) =>
        name.toLowerCase() === cleanForISO || (cleanWord && name.toLowerCase() === cleanWord)
    );
    if (entry) return entry[0];

    for (const [name, code] of Object.entries(NATIVE_NAMES_TO_LANG)) {
        if (cleanForISO.includes(name) || (cleanWord && cleanWord.includes(name))) return code;
    }
    for (const [code, name] of Object.entries(LANG_LABELS)) {
        if (cleanForISO.includes(name.toLowerCase()) || (cleanWord && cleanWord.includes(name.toLowerCase()))) return code;
    }

    const alphabeticOnly = cleanForISO.replace(/[^a-z]/g, '');
    if (alphabeticOnly.length >= 2) {
        return alphabeticOnly.length <= 3 ? alphabeticOnly : alphabeticOnly.substring(0, 3);
    }

    return 'en';
}

function getBrowserLangCode(): string {
    const nav = navigator.language || (navigator as any).userLanguage || 'en';
    return nav.split('-')[0].toLowerCase();
}

function makeLabel(lang: string, fallback?: string): string {
    return LANG_LABELS[lang] || fallback || lang.toUpperCase();
}

const SUBDL_KEY = import.meta.env.VITE_SUBDL_API_KEY || '';
const OS_COM_KEY = import.meta.env.VITE_OS_API_KEY || '';

// ── Provider: GoatAPI ─────────────────────────────────────────────────────────
// Multiple base URLs to try in order — if one worker is down, fall through

const GOAT_BASES = [
    'https://goatapi.imreallydagoatt.workers.dev',
];

async function fetchGoatTracks(
    tmdbId: string,
    type: 'movie' | 'tv',
    season?: number,
    episode?: number
): Promise<SubtitleTrack[]> {
    const cleanId = tmdbId.replace('tt', '');
    const path = type === 'movie'
        ? `/api/subtitles/movie/${cleanId}`
        : `/api/subtitles/tv/${cleanId}/${season}/${episode}`;

    // Try direct worker URLs
    for (const base of GOAT_BASES) {
        try {
            const res = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(9000) });
            if (!res.ok) continue;
            const data = await res.json();
            const list: any[] = Array.isArray(data) ? data : data?.subtitles || data?.data || [];
            if (!list.length) continue;
            return list
                .map((sub: any) => {
                    const lang = labelToLangCode(sub.language || sub.lang || '');
                    return { url: sub.url, lang, label: makeLabel(lang, sub.language || sub.display), provider: 'GoatAPI' };
                })
                .filter(t => t.url);
        } catch {
            // try next
        }
    }

    // Fallback via GoatAPIService wrapper
    try {
        const subs = await GoatAPIService.fetchSubtitles(tmdbId, type, season, episode);
        return subs
            .map(sub => {
                const lang = labelToLangCode(sub.language);
                return { url: sub.url, lang, label: makeLabel(lang, sub.language), provider: 'GoatAPI' };
            })
            .filter(t => t.url);
    } catch {
        return [];
    }
}

// ── Provider: SubSource ──────────────────────────────────────────────────────
// Uses IMDB ID, POST-based search — CORS-enabled community API

async function fetchSubSourceTracks(
    imdbId: string,
    type: 'movie' | 'tv',
    season?: number,
    episode?: number
): Promise<SubtitleTrack[]> {
    try {
        const cleanId = imdbId.startsWith('tt') ? imdbId : `tt${imdbId}`;
        const payload = type === 'movie'
            ? { movie: cleanId }
            : { movie: cleanId, season: season ?? 1, episode: episode ?? 1 };

        const res = await fetch('https://api.subsource.net/api/searchSubs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) return [];
        const data = await res.json();
        const list: any[] = Array.isArray(data.found) ? data.found : [];

        return list
            .flatMap((entry: any) => {
                if (!Array.isArray(entry.subs)) return [];
                return entry.subs.map((sub: any) => {
                    const lang = labelToLangCode(sub.lang || sub.language || '');
                    return {
                        url: `https://api.subsource.net/api/downloadSub/${entry.linkPage}/${sub.subId}`,
                        lang,
                        label: makeLabel(lang, sub.lang),
                        provider: 'SubSource',
                    };
                });
            })
            .filter(t => t.url);
    } catch {
        return [];
    }
}

// ── Provider: SubDL ──────────────────────────────────────────────────────────
// TMDB ID native, returns zip files. Requires VITE_SUBDL_API_KEY (free at subdl.com/register)

async function fetchSubDLTracks(
    tmdbId: string,
    type: 'movie' | 'tv',
    season?: number,
    episode?: number,
    langCodes: string[] = ['en']
): Promise<SubtitleTrack[]> {
    if (!SUBDL_KEY) return [];
    try {
        const langs = langCodes.slice(0, 10).join(',');
        let url = `https://api.subdl.com/api/v1/subtitles?api_key=${SUBDL_KEY}&tmdb_id=${tmdbId}&type=${type === 'movie' ? 'movie' : 'tv'}&subs_per_page=30&language=${langs}`;
        if (type === 'tv' && season != null) url += `&season_number=${season}&episode_number=${episode ?? 1}`;

        const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
        if (!res.ok) return [];
        const data = await res.json();
        if (!Array.isArray(data.subtitles)) return [];

        return data.subtitles.map((sub: any) => {
            const lang = labelToLangCode(sub.language || '');
            return {
                url: `https://dl.subdl.com${sub.url}`,
                lang,
                label: makeLabel(lang, sub.language),
                provider: 'SubDL',
            };
        });
    } catch {
        return [];
    }
}

// ── Provider: OpenSubtitles.com v3 ───────────────────────────────────────────
// Requires VITE_OS_API_KEY (free at opensubtitles.com/consumers)
// CORS-enabled, browser-friendly API

async function fetchOSComTracks(
    imdbId: string,
    type: 'movie' | 'tv',
    season?: number,
    episode?: number,
    langCodes: string[] = ['en']
): Promise<SubtitleTrack[]> {
    if (!OS_COM_KEY) return [];
    try {
        const cleanId = imdbId.replace(/^tt/, '');
        const langs = langCodes.slice(0, 10).join(',');
        let url = `https://api.opensubtitles.com/api/v1/subtitles?imdb_id=${cleanId}&languages=${langs}&order_by=download_count&order_direction=desc`;
        if (type === 'tv' && season != null) url += `&season_number=${season}&episode_number=${episode ?? 1}`;

        const res = await fetch(url, {
            headers: { 'Api-Key': OS_COM_KEY, 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) return [];
        const data = await res.json();
        const list: any[] = Array.isArray(data.data) ? data.data : [];

        return list.slice(0, 40).flatMap((item: any) => {
            const attrs = item.attributes || {};
            const lang = labelToLangCode(attrs.language || '');
            const fileId = attrs.files?.[0]?.file_id;
            if (!fileId) return [];
            return [{
                url: `__oscom_file_${fileId}`,
                lang,
                label: makeLabel(lang, attrs.language),
                provider: 'OS.com',
            }];
        });
    } catch {
        return [];
    }
}

const osComDownloadCache = new Map<string, string>();

async function resolveOSComUrl(fileId: string): Promise<string> {
    if (osComDownloadCache.has(fileId)) return osComDownloadCache.get(fileId)!;
    if (!OS_COM_KEY) return '';
    try {
        const res = await fetch('https://api.opensubtitles.com/api/v1/download', {
            method: 'POST',
            headers: { 'Api-Key': OS_COM_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({ file_id: Number(fileId) }),
            signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) return '';
        const data = await res.json();
        const link: string = data.link || '';
        if (link) osComDownloadCache.set(fileId, link);
        return link;
    } catch {
        return '';
    }
}

// ── Zip extraction (for SubDL) ────────────────────────────────────────────────

async function extractSubtitleFromZip(buffer: ArrayBuffer): Promise<string | null> {
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(buffer);
    const names = Object.keys(zip.files);
    const subFile = names.find(n => /\.(srt|vtt|ass|ssa|sub)$/i.test(n) && !zip.files[n].dir);
    if (!subFile) return null;
    return zip.files[subFile].async('string');
}

// ── Public API ────────────────────────────────────────────────────────────────

export const SubtitleService = {
    /**
     * Fetch subtitle text from a URL — zip-aware (SubDL), OS.com file-ID-aware.
     * VideoPlayer must call this instead of raw fetch() to get subtitle content.
     */
    resolveSubtitleText: async (url: string): Promise<string> => {
        // OpenSubtitles.com: resolve file ID to real download link first
        if (url.startsWith('__oscom_file_')) {
            const fileId = url.replace('__oscom_file_', '');
            const realUrl = await resolveOSComUrl(fileId);
            if (!realUrl) throw new Error('Could not resolve OS.com download URL');
            const res = await fetch(realUrl, { signal: AbortSignal.timeout(12000) });
            if (!res.ok) throw new Error(`OS.com download failed: ${res.status}`);
            return res.text();
        }

        // SubDL and any other zip URLs: download + extract SRT from zip
        if (url.includes('dl.subdl.com') || /\.zip(\?.*)?$/i.test(url)) {
            // SubDL zips are not CORS-blocked at download time (they use a CDN)
            const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
            if (!res.ok) throw new Error(`Zip fetch failed: ${res.status}`);
            const buf = await res.arrayBuffer();
            const text = await extractSubtitleFromZip(buf);
            if (!text) throw new Error('No subtitle file found in zip');
            return text;
        }

        // Regular SRT/VTT/ASS URL
        const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
        if (!res.ok) throw new Error(`Subtitle fetch failed: ${res.status}`);
        return res.text();
    },

    getSubtitleTracks: async (
        tmdbId: string,
        type: 'movie' | 'tv',
        season?: number,
        episode?: number,
        preferredLang?: string,
        imdbId?: string
    ): Promise<SubtitleTrack[]> => {
        try {
            const browserLang = preferredLang || getBrowserLangCode();
            const priorityLangs = Array.from(new Set([
                browserLang, 'en', 'es', 'fr', 'de', 'it', 'pt', 'ru',
                'ja', 'ko', 'zh', 'ar', 'tr', 'nl', 'pl', 'sv', 'da',
                'fi', 'hu', 'cs', 'ro', 'uk', 'hi',
            ]));

            // Resolve IMDB ID if not provided (needed for SubSource & OS.com)
            const targetImdbId = imdbId || await (async () => {
                try {
                    const extIds = await getExternalIds(tmdbId.replace('tt', ''), type);
                    return extIds?.imdb_id;
                } catch {
                    return undefined;
                }
            })();

            // All providers run in parallel — any failure is silently skipped
            const [
                goatResult,
                subSourceResult,
                subDLResult,
                osComResult,
            ] = await Promise.allSettled([
                fetchGoatTracks(tmdbId, type, season, episode),
                targetImdbId
                    ? fetchSubSourceTracks(targetImdbId, type, season, episode)
                    : Promise.resolve([]),
                fetchSubDLTracks(tmdbId, type, season, episode, priorityLangs),
                (targetImdbId && OS_COM_KEY)
                    ? fetchOSComTracks(targetImdbId, type, season, episode, priorityLangs)
                    : Promise.resolve([]),
            ]);

            const results = [goatResult, subSourceResult, subDLResult, osComResult];
            const names   = ['GoatAPI', 'SubSource', 'SubDL', 'OS.com'];

            const allTracks: SubtitleTrack[] = [];
            const seenUrls = new Set<string>();

            for (let i = 0; i < results.length; i++) {
                const r = results[i];
                if (r.status === 'fulfilled' && r.value.length > 0) {
                    console.log(`[Subtitles] ${names[i]}: ${r.value.length} tracks`);
                    for (const t of r.value) {
                        if (t.url && !seenUrls.has(t.url)) {
                            seenUrls.add(t.url);
                            allTracks.push(t);
                        }
                    }
                } else if (r.status === 'rejected') {
                    console.warn(`[Subtitles] ${names[i]} error:`, (r as PromiseRejectedResult).reason);
                }
            }

            if (allTracks.length === 0) {
                console.warn('[Subtitles] No providers returned results. GoatAPI may be down. Add VITE_SUBDL_API_KEY or VITE_OS_API_KEY to .env for guaranteed results.');
            }

            // Number duplicate-label tracks per language
            const langCount: Record<string, number> = {};
            return allTracks.map(t => {
                langCount[t.lang] = (langCount[t.lang] || 0) + 1;
                const n = langCount[t.lang];
                return { ...t, label: n > 1 ? `${t.label} ${n}` : t.label };
            });
        } catch (err) {
            console.error('[Subtitles] Error:', err);
            return [];
        }
    },
};
