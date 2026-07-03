import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { PlusIcon, PencilSimpleIcon, LockSimpleIcon } from '@phosphor-icons/react';
import pstreamWordmark from '../../assets/logos/pstream-logo.svg';
import { Profile } from '../../types';
import { useProfileStore } from '../../store/useProfileStore';
import { activateProfile } from '../../store/useAuthStore';
import AddEditProfileModal from './AddEditProfileModal';
import ProfilePinPrompt from './ProfilePinPrompt';
import KidsAvatar from './KidsAvatar';
import KidsBadge from './KidsBadge';

const FALLBACK_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23ddd'/%3E%3Ccircle cx='50' cy='38' r='18' fill='%23bbb'/%3E%3Cellipse cx='50' cy='85' rx='28' ry='22' fill='%23bbb'/%3E%3C/svg%3E";

const ProfileTile: React.FC<{
  profile: Profile;
  editMode: boolean;
  onSelect: () => void;
  onEdit: () => void;
}> = ({ profile, editMode, onSelect, onEdit }) => {
  const [failed, setFailed] = useState(false);
  return (
    <button
      type="button"
      onClick={editMode ? onEdit : onSelect}
      className="flex flex-col items-center gap-3 group w-[110px] sm:w-[140px]"
    >
      <div className="relative w-[110px] h-[110px] sm:w-[140px] sm:h-[140px] rounded-md overflow-hidden shadow-lg transition-transform group-hover:scale-[1.04] group-active:scale-[0.98]">
        {profile.isKids && !profile.avatarUrl ? (
          <KidsAvatar size={110} />
        ) : (
          <img
            src={failed || !profile.avatarUrl ? FALLBACK_AVATAR : profile.avatarUrl}
            alt=""
            className="w-full h-full object-cover"
            onError={() => setFailed(true)}
            referrerPolicy="no-referrer"
          />
        )}
        {profile.isKids && profile.avatarUrl && (
          <KidsBadge size={11} className="absolute bottom-1.5 left-1.5" />
        )}
        {editMode && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <PencilSimpleIcon size={32} weight="fill" className="text-white" />
          </div>
        )}
      </div>
      <span className={`text-[15px] sm:text-base transition-colors ${editMode ? 'text-white/40' : 'text-[#808080] group-hover:text-white'}`}>
        {profile.name}
      </span>
      {profile.pin && !editMode && (
        <LockSimpleIcon size={13} weight="fill" className="text-[#808080] -mt-1.5" />
      )}
    </button>
  );
};

const AddProfileTile: React.FC<{ onClick: () => void }> = ({ onClick }) => {
  const { t } = useTranslation();
  return (
    <button type="button" onClick={onClick} className="flex flex-col items-center gap-3 group w-[110px] sm:w-[140px]">
      {/* Netflix renders the Add tile as a filled gray circle, not a square. */}
      <div className="w-[110px] h-[110px] sm:w-[140px] sm:h-[140px] rounded-full bg-[#2b2b2b] flex items-center justify-center transition-all group-hover:bg-[#404040] group-active:scale-[0.98]">
        <PlusIcon size={44} weight="regular" className="text-[#808080] group-hover:text-white transition-colors" />
      </div>
      <span className="text-[15px] sm:text-base text-[#808080] group-hover:text-white transition-colors">
        {t('profiles.addProfile', { defaultValue: 'Add Profile' })}
      </span>
    </button>
  );
};

/**
 * Full-screen "Who's watching?" gate. Renders whenever the account is signed
 * in but no profile is active yet (fresh login, explicit "exit profile", or a
 * PIN-locked profile awaiting unlock).
 */
