export interface PageGenre {
  id: number;
  name: string;
}

// ── TMDB Movie Genres (Netflix Naming Convention) ──
export const MOVIE_GENRES: PageGenre[] = [
  { id: 28, name: 'Action' },
  { id: 12, name: 'Adventure' },
  { id: 16, name: 'Anime' },
  { id: 10751, name: 'Children & Family' },
  { id: 35, name: 'Comedies' },
  { id: 80, name: 'Crime' },
  { id: 99, name: 'Documentaries' },
  { id: 18, name: 'Dramas' },
  { id: 14, name: 'Fantasy' },
  { id: 36, name: 'History' },
  { id: 27, name: 'Horror' },
  { id: 10402, name: 'Music & Musicals' },
  { id: 9648, name: 'Mysteries' },
  { id: 10749, name: 'Romance' },
  { id: 878, name: 'Sci-Fi' },
  { id: 35, name: 'Stand-up Comedy' },
  { id: 53, name: 'Thriller' },
  { id: 10752, name: 'War' },
  { id: 37, name: 'Western' },
];

// ── TMDB TV Genres (Netflix Naming Convention) ──
export const TV_GENRES: PageGenre[] = [
  { id: 10759, name: 'Action & Adventure' },
  { id: 16, name: 'Anime' },
  { id: 35, name: 'Comedies' },
  { id: 80, name: 'Crime' },
  { id: 99, name: 'Documentary Series' },
  { id: 18, name: 'Dramas' },
  { id: 10751, name: 'Family' },
  { id: 10762, name: 'Kids' },
  { id: 9648, name: 'Mysteries' },
  { id: 10763, name: 'News' },
  { id: 10764, name: 'Reality' },
  { id: 10765, name: 'Sci-Fi & Fantasy' },
  { id: 99, name: 'Science & Nature' },
  { id: 10766, name: 'Soap Operas' },
  { id: 10767, name: 'Stand-up & Chat Shows' },
  { id: 10768, name: 'War & Politics' },
  { id: 37, name: 'Western' },
];

/** Cross-media genre ID mapping for hybrid home discover (movie ↔ TV TMDB ids). */
export const HOME_GENRE_ID_MAP: Record<number, { movie: number; tv: number }> = {
  28: { movie: 28, tv: 10759 },
  12: { movie: 12, tv: 10759 },
  10759: { movie: 28, tv: 10759 },
  878: { movie: 878, tv: 10765 },
  10765: { movie: 878, tv: 10765 },
  14: { movie: 14, tv: 10765 },
  10751: { movie: 10751, tv: 10762 },
  10762: { movie: 10751, tv: 10762 },
  10752: { movie: 10752, tv: 10768 },
  10768: { movie: 10752, tv: 10768 },
};

const TV_ONLY_GENRE_IDS = new Set([10759, 10762, 10763, 10764, 10765, 10766, 10767, 10768]);

export const resolveGenreId = (
  mediaType: 'movie' | 'tv',
  selectedGenreId: number,
): number => {
  const mapping = HOME_GENRE_ID_MAP[selectedGenreId];
  if (mapping) return mediaType === 'movie' ? mapping.movie : mapping.tv;
  return selectedGenreId;
};

export const isTvOnlyGenreId = (genreId: number): boolean => TV_ONLY_GENRE_IDS.has(genreId);

// ── Merged mobile Home genre picker (movie-forward + TV-only / distinct variants) ──
const movieNamesById = new Map<number, string>();
MOVIE_GENRES.forEach(g => movieNamesById.set(g.id, g.name));

const homeGenreKeys = new Set<string>();
const pushHomeGenre = (g: PageGenre) => {
  const key = `${g.id}:${g.name}`;
  if (homeGenreKeys.has(key)) return;
  homeGenreKeys.add(key);
  HOME_MOBILE_GENRES.push(g);
};

export const HOME_MOBILE_GENRES: PageGenre[] = [];

// Movie-forward base (supports weaker movie discoverability)
MOVIE_GENRES.forEach(pushHomeGenre);

// TV entries: new ids or intentionally distinct labels for duplicate ids
const TV_APPEND: PageGenre[] = [
  { id: 10759, name: 'Action & Adventure' },
  { id: 10762, name: 'Kids' },
  { id: 10763, name: 'News' },
  { id: 10764, name: 'Reality' },
  { id: 10765, name: 'Sci-Fi & Fantasy' },
  { id: 99, name: 'Science & Nature' },
  { id: 10766, name: 'Soap Operas' },
  { id: 10767, name: 'Stand-up & Chat Shows' },
  { id: 10768, name: 'War & Politics' },
  { id: 99, name: 'Documentary Series' },
  { id: 10751, name: 'Family' },
];
TV_APPEND.forEach(pushHomeGenre);

/** Display name for manifest row titles when needed. */
export const getHomeGenreDisplayName = (id: number, selectedName?: string): string =>
  selectedName ?? movieNamesById.get(id) ?? 'Content';

// ── Universal filter set (My List, Search filters, etc.) ──
export const UNIVERSAL_GENRES: PageGenre[] = [
  { id: 28, name: 'Action' },
  { id: 12, name: 'Adventure' },
  { id: 16, name: 'Anime' },
  { id: 35, name: 'Comedies' },
  { id: 80, name: 'Crime' },
  { id: 99, name: 'Documentaries' },
  { id: 18, name: 'Dramas' },
  { id: 10751, name: 'Children & Family' },
  { id: 14, name: 'Fantasy' },
  { id: 36, name: 'History' },
  { id: 27, name: 'Horror' },
  { id: 10402, name: 'Music & Musicals' },
  { id: 9648, name: 'Mysteries' },
  { id: 10749, name: 'Romance' },
  { id: 878, name: 'Sci-Fi' },
  { id: 53, name: 'Thriller' },
  { id: 10752, name: 'War' },
  { id: 37, name: 'Western' },
];
