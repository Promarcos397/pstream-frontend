import { useState, useEffect } from 'react';
import { searchTrailersWithFallback } from '../services/YouTubeService';
import { useGlobalContext } from '../context/GlobalContext';
import { Movie } from '../types';

/**
 * useTrailer
 * ──────────
 * A unified headless hook to fetch, cache, and provide YouTube Trailer IDs.
 * It strictly prefers the GlobalContext cache to ensure zero-latency loading 
 * when switching between UI components.
 */
export const useTrailer = (movie: Movie | null) => {
    const { getVideoState, updateVideoState } = useGlobalContext();
    const [videoId, setVideoId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!movie) {
            setVideoId(null);
            return;
        }

        // 1. Check Global Cache First (Zero Latency)
        const cachedState = getVideoState(movie.id);
        if (cachedState?.videoId) {
            setVideoId(cachedState.videoId);
            return;
        }

        // 2. Fetch if not cached
        let mounted = true;
        setIsLoading(true);

        const title = movie.original_title || movie.original_name || movie.title || movie.name || '';
        const year = (movie.release_date || movie.first_air_date || '').slice(0, 4);
        const type = movie.media_type || (movie.title ? 'movie' : 'tv');

        if (!title) {
            setIsLoading(false);
            return;
        }

        searchTrailersWithFallback({ title, year, type: type as 'movie' | 'tv' }, 1)
            .then(results => {
                if (mounted && results.length > 0) {
                    const foundId = results[0];
                    setVideoId(foundId);
                    // Proactively cache it so other components are aware instantly
                    updateVideoState(movie.id, 0, foundId);
                }
            })
            .finally(() => {
                if (mounted) setIsLoading(false);
            });

        return () => { mounted = false; };
    }, [movie, getVideoState, updateVideoState]);

    return { videoId, isLoading };
};
