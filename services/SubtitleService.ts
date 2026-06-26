import { getExternalIds } from './api';
import { LANG_LABELS } from '../constants';
import ISO6391 from 'iso-639-1';

export interface SubtitleTrack {
    url: string;
    lang: string;
    label: string;
    duration?: number;
    provider?: string;
}

// ── Language mapping ──────────────────────────────────────────────────────────
// Stremio / OpenSubtitles use ISO 639-2B (3-letter) codes. Map all known ones.

const ISO3_TO_LANG: Record<string, string> = {
    // European
    eng: 'en',
    fre: 'fr', fra: 'fr',
    ger: 'de', deu: 'de',
    spa: 'es', esp: 'es', spl: 'es', spn: 'es', // spl/spn = OS Spanish variants
    ita: 'it',
    por: 'pt', pob: 'pt', // pob = Brazilian Portuguese
    rus: 'ru',
    pol: 'pl',
    nld: 'nl', dut: 'nl',
    swe: 'sv',
    dan: 'da',
    fin: 'fi',
    nno: 'no', nob: 'no', nor: 'no',
    hun: 'hu',
    ell: 'el', gre: 'el',
    heb: 'he',
    cze: 'cs', ces: 'cs',
    rum: 'ro', ron: 'ro',
    hrv: 'hr',
    slo: 'sk', slk: 'sk',
    slv: 'sl',
    bul: 'bg',
    srp: 'sr',
    bos: 'bs',
    lit: 'lt',
    lav: 'lv',
    est: 'et',
    cat: 'ca',
    glg: 'gl',
    baq: 'eu', eus: 'eu',
    alb: 'sq', sqi: 'sq',
    mac: 'mk', mkd: 'mk',
    ice: 'is', isl: 'is',
    // Asian
    jpn: 'ja',
    kor: 'ko',
    chi: 'zh', zho: 'zh', zht: 'zh',
    tha: 'th',
    vie: 'vi',
    ind: 'id',
    may: 'ms', msa: 'ms',
    hin: 'hi',
    tam: 'ta',
    mal: 'ml',
    ben: 'bn',
    tel: 'te',
    mar: 'mr',
    pan: 'pa',
    sin: 'si',
    urd: 'ur',
    // Middle-East / Central Asia / Africa
    ara: 'ar',
    tur: 'tr',
    per: 'fa', fas: 'fa',
    kat: 'ka',
    hye: 'hy', arm: 'hy',
    aze: 'az',
    kaz: 'kk',
    uzb: 'uz',
    ukr: 'uk',
    bel: 'be',
    swa: 'sw',
    afr: 'af',
};

const NATIVE_NAMES_TO_LANG: Record<string, string> = {
    english: 'en',
    spanish: 'es', español: 'es', espanol: 'es', castellano: 'es',
    french: 'fr', français: 'fr', francais: 'fr',
    german: 'de', deutsch: 'de',
    italian: 'it', italiano: 'it',
    portuguese: 'pt', português: 'pt', portugues: 'pt',
    russian: 'ru', русский: 'ru',
    japanese: 'ja', 日本語: 'ja',
    korean: 'ko', 한국어: 'ko',
    chinese: 'zh', 中文: 'zh',
    arabic: 'ar', العربية: 'ar',
    turkish: 'tr', türkçe: 'tr',
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
    vietnamese: 'vi',
    indonesian: 'id',
    ukrainian: 'uk', українська: 'uk',
    croatian: 'hr', hrvatski: 'hr',
    slovak: 'sk',
    bulgarian: 'bg', български: 'bg',
    serbian: 'sr', srpski: 'sr',
    hindi: 'hi', हिन्दी: 'hi',
    persian: 'fa', farsi: 'fa',
    bosnian: 'bs',
    icelandic: 'is',
    slovenian: 'sl',
    albanian: 'sq',
    malay: 'ms',
    tamil: 'ta',
    sinhala: 'si', sinhalese: 'si',
};

