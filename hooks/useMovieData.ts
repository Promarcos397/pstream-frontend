import { useState, useEffect } from 'react';
import { Movie } from '../types';
import { getMovieDetails, getMovieCredits, getRecommendations, getMovieImages } from '../services/api';

interface CachedMovieData {
    detailedMovie: Movie;
    cast: string[];
    recommendations: Movie[];
    logoUrl: string | null;
}
const _movieDataCache = new Map<string, CachedMovieData>();

interface UseMovieDataReturn {
    detailedMovie: Movie | null;
    cast: string[];
    recommendations: Movie[];
    logoUrl: string | null;
    isLoading: boolean;
}

export const useMovieData = (movie: Movie | null): UseMovieDataReturn => {
    const [detailedMovie, setDetailedMovie] = useState<Movie | null>(null);
    const [cast, setCast] = useState<string[]>([]);
    const [recommendations, setRecommendations] = useState<Movie[]>([]);
    const [logoUrl, setLogoUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(!!movie);

    useEffect(() => {
        if (!movie) {
            setDetailedMovie(null);
            setCast([]);
            setRecommendations([]);
            setLogoUrl(null);
            return;
        }

        const mediaType = (movie.media_type || (movie.title ? 'movie' : 'tv')) as 'movie' | 'tv';
        const cacheKey = `${movie.id}-${mediaType}`;

        const cached = _movieDataCache.get(cacheKey);
        if (cached) {
            setDetailedMovie(cached.detailedMovie);
            setCast(cached.cast);
            setRecommendations(cached.recommendations);
            setLogoUrl(cached.logoUrl);
            setIsLoading(false);
            return;
        }

        // Clear previous state to prevent ghosting when switching movies
        setDetailedMovie(null);
        setCast([]);
        setRecommendations([]);
        setLogoUrl(null);
        setIsLoading(true);

        const fetchData = async () => {
            try {
                // Parallel fetch for speed
                const [details, credits, recs, images] = await Promise.all([
                    getMovieDetails(movie.id, mediaType),
                    getMovieCredits(movie.id, mediaType),
                    getRecommendations(movie.id, mediaType),
                    getMovieImages(movie.id, mediaType)
                ]);

                const castList = credits?.length > 0 ? credits.slice(0, 5).map((c: any) => c.name) : [];
                const recsList = recs ? recs.slice(0, 12) : [];
                const logo = images?.logos?.find((l: any) => l.iso_639_1 === 'en' || l.iso_639_1 === null);
                const logoUrl = logo ? `https://image.tmdb.org/t/p/w500${logo.file_path}` : null;

                if (details) {
                    _movieDataCache.set(cacheKey, { detailedMovie: details, cast: castList, recommendations: recsList, logoUrl });
                    setDetailedMovie(details);
                }
                setCast(castList);
                setRecommendations(recsList);
                setLogoUrl(logoUrl);

            } catch (error) {
                console.error("Error fetching movie data:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();

    }, [movie]);

    return { detailedMovie, cast, recommendations, logoUrl, isLoading };
};
