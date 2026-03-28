export const API_KEY = 'c477878444affbf19e4818802309df39';
export const BASE_URL = 'https://api.themoviedb.org/3';
export const IMG_PATH = 'https://image.tmdb.org/t/p/original';
export const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';
export const LOGO_SIZE = 'w500';

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
  get fetchTrending() { return `${BASE_URL}/trending/all/week?api_key=${API_KEY}&language=${getCurrentLanguage()}`; },
  get fetchNetflixOriginals() { return `${BASE_URL}/discover/tv?api_key=${API_KEY}&with_networks=213&language=${getCurrentLanguage()}`; },
  get fetchTopRated() { return `${BASE_URL}/movie/top_rated?api_key=${API_KEY}&language=${getCurrentLanguage()}`; },
  get fetchPopular() { return `${BASE_URL}/movie/popular?api_key=${API_KEY}&language=${getCurrentLanguage()}`; },
  get fetchActionMovies() { return `${BASE_URL}/discover/movie?api_key=${API_KEY}&with_genres=28&language=${getCurrentLanguage()}`; },
  get fetchComedyMovies() { return `${BASE_URL}/discover/movie?api_key=${API_KEY}&with_genres=35&language=${getCurrentLanguage()}`; },
  get fetchHorrorMovies() { return `${BASE_URL}/discover/movie?api_key=${API_KEY}&with_genres=27&language=${getCurrentLanguage()}`; },
  get fetchRomanceMovies() { return `${BASE_URL}/discover/movie?api_key=${API_KEY}&with_genres=10749&language=${getCurrentLanguage()}`; },
  get fetchDocumentaries() { return `${BASE_URL}/discover/movie?api_key=${API_KEY}&with_genres=99&language=${getCurrentLanguage()}`; },
  get fetchSciFiMovies() { return `${BASE_URL}/discover/movie?api_key=${API_KEY}&with_genres=878&language=${getCurrentLanguage()}`; },

  // Dynamic Genre Fetcher
  fetchByGenre(type: 'movie' | 'tv', genreId: number, sortBy = 'popularity.desc') {
    return `${BASE_URL}/discover/${type}?api_key=${API_KEY}&with_genres=${genreId}&sort_by=${sortBy}&vote_count.gte=100&language=${getCurrentLanguage()}`;
  },

  // TV Specifics
  get fetchActionTV() { return `${BASE_URL}/discover/tv?api_key=${API_KEY}&with_genres=10759&language=${getCurrentLanguage()}`; },
  get fetchComedyTV() { return `${BASE_URL}/discover/tv?api_key=${API_KEY}&with_genres=35&language=${getCurrentLanguage()}`; },
  get fetchDramaTV() { return `${BASE_URL}/discover/tv?api_key=${API_KEY}&with_genres=18&language=${getCurrentLanguage()}`; },
  get fetchCrimeTV() { return `${BASE_URL}/discover/tv?api_key=${API_KEY}&with_genres=80&language=${getCurrentLanguage()}`; },
  get fetchRealityTV() { return `${BASE_URL}/discover/tv?api_key=${API_KEY}&with_genres=10764&language=${getCurrentLanguage()}`; },

  // TV Themed specific rows
  get fetchBoredomBustersTV() { return `${BASE_URL}/discover/tv?api_key=${API_KEY}&with_genres=10759,80,10765&without_genres=16,10764&sort_by=popularity.desc&language=${getCurrentLanguage()}`; }, // Action, Crime, Sci-Fi (No Animation/Reality)
  get fetchUSSeries() { return `${BASE_URL}/discover/tv?api_key=${API_KEY}&with_origin_country=US&sort_by=popularity.desc&language=${getCurrentLanguage()}`; },
  get fetchFamiliarFavoritesTV() { return `${BASE_URL}/discover/tv?api_key=${API_KEY}&sort_by=vote_count.desc&language=${getCurrentLanguage()}`; },
  get fetchExcitingSeriesTV() { return `${BASE_URL}/discover/tv?api_key=${API_KEY}&with_genres=10759,10765&sort_by=popularity.desc&language=${getCurrentLanguage()}`; }, // Action & SciFi
  get fetchLoveTheseTV() { return `${BASE_URL}/discover/tv?api_key=${API_KEY}&sort_by=vote_average.desc&vote_count.gte=2000&language=${getCurrentLanguage()}`; },

  // Movie Themed specific rows
  get fetchBoredomBustersMovies() { return `${BASE_URL}/discover/movie?api_key=${API_KEY}&with_genres=28,12,53,878&without_genres=16&sort_by=popularity.desc&language=${getCurrentLanguage()}`; }, // Action, Adventure, Thriller, Sci-Fi
  get fetchFamiliarFavoritesMovies() { return `${BASE_URL}/discover/movie?api_key=${API_KEY}&sort_by=vote_count.desc&language=${getCurrentLanguage()}`; },
  get fetchExcitingMovies() { return `${BASE_URL}/discover/movie?api_key=${API_KEY}&with_genres=28,878,53&sort_by=popularity.desc&language=${getCurrentLanguage()}`; },
  get fetchLoveTheseMovies() { return `${BASE_URL}/discover/movie?api_key=${API_KEY}&sort_by=vote_average.desc&vote_count.gte=5000&language=${getCurrentLanguage()}`; },

  // New & Popular Specifics
  get fetchTrendingTV() { return `${BASE_URL}/trending/tv/day?api_key=${API_KEY}&language=${getCurrentLanguage()}`; },
  get fetchTrendingMovies() { return `${BASE_URL}/trending/movie/day?api_key=${API_KEY}&language=${getCurrentLanguage()}`; },
  get fetchUpcoming() { return `${BASE_URL}/movie/upcoming?api_key=${API_KEY}&language=${getCurrentLanguage()}&page=1`; },

  get searchMulti() { return `${BASE_URL}/search/multi?api_key=${API_KEY}&language=${getCurrentLanguage()}&include_adult=false`; },

  // --- Smart Algorithms & Personalization ---
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
    const today = new Date();
    const past = new Date(today.getTime() - (45 * 24 * 60 * 60 * 1000));
    const formatDate = (d: Date) => d.toISOString().split('T')[0];
    return `${BASE_URL}/discover/movie?api_key=${API_KEY}&primary_release_date.lte=${formatDate(today)}&primary_release_date.gte=${formatDate(past)}&sort_by=popularity.desc&vote_count.gte=50&language=${getCurrentLanguage()}`;
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

