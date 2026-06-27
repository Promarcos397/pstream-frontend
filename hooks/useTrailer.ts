import { useState, useEffect } from 'react';
import { searchTrailerWithMeta, PREMIUM_OVERRIDES } from '../services/YouTubeService';
import { getMovieVideos } from '../services/api';
import { Movie } from '../types';

// Global in-memory cache to store trailer search results (zero latency on repeat hovers)
const trailerCache: Record<string, { videoId: string; isTeaser: boolean; isDirect: boolean }> = {};

/** Preloads and caches the best trailer video ID for a movie in memory. */
export const preloadTrailer = async (movie: Movie | null): Promise<{ videoId: string; isTeaser: boolean; isDirect: boolean } | null> => {
    if (!movie) return null;
    const cacheKey = String(movie.id);

    // 1. Check Global Cache First
    if (trailerCache[cacheKey]) {
        return trailerCache[cacheKey];
    }

    // 1.5. Check Premium Overrides First (e.g. Cloudinary direct link)
    const overrideKey = movie.id ? `tmdb-${movie.id}` : null;
    if (overrideKey && PREMIUM_OVERRIDES[overrideKey]) {
        console.log(`[useTrailer] 💎 Direct Premium Override found for TMDB ID: ${movie.id}`);
        const data = {
            videoId: PREMIUM_OVERRIDES[overrideKey],
            isTeaser: false,
            isDirect: true
        };
        trailerCache[cacheKey] = data;
        return data;
    }

    const type = movie.media_type || (movie.title ? 'movie' : 'tv');

    // 2. Cooperative Pre-check: Fetch TMDB official videos
    try {
        const tmdbVideos = await getMovieVideos(movie.id, type as 'movie' | 'tv');
        if (tmdbVideos && tmdbVideos.results && tmdbVideos.results.length > 0) {
            // Find official YouTube trailers/teasers
            const youtubeVideos = tmdbVideos.results.filter(
                (v: any) => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser')
            );
            
            // Priority selector: Official Trailer > Trailer > Official Teaser > Teaser
            const bestVideo = youtubeVideos.find((v: any) => v.official && v.type === 'Trailer') ||
                              youtubeVideos.find((v: any) => v.type === 'Trailer') ||
                              youtubeVideos.find((v: any) => v.official && v.type === 'Teaser') ||
                              youtubeVideos.find((v: any) => v.type === 'Teaser');

            if (bestVideo && bestVideo.key) {
                const data = {
                    videoId: bestVideo.key,
                    isTeaser: bestVideo.type === 'Teaser',
                    isDirect: false
                };
                trailerCache[cacheKey] = data;
                return data;
            }
        }
    } catch (err) {
        console.warn(`[Trailer] Failed to fetch TMDB videos for ${movie.id}:`, err);
    }

    // 3. Fallback: Search YouTube Query
    const title = movie.original_title || movie.original_name || movie.title || movie.name || '';
    const year = (movie.release_date || movie.first_air_date || '').slice(0, 4);
    
    // Anime Detection: Heuristic (Animation Genre + Japanese Language)
    const isAnimation = movie.genre_ids?.includes(16) || movie.genres?.some(g => g.id === 16);
    const isAnime = isAnimation && movie.original_language === 'ja';

    if (!title) {
        return null;
    }

    try {
        const result = await searchTrailerWithMeta({ title, year, type: type as 'movie' | 'tv', isAnime, tmdbId: String(movie.id) });
        if (result) {
            const data = {
                videoId: result.videoId,
                isTeaser: result.isTeaser,
                isDirect: result.isDirect || false
            };
            trailerCache[cacheKey] = data;
            return data;
        }
    } catch (e) {
        console.error(`[Trailer] Fallback YouTube search failed for ${title}:`, e);
    }

    return null;
};

/** Fetches and caches the best trailer for a movie, with teaser detection. */
export const useTrailer = (movie: Movie | null) => {
    // Read synchronously from cache on mount — no async round-trip on repeat hovers
    const _cached = movie ? trailerCache[String(movie.id)] : undefined;

    const [videoId, setVideoId] = useState<string | null>(_cached?.videoId ?? null);
    const [isTeaser, setIsTeaser] = useState(_cached?.isTeaser ?? false);
    const [isDirect, setIsDirect] = useState(_cached?.isDirect ?? false);
    const [isLoading, setIsLoading] = useState(!_cached && !!movie);

    useEffect(() => {
        if (!movie) {
            setVideoId(null);
            setIsTeaser(false);
            setIsDirect(false);
            setIsLoading(false);
            return;
        }

        const key = String(movie.id);
        const hit = trailerCache[key];
        if (hit) {
            setVideoId(hit.videoId);
            setIsTeaser(hit.isTeaser);
            setIsDirect(hit.isDirect);
            setIsLoading(false);
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


