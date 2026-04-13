import { getExternalIds } from './api';

export interface SubtitleTrack {
    url: string;
    lang: string;
    label: string;
}

// Extensive ISO 639-1 lang code → English label map
const LANG_LABELS: Record<string, string> = {
    en: 'English', es: 'Spanish', fr: 'French', de: 'German', it: 'Italian',
    pt: 'Portuguese', ru: 'Russian', ja: 'Japanese', ko: 'Korean', zh: 'Chinese',
    ar: 'Arabic', tr: 'Turkish', nl: 'Dutch', pl: 'Polish', sv: 'Swedish',
    da: 'Danish', fi: 'Finnish', no: 'Norwegian', hu: 'Hungarian', el: 'Greek',
    he: 'Hebrew', cs: 'Czech', ro: 'Romanian', th: 'Thai', vi: 'Vietnamese',
    id: 'Indonesian', uk: 'Ukrainian', hr: 'Croatian', sk: 'Slovak', bg: 'Bulgarian',
    sr: 'Serbian', hi: 'Hindi', bn: 'Bengali', fa: 'Persian', ms: 'Malay',
    ca: 'Catalan', lt: 'Lithuanian', lv: 'Latvian', et: 'Estonian', sl: 'Slovenian',
};

// OpenSubtitles legacy lang IDs
const LANG_TO_OS: Record<string, string> = {
    en: 'eng', es: 'spa', fr: 'fre', de: 'ger', it: 'ita', pt: 'por',
    ru: 'rus', ja: 'jpn', ko: 'kor', zh: 'chi', ar: 'ara', tr: 'tur',
    nl: 'dut', pl: 'pol', sv: 'swe', da: 'dan', fi: 'fin', no: 'nor',
    hu: 'hun', el: 'ell', he: 'heb', cs: 'cze', ro: 'rum', th: 'tha',
    vi: 'vie', id: 'ind', uk: 'ukr', hr: 'hrv', sk: 'slo', bg: 'bul',
    sr: 'srp', hi: 'hin',
};

function labelToLangCode(label: string): string {
    const trimmed = label.trim().split(/[\s(]/)[0].toLowerCase();
    const entry = Object.entries(LANG_LABELS).find(([code, name]) =>
        name.toLowerCase() === trimmed || code === trimmed
    );
    return entry?.[0] || 'en';
}

/** Detect the user's preferred language code from the browser */
function getBrowserLangCode(): string {
    const nav = navigator.language || (navigator as any).userLanguage || 'en';
    // e.g. "it-IT" or "en-US" → "it" or "en"
    return nav.split('-')[0].toLowerCase();
}

const BACKEND_URL = import.meta.env.VITE_GIGA_BACKEND_URL || 'https://ibrahimar397-pstream-giga.hf.space';

export const SubtitleService = {

    getIntroSubtitles: async (
        tmdbId: string,
        type: 'movie' | 'tv',
        season?: number,
        episode?: number
    ): Promise<SubtitleTrack[]> => {
        try {
            const url = `${BACKEND_URL}/api/introdb/subtitles?tmdb_id=${tmdbId}&type=${type}${season ? `&season=${season}` : ''}${episode ? `&episode=${episode}` : ''}`;
            const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
            if (!response.ok) return [];
            const data = await response.json();
            if (!data?.subtitles || !Array.isArray(data.subtitles)) return [];
            return data.subtitles.map((sub: any) => ({
                url: sub.url,
                lang: (sub.lang || sub.language_code || 'en').toLowerCase().split('-')[0],
                label: sub.label || sub.language_name || 'English',
            }));
        } catch {
            return [];
        }
    },

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
            const response = await fetch(url, { headers, signal: AbortSignal.timeout(10000) });
            if (!response.ok) return [];
            const data = await response.json();
            if (!Array.isArray(data)) return [];

            // Sort best downloads first
            const sorted = [...data].sort((a: any, b: any) =>
                (parseInt(b.SubDownloadsCnt) || 0) - (parseInt(a.SubDownloadsCnt) || 0)
            );

            const seenLangs = new Set<string>();
            const tracks: SubtitleTrack[] = [];

            for (const sub of sorted) {
                if (!sub.SubDownloadLink) continue;
                const url = sub.SubDownloadLink
                    .replace('.gz', '')
                    .replace('download/', 'download/subencoding-utf8/');
                const lang = labelToLangCode(sub.LanguageName || '');
                const label = LANG_LABELS[lang] || sub.LanguageName || lang.toUpperCase();

                // Take the best track per language (top download count wins)
                if (!seenLangs.has(lang)) {
                    seenLangs.add(lang);
                    tracks.push({ url, lang, label });
                }
                // Cap at 12 languages total
                if (tracks.length >= 12) break;
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
        preferredLang?: string
    ): Promise<SubtitleTrack[]> => {
        try {
            // 1. Try IntroDB first (fast, high quality)
            const introSubs = await SubtitleService.getIntroSubtitles(tmdbId, type, season, episode);
            if (introSubs.length > 0) {
                console.log(`[SubtitleService] ✅ ${introSubs.length} tracks from IntroDB`);
                return introSubs;
            }

            if (!tmdbId) return [];

            // 2. Get IMDB ID for OpenSubtitles
            const cleanId = tmdbId.replace('tt', '');
            const extIds = await getExternalIds(cleanId, type);
            if (!extIds?.imdb_id) {
                console.warn('[SubtitleService] No IMDB ID for OpenSubtitles fallback.');
                return [];
            }
            const imdbId = extIds.imdb_id.replace('tt', '');

            // 3. Build lang list: browser lang + English + Spanish (widest coverage)
            const browserLang = preferredLang || getBrowserLangCode();
            const priorityLangs = Array.from(new Set([browserLang, 'en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh', 'ar', 'tr', 'nl', 'pl']));

            console.log(`[SubtitleService] Fetching OpenSubtitles for langs: ${priorityLangs.slice(0, 6).join(', ')}...`);

            const tracks = await SubtitleService.getOpenSubtitlesTracks(
                imdbId, type, season, episode, priorityLangs.slice(0, 8)
            );

            console.log(`[SubtitleService] ✅ ${tracks.length} tracks from OpenSubtitles`);
            return tracks;
        } catch (err) {
            console.error('[SubtitleService] Error:', err);
            return [];
        }
    },
};