// Netflix-style Micro-Genre Library — catchy, specific titles paired with TMDB genre combos
export interface MicroGenreEntry {
  name: string;
  genres: string;
  type: 'movie' | 'tv';
  extra?: string; // additional query params like country filters
}

export const MICRO_GENRES: MicroGenreEntry[] = [
  // --- TV Micro-Genres ---
  { name: 'Exciting Criminal Investigation Drama Series', genres: '80,18', type: 'tv' },
  { name: 'Binge-worthy US TV Dramas', genres: '18', type: 'tv', extra: '&with_origin_country=US' },
  { name: 'US Crime Series', genres: '80', type: 'tv', extra: '&with_origin_country=US' },
  { name: 'Comedy Series', genres: '35', type: 'tv' },
  { name: 'Suspenseful Mystery Dramas', genres: '9648,18', type: 'tv' },
  { name: 'Imaginative Series', genres: '10765', type: 'tv' },
  { name: 'Critically Acclaimed Drama Series', genres: '18', type: 'tv', extra: '&vote_average.gte=8&vote_count.gte=1000' },
  { name: 'Witty Workplace Comedies', genres: '35', type: 'tv', extra: '&vote_average.gte=7' },
  { name: 'Thought-Provoking Sci-Fi Series', genres: '10765,18', type: 'tv' },
  { name: 'Heart-Pounding Action Series', genres: '10759', type: 'tv' },
  // --- Movie Micro-Genres ---
  { name: 'Crime Stories with a Romance Twist', genres: '80,10749', type: 'movie' },
  { name: 'Action-Packed Comedies', genres: '28,35', type: 'movie' },
  { name: 'Chilling Mysteries', genres: '27,9648', type: 'movie' },
  { name: 'Feel-Good Family Comedies', genres: '10751,35', type: 'movie' },
  { name: 'Fantasy Adventures', genres: '14,12', type: 'movie' },
  { name: 'Edge-of-your-seat Thrillers', genres: '53', type: 'movie', extra: '&vote_average.gte=7' },
  { name: 'Epic War Dramas', genres: '10752,18', type: 'movie' },
  { name: 'Mind-Bending Sci-Fi', genres: '878,9648', type: 'movie' },
  { name: 'Gritty Crime Dramas', genres: '80,18', type: 'movie' },
  { name: 'Heartfelt Romances', genres: '10749,18', type: 'movie' },
  { name: 'Laugh-Out-Loud Comedies', genres: '35', type: 'movie', extra: '&vote_average.gte=7&vote_count.gte=1000' },
  { name: 'Dark Scandinavian Thrillers', genres: '53,80', type: 'movie', extra: '&with_origin_country=SE|NO|DK|FI' },
];

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
  158: "Mystery",
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

