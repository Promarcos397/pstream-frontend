import React from 'react';
import { useGlobalContext } from '../context/GlobalContext';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
    SignOutIcon, KeyIcon, TranslateIcon, SubtitlesIcon,
    PlayCircleIcon, ClockIcon, CaretRightIcon, UsersThreeIcon
} from '@phosphor-icons/react';
import { DEFAULT_AVATAR } from '../constants';
import KidsAvatar from '../components/profiles/KidsAvatar';

const AccountSection: React.FC = () => {
    const { user, logout, settings, profiles, activeProfile } = useGlobalContext();
    const { t } = useTranslation();
    const navigate = useNavigate();

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

    return (
        <div className="pb-10 space-y-10 animate-fadeIn">

            {/* Section 1: Profile Information */}
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
                <SettingsRow
                    icon={<UsersThreeIcon size={26} className="text-white/70 md:text-gray-800" />}
                    title={t('profiles.manageProfiles', { defaultValue: 'Manage Profiles' })}
                    subtitle={t('profiles.manageProfilesSub', {
                        defaultValue: '{{count}} profile(s) · Continue Watching and My List are per-profile',
                        count: profiles.length,
                    })}
                    onClick={() => navigate('/settings/profiles')}
                />
                <SettingsRow
                    icon={<KeyIcon size={26} className="text-white/70 md:text-gray-800" />}
                    title={t('settings.recoveryKeyAndPhrase', { defaultValue: 'Security & Recovery' })}
                    subtitle={t('settings.manageKeyPhrase', { defaultValue: 'View your 12-word recovery phrase' })}
                    onClick={() => navigate('/settings/transfer')}
                    isLast={true}
                />
            </div>

            {/* Section 2: Preferences */}
            <div className="space-y-4">
                <h2 className="text-[14px] md:text-[15px] font-bold text-white/40 md:text-gray-500 uppercase tracking-wider ml-1">
                    {t('settings.preferences', { defaultValue: 'Preferences' })}
                </h2>
                <div className="border border-white/10 md:border-gray-200 rounded-lg bg-white/5 md:bg-white overflow-hidden shadow-sm">
                    <SettingsRow
                        icon={<TranslateIcon size={26} className="text-white/70 md:text-gray-800" />}
                        title={t('settings.languages', { defaultValue: 'Languages' })}
                        subtitle="English, Español"
                        onClick={() => navigate('/settings/language')}
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
                        isLast={true}
                    />
                </div>
            </div>

            {/* Section 3: History & Activity */}
            <div className="space-y-4">
                <h2 className="text-[14px] md:text-[15px] font-bold text-white/40 md:text-gray-500 uppercase tracking-wider ml-1">
                    {t('settings.experience', { defaultValue: 'Experience' })}
                </h2>
                <div className="border border-white/10 md:border-gray-200 rounded-lg bg-white/5 md:bg-white overflow-hidden shadow-sm">
                    <SettingsRow
                        icon={<ClockIcon size={26} className="text-white/70 md:text-gray-800" />}
                        title={t('settings.viewingActivity', { defaultValue: 'Viewing activity' })}
                        subtitle={t('settings.manageHistoryRatings', { defaultValue: 'Manage viewing history and ratings' })}
                        onClick={() => navigate('/settings/activity')}
                        isLast={true}
                    />
                </div>
            </div>

            {/* Section 4: Auth Management */}
            <div className="border border-white/10 md:border-gray-200 rounded-lg bg-white/5 md:bg-white overflow-hidden shadow-sm">
                <SettingsRow
                    icon={<SignOutIcon size={26} className="text-red-500" />}
                    title={t('nav.signOut', { defaultValue: 'Sign Out' })}
                    onClick={() => { logout(); navigate('/'); }}
                    isLast={true}
                />
            </div>

        </div>
    );
};

export default AccountSection;
