import { getExternalIds } from './api';
import { LANG_LABELS, LANG_TO_OS } from '../constants';
import { GoatAPIService } from './GoatAPIService';
import ISO6391 from 'iso-639-1';

export interface SubtitleTrack {
    url: string;
    lang: string;
    label: string;
    duration?: number;
}



const ISO3_TO_LANG: Record<string, string> = {
    eng: 'en',
    fre: 'fr', fra: 'fr',
    ger: 'de', deu: 'de',
    spa: 'es', esp: 'es', // Added 'esp' variation
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
    
    // 1. Try direct match in LANG_LABELS keys (2-letter ISO code)
    if (LANG_LABELS[trimmed]) {
        return trimmed;
    }
    
    // Clean label for iso-639-1 (strip parentheticals, brackets, classification terms, and punctuation)
    const cleanForISO = trimmed
        .replace(/\(.*\)/g, '')
        .replace(/\[.*\]/g, '')
        .replace(/\b(forced|sdh|cc|hi|hearing impaired|impaired|hearing|full|default|subtitles|subtitle|lyrics|commentary)\b/gi, '')
        .replace(/[^a-z\s]/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
        
    if (!cleanForISO) return 'en';

    // Try direct lookup with cleaned string via ISO-639-1
    const isoCode = ISO6391.getCode(cleanForISO);
    if (isoCode) {
        return isoCode;
    }
    
    // Extract first word/token for matching
    const tokens = cleanForISO.split(/\s+/);
    const cleanWord = tokens[0] || '';
    
    // Try matching tokens or whole string in NATIVE_NAMES_TO_LANG
    if (cleanWord && NATIVE_NAMES_TO_LANG[cleanWord]) {
        return NATIVE_NAMES_TO_LANG[cleanWord];
    }
    if (NATIVE_NAMES_TO_LANG[cleanForISO]) {
        return NATIVE_NAMES_TO_LANG[cleanForISO];
    }
    
    // 2. Try match in 3-letter ISO/OS maps
    if (cleanWord && ISO3_TO_LANG[cleanWord]) {
        return ISO3_TO_LANG[cleanWord];
    }
    if (ISO3_TO_LANG[cleanForISO]) {
        return ISO3_TO_LANG[cleanForISO];
    }

    // 3. Try matching standard LANG_LABELS values (English name)
    const entry = Object.entries(LANG_LABELS).find(([code, name]) =>
        name.toLowerCase() === cleanForISO || (cleanWord && name.toLowerCase() === cleanWord)
    );
    if (entry) {
        return entry[0];
    }

    // 4. Fallback: check if the string contains a language name as a substring
    for (const [name, code] of Object.entries(NATIVE_NAMES_TO_LANG)) {
        if (cleanForISO.includes(name) || (cleanWord && cleanWord.includes(name))) {
            return code;
        }
    }
    for (const [code, name] of Object.entries(LANG_LABELS)) {
        if (cleanForISO.includes(name.toLowerCase()) || (cleanWord && cleanWord.includes(name.toLowerCase()))) {
            return code;
        }
    }

    // 5. Unrecognized alphabetic fallback:
    // If the label is not in our maps but has valid letters, DO NOT fall back to 'en' (English)
    // because that would incorrectly render "English" in the UI. Instead, return the code itself.
    const alphabeticOnly = cleanForISO.replace(/[^a-z]/g, '');
    if (alphabeticOnly.length >= 2) {
        if (alphabeticOnly.length === 2 || alphabeticOnly.length === 3) {
            return alphabeticOnly;
        }
        return alphabeticOnly.substring(0, 3);
    }

    return 'en'; // Hard fallback if completely non-alphabetic/empty
}

/** Detect the user's preferred language code from the browser */
function getBrowserLangCode(): string {
    const nav = navigator.language || (navigator as any).userLanguage || 'en';
    // e.g. "it-IT" or "en-US" → "it" or "en"
    return nav.split('-')[0].toLowerCase();
}

const BACKEND_URL = import.meta.env.VITE_GIGA_BACKEND_URL || 'https://ibrahimar397-pstream-giga.hf.space';

export const SubtitleService = {


    /**
     * Fetch subtitles for multiple languages from OpenSubtitles legacy API.
     * Returns all found tracks, deduped by language.
     */
    getOpenSubtitlesTracks: async (
        imdbId: string,
        type: 'movie' | 'tv',
        season?: number,
        episode?: number,
        langCodes: string[] = ['en']
    ): Promise<SubtitleTrack[]> => {
        const BASE = 'https://rest.opensubtitles.org/search/';
        const headers = { 'X-User-Agent': 'VLSub 0.10.2' };

        // Build lang IDs string (e.g. "eng,ita,spa")
        const langIds = langCodes
            .map(c => LANG_TO_OS[c] || 'eng')
            .filter((v, i, a) => a.indexOf(v) === i)
            .join(',');

        let url = `${BASE}`;
        if (type === 'tv' && season && episode) {
            url += `episode-${episode}/imdbid-${imdbId}/season-${season}/sublanguageid-${langIds}`;
        } else {
            url += `imdbid-${imdbId}/sublanguageid-${langIds}`;
        }

        try {
            const proxyUrl = `${BACKEND_URL}/proxy/subtitles/opensubtitles?url=${encodeURIComponent(url)}`;
            const response = await fetch(proxyUrl, { 
                headers: { 'X-User-Agent': 'VLSub 0.10.2' },
                signal: AbortSignal.timeout(10000) 
            });
            if (!response.ok) return [];
            const data = await response.json();
            if (!Array.isArray(data)) return [];

            // Sort best downloads first
            const sorted = [...data].sort((a: any, b: any) =>
                (parseInt(b.SubDownloadsCnt) || 0) - (parseInt(a.SubDownloadsCnt) || 0)
            );

            const langCounts: Record<string, number> = {};
            const tracks: SubtitleTrack[] = [];

            for (const sub of sorted) {
                if (!sub.SubDownloadLink) continue;
                const url = sub.SubDownloadLink
                    .replace('.gz', '')
                    .replace('download/', 'download/subencoding-utf8/');
                const lang = labelToLangCode(sub.LanguageName || '');
                const label = LANG_LABELS[lang] || sub.LanguageName || lang.toUpperCase();

                langCounts[lang] = (langCounts[lang] || 0) + 1;

                const duration = sub.MovieTimeMS ? parseFloat(sub.MovieTimeMS) / 1000 : undefined;

                // Allow up to 10 tracks per language to provide more options without clutter
                if (langCounts[lang] <= 10) {
                    tracks.push({ url, lang, label, duration });
                }
                
                if (tracks.length >= 50) break; // Relaxed total cap to 50
            }

            return tracks;
        } catch {
            return [];
        }
    },

    getSubtitleTracks: async (
        tmdbId: string,
        type: 'movie' | 'tv',
        season?: number,
        episode?: number,
        /** Override preferred language — uses browser language as default */
        preferredLang?: string,
        imdbId?: string // Allows direct lookup bypassing TMDB external IDs call
    ): Promise<SubtitleTrack[]> => {
        try {
            const allTracks: SubtitleTrack[] = [];

            // 1. Fetch GoatAPI Subtitles in parallel
            const goatSubPromise = GoatAPIService.fetchSubtitles(tmdbId, type, season, episode)
                .then(subs => {
                    return subs.map(sub => {
                        const lang = labelToLangCode(sub.language);
                        return {
                            url: sub.url,
                            lang: lang,
                            label: LANG_LABELS[lang] || sub.language,
                            duration: undefined
                        };
                    });
                })
                .catch(() => [] as SubtitleTrack[]);

            const targetImdbId = imdbId || (await (async () => {
                if (tmdbId) {
                    const cleanId = tmdbId.replace('tt', '');
                    const extIds = await getExternalIds(cleanId, type);
                    return extIds?.imdb_id;
                }
                return undefined;
            })());

            const osSubPromise = (async () => {
                if (!targetImdbId) {
                    console.warn('[SubtitleService] No IMDB ID for OpenSubtitles fallback.');
                    return [] as SubtitleTrack[];
                }
                const cleanImdbId = targetImdbId.replace('tt', '');
                const browserLang = preferredLang || getBrowserLangCode();
                const priorityLangs = Array.from(new Set([browserLang, 'en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh', 'ar', 'tr', 'nl', 'pl']));

                console.log(`[SubtitleService] Fetching OpenSubtitles for langs: ${priorityLangs.slice(0, 6).join(', ')}...`);
                return SubtitleService.getOpenSubtitlesTracks(
                    cleanImdbId, type, season, episode, priorityLangs
                );
            })();

            const [goatTracks, osTracks] = await Promise.all([goatSubPromise, osSubPromise]);

            // Add GoatAPI tracks first (preferred direct sources)
            for (const t of goatTracks) {
                if (!allTracks.some(existing => existing.url === t.url)) {
                    allTracks.push(t);
                }
            }

            // Append OpenSubtitles tracks
            for (const t of osTracks) {
                if (!allTracks.some(existing => existing.url === t.url)) {
                    allTracks.push(t);
                }
            }

            // Rename labels to languageName only, with duplicate numbering
            const finalLangsCount: Record<string, number> = {};
            const finalTracks = allTracks.map(t => {
                const baseLabel = t.label;
                finalLangsCount[t.lang] = (finalLangsCount[t.lang] || 0) + 1;
                const count = finalLangsCount[t.lang];
                return {
                    ...t,
                    label: count > 1 ? `${baseLabel} ${count}` : baseLabel
                };
            });

            console.log(`[SubtitleService] Loaded total of ${finalTracks.length} tracks (GoatAPI: ${goatTracks.length}, OpenSubtitles: ${osTracks.length})`);
            return finalTracks;
        } catch (err) {
            console.error('[SubtitleService] Error:', err);
            return [];
        }
    },
};
