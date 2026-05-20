import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../services/supabaseClient';
import { Movie } from '../types';

export interface WatchProgress {
  tmdbId: string;
  type: 'movie' | 'tv';
  season?: number;
  episode?: number;
  watchedTime: number; // in seconds
  duration: number; // in seconds
  percentage: number; // 0 to 100
  movieData?: Movie; // Cached metadata
  updatedAt: number; // Unix timestamp for merging
}

interface WatchStore {
  history: Record<string, WatchProgress>;
  
  // Actions
  updateProgress: (progress: Omit<WatchProgress, 'updatedAt' | 'percentage'>) => void;
  getProgress: (tmdbId: string, season?: number, episode?: number) => WatchProgress | undefined;
  getHistoryList: () => WatchProgress[];
  removeHistoryItem: (tmdbId: string, season?: number, episode?: number) => void;
  clearHistory: () => void;
  syncFromCloud: (cloudHistory: WatchProgress[]) => void;
}

export const useWatchStore = create<WatchStore>()(
  persist(
    (set, get) => ({
      history: {},

      updateProgress: (data) => {
        const percentage = data.duration > 0 ? (data.watchedTime / data.duration) * 100 : 0;
        const updatedAt = Date.now();
        const key = data.type === 'tv' ? `${data.tmdbId}-S${data.season}E${data.episode}` : data.tmdbId;
        
        const newEntry: WatchProgress = { ...data, percentage, updatedAt };
        
        set((state) => ({
          history: { ...state.history, [key]: newEntry }
        }));

        // Debounce cloud sync slightly to avoid spam
        if ((window as any)._syncTimer) clearTimeout((window as any)._syncTimer);
        (window as any)._syncTimer = setTimeout(() => {
          supabase.auth.getSession().then(({ data: sessionData }) => {
            if (sessionData.session?.user) {
              const dbPayload = {
                user_id: sessionData.session.user.id,
                tmdb_id: String(data.tmdbId),
                type: data.type,
                season: data.season || null,
                episode: data.episode || null,
                watched_time: data.watchedTime,
                duration: data.duration,
                percentage: percentage,
                movie_data: data.movieData || null,
                updated_at: new Date(updatedAt).toISOString()
              };

              // Use upsert to handle conflict on (user_id, tmdb_id, season, episode)
              supabase.from('watch_history')
                .upsert(dbPayload, { onConflict: 'user_id,tmdb_id,season,episode' })
                .then(({ error }) => {
                  if (error) console.error('[Sync] Watch history sync error:', error.message);
                });
            }
          });
        }, 3000);
      },

      getProgress: (tmdbId, season, episode) => {
        const key = season && episode ? `${tmdbId}-S${season}E${episode}` : String(tmdbId);
        return get().history[key];
      },

      getHistoryList: () => {
        // Return sorted by most recently watched
        return Object.values(get().history).sort((a, b) => b.updatedAt - a.updatedAt);
      },

      removeHistoryItem: (tmdbId, season, episode) => {
        const key = season && episode ? `${tmdbId}-S${season}E${episode}` : String(tmdbId);
        set((state) => {
          const next = { ...state.history };
          delete next[key];
          return { history: next };
        });

        supabase.auth.getSession().then(({ data: sessionData }) => {
          if (sessionData.session?.user) {
            let query = supabase.from('watch_history')
              .delete()
              .eq('user_id', sessionData.session.user.id)
              .eq('tmdb_id', String(tmdbId));
            
            if (season && episode) {
              query = query.eq('season', season).eq('episode', episode);
            } else {
              query = query.is('season', null).is('episode', null);
            }
            query.then();
          }
        });
      },

      clearHistory: () => {
        set({ history: {} });
        // NOTE: Cloud clearing handled separately if needed, but usually just local logout.
      },

      syncFromCloud: (cloudHistory) => {
        set((state) => {
          const merged = { ...state.history };
          cloudHistory.forEach(cloudItem => {
            const key = cloudItem.type === 'tv' ? `${cloudItem.tmdbId}-S${cloudItem.season}E${cloudItem.episode}` : cloudItem.tmdbId;
            const localItem = merged[key];
            if (!localItem || cloudItem.updatedAt > localItem.updatedAt) {
              merged[key] = cloudItem;
            }
          });
          return { history: merged };
        });
      }
    }),
    {
      name: 'pstream-watch-store',
    }
  )
);
