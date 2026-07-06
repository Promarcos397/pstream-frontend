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
  is_default?: boolean; // optional: predates the column on not-yet-remigrated DBs
  pin: string | null;
  sort_order: number;
  avatar_history?: string[] | null; // optional: predates the column on not-yet-remigrated DBs
}

const rowToProfile = (r: ProfileRow): Profile => ({
  id: r.id,
  name: r.name,
  avatarUrl: r.avatar_url || undefined,
  isKids: !!r.is_kids,
  isDefault: !!r.is_default,
  pin: r.pin,
  sortOrder: r.sort_order ?? 0,
  avatarHistory: r.avatar_history || [],
});

const MAX_AVATAR_HISTORY = 20;

const withAvatarUsed = (history: string[] | undefined, url: string | undefined): string[] => {
  if (!url) return history || [];
  const next = [url, ...(history || []).filter(u => u !== url)];
  return next.slice(0, MAX_AVATAR_HISTORY);
};

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
  // Timestamp of the last time the app was known to be in use. Persisted so
  // it survives a closed tab/browser — compared against on the next load to
  // decide whether to re-show the "Who's watching?" gate after a long absence.
  lastActiveAt: number;
  // While switching profiles, the target profile — drives the Netflix-style
  // avatar-on-black transition overlay. Cleared when the switch settles.
  switchingProfile: Profile | null;

  setGateEditMode: (v: boolean) => void;
  touchActivity: () => void;
  setSwitchingProfile: (p: Profile | null) => void;
  loadProfiles: () => Promise<Profile[]>;
  setActiveProfile: (id: string | null) => void;
  markUnlocked: (id: string) => void;
  createProfile: (input: { name: string; avatarUrl?: string; isKids?: boolean; isDefault?: boolean; pin?: string | null }) => Promise<Profile | null>;
  updateProfile: (id: string, patch: Partial<Pick<Profile, 'name' | 'avatarUrl' | 'isKids' | 'pin'>>) => Promise<void>;
  /** Refuses to delete protected profiles; returns why so the UI can explain. */
  deleteProfile: (id: string) => Promise<{ ok: boolean; reason?: 'default_kids' | 'last_adult' }>;
  /** True when this profile may be deleted (not the built-in Kids, not the last adult). */
  isDeletable: (id: string) => boolean;
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
      lastActiveAt: Date.now(),
      switchingProfile: null,

      setGateEditMode: (v) => set({ gateEditMode: v }),
      touchActivity: () => set({ lastActiveAt: Date.now() }),
      setSwitchingProfile: (p) => set({ switchingProfile: p }),

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

        // Brand-new user with zero profiles (fresh signup): create their first
        // profile automatically and remember it as the one to auto-enter — no
        // point showing a "Who's watching?" picker with a single fresh profile.
        let freshSignupProfileId: string | null = null;
        if (profiles.length === 0) {
          const created = await get().createProfile({
            name:
              (user.user_metadata?.display_name as string) ||
              (user.user_metadata?.full_name as string) ||
              'Profile 1',
            avatarUrl: user.user_metadata?.avatar_url as string | undefined,
          });
          profiles = created ? [created] : [];
          freshSignupProfileId = created?.id ?? null;
        }

        // Every account ships with a built-in, undeletable Kids profile (the
        // striped tile) — created here for brand-new accounts and for existing
        // ones that predate this change. Skipped at the profile cap so we never
        // displace an existing profile.
        if (profiles.length > 0 && profiles.length < MAX_PROFILES && !profiles.some(p => p.isKids)) {
          const kids = await get().createProfile({ name: 'Kids', isKids: true, isDefault: true });
          if (kids) profiles = sortProfiles([...profiles, kids]);
        }

        preloadAvatars(profiles.map(p => p.avatarUrl).filter(Boolean) as string[]);

        // Keep the active id valid; don't auto-select (the picker does that) —
        // except right after signup, where we drop straight into the new profile.
        const activeStillValid = profiles.some(p => p.id === get().activeProfileId);
        set({
          profiles,
          isLoaded: true,
          activeProfileId: freshSignupProfileId ?? (activeStillValid ? get().activeProfileId : null),
          lastActiveAt: Date.now(),
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

      createProfile: async ({ name, avatarUrl, isKids = false, isDefault = false, pin = null }) => {
        const user = useAuthStore.getState().user;
        if (!user) return null;
        if (!get().canAddMore()) return null;

        const sortOrder = get().profiles.reduce((m, p) => Math.max(m, p.sortOrder), -1) + 1;
        // Untyped record: the generated supabase types predate is_default, and
        // the column may genuinely be absent on not-yet-remigrated databases
        // (handled by the retry below).
        const basePayload: Record<string, any> = {
          user_id: user.id,
          name: name.trim() || 'Profile',
          avatar_url: avatarUrl || null,
          is_kids: isKids,
          pin: pin || null,
          sort_order: sortOrder,
          avatar_history: withAvatarUsed(undefined, avatarUrl),
        };

        let payload: Record<string, any> = isDefault ? { ...basePayload, is_default: true } : basePayload;
        let { data, error } = await supabase.from('profiles').insert(payload).select().single();

        // Databases migrated with an earlier revision of the SQL lack the
        // is_default and/or avatar_history columns — retry without whichever
        // one PostgREST rejected, rather than failing the create outright.
        while (error && /column .* does not exist|could not find.*column/i.test(error.message || '')) {
          if ('is_default' in payload && /is_default/i.test(error.message || '')) {
            const { is_default: _omit, ...rest } = payload;
            payload = rest;
          } else if ('avatar_history' in payload && /avatar_history/i.test(error.message || '')) {
            const { avatar_history: _omit, ...rest } = payload;
            payload = rest;
          } else {
            break;
          }
          ({ data, error } = await supabase.from('profiles').insert(payload).select().single());
        }

        if (error || !data) {
          console.error('[Profiles] create failed:', error?.message);
          return null;
        }
        const profile = rowToProfile(data as ProfileRow);
        // Preserve the intent locally even on the no-column fallback path, so
        // the UI guards still treat the built-in Kids profile as protected.
        if (isDefault) profile.isDefault = true;
        set(state => ({ profiles: sortProfiles([...state.profiles, profile]) }));
        if (profile.avatarUrl) preloadAvatars([profile.avatarUrl]);
        return profile;
      },

      updateProfile: async (id, patch) => {
        const user = useAuthStore.getState().user;
        // The built-in Kids profile always stays a kids profile — strip any
        // attempt to flip it (name/avatar/pin edits remain allowed).
        const target = get().profiles.find(p => p.id === id);
        if (target?.isDefault && patch.isKids === false) {
          const { isKids: _ignored, ...rest } = patch;
          patch = rest;
        }
        // Picking a new avatar folds it into this profile's history (most
        // recent first, deduped, capped) — powers the Choose Icon "History" row.
        const nextAvatarHistory = patch.avatarUrl !== undefined
          ? withAvatarUsed(target?.avatarHistory, patch.avatarUrl)
          : undefined;
        // Optimistic local update.
        set(state => ({
          profiles: sortProfiles(
            state.profiles.map(p => (p.id === id
              ? { ...p, ...patch, ...(nextAvatarHistory ? { avatarHistory: nextAvatarHistory } : {}) }
              : p))
          ),
        }));
        if (!user) return;

        const dbPatch: Record<string, any> = {};
        if (patch.name !== undefined) dbPatch.name = patch.name.trim();
        if (patch.avatarUrl !== undefined) dbPatch.avatar_url = patch.avatarUrl || null;
        if (patch.isKids !== undefined) dbPatch.is_kids = patch.isKids;
        if (patch.pin !== undefined) dbPatch.pin = patch.pin || null;
        if (nextAvatarHistory) dbPatch.avatar_history = nextAvatarHistory;
        dbPatch.updated_at = new Date().toISOString();

        let { error } = await supabase
          .from('profiles')
          .update(dbPatch)
          .eq('id', id)
          .eq('user_id', user.id);

        // Database predates the avatar_history migration — retry without it.
        if (error && /avatar_history/i.test(error.message || '')) {
          const { avatar_history: _omit, ...rest } = dbPatch;
          ({ error } = await supabase
            .from('profiles')
            .update(rest)
            .eq('id', id)
            .eq('user_id', user.id));
        }
        if (error) console.error('[Profiles] update failed:', error.message);
      },

      isDeletable: (id) => {
        const { profiles } = get();
        const target = profiles.find(p => p.id === id);
        if (!target) return false;
        // The built-in Kids profile ships with the account and never leaves.
        if (target.isDefault) return false;
        // Deleting the last non-kids profile would strand the account with
        // only the Kids profile (or nothing) — always keep at least one adult.
        if (!target.isKids && profiles.filter(p => !p.isKids).length <= 1) return false;
        return true;
      },

      deleteProfile: async (id) => {
        const user = useAuthStore.getState().user;
        const target = get().profiles.find(p => p.id === id);
        if (target?.isDefault) return { ok: false, reason: 'default_kids' as const };
        if (target && !target.isKids && get().profiles.filter(p => !p.isKids).length <= 1) {
          return { ok: false, reason: 'last_adult' as const };
        }
        set(state => {
          const profiles = state.profiles.filter(p => p.id !== id);
          return {
            profiles,
            activeProfileId: state.activeProfileId === id ? null : state.activeProfileId,
            unlockedProfileIds: state.unlockedProfileIds.filter(u => u !== id),
          };
        });
        if (!user) return { ok: true };
        // Child rows cascade-delete via FK.
        const { error } = await supabase
          .from('profiles')
          .delete()
          .eq('id', id)
          .eq('user_id', user.id);
        if (error) console.error('[Profiles] delete failed:', error.message);
        return { ok: true };
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
        // Full sign-out hygiene: nothing profile-related survives into the
        // next account — no leaked picker, no stale unlocks, no inherited
        // inactivity window, no half-finished switch overlay or edit mode.
        set({
          profiles: [],
          activeProfileId: null,
          isLoaded: false,
          unlockedProfileIds: [],
          gateEditMode: false,
          switchingProfile: null,
          lastActiveAt: Date.now(),
        });
      },
    }),
    {
      name: 'pstream-profile-store',
      // Only the chosen profile (+ its last-active timestamp) persists across
      // reloads; the list is always re-fetched fresh, and unlocks reset each
      // browser session for safety.
      partialize: (state) => ({ activeProfileId: state.activeProfileId, lastActiveAt: state.lastActiveAt }),
    }
  )
);
