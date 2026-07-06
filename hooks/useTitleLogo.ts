import { useEffect, useState } from 'react';
import { getMovieImages } from '../services/tmdb';
import { Movie } from '../types';

const TMDB_IMG_BASE = 'https://image.tmdb.org/t/p/w300';
const logoCache = new Map<string, string | null>();

/** Resolves a title's official TMDB logo (title-treatment PNG), or null if
 * none exists — used to badge Clips' info-avatar the way Netflix's own
 * clip UI stamps the show/movie logo under the circular thumbnail. */
export function useTitleLogo(movie: Movie | null): string | null {
  const key = movie ? String(movie.id) : '';
  const [logo, setLogo] = useState<string | null>(() => (key ? logoCache.get(key) ?? null : null));

  useEffect(() => {
    if (!movie || !key) return;
    if (logoCache.has(key)) {
      setLogo(logoCache.get(key) ?? null);
      return;
    }
    let cancelled = false;
    const type = movie.media_type || (movie.title ? 'movie' : 'tv');
    (async () => {
      const data = await getMovieImages(movie.id, type as 'movie' | 'tv');
      const logos = (data?.logos || []) as Array<{ file_path: string; iso_639_1: string | null }>;
      const best = logos.find(l => l.iso_639_1 === 'en') || logos.find(l => l.iso_639_1 === null) || null;
      const url = best ? `${TMDB_IMG_BASE}${best.file_path}` : null;
      logoCache.set(key, url);
      if (!cancelled) setLogo(url);
    })();
    return () => { cancelled = true; };
  }, [key, movie]);

  return logo;
}
