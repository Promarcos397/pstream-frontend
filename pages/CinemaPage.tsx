import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import VideoPlayer from '../components/VideoPlayer';
import { getMovieDetails } from '../services/api';
import { useTitle } from '../context/TitleContext';
import { Movie } from '../types';

const CinemaPage: React.FC = () => {
    const { type, id } = useParams<{ type: string; id: string }>();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { setPageTitle } = useTitle();

    const [movie, setMovie] = useState<Movie | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Get season and episode from URL params, fallback to localStorage
    const urlSeason = searchParams.get('season') || searchParams.get('s');
    const urlEpisode = searchParams.get('episode') || searchParams.get('e');

    // If URL has params, use them; otherwise try localStorage for TV shows
    let season = 1, episode = 1;
    if (urlSeason && urlEpisode) {
        season = parseInt(urlSeason, 10);
        episode = parseInt(urlEpisode, 10);
    } else if (type === 'tv' && id) {
        // Fallback to localStorage resume context
        try {
            const saved = localStorage.getItem(`pstream-last-watched-${id}`);
            if (saved) {
                const parsed = JSON.parse(saved);
                season = parsed.season || 1;
                episode = parsed.episode || 1;
            }
        } catch (e) {
            console.warn('Failed to load resume context from localStorage');
        }
    }

    useEffect(() => {
        const fetchDetails = async () => {
            if (!id || !type) {
                setError('Invalid media ID');
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                const mediaType = type as 'movie' | 'tv';
                const details = await getMovieDetails(parseInt(id, 10), mediaType);

                if (!details) {
                    setError('Content not found');
                    setLoading(false);
                    return;
                }

                if (type === 'movie') {
                    setPageTitle(details.title || 'Movie');
                } else {
                    const showTitle = details.name || details.title || 'TV Show';
                    setPageTitle(`${showTitle} S${season} E${episode}`);
                }

                setMovie({
                    id: details.id,
                    title: details.title || details.name,
                    name: details.name || details.title,
                    overview: details.overview,
                    poster_path: details.poster_path,
                    backdrop_path: details.backdrop_path,
                    vote_average: details.vote_average,
                    release_date: details.release_date || details.first_air_date,
                    first_air_date: details.first_air_date,
                    media_type: type,
                    number_of_seasons: details.number_of_seasons,
                });
                setError(null);
            } catch (err) {
                console.error('Failed to fetch details:', err);
                setError('Failed to load content');
            } finally {
                setLoading(false);
            }
        };

        fetchDetails();
    }, [id, type, season, episode, setPageTitle]);

    const handleClose = () => {
        navigate(-1); // Go back
    };

    if (loading) {
        return (
            <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
                    <span className="text-gray-400 text-sm">Loading...</span>
                </div>
            </div>
        );
    }

    if (error || !movie) {
        return (
            <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center">
                <div className="text-center">
                    <span className="text-red-500 text-lg">{error || 'Content not found'}</span>
                    <button
                        onClick={handleClose}
                        className="mt-4 block mx-auto px-6 py-2 bg-red-600 rounded hover:bg-red-700 transition"
                    >
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

    return (
        <VideoPlayer
            movie={movie}
            season={type === 'tv' ? season : undefined}
            episode={type === 'tv' ? episode : undefined}
            onClose={handleClose}
        />
    );
};

export default CinemaPage;
