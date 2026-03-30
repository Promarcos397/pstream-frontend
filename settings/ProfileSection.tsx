import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppSettings } from '../types';
import { useGlobalContext } from '../context/GlobalContext';
import { useNavigate } from 'react-router-dom';
import { CaretRightIcon } from '@phosphor-icons/react';
import { DEFAULT_AVATAR } from '../constants';

const FALLBACK_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23ddd'/%3E%3Ccircle cx='50' cy='38' r='18' fill='%23bbb'/%3E%3Cellipse cx='50' cy='85' rx='28' ry='22' fill='%23bbb'/%3E%3C/svg%3E";

interface ProfileSectionProps {
    settings: AppSettings;
    updateSettings: (s: Partial<AppSettings>) => void;
}

const ProfileSection: React.FC<ProfileSectionProps> = ({ settings }) => {
    const { t } = useTranslation();
    const { user } = useGlobalContext();
    const navigate = useNavigate();
    const [imgFailed, setImgFailed] = useState(false);

    const avatarSrc = imgFailed ? FALLBACK_AVATAR : (settings.avatarUrl || DEFAULT_AVATAR);
    const profileName = settings.displayName || user?.display_name || (user ? user.public_key.slice(0, 12) + '...' : 'Guest');

    return (
        <div style={{ color: '#111' }}>

            {/* Profile card — clickable row like Netflix */}
            <div style={{
                border: '1px solid #e5e5e5', borderRadius: 4, overflow: 'hidden',
                marginBottom: 24,
            }}>
                <button
                    onClick={() => navigate('/settings/profile/edit')}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 16,
                        width: '100%', padding: '16px 20px',
                        background: 'transparent', border: 'none', cursor: 'pointer',
                        textAlign: 'left',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#fafafa'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                    {/* Avatar */}
                    <div style={{
                        width: 48, height: 48, minWidth: 48,
                        borderRadius: 4, overflow: 'hidden', backgroundColor: '#ddd',
                    }}>
                        <img
                            src={avatarSrc} alt=""
                            style={{ width: 48, height: 48, objectFit: 'cover', display: 'block' }}
                            onError={() => setImgFailed(true)}
                        />
                    </div>

                    {/* Name + badge */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ fontSize: 15, fontWeight: 600, color: '#111', display: 'block' }}>
                            {profileName}
                        </span>
                    </div>

                    {/* "Your profile" badge */}
                    <span style={{
                        fontSize: 12, fontWeight: 500, color: '#525252',
                        border: '1px solid #d4d4d4', borderRadius: 3,
                        padding: '3px 10px', whiteSpace: 'nowrap',
                    }}>
                        {t('settings.yourProfile', { defaultValue: 'Your profile' })}
                    </span>

                    <CaretRightIcon size={18} style={{ color: '#d4d4d4', flexShrink: 0 }} />
                </button>
            </div>

            {/* Info text */}
            <p style={{ fontSize: 14, color: '#737373', lineHeight: 1.6 }}>
                {t('settings.profileInfo', { defaultValue: 'Customize your profile icon and display name. Your settings and watch history are tied to your identity.' })}
            </p>
        </div>
    );
};

export default ProfileSection;