// Language options for settings
export const DISPLAY_LANGUAGES = [
  { code: 'en-US', label: 'English (US)' },
  { code: 'en-GB', label: 'English (UK)' },
  { code: 'es-ES', label: 'Español (España)' },
  { code: 'es-MX', label: 'Español (México)' },
  { code: 'fr-FR', label: 'Français' },
  { code: 'de-DE', label: 'Deutsch' },
  { code: 'it-IT', label: 'Italiano' },
  { code: 'pt-BR', label: 'Português (Brasil)' },
  { code: 'pt-PT', label: 'Português (Portugal)' },
  { code: 'ja-JP', label: '日本語' },
  { code: 'ko-KR', label: '한국어' },
  { code: 'zh-CN', label: '中文 (简体)' },
  { code: 'zh-TW', label: '中文 (繁體)' },
  { code: 'ar-SA', label: 'العربية' },
  { code: 'hi-IN', label: 'हिन्दी' },
  { code: 'ru-RU', label: 'Русский' },
  { code: 'tr-TR', label: 'Türkçe' },
  { code: 'pl-PL', label: 'Polski' },
  { code: 'nl-NL', label: 'Nederlands' },
  { code: 'sv-SE', label: 'Svenska' },
];

export const SUBTITLE_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'it', label: 'Italiano' },
  { code: 'pt', label: 'Português' },
  { code: 'ja', label: '日本語' },
  { code: 'ko', label: '한국어' },
  { code: 'zh', label: '中文' },
  { code: 'ar', label: 'العربية' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'ru', label: 'Русский' },
  { code: 'tr', label: 'Türkçe' },
  { code: 'pl', label: 'Polski' },
  { code: 'nl', label: 'Nederlands' },
];
export interface Avatar {
  name: string;
  url: string;
}

export interface AvatarCategory {
  id: string;
  name: string;
  avatars: Avatar[];
}

const getDriveUrl = (id: string) => `https://lh3.googleusercontent.com/d/${id}`;

