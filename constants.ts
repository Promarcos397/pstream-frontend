export const API_KEY = 'fc5fec3b73d8605daaeb1eb3b91157eb';
export const BASE_URL = 'https://api.themoviedb.org/3';
export const IMG_PATH = 'https://image.tmdb.org/t/p/original';
export const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';
export const LOGO_SIZE = 'w780'; // Higher resolution for professional display popping

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
  // --- The "Offbeat" Pouch ---
  { name: 'Offbeat Series', genres: '35,189', type: 'tv', extra: '&with_keywords=9715|10631&page=2' },
  { name: 'K-Drama for Beginners', genres: '18', type: 'tv', extra: '&with_origin_country=KR&with_keywords=Romance' },
  { name: 'Wit-Filled Comedies', genres: '35', type: 'tv', extra: '&vote_average.gte=7.5&page=1' },
  { name: 'Gritty Crime Procedurals', genres: '80', type: 'tv', extra: '&with_keywords=9883&page=3' }, // Starts on page 3 to hide "Bones"
  { name: 'Heart-Pounding Action', genres: '10759', type: 'tv', extra: '&vote_count.gte=5000' },
  { name: 'Small Town Mysteries', genres: '9648', type: 'tv', extra: '&with_keywords=small town' },
  { name: 'Thought-Provoking Sci-Fi', genres: '10765,18', type: 'tv', extra: '&vote_average.gte=7' },

  // --- The "Era" Pouch (Discovery) ---
  { name: 'The Vault: 90s Classics', genres: '18,35', type: 'tv', extra: '&first_air_date.gte=1990-01-01&first_air_date.lte=1999-12-31' },
  { name: 'Essential Classics', genres: '18,36', type: 'movie', extra: '&primary_release_date.lte=1980-01-01&vote_average.gte=8' },
  { name: 'Nostalgic 2000s Hits', genres: '18,35', type: 'tv', extra: '&first_air_date.gte=2000-01-01&first_air_date.lte=2009-12-31' },

  // --- The "Vibe" Pouch (Psychographic) ---
  { name: 'Edge-of-Your-Seat Thrills', genres: '53', type: 'movie', extra: '&vote_count.gte=10000' },
  { name: 'Quick Watches', genres: '35,18', type: 'tv', extra: '&with_runtime.lte=30&without_genres=16' }, // Adult short series
  { name: 'Animated Staples', genres: '16', type: 'tv', extra: '&with_runtime.lte=30' }, // Dedicated animation
  { name: 'Epic Sagas & Legacies', type: 'tv', genres: '10765,12', extra: '&vote_count.gte=3000' },
  { name: 'Stories That Spark Conversation', genres: '18,99', type: 'tv', extra: '&vote_average.gte=8&page=2' },
  
  // --- The "Deep discovery" Pouch (Page 3+ offsets) ---
  { name: 'Unmissable Hidden Gems', genres: '18,53', type: 'movie', extra: '&vote_average.gte=7.5&page=4' },
  { name: 'International Breakout Hits', type: 'tv', genres: '18', extra: '&without_origin_country=US&vote_average.gte=7.8' },
  { name: 'Indie Favorites', type: 'movie', genres: '18', extra: '&vote_count.lte=2000&vote_average.gte=7.5&page=3' },
  
  // --- The "Temporal" Pouch (Mood-based) ---
  { name: 'Sunday Night Wind-Down', genres: '35', type: 'tv', extra: '&vote_average.gte=7&page=2' },
  { name: 'Friday Night Blockbusters', genres: '28,12', type: 'movie', extra: '&vote_count.gte=15000' },
  { name: 'Late Night Chill', genres: '35,10749', type: 'movie', extra: '&with_runtime.lte=100' },

  // Add more dynamic chocolates...
  { name: 'Visually Stunning Worlds', genres: '10765,14', type: 'movie', extra: '&vote_count.gte=5000&page=2' },
  { name: 'High-Stakes Heists', genres: '80,53', type: 'movie', extra: '&with_keywords=heist|bank heist' },
  { name: 'Cyberpunk & Dystopia', genres: '878', type: 'movie', extra: '&with_keywords=cyberpunk|dystopia' },
  { name: 'Political Mind Games', genres: '10768,18', type: 'tv', extra: '&vote_average.gte=7.5' },
  { name: 'Supernatural Encounters', genres: '10765,27', type: 'tv', extra: '&with_keywords=supernatural|paranormal' },
  { name: 'Mind-Bending Realities', genres: '9648,878', type: 'movie', extra: '&with_keywords=mind bending|time travel' },
  { name: 'True Stories & Docuseries', genres: '99,80', type: 'tv', extra: '&vote_average.gte=7' },
  { name: 'Based on Real Life', genres: '18,36', type: 'movie', extra: '&with_keywords=based on true story' }
];

/** Day of the week themed streams - The "Special Pouch" */
export const DAY_STREAMS: Record<string, MicroGenreEntry> = {
  'Monday': { name: 'Monday Motivation', genres: '18', type: 'movie', extra: '&vote_average.gte=7' },
  'Tuesday': { name: 'Tuesday True Crime', genres: '99,80', type: 'tv' },
  'Wednesday': { name: 'Wednesday Warp', genres: '10765,878', type: 'tv' },
  'Thursday': { name: 'Throwback Thursday', genres: '18,35', type: 'movie', extra: '&primary_release_date.lte=2000-01-01' },
  'Friday': { name: 'Friday Night Hits', genres: '28,12', type: 'movie', extra: '&vote_count.gte=10000' },
  'Saturday': { name: 'Saturday Family Night', genres: '16,10751', type: 'movie' },
  'Sunday': { name: 'Sunday Binge-worthy Series', genres: '18,80', type: 'tv', extra: '&vote_count.gte=5000&page=2' },
};

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
