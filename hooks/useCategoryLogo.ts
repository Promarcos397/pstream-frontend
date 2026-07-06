import { useEffect, useState } from 'react';
import { getMovieImages } from '../services/tmdb';

interface LogoRef {
  type: 'movie' | 'tv';
  id: number;
}

// Maps an avatar-category id (data/avatars.ts) to the real TMDB title so its
// section header can show the official logo art, like Netflix's own Choose
// Icon page. Categories with no licensed-title backing (e.g. "classics", our
// original fluffball characters) are intentionally absent — they keep their
// plain-text label since there's no real logo to fetch.
const CATEGORY_TMDB_REF: Record<string, LogoRef> = {
  'bridgerton': { type: 'tv', id: 118926 },
  'one-piece': { type: 'tv', id: 37854 },
  'peaky-blinders': { type: 'tv', id: 60574 },
  'lucifer': { type: 'tv', id: 63174 },
};

const TMDB_IMG_BASE = 'https://image.tmdb.org/t/p/w300';
const logoCache = new Map<string, string | null>();

/** Resolves a category's official TMDB title-treatment logo, or null if
 * there's no mapping or no logo art is available (caller falls back to text). */
export function useCategoryLogo(categoryId: string): string | null {
  const [logo, setLogo] = useState<string | null>(() => logoCache.get(categoryId) ?? null);

  useEffect(() => {
    const ref = CATEGORY_TMDB_REF[categoryId];
    if (!ref) return;
    if (logoCache.has(categoryId)) {
      setLogo(logoCache.get(categoryId) ?? null);
      return;
    }
    let cancelled = false;
    (async () => {
      const data = await getMovieImages(ref.id, ref.type);
      const logos = (data?.logos || []) as Array<{ file_path: string; iso_639_1: string | null }>;
      const best = logos.find(l => l.iso_639_1 === 'en') || logos[0];
      const url = best ? `${TMDB_IMG_BASE}${best.file_path}` : null;
      logoCache.set(categoryId, url);
      if (!cancelled) setLogo(url);
    })();
    return () => { cancelled = true; };
  }, [categoryId]);

  return logo;
}
