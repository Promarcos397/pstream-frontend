import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { XIcon, PencilSimpleIcon } from '@phosphor-icons/react';
import { AVATAR_CATEGORIES, DEFAULT_AVATAR } from '../../constants';
import { Profile } from '../../types';

const FALLBACK_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23ddd'/%3E%3Ccircle cx='50' cy='38' r='18' fill='%23bbb'/%3E%3Cellipse cx='50' cy='85' rx='28' ry='22' fill='%23bbb'/%3E%3C/svg%3E";

const SafeImage: React.FC<{ src?: string; className?: string }> = ({ src, className }) => {
  const [failed, setFailed] = useState(false);
  return (
    <img
      src={failed || !src ? FALLBACK_AVATAR : src}
      alt=""
      className={className}
      onError={() => setFailed(true)}
      referrerPolicy="no-referrer"
    />
  );
};

interface AddEditProfileModalProps {
  mode: 'add' | 'edit';
  initial?: Profile;
  onSave: (input: { name: string; avatarUrl?: string; isKids: boolean; pin?: string | null }) => Promise<void> | void;
  onDelete?: () => Promise<void> | void;
  /** Shown in the delete slot when the profile is protected (no onDelete). */
  protectedHint?: string | null;
  onCancel: () => void;
  saving?: boolean;
  errorMessage?: string | null;
}

