// ─── TMDB API Configuration ──────────────────────────────────────────────────
// API key is read from environment — never hardcode in source.
// Set VITE_TMDB_API_KEY in your .env file (and Cloudflare Pages env vars).
export const API_KEY = (import.meta as any).env?.VITE_TMDB_API_KEY || '';
export const BASE_URL = 'https://api.themoviedb.org/3';
export const IMG_PATH = 'https://image.tmdb.org/t/p/original';
export const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';
export const LOGO_SIZE = 'w780'; // Higher resolution for professional display

// Helper to get current display language from localStorage
const getCurrentLanguage = (): string => {
  try {
    const settings = localStorage.getItem('pstream-settings');
    if (settings) {
      const parsed = JSON.parse(settings);
      return parsed.displayLanguage || 'en-US';
    }
  } catch { }
  return 'en-US';
};

// Dynamic REQUESTS - language is read from localStorage each time
export const REQUESTS = {
  get fetchTrending()            { return `${BASE_URL}/trending/all/week?api_key=${API_KEY}&language=${getCurrentLanguage()}`; },
  get fetchNetflixOriginals()    { return `${BASE_URL}/discover/tv?api_key=${API_KEY}&with_networks=213&language=${getCurrentLanguage()}`; },
  get fetchTopRated()            { return `${BASE_URL}/movie/top_rated?api_key=${API_KEY}&language=${getCurrentLanguage()}`; },
  get fetchPopular()             { return `${BASE_URL}/movie/popular?api_key=${API_KEY}&language=${getCurrentLanguage()}`; },
  get fetchActionMovies()        { return `${BASE_URL}/discover/movie?api_key=${API_KEY}&with_genres=28&language=${getCurrentLanguage()}`; },
  get fetchComedyMovies()        { return `${BASE_URL}/discover/movie?api_key=${API_KEY}&with_genres=35&language=${getCurrentLanguage()}`; },
  get fetchHorrorMovies()        { return `${BASE_URL}/discover/movie?api_key=${API_KEY}&with_genres=27&language=${getCurrentLanguage()}`; },
  get fetchRomanceMovies()       { return `${BASE_URL}/discover/movie?api_key=${API_KEY}&with_genres=10749&language=${getCurrentLanguage()}`; },
  get fetchDocumentaries()       { return `${BASE_URL}/discover/movie?api_key=${API_KEY}&with_genres=99&language=${getCurrentLanguage()}`; },
  get fetchSciFiMovies()         { return `${BASE_URL}/discover/movie?api_key=${API_KEY}&with_genres=878&language=${getCurrentLanguage()}`; },

  fetchByGenre(type: 'movie' | 'tv', genreId: number, sortBy = 'popularity.desc') {
    return `${BASE_URL}/discover/${type}?api_key=${API_KEY}&with_genres=${genreId}&sort_by=${sortBy}&vote_count.gte=100&language=${getCurrentLanguage()}`;
  },

  get fetchActionTV()            { return `${BASE_URL}/discover/tv?api_key=${API_KEY}&with_genres=10759&language=${getCurrentLanguage()}`; },
  get fetchComedyTV()            { return `${BASE_URL}/discover/tv?api_key=${API_KEY}&with_genres=35&language=${getCurrentLanguage()}`; },
  get fetchDramaTV()             { return `${BASE_URL}/discover/tv?api_key=${API_KEY}&with_genres=18&language=${getCurrentLanguage()}`; },
  get fetchCrimeTV()             { return `${BASE_URL}/discover/tv?api_key=${API_KEY}&with_genres=80&language=${getCurrentLanguage()}`; },
  get fetchRealityTV()           { return `${BASE_URL}/discover/tv?api_key=${API_KEY}&with_genres=10764&language=${getCurrentLanguage()}`; },

  get fetchBoredomBustersTV()    { return `${BASE_URL}/discover/tv?api_key=${API_KEY}&with_genres=10759,80,10765&without_genres=16,10764&sort_by=popularity.desc&language=${getCurrentLanguage()}`; },
  get fetchUSSeries()            { return `${BASE_URL}/discover/tv?api_key=${API_KEY}&with_origin_country=US&sort_by=popularity.desc&language=${getCurrentLanguage()}`; },
  get fetchFamiliarFavoritesTV() { return `${BASE_URL}/discover/tv?api_key=${API_KEY}&sort_by=vote_count.desc&language=${getCurrentLanguage()}`; },
  get fetchExcitingSeriesTV()    { return `${BASE_URL}/discover/tv?api_key=${API_KEY}&with_genres=10759,10765&sort_by=popularity.desc&language=${getCurrentLanguage()}`; },
  get fetchLoveTheseTV()         { return `${BASE_URL}/discover/tv?api_key=${API_KEY}&sort_by=vote_average.desc&vote_count.gte=2000&language=${getCurrentLanguage()}`; },

  get fetchBoredomBustersMovies()    { return `${BASE_URL}/discover/movie?api_key=${API_KEY}&with_genres=28,12,53,878&without_genres=16&sort_by=popularity.desc&language=${getCurrentLanguage()}`; },
  get fetchFamiliarFavoritesMovies() { return `${BASE_URL}/discover/movie?api_key=${API_KEY}&sort_by=vote_count.desc&language=${getCurrentLanguage()}`; },
  get fetchExcitingMovies()          { return `${BASE_URL}/discover/movie?api_key=${API_KEY}&with_genres=28,878,53&sort_by=popularity.desc&language=${getCurrentLanguage()}`; },
  get fetchLoveTheseMovies()         { return `${BASE_URL}/discover/movie?api_key=${API_KEY}&sort_by=vote_average.desc&vote_count.gte=5000&language=${getCurrentLanguage()}`; },

  get fetchTrendingTV()     { return `${BASE_URL}/trending/tv/day?api_key=${API_KEY}&language=${getCurrentLanguage()}`; },
  get fetchTrendingMovies() { return `${BASE_URL}/trending/movie/day?api_key=${API_KEY}&language=${getCurrentLanguage()}`; },
  get fetchUpcoming()       { return `${BASE_URL}/movie/upcoming?api_key=${API_KEY}&language=${getCurrentLanguage()}&page=1`; },
  get searchMulti()         { return `${BASE_URL}/search/multi?api_key=${API_KEY}&language=${getCurrentLanguage()}&include_adult=false`; },

  fetchRecommendations(type: 'movie' | 'tv', id: number | string) {
    return `${BASE_URL}/${type}/${id}/recommendations?api_key=${API_KEY}&language=${getCurrentLanguage()}`;
  },
  fetchSimilar(type: 'movie' | 'tv', id: number | string) {
    return `${BASE_URL}/${type}/${id}/similar?api_key=${API_KEY}&language=${getCurrentLanguage()}`;
  },
  fetchMicroGenre(type: 'movie' | 'tv', genreIds: string, extra = '') {
    return `${BASE_URL}/discover/${type}?api_key=${API_KEY}&with_genres=${genreIds}&sort_by=popularity.desc&vote_count.gte=200${extra}&language=${getCurrentLanguage()}`;
  },
  fetchTopPicks(type: 'movie' | 'tv', topGenreIds: string) {
    return `${BASE_URL}/discover/${type}?api_key=${API_KEY}&with_genres=${topGenreIds}&sort_by=popularity.desc&vote_average.gte=6.5&vote_count.gte=500&language=${getCurrentLanguage()}`;
  },
  get fetchAwardWinningSeries() {
    return `${BASE_URL}/discover/tv?api_key=${API_KEY}&sort_by=vote_average.desc&vote_count.gte=2000&with_original_language=en&language=${getCurrentLanguage()}`;
  },
  get fetchNewReleases() {
    const today  = new Date();
    const past   = new Date(today.getTime() - 45 * 24 * 60 * 60 * 1000);
    const fmt    = (d: Date) => d.toISOString().split('T')[0];
    return `${BASE_URL}/discover/movie?api_key=${API_KEY}&primary_release_date.lte=${fmt(today)}&primary_release_date.gte=${fmt(past)}&sort_by=popularity.desc&vote_count.gte=50&language=${getCurrentLanguage()}`;
  },
  get fetchCriticallyAcclaimedDrama() {
    return `${BASE_URL}/discover/tv?api_key=${API_KEY}&with_genres=18&sort_by=vote_average.desc&vote_count.gte=1500&language=${getCurrentLanguage()}`;
  },
  get fetchFamiliarFavorites() {
    return `${BASE_URL}/discover/tv?api_key=${API_KEY}&sort_by=vote_count.desc&vote_count.gte=3000&language=${getCurrentLanguage()}`;
  },
  get fetchImaginativeSeries() {
    return `${BASE_URL}/discover/tv?api_key=${API_KEY}&with_genres=10765&sort_by=popularity.desc&vote_count.gte=200&language=${getCurrentLanguage()}`;
  },
  fetchByCountryAndGenre(type: 'movie' | 'tv', country: string, genreIds: string) {
    return `${BASE_URL}/discover/${type}?api_key=${API_KEY}&with_genres=${genreIds}&with_origin_country=${country}&sort_by=popularity.desc&vote_count.gte=100&language=${getCurrentLanguage()}`;
  },
};

// ─── Re-exports from data/ modules ───────────────────────────────────────────
// All existing imports from 'constants' keep working — no component changes needed.

export type { MicroGenreEntry } from './data/genres';
export { MICRO_GENRES, DAY_STREAMS, GENRES } from './data/genres';

export { DISPLAY_LANGUAGES, SUBTITLE_LANGUAGES } from './data/languages';

export type { Avatar, AvatarCategory } from './data/avatars';
export { AVATAR_CATEGORIES, ALL_AVATARS, DEFAULT_AVATAR } from './data/avatars';
