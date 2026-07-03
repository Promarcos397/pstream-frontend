import { create } from 'zustand';
import { supabase } from '../services/supabaseClient';
import { Movie } from '../types';
import { useAuthStore } from './useAuthStore';
import { isProfileScopingReady, getActiveProfileId } from './profileScope';

export interface UserRating {
  tmdbId: string;
  type: 'movie' | 'tv';
  rating: 'like' | 'dislike' | 'love';
  movieData?: Movie;
  updatedAt: number;
}

export interface UserListEntry {
  tmdbId: string;
  type: 'movie' | 'tv';
  movieData?: Movie;
  addedAt: number;
}

interface LibraryStore {
  ratings: Record<string, UserRating>;
  myList: Record<string, UserListEntry>;
  setRating: (tmdbId: string, type: 'movie' | 'tv', rating: 'like' | 'dislike' | 'love', movieData?: Movie) => void;
  removeRating: (tmdbId: string) => void;
  getRating: (tmdbId: string) => 'like' | 'dislike' | 'love' | undefined;
  toggleMyList: (movie: Movie) => void;
  isInList: (tmdbId: string) => boolean;
  getListArray: () => Movie[];
  clearLibrary: () => void;
  syncFromCloud: (cloudRatings: UserRating[], cloudList: UserListEntry[]) => void;
}

export const useLibraryStore = create<LibraryStore>()((set, get) => ({
  ratings: {},
  myList: {},

  setRating: (tmdbId, type, rating, movieData) => {
    const key = String(tmdbId);
    const updatedAt = Date.now();
    if (get().ratings[key]?.rating === rating) {
      get().removeRating(tmdbId);
      return;
    }
    set((state) => ({
      ratings: { ...state.ratings, [key]: { tmdbId, type, rating, movieData, updatedAt } }
    }));
    const user = useAuthStore.getState().user;
    if (user) {
      const migrated = isProfileScopingReady();
      const payload: Record<string, any> = {
        user_id: user.id,
        tmdb_id: key,
        type,
        rating,
        movie_data: movieData || null,
        updated_at: new Date(updatedAt).toISOString()
      };
      if (migrated) payload.profile_id = getActiveProfileId();

      supabase.from('user_ratings')
        .upsert(payload, { onConflict: migrated ? 'user_id,profile_id,tmdb_id' : 'user_id,tmdb_id' })
        .then(({ error }) => {
          if (error) console.error('[Sync] Rating sync error:', error.message);
        });
    }
  },

  removeRating: (tmdbId) => {
    const key = String(tmdbId);
    set((state) => {
      const next = { ...state.ratings };
      delete next[key];
      return { ratings: next };
    });
    const user = useAuthStore.getState().user;
    const profileId = getActiveProfileId();
    if (user) {
      let q = supabase.from('user_ratings').delete().eq('user_id', user.id).eq('tmdb_id', key);
      if (profileId) q = q.eq('profile_id', profileId);
      q.then();
    }
  },

  getRating: (tmdbId) => get().ratings[String(tmdbId)]?.rating,

  toggleMyList: (movie) => {
    const key = String(movie.id);
    const isPresent = !!get().myList[key];
    set((state) => {
      const next = { ...state.myList };
      if (isPresent) {
        delete next[key];
      } else {
        next[key] = { tmdbId: key, type: movie.name ? 'tv' : 'movie', movieData: movie, addedAt: Date.now() };
      }
      return { myList: next };
    });
    const user = useAuthStore.getState().user;
    if (user) {
      const profileId = getActiveProfileId();
      if (isPresent) {
        let q = supabase.from('user_list').delete().eq('user_id', user.id).eq('tmdb_id', key);
        if (profileId) q = q.eq('profile_id', profileId);
        q.then();
      } else {
        const migrated = isProfileScopingReady();
        const payload: Record<string, any> = {
          user_id: user.id,
          tmdb_id: key,
          type: movie.name ? 'tv' : 'movie',
          movie_data: movie,
          added_at: new Date().toISOString()
        };
        if (migrated) payload.profile_id = profileId;

        supabase.from('user_list')
          .upsert(payload, { onConflict: migrated ? 'user_id,profile_id,tmdb_id' : 'user_id,tmdb_id' })
          .then(({ error }) => {
            if (error) console.error('[Sync] List sync error:', error.message);
          });
      }
    }
  },

  isInList: (tmdbId) => !!get().myList[String(tmdbId)],

  getListArray: () => {
    return Object.values(get().myList)
      .sort((a, b) => b.addedAt - a.addedAt)
      .map(entry => entry.movieData)
      .filter(Boolean) as Movie[];
  },

  clearLibrary: () => set({ ratings: {}, myList: {} }),

  syncFromCloud: (cloudRatings, cloudList) => {
    set((state) => {
      const mergedRatings = { ...state.ratings };
      cloudRatings.forEach(cr => {
        const local = mergedRatings[cr.tmdbId];
        if (!local || cr.updatedAt > local.updatedAt) mergedRatings[cr.tmdbId] = cr;
      });
      const mergedList = { ...state.myList };
      cloudList.forEach(cl => {
        const local = mergedList[cl.tmdbId];
        if (!local || cl.addedAt > local.addedAt) mergedList[cl.tmdbId] = cl;
      });
      return { ratings: mergedRatings, myList: mergedList };
    });
  }
}));
