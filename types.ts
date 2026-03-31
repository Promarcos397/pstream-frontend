
export interface Movie {
  id: number | string;
  title?: string;
  name?: string;
  poster_path?: string;
  backdrop_path?: string;
  image_url?: string; // For books/manga
  overview: string;
  vote_average: number;
  release_date?: string;
  first_air_date?: string;
  media_type?: 'movie' | 'tv' | 'person' | 'comic' | 'manga' | 'local' | 'cloud' | 'series' | string;
  genre_ids?: number[];
  adult?: boolean;
  original_language?: string;
  // For search results when media_type is 'person'
  known_for?: Movie[];
  // Detailed fields
  runtime?: number;
  number_of_seasons?: number;
  genres?: { id: number; name: string }[];
  imdb_id?: string;
  vote_count?: number;
  popularity?: number;
}

export interface Episode {
  id: number;
  name: string;
  overview: string;
  still_path?: string;
  episode_number: number;
  season_number: number;
  air_date: string;
  vote_average: number;
  runtime?: number;
}

export interface TMDBResponse {
  results: Movie[];
  page: number;
  total_results: number;
  total_pages: number;
}

export interface VideoResult {
  key: string;
  site: string;
  type: string;
  official?: boolean;
  id?: string;
  iso_639_1?: string;
  iso_3166_1?: string;
  name?: string;
  size?: number;
}

export interface VideoResponse {
  results: VideoResult[];
}

export interface RowProps {
  title: string;
  fetchUrl?: string;
  data?: Movie[];
  onSelect: (movie: Movie) => void;
  onPlay?: (movie: Movie) => void;
  isLargeRow?: boolean;
}

export interface AppSettings {
  autoplayPreviews: boolean;
  autoplayNextEpisode: boolean;
  showSubtitles: boolean;
  subtitleSize: 'tiny' | 'small' | 'medium' | 'large' | 'huge';
  subtitleColor: 'white' | 'yellow' | 'cyan' | 'green' | 'magenta' | 'red' | 'blue' | 'black';
  subtitleBackground: 'none' | 'box'; // Simplified: either no background or a box (window)
  subtitleOpacity: number; // 0 to 100
  subtitleBlur: number;    // 0 to 20

  // New Customizations
  subtitleFontFamily: 'sans-serif' | 'serif' | 'monospace' | 'cursive' | 'display' | 'typewriter' | 'print' | 'block' | 'casual' | 'small-caps' | string;
  subtitleEdgeStyle: 'none' | 'outline' | 'drop-shadow' | 'raised' | 'depressed' | 'uniform';
  subtitleWindowColor: 'black' | 'white' | 'blue';

  // Language Settings
  displayLanguage: string;  // TMDB content language (e.g., 'en-US', 'es-ES', 'fr-FR')
  subtitleLanguage: string; // Preferred subtitle language (e.g., 'en', 'es', 'fr')
  avatarUrl?: string;       // Custom profile avatar path
  displayName?: string;     // Custom profile display name
  isKidsMode?: boolean;     // Account-wide kids mode
}

// Streaming types
export interface StreamSource {
  url: string;
  quality: string;
  isM3U8: boolean;
  provider: string;
}

export interface StreamResult {
  sources: StreamSource[];
  subtitles: { url: string; lang: string }[];
  headers?: Record<string, string>;
  error?: string;
  referer?: string;
}

declare global {
  interface Window {
    reactNavigate?: (path: string | number) => void;
  }
}

