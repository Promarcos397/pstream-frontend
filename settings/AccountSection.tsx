import React, { useState } from 'react';
import { useGlobalContext } from '../context/GlobalContext';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
    SignOutIcon, TranslateIcon, SubtitlesIcon,
    PlayCircleIcon, ClockIcon, CaretRightIcon, ShieldWarningIcon,
    LockSimpleIcon, BellIcon, ShieldCheckIcon, ArrowsLeftRightIcon,
} from '@phosphor-icons/react';
import { DEFAULT_AVATAR } from '../constants';
import KidsAvatar from '../components/profiles/KidsAvatar';
import { useProfileStore } from '../store/useProfileStore';
import { ToggleSwitch } from '../ui/SettingsUI';

const AccountSection: React.FC = () => {
    const { user, logout, settings, profiles, activeProfile } = useGlobalContext();
    const { t } = useTranslation();
    const navigate = useNavigate();
    const updateProfile = useProfileStore(s => s.updateProfile);
    const deleteProfile = useProfileStore(s => s.deleteProfile);
    const isDeletable = useProfileStore(s => s.isDeletable);

    const [pinOpen, setPinOpen] = useState(false);
    const [pinInput, setPinInput] = useState('');
    const [pinError, setPinError] = useState<string | null>(null);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);

    // Guest view: Simple sign-in prompt
    if (!user) {
        return (
            <div className="border border-white/10 md:border-gray-300 rounded-lg p-10 md:p-14 bg-white/5 md:bg-white flex flex-col items-center text-center shadow-sm">
                <p className="text-base md:text-lg text-white/70 md:text-gray-700 mb-6 max-w-sm leading-relaxed">
                    {t('auth.signInPrompt', { defaultValue: 'Sign in to save your history, list, and preferences across all devices.' })}
                </p>
                <button
                    onClick={() => navigate('/login')}
                    className="bg-white md:bg-[#111] text-black md:text-white px-10 py-3 rounded-sm font-bold text-base hover:bg-white/90 md:hover:bg-black transition-colors active:scale-95"
                >
                    {t('nav.signIn')}
                </button>
            </div>
        );
    }

    // Active profile first; legacy account-wide fields as pre-migration fallback.
    const avatarSrc = activeProfile?.avatarUrl || settings.avatarUrl || DEFAULT_AVATAR;
    const profileName = activeProfile?.name || settings.displayName || user.display_name || user.user_metadata?.display_name || user.user_metadata?.full_name || user.email || user.id.slice(0, 12);
    const hasPin = !!activeProfile?.pin;
    const deletable = activeProfile ? isDeletable(activeProfile.id) : false;

    const SettingsRow: React.FC<{
        icon: React.ReactNode;
        title: string;
        subtitle?: string;
        onClick: () => void;
        isLast?: boolean;
    }> = ({ icon, title, subtitle, onClick, isLast }) => (
        <React.Fragment>
            <div
                onClick={onClick}
                className="flex items-center p-5 cursor-pointer hover:bg-white/5 md:hover:bg-gray-50 active:bg-white/10 md:active:bg-gray-100 transition-colors group"
            >
                <div className="w-14 shrink-0 flex items-center">
                    {icon}
                </div>
                <div className="flex-1 pr-4 min-w-0">
                    <div className="text-[16px] md:text-[17px] font-bold text-white md:text-gray-900 truncate">{title}</div>
                    {subtitle && <div className="text-[13px] md:text-14px text-white/40 md:text-gray-500 mt-0.5 truncate">{subtitle}</div>}
                </div>
                <CaretRightIcon size={20} weight="bold" className="text-white/30 md:text-gray-300 group-hover:text-white/60 md:group-hover:text-gray-500 transition-colors" />
            </div>
            {!isLast && <div className="px-5"><div className="h-px bg-white/8 md:bg-gray-100" /></div>}
        </React.Fragment>
    );

    const handleToggleLock = () => {
        if (!activeProfile) return;
        if (hasPin) {
            updateProfile(activeProfile.id, { pin: null });
        } else {
            setPinOpen(true);
            setPinError(null);
        }
    };

    const handleSavePin = () => {
        if (!activeProfile) return;
        if (!/^\d{4}$/.test(pinInput)) {
            setPinError(t('profiles.pinInvalid', { defaultValue: 'Enter a 4-digit PIN.' }));
            return;
        }
        updateProfile(activeProfile.id, { pin: pinInput });
        setPinOpen(false);
        setPinInput('');
        setPinError(null);
    };

    const handleDeleteProfile = async () => {
        if (!activeProfile) return;
        setDeleteError(null);
        const result = await deleteProfile(activeProfile.id);
        if (!result.ok) {
            setDeleteError(
                result.reason === 'default_kids'
                    ? t('profiles.cantDeleteKids', { defaultValue: "The Kids profile comes with every account and can't be deleted." })
                    : t('profiles.cantDeleteLastAdult', { defaultValue: 'You need at least one non-Kids profile. Add another before deleting this one.' })
            );
            return;
        }
        navigate('/');
    };

    return (
        <div className="pb-10 space-y-10 animate-fadeIn">

            {/* Card 1: Profile + Profile Lock */}
            <div className="border border-white/10 md:border-gray-200 rounded-lg bg-white/5 md:bg-white overflow-hidden shadow-sm">
                <SettingsRow
                    icon={
                        activeProfile?.isKids && !activeProfile?.avatarUrl ? (
                            <div className="w-10 h-10 rounded-md overflow-hidden ring-1 ring-white/10 md:ring-black/5">
                                <KidsAvatar size={40} />
                            </div>
                        ) : (
                            <img src={avatarSrc} className="w-10 h-10 rounded-md object-cover ring-1 ring-white/10 md:ring-black/5" alt="" />
                        )
                    }
                    title={profileName}
                    subtitle={t('settings.editPersonalContact', { defaultValue: 'Edit personal and contact information' })}
                    onClick={() => navigate('/settings/profile/edit')}
                />
                <div className="flex items-center p-5">
                    <div className="w-14 shrink-0 flex items-center">
                        <LockSimpleIcon size={26} className="text-white/70 md:text-gray-800" />
                    </div>
                    <div className="flex-1 pr-4 min-w-0">
                        <div className="text-[16px] md:text-[17px] font-bold text-white md:text-gray-900">
                            {t('profiles.pinLock', { defaultValue: 'Profile Lock' })}
                        </div>
                        <div className="text-[13px] md:text-14px text-white/40 md:text-gray-500 mt-0.5">
                            {t('profiles.pinLockDesc', { defaultValue: 'Require a 4-digit PIN to open this profile' })}
                        </div>
                    </div>
                    <ToggleSwitch checked={hasPin} onChange={handleToggleLock} />
                </div>
                {pinOpen && (
                    <div className="px-5 pb-5">
                        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                            <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={pinInput}
                                onChange={(e) => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                                placeholder={t('profiles.enterPin', { defaultValue: 'Enter 4-digit PIN' })}
                                className="bg-black/20 md:bg-gray-100 border border-white/15 md:border-gray-300 rounded-sm px-4 py-2.5 text-white md:text-gray-900 text-base tracking-[0.3em] placeholder:tracking-normal placeholder:text-white/30 md:placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-white/40 md:focus:ring-gray-400 transition-shadow"
                            />
                            <div className="flex gap-2">
                                <button
                                    onClick={handleSavePin}
                                    className="px-6 py-2.5 bg-white md:bg-[#111] text-black md:text-white rounded-sm font-bold text-[14px] hover:bg-white/90 md:hover:bg-black transition-colors active:scale-95"
                                >
                                    {t('common.save', { defaultValue: 'Save' })}
                                </button>
                                <button
                                    onClick={() => { setPinOpen(false); setPinInput(''); setPinError(null); }}
                                    className="px-6 py-2.5 text-white/60 md:text-gray-600 border border-white/20 md:border-gray-300 rounded-sm font-bold text-[14px] hover:bg-white/5 md:hover:bg-gray-50 transition-colors active:scale-95"
                                >
                                    {t('common.cancel', { defaultValue: 'Cancel' })}
                                </button>
                            </div>
                        </div>
                        {pinError && <p className="text-red-500 text-[13px] font-medium mt-2">{pinError}</p>}
                    </div>
                )}
            </div>

            {/* Card 2: single Preferences card, 7 rows */}
            <div className="space-y-4">
                <h2 className="text-[14px] md:text-[15px] font-bold text-white/40 md:text-gray-500 uppercase tracking-wider ml-1">
                    {t('settings.preferences', { defaultValue: 'Preferences' })}
                </h2>
                <div className="border border-white/10 md:border-gray-200 rounded-lg bg-white/5 md:bg-white overflow-hidden shadow-sm">
                    <SettingsRow
                        icon={<TranslateIcon size={26} className="text-white/70 md:text-gray-800" />}
                        title={t('settings.languages', { defaultValue: 'Languages' })}
                        subtitle={t('settings.languagesSub', { defaultValue: 'Set languages for display and audio' })}
                        onClick={() => navigate('/settings/language')}
                    />
                    <SettingsRow
                        icon={<ShieldWarningIcon size={26} className="text-white/70 md:text-gray-800" />}
                        title={t('settings.parentalControls', { defaultValue: 'Adjust parental controls' })}
                        subtitle={t('settings.parentalControlsSub', { defaultValue: 'Restrict this profile to child-friendly titles' })}
                        onClick={() => navigate('/settings/profiles')}
                    />
                    <SettingsRow
                        icon={<SubtitlesIcon size={26} className="text-white/70 md:text-gray-800" />}
                        title={t('settings.subtitleAppearance', { defaultValue: 'Subtitle appearance' })}
                        subtitle={t('settings.customizeLookSubtitles', { defaultValue: 'Customize the way subtitles look' })}
                        onClick={() => navigate('/settings/subtitle')}
                    />
                    <SettingsRow
                        icon={<PlayCircleIcon size={26} className="text-white/70 md:text-gray-800" />}
                        title={t('settings.playbackSettings', { defaultValue: 'Playback settings' })}
                        subtitle={t('settings.configureAutoplayQuality', { defaultValue: 'Configure autoplay, audio and video quality' })}
                        onClick={() => navigate('/settings/playback')}
                    />
                    <SettingsRow
                        icon={<BellIcon size={26} className="text-white/70 md:text-gray-800" />}
                        title={t('settings.notificationSettings', { defaultValue: 'Notification settings' })}
                        subtitle={t('settings.notificationSettingsSub', { defaultValue: 'Choose what shows up as new for you' })}
                        onClick={() => navigate('/settings/notifications')}
                    />
                    <SettingsRow
                        icon={<ClockIcon size={26} className="text-white/70 md:text-gray-800" />}
                        title={t('settings.viewingActivity', { defaultValue: 'Viewing activity' })}
                        subtitle={t('settings.manageHistoryRatings', { defaultValue: 'Manage viewing history and ratings' })}
                        onClick={() => navigate('/settings/activity')}
                    />
                    <SettingsRow
                        icon={<ShieldCheckIcon size={26} className="text-white/70 md:text-gray-800" />}
                        title={t('settings.privacy', { defaultValue: 'Privacy and data settings' })}
                        subtitle={t('settings.privacySub', { defaultValue: 'Manage usage of personal information' })}
                        onClick={() => navigate('/settings/privacy')}
                        isLast={true}
                    />
                </div>
            </div>

            {/* Card 3: Profile transfer (standalone) */}
            <div className="border border-white/10 md:border-gray-200 rounded-lg bg-white/5 md:bg-white overflow-hidden shadow-sm">
                <SettingsRow
                    icon={<ArrowsLeftRightIcon size={26} className="text-white/70 md:text-gray-800" />}
                    title={t('settings.profileTransfer', { defaultValue: 'Profile transfer' })}
                    subtitle={t('settings.profileTransferSub', { defaultValue: 'Copy this profile to another account' })}
                    onClick={() => navigate('/settings/transfer')}
                    isLast={true}
                />
            </div>

            {/* Section: Auth Management */}
            <div className="border border-white/10 md:border-gray-200 rounded-lg bg-white/5 md:bg-white overflow-hidden shadow-sm">
                <SettingsRow
                    icon={<SignOutIcon size={26} className="text-red-500" />}
                    title={t('nav.signOut', { defaultValue: 'Sign Out' })}
                    onClick={() => { logout(); navigate('/'); }}
                    isLast={true}
                />
            </div>

            {/* Standalone Delete Profile button */}
            <div>
                {!confirmDelete ? (
                    <button
                        onClick={() => deletable && setConfirmDelete(true)}
                        disabled={!deletable}
                        className={`w-full py-3.5 rounded-sm text-base font-bold border transition-colors
                            ${deletable
                                ? 'border-red-500/40 text-red-500 hover:bg-red-500/10 active:scale-[0.98] cursor-pointer'
                                : 'border-white/10 md:border-gray-200 text-white/25 md:text-gray-300 cursor-not-allowed'}`}
                    >
                        {t('profiles.deleteProfile', { defaultValue: 'Delete Profile' })}
                    </button>
                ) : (
                    <div className="flex flex-col items-center gap-3 text-center">
                        <span className="text-white/70 md:text-gray-600 text-[14px]">
                            {t('profiles.deleteConfirm', { defaultValue: 'Delete this profile and all its data?' })}
                        </span>
                        <div className="flex items-center gap-4">
                            <button onClick={handleDeleteProfile} className="text-red-500 text-[15px] font-bold">
                                {t('common.delete', { defaultValue: 'Delete' })}
                            </button>
                            <button onClick={() => setConfirmDelete(false)} className="text-white/50 md:text-gray-500 text-[15px]">
                                {t('common.cancel', { defaultValue: 'Cancel' })}
                            </button>
                        </div>
                    </div>
                )}
                {!deletable && (
                    <p className="text-white/35 md:text-gray-400 text-[12px] text-center mt-2">
                        {activeProfile?.isDefault
                            ? t('profiles.cantDeleteKids', { defaultValue: "The Kids profile comes with every account and can't be deleted." })
                            : t('profiles.cantDeleteLastAdult', { defaultValue: 'You need at least one non-Kids profile. Add another before deleting this one.' })}
                    </p>
                )}
                {deleteError && <p className="text-red-500 text-[13px] text-center mt-2">{deleteError}</p>}
            </div>

        </div>
    );
};

export default AccountSection;
