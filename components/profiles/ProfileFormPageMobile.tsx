import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeftIcon, PencilSimpleIcon } from '@phosphor-icons/react';
import { DEFAULT_AVATAR } from '../../constants';
import { Profile } from '../../types';
import { ToggleSwitch } from '../../ui/SettingsUI';
import ChooseIconPageMobile from './ChooseIconPageMobile';

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

interface ProfileFormPageMobileProps {
  open: boolean;
  mode: 'add' | 'edit';
  initial?: Profile;
  onSave: (input: { name: string; avatarUrl?: string; isKids: boolean; pin?: string | null }) => Promise<void> | void;
  onDelete?: () => Promise<void> | void;
  protectedHint?: string | null;
  onCancel: () => void;
  saving?: boolean;
  errorMessage?: string | null;
}

/**
 * Full-screen mobile Add/Edit Profile page (replaces the desktop-style modal
 * card on mobile) — header with a Save text button, avatar with a persistent
 * pencil badge that opens Choose Icon, Kids Profile toggle, Profile Lock.
 */
const ProfileFormPageMobile: React.FC<ProfileFormPageMobileProps> = ({
  open, mode, initial, onSave, onDelete, protectedHint, onCancel, saving, errorMessage,
}) => {
  const { t } = useTranslation();
  const [name, setName] = useState(initial?.name || '');
  const [avatarUrl, setAvatarUrl] = useState(initial?.avatarUrl || DEFAULT_AVATAR);
  const [isKids, setIsKids] = useState(initial?.isKids || false);
  const [pinEnabled, setPinEnabled] = useState(!!initial?.pin);
  const [pin, setPin] = useState(initial?.pin || '');
  const [choosingIcon, setChoosingIcon] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const pinValid = !pinEnabled || /^\d{4}$/.test(pin);
  const canSave = name.trim().length > 0 && pinValid && !saving;

  const handleSave = () => {
    if (!canSave) return;
    onSave({
      name: name.trim(),
      avatarUrl,
      isKids: initial?.isDefault ? true : isKids,
      pin: pinEnabled ? pin : null,
    });
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'tween', ease: [0.16, 1, 0.3, 1], duration: 0.3 }}
          className="fixed inset-0 z-[10060] bg-black overflow-y-auto"
        >
          <div className="flex items-center justify-between px-4 pt-[calc(14px+env(safe-area-inset-top))] pb-3">
            <button onClick={onCancel} className="text-white active:scale-90 transition-transform" aria-label={t('common.back', { defaultValue: 'Back' })}>
              <ArrowLeftIcon size={24} />
            </button>
            <h1 className="text-white text-[19px] font-bold">
              {mode === 'add'
                ? t('profiles.addTitle', { defaultValue: 'Add Profile' })
                : t('profiles.editTitle', { defaultValue: 'Edit Profile' })}
            </h1>
            <button
              onClick={handleSave}
              disabled={!canSave}
              className="text-[15px] font-bold text-white disabled:text-white/30 active:scale-95 transition-transform"
            >
              {saving ? t('common.saving', { defaultValue: 'Saving…' }) : t('common.save', { defaultValue: 'Save' })}
            </button>
          </div>

          <div className="px-6 pb-12">
            <div className="flex flex-col items-center mt-4 mb-8">
              <div className="relative w-28 h-28">
                <div className="w-28 h-28 rounded-xl overflow-hidden bg-white/10 shadow-md">
                  <SafeImage src={avatarUrl} className="w-full h-full object-cover block" />
                </div>
                <button
                  type="button"
                  onClick={() => setChoosingIcon(true)}
                  aria-label={t('profiles.chooseIcon', { defaultValue: 'Choose Icon' })}
                  className="absolute -bottom-2 -right-2 w-9 h-9 rounded-full bg-white flex items-center justify-center shadow-md active:scale-90 transition-transform"
                >
                  <PencilSimpleIcon size={16} weight="bold" className="text-black" />
                </button>
              </div>
            </div>

            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('profiles.namePlaceholder', { defaultValue: 'Name' })}
              maxLength={30}
              className="w-full bg-[#1f1f1f] border-none rounded-lg px-4 py-3.5 text-white text-[16px] placeholder:text-white/30 outline-none focus:ring-2 focus:ring-white/40 transition-shadow mb-5"
            />

            <div className="w-full bg-[#1f1f1f] rounded-xl px-4 py-4 flex items-start gap-4 mb-5">
              <div className="flex-1">
                <span className="block text-white font-bold text-[16px]">
                  {t('profiles.kidsProfile', { defaultValue: 'Kids Profile' })}
                </span>
                <p className="text-white/45 text-[13px] mt-1 leading-snug">
                  {initial?.isDefault
                    ? t('profiles.kidsProfileBuiltIn', { defaultValue: "This is the account's built-in Kids profile — it always stays kid-safe." })
                    : t('profiles.kidsProfileDesc', { defaultValue: 'Made for children 12 and under, but parents have all the control.' })}
                </p>
              </div>
              <ToggleSwitch
                checked={initial?.isDefault ? true : isKids}
                disabled={!!initial?.isDefault}
                onChange={initial?.isDefault ? undefined : () => setIsKids(v => !v)}
              />
            </div>

            <div className="w-full bg-[#1f1f1f] rounded-xl px-4 py-4 mb-5">
              <div className="flex items-start gap-4">
                <div className="flex-1">
                  <span className="block text-white font-bold text-[16px]">
                    {t('profiles.pinLock', { defaultValue: 'Profile Lock' })}
                  </span>
                  <p className="text-white/45 text-[13px] mt-1 leading-snug">
                    {t('profiles.pinLockDesc', { defaultValue: 'Require a 4-digit PIN to open this profile' })}
                  </p>
                </div>
                <ToggleSwitch checked={pinEnabled} onChange={() => setPinEnabled(v => !v)} />
              </div>
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
                      className="w-full mt-4 bg-black/30 border border-white/15 rounded-lg px-4 py-3 text-white text-base tracking-[0.3em] placeholder:tracking-normal placeholder:text-white/30 outline-none focus:ring-2 focus:ring-white/40 transition-shadow"
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {errorMessage && (
              <p className="text-[#ff4d4d] text-sm mb-4 text-center">{errorMessage}</p>
            )}

            {mode === 'edit' && !onDelete && protectedHint && (
              <p className="text-white/35 text-[13px] text-center mt-6">{protectedHint}</p>
            )}

            {mode === 'edit' && onDelete && (
              <div className="mt-6 text-center">
                {!confirmDelete ? (
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="text-white/50 text-[15px] font-medium active:text-[#ff4d4d] transition-colors"
                  >
                    {t('profiles.deleteProfile', { defaultValue: 'Delete Profile' })}
                  </button>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <span className="text-white/60 text-[14px]">
                      {t('profiles.deleteConfirm', { defaultValue: 'Delete this profile and all its data?' })}
                    </span>
                    <div className="flex items-center gap-4">
                      <button onClick={() => onDelete()} className="text-[#ff4d4d] text-[15px] font-bold">
                        {t('common.delete', { defaultValue: 'Delete' })}
                      </button>
                      <button onClick={() => setConfirmDelete(false)} className="text-white/50 text-[15px]">
                        {t('common.cancel', { defaultValue: 'Cancel' })}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <ChooseIconPageMobile
            open={choosingIcon}
            currentUrl={avatarUrl}
            history={initial?.avatarHistory}
            onClose={() => setChoosingIcon(false)}
            onSelect={(url) => { setAvatarUrl(url); setChoosingIcon(false); }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ProfileFormPageMobile;
