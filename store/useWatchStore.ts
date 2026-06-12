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
  providerIndex?: number; // which embed provider was active (for resume)
  movieData?: Movie; // Cached metadata
  updatedAt: number; // Unix timestamp for merging
}

interface WatchStore {
  history: Record<string, WatchProgress>;
  
  // Actions
  updateProgress: (progress: Omit<WatchProgress, 'updatedAt' | 'percentage'>, forceSyncImmediate?: boolean) => void;
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

      updateProgress: (data, forceSyncImmediate) => {
        // For embeds with unknown duration (duration=0), use elapsed-based fallback
        // so continue-watching still shows the item. Mark as 5% after 30s of watching.
        const percentage = data.duration > 0
            ? (data.watchedTime / data.duration) * 100
            : data.watchedTime > 30 ? 5 : 0;
        const updatedAt = Date.now();
        const key = data.type === 'tv' ? `${data.tmdbId}-S${data.season}E${data.episode}` : data.tmdbId;
        
        // Preserve movieData if not provided
        const existing = get().history[key];
        let movieData = data.movieData || existing?.movieData;
        
        // Auto-heal/lookup movieData from other entries of the same show/movie if missing
        if (!movieData) {
          const matchingEntry = Object.values(get().history).find(
            h => h.tmdbId === String(data.tmdbId) && h.movieData
          );
          if (matchingEntry) {
            movieData = matchingEntry.movieData;
          }
        }
        
        const newEntry: WatchProgress = { ...data, percentage, updatedAt, movieData };
        
        set((state) => {
          const nextHistory = { ...state.history, [key]: newEntry };
          
          // If we have movieData, propagate it to all other episodes of the same show
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
                movie_data: movieData || null,
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
        };

        // Debounce cloud sync slightly to avoid spam unless forced
        if ((window as any)._syncTimer) clearTimeout((window as any)._syncTimer);
        
        if (forceSyncImmediate) {
          syncToCloud();
        } else {
          (window as any)._syncTimer = setTimeout(syncToCloud, 3000);
        }
      },

      getProgress: (tmdbId, season, episode) => {
        if (season !== undefined && episode !== undefined) {
          const key = `${tmdbId}-S${season}E${episode}`;
          return get().history[key];
        }
        // Fallback for TV show if no season/episode: find the most recently updated episode entry
        const entries = Object.values(get().history).filter(
          h => h.tmdbId === String(tmdbId)
        );
        if (entries.length === 0) return undefined;
        return entries.sort((a, b) => b.updatedAt - a.updatedAt)[0];
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
          
          // First, merge cloud items
          cloudHistory.forEach(cloudItem => {
            const key = cloudItem.type === 'tv' ? `${cloudItem.tmdbId}-S${cloudItem.season}E${cloudItem.episode}` : cloudItem.tmdbId;
            const localItem = merged[key];
            if (!localItem || cloudItem.updatedAt > localItem.updatedAt) {
              merged[key] = {
                ...cloudItem,
                movieData: cloudItem.movieData || localItem?.movieData
              };
            }
          });

          // Second, propagate movieData to all entries sharing the same tmdbId
          const tmdbIdToMovieData: Record<string, Movie> = {};
          Object.values(merged).forEach(item => {
            if (item.tmdbId && item.movieData) {
              tmdbIdToMovieData[String(item.tmdbId)] = item.movieData;
            }
          });

          Object.keys(merged).forEach(key => {
            const item = merged[key];
            if (item.tmdbId && !item.movieData && tmdbIdToMovieData[String(item.tmdbId)]) {
              merged[key] = {
                ...item,
                movieData: tmdbIdToMovieData[String(item.tmdbId)]
              };
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