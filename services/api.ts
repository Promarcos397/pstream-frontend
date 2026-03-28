import axios from 'axios';
import { API_KEY, BASE_URL } from '../constants';
import { VideoResponse, TMDBResponse, VideoResult, StreamResult } from '../types';
import { streamCache } from '../utils/streamCache';

// Create API instance
const api = axios.create({
  baseURL: BASE_URL,
  params: {
    api_key: API_KEY,
  },
});

// Giga Engine Backend URL
const GIGA_BACKEND_URL = import.meta.env.VITE_GIGA_BACKEND_URL || (window.location.hostname === 'localhost' ? window.location.origin : 'https://ibrahimar397-pstream-giga.hf.space');

// Current language (defaults to en-US, updated from settings)
let currentLanguage = 'en-US';

// Set API language - call this when language setting changes
export const setApiLanguage = (language: string) => {
  currentLanguage = language;
};

// Interceptor to add language to all requests
api.interceptors.request.use((config) => {
  config.params = {
    ...config.params,
    language: currentLanguage,
  };
  return config;
});

export const getMovieVideos = async (id: number | string, type: 'movie' | 'tv') => {
  try {
    const response = await api.get<VideoResponse>(`/${type}/${id}/videos`);
    return response.data.results;
  } catch (error) {
    console.error(`Error fetching videos for ${type} ${id}:`, error);
    return [];
  }
};

export const getMovieImages = async (id: number | string, type: 'movie' | 'tv') => {
  try {
    const response = await api.get(`/${type}/${id}/images`, {
      params: { include_image_language: 'en,null' }
    });
    return response.data;
  } catch (error) {
    console.error(`Error fetching images for ${type} ${id}:`, error);
    return null;
  }
};

export const getMovieCredits = async (id: number | string, type: 'movie' | 'tv') => {
  try {
    const response = await api.get(`/${type}/${id}/credits`);
    return response.data.cast || [];
  } catch (error) {
    console.error(`Error fetching credits for ${type} ${id}:`, error);
    return [];
  }
};

export const getMovieDetails = async (id: number | string, type: 'movie' | 'tv') => {
  try {
    const response = await api.get(`/${type}/${id}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching details for ${type} ${id}:`, error);
    return null;
  }
};

export const getSeasonDetails = async (id: number | string, seasonNumber: number) => {
  try {
    const response = await api.get(`/tv/${id}/season/${seasonNumber}`);
    return response.data;  // Return full object with .episodes property
  } catch (error) {
    console.error(`Error fetching season ${seasonNumber} for tv ${id}:`, error);
    return null;
  }
};

export const getExternalIds = async (id: number | string, type: 'movie' | 'tv') => {
  try {
    const response = await api.get(`/${type}/${id}/external_ids`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching external IDs for ${type} ${id}:`, error);
    return null;
  }
};

export const getRecommendations = async (id: number | string, type: 'movie' | 'tv') => {
  try {
    const response = await api.get<TMDBResponse>(`/${type}/${id}/recommendations`);
    return response.data.results;
  } catch (error) {
    console.error(`Error fetching recommendations for ${type} ${id}:`, error);
    return [];
  }
};

export const searchMovies = async (query: string) => {
  try {
    const response = await api.get<TMDBResponse>('/search/multi', {
      params: {
        query,
        include_adult: false
      }
    });
    return response.data.results;
  } catch (error) {
    console.error("Search error", error);
    return [];
  }
};

// Generic fetcher that can handle full URLs (axios ignores baseURL if url is absolute)
export const fetchData = async (url: string) => {
  try {
    const response = await api.get<TMDBResponse>(url);
    return response.data.results;
  } catch (error) {
    console.error("Fetch error", error);
    return [];
  }
}

/**
 * Fetches a list of available YouTube videos for a given movie or TV show,
 * sorted by priority:
 * 1. Type: Trailer
 * 2. Type: Teaser
 * 3. Type: Clip
 * 4. Type: Featurette
 * 5. Other types
 * 
 * Returns an array of YouTube keys.
 */
export const fetchTrailers = async (id: number | string, type: 'movie' | 'tv'): Promise<string[]> => {
  try {
    const videos = await getMovieVideos(id, type);

    if (!videos || videos.length === 0) return [];

    // Filter for YouTube videos only
    const youtubeVideos = videos.filter(v => v.site === "YouTube");

    if (youtubeVideos.length === 0) return [];

    // Sort by priority
    const typePriority: { [key: string]: number } = {
      "Trailer": 1,
      "Teaser": 2,
      "Clip": 3,
      "Featurette": 4
    };

    const sortedVideos = youtubeVideos.sort((a, b) => {
      const priorityA = typePriority[a.type] || 99;
      const priorityB = typePriority[b.type] || 99;
      return priorityA - priorityB;
    });

    return sortedVideos.map(v => v.key);

  } catch (error) {
    console.error("Error in fetchTrailers:", error);
    return [];
  }
};

// Deprecated: Wraps fetchTrailers for backward compatibility (returns first result)
export const fetchTrailer = async (id: number | string, type: 'movie' | 'tv'): Promise<string | null> => {
  const trailers = await fetchTrailers(id, type);
  return trailers.length > 0 ? trailers[0] : null;
};

/**
 * Fetch a stream for a given movie or TV show.
 * Detects if it's running in Electron (using direct scraper) or Web (using server API).
 */
export const getStream = async (title: string, type: 'movie' | 'tv', year?: number, season: number = 1, episode: number = 1, tmdbId?: string, imdbId?: string) => {
  try {
    const params = new URLSearchParams({
      tmdbId: tmdbId || '',
      type,
      season: season.toString(),
      episode: episode.toString(),
      imdbId: imdbId || ''
    });
    
    console.log(`[GigaEngine] Requesting stream (Giga Backend)...`);
    const response = await axios.get(`${GIGA_BACKEND_URL}/api/stream?${params.toString()}`);
    return response.data;
  } catch (error: any) {
    console.error(`[GigaEngine] Ultimate resolution failure: ${error.message}`);
    throw error;
  }
};

// Prefetch stream (fire and forget, populates streamCache)
// Prefetch stream (fire and forget, populates streamCache)
export const prefetchStream = async (title: string, year: number | undefined, tmdbId: string, type: 'movie' | 'tv', season: number = 1, episode: number = 1, imdbId?: string) => {
  const cacheKey = { title, type, year, season, episode, tmdbId };
  if (streamCache.get(cacheKey)) return;

  setTimeout(async () => {
    try {
      console.log(`[Prefetch] Warming cache for: ${title} (${imdbId || 'no-imdb'})`);
      const result = await getStream(title, type, year, season, episode, tmdbId, imdbId);
      
      if (result && result.success && result.sources?.length > 0) {
        streamCache.set({ title, type, year, season, episode, tmdbId }, {
          sources: result.sources,
          subtitles: result.subtitles || [],
          provider: result.provider || 'prefetched'
        });
        console.log(`[Prefetch] ✅ Cache warmed for: ${title}`);
      }
    } catch (e) {
      // Ignore prefetch errors
    }
  }, 1000);
};

export default api;