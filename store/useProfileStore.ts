import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../services/supabaseClient';
import { Profile } from '../types';
import { useAuthStore } from './useAuthStore';
import { preloadAvatars } from '../utils/avatarCache';

const MAX_PROFILES = 5;

interface ProfileRow {
  id: string;
  user_id: string;
  name: string;
  avatar_url: string | null;
  is_kids: boolean;
  pin: string | null;
  sort_order: number;
}

const rowToProfile = (r: ProfileRow): Profile => ({
  id: r.id,
  name: r.name,
  avatarUrl: r.avatar_url || undefined,
  isKids: !!r.is_kids,
  pin: r.pin,
  sortOrder: r.sort_order ?? 0,
});

// PostgREST's "relation not found" — thrown when the `profiles` table
// migration hasn't been applied to this database yet.
const TABLE_NOT_FOUND = 'PGRST205';

interface ProfileStore {
  profiles: Profile[];
  activeProfileId: string | null;
  // Set true once we've attempted to load profiles for the current user.
  isLoaded: boolean;
  // False only when the `profiles` table itself doesn't exist yet (migration
  // not applied). While false, the app must NOT show the profile gate —
  // every existing account would be locked out with an empty picker.
  migrationApplied: boolean;
  // Profiles the user has unlocked with a PIN this session (so we don't re-prompt).
  unlockedProfileIds: string[];
  // One-shot flag: "Manage Profiles" opens the Who's Watching gate in edit mode.
  gateEditMode: boolean;

  setGateEditMode: (v: boolean) => void;
  loadProfiles: () => Promise<Profile[]>;
  setActiveProfile: (id: string | null) => void;
  markUnlocked: (id: string) => void;
  createProfile: (input: { name: string; avatarUrl?: string; isKids?: boolean; pin?: string | null }) => Promise<Profile | null>;
  updateProfile: (id: string, patch: Partial<Pick<Profile, 'name' | 'avatarUrl' | 'isKids' | 'pin'>>) => Promise<void>;
  deleteProfile: (id: string) => Promise<void>;
  upsertFromRealtime: (row: ProfileRow) => void;
  removeFromRealtime: (id: string) => void;
  reset: () => void;
  getActiveProfile: () => Profile | undefined;
  canAddMore: () => boolean;
}

const sortProfiles = (list: Profile[]) =>
  [...list].sort((a, b) => (a.sortOrder - b.sortOrder) || a.name.localeCompare(b.name));

