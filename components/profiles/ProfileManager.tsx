import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeftIcon, PencilSimpleIcon, PlusIcon, TrashIcon, LockSimpleIcon } from '@phosphor-icons/react';
import { Profile } from '../../types';
import { useProfileStore } from '../../store/useProfileStore';
import { AVATAR_CATEGORIES, ALL_AVATARS, DEFAULT_AVATAR } from '../../constants';
import { preloadAvatars } from '../../utils/avatarCache';
import KidsAvatar from './KidsAvatar';
import KidsBadge from './KidsBadge';

const FALLBACK_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23ddd'/%3E%3Ccircle cx='50' cy='38' r='18' fill='%23bbb'/%3E%3Cellipse cx='50' cy='85' rx='28' ry='22' fill='%23bbb'/%3E%3C/svg%3E";

/** A profile tile that renders the kids stripes when a kids profile has no custom avatar. */
const Tile: React.FC<{ profile: { avatarUrl?: string; isKids?: boolean }; size: number; radius?: number }> = ({ profile, size, radius = 14 }) => {
  const [failed, setFailed] = useState(false);
  return (
    <div className="overflow-hidden shrink-0 relative" style={{ width: size, height: size, borderRadius: radius }}>
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
      {profile.isKids && profile.avatarUrl && (
        <span className="absolute bottom-0.5 right-0.5"><KidsBadge size={Math.max(11, size * 0.22)} /></span>
      )}
    </div>
  );
};

/** Full-screen top bar with a back arrow, centred title and optional right action. */
const FlowHeader: React.FC<{ title: string; onBack: () => void; right?: React.ReactNode }> = ({ title, onBack, right }) => (
  <div className="sticky top-0 z-20 flex items-center gap-3 px-4 md:px-6 h-16 bg-black md:bg-white border-b border-white/5 md:border-gray-200">
    <button onClick={onBack} className="p-1 -ml-1 text-white md:text-gray-900 active:scale-90 transition-transform" aria-label="Back">
      <ArrowLeftIcon size={26} weight="bold" />
    </button>
    <h1 className="text-[22px] font-bold text-white md:text-gray-900 flex-1 truncate">{title}</h1>
    {right}
  </div>
);

type Screen =
  | { name: 'list' }
  | { name: 'form'; profile: Profile | null };  // null profile = add mode

/**
 * Native, in-app profile management — replaces the old "dump the user back to
 * the Who's Watching gate" behaviour. Mirrors the Netflix mobile flow:
 *   Manage Profiles list → Edit / Add Profile form → Choose Icon overlay.
 * Rendered full-screen (SettingsLayout hands it the whole viewport for the
 * `manage` view) so it owns its own multi-level header + back stack.
 */
