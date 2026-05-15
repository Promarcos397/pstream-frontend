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

// Dynamic REQUESTS - URLs are handled by the tmdb service which injects keys/language
export const REQUESTS = {
  get fetchTrending()            { return `${BASE_URL}/trending/all/week`; },
  get fetchNetflixOriginals()    { return `${BASE_URL}/discover/tv?with_networks=213`; },
  get fetchTopRated()            { return `${BASE_URL}/movie/top_rated`; },
  get fetchPopular()             { return `${BASE_URL}/movie/popular`; },
  get fetchActionMovies()        { return `${BASE_URL}/discover/movie?with_genres=28`; },
  get fetchComedyMovies()        { return `${BASE_URL}/discover/movie?with_genres=35`; },
  get fetchHorrorMovies()        { return `${BASE_URL}/discover/movie?with_genres=27`; },
  get fetchRomanceMovies()       { return `${BASE_URL}/discover/movie?with_genres=10749`; },
  get fetchDocumentaries()       { return `${BASE_URL}/discover/movie?with_genres=99`; },
  get fetchSciFiMovies()         { return `${BASE_URL}/discover/movie?with_genres=878`; },

  fetchByGenre(type: 'movie' | 'tv', genreId: number, sortBy = 'popularity.desc') {
    return `${BASE_URL}/discover/${type}?with_genres=${genreId}&sort_by=${sortBy}&vote_count.gte=100`
  },

  get fetchActionTV()            { return `${BASE_URL}/discover/tv?with_genres=10759`; },
  get fetchComedyTV()            { return `${BASE_URL}/discover/tv?with_genres=35`; },
  get fetchDramaTV()             { return `${BASE_URL}/discover/tv?with_genres=18`; },
  get fetchCrimeTV()             { return `${BASE_URL}/discover/tv?with_genres=80`; },
  get fetchRealityTV()           { return `${BASE_URL}/discover/tv?with_genres=10764`; },

  get fetchBoredomBustersTV()    { return `${BASE_URL}/discover/tv?with_genres=10759,80,10765&without_genres=16,10764&sort_by=popularity.desc`; },
  get fetchUSSeries()            { return `${BASE_URL}/discover/tv?with_origin_country=US&sort_by=popularity.desc`; },
  get fetchFamiliarFavoritesTV() { return `${BASE_URL}/discover/tv?sort_by=vote_count.desc`; },
  get fetchExcitingSeriesTV()    { return `${BASE_URL}/discover/tv?with_genres=10759,10765&sort_by=popularity.desc`; },
  get fetchLoveTheseTV()         { return `${BASE_URL}/discover/tv?sort_by=vote_average.desc&vote_count.gte=2000`; },

  get fetchBoredomBustersMovies()    { return `${BASE_URL}/discover/movie?with_genres=28,12,53,878&without_genres=16&sort_by=popularity.desc`; },
  get fetchFamiliarFavoritesMovies() { return `${BASE_URL}/discover/movie?sort_by=vote_count.desc`; },
  get fetchExcitingMovies()          { return `${BASE_URL}/discover/movie?with_genres=28,878,53&sort_by=popularity.desc`; },
  get fetchLoveTheseMovies()         { return `${BASE_URL}/discover/movie?sort_by=vote_average.desc&vote_count.gte=5000`; },

  get fetchTrendingTV()     { return `${BASE_URL}/trending/tv/day`; },
  get fetchTrendingMovies() { return `${BASE_URL}/trending/movie/day`; },
  get fetchUpcoming()       { return `${BASE_URL}/movie/upcoming?page=1`; },
  get searchMulti()         { return `${BASE_URL}/search/multi?include_adult=false`; },

  fetchRecommendations(type: 'movie' | 'tv', id: number | string) {
    return `${BASE_URL}/${type}/${id}/recommendations`;
  },
  fetchSimilar(type: 'movie' | 'tv', id: number | string) {
    return `${BASE_URL}/${type}/${id}/similar`;
  },
  fetchMicroGenre(type: 'movie' | 'tv', genreIds: string, extra = '') {
    return `${BASE_URL}/discover/${type}?with_genres=${genreIds}&sort_by=popularity.desc&vote_count.gte=200${extra}`;
  },
  fetchTopPicks(type: 'movie' | 'tv', topGenreIds: string) {
    return `${BASE_URL}/discover/${type}?with_genres=${topGenreIds}&sort_by=popularity.desc&vote_average.gte=6.5&vote_count.gte=500`;
  },
  get fetchAwardWinningSeries() {
    return `${BASE_URL}/discover/tv?sort_by=vote_average.desc&vote_count.gte=2000&with_original_language=en`;
  },
  get fetchNewReleases() {
    const today  = new Date();
    const past   = new Date(today.getTime() - 45 * 24 * 60 * 60 * 1000);
    const fmt    = (d: Date) => d.toISOString().split('T')[0];
    return `${BASE_URL}/discover/movie?primary_release_date.lte=${fmt(today)}&primary_release_date.gte=${fmt(past)}&sort_by=popularity.desc&vote_count.gte=50`;
  },
  get fetchCriticallyAcclaimedDrama() {
    return `${BASE_URL}/discover/tv?with_genres=18&sort_by=vote_average.desc&vote_count.gte=1500`;
  },
  get fetchFamiliarFavorites() {
    return `${BASE_URL}/discover/tv?sort_by=vote_count.desc&vote_count.gte=3000`;
  },
  get fetchImaginativeSeries() {
    return `${BASE_URL}/discover/tv?with_genres=10765&sort_by=popularity.desc&vote_count.gte=200`;
  },
  fetchByCountryAndGenre(type: 'movie' | 'tv', country: string, genreIds: string) {
    return `${BASE_URL}/discover/${type}?with_genres=${genreIds}&with_origin_country=${country}&sort_by=popularity.desc&vote_count.gte=100`;
  },
};

// ─── Re-exports from data/ modules ───────────────────────────────────────────
// All existing imports from 'constants' keep working — no component changes needed.

export type { MicroGenreEntry } from './data/genres';
export { MICRO_GENRES, DAY_STREAMS, GENRES } from './data/genres';

export { DISPLAY_LANGUAGES, SUBTITLE_LANGUAGES } from './data/languages';

export type { Avatar, AvatarCategory } from './data/avatars';
export { AVATAR_CATEGORIES, ALL_AVATARS, DEFAULT_AVATAR } from './data/avatars';
