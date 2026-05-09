import { useGlobalContext } from '../context/GlobalContext';
import { useMemo } from 'react';
import { Movie } from '../types';

export function useTasteEngine() {
  const { getLikedMovies, continueWatching, myList } = useGlobalContext();

  // Calculate genre weights
  const genreWeights = useMemo(() => {
    const weights: Record<number, number> = {};
    const add = (gids?: number[], score = 0) => {
      (gids || []).forEach(g => {
        weights[g] = (weights[g] || 0) + score;
      });
    };

    continueWatching.forEach(m => add(m?.genre_ids, 1));
    myList.forEach(m => add(m?.genre_ids, 2));

    Object.values(getLikedMovies() || {}).forEach((entry: any) => {
      const gids = entry.movie?.genre_ids || entry.genre_ids;
      if (entry.rating === 'dislike') add(gids, -5);
      else add(gids, 5);
    });

    return weights;
  }, [getLikedMovies, continueWatching, myList]);

  const getMatchScore = (movie: Movie | null | undefined): number | null => {
    if (!movie || !movie.genre_ids || movie.genre_ids.length === 0) return null;
    
    let score = 0;
    movie.genre_ids.forEach(gid => {
      if (genreWeights[gid]) score += genreWeights[gid];
    });

    // Normalize to a percentage between 50% and 99%
    // Base is 75%
    let matchPct = 75 + (score * 2);
    if (matchPct > 99) matchPct = 99;
    if (matchPct < 55) matchPct = 55 + Math.floor(Math.random() * 10); // Don't go too low, keep UI friendly

    return Math.floor(matchPct);
  };

  const getRecommendedGenres = () => {
    return Object.entries(genreWeights)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(e => Number(e[0]));
  };

  const getAvoidGenres = () => {
    return Object.entries(genreWeights)
      .filter(e => e[1] < 0)
      .sort((a, b) => a[1] - b[1])
      .map(e => Number(e[0]));
  };

  const getDislikedMovies = (): Movie[] => {
    return getLikedMovies()
      .filter((entry: any) => entry.rating === 'dislike')
      .map((entry: any) => entry.movie)
      .filter(Boolean);
  };

  return { getMatchScore, getRecommendedGenres, getAvoidGenres, getDislikedMovies };
}

