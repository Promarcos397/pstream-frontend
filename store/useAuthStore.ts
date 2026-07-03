import { create } from 'zustand';
import { supabase } from '../services/supabaseClient';
import { useSettingsStore, DEFAULT_SETTINGS } from './useSettingsStore';
import { useWatchStore } from './useWatchStore';
import { useLibraryStore } from './useLibraryStore';
import { useProfileStore } from './useProfileStore';
import { getSeasonDetails } from '../services/api';

interface AuthStore {
  user: any | null;
  isInitialized: boolean;
  
  initializeAuth: () => void;
  syncFromCloud: () => Promise<void>;
  signOut: () => Promise<void>;
}

let realtimeChannel: any = null;
let lastFocusSyncTime = 0;

const teardownRealtimeSubscription = () => {
  if (realtimeChannel) {
    console.info('[Sync] Tearing down user_sync Realtime channel');
    supabase.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }
};

// A realtime row belongs to the currently active profile when its profile_id
// matches, or when it's a legacy row (null profile_id) — those are treated as
// the first profile's data during rollout.
const rowMatchesActiveProfile = (row: any): boolean => {
  if (!row) return false;
  const activeId = useProfileStore.getState().activeProfileId;
  if (!activeId) return true;                 // no profile selected yet: accept all (legacy mode)
  if (!row.profile_id) return true;           // legacy row not yet stamped
  return row.profile_id === activeId;
};