export const useProfileStore = create<ProfileStore>()(
  persist(
    (set, get) => ({
      profiles: [],
      activeProfileId: null,
      isLoaded: false,
      migrationApplied: true, // optimistic until proven otherwise
      unlockedProfileIds: [],
      gateEditMode: false,

      setGateEditMode: (v) => set({ gateEditMode: v }),

      getActiveProfile: () => {
        const { profiles, activeProfileId } = get();
        return profiles.find(p => p.id === activeProfileId);
      },

      canAddMore: () => get().profiles.length < MAX_PROFILES,

      loadProfiles: async () => {
        const user = useAuthStore.getState().user;
        if (!user) {
          set({ profiles: [], activeProfileId: null, isLoaded: true });
          return [];
        }

        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', user.id)
          .order('sort_order', { ascending: true });

        if (error) {
          const migrationMissing =
            error.code === TABLE_NOT_FOUND || /Could not find the table/i.test(error.message || '');
          if (migrationMissing) {
            console.warn('[Profiles] `profiles` table not found — migration not applied yet. Skipping profile gate.');
          } else {
            console.warn('[Profiles] load failed, continuing without profiles:', error.message);
          }
          // Fail open either way: no gate, app behaves as single implicit profile.
          set({ profiles: [], isLoaded: true, migrationApplied: !migrationMissing });
          return [];
        }

        let profiles = sortProfiles((data as ProfileRow[]).map(rowToProfile));

        // Brand-new user with zero profiles (e.g. signed up after migration and
        // has no data yet): create their first profile automatically.
        if (profiles.length === 0) {
          const created = await get().createProfile({
            name:
              (user.user_metadata?.display_name as string) ||
              (user.user_metadata?.full_name as string) ||
              'Profile 1',
            avatarUrl: user.user_metadata?.avatar_url as string | undefined,
          });
          profiles = created ? [created] : [];
        }

        preloadAvatars(profiles.map(p => p.avatarUrl).filter(Boolean) as string[]);

        // Keep the active id valid; don't auto-select (the picker does that).
        const activeStillValid = profiles.some(p => p.id === get().activeProfileId);
        set({
          profiles,
          isLoaded: true,
          activeProfileId: activeStillValid ? get().activeProfileId : null,
        });
        return profiles;
      },

      setActiveProfile: (id) => {
        set({ activeProfileId: id });
      },

      markUnlocked: (id) => {
        set(state =>
          state.unlockedProfileIds.includes(id)
            ? state
            : { unlockedProfileIds: [...state.unlockedProfileIds, id] }
        );
      },

      createProfile: async ({ name, avatarUrl, isKids = false, pin = null }) => {
        const user = useAuthStore.getState().user;
        if (!user) return null;
        if (!get().canAddMore()) return null;

        const sortOrder = get().profiles.reduce((m, p) => Math.max(m, p.sortOrder), -1) + 1;
        const { data, error } = await supabase
          .from('profiles')
          .insert({
            user_id: user.id,
            name: name.trim() || 'Profile',
            avatar_url: avatarUrl || null,
            is_kids: isKids,
            pin: pin || null,
            sort_order: sortOrder,
          })
          .select()
          .single();

        if (error || !data) {
          console.error('[Profiles] create failed:', error?.message);
          return null;
        }
        const profile = rowToProfile(data as ProfileRow);
        set(state => ({ profiles: sortProfiles([...state.profiles, profile]) }));
        if (profile.avatarUrl) preloadAvatars([profile.avatarUrl]);
        return profile;
      },

      updateProfile: async (id, patch) => {
        const user = useAuthStore.getState().user;
        // Optimistic local update.
        set(state => ({
          profiles: sortProfiles(
            state.profiles.map(p => (p.id === id ? { ...p, ...patch } : p))
          ),
        }));
        if (!user) return;

        const dbPatch: Record<string, any> = {};
        if (patch.name !== undefined) dbPatch.name = patch.name.trim();
        if (patch.avatarUrl !== undefined) dbPatch.avatar_url = patch.avatarUrl || null;
        if (patch.isKids !== undefined) dbPatch.is_kids = patch.isKids;
        if (patch.pin !== undefined) dbPatch.pin = patch.pin || null;
        dbPatch.updated_at = new Date().toISOString();

        const { error } = await supabase
          .from('profiles')
          .update(dbPatch)
          .eq('id', id)
          .eq('user_id', user.id);
        if (error) console.error('[Profiles] update failed:', error.message);
      },

      deleteProfile: async (id) => {
        const user = useAuthStore.getState().user;
        set(state => {
          const profiles = state.profiles.filter(p => p.id !== id);
          return {
            profiles,
            activeProfileId: state.activeProfileId === id ? null : state.activeProfileId,
            unlockedProfileIds: state.unlockedProfileIds.filter(u => u !== id),
          };
        });
        if (!user) return;
        // Child rows cascade-delete via FK.
        const { error } = await supabase
          .from('profiles')
          .delete()
          .eq('id', id)
          .eq('user_id', user.id);
        if (error) console.error('[Profiles] delete failed:', error.message);
      },

      upsertFromRealtime: (row) => {
        const profile = rowToProfile(row);
        set(state => {
          const exists = state.profiles.some(p => p.id === profile.id);
          const profiles = exists
            ? state.profiles.map(p => (p.id === profile.id ? profile : p))
            : [...state.profiles, profile];
          return { profiles: sortProfiles(profiles) };
        });
      },

      removeFromRealtime: (id) => {
        set(state => ({
          profiles: state.profiles.filter(p => p.id !== id),
          activeProfileId: state.activeProfileId === id ? null : state.activeProfileId,
        }));
      },

      reset: () => {
        set({ profiles: [], activeProfileId: null, isLoaded: false, unlockedProfileIds: [] });
      },
    }),
    {
      name: 'pstream-profile-store',
      // Only the chosen profile persists across reloads; the list is always
      // re-fetched fresh, and unlocks reset each browser session for safety.
      partialize: (state) => ({ activeProfileId: state.activeProfileId }),
    }
  )
);
