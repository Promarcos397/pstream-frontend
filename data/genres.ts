/**
 * data/genres.ts
 * ──────────────
 * Static genre/category data — moved out of constants.ts.
 * Pure data, no logic, no env reads.
 */

// ─── TMDB Genre ID → Name map ─────────────────────────────────────────────────
export const GENRES: { [key: number]: string } = {
  28: "Action",
  12: "Adventure",
  16: "Animation",
  35: "Comedy",
  80: "Crime",
  99: "Documentary",
  18: "Drama",
  10751: "Family",
  14: "Fantasy",
  36: "History",
  27: "Horror",
  10402: "Music",
  9648: "Mystery",
  10749: "Romance",
  878: "Science Fiction",
  10770: "TV Movie",
  53: "Thriller",
  10752: "War",
  37: "Western",
  10759: "Action & Adventure",
  10762: "Family",
  10763: "News",
  10764: "Reality",
  10765: "Sci-Fi & Fantasy",
  10766: "Soap",
  10767: "Talk",
  10768: "War & Politics",
};

// ─── Micro-Genre Library ──────────────────────────────────────────────────────
export interface MicroGenreEntry {
  name: string;
  genres: string;
  type: 'movie' | 'tv';
  extra?: string;
}

export const MICRO_GENRES: MicroGenreEntry[] = [
  { name: 'Offbeat Series', genres: '35,189', type: 'tv', extra: '&with_keywords=9715|10631&page=2' },
  { name: 'K-Drama for Beginners', genres: '18', type: 'tv', extra: '&with_origin_country=KR&with_keywords=Romance' },
  { name: 'Wit-Filled Comedies', genres: '35', type: 'tv', extra: '&vote_average.gte=7.5&page=1' },
  { name: 'Gritty Crime Procedurals', genres: '80', type: 'tv', extra: '&with_keywords=9883&page=3' },
  { name: 'Heart-Pounding Action', genres: '10759', type: 'tv', extra: '&vote_count.gte=5000' },
  { name: 'Small Town Mysteries', genres: '9648', type: 'tv', extra: '&with_keywords=small town' },
  { name: 'Thought-Provoking Sci-Fi', genres: '10765,18', type: 'tv', extra: '&vote_average.gte=7' },
  { name: 'The Vault: 90s Classics', genres: '18,35', type: 'tv', extra: '&first_air_date.gte=1990-01-01&first_air_date.lte=1999-12-31' },
  { name: 'Essential Classics', genres: '18,36', type: 'movie', extra: '&primary_release_date.lte=1980-01-01&vote_average.gte=8' },
  { name: 'Nostalgic 2000s Hits', genres: '18,35', type: 'tv', extra: '&first_air_date.gte=2000-01-01&first_air_date.lte=2009-12-31' },
  { name: 'Edge-of-Your-Seat Thrills', genres: '53', type: 'movie', extra: '&vote_count.gte=10000' },
  { name: 'Quick Watches', genres: '35,18', type: 'tv', extra: '&with_runtime.lte=30&without_genres=16' },
  { name: 'Animated Staples', genres: '16', type: 'tv', extra: '&with_runtime.lte=30' },
  { name: 'Epic Sagas & Legacies', type: 'tv', genres: '10765,12', extra: '&vote_count.gte=3000' },
  { name: 'Stories That Spark Conversation', genres: '18,99', type: 'tv', extra: '&vote_average.gte=8&page=2' },
  { name: 'Unmissable Hidden Gems', genres: '18,53', type: 'movie', extra: '&vote_average.gte=7.5&page=4' },
  { name: 'International Breakout Hits', type: 'tv', genres: '18', extra: '&without_origin_country=US&vote_average.gte=7.8' },
  { name: 'Indie Favorites', type: 'movie', genres: '18', extra: '&vote_count.lte=2000&vote_average.gte=7.5&page=3' },
  { name: 'Sunday Night Wind-Down', genres: '35', type: 'tv', extra: '&vote_average.gte=7&page=2' },
  { name: 'Friday Night Blockbusters', genres: '28,12', type: 'movie', extra: '&vote_count.gte=15000' },
  { name: 'Late Night Chill', genres: '35,10749', type: 'movie', extra: '&with_runtime.lte=100' },
  { name: 'Visually Stunning Worlds', genres: '10765,14', type: 'movie', extra: '&vote_count.gte=5000&page=2' },
  { name: 'High-Stakes Heists', genres: '80,53', type: 'movie', extra: '&with_keywords=heist|bank heist' },
  { name: 'Cyberpunk & Dystopia', genres: '878', type: 'movie', extra: '&with_keywords=cyberpunk|dystopia' },
  { name: 'Political Mind Games', genres: '10768,18', type: 'tv', extra: '&vote_average.gte=7.5' },
  { name: 'Supernatural Encounters', genres: '10765,27', type: 'tv', extra: '&with_keywords=supernatural|paranormal' },
  { name: 'Mind-Bending Realities', genres: '9648,878', type: 'movie', extra: '&with_keywords=mind bending|time travel' },
  { name: 'True Stories & Docuseries', genres: '99,80', type: 'tv', extra: '&vote_average.gte=7' },
  { name: 'Based on Real Life', genres: '18,36', type: 'movie', extra: '&with_keywords=based on true story' },
];

// ─── Day-of-week themed rows ──────────────────────────────────────────────────
export const DAY_STREAMS: Record<string, MicroGenreEntry> = {
  Monday:    { name: 'Monday Motivation',          genres: '18',     type: 'movie', extra: '&vote_average.gte=7' },
  Tuesday:   { name: 'Tuesday True Crime',         genres: '99,80',  type: 'tv' },
  Wednesday: { name: 'Wednesday Warp',             genres: '10765,878', type: 'tv' },
  Thursday:  { name: 'Throwback Thursday',         genres: '18,35',  type: 'movie', extra: '&primary_release_date.lte=2000-01-01' },
  Friday:    { name: 'Friday Night Hits',          genres: '28,12',  type: 'movie', extra: '&vote_count.gte=10000' },
  Saturday:  { name: 'Saturday Family Night',      genres: '16,10751', type: 'movie' },
  Sunday:    { name: 'Sunday Binge-worthy Series', genres: '18,80',  type: 'tv',   extra: '&vote_count.gte=5000&page=2' },
};
