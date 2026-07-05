import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  XIcon, PlusIcon, PencilSimpleIcon, LockSimpleIcon, CaretRightIcon,
  GearSixIcon, ClockCounterClockwiseIcon, ShieldCheckIcon, SignOutIcon,
} from '@phosphor-icons/react';
import { Profile } from '../../types';
import { useProfileStore } from '../../store/useProfileStore';
import { useAuthStore, activateProfile } from '../../store/useAuthStore';
import AddEditProfileModal from './AddEditProfileModal';
import ProfilePinPrompt from './ProfilePinPrompt';
import KidsAvatar from './KidsAvatar';

const FALLBACK_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23ddd'/%3E%3Ccircle cx='50' cy='38' r='18' fill='%23bbb'/%3E%3Cellipse cx='50' cy='85' rx='28' ry='22' fill='%23bbb'/%3E%3C/svg%3E";

const SheetAvatar: React.FC<{ profile: Profile; size: number; radius?: number }> = ({ profile, size, radius = 16 }) => {
  const [failed, setFailed] = useState(false);
  return (
    <div
      className="overflow-hidden shrink-0"
      style={{ width: size, height: size, borderRadius: radius }}
    >
      {profile.isKids && !profile.avatarUrl ? (
        <KidsAvatar size={size} />
      ) : (
        <img
          src={failed || !profile.avatarUrl ? FALLBACK_AVATAR : profile.avatarUrl}
          alt=""
          className="w-full h-full object-cover"
          onError={() => setFailed(true)}
          referrerPolicy="no-referrer"
        />
      )}
    </div>
  );
};

const MenuRow: React.FC<{ icon: React.ReactNode; label: string; onClick: () => void }> = ({ icon, label, onClick }) => (
  <button
    onClick={onClick}
    className="w-full flex items-center gap-4 bg-[#1f1f1f] rounded-xl px-4 py-4 active:scale-[0.99] active:bg-[#262626] transition-all"
  >
    <span className="text-white shrink-0">{icon}</span>
    <span className="text-white text-[16px] font-medium flex-1 text-left">{label}</span>
    <CaretRightIcon size={18} className="text-white/50" />
  </button>
);

interface ProfileSheetMobileProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Netflix-mobile "Profile" bottom sheet — opened from the avatar + name + caret
 * header. Current profile card with edit pencil, other-profiles row, Manage
 * Profiles pill, then app menu rows. Modeled on the reference mobile
 * screenshots (Kids and adult variants).
 */