function labelToLangCode(label: string): string {
    if (!label) return 'en';
    const trimmed = label.trim().toLowerCase();

    // 1. Direct 2-letter code
    if (LANG_LABELS[trimmed]) return trimmed;

    // 2. 3-letter ISO (most common from Stremio)
    if (ISO3_TO_LANG[trimmed]) return ISO3_TO_LANG[trimmed];

    // Clean for ISO library lookup
    const clean = trimmed
        .replace(/\(.*?\)/g, '').replace(/\[.*?\]/g, '')
        .replace(/\b(forced|sdh|cc|hi|hearing impaired|full|default|subtitles|subtitle|lyrics|commentary)\b/gi, '')
        .replace(/[^a-z\s]/gi, ' ').replace(/\s+/g, ' ').trim();

    if (!clean) return 'en';

    const isoCode = ISO6391.getCode(clean);
    if (isoCode) return isoCode;

    const firstWord = clean.split(' ')[0] || '';

    if (firstWord && NATIVE_NAMES_TO_LANG[firstWord]) return NATIVE_NAMES_TO_LANG[firstWord];
    if (NATIVE_NAMES_TO_LANG[clean]) return NATIVE_NAMES_TO_LANG[clean];

    if (firstWord && ISO3_TO_LANG[firstWord]) return ISO3_TO_LANG[firstWord];

    for (const [code, name] of Object.entries(LANG_LABELS)) {
        if (clean.includes(name.toLowerCase())) return code;
    }

    const alpha = clean.replace(/[^a-z]/g, '');
    if (alpha.length >= 2) return alpha.length <= 3 ? alpha : alpha.slice(0, 3);

    return 'en';
}

function getBrowserLangCode(): string {
    const nav = navigator.language || (navigator as any).userLanguage || 'en';
    return nav.split('-')[0].toLowerCase();
}

function makeLabel(lang: string): string {
    return LANG_LABELS[lang] || lang.toUpperCase();
}

const SUBDL_KEY = import.meta.env.VITE_SUBDL_API_KEY || '';

// ── Provider 1: Stremio / OpenSubtitles-v3 ───────────────────────────────────
// CORS *, no key required, direct UTF-8 SRT via subs5.strem.io
// Endpoint: https://opensubtitles-v3.strem.io/subtitles/{movie|series}/tt{id}[:{s}:{e}].json
// Field `g` ≈ download-group popularity — higher = more downloaded release

const MAX_PER_LANG_STREMIO = 1;

// Junk signals detectable from first 3 KB of an SRT file.
// Returns a 0–100 quality score (higher = cleaner sub).
async function scoreSubtitleHead(url: string): Promise<number> {
    try {
        const ac = new AbortController();
        const timer = setTimeout(() => ac.abort(), 4000);
        const res = await fetch(url, { signal: ac.signal });
        clearTimeout(timer);
        if (!res.ok) return 0;

        // Read only first 3 KB then abort the stream
        const reader = res.body?.getReader();
        if (!reader) return 50;
        let bytes = 0;
        const chunks: Uint8Array[] = [];
        while (bytes < 3072) {
            const { done, value } = await reader.read();
            if (done || !value) break;
            chunks.push(value);
            bytes += value.byteLength;
        }
        reader.cancel();

        const head = new TextDecoder().decode(
            chunks.reduce((acc, c) => { const m = new Uint8Array(acc.length + c.length); m.set(acc); m.set(c, acc.length); return m; }, new Uint8Array())
        );

        let score = 80;

        // Syncer watermark — kills usability for first cue
        if (/<font[^>]+color/i.test(head) && /sync|fixed|encoded|subscene|opensubtitles/i.test(head)) score -= 30;

        // HI-only file: lots of (ALL CAPS PARENS) = made for deaf, lots of clutter
        const hiMatches = (head.match(/\([A-Z]{3,}[^)]*\)/g) || []).length;
        if (hiMatches > 5) score -= 25;
        else if (hiMatches > 2) score -= 10;

        // Speaker name prefixes: DRE:, ROSS:, etc.
        const nameMatches = (head.match(/^[A-Z][A-Z ]{2,}:/gm) || []).length;
        if (nameMatches > 3) score -= 15;

        // Good signals: has actual dialogue content
        const cueCount = (head.match(/\d+:\d+:\d+,\d+ -->/g) || []).length;
        if (cueCount >= 5) score += 10;

        return Math.max(0, Math.min(100, score));
    } catch {
        return 50; // timeout or error → neutral
    }
}