export const AVATAR_CATEGORIES: AvatarCategory[] = [
  {
    id: 'bridgerton',
    name: 'Bridgerton',
    avatars: [
      { name: 'Anthony Bridgerton', url: getDriveUrl('1KzRtMnyHwlJYwjr09S3UjhLtEg51W-Lr') },
      { name: 'Benedict Bridgerton', url: getDriveUrl('1YlWDXxAhiKlc6r641vEVqTqFsXobC__-') },
      { name: 'Colin Bridgerton', url: getDriveUrl('1ay24h5pSUfQ339nf1yvYtuMVLsY-L_r5') },
      { name: 'Daphne Basset', url: getDriveUrl('1iloFbK5eBE0JwAYsyEyZEYMahIaWLiZL') },
      { name: 'Eloise Bridgerton', url: getDriveUrl('1eNNCBDTROwaoishIx9_fkx8YFucs12NE') },
      { name: 'Francesca Bridgerton', url: getDriveUrl('1Ocb11OmSHJlRfzT6w97e_yuCp0B1X3EC') },
      { name: 'Kathani Bridgerton', url: getDriveUrl('1QgeRATcBSnH8prA5S3Hqnxm3VwB7YB9G') },
      { name: 'Lady Danbury', url: getDriveUrl('1qOo2XsRjVZsZQWUdLUJpHwuGEBRYlPQX') },
      { name: 'Penelope Featherington', url: getDriveUrl('1Z__4y8VugluuVFwRdqG6eKaxwuy5rzc6') },
      { name: 'Queen Charlotte', url: getDriveUrl('1Bvp9-Q7K6KqKxxxOz4l75ksVsJ4NhYmR') },
      { name: 'Simon Basset', url: getDriveUrl('1bMUWIh4lqfpSrf5ifpdZ29GKC-gFCtJH') },
      { name: 'Sophie Baek', url: getDriveUrl('1PVt6TyXP55YMM9c5tJNXev9Lsw1mDBlF') },
      { name: 'Violet Bridgerton', url: getDriveUrl('1CIWh6dWbYek4Z7tLQVXkHEzBdN54xVFu') },
    ]
  },
  {
    id: 'one-piece',
    name: 'One Piece',
    avatars: [
      { name: 'Monkey D. Luffy', url: getDriveUrl('1CCWWd9W3ODzxAn1lJ6TsKRYyAxdLxeq8') },
      { name: 'Zoro', url: getDriveUrl('1HqM0dZKFN99eJw015CWCeZxpqix3EgT0') },
      { name: 'Nami', url: getDriveUrl('1zqX1Q-0BIrG0taII5kqsL_zRNt1oVYE6') },
      { name: 'Sanji', url: getDriveUrl('1ZL2FXFwrOjAiHuOXZ0SUu2gXZy3Jw3ts') },
      { name: 'Chopper', url: getDriveUrl('1yZOQdzM_MPyWOpMgjqfd0S73KIoDAjLl') },
      { name: 'Usopp', url: getDriveUrl('1T63TmoapNx9DLbTrOUWtu93XpqZkhQM5') },
      { name: 'Arlong', url: getDriveUrl('1bUqGSDkhtgw1FtXZJqD5flQ-AMYjrBxa') },
      { name: 'Alvida', url: getDriveUrl('1kRyzph--pyxtTGjEU35nt1GDPz70fMrU') },
      { name: 'Shanks', url: getDriveUrl('1Sr0hpD0rTFJyyBbCWoKC0x6oD-rke-pU') },
      { name: 'Going Merry', url: getDriveUrl('1my31WNqaaUo5v34oK08r_3o30Yvc6GAf') },
      { name: 'Jolly Roger', url: getDriveUrl('18n1qSVxKIFQwX308WEsHC78-SlnSTRBu') },
    ]
  },
  {
    id: 'peaky-blinders',
    name: 'Peaky Blinders',
    avatars: [
      { name: 'Tommy Shelby', url: getDriveUrl('1wW1ox6Uc1g368rqZ5CAphVSH84KW711n') },
      { name: 'Duke', url: getDriveUrl('1lv3S6zkHP2cj7x1_z1Xas6cwN86bsrb-') },
      { name: 'Hayden Stagg', url: getDriveUrl('1abCdQHYZ4A6thk6WvT0LMs7fgNVoXo1b') },
      { name: 'John Beckett', url: getDriveUrl('1fMP16GVuLI_YE58zqgzokzrTrhCoN3cW') },
      { name: 'Kaulo Chiriklo', url: getDriveUrl('1e1jV3_MfCKrv25cEy-y14HxVD3ChdJtT') },
    ]
  },
  {
    id: 'lucifer',
    name: 'Lucifer',
    avatars: [
      { name: 'Lucifer Morningstar', url: getDriveUrl('1vuBOiPd9DknqbZpUXgMUEAUwZiGee52g') },
      { name: 'Chloe Decker', url: getDriveUrl('1KtbqNziC8SxPDUJfMS2NGKhoaKaPUdos') },
      { name: 'Mazikeen', url: getDriveUrl('1hygVLyg-7PsCkE1fdRByTje4OmgE7773') },
      { name: 'Amenadiel', url: getDriveUrl('1dfWobx2-vWsArr2lQeZ_guWI2ZPvMQNo') },
    ]
  },
  {
    id: 'classics',
    name: 'P-Stream Classics',
    avatars: [
      { name: 'Blue Fluffball', url: getDriveUrl('1i3UrprAcfhKSNaSwFE1FXwTD6NXOfjaV') },
      { name: 'Gray Fluffball', url: getDriveUrl('1gKlTO0SLMJzk0RUqihW7n4ovugEZj9Jf') },
      { name: 'Orange Fluffball', url: getDriveUrl('1I-MhzW-S8sQkJ72QOKQelNHnas41VWkn') },
      { name: 'Bubblegum Princess', url: getDriveUrl('1ltTBpxXy_QxWDIJyyJHSYtwRemSb_fYb') },
      { name: 'Green Alien', url: getDriveUrl('1_shb0mnchPaWk-F9anvInjBBRbGXJF7Z') },
      { name: 'Panda Face', url: getDriveUrl('1MOcMHPqN0hFbkpoqjdirZl4jgI5VFVqo') },
      { name: 'Red Anger', url: getDriveUrl('198aosLkzeCyglhaKy5vPMeWktSJhFui_') },
      { name: 'Yellow Chicken', url: getDriveUrl('1ZYyoo8gUHeugXIa5ciA6pJySe3OPdkNB') },
    ]
  }
];

// Keep single list for easy lookup/defaults
export const ALL_AVATARS = AVATAR_CATEGORIES.flatMap(c => c.avatars.map(a => a.url));
export const DEFAULT_AVATAR = ALL_AVATARS[0];
