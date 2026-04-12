import { getExternalIds } from './api';

export interface SubtitleTrack {
    url: string;
    lang: string;
    label: string;
}

// Helper for language codes
const langMap: Record<string, string> = {
    'English': 'en',
    'Spanish': 'es',
    'French': 'fr',
    'German': 'de',
    'Italian': 'it',
    'Portuguese': 'pt',
    'Russian': 'ru',
    'Japanese': 'ja',
    'Korean': 'ko',
    'Chinese': 'zh',
    'Arabic': 'ar',
    'Turkish': 'tr',
    'Dutch': 'nl',
    'Polish': 'pl',
    'Swedish': 'sv',
    'Danish': 'da',
    'Finnish': 'fi',
    'Norwegian': 'no',
    'Hungarian': 'hu',
    'Greek': 'el',
    'Hebrew': 'he',
    'Czech': 'cs',
    'Romanian': 'ro',
    'Thai': 'th',
    'Vietnamese': 'vi',
    'Indonesian': 'id'
};

function labelToLanguageCode(label: string): string {
    const normalized = label.split(' ')[0];
    return langMap[normalized] || 'en';
}

const BACKEND_URL = import.meta.env.VITE_GIGA_BACKEND_URL || 'https://ibrahimar397-pstream-giga.hf.space';

export const SubtitleService = {
    getIntroSubtitles: async (tmdbId: string, type: 'movie' | 'tv', season?: number, episode?: number): Promise<SubtitleTrack[]> => {
        try {
            const url = `${BACKEND_URL}/api/introdb/subtitles?tmdb_id=${tmdbId}&type=${type}${season ? `&season=${season}` : ''}${episode ? `&episode=${episode}` : ''}`;
            const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
            if (!response.ok) return [];
            const data = await response.json();
            
            if (!data?.subtitles || !Array.isArray(data.subtitles)) return [];

            return data.subtitles.map((sub: any) => ({
                url: sub.url,
                lang: sub.lang || sub.language_code || 'en',
                label: sub.label || sub.language_name || 'English'
            }));
        } catch (e) {
            return [];
        }
    },

    getSubtitleTracks: async (tmdbId: string, type: 'movie' | 'tv', season?: number, episode?: number): Promise<SubtitleTrack[]> => {
        try {
            // First try IntroDB (P-Stream Standard)
            const introSubs = await SubtitleService.getIntroSubtitles(tmdbId, type, season, episode);
            if (introSubs.length > 0) {
                console.log(`[SubtitleService] Found ${introSubs.length} subs on IntroDB.`);
                return introSubs;
            }

            if (!tmdbId) return [];

            const cleanId = tmdbId.replace('tt', '');

            // Fallback to OpenSubtitles (Legacy)
            const extIds = await getExternalIds(cleanId, type);
            if (!extIds?.imdb_id) {
                console.warn('[SubtitleService] Missing IMDB ID for legacy OpenSubtitles search.');
                return [];
            }

            const imdbId = extIds.imdb_id.replace('tt', '');

            let url = `https://rest.opensubtitles.org/search/`;
            // Search English-only to avoid non-English results dominating
            if (type === 'tv' && season && episode) {
                url += `episode-${episode}/imdbid-${imdbId}/season-${season}/sublanguageid-eng`;
            } else {
                url += `imdbid-${imdbId}/sublanguageid-eng`;
            }

            console.log(`[SubtitleService] Fetching from legacy OpenSubtitles for IMDB ${imdbId}...`);

            const headers = { "X-User-Agent": "VLSub 0.10.2" };
            const response = await fetch(url, { headers, signal: AbortSignal.timeout(10000) });
            if (!response.ok) return [];
            
            const data = await response.json();
            const captions: SubtitleTrack[] = [];

            if (Array.isArray(data)) {
                // Sort by download count (best subtitles first)
                const sorted = [...data].sort((a: any, b: any) => 
                    (parseInt(b.SubDownloadsCnt) || 0) - (parseInt(a.SubDownloadsCnt) || 0)
                );

                for (const caption of sorted) {
                    let downloadUrl = caption.SubDownloadLink;
                    if (downloadUrl) {
                        downloadUrl = downloadUrl.replace(".gz", "").replace("download/", "download/subencoding-utf8/");
                        const language = labelToLanguageCode(caption.LanguageName) || "en";
                        // Skip non-English subs unless there's nothing else
                        if (language !== 'en' && captions.length > 0) continue;
                        captions.push({
                            url: downloadUrl,
                            label: caption.LanguageName || 'English',
                            lang: language
                        });
                        // Take the best 2 English tracks (SDH + regular)
                        if (captions.length >= 2) break;
                    }
                }
            }

            return captions;
        } catch (error) {
            console.error("[SubtitleService] Error fetching subtitles:", error);
            return [];
        }
    }
};
