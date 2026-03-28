import { useState, useEffect } from 'react';
import { Movie } from '../types';
import { getMovieDetails, getMovieCredits, getRecommendations, getMovieImages } from '../services/api';

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
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!movie) {
            setDetailedMovie(null);
            setCast([]);
            setRecommendations([]);
            setLogoUrl(null);
            return;
        }

        setIsLoading(true);

        const mediaType = (movie.media_type || (movie.title ? 'movie' : 'tv')) as 'movie' | 'tv';

        const fetchData = async () => {
            try {
                // Parallel fetch for speed
                const [details, credits, recs, images] = await Promise.all([
                    getMovieDetails(movie.id, mediaType),
                    getMovieCredits(movie.id, mediaType),
                    getRecommendations(movie.id, mediaType),
                    getMovieImages(movie.id, mediaType)
                ]);

                if (details) setDetailedMovie(details);

                if (credits && credits.length > 0) {
                    setCast(credits.slice(0, 5).map((c: any) => c.name));
                } else {
                    setCast([]);
                }

                if (recs) {
                    setRecommendations(recs.slice(0, 12));
                } else {
                    setRecommendations([]);
                }

                if (images && images.logos) {
                    const logo = images.logos.find((l: any) => l.iso_639_1 === 'en' || l.iso_639_1 === null);
                    if (logo) {
                        setLogoUrl(`https://image.tmdb.org/t/p/w500${logo.file_path}`);
                    } else {
                        setLogoUrl(null);
                    }
                } else {
                    setLogoUrl(null);
                }

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