const setupRealtimeSubscription = (userId: string) => {
  if (realtimeChannel) {
    teardownRealtimeSubscription();
  }

  console.info('[Sync] Initializing user_sync Realtime channel for user:', userId);
  realtimeChannel = supabase
    .channel(`public:user_sync:${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'profiles',
        filter: `user_id=eq.${userId}`
      },
      (payload) => {
        console.info('[Sync] Realtime profiles change received:', payload.eventType);
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          if (payload.new) useProfileStore.getState().upsertFromRealtime(payload.new as any);
        } else if (payload.eventType === 'DELETE') {
          const oldRow = payload.old as any;
          if (oldRow?.id) useProfileStore.getState().removeFromRealtime(oldRow.id);
        }
      }
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'watch_history',
        filter: `user_id=eq.${userId}`
      },
      (payload) => {
        console.info('[Sync] Realtime watch_history change received:', payload.eventType);
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const w = payload.new;
          if (!rowMatchesActiveProfile(w)) return; // another profile's activity
          if (w) {
            useWatchStore.getState().syncFromCloud([{
              tmdbId: w.tmdb_id,
              type: w.type,
              season: w.season || undefined,
              episode: w.episode || undefined,
              watchedTime: w.watched_time,
              duration: w.duration,
              percentage: w.percentage,
              movieData: w.movie_data || undefined,
              updatedAt: new Date(w.updated_at).getTime()
            }]);
          }
        } else if (payload.eventType === 'DELETE') {
          const w = payload.old;
          if (w && w.tmdb_id) {
            const key = w.season && w.episode ? `${w.tmdb_id}-S${w.season}E${w.episode}` : String(w.tmdb_id);
            useWatchStore.setState((state) => {
              const next = { ...state.history };
              delete next[key];
              return { history: next };
            });
          }
        }
      }
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'user_settings',
        filter: `user_id=eq.${userId}`
      },
      (payload) => {
        console.info('[Sync] Realtime user_settings change received:', payload.eventType);
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const s = payload.new;
          if (s) {
            useSettingsStore.getState().syncFromCloud({
              displayLanguage: s.display_language,
              audioLanguage: s.audio_language,
              subtitleLanguage: s.subtitle_language,
              showSubtitles: s.show_subtitles,
              subtitleSize: s.subtitle_size,
              subtitleOpacity: s.subtitle_bg_opacity,
              subtitleColor: s.subtitle_color,
              subtitleWindowColor: s.subtitle_bg_color,
              autoplayPreviews: s.autoplay_previews,
              autoplayNextEpisode: s.autoplay_next_episode,
              autoplayVideo: s.autoplay_video,
              avatarUrl: s.avatar_url
            });
          }
        }
      }
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'user_ratings',
        filter: `user_id=eq.${userId}`
      },
      (payload) => {
        console.info('[Sync] Realtime user_ratings change received:', payload.eventType);
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const r = payload.new;
          if (!rowMatchesActiveProfile(r)) return;
          if (r) {
            useLibraryStore.getState().syncFromCloud([{
              tmdbId: r.tmdb_id,
              type: r.type,
              rating: r.rating,
              movieData: r.movie_data || undefined,
              updatedAt: new Date(r.updated_at).getTime()
            }], []);
          }
        } else if (payload.eventType === 'DELETE') {
          const r = payload.old;
          if (r && r.tmdb_id) {
            useLibraryStore.setState((state) => {
              const next = { ...state.ratings };
              delete next[r.tmdb_id];
              return { ratings: next };
            });
          }
        }
      }
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'user_list',
        filter: `user_id=eq.${userId}`
      },
      (payload) => {
        console.info('[Sync] Realtime user_list change received:', payload.eventType);
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const l = payload.new;
          if (!rowMatchesActiveProfile(l)) return;
          if (l) {
            useLibraryStore.getState().syncFromCloud([], [{
              tmdbId: l.tmdb_id,
              type: l.type,
              movieData: l.movie_data || undefined,
              addedAt: new Date(l.added_at).getTime()
            }]);
          }
        } else if (payload.eventType === 'DELETE') {
          const l = payload.old;
          if (l && l.tmdb_id) {
            useLibraryStore.setState((state) => {
              const next = { ...state.myList };
              delete next[l.tmdb_id];
              return { myList: next };
            });
          }
        }
      }
    )
    .subscribe((status) => {
      console.log('[Sync] Realtime multiplex channel status:', status);
    });
};

export const useAuthStore = create<AuthStore>()((set, get) => ({
  user: null,
  isInitialized: false,

  initializeAuth: () => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      const user = session?.user || null;
      set({ user, isInitialized: true });
      
      if (user) {
        setupRealtimeSubscription(user.id);
        get().syncFromCloud();
      }
    });

    // Listen for auth changes
    supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user || null;
      const prevUser = get().user;
      set({ user });
      
      if (user) {
        if (!prevUser || prevUser.id !== user.id) {
          setupRealtimeSubscription(user.id);
        }
        get().syncFromCloud();
      } else {
        teardownRealtimeSubscription();
        // User logged out, nuke local state to protect privacy
        useSettingsStore.getState().setGlobalMute(false);
        useWatchStore.getState().clearHistory();
        useLibraryStore.getState().clearLibrary();
        useProfileStore.getState().reset();
      }
    });

    // Setup window focus and visibility event listeners for cross-device syncing
    if (typeof window !== 'undefined') {
      const handleFocusOrVisibility = () => {
        const user = get().user;
        if (!user) return;
        const now = Date.now();
        // Throttle focus-based cloud sync to at most once every 10 seconds
        if (now - lastFocusSyncTime > 10000) {
          lastFocusSyncTime = now;
          console.info('[Sync] Page focused/visible, executing background sync...');
          get().syncFromCloud();
        }
      };

      window.addEventListener('focus', handleFocusOrVisibility);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          handleFocusOrVisibility();
        }
      });
    }
  },

  syncFromCloud: async () => {
    const user = get().user;
    if (!user) return;

    try {
      // 0. Profiles first — everything below is scoped to the active profile.
      const profileStore = useProfileStore.getState();
      const profiles = await profileStore.loadProfiles();
      const activeProfileId = useProfileStore.getState().activeProfileId;

      // Claim legacy rows (written before the profiles migration, or by an old
      // client build) for the account's first profile so no data is stranded.
      // Fire-and-forget; harmless if the migration isn't applied yet.
      if (profiles.length > 0) {
        const defaultId = profiles[0].id;
        for (const tbl of ['watch_history', 'user_ratings', 'user_list']) {
          supabase.from(tbl)
            .update({ profile_id: defaultId })
            .eq('user_id', user.id)
            .is('profile_id', null)
            .then(({ error }) => {
              if (error && error.code !== '42703') {
                console.warn(`[Sync] Legacy ${tbl} adoption skipped:`, error.message);
              }
            });
        }
      }

      // Helper: profile-scoped select with graceful fallback for databases
      // where the migration hasn't been applied yet (no profile_id column).
      const selectScoped = async (tbl: string) => {
        let q = supabase.from(tbl).select('*').eq('user_id', user.id);
        if (activeProfileId) {
          // Include still-unclaimed legacy rows only for the first profile.
          const isFirstProfile = profiles.length > 0 && profiles[0].id === activeProfileId;
          q = isFirstProfile
            ? q.or(`profile_id.eq.${activeProfileId},profile_id.is.null`)
            : q.eq('profile_id', activeProfileId);
        }
        const { data, error } = await q;
        if (error) {
          if (error.code === '42703' || /profile_id/.test(error.message || '')) {
            const { data: fallback } = await supabase.from(tbl).select('*').eq('user_id', user.id);
            return fallback || [];
          }
          return [];
        }
        return data || [];
      };
      // 1. Sync Settings
      const { data: settingsData, error: settingsError } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();
        
      if (settingsError && settingsError.code === 'PGRST116') {
        // Settings do not exist in database yet (e.g. brand new signup). Let's initialize!
        const initialAvatar = user.user_metadata?.avatar_url || DEFAULT_SETTINGS.avatarUrl;
        const initialName = user.user_metadata?.display_name || user.user_metadata?.full_name || '';
        
        const dbPayload = {
          user_id: user.id,
          display_language: DEFAULT_SETTINGS.displayLanguage,
          audio_language: DEFAULT_SETTINGS.audioLanguage,
          subtitle_language: DEFAULT_SETTINGS.subtitleLanguage,
          show_subtitles: DEFAULT_SETTINGS.showSubtitles,
          subtitle_size: DEFAULT_SETTINGS.subtitleSize,
          subtitle_bg_opacity: DEFAULT_SETTINGS.subtitleOpacity,
          subtitle_color: DEFAULT_SETTINGS.subtitleColor,
          subtitle_bg_color: DEFAULT_SETTINGS.subtitleWindowColor,
          autoplay_previews: DEFAULT_SETTINGS.autoplayPreviews,
          autoplay_next_episode: DEFAULT_SETTINGS.autoplayNextEpisode,
          autoplay_video: DEFAULT_SETTINGS.autoplayVideo,
          avatar_url: initialAvatar,
          updated_at: new Date().toISOString()
        };
        
        const { error: insertError } = await supabase.from('user_settings').insert(dbPayload);
        if (!insertError) {
          useSettingsStore.getState().syncFromCloud({
            ...DEFAULT_SETTINGS,
            avatarUrl: initialAvatar,
            displayName: initialName
          });
        }
      } else if (settingsData) {
        useSettingsStore.getState().syncFromCloud({
          displayLanguage: settingsData.display_language,
          audioLanguage: settingsData.audio_language,
          subtitleLanguage: settingsData.subtitle_language,
          showSubtitles: settingsData.show_subtitles,
          subtitleSize: settingsData.subtitle_size,
          subtitleOpacity: settingsData.subtitle_bg_opacity,
          subtitleColor: settingsData.subtitle_color,
          subtitleWindowColor: settingsData.subtitle_bg_color,
          autoplayPreviews: settingsData.autoplay_previews,
          autoplayNextEpisode: settingsData.autoplay_next_episode,
          autoplayVideo: settingsData.autoplay_video,
          avatarUrl: settingsData.avatar_url,
          displayName: user.user_metadata?.display_name || user.user_metadata?.full_name || ''
        });
      }

      // 2. Sync Watch History (scoped to the active profile)
      const watchData = await selectScoped('watch_history');

      if (watchData && watchData.length > 0) {
        const mappedHistory = watchData.map(w => ({
          tmdbId: w.tmdb_id,
          type: w.type,
          season: w.season,
          episode: w.episode,
          watchedTime: w.watched_time,
          duration: w.duration,
          percentage: w.percentage,
          movieData: w.movie_data,
          updatedAt: new Date(w.updated_at).getTime()
        }));
        useWatchStore.getState().syncFromCloud(mappedHistory);

        // Prefetch episode names for all in-progress TV shows so popup shows
        // the title instantly instead of fetching on hover.
        const seen = new Set<string>();
        const tvEntries = mappedHistory.filter(h => h.type === 'tv' && h.season);
        const prefetch = () => {
          for (const entry of tvEntries) {
            const key = `${entry.tmdbId}-${entry.season}`;
            if (seen.has(key)) continue;
            seen.add(key);
            getSeasonDetails(Number(entry.tmdbId), entry.season!).catch(() => {});
          }
        };
        if ('requestIdleCallback' in window) {
          (window as any).requestIdleCallback(prefetch, { timeout: 4000 });
        } else {
          setTimeout(prefetch, 2000);
        }
      }

      // 3. Sync Ratings and List (scoped to the active profile)
      const ratingsData = await selectScoped('user_ratings');
      const listData = await selectScoped('user_list');

      const mappedRatings = (ratingsData || []).map(r => ({
        tmdbId: r.tmdb_id,
        type: r.type,
        rating: r.rating,
        movieData: r.movie_data,
        updatedAt: new Date(r.updated_at).getTime()
      }));

      const mappedList = (listData || []).map(l => ({
        tmdbId: l.tmdb_id,
        type: l.type,
        movieData: l.movie_data,
        addedAt: new Date(l.added_at).getTime()
      }));

      useLibraryStore.getState().syncFromCloud(mappedRatings, mappedList);

    } catch (e) {
      console.error('[AuthStore] Sync from cloud failed:', e);
    }
  },

  signOut: async () => {
    teardownRealtimeSubscription();
    useProfileStore.getState().reset();
    await supabase.auth.signOut();
  }
}));

/**
 * Switch to (or exit) a profile.
 * Clears the per-profile stores so nothing bleeds between profiles, then
 * re-syncs from the cloud under the new profile scope.
 *
 * @param profileId  target profile id, or null to exit to the "Who's Watching?" screen
 */
export const activateProfile = async (profileId: string | null) => {
  const { setActiveProfile } = useProfileStore.getState();
  useWatchStore.getState().clearHistory();
  useLibraryStore.getState().clearLibrary();
  setActiveProfile(profileId);
  if (profileId) {
    await useAuthStore.getState().syncFromCloud();
  }
};
