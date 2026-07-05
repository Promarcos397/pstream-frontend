import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppSettings } from '../types';
import { useGlobalContext } from '../context/GlobalContext';
import { useNavigate } from 'react-router-dom';
import { CaretRightIcon, UsersThreeIcon } from '@phosphor-icons/react';
import { DEFAULT_AVATAR } from '../constants';
import KidsAvatar from '../components/profiles/KidsAvatar';

const FALLBACK_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23ddd'/%3E%3Ccircle cx='50' cy='38' r='18' fill='%23bbb'/%3E%3Cellipse cx='50' cy='85' rx='28' ry='22' fill='%23bbb'/%3E%3C/svg%3E";

interface ProfileSectionProps {
    settings: AppSettings;
    updateSettings: (s: Partial<AppSettings>) => void;
}

const ProfileSection: React.FC<ProfileSectionProps> = ({ settings }) => {
    const { t } = useTranslation();
    const { user, activeProfile, profiles, switchProfile } = useGlobalContext();
    const navigate = useNavigate();
    const [imgFailed, setImgFailed] = useState(false);

    // Active profile is the source of truth; legacy account fields only as a
    // pre-migration fallback.
    const showKidsTile = !!activeProfile?.isKids && !activeProfile?.avatarUrl;
    const avatarSrc = imgFailed
        ? FALLBACK_AVATAR
        : (activeProfile?.avatarUrl || settings.avatarUrl || DEFAULT_AVATAR);
    const profileName =
        activeProfile?.name ||
        settings.displayName ||
        user?.display_name ||
        user?.user_metadata?.display_name ||
        user?.user_metadata?.full_name ||
        user?.email ||
        (user ? user.id.slice(0, 12) + '...' : 'Guest');

    return (
        <div className="text-gray-900 animate-fadeIn space-y-6">

            {/* Profile card — clickable row like Netflix */}
            <div className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm transition-all hover:shadow-md hover:border-gray-300">
                <button
                    onClick={() => navigate('/settings/profile/edit')}
                    className="flex items-center gap-5 w-full p-6 text-left transition-colors hover:bg-gray-50 active:scale-[0.99]"
                >
                    {/* Avatar */}
                    <div className="w-14 h-14 md:w-16 md:h-16 rounded-md overflow-hidden bg-gray-200 shrink-0 shadow-inner border border-gray-100">
                        {showKidsTile ? (
                            <KidsAvatar size={64} />
                        ) : (
                            <img
                                src={avatarSrc} alt=""
                                className="w-full h-full object-cover block"
                                onError={() => setImgFailed(true)}
                            />
                        )}
                    </div>

                    {/* Name + badge */}
                    <div className="flex-1 min-width-0">
                        <span className="text-lg md:text-xl font-bold text-gray-900 block truncate">
                            {profileName}
                        </span>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-[12px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full uppercase tracking-wider">
                                {t('settings.activeProfile', { defaultValue: 'Active' })}
                            </span>
                            {activeProfile?.isKids && (
                                <span className="text-[12px] font-bold text-[#e50914] bg-red-50 px-2 py-0.5 rounded-full uppercase tracking-wider">
                                    {t('profiles.kids', { defaultValue: 'Kids' })}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* "Your profile" badge */}
                    <div className="hidden sm:flex items-center gap-3">
                        <span className="text-xs font-bold text-gray-500 border border-gray-300 rounded-sm px-3 py-1.5 uppercase tracking-wide whitespace-nowrap">
                            {t('settings.yourProfile', { defaultValue: 'Your profile' })}
                        </span>
                        <CaretRightIcon size={20} className="text-gray-300 group-hover:text-gray-600 transition-colors" weight="bold" />
                    </div>
                </button>
            </div>

            {/* All profiles — jump to the Who's Watching manager */}
            {profiles.length > 0 && (
                <div className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm transition-all hover:shadow-md hover:border-gray-300">
                    <button
                        onClick={() => switchProfile(null)}
                        className="flex items-center gap-5 w-full p-6 text-left transition-colors hover:bg-gray-50 active:scale-[0.99]"
                    >
                        <span className="w-14 h-14 md:w-16 md:h-16 rounded-md bg-gray-100 flex items-center justify-center shrink-0 border border-gray-100">
                            <UsersThreeIcon size={30} className="text-gray-700" />
                        </span>
                        <div className="flex-1 min-w-0">
                            <span className="text-lg font-bold text-gray-900 block">
                                {t('profiles.manageProfiles', { defaultValue: 'Manage Profiles' })}
                            </span>
                            <span className="text-[13px] text-gray-500 mt-0.5 block">
                                {t('profiles.manageProfilesSub', {
                                    defaultValue: '{{count}} profile(s) · Continue Watching and My List are per-profile',
                                    count: profiles.length,
                                })}
                            </span>
                        </div>
                        <CaretRightIcon size={20} className="text-gray-300" weight="bold" />
                    </button>
                </div>
            )}

            {/* Info text */}
            <p className="text-sm text-gray-500 leading-relaxed font-medium px-1">
                {t('settings.profileInfo', { defaultValue: 'Customize your profile icon and display name. Your settings and watch history are tied to your identity.' })}
            </p>
        </div>
    );
};

export default ProfileSection;
