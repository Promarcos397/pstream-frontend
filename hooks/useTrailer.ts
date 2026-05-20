import { useState, useEffect } from 'react';
import { searchTrailerWithMeta } from '../services/YouTubeService';
import { Movie } from '../types';

// Global in-memory cache to store trailer search results (zero latency on repeat hovers)
const trailerCache: Record<string, { videoId: string; isTeaser: boolean; isDirect: boolean }> = {};

/** Preloads and caches the best trailer video ID for a movie in memory. */
export const preloadTrailer = (movie: Movie | null): Promise<{ videoId: string; isTeaser: boolean; isDirect: boolean } | null> => {
    if (!movie) return Promise.resolve(null);
    const cacheKey = String(movie.id);

    // 1. Check Global Cache First
    if (trailerCache[cacheKey]) {
        return Promise.resolve(trailerCache[cacheKey]);
    }

    const title = movie.original_title || movie.original_name || movie.title || movie.name || '';
    const year = (movie.release_date || movie.first_air_date || '').slice(0, 4);
    const type = movie.media_type || (movie.title ? 'movie' : 'tv');
    
    // Anime Detection: Heuristic (Animation Genre + Japanese Language)
    const isAnimation = movie.genre_ids?.includes(16) || movie.genres?.some(g => g.id === 16);
    const isAnime = isAnimation && movie.original_language === 'ja';

    if (!title) {
        return Promise.resolve(null);
    }

    return searchTrailerWithMeta({ title, year, type: type as 'movie' | 'tv', isAnime, tmdbId: movie.id.toString() })
        .then(result => {
            if (result) {
                const data = {
                    videoId: result.videoId,
                    isTeaser: result.isTeaser,
                    isDirect: result.isDirect || false
                };
                trailerCache[cacheKey] = data;
                return data;
            }
            return null;
        })
        .catch(() => null);
};

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

        let mounted = true;
        setIsLoading(true);

        preloadTrailer(movie)
            .then(result => {
                if (mounted && result) {
                    setVideoId(result.videoId);
                    setIsTeaser(result.isTeaser);
                    setIsDirect(result.isDirect);
                }
            })
            .finally(() => {
                if (mounted) setIsLoading(false);
            });

        return () => { mounted = false; };
    }, [movie]);

    return { videoId, isTeaser, isDirect, isLoading };
};