const ProfileManager: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const profiles = useProfileStore(s => s.profiles);
  const createProfile = useProfileStore(s => s.createProfile);
  const updateProfile = useProfileStore(s => s.updateProfile);
  const deleteProfile = useProfileStore(s => s.deleteProfile);
  const isDeletable = useProfileStore(s => s.isDeletable);
  const canAddMore = useProfileStore(s => s.canAddMore());

  const [screen, setScreen] = useState<Screen>({ name: 'list' });

  useEffect(() => { preloadAvatars(ALL_AVATARS); }, []);

  if (screen.name === 'form') {
    return (
      <ProfileForm
        profile={screen.profile}
        canDelete={!!screen.profile && isDeletable(screen.profile.id)}
        isDefaultKids={!!screen.profile?.isDefault}
        onCancel={() => setScreen({ name: 'list' })}
        onSave={async (input) => {
          if (screen.profile) await updateProfile(screen.profile.id, input);
          else await createProfile(input);
          setScreen({ name: 'list' });
        }}
        onDelete={async () => {
          if (screen.profile) await deleteProfile(screen.profile.id);
          setScreen({ name: 'list' });
        }}
      />
    );
  }

  // ── Manage Profiles list ──────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-black md:bg-white">
      <FlowHeader title={t('profiles.manageProfiles', { defaultValue: 'Manage Profiles' })} onBack={() => navigate('/settings/overview')} />
      <div className="max-w-[560px] mx-auto px-4 md:px-6 py-6 space-y-3">
        {profiles.map(p => (
          <button
            key={p.id}
            onClick={() => setScreen({ name: 'form', profile: p })}
            className="w-full flex items-center gap-4 bg-white/5 md:bg-gray-50 hover:bg-white/[0.08] md:hover:bg-gray-100 rounded-xl px-4 py-3 active:scale-[0.99] transition-all"
          >
            <Tile profile={p} size={56} radius={12} />
            <div className="flex-1 text-left min-w-0">
              <span className="block text-white md:text-gray-900 text-[16px] font-semibold truncate">{p.name}</span>
              {p.isKids && <span className="block text-white/40 md:text-gray-500 text-[13px]">{t('profiles.kidsProfile', { defaultValue: 'Kids' })}</span>}
            </div>
            {!!p.pin && <LockSimpleIcon size={16} weight="fill" className="text-white/40 md:text-gray-400 shrink-0" />}
            <PencilSimpleIcon size={20} className="text-white/60 md:text-gray-500 shrink-0" />
          </button>
        ))}

        {canAddMore && (
          <button
            onClick={() => setScreen({ name: 'form', profile: null })}
            className="w-full flex items-center gap-4 rounded-xl px-4 py-3 active:scale-[0.99] transition-all border border-dashed border-white/15 md:border-gray-300"
          >
            <div className="w-[56px] h-[56px] rounded-[12px] bg-white/5 md:bg-gray-100 flex items-center justify-center shrink-0">
              <PlusIcon size={26} className="text-white md:text-gray-700" />
            </div>
            <span className="text-white md:text-gray-900 text-[16px] font-semibold">{t('profiles.addProfile', { defaultValue: 'Add Profile' })}</span>
          </button>
        )}
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════
   ADD / EDIT PROFILE FORM  (+ inline Choose Icon overlay)
   ═══════════════════════════════════════════════════════════════════════ */
