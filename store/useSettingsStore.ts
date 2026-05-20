import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_SUBTITLE_SETTINGS } from '../constants';
import { supabase } from '../services/supabaseClient';

export interface AppSettings {
  displayLanguage: string;
  audioLanguage: string;
  subtitleLanguage: string;
  showSubtitles: boolean;
  subtitleSize: 'small' | 'medium' | 'large';
  subtitleBgOpacity: number;
  subtitleColor: string;
  subtitleBgColor: string;
  autoplayPreviews: boolean;
  autoplayNextEpisode: boolean;
  autoplayVideo: boolean;
  avatarUrl: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  ...DEFAULT_SUBTITLE_SETTINGS,
  autoplayPreviews: true,
  autoplayNextEpisode: true,
  autoplayVideo: true,
  displayLanguage: 'en-US',
  audioLanguage: 'en',
  avatarUrl: 'https://i.pinimg.com/736x/c0/74/9b/c0749b7cc40142166cb17b19b9d1a6b6.jpg',
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
        // Background sync to cloud if logged in
        supabase.auth.getSession().then(({ data }) => {
          if (data.session?.user) {
            const state = get();
            const dbPayload = {
              display_language: state.settings.displayLanguage,
              audio_language: state.settings.audioLanguage,
              subtitle_language: state.settings.subtitleLanguage,
              show_subtitles: state.settings.showSubtitles,
              subtitle_size: state.settings.subtitleSize,
              subtitle_bg_opacity: state.settings.subtitleBgOpacity,
              subtitle_color: state.settings.subtitleColor,
              subtitle_bg_color: state.settings.subtitleBgColor,
              autoplay_previews: state.settings.autoplayPreviews,
              autoplay_next_episode: state.settings.autoplayNextEpisode,
              autoplay_video: state.settings.autoplayVideo,
              avatar_url: state.settings.avatarUrl,
              updated_at: new Date().toISOString(),
            };
            supabase.from('user_settings')
              .upsert({ user_id: data.session.user.id, ...dbPayload })
              .then(({ error }) => {
                if (error) console.error('[Sync] Settings sync error:', error.message);
              });
          }
        });
      },

      setGlobalMute: (mute) => {
        set({ globalMute: mute });
      },

      syncFromCloud: (cloudSettings) => {
        set((state) => ({ settings: { ...state.settings, ...cloudSettings } }));
      }
    }),
    {
      name: 'pstream-settings-store',
      partialize: (state) => ({ settings: state.settings, globalMute: state.globalMute }),
    }
  )
);
