import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import VideoPlayer from '../components/VideoPlayer';
import { getMovieDetails } from '../services/api';
import { useTitle } from '../context/TitleContext';
import { useGlobalContext } from '../context/GlobalContext';
import { Movie } from '../types';

const CinemaPage: React.FC = () => {
    const { type, id } = useParams<{ type: string; id: string }>();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { setPageTitle } = useTitle();
    // Read episode progress from context (covers both local cache + cloud sync)
    const { getLastWatchedEpisode, getVideoState } = useGlobalContext();

    const [movie, setMovie] = useState<Movie | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // --- Determine starting season + episode ---
    // Priority: URL params > GlobalContext saved progress > default S1E1
    const urlSeason = searchParams.get('season') || searchParams.get('s');
    const urlEpisode = searchParams.get('episode') || searchParams.get('e');
    // URL seek time (in seconds) — used for movie resume
    const urlTime = searchParams.get('t');

    let season = 1, episode = 1;

    if (urlSeason && urlEpisode) {
        // Explicit URL params (e.g. shared link or from Continue Watching card)
        season = parseInt(urlSeason, 10) || 1;
        episode = parseInt(urlEpisode, 10) || 1;
    } else if (type === 'tv' && id) {
        // Read the last-watched episode from GlobalContext (set by updateEpisodeProgress)
        const saved = getLastWatchedEpisode(id);
        if (saved) {
            season = saved.season || 1;
            episode = saved.episode || 1;
        }
    }

    // --- Resume time for movies ---
    // If a ?t= URL param is given, use that; otherwise read from GlobalContext videoStates
    const resumeTime = urlTime
        ? parseFloat(urlTime)
        : (type === 'movie' && id ? (getVideoState(parseInt(id, 10))?.time || 0) : 0);

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
                    setPageTitle(`${showTitle} S${season}E${episode}`);
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
                    imdb_id: details.external_ids?.imdb_id || details.imdb_id,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id, type]);

    const handleClose = () => navigate(-1);

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
                        className="mt-4 block mx-auto px-6 py-2 bg-red-600 rounded hover:bg-red-700 transition text-white font-bold"
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
            resumeTime={resumeTime}
            onClose={handleClose}
        />
    );
};

export default CinemaPage;
