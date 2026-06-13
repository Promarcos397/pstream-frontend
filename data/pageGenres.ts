export interface PageGenre {
  id: number;
  name: string;
}

// ── TMDB Movie Genres (Netflix Naming Convention) ──
export const MOVIE_GENRES: PageGenre[] = [
  { id: 28, name: 'Action' },
  { id: 16, name: 'Anime' },
  { id: 10002, name: 'Astrology' },
  { id: 10003, name: 'Black Stories' },
  { id: 10004, name: 'Book Adaptations' },
  { id: 10005, name: 'British' },
  { id: 10009, name: 'Classics' },
  { id: 35, name: 'Comedies' },
  { id: 80, name: 'Crime' },
  { id: 10010, name: 'Cult' },
  { id: 99, name: 'Documentaries' },
  { id: 18, name: 'Dramas' },
  { id: 10006, name: 'European' },
  { id: 14, name: 'Fantasy' },
  { id: 10008, name: 'Hollywood' },
  { id: 27, name: 'Horror' },
  { id: 10011, name: 'Independent' },
  { id: 10012, name: 'International' },
  { id: 10751, name: 'Kids & Family' },
  { id: 10007, name: 'Moods' },
  { id: 10402, name: 'Music & Musicals' },
  { id: 10001, name: 'Pride' },
  { id: 10749, name: 'Romance' },
  { id: 878, name: 'Sci-Fi' },
  { id: 10013, name: 'Shorts' },
  { id: 10014, name: 'Sport' },
  { id: 35, name: 'Stand-up Comedy' },
  { id: 53, name: 'Thriller' },
];

// ── TMDB TV Genres (Netflix Naming Convention) ──
export const TV_GENRES: PageGenre[] = [
  { id: 10759, name: 'Action' },
  { id: 16, name: 'Anime' },
  { id: 10002, name: 'Astrology' },
  { id: 10003, name: 'Black Stories' },
  { id: 10004, name: 'Book Adaptations' },
  { id: 10005, name: 'British' },
  { id: 35, name: 'Comedies' },
  { id: 80, name: 'Crime' },
  { id: 99, name: 'Documentary Series' },
  { id: 18, name: 'Dramas' },
  { id: 10006, name: 'European' },
  { id: 27, name: 'Horror' },
  { id: 10012, name: 'International' },
  { id: 10762, name: 'Kids' },
  { id: 10007, name: 'Moods' },
  { id: 9648, name: 'Mysteries' },
  { id: 10001, name: 'Pride' },
  { id: 10764, name: 'Reality' },
  { id: 10749, name: 'Romance' },
  { id: 10765, name: 'Sci-Fi & Fantasy' },
  { id: 99, name: 'Science & Nature' },
  { id: 10014, name: 'Sport' },
  { id: 10767, name: 'Stand-up & Chat Shows' },
  { id: 10015, name: 'Teen' },
  { id: 53, name: 'Thriller' },
  { id: 10008, name: 'US' },
];

/** Cross-media genre ID mapping for hybrid home discover (movie ↔ TV TMDB ids). */
export const HOME_GENRE_ID_MAP: Record<number, { movie: number; tv: number }> = {
  28: { movie: 28, tv: 10759 },
  10759: { movie: 28, tv: 10759 },
  878: { movie: 878, tv: 10765 },
  10765: { movie: 878, tv: 10765 },
  14: { movie: 14, tv: 10765 },
  10751: { movie: 10751, tv: 10762 },
  10762: { movie: 10751, tv: 10762 },
  12: { movie: 12, tv: 10759 },
  53: { movie: 53, tv: 9648 },
  9648: { movie: 53, tv: 9648 },
};

const TV_ONLY_GENRE_IDS = new Set([10759, 10762, 10763, 10764, 10765, 10766, 10767, 10768, 10015, 9648]);
const MOVIE_ONLY_GENRE_IDS = new Set([12, 36, 53, 10402, 10751, 10013]);

export const resolveGenreId = (
  mediaType: 'movie' | 'tv',
  selectedGenreId: number,
): number => {
  const mapping = HOME_GENRE_ID_MAP[selectedGenreId];
  if (mapping) return mediaType === 'movie' ? mapping.movie : mapping.tv;
  return selectedGenreId;
};

export const isTvOnlyGenreId = (genreId: number): boolean => TV_ONLY_GENRE_IDS.has(genreId);
export const isMovieOnlyGenreId = (genreId: number): boolean => MOVIE_ONLY_GENRE_IDS.has(genreId);

// ─── Merged mobile Home genre picker (movie-forward + TV-only / distinct variants) ──
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
  { id: 10762, name: 'Kids' },
  { id: 10764, name: 'Reality' },
  { id: 10765, name: 'Sci-Fi & Fantasy' },
  { id: 99, name: 'Science & Nature' },
  { id: 10767, name: 'Stand-up & Chat Shows' },
  { id: 99, name: 'Documentary Series' },
  { id: 10015, name: 'Teen' },
  { id: 10008, name: 'US' },
  { id: 9648, name: 'Mysteries' },
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
