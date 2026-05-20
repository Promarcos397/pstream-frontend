import { useState, useEffect } from 'react';
import { searchTrailerWithMeta } from '../services/YouTubeService';
import { Movie } from '../types';

// Global in-memory cache to store trailer search results (zero latency on repeat hovers)
const trailerCache: Record<string, { videoId: string; isTeaser: boolean; isDirect: boolean }> = {};

/** Fetches and caches the best trailer for a movie, with teaser detection. */
export const useTrailer = (movie: Movie | null) => {
    const [videoId, setVideoId] = useState<string | null>(null);
    const [isTeaser, setIsTeaser] = useState(false);
    const [isDirect, setIsDirect] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!movie) {
            setVideoId(null);
            setIsTeaser(false);
            setIsDirect(false);
            return;
        }

        const cacheKey = String(movie.id);

        // 1. Check Global Cache First (Zero Latency)
        if (trailerCache[cacheKey]) {
            const cached = trailerCache[cacheKey];
            setVideoId(cached.videoId);
            setIsTeaser(cached.isTeaser);
            setIsDirect(cached.isDirect);
            return;
        }

        // 2. Fetch if not cached
        let mounted = true;
        setIsLoading(true);

        const title = movie.original_title || movie.original_name || movie.title || movie.name || '';
        const year = (movie.release_date || movie.first_air_date || '').slice(0, 4);
        const type = movie.media_type || (movie.title ? 'movie' : 'tv');
        
        // Anime Detection: Heuristic (Animation Genre + Japanese Language)
        const isAnimation = movie.genre_ids?.includes(16) || movie.genres?.some(g => g.id === 16);
        const isAnime = isAnimation && movie.original_language === 'ja';

        if (!title) {
            setIsLoading(false);
            return;
        }

        searchTrailerWithMeta({ title, year, type: type as 'movie' | 'tv', isAnime, tmdbId: movie.id.toString() })
            .then(result => {
                if (mounted && result) {
                    const data = {
                        videoId: result.videoId,
                        isTeaser: result.isTeaser,
                        isDirect: result.isDirect || false
                    };
                    trailerCache[cacheKey] = data;
                    setVideoId(data.videoId);
                    setIsTeaser(data.isTeaser);
                    setIsDirect(data.isDirect);
                }
            })
            .finally(() => {
                if (mounted) setIsLoading(false);
            });

        return () => { mounted = false; };
    }, [movie]);

    return { videoId, isTeaser, isDirect, isLoading };
};

