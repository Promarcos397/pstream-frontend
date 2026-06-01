import { useState, useEffect } from 'react';

export interface SkipSegment {
    type: 'intro' | 'recap' | 'credits' | 'preview';
    start: number; // seconds
    end: number;   // seconds
}

// Confirmed endpoint: GET https://api.introdb.app/segments?imdb_id=tt0903747&season=1&episode=1
// Response: [{ segment_type: "intro"|"recap"|"credits"|"preview", start_sec: number, end_sec: number }, ...]
// No API key required for reads.

export function useSkipTimestamps(
    imdbId: string | undefined,
    mediaType: 'movie' | 'tv',
    season?: number,
    episode?: number
): { segments: SkipSegment[]; isLoading: boolean } {
    const [segments, setSegments] = useState<SkipSegment[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        // Skip timestamps are only meaningful for TV show episodes
        if (mediaType !== 'tv' || !imdbId || season == null || episode == null) {
            setSegments([]);
            setIsLoading(false);
            return;
        }

        let isMounted = true;
        const cacheKey = `tidb:${imdbId}:${season}:${episode}`;

        const fetchTimestamps = async () => {
            setIsLoading(true);
            setSegments([]);

            // Try session cache first to avoid redundant network calls
            try {
                const cached = sessionStorage.getItem(cacheKey);
                if (cached) {
                    const parsed = JSON.parse(cached) as SkipSegment[];
                    if (isMounted) {
                        setSegments(parsed);
                        setIsLoading(false);
                    }
                    return;
                }
            } catch {
                // ignore cache read errors
            }

            try {
                const url = `https://api.introdb.app/segments?imdb_id=${imdbId}&season=${season}&episode=${episode}`;
                const res = await fetch(url, { signal: AbortSignal.timeout(6000) });

                if (!res.ok) throw new Error(`introdb ${res.status}`);

                const json = await res.json();

                // Normalise: the API returns an array directly
                const items: any[] = Array.isArray(json) ? json : (json.data ?? []);

                const newSegments: SkipSegment[] = items
                    .filter(item => item.start_sec != null && item.end_sec != null)
                    .map(item => ({
                        type: (item.segment_type ?? 'intro') as SkipSegment['type'],
                        start: parseFloat(item.start_sec),
                        end: parseFloat(item.end_sec),
                    }));

                if (isMounted) {
                    setSegments(newSegments);
                    try {
                        sessionStorage.setItem(cacheKey, JSON.stringify(newSegments));
                    } catch {
                        // ignore cache write errors
                    }
                }
            } catch (err) {
                // Non-fatal — skip buttons simply won't appear
                console.warn('[useSkipTimestamps] Failed to fetch skip segments:', err);
                if (isMounted) setSegments([]);
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        fetchTimestamps();

        return () => {
            isMounted = false;
        };
    }, [imdbId, mediaType, season, episode]);

    return { segments, isLoading };
}