const ProfileSheetMobile: React.FC<ProfileSheetMobileProps> = ({ open, onClose }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const signOut = useAuthStore(s => s.signOut);
  const profiles = useProfileStore(s => s.profiles);
  const activeProfileId = useProfileStore(s => s.activeProfileId);
  const unlockedProfileIds = useProfileStore(s => s.unlockedProfileIds);
  const markUnlocked = useProfileStore(s => s.markUnlocked);
  const updateProfile = useProfileStore(s => s.updateProfile);
  const deleteProfile = useProfileStore(s => s.deleteProfile);
  const isDeletable = useProfileStore(s => s.isDeletable);
  const createProfile = useProfileStore(s => s.createProfile);
  const canAddMore = useProfileStore(s => s.canAddMore());

  const activeProfile = profiles.find(p => p.id === activeProfileId);
  const otherProfiles = profiles.filter(p => p.id !== activeProfileId);

  const [modal, setModal] = useState<{ mode: 'add' | 'edit'; profile?: Profile } | null>(null);
  const [pendingUnlock, setPendingUnlock] = useState<Profile | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const switchTo = (profile: Profile) => {
    if (profile.pin && !unlockedProfileIds.includes(profile.id)) {
      setPendingUnlock(profile);
      return;
    }
    onClose();
    activateProfile(profile.id);
  };

  const manageProfiles = () => {
    onClose();
    navigate('/settings/profiles'); // native in-app management, not the gate
  };

  const go = (path: string) => {
    onClose();
    navigate(path);
  };

  const handleSave = async (input: { name: string; avatarUrl?: string; isKids: boolean; pin?: string | null }) => {
    setSaving(true);
    setSaveError(null);
    if (modal?.mode === 'add') {
      const created = await createProfile(input);
      setSaving(false);
      if (!created) {
        setSaveError(t('profiles.saveFailed', { defaultValue: 'Could not save this profile. Please try again.' }));
        return;
      }
    } else if (modal?.profile) {
      await updateProfile(modal.profile.id, input);
      setSaving(false);
    }
    setModal(null);
  };

  const handleDelete = async (id: string) => {
    setSaving(true);
    const result = await deleteProfile(id);
    setSaving(false);
    if (!result.ok) {
      setSaveError(
        result.reason === 'default_kids'
          ? t('profiles.cantDeleteKids', { defaultValue: "The Kids profile comes with every account and can't be deleted." })
          : t('profiles.cantDeleteLastAdult', { defaultValue: 'You need at least one non-Kids profile. Add another before deleting this one.' })
      );
      return;
    }
    setModal(null);
  };

  // Protected profiles get no Delete button — a hint explains why instead.
  const protectedHintFor = (p?: Profile): string | null => {
    if (!p || isDeletable(p.id)) return null;
    return p.isDefault
      ? t('profiles.cantDeleteKids', { defaultValue: "The Kids profile comes with every account and can't be deleted." })
      : t('profiles.cantDeleteLastAdult', { defaultValue: 'You need at least one non-Kids profile. Add another before deleting this one.' });
  };

  return (
    <>
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[10040] bg-black/60"
              onClick={onClose}
            />

            {/* Sheet */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'tween', ease: [0.16, 1, 0.3, 1], duration: 0.32 }}
              className="fixed inset-x-0 bottom-0 z-[10050] bg-[#161616] rounded-t-2xl px-4 pt-2 pb-[calc(20px+env(safe-area-inset-bottom))] max-h-[88vh] overflow-y-auto"
            >
              {/* Drag handle */}
              <div className="w-10 h-1 rounded-full bg-white/30 mx-auto mb-3" />

              {/* Header */}
              <div className="relative flex items-center justify-center mb-4">
                <h2 className="text-white text-[22px] font-bold">
                  {t('nav.profile', { defaultValue: 'Profile' })}
                </h2>
                <button
                  onClick={onClose}
                  aria-label={t('common.close', { defaultValue: 'Close' })}
                  className="absolute right-0 w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white active:scale-95 transition-transform"
                >
                  <XIcon size={18} weight="bold" />
                </button>
              </div>

              {/* Current profile card */}
              {activeProfile && (
                <div className="relative bg-[#242424] rounded-2xl py-6 mb-6 flex flex-col items-center gap-3">
                  <SheetAvatar profile={activeProfile} size={96} radius={20} />
                  <span className="text-white text-[20px] font-bold">{activeProfile.name}</span>
                  <button
                    onClick={() => setModal({ mode: 'edit', profile: activeProfile })}
                    aria-label={t('profiles.editProfile', { defaultValue: 'Edit profile' })}
                    className="absolute top-5 right-5 text-white active:scale-90 transition-transform"
                  >
                    <PencilSimpleIcon size={24} />
                  </button>
                </div>
              )}

              {/* Other profiles + Add */}
              <div className="flex justify-center gap-6 mb-7">
                {otherProfiles.map(p => (
                  <button
                    key={p.id}
                    onClick={() => switchTo(p)}
                    className="flex flex-col items-center gap-2 active:scale-95 transition-transform"
                  >
                    <div className="relative">
                      <SheetAvatar profile={p} size={64} radius={14} />
                      {!!p.pin && (
                        <span className="absolute bottom-1 left-1 w-[16px] h-[16px] rounded-[4px] bg-black/60 backdrop-blur-[2px] flex items-center justify-center">
                          <LockSimpleIcon size={10} weight="fill" className="text-white" />
                        </span>
                      )}
                    </div>
                    <span className="text-white text-[14px]">{p.name}</span>
                  </button>
                ))}
                {canAddMore && (
                  <button
                    onClick={() => setModal({ mode: 'add' })}
                    className="flex flex-col items-center gap-2 active:scale-95 transition-transform"
                  >
                    <div className="w-[64px] h-[64px] rounded-[14px] bg-[#2f2f2f] flex items-center justify-center">
                      <PlusIcon size={26} className="text-white" />
                    </div>
                    <span className="text-white text-[14px]">{t('profiles.add', { defaultValue: 'Add' })}</span>
                  </button>
                )}
              </div>

              {/* Manage Profiles pill */}
              <button
                onClick={manageProfiles}
                className="block mx-auto mb-7 px-7 py-3 rounded-full bg-[#2f2f2f] text-white text-[16px] font-semibold active:scale-95 transition-transform"
              >
                {t('profiles.manageProfiles', { defaultValue: 'Manage Profiles' })}
              </button>

              {/* Menu rows */}
              <div className="space-y-3">
                <MenuRow
                  icon={<GearSixIcon size={24} />}
                  label={t('profiles.appSettings', { defaultValue: 'App Settings' })}
                  onClick={() => go('/settings/overview')}
                />
                <MenuRow
                  icon={<ClockCounterClockwiseIcon size={24} />}
                  label={t('settings.viewingActivity', { defaultValue: 'Viewing activity' })}
                  onClick={() => go('/settings/activity')}
                />
                <MenuRow
                  icon={<ShieldCheckIcon size={24} />}
                  label={t('settings.privacy', { defaultValue: 'Privacy and data settings' })}
                  onClick={() => go('/settings/privacy')}
                />
                <MenuRow
                  icon={<SignOutIcon size={24} />}
                  label={t('auth.signOut', { defaultValue: 'Sign Out' })}
                  onClick={() => { onClose(); signOut(); }}
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Edit / Add modal + PIN prompt share the gate's components */}
      <AnimatePresence>
        {modal && (
          <AddEditProfileModal
            mode={modal.mode}
            initial={modal.profile}
            saving={saving}
            errorMessage={saveError}
            onCancel={() => { setModal(null); setSaveError(null); }}
            onSave={handleSave}
            onDelete={
              modal.mode === 'edit' && modal.profile && isDeletable(modal.profile.id)
                ? () => handleDelete(modal.profile!.id)
                : undefined
            }
            protectedHint={modal.mode === 'edit' ? protectedHintFor(modal.profile) : null}
          />
        )}
      </AnimatePresence>

      {pendingUnlock && (
        <ProfilePinPrompt
          profile={pendingUnlock}
          onCancel={() => setPendingUnlock(null)}
          onUnlock={() => {
            markUnlocked(pendingUnlock.id);
            setPendingUnlock(null);
            onClose();
            activateProfile(pendingUnlock.id);
          }}
        />
      )}
    </>
  );
};

export default ProfileSheetMobile;
