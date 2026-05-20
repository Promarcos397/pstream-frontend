import { create } from 'zustand';
import { supabase } from '../services/supabaseClient';
import { useSettingsStore, DEFAULT_SETTINGS } from './useSettingsStore';
import { useWatchStore } from './useWatchStore';
import { useLibraryStore } from './useLibraryStore';

interface AuthStore {
  user: any | null;
  isInitialized: boolean;
  
  initializeAuth: () => void;
  syncFromCloud: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>()((set, get) => ({
  user: null,
  isInitialized: false,

  initializeAuth: () => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      const user = session?.user || null;
      set({ user, isInitialized: true });
      
      if (user) {
        get().syncFromCloud();
      }
    });

    // Listen for auth changes
    supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user || null;
      set({ user });
      
      if (user) {
        get().syncFromCloud();
      } else {
        // User logged out, nuke local state to protect privacy
        useSettingsStore.getState().setGlobalMute(false);
        useWatchStore.getState().clearHistory();
        useLibraryStore.getState().clearLibrary();
        localStorage.removeItem('pstream-settings-store');
        localStorage.removeItem('pstream-watch-store');
        localStorage.removeItem('pstream-library-store');
      }
    });
  },

  syncFromCloud: async () => {
    const user = get().user;
    if (!user) return;

    try {
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

      // 2. Sync Watch History
      const { data: watchData } = await supabase
        .from('watch_history')
        .select('*')
        .eq('user_id', user.id);

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
      }

      // 3. Sync Ratings and List
      const { data: ratingsData } = await supabase
        .from('user_ratings')
        .select('*')
        .eq('user_id', user.id);
        
      const { data: listData } = await supabase
        .from('user_list')
        .select('*')
        .eq('user_id', user.id);

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
    await supabase.auth.signOut();
  }
}));