async function pickBestCandidate(lang: string, candidates: any[]): Promise<SubtitleTrack> {
    if (candidates.length === 1) {
        return { url: candidates[0].url, lang, label: makeLabel(lang), provider: 'Stremio' };
    }

    // Score top candidates in parallel — only the first 3 KB each so it's fast
    const scores = await Promise.all(candidates.map(c => scoreSubtitleHead(c.url)));
    const best = candidates.reduce((bi, _, i) => scores[i] > scores[bi] ? i : bi, 0);

    console.log(`[Subtitles] ${lang} scores: ${scores.join(', ')} → picked #${best}`);
    return { url: candidates[best].url, lang, label: makeLabel(lang), provider: 'Stremio' };
}

async function fetchStremioTracks(
    imdbId: string,
    type: 'movie' | 'tv',
    season?: number,
    episode?: number
): Promise<SubtitleTrack[]> {
    const id = imdbId.startsWith('tt') ? imdbId : `tt${imdbId}`;
    const path = type === 'movie'
        ? `/subtitles/movie/${id}.json`
        : `/subtitles/series/${id}:${season ?? 1}:${episode ?? 1}.json`;

    const res = await fetch(`https://opensubtitles-v3.strem.io${path}`, {
        signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`Stremio HTTP ${res.status}`);

    const data = await res.json();
    const list: any[] = Array.isArray(data.subtitles) ? data.subtitles : [];
    if (!list.length) return [];

    // Group by resolved 2-letter lang code, sort each group by `g` desc
    const byLang = new Map<string, any[]>();
    for (const sub of list) {
        if (!sub.url || !sub.lang) continue;
        const lang = labelToLangCode(sub.lang);
        const group = byLang.get(lang);
        if (group) group.push(sub);
        else byLang.set(lang, [sub]);
    }

    // For each language: pick top by `g`, then do a lazy quality scan on the
    // top 2 candidates. If #1 is junk (HI-only or syncer watermark), use #2.
    const candidateChecks: Promise<SubtitleTrack>[] = [];
    for (const [lang, subs] of byLang) {
        const sorted = subs.sort((a, b) => (parseInt(b.g) || 0) - (parseInt(a.g) || 0));
        const candidates = sorted.slice(0, 3); // score top 3, keep best
        candidateChecks.push(pickBestCandidate(lang, candidates));
    }

    return (await Promise.all(candidateChecks)).filter(t => t.url);
}

// ── Provider 2: SubDL ─────────────────────────────────────────────────────────
// CORS-enabled developer API, TMDB-native, returns zip files (extracted via JSZip)
// Requires VITE_SUBDL_API_KEY — free at https://subdl.com/register

const MAX_PER_LANG_SUBDL = 1;

async function fetchSubDLTracks(
    tmdbId: string,
    type: 'movie' | 'tv',
    season?: number,
    episode?: number,
    langCodes: string[] = ['en']
): Promise<SubtitleTrack[]> {
    if (!SUBDL_KEY) return [];

    const langs = langCodes.slice(0, 10).join(',');
    let url = `https://api.subdl.com/api/v1/subtitles?api_key=${SUBDL_KEY}&tmdb_id=${tmdbId}&type=${type === 'movie' ? 'movie' : 'tv'}&subs_per_page=30&language=${langs}`;
    if (type === 'tv' && season != null) url += `&season_number=${season}&episode_number=${episode ?? 1}`;

    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`SubDL HTTP ${res.status}`);

    const data = await res.json();
    const list: any[] = Array.isArray(data.subtitles) ? data.subtitles : [];
    if (!list.length) return [];

    const byLang = new Map<string, any[]>();
    for (const sub of list) {
        if (!sub.url || !sub.language) continue;
        const lang = labelToLangCode(sub.language);
        const group = byLang.get(lang);
        if (group) group.push(sub);
        else byLang.set(lang, [sub]);
    }

    const tracks: SubtitleTrack[] = [];
    for (const [lang, subs] of byLang) {
        for (const sub of subs.slice(0, MAX_PER_LANG_SUBDL)) {
            tracks.push({
                url: `https://dl.subdl.com${sub.url}`,
                lang,
                label: makeLabel(lang),
                provider: 'SubDL',
            });
        }
    }
    return tracks;
}

