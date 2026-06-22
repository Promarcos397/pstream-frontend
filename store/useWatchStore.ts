import { create } from 'zustand';
import { supabase } from '../services/supabaseClient';
import { Movie } from '../types';
import { useAuthStore } from './useAuthStore';

export interface WatchProgress {
  tmdbId: string;
  type: 'movie' | 'tv';
  season?: number;
  episode?: number;
  watchedTime: number;
  duration: number;
  percentage: number;
  providerIndex?: number;
  movieData?: Movie;
  updatedAt: number;
}

interface WatchStore {
  history: Record<string, WatchProgress>;
  updateProgress: (progress: Omit<WatchProgress, 'updatedAt' | 'percentage'>, forceSyncImmediate?: boolean) => void;
  getProgress: (tmdbId: string, season?: number, episode?: number) => WatchProgress | undefined;
  getHistoryList: () => WatchProgress[];
  removeHistoryItem: (tmdbId: string, season?: number, episode?: number) => void;
  clearHistory: () => void;
  syncFromCloud: (cloudHistory: WatchProgress[]) => void;
}

export const useWatchStore = create<WatchStore>()((set, get) => ({
  history: {},

  updateProgress: (data, forceSyncImmediate) => {
    const percentage = data.duration > 0
      ? (data.watchedTime / data.duration) * 100
      : data.watchedTime > 30 ? 5 : 0;
    const updatedAt = Date.now();
    const key = data.type === 'tv' ? `${data.tmdbId}-S${data.season}E${data.episode}` : data.tmdbId;

    const existing = get().history[key];
    let movieData = data.movieData || existing?.movieData;
    if (!movieData) {
      const matchingEntry = Object.values(get().history).find(
        h => h.tmdbId === String(data.tmdbId) && h.movieData
      );
      if (matchingEntry) movieData = matchingEntry.movieData;
    }

    const newEntry: WatchProgress = { ...data, percentage, updatedAt, movieData };

    set((state) => {
      const nextHistory = { ...state.history, [key]: newEntry };
      if (movieData) {
        Object.keys(nextHistory).forEach(k => {
          if (nextHistory[k].tmdbId === String(data.tmdbId) && !nextHistory[k].movieData) {
            nextHistory[k] = { ...nextHistory[k], movieData };
          }
        });
      }
      return { history: nextHistory };
    });

    const syncToCloud = () => {
      const user = useAuthStore.getState().user;
      if (user) {
        supabase.from('watch_history')
          .upsert({
            user_id: user.id,
            tmdb_id: String(data.tmdbId),
            type: data.type,
            season: data.season || null,
            episode: data.episode || null,
            watched_time: data.watchedTime,
            duration: data.duration,
            percentage,
            movie_data: movieData || null,
            updated_at: new Date(updatedAt).toISOString()
          }, { onConflict: 'user_id,tmdb_id,season,episode' })
          .then(({ error }) => {
            if (error) console.error('[Sync] Watch history sync error:', error.message);
          });
      }
    };

    if (!(window as any)._syncTimers) (window as any)._syncTimers = {};
    if ((window as any)._syncTimers[key]) {
      clearTimeout((window as any)._syncTimers[key]);
      delete (window as any)._syncTimers[key];
    }
    if (forceSyncImmediate) {
      syncToCloud();
    } else {
      (window as any)._syncTimers[key] = setTimeout(() => {
        syncToCloud();
        delete (window as any)._syncTimers[key];
      }, 3000);
    }
  },

  getProgress: (tmdbId, season, episode) => {
    if (season !== undefined && episode !== undefined) {
      return get().history[`${tmdbId}-S${season}E${episode}`];
    }
    const entries = Object.values(get().history).filter(h => h.tmdbId === String(tmdbId));
    if (entries.length === 0) return undefined;
    return entries.sort((a, b) => b.updatedAt - a.updatedAt)[0];
  },

  getHistoryList: () => {
    return Object.values(get().history).sort((a, b) => b.updatedAt - a.updatedAt);
  },

  removeHistoryItem: (tmdbId, season, episode) => {
    if ((window as any)._syncTimers) {
      if (season && episode) {
        const key = `${tmdbId}-S${season}E${episode}`;
        if ((window as any)._syncTimers[key]) {
          clearTimeout((window as any)._syncTimers[key]);
          delete (window as any)._syncTimers[key];
        }
      } else {
        Object.keys((window as any)._syncTimers).forEach(key => {
          if (key === String(tmdbId) || key.startsWith(`${tmdbId}-`)) {
            clearTimeout((window as any)._syncTimers[key]);
            delete (window as any)._syncTimers[key];
          }
        });
      }
    }

    set((state) => {
      const next = { ...state.history };
      if (season && episode) {
        delete next[`${tmdbId}-S${season}E${episode}`];
      } else {
        Object.keys(next).forEach(k => {
          if (next[k].tmdbId === String(tmdbId)) delete next[k];
        });
      }
      return { history: next };
    });

    const user = useAuthStore.getState().user;
    if (user) {
      let query = supabase.from('watch_history')
        .delete()
        .eq('user_id', user.id)
        .eq('tmdb_id', String(tmdbId));
      if (season && episode) query = query.eq('season', season).eq('episode', episode);
      query.then();
    }
  },

  clearHistory: () => {
    set({ history: {} });
  },

  syncFromCloud: (cloudHistory) => {
    set((state) => {
      const merged = { ...state.history };
      cloudHistory.forEach(cloudItem => {
        const key = cloudItem.type === 'tv'
          ? `${cloudItem.tmdbId}-S${cloudItem.season}E${cloudItem.episode}`
          : cloudItem.tmdbId;
        const localItem = merged[key];
        if (!localItem || cloudItem.updatedAt > localItem.updatedAt) {
          merged[key] = { ...cloudItem, movieData: cloudItem.movieData || localItem?.movieData };
        }
      });

      // Propagate movieData across entries for the same show
      const tmdbIdToMovieData: Record<string, Movie> = {};
      Object.values(merged).forEach(item => {
        if (item.tmdbId && item.movieData) tmdbIdToMovieData[String(item.tmdbId)] = item.movieData;
      });
      Object.keys(merged).forEach(key => {
        const item = merged[key];
        if (item.tmdbId && !item.movieData && tmdbIdToMovieData[String(item.tmdbId)]) {
          merged[key] = { ...item, movieData: tmdbIdToMovieData[String(item.tmdbId)] };
        }
      });

      return { history: merged };
    });
  }
}));
