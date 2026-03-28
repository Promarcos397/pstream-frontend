import { getExternalIds } from './api';

export interface SubtitleTrack {
    url: string;
    lang: string;
    label: string;
}

// Helper for language codes (can be expanded)
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

export const SubtitleService = {
    getOpenSubtitles: async (tmdbId: string, season?: number, episode?: number): Promise<SubtitleTrack[]> => {
        try {
            if (!tmdbId) return [];

            const cleanId = tmdbId.replace('tt', '');

            // Note: The legacy OpenSubtitles REST API requires IMDB IDs to ensure perfect episode matching
            const extIds = await getExternalIds(cleanId, season ? 'tv' : 'movie');
            if (!extIds?.imdb_id) {
                console.warn('[SubtitleService] Missing IMDB ID for legacy OpenSubtitles search.');
                return [];
            }

            const imdbId = extIds.imdb_id.replace('tt', '');

            // Use the unrestricted legacy API endpoint
            let url = `https://rest.opensubtitles.org/search/`;
            if (season && episode) {
                url += `episode-${episode}/imdbid-${imdbId}/season-${season}`;
            } else {
                url += `imdbid-${imdbId}`;
            }

            console.log(`[SubtitleService] Fetching from unrestricted legacy OpenSubtitles API for IMDB ${imdbId}...`);

            const headers = { "X-User-Agent": "VLSub 0.10.2" };
            let data: any = null;

            const response = await fetch(url, { headers });
            if (!response.ok) {
                console.warn(`[SubtitleService] Legacy OpenSubtitles API returned ${response.status}`);
                return [];
            }
            data = await response.json();


            const captions: SubtitleTrack[] = [];

            if (Array.isArray(data)) {
                for (const caption of data) {
                    // Reformat the gz format link into a direct text download (this bypasses limits entirely)
                    let downloadUrl = caption.SubDownloadLink;
                    if (downloadUrl) {
                        downloadUrl = downloadUrl.replace(".gz", "").replace("download/", "download/subencoding-utf8/");

                        const language = labelToLanguageCode(caption.LanguageName) || "en";
                        captions.push({
                            url: downloadUrl,
                            label: caption.LanguageName || 'Unknown',
                            lang: language
                        });
                    }
                }
            }

            // Simple deduplication per language (keeps the most seeded match as OpenSubtitles sorts them)
            const uniqueCaptions = captions.reduce((acc, current) => {
                const x = acc.find(item => item.lang === current.lang);
                if (!x) {
                    return acc.concat([current]);
                } else {
                    return acc;
                }
            }, [] as SubtitleTrack[]);

            console.log(`[SubtitleService] Successfully fetched ${uniqueCaptions.length} unlimited subtitles.`);
            return uniqueCaptions;
        } catch (error) {
            console.error("[SubtitleService] Error fetching from legacy OpenSubtitles:", error);
            return [];
        }
    }
};
