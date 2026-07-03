import { useProfileStore } from './useProfileStore';

/**
 * Whether the `profiles` migration has been applied to this database yet.
 * Every write that references `profile_id` must check this first — writing
 * that column (or an `onConflict` target that includes it) before the
 * migration runs fails outright, since the column/constraint don't exist yet.
 */
export const isProfileScopingReady = (): boolean => useProfileStore.getState().migrationApplied;

/** Active profile id, or null pre-migration (never reference profile_id then). */
export const getActiveProfileId = (): string | null =>
  isProfileScopingReady() ? useProfileStore.getState().activeProfileId : null;
