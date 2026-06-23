import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_SUBTITLE_SETTINGS } from '../constants';
import { supabase } from '../services/supabaseClient';
import { AppSettings } from '../types';
import { useAuthStore } from './useAuthStore';
import { preloadAvatar } from '../utils/avatarCache';

export const DEFAULT_SETTINGS: AppSettings = {
  ...DEFAULT_SUBTITLE_SETTINGS,
  autoplayPreviews: true,
  autoplayNextEpisode: true,
  autoplayVideo: true,
  displayLanguage: 'en-US',
  audioLanguage: 'en',
  avatarUrl: 'https://lh3.googleusercontent.com/d/198aosLkzeCyglhaKy5vPMeWktSJhFui_',
  displayName: '',
};

interface SettingsStore {
  settings: AppSettings;
  globalMute: boolean;
  updateSettings: (newSettings: Partial<AppSettings>) => void;
  setGlobalMute: (mute: boolean) => void;
  syncFromCloud: (cloudSettings: Partial<AppSettings>) => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set, get) => ({
      settings: DEFAULT_SETTINGS,
      globalMute: false,
 
      updateSettings: (newSettings) => {
        set((state) => ({ settings: { ...state.settings, ...newSettings } }));
        if (newSettings.avatarUrl) preloadAvatar(newSettings.avatarUrl);
        // Background sync to cloud if logged in
        const user = useAuthStore.getState().user;
        if (user) {
          const state = get();
          const dbPayload = {
            display_language: state.settings.displayLanguage,
            audio_language: state.settings.audioLanguage,
            subtitle_language: state.settings.subtitleLanguage,
            show_subtitles: state.settings.showSubtitles,
            subtitle_size: state.settings.subtitleSize,
            subtitle_bg_opacity: state.settings.subtitleOpacity,
            subtitle_color: state.settings.subtitleColor,
            subtitle_bg_color: state.settings.subtitleWindowColor,
            autoplay_previews: state.settings.autoplayPreviews,
            autoplay_next_episode: state.settings.autoplayNextEpisode,
            autoplay_video: state.settings.autoplayVideo,
            avatar_url: state.settings.avatarUrl,
            updated_at: new Date().toISOString(),
          };
          supabase.from('user_settings')
            .upsert({ user_id: user.id, ...dbPayload })
            .then(({ error }) => {
              if (error) console.error('[Sync] Settings sync error:', error.message);
            });

          // Sync display_name to Supabase Auth metadata
          if (newSettings.displayName !== undefined) {
            supabase.auth.updateUser({
              data: { display_name: newSettings.displayName.trim() }
            }).then(({ error }) => {
              if (error) console.error('[Sync] Auth metadata sync error:', error.message);
            });
          }
        }
      },

      setGlobalMute: (mute) => {
        set({ globalMute: mute });
      },

      syncFromCloud: (cloudSettings) => {
        set((state) => ({ settings: { ...state.settings, ...cloudSettings } }));
        if (cloudSettings.avatarUrl) preloadAvatar(cloudSettings.avatarUrl);
      }
    }),
    {
      name: 'pstream-settings-store',
      partialize: (state) => ({ settings: state.settings, globalMute: state.globalMute }),
      onRehydrateStorage: () => (state) => {
        // Kick off preload as soon as localStorage is read — before any component renders.
        if (state?.settings?.avatarUrl) preloadAvatar(state.settings.avatarUrl);
      },
    }
  )
);