const WhosWatchingGate: React.FC = () => {
  const { t } = useTranslation();
  const profiles = useProfileStore(s => s.profiles);
  const isLoaded = useProfileStore(s => s.isLoaded);
  const unlockedProfileIds = useProfileStore(s => s.unlockedProfileIds);
  const markUnlocked = useProfileStore(s => s.markUnlocked);
  const createProfile = useProfileStore(s => s.createProfile);
  const updateProfile = useProfileStore(s => s.updateProfile);
  const deleteProfile = useProfileStore(s => s.deleteProfile);
  const canAddMore = useProfileStore(s => s.canAddMore());
  const gateEditMode = useProfileStore(s => s.gateEditMode);
  const setGateEditMode = useProfileStore(s => s.setGateEditMode);

  // Enter edit mode if we were opened via "Manage Profiles"; consume the flag.
  const [editMode, setEditMode] = useState(gateEditMode);
  useEffect(() => {
    if (gateEditMode) { setEditMode(true); setGateEditMode(false); }
  }, [gateEditMode, setGateEditMode]);

  const [modal, setModal] = useState<{ mode: 'add' | 'edit'; profile?: Profile } | null>(null);
  const [pendingUnlock, setPendingUnlock] = useState<Profile | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  if (!isLoaded) {
    return <div className="fixed inset-0 z-[150] bg-black" />;
  }

  const handleSelect = (profile: Profile) => {
    if (profile.pin && !unlockedProfileIds.includes(profile.id)) {
      setPendingUnlock(profile);
      return;
    }
    activateProfile(profile.id);
  };

  const handleSaveNew = async (input: { name: string; avatarUrl?: string; isKids: boolean; pin?: string | null }) => {
    setSaving(true);
    setSaveError(null);
    const created = await createProfile(input);
    setSaving(false);
    if (!created) {
      setSaveError(t('profiles.saveFailed', { defaultValue: 'Could not save this profile. Please try again.' }));
      return;
    }
    setModal(null);
  };

  const handleSaveEdit = async (id: string, input: { name: string; avatarUrl?: string; isKids: boolean; pin?: string | null }) => {
    setSaving(true);
    await updateProfile(id, input);
    setSaving(false);
    setModal(null);
  };

  const handleDelete = async (id: string) => {
    setSaving(true);
    await deleteProfile(id);
    setSaving(false);
    setModal(null);
  };

  return (
    <div className="fixed inset-0 z-[150] bg-black flex flex-col items-center justify-center px-6 overflow-y-auto">
      <img src={pstreamWordmark} alt="Pstream" className="h-8 sm:h-9 absolute top-8 left-8 sm:left-14" />

      <motion.h1
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="text-white text-3xl sm:text-5xl font-medium mb-10 sm:mb-14 text-center"
      >
        {t('profiles.whosWatching', { defaultValue: "Who's watching?" })}
      </motion.h1>

      <div className="flex flex-wrap items-start justify-center gap-6 sm:gap-8 max-w-[900px]">
        {profiles.map((profile) => (
          <ProfileTile
            key={profile.id}
            profile={profile}
            editMode={editMode}
            onSelect={() => handleSelect(profile)}
            onEdit={() => setModal({ mode: 'edit', profile })}
          />
        ))}
        {canAddMore && (
          <AddProfileTile onClick={() => setModal({ mode: 'add' })} />
        )}
      </div>

      <button
        onClick={() => setEditMode(v => !v)}
        className="mt-12 sm:mt-16 px-8 py-2.5 border border-[#808080] text-[#808080] text-sm sm:text-base tracking-[0.18em] hover:text-white hover:border-white transition-colors"
      >
        {editMode
          ? t('common.done', { defaultValue: 'Done' })
          : t('profiles.manageProfiles', { defaultValue: 'Manage Profiles' })}
      </button>

      <AnimatePresence>
        {modal && (
          <AddEditProfileModal
            mode={modal.mode}
            initial={modal.profile}
            saving={saving}
            errorMessage={saveError}
            onCancel={() => { setModal(null); setSaveError(null); }}
            onSave={(input) =>
              modal.mode === 'add' ? handleSaveNew(input) : handleSaveEdit(modal.profile!.id, input)
            }
            onDelete={modal.mode === 'edit' ? () => handleDelete(modal.profile!.id) : undefined}
          />
        )}
      </AnimatePresence>

      {pendingUnlock && (
        <ProfilePinPrompt
          profile={pendingUnlock}
          onCancel={() => setPendingUnlock(null)}
          onUnlock={() => {
            markUnlocked(pendingUnlock.id);
            activateProfile(pendingUnlock.id);
            setPendingUnlock(null);
          }}
        />
      )}
    </div>
  );
};

export default WhosWatchingGate;
