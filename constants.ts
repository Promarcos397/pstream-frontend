export const BASE_URL = 'https://api.themoviedb.org/3';
export const IMG_PATH = 'https://image.tmdb.org/t/p/w780';
export const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';
export const LOGO_SIZE = 'w780'; // Higher resolution for professional display

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

  // Internal helper to merge query parameters safely, avoiding duplicates like vote_count.gte
  _build(path: string, baseParams: Record<string, string | number>, extra = '') {
    const url = new URL(path);
    Object.entries(baseParams).forEach(([k, v]) => url.searchParams.set(k, String(v)));
    
    // Parse extra string (e.g. "&page=2&vote_count.gte=1000")
    if (extra) {
      const extraClean = extra.startsWith('&') ? extra.slice(1) : extra;
      const extraParams = new URLSearchParams(extraClean);
      extraParams.forEach((v, k) => url.searchParams.set(k, v));
    }
    
    return url.toString();
  },

  fetchByGenre(type: 'movie' | 'tv', genreId: number, sortBy = 'popularity.desc', extra = '') {
    const params: Record<string, string | number> = {
      sort_by: sortBy,
      'vote_count.gte': type === 'tv' ? 5 : 25
    };
    
    // Intercept custom Netflix-style genres
    if (genreId === 10001) { // Pride / LGBTQ
      params.with_keywords = '9003';
    } else if (genreId === 10002) { // Astrology
      params.with_keywords = '185246|10168|15386';
    } else if (genreId === 10003) { // Black Stories
      params.with_keywords = '237248|175510|242137|161556';
    } else if (genreId === 10004) { // Book Adaptations
      params.with_keywords = '818|10214';
    } else if (genreId === 10005) { // British
      params.with_origin_country = 'GB';
    } else if (genreId === 10006) { // European
      params.with_origin_country = 'FR|DE|IT|ES|NL|DK|SE|NO|FI|PL';
    } else if (genreId === 10007) { // Moods
      params.with_keywords = '9663|10224|10185';
    } else if (genreId === 10008) { // US / Hollywood
      params.with_origin_country = 'US';
    } else if (genreId === 10009) { // Classics
      if (type === 'tv') params['first_air_date.lte'] = '1985-01-01';
      else params['primary_release_date.lte'] = '1985-01-01';
    } else if (genreId === 10010) { // Cult
      params.with_keywords = '10084|12339';
    } else if (genreId === 10011) { // Independent
      params.vote_average_gte = 7.5;
      params['vote_count.lte'] = 800;
      params['vote_count.gte'] = 50;
    } else if (genreId === 10012) { // International
      params.without_original_language = 'en';
    } else if (genreId === 10013) { // Shorts
      params['with_runtime.lte'] = 40;
    } else if (genreId === 10014) { // Sport
      params.with_keywords = '6075|9715|180370';
    } else if (genreId === 10015) { // Teen
      params.with_keywords = '175602|4565|1701';
    } else {
      params.with_genres = genreId;
    }

    return this._build(`${BASE_URL}/discover/${type}`, params, extra);
  },

  get fetchActionTV()            { return this.fetchByGenre('tv', 10759); },
  get fetchComedyTV()            { return this.fetchByGenre('tv', 35); },
  get fetchDramaTV()             { return this.fetchByGenre('tv', 18); },
  get fetchCrimeTV()             { return this.fetchByGenre('tv', 80); },
  get fetchRealityTV()           { return this.fetchByGenre('tv', 10764); },

  get fetchBoredomBustersTV()    { 
    return this._build(`${BASE_URL}/discover/tv`, {
      with_genres: '10759,80,10765',
      without_genres: '16,10764',
      sort_by: 'popularity.desc'
    });
  },
  get fetchUSSeries()            { return this._build(`${BASE_URL}/discover/tv`, { with_origin_country: 'US', sort_by: 'popularity.desc' }); },
  get fetchExcitingSeriesTV()    { return this.fetchByGenre('tv', 10759, 'popularity.desc'); }, // Simplified
  get fetchLoveTheseTV()         { return this._build(`${BASE_URL}/discover/tv`, { sort_by: 'vote_average.desc', 'vote_count.gte': 500 }); },

  get fetchBoredomBustersMovies()    { 
    return this._build(`${BASE_URL}/discover/movie`, {
      with_genres: '28,12,53,878',
      without_genres: '16',
      sort_by: 'popularity.desc'
    });
  },
  get fetchFamiliarFavoritesMovies() { return this._build(`${BASE_URL}/discover/movie`, { sort_by: 'vote_count.desc' }); },
  get fetchExcitingMovies()          { 
    return this._build(`${BASE_URL}/discover/movie`, {
      with_genres: '28,878,53',
      sort_by: 'popularity.desc'
    });
  },
  get fetchLoveTheseMovies()         { return this._build(`${BASE_URL}/discover/movie`, { sort_by: 'vote_average.desc', 'vote_count.gte': 1200 }); },

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
    return this._build(`${BASE_URL}/discover/${type}`, {
      with_genres: genreIds,
      sort_by: 'popularity.desc',
      'vote_count.gte': 50
    }, extra);
  },
  fetchTopPicks(type: 'movie' | 'tv', topGenreIds: string) {
    return this._build(`${BASE_URL}/discover/${type}`, {
      with_genres: topGenreIds,
      sort_by: 'popularity.desc',
      'vote_average.gte': 6.5,
      'vote_count.gte': 120
    });
  },
  get fetchAwardWinningSeries() {
    return this._build(`${BASE_URL}/discover/tv`, {
      sort_by: 'vote_average.desc',
      'vote_count.gte': 500,
      with_original_language: 'en'
    });
  },
  get fetchNewReleases() {
    const today  = new Date();
    const past   = new Date(today.getTime() - 45 * 24 * 60 * 60 * 1000);
    const fmt    = (d: Date) => d.toISOString().split('T')[0];
    return this._build(`${BASE_URL}/discover/movie`, {
      'primary_release_date.lte': fmt(today),
      'primary_release_date.gte': fmt(past),
      sort_by: 'popularity.desc',
      'vote_count.gte': 12
    });
  },
  get fetchCriticallyAcclaimedDrama() {
    return this.fetchByGenre('tv', 18, 'vote_average.desc'); // Let fetchByGenre handle it
  },
  get fetchFamiliarFavorites() {
    return this._build(`${BASE_URL}/discover/tv`, { sort_by: 'vote_count.desc', 'vote_count.gte': 800 });
  },
  get fetchImaginativeSeries() {
    return this.fetchByGenre('tv', 10765, 'popularity.desc');
  },
  fetchByCountryAndGenre(type: 'movie' | 'tv', country: string, genreIds: string) {
    return this._build(`${BASE_URL}/discover/${type}`, {
      with_genres: genreIds,
      with_origin_country: country,
      sort_by: 'popularity.desc',
      'vote_count.gte': 25
    });
  },
};

// ─── Re-exports from data/ modules ───────────────────────────────────────────
// All existing imports from 'constants' keep working — no component changes needed.

export type { MicroGenreEntry } from './data/genres';
export { MICRO_GENRES, DAY_STREAMS, GENRES } from './data/genres';

export { DISPLAY_LANGUAGES, SUBTITLE_LANGUAGES, LANG_LABELS, LANG_TO_OS } from './data/languages';

export { SUBTITLE_FONTS, SUBTITLE_COLORS, SUBTITLE_SIZES, SUBTITLE_EDGES, DEFAULT_SUBTITLE_SETTINGS } from './data/subtitles';

export type { Avatar, AvatarCategory } from './data/avatars';
export { AVATAR_CATEGORIES, ALL_AVATARS, DEFAULT_AVATAR } from './data/avatars';
