import { getExternalIds } from './api';
import { LANG_LABELS, LANG_TO_OS } from '../constants';

export interface SubtitleTrack {
    url: string;
    lang: string;
    label: string;
    duration?: number;
}



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
                let label = LANG_LABELS[lang] || sub.LanguageName || lang.toUpperCase();

                langCounts[lang] = (langCounts[lang] || 0) + 1;
                
                let releaseName = sub.MovieReleaseName || sub.SubFileName || '';
                if (releaseName) {
                    releaseName = releaseName.replace(/\.(srt|vtt|ass|ssa)$/i, '');
                    if (releaseName.length > 40) releaseName = releaseName.substring(0, 40) + '...';
                    label = `${label} - ${releaseName}`;
                } else if (langCounts[lang] > 1) {
                    label = `${label} (${langCounts[lang]})`;
                }

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

            const targetImdbId = imdbId || (await (async () => {
                if (tmdbId) {
                    const cleanId = tmdbId.replace('tt', '');
                    const extIds = await getExternalIds(cleanId, type);
                    return extIds?.imdb_id;
                }
                return undefined;
            })());

            if (targetImdbId) {
                const cleanImdbId = targetImdbId.replace('tt', '');

                // 3. Build lang list: browser lang + English + Spanish (widest coverage)
                const browserLang = preferredLang || getBrowserLangCode();
                const priorityLangs = Array.from(new Set([browserLang, 'en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh', 'ar', 'tr', 'nl', 'pl']));

                console.log(`[SubtitleService] Fetching OpenSubtitles for langs: ${priorityLangs.slice(0, 6).join(', ')}...`);

                const osTracks = await SubtitleService.getOpenSubtitlesTracks(
                    cleanImdbId, type, season, episode, priorityLangs
                );

                if (osTracks.length > 0) {
                    console.log(`[SubtitleService] ✅ ${osTracks.length} tracks from OpenSubtitles`);
                    for (const sub of osTracks) {
                        if (!allTracks.some(t => t.url === sub.url)) {
                            allTracks.push(sub);
                        }
                    }
                }
            } else {
                console.warn('[SubtitleService] No IMDB ID for OpenSubtitles fallback.');
            }

            return allTracks;
        } catch (err) {
            console.error('[SubtitleService] Error:', err);
            return [];
        }
    },
};
