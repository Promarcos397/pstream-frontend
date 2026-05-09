import { useState, useEffect } from 'react';
import { searchTrailerWithMeta } from '../services/YouTubeService';
import { useGlobalContext } from '../context/GlobalContext';
import { Movie } from '../types';

/** Fetches and caches the best trailer for a movie, with teaser detection. */
export const useTrailer = (movie: Movie | null) => {
    const { getVideoState, updateVideoState } = useGlobalContext();
    const [videoId, setVideoId] = useState<string | null>(null);
    const [isTeaser, setIsTeaser] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!movie) {
            setVideoId(null);
            setIsTeaser(false);
            return;
        }

        // 1. Check Global Cache First (Zero Latency)
        const cachedState = getVideoState(movie.id);
        if (cachedState?.videoId) {
            setVideoId(cachedState.videoId);
            // isTeaser stays false for cached entries (teaserCache is in-memory only)
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

        searchTrailerWithMeta({ title, year, type: type as 'movie' | 'tv' })
            .then(result => {
                if (mounted && result) {
                    setVideoId(result.videoId);
                    setIsTeaser(result.isTeaser);
                    // Proactively cache it so other components are aware instantly
                    updateVideoState(movie.id, 0, result.videoId);
                }
            })
            .finally(() => {
                if (mounted) setIsLoading(false);
            });

        return () => { mounted = false; };
    }, [movie, getVideoState, updateVideoState]);

    return { videoId, isTeaser, isLoading };
};
