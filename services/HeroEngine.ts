import axios from 'axios';
import { REQUESTS } from '../constants';
import { Movie, TMDBResponse } from '../types';
import { getMovieVideos, getMovieImages, getExternalIds, prefetchStream, getMovieDetails } from './api';
import { searchTrailersWithFallback } from './YouTubeService';

/**
 * HeroEngine manages the "Chosen One" selection logic for all pages.
 * It's to be initialized once and stores the locked hero movies for the day.
 */

export interface HeroPackage {
  movie: Movie;
  videoId?: string;
  logoUrl?: string;
  isReady: boolean;
  pageType: string;
}

class HeroEngineService {
  private lockedHeroes: Map<string, HeroPackage> = new Map();
  private listeners: Set<(pageType: string, hero: HeroPackage) => void> = new Set();
  private isInitializing: Set<string> = new Set();

  /** Determines daily selection index based on date, page type, and genre */
  private getDailyIndex(results: Movie[], pageType: string, genreId?: number): number {
    const seed = new Date().toDateString() + "_" + pageType + (genreId ? "_" + genreId : "");
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = ((hash << 5) - hash) + seed.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash) % results.length;
  }

  /** Gets the hero package for a specific flow (home, tv, movies) */
  async getHero(pageType: string, fetchUrl?: string, genreId?: number): Promise<HeroPackage | null> {
    const cacheKey = genreId ? `${pageType}_${genreId}` : pageType;

    // Return from cache if exists
    if (this.lockedHeroes.has(cacheKey)) {
      return this.lockedHeroes.get(cacheKey)!;
    }

    // Prevent double-initialization
    if (this.isInitializing.has(cacheKey)) {
      return null;
    }

    this.isInitializing.add(cacheKey);
    console.log(`[HeroEngine] Selecting 'Daily Featured Content' for ${cacheKey}...`);

    try {
      let url = fetchUrl;
      // Decouple independent Hero hits from generic rows if no Genre is picked.
      if (!genreId) {
         if (pageType === 'tv') {
            url = REQUESTS.fetchTrendingTV;
         } else if (pageType === 'movie') {
            url = REQUESTS.fetchTrendingMovies;
         } else if (pageType === 'home') {
            // Home randomly picks between Masterpiece TV or Masterpiece Movie daily
            const hash = this.getDailyIndex([], 'home-pick', 0);
            url = hash % 2 === 0 ? REQUESTS.fetchAwardWinningSeries : REQUESTS.fetchLoveTheseMovies;
         }
      }
      if (!url) { url = REQUESTS.fetchTrending; }

      const response = await axios.get<TMDBResponse>(url);
      const results = (response.data.results || []).filter(m => m.backdrop_path);

      if (results.length === 0) throw new Error('No valid hero results');

      const index = this.getDailyIndex(results, pageType, genreId);
      const selectedMovie = results[index];
      const mediaType = (selectedMovie.media_type || (selectedMovie.title ? 'movie' : 'tv')) as 'movie' | 'tv';

      // --- Magic Omni-Fetch ---
      const [videos, images, externals, details] = await Promise.all([
        getMovieVideos(selectedMovie.id, mediaType),
        getMovieImages(selectedMovie.id, mediaType),
        getExternalIds(selectedMovie.id, mediaType),
        getMovieDetails(selectedMovie.id, mediaType) 
      ]);

      const logo = images?.logos?.find((l: any) => l.iso_639_1 === 'en' || l.iso_639_1 === null);
      const logoUrl = logo ? `https://image.tmdb.org/t/p/w500${logo.file_path}` : undefined;
      
      const movieWithExtras = { ...selectedMovie, imdb_id: externals?.imdb_id };

      // USER REQUEST: Ignore TMDB's generic trailers and fetch a precision custom one: 
      // [Production company name + media title + release year + official trailer]
      const title = movieWithExtras.title || movieWithExtras.name || '';
      const releaseDate = movieWithExtras.release_date || movieWithExtras.first_air_date;
      const year = releaseDate ? new Date(releaseDate).getFullYear().toString() : undefined;
      const company = details?.production_companies?.[0]?.name;

      let finalVideoId: string | undefined = undefined;
      try {
          const customTrailers = await searchTrailersWithFallback({
              title,
              year,
              company,
              type: mediaType
          }, 1);
          finalVideoId = customTrailers[0];
      } catch (e) {
          console.warn(`[HeroEngine] Custom trailer search failed for ${title}`, e);
      }

      const heroPackage: HeroPackage = {
        movie: movieWithExtras,
        videoId: finalVideoId,
        logoUrl,
        isReady: true,
        pageType
      };

      this.lockedHeroes.set(cacheKey, heroPackage);
      this.isInitializing.delete(cacheKey);
      
      // Trigger listeners
      this.listeners.forEach(cb => cb(pageType, heroPackage));

      // High precision prefetch
      const rd = movieWithExtras.release_date || movieWithExtras.first_air_date;
      prefetchStream(
        movieWithExtras.title || movieWithExtras.name || '',
        rd ? new Date(rd).getFullYear() : undefined,
        String(movieWithExtras.id),
        mediaType,
        1, 1,
        movieWithExtras.imdb_id
      );

      return heroPackage;
    } catch (e) {
      console.error(`[HeroEngine] Magic failed for ${cacheKey}:`, e);
      this.isInitializing.delete(cacheKey);
      return null;
    }
  }

  /** Warm up: Pre-fetch heroes for all essential categories so they're instant on tab switch */
  async prepareAllHeroes() {
    console.log("[HeroEngine] Warming up engines...");
    const genres = [undefined, 28, 35]; // Action, Comedy, etc.
    const pages = ['home', 'movie', 'tv'];
    
    // Low priority batch
    pages.forEach(p => {
      this.getHero(p);
    });
  }

  subscribe(callback: (pageType: string, hero: HeroPackage) => void) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  getCachedHero(pageType: string): HeroPackage | undefined {
    return this.lockedHeroes.get(pageType);
  }
}

export const HeroEngine = new HeroEngineService();
