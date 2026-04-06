const BACKEND_URL = import.meta.env.VITE_GIGA_BACKEND_URL || 'http://localhost:7860';

export interface SkipSegment {
    startTime: number;
    endTime: number;
    type: 'intro' | 'outro' | 'recap';
}

export const SkipService = {
    getSkipSegments: async (tmdbId: string, season?: number, episode?: number): Promise<SkipSegment[]> => {
        try {
            const url = `${BACKEND_URL}/api/introdb/media?tmdb_id=${tmdbId}${season ? `&season=${season}` : ''}${episode ? `&episode=${episode}` : ''}`;
            const response = await fetch(url);
            if (!response.ok) return [];
            const data = await response.json();

            if (!data?.duration || !data?.segments) return [];

            return data.segments.map((seg: any) => ({
                startTime: seg.start,
                endTime: seg.end,
                type: seg.type || 'intro'
            }));
        } catch (e) {
            console.error('[SkipService] Error fetching skip segments:', e);
            return [];
        }
    }
};