const AddEditProfileModal: React.FC<AddEditProfileModalProps> = ({
  mode, initial, onSave, onDelete, protectedHint, onCancel, saving, errorMessage,
}) => {
  const { t } = useTranslation();
  const [name, setName] = useState(initial?.name || '');
  const [avatarUrl, setAvatarUrl] = useState(initial?.avatarUrl || DEFAULT_AVATAR);
  const [isKids, setIsKids] = useState(initial?.isKids || false);
  const [pinEnabled, setPinEnabled] = useState(!!initial?.pin);
  const [pin, setPin] = useState(initial?.pin || '');
  const [pickingAvatar, setPickingAvatar] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const pinValid = !pinEnabled || /^\d{4}$/.test(pin);
  const canSave = name.trim().length > 0 && pinValid && !saving;

  const handleSave = () => {
    if (!canSave) return;
    onSave({
      name: name.trim(),
      avatarUrl,
      // The built-in Kids profile can never stop being a kids profile.
      isKids: initial?.isDefault ? true : isKids,
      pin: pinEnabled ? pin : null,
    });
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm px-4"
      onClick={onCancel}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[560px] max-h-[85vh] overflow-y-auto bg-[#181818] rounded-md shadow-2xl border border-white/10 p-8 sm:p-10"
      >
        <button
          onClick={onCancel}
          aria-label={t('common.close', { defaultValue: 'Close' })}
          className="absolute top-5 right-5 w-8 h-8 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors"
        >
          <XIcon size={20} weight="bold" />
        </button>

        <h2 className="text-2xl sm:text-3xl font-bold text-white text-center mb-1">
          {mode === 'add'
            ? t('profiles.addTitle', { defaultValue: 'Add Profile' })
            : t('profiles.editTitle', { defaultValue: 'Edit Profile' })}
        </h2>
        <p className="text-white/40 text-sm text-center mb-8">
          {mode === 'add'
            ? t('profiles.addSubtitle', { defaultValue: 'Add a profile for another person watching Pstream.' })
            : t('profiles.editSubtitle', { defaultValue: 'Update this profile’s name, icon, and lock.' })}
        </p>

        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 mb-8">
          <button
            type="button"
            onClick={() => setPickingAvatar(true)}
            className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-md overflow-hidden bg-white/10 shrink-0 shadow-md group hover:ring-4 hover:ring-white/20 transition-all active:scale-95"
          >
            <SafeImage src={avatarUrl} className="w-full h-full object-cover block" />
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <PencilSimpleIcon size={22} weight="bold" className="text-white" />
            </div>
          </button>

          <div className="flex-1 w-full">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('profiles.namePlaceholder', { defaultValue: 'Name' })}
              maxLength={30}
              className="w-full bg-transparent border border-white/20 rounded-sm px-4 py-3 text-white text-base placeholder:text-white/30 outline-none focus:ring-2 focus:ring-white/60 transition-shadow"
            />
          </div>
        </div>

        <div className="border-t border-white/10 pt-5 mb-5">
          <label className={`flex items-center justify-between gap-4 ${initial?.isDefault ? '' : 'cursor-pointer'}`}>
            <div>
              <span className="text-white font-semibold text-[15px]">
                {t('profiles.kidsProfile', { defaultValue: 'Kids profile' })}
              </span>
              <p className="text-white/40 text-[13px] mt-0.5">
                {initial?.isDefault
                  ? t('profiles.kidsProfileBuiltIn', { defaultValue: "This is the account's built-in Kids profile — it always stays kid-safe." })
                  : t('profiles.kidsProfileDesc', { defaultValue: 'Only see child-friendly series and films' })}
              </p>
            </div>
            <input
              type="checkbox"
              checked={initial?.isDefault ? true : isKids}
              disabled={!!initial?.isDefault}
              onChange={(e) => setIsKids(e.target.checked)}
              className="w-5 h-5 accent-[#e50914] shrink-0 disabled:opacity-50"
            />
          </label>
        </div>

        <div className="border-t border-white/10 pt-5 mb-6">
          <label className="flex items-center justify-between gap-4 cursor-pointer mb-3">
            <div>
              <span className="text-white font-semibold text-[15px]">
                {t('profiles.pinLock', { defaultValue: 'Profile Lock' })}
              </span>
              <p className="text-white/40 text-[13px] mt-0.5">
                {t('profiles.pinLockDesc', { defaultValue: 'Require a 4-digit PIN to open this profile' })}
              </p>
            </div>
            <input
              type="checkbox"
              checked={pinEnabled}
              onChange={(e) => setPinEnabled(e.target.checked)}
              className="w-5 h-5 accent-[#e50914] shrink-0"
            />
          </label>
          <AnimatePresence>
            {pinEnabled && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder={t('profiles.enterPin', { defaultValue: 'Enter 4-digit PIN' })}
                  className="w-full sm:w-48 bg-transparent border border-white/20 rounded-sm px-4 py-2.5 text-white text-base tracking-[0.3em] placeholder:tracking-normal placeholder:text-white/30 outline-none focus:ring-2 focus:ring-white/60 transition-shadow"
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {errorMessage && (
          <p className="text-[#ff4d4d] text-sm mb-4 text-center">{errorMessage}</p>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="flex-1 h-12 bg-white text-black font-bold rounded-sm hover:bg-white/90 transition-colors active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
          >
            {saving
              ? t('common.saving', { defaultValue: 'Saving…' })
              : t('common.save', { defaultValue: 'Save' })}
          </button>
          <button
            onClick={onCancel}
            className="flex-1 h-12 bg-transparent text-white/60 border border-white/20 rounded-sm font-bold hover:bg-white/5 transition-colors active:scale-[0.98]"
          >
            {t('common.cancel', { defaultValue: 'Cancel' })}
          </button>
        </div>

        {mode === 'edit' && !onDelete && protectedHint && (
          <div className="mt-6 pt-5 border-t border-white/10 text-center">
            <p className="text-white/35 text-[13px]">{protectedHint}</p>
          </div>
        )}

        {mode === 'edit' && onDelete && (
          <div className="mt-6 pt-5 border-t border-white/10 text-center">
            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                className="text-white/40 hover:text-[#ff4d4d] text-sm font-medium transition-colors"
              >
                {t('profiles.deleteProfile', { defaultValue: 'Delete Profile' })}
              </button>
            ) : (
              <div className="flex items-center justify-center gap-3">
                <span className="text-white/60 text-sm">
                  {t('profiles.deleteConfirm', { defaultValue: 'Delete this profile and all its data?' })}
                </span>
                <button
                  onClick={() => onDelete()}
                  className="text-[#ff4d4d] hover:text-[#ff7a7a] text-sm font-bold transition-colors"
                >
                  {t('common.delete', { defaultValue: 'Delete' })}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="text-white/40 hover:text-white text-sm transition-colors"
                >
                  {t('common.cancel', { defaultValue: 'Cancel' })}
                </button>
              </div>
            )}
          </div>
        )}

        <AnimatePresence>
          {pickingAvatar && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-[#181818] rounded-md p-6 sm:p-8 overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-white">
                  {t('profiles.chooseIcon', { defaultValue: 'Choose an Icon' })}
                </h3>
                <button
                  onClick={() => setPickingAvatar(false)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <XIcon size={18} weight="bold" />
                </button>
              </div>
              {AVATAR_CATEGORIES.map((category) => (
                <div key={category.id} className="mb-8">
                  <h4 className="text-white/70 text-sm font-semibold mb-3">{category.name}</h4>
                  <div className="grid grid-cols-4 sm:grid-cols-5 gap-3">
                    {category.avatars.map((avatar) => {
                      const isSelected = avatarUrl === avatar.url;
                      return (
                        <button
                          key={avatar.url}
                          type="button"
                          title={avatar.name}
                          onClick={() => { setAvatarUrl(avatar.url); setPickingAvatar(false); }}
                          className={`aspect-square rounded-md overflow-hidden bg-white/10 transition-all
                            ${isSelected ? 'ring-4 ring-white scale-[0.96]' : 'hover:scale-[1.05]'}`}
                        >
                          <SafeImage src={avatar.url} className="w-full h-full object-cover block" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default AddEditProfileModal;
