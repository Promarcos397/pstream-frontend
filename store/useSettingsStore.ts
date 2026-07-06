import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_SUBTITLE_SETTINGS } from '../constants';
import { supabase } from '../services/supabaseClient';
import { AppSettings } from '../types';
import { useAuthStore } from './useAuthStore';
import { useProfileStore } from './useProfileStore';
import { preloadAvatar } from '../utils/avatarCache';

// Row shape of `profile_settings` — the per-PROFILE mirror of the legacy
// per-ACCOUNT `user_settings` table (see supabase/migrations/20260705b_profile_settings.sql).
interface ProfileSettingsRow {
  display_language?: string | null;
  audio_language?: string | null;
  subtitle_language?: string | null;
  show_subtitles?: boolean | null;
  subtitle_size?: string | null;
  subtitle_bg_opacity?: number | null;
  subtitle_color?: string | null;
  subtitle_bg_color?: string | null;
  autoplay_previews?: boolean | null;
  autoplay_next_episode?: boolean | null;
  autoplay_video?: boolean | null;
  show_new_content_badges?: boolean | null;
}

const rowToPartialSettings = (row: ProfileSettingsRow): Partial<AppSettings> => {
  const out: Partial<AppSettings> = {};
  if (row.display_language != null) out.displayLanguage = row.display_language;
  if (row.audio_language != null) out.audioLanguage = row.audio_language;
  if (row.subtitle_language != null) out.subtitleLanguage = row.subtitle_language;
  if (row.show_subtitles != null) out.showSubtitles = row.show_subtitles;
  if (row.subtitle_size != null) out.subtitleSize = row.subtitle_size as AppSettings['subtitleSize'];
  if (row.subtitle_bg_opacity != null) out.subtitleOpacity = row.subtitle_bg_opacity;
  if (row.subtitle_color != null) out.subtitleColor = row.subtitle_color as AppSettings['subtitleColor'];
  if (row.subtitle_bg_color != null) out.subtitleWindowColor = row.subtitle_bg_color as AppSettings['subtitleWindowColor'];
  if (row.autoplay_previews != null) out.autoplayPreviews = row.autoplay_previews;
  if (row.autoplay_next_episode != null) out.autoplayNextEpisode = row.autoplay_next_episode;
  if (row.autoplay_video != null) out.autoplayVideo = row.autoplay_video;
  if (row.show_new_content_badges != null) out.showNewContentBadges = row.show_new_content_badges;
  return out;
};

export const DEFAULT_SETTINGS: AppSettings = {
  ...DEFAULT_SUBTITLE_SETTINGS,
  autoplayPreviews: true,
  autoplayNextEpisode: true,
  autoplayVideo: true,
  displayLanguage: 'en-US',
  audioLanguage: 'en',
  avatarUrl: 'https://lh3.googleusercontent.com/d/198aosLkzeCyglhaKy5vPMeWktSJhFui_',
  displayName: '',
  showNewContentBadges: true,
};

interface SettingsStore {
  settings: AppSettings;
  globalMute: boolean;
  updateSettings: (newSettings: Partial<AppSettings>) => void;
  setGlobalMute: (mute: boolean) => void;
  syncFromCloud: (cloudSettings: Partial<AppSettings>) => void;
  /** Loads this profile's own subtitle/playback/language prefs, falling back
   * to whatever's already in `settings` (the account-wide defaults) when the
   * profile has never saved any of its own yet. Call whenever the active
   * profile changes. */
  loadSettingsForProfile: (profileId: string | null) => Promise<void>;
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

          // Also mirror into this PROFILE's own row (profile_settings) — the
          // account-wide user_settings row above stays as a legacy fallback,
          // but per-profile prefs are the real source of truth going forward.
          const activeProfileId = useProfileStore.getState().activeProfileId;
          if (activeProfileId) {
            supabase.from('profile_settings')
              .upsert({ profile_id: activeProfileId, user_id: user.id, ...dbPayload })
              .then(({ error }) => {
                if (error) console.error('[Sync] Profile settings sync error:', error.message);
              });
          }

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
      },

      loadSettingsForProfile: async (profileId) => {
        if (!profileId) return;
        const user = useAuthStore.getState().user;
        if (!user) return;
        const { data, error } = await supabase
          .from('profile_settings')
          .select('*')
          .eq('profile_id', profileId)
          .maybeSingle();
        if (error) {
          // Table not migrated yet, or no row for this profile — the current
          // (account-wide) settings stay in effect, which is the correct fallback.
          if (!/relation .* does not exist|could not find the table/i.test(error.message || '')) {
            console.error('[Sync] Profile settings load error:', error.message);
          }
          return;
        }
        if (data) {
          set((state) => ({ settings: { ...state.settings, ...rowToPartialSettings(data as ProfileSettingsRow) } }));
        }
      },
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