// ── Zip extraction (for SubDL zip files) ────────────────────────────────────

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
     * Resolve subtitle text from any URL the system returns:
     * - SubDL zip → extract SRT via JSZip
     * - Everything else → direct fetch
     * VideoPlayer calls this instead of raw fetch().
     */
    resolveSubtitleText: async (url: string): Promise<string> => {
        if (url.includes('dl.subdl.com') || /\.zip(\?.*)?$/i.test(url)) {
            const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
            if (!res.ok) throw new Error(`Zip fetch failed: ${res.status}`);
            const buf = await res.arrayBuffer();
            const text = await extractSubtitleFromZip(buf);
            if (!text) throw new Error('No subtitle file found in zip');
            return text;
        }
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
                'fi', 'hu', 'cs', 'ro', 'uk', 'hi', 'fa',
            ]));

            // Resolve IMDB ID — required for Stremio
            const targetImdbId = imdbId || await (async () => {
                try {
                    const extIds = await getExternalIds(tmdbId.replace('tt', ''), type);
                    return extIds?.imdb_id;
                } catch {
                    return undefined;
                }
            })();

            const [stremioResult, subDLResult] = await Promise.allSettled([
                targetImdbId
                    ? fetchStremioTracks(targetImdbId, type, season, episode)
                    : Promise.resolve([]),
                fetchSubDLTracks(tmdbId, type, season, episode, priorityLangs),
            ]);

            // Merge providers: Stremio first (better quality), SubDL fills gaps.
            // One track per language — first provider to supply a language wins.
            const byLang = new Map<string, SubtitleTrack>();

            const addResult = (r: PromiseSettledResult<SubtitleTrack[]>, name: string) => {
                if (r.status === 'fulfilled' && r.value.length > 0) {
                    console.log(`[Subtitles] ${name}: ${r.value.length} tracks`);
                    for (const t of r.value) {
                        if (t.url && !byLang.has(t.lang)) byLang.set(t.lang, t);
                    }
                } else if (r.status === 'rejected') {
                    console.warn(`[Subtitles] ${name} failed:`, r.reason);
                }
            };

            addResult(stremioResult, 'Stremio');
            addResult(subDLResult, 'SubDL');

            if (byLang.size === 0) {
                console.warn('[Subtitles] No tracks found.');
                return [];
            }

            // Sort: browser lang first, then English, then alphabetical
            const langPriority = (lang: string) => {
                if (lang === browserLang) return 0;
                if (lang === 'en') return 1;
                return 2;
            };

            return Array.from(byLang.values()).sort((a, b) => {
                const pd = langPriority(a.lang) - langPriority(b.lang);
                return pd !== 0 ? pd : a.lang.localeCompare(b.lang);
            });
        } catch (err) {
            console.error('[Subtitles]', err);
            return [];
        }
    },
};
