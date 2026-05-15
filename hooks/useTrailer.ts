import { useState, useEffect } from 'react';
import { searchTrailerWithMeta } from '../services/YouTubeService';
import { useGlobalContext } from '../context/GlobalContext';
import { Movie } from '../types';

/** Fetches and caches the best trailer for a movie, with teaser detection. */
export const useTrailer = (movie: Movie | null) => {
    const { getVideoState, updateVideoState } = useGlobalContext();
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

        // 1. Check Global Cache First (Zero Latency)
        const cachedState = getVideoState(movie.id);
        if (cachedState?.videoId) {
            setVideoId(cachedState.videoId);
            setIsDirect(cachedState.videoId.startsWith('http'));
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
                    setVideoId(result.videoId);
                    setIsTeaser(result.isTeaser);
                    setIsDirect(result.isDirect || false);
                    // Proactively cache it so other components are aware instantly
                    updateVideoState(movie.id, 0, result.videoId);
                }
            })
            .finally(() => {
                if (mounted) setIsLoading(false);
            });

        return () => { mounted = false; };
    }, [movie, getVideoState, updateVideoState]);

    return { videoId, isTeaser, isDirect, isLoading };
};
