import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Movie } from '../types';
import { useProfileStore } from './useProfileStore';

interface TrailerWatch {
  movie: Movie;
  profileId: string | null;
  at: number;
}

interface TrailerHistoryStore {
  watches: TrailerWatch[];
  /** Records that a trailer actually started playing (not just resolved). */
  recordWatch: (movie: Movie) => void;
  /** Most-recent-first trailer watches for the given profile, deduped by title. */
  getForProfile: (profileId: string | null) => Movie[];
}

const MAX_WATCHES = 60;

/**
 * Powers the "Trailers You've Watched" row on My Netflix. Fed by
 * TrailerPlayer the moment playback genuinely starts, scoped per profile.
 */
export const useTrailerHistoryStore = create<TrailerHistoryStore>()(
  persist(
    (set, get) => ({
      watches: [],

      recordWatch: (movie) => {
        const profileId = useProfileStore.getState().activeProfileId;
        set(state => {
          const filtered = state.watches.filter(
            w => !(String(w.movie.id) === String(movie.id) && w.profileId === profileId)
          );
          return { watches: [{ movie, profileId, at: Date.now() }, ...filtered].slice(0, MAX_WATCHES) };
        });
      },

      getForProfile: (profileId) =>
        get().watches
          .filter(w => w.profileId === profileId)
          .sort((a, b) => b.at - a.at)
          .map(w => w.movie),
    }),
    { name: 'pstream-trailer-history' }
  )
);
