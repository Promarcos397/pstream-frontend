import { useState, useEffect } from 'react';
import { Movie } from '../types';
import { getReleaseDates } from '../services/api';

// If a movie's release date was more than PLAYABLE_AFTER_DAYS ago,
// we consider it playable regardless of what TMDB says about digital availability.
// This prevents old movies (1978, 2015, etc.) from being incorrectly flagged as
// "theater-only" just because TMDB lacks release date data for that region.
const PLAYABLE_AFTER_DAYS = 28; // 4 weeks

export const useIsInTheaters = (movie: Movie | null) => {
    const [isInTheaters, setIsInTheaters] = useState(false);

    useEffect(() => {
        if (!movie) return;

        const checkRelease = async () => {
            try {
                const mediaType = (movie.media_type || (movie.title ? 'movie' : 'tv')) as 'movie' | 'tv';

                // TV shows are never "in theaters"
                if (mediaType === 'tv') {
                    setIsInTheaters(false);
                    return;
                }

                // Age override: if release_date exists and is older than PLAYABLE_AFTER_DAYS,
                // it's definitely available online — skip TMDB release-type lookup entirely.
                if (movie.release_date) {
                    const releaseDate = new Date(movie.release_date);
                    const ageMs = Date.now() - releaseDate.getTime();
                    const ageDays = ageMs / (1000 * 60 * 60 * 24);
                    if (ageDays > PLAYABLE_AFTER_DAYS) {
                        setIsInTheaters(false);
                        return;
                    }
                }

                // For very recent releases (< 4 weeks old), check TMDB for digital availability
                const releases = await getReleaseDates(movie.id, 'movie');
                const now = new Date();
                let hasTheater = false;
                let hasDigital = false;

                for (const country of releases) {
                    for (const release of country.release_dates) {
                        const rd = new Date(release.release_date);
                        if (release.type === 3 && rd <= now) hasTheater = true;  // theatrical
                        if (release.type >= 4 && rd <= now) hasDigital = true;  // digital/streaming/physical
                    }
                }

                // Rule 1 (definitive): TMDB confirms a digital/streaming release → playable online
                // Rule 2 (fallback): No TMDB data at all → use release date window (60-day theatrical window)
                const hasTmdbData = hasTheater || hasDigital;

                if (hasTmdbData) {
                    // Rule 1: definitive. Digital available → not theater-only.
                    setIsInTheaters(hasTheater && !hasDigital);
                } else if (movie.release_date) {
                    // Rule 2: No TMDB release data. Use 60-day window from release date.
                    const releaseDate = new Date(movie.release_date);
                    const ageDays = (Date.now() - releaseDate.getTime()) / (1000 * 60 * 60 * 24);
                    // Released within 60 days and in the future or recent past → theater-only
                    setIsInTheaters(ageDays >= 0 && ageDays < 60);
                } else {
                    setIsInTheaters(false);
                }

            } catch {
                // On error, assume not in theaters (fail open = playable)
                setIsInTheaters(false);
            }
        };

        checkRelease();
    }, [movie]);

    return isInTheaters;
};
