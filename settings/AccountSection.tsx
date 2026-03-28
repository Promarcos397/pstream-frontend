import React from 'react';
import { useGlobalContext } from '../context/GlobalContext';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { 
    SignOutIcon, KeyIcon, TranslateIcon, SubtitlesIcon, 
    PlayCircleIcon, ClockIcon, CaretRightIcon, UserCircleIcon 
} from '@phosphor-icons/react';
import { DEFAULT_AVATAR } from '../constants';

const AccountSection: React.FC = () => {
    const { user, logout, settings } = useGlobalContext();
    const { t } = useTranslation();
    const navigate = useNavigate();

    // Guest view: Simple sign-in prompt
    if (!user) {
        return (
            <div style={{ 
                border: '1px solid #d1d5db', borderRadius: 8, padding: '40px 24px', 
                backgroundColor: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}>
                <p style={{ fontSize: 16, color: '#374151', marginBottom: 24, maxWidth: 350, lineHeight: 1.5 }}>
                    {t('auth.guestModeDesc', { defaultValue: 'You are currently in guest mode. Sign in to save your history, list and preferences across devices.' })}
                </p>
                <button
                    onClick={() => navigate('/login')}
                    style={{ backgroundColor: '#111', color: '#fff', padding: '12px 40px', borderRadius: 2, fontWeight: 700, fontSize: 15, border: 'none', cursor: 'pointer' }}
                >
                    {t('nav.signIn')}
                </button>
            </div>
        );
    }

    const avatarSrc = settings.avatarUrl || DEFAULT_AVATAR;
    const profileName = settings.displayName || user.public_key.slice(0, 12);

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
                style={{ 
                    display: 'flex', alignItems: 'center', padding: '20px', 
                    cursor: 'pointer', transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f9fafb')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
                <div style={{ width: 52, flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                    {icon}
                </div>
                <div style={{ flex: 1, paddingRight: 16 }}>
                    <div style={{ fontSize: 17, fontWeight: 700, color: '#111' }}>{title}</div>
                    {subtitle && <div style={{ fontSize: 14, color: '#6b7280', marginTop: 2 }}>{subtitle}</div>}
                </div>
                <CaretRightIcon size={20} weight="bold" style={{ color: '#9ca3af' }} />
            </div>
            {!isLast && <div style={{ padding: '0 20px' }}><div style={{ height: 1, backgroundColor: '#e5e7eb' }} /></div>}
        </React.Fragment>
    );

    return (
        <div style={{ paddingBottom: 40 }}>
            
            {/* Section 1: Profile Information */}
            <div style={{ border: '1px solid #d1d5db', borderRadius: 8, backgroundColor: '#fff', marginBottom: 40, overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                <SettingsRow 
                    icon={<img src={avatarSrc} style={{ width: 40, height: 40, borderRadius: 4, objectFit: 'cover' }} alt="" />}
                    title={profileName}
                    subtitle={t('settings.editPersonalContact', { defaultValue: 'Edit personal and contact information' })}
                    onClick={() => navigate('/settings/profile/edit')}
                />
                <SettingsRow 
                    icon={<KeyIcon size={26} weight="regular" style={{ color: '#333' }} />}
                    title={t('settings.recoveryKeyAndPhrase', { defaultValue: 'Security & Recovery' })}
                    subtitle={t('settings.manageKeyPhrase', { defaultValue: 'View your 12-word recovery phrase' })}
                    onClick={() => navigate('/settings/transfer')}
                    isLast={true}
                />
            </div>

            {/* Section 2: Preferences */}
            <h2 style={{ fontSize: 18, fontWeight: 600, color: '#111', marginBottom: 16 }}>
                {t('settings.preferences', { defaultValue: 'Preferences' })}
            </h2>
            <div style={{ border: '1px solid #d1d5db', borderRadius: 8, backgroundColor: '#fff', marginBottom: 40, overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                <SettingsRow 
                    icon={<TranslateIcon size={26} weight="regular" style={{ color: '#333' }} />}
                    title={t('settings.languages', { defaultValue: 'Languages' })}
                    subtitle="English, Español"
                    onClick={() => navigate('/settings/language')}
                />
                <SettingsRow 
                    icon={<SubtitlesIcon size={26} weight="regular" style={{ color: '#333' }} />}
                    title={t('settings.subtitleAppearance', { defaultValue: 'Subtitle appearance' })}
                    subtitle={t('settings.customizeLookSubtitles', { defaultValue: 'Customize the way subtitles look' })}
                    onClick={() => navigate('/settings/subtitle')}
                />
                <SettingsRow 
                    icon={<PlayCircleIcon size={26} weight="regular" style={{ color: '#333' }} />}
                    title={t('settings.playbackSettings', { defaultValue: 'Playback settings' })}
                    subtitle={t('settings.configureAutoplayQuality', { defaultValue: 'Configure autoplay, audio and video quality' })}
                    onClick={() => navigate('/settings/playback')}
                    isLast={true}
                />
            </div>

            {/* Section 3: History & Activity */}
            <h2 style={{ fontSize: 18, fontWeight: 600, color: '#111', marginBottom: 16 }}>
                {t('settings.experience', { defaultValue: 'Experience' })}
            </h2>
            <div style={{ border: '1px solid #d1d5db', borderRadius: 8, backgroundColor: '#fff', marginBottom: 40, overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                <SettingsRow 
                    icon={<ClockIcon size={26} weight="regular" style={{ color: '#333' }} />}
                    title={t('settings.viewingActivity', { defaultValue: 'Viewing activity' })}
                    subtitle={t('settings.manageHistoryRatings', { defaultValue: 'Manage viewing history and ratings' })}
                    onClick={() => navigate('/settings/activity')}
                    isLast={true}
                />
            </div>

            {/* Section 4: Auth Management */}
            <div style={{ border: '1px solid #d1d5db', borderRadius: 8, backgroundColor: '#fff', overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                <SettingsRow 
                    icon={<SignOutIcon size={26} weight="regular" style={{ color: '#333' }} />}
                    title={t('nav.signOut')}
                    onClick={() => { logout(); navigate('/'); }}
                    isLast={true}
                />
            </div>

        </div>
    );
};

export default AccountSection;