const ProfileForm: React.FC<{
  profile: Profile | null;
  canDelete: boolean;
  isDefaultKids: boolean;
  onCancel: () => void;
  onSave: (input: { name: string; avatarUrl?: string; isKids: boolean }) => Promise<void> | void;
  onDelete: () => Promise<void> | void;
}> = ({ profile, canDelete, isDefaultKids, onCancel, onSave, onDelete }) => {
  const { t } = useTranslation();
  const isAdd = !profile;

  const [name, setName] = useState(profile?.name ?? '');
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(profile?.avatarUrl);
  const [isKids, setIsKids] = useState<boolean>(profile?.isKids ?? false);
  const [iconPicker, setIconPicker] = useState(false);
  const [busy, setBusy] = useState(false);

  const showKidsTile = isKids && !avatarUrl;
  const canSave = name.trim().length > 0 && !busy;

  const handleSave = async () => {
    if (!canSave) return;
    setBusy(true);
    await onSave({ name: name.trim(), avatarUrl, isKids });
  };

  if (iconPicker) {
    return (
      <ChooseIcon
        selectedUrl={avatarUrl}
        onBack={() => setIconPicker(false)}
        onSelect={(url) => { setAvatarUrl(url); setIconPicker(false); }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-black md:bg-white">
      <FlowHeader
        title={isAdd ? t('profiles.addProfile', { defaultValue: 'Add Profile' }) : t('profiles.editProfile', { defaultValue: 'Edit Profile' })}
        onBack={onCancel}
        right={
          <button
            onClick={handleSave}
            disabled={!canSave}
            className={`text-[16px] font-semibold px-1 transition-colors ${canSave ? 'text-[#2ec972]' : 'text-white/25 md:text-gray-300'}`}
          >
            {t('common.save', { defaultValue: 'Save' })}
          </button>
        }
      />

      <div className="max-w-[520px] mx-auto px-6 py-8 flex flex-col items-center">
        {/* Avatar with pencil badge */}
        <button
          onClick={() => setIconPicker(true)}
          className="relative active:scale-95 transition-transform"
          aria-label={t('settings.chooseIcon', { defaultValue: 'Choose Icon' })}
        >
          <div className="w-[140px] h-[140px] rounded-2xl overflow-hidden bg-white/5 md:bg-gray-100">
            {showKidsTile ? (
              <KidsAvatar size={140} />
            ) : (
              <img src={avatarUrl || DEFAULT_AVATAR} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            )}
          </div>
          <span className="absolute -bottom-1 -right-1 w-9 h-9 rounded-lg bg-white flex items-center justify-center shadow-md">
            <PencilSimpleIcon size={18} weight="bold" className="text-black" />
          </span>
        </button>

        {/* Name field */}
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('settings.profileName', { defaultValue: 'Profile Name' })}
          className="mt-8 w-full bg-white/5 md:bg-gray-100 border-none rounded-lg px-4 py-3.5 text-white md:text-gray-900 text-[17px] outline-none focus:ring-2 focus:ring-white/30 md:focus:ring-gray-400 placeholder:text-white/35 md:placeholder:text-gray-400"
        />

        {/* Kids Profile toggle card */}
        <div className="mt-5 w-full bg-white/5 md:bg-gray-100 rounded-xl px-4 py-4 flex items-start gap-4">
          <div className="flex-1">
            <span className="block text-white md:text-gray-900 text-[17px] font-bold">{t('profiles.kidsProfile', { defaultValue: 'Kids Profile' })}</span>
            <span className="block text-white/45 md:text-gray-500 text-[13px] mt-1 leading-snug">
              {t('profiles.kidsProfileDesc', { defaultValue: 'Made for children 12 and under, but parents have all the control.' })}
            </span>
          </div>
          <button
            onClick={() => !isDefaultKids && setIsKids(v => !v)}
            disabled={isDefaultKids}
            className={`mt-1 w-[52px] h-[30px] rounded-full shrink-0 relative transition-colors ${isKids ? 'bg-[#2f80ff]' : 'bg-white/20 md:bg-gray-300'} ${isDefaultKids ? 'opacity-60' : ''}`}
            aria-pressed={isKids}
          >
            <span className={`absolute top-[3px] w-6 h-6 rounded-full bg-white transition-all ${isKids ? 'left-[25px]' : 'left-[3px]'}`} />
          </button>
        </div>
        {isDefaultKids && (
          <p className="mt-2 w-full text-white/35 md:text-gray-400 text-[12px]">
            {t('profiles.cantDeleteKids', { defaultValue: "The Kids profile comes with every account and can't be deleted." })}
          </p>
        )}

        {/* Delete (edit mode, deletable only) */}
        {!isAdd && canDelete && (
          <button
            onClick={async () => { setBusy(true); await onDelete(); }}
            className="mt-8 w-full flex items-center justify-center gap-2 py-3.5 rounded-lg border border-red-500/40 text-red-500 text-[16px] font-semibold active:scale-[0.99] transition-transform"
          >
            <TrashIcon size={20} />
            {t('profiles.deleteProfile', { defaultValue: 'Delete Profile' })}
          </button>
        )}
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════
   CHOOSE ICON — categorized horizontally-scrolling avatar rows
   ═══════════════════════════════════════════════════════════════════════ */
const ChooseIcon: React.FC<{
  selectedUrl?: string;
  onBack: () => void;
  onSelect: (url: string) => void;
}> = ({ selectedUrl, onBack, onSelect }) => {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-black md:bg-white">
      <FlowHeader title={t('settings.chooseIcon', { defaultValue: 'Choose Icon' })} onBack={onBack} />
      <div className="max-w-[1100px] mx-auto px-4 md:px-6 py-6 pb-24">
        {AVATAR_CATEGORIES.map(category => (
          <div key={category.id} className="mb-9">
            <h3 className="text-[17px] md:text-xl font-bold text-white md:text-gray-900 mb-3 px-1">{category.name}</h3>
            <div className="flex gap-3 overflow-x-auto pb-1 px-1 hide-scrollbar" style={{ scrollbarWidth: 'none' }}>
              {category.avatars.map(avatar => {
                const isSelected = selectedUrl === avatar.url;
                return (
                  <button
                    key={avatar.url}
                    onClick={() => onSelect(avatar.url)}
                    title={avatar.name}
                    className={`w-[120px] h-[120px] min-w-[120px] rounded-lg overflow-hidden transition-all active:scale-95 ${isSelected ? 'ring-4 ring-white md:ring-gray-900' : 'hover:scale-[1.04]'}`}
                  >
                    <img src={avatar.url} alt={avatar.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProfileManager;
