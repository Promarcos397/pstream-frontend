export interface GoatAPIStream {
    source: string;
    type: 'hls' | 'mp4' | string;
    url: string;
    quality: string;
    referer?: string;
    language?: string;
}

export interface GoatAPISubtitle {
    provider?: string;
    display?: string;
    language: string;
    format: string;
    url: string;
    isHearingImpaired?: boolean;
}

const BASE_URL = 'https://goatapi.imreallydagoatt.workers.dev';

export const GoatAPIService = {
    /**
     * Fetch direct stream links (Lightning API) for a movie or TV show episode.
     * Fetches directly from the browser (no proxy).
     */
    fetchDirectStreams: async (
        tmdbId: string,
        mediaType: 'movie' | 'tv',
        season?: number,
        episode?: number
    ): Promise<GoatAPIStream[]> => {
        const cleanId = tmdbId.replace('tt', '');
        const url = mediaType === 'movie'
            ? `${BASE_URL}/api/lightning/movie/${cleanId}`
            : `${BASE_URL}/api/lightning/tv/${cleanId}/${season}/${episode}`;

        try {
            console.log(`[GoatAPIService] Fetching streams from: ${url}`);
            const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
            if (!res.ok) {
                console.warn(`[GoatAPIService] Streams API returned status ${res.status}`);
                return [];
            }
            const data = await res.json();
            if (data?.success && Array.isArray(data.streams)) {
                return data.streams;
            }
            return [];
        } catch (e) {
            console.warn(`[GoatAPIService] Stream fetch failed:`, e);
            return [];
        }
    },

    /**
     * Fetch subtitle tracks for a movie or TV show episode.
     * Fetches directly from the browser (no proxy).
     */
    fetchSubtitles: async (
        tmdbId: string,
        mediaType: 'movie' | 'tv',
        season?: number,
        episode?: number
    ): Promise<GoatAPISubtitle[]> => {
        const cleanId = tmdbId.replace('tt', '');
        const url = mediaType === 'movie'
            ? `${BASE_URL}/api/subtitles/movie/${cleanId}`
            : `${BASE_URL}/api/subtitles/tv/${cleanId}/${season}/${episode}`;

        try {
            console.log(`[GoatAPIService] Fetching subtitles from: ${url}`);
            const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
            if (!res.ok) {
                console.warn(`[GoatAPIService] Subtitles API returned status ${res.status}`);
                return [];
            }
            const data = await res.json();
            if (Array.isArray(data)) {
                return data;
            } else if (data && typeof data === 'object') {
                return data.subtitles || data.data || [];
            }
            return [];
        } catch (e) {
            console.warn(`[GoatAPIService] Subtitles fetch failed:`, e);
            return [];
        }
    }
};
