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
  { id: 35, name: 'Stand-up Comedy' }, // Maps to Comedy
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
  { id: 99, name: 'Science & Nature' }, // Maps to Documentary
  { id: 10766, name: 'Soap Operas' },
  { id: 10767, name: 'Stand-up & Chat Shows' },
  { id: 10768, name: 'War & Politics' },
  { id: 37, name: 'Western' },
];

// ── Universal filter set (My List, Search filters, etc.) ──
export const UNIVERSAL_GENRES: PageGenre[] = [
  { id: 28, name: 'Action' },
  { id: 12, name: 'Adventure' },
  { id: 16, name: 'Animation' },
  { id: 35, name: 'Comedy' },
  { id: 80, name: 'Crime' },
  { id: 99, name: 'Documentary' },
  { id: 18, name: 'Drama' },
  { id: 10751, name: 'Family' },
  { id: 14, name: 'Fantasy' },
  { id: 36, name: 'History' },
  { id: 27, name: 'Horror' },
  { id: 10402, name: 'Music' },
  { id: 9648, name: 'Mystery' },
  { id: 10749, name: 'Romance' },
  { id: 878, name: 'Science Fiction' },
  { id: 53, name: 'Thriller' },
  { id: 10752, name: 'War' },
  { id: 37, name: 'Western' },
];