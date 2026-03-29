import { useState, useEffect } from 'react';
import { Movie } from '../types';
import { getReleaseDates } from '../services/api';

export const useIsInTheaters = (movie: Movie | null) => {
    const [isInTheaters, setIsInTheaters] = useState(false);

    useEffect(() => {
        if (!movie) return;

        const checkRelease = async () => {
            try {
                const mediaType = (movie.media_type || (movie.title ? 'movie' : 'tv')) as 'movie' | 'tv';
                if (mediaType === 'tv') {
                    setIsInTheaters(false);
                    return;
                }

                const releases = await getReleaseDates(movie.id, 'movie');
                const now = new Date();
                
                let hasTheater = false;
                let hasDigital = false;

                for (const country of releases) {
                    for (const release of country.release_dates) {
                        const releaseDate = new Date(release.release_date);
                        if (release.type === 3 && releaseDate <= now) hasTheater = true;
                        if (release.type >= 4 && releaseDate <= now) hasDigital = true;
                    }
                }

                setIsInTheaters(hasTheater && !hasDigital);
            } catch (e) {
                setIsInTheaters(false);
            }
        };

        checkRelease();
    }, [movie]);

    return isInTheaters;
};
