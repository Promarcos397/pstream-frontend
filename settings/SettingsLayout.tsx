import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    ArrowLeftIcon, HouseIcon, UserCircleIcon, TranslateIcon,
    SubtitlesIcon, PlayCircleIcon, ClockIcon, ShieldCheckIcon,
    IdentificationCardIcon, CaretDownIcon, KeyIcon, SignOutIcon,
    PencilSimpleIcon
} from '@phosphor-icons/react';
import SubtitleSection from './SubtitleSection';
import PlaybackSection from './PlaybackSection';
import LanguageSection from './LanguageSection';
import AccountSection from './AccountSection';
import ViewingActivitySection from './ViewingActivitySection';
import PrivacySection from './PrivacySection';
import ProfileTransferSection from './ProfileTransferSection';
import ProfileSection from './ProfileSection';
import { AppSettings } from '../types';
import { useTranslation } from 'react-i18next';
import { useGlobalContext } from '../context/GlobalContext';
import { DEFAULT_AVATAR } from '../constants';

interface SettingsLayoutProps {
    settings: AppSettings;
    updateSettings: (s: Partial<AppSettings>) => void;
    continueWatching: any[];
    onReset: () => void;
}

const FALLBACK_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23ddd'/%3E%3Ccircle cx='50' cy='38' r='18' fill='%23bbb'/%3E%3Cellipse cx='50' cy='85' rx='28' ry='22' fill='%23bbb'/%3E%3C/svg%3E";

/* ── Sidebar navigation items ──────────────────────────────── */
type SettingsView = 'overview' | 'profiles' | 'profile-edit' | 'profile-avatar' | 'language' | 'subtitle' | 'playback' | 'activity' | 'privacy' | 'transfer';

interface NavItem {
    id: SettingsView;
    icon: React.ReactNode;
    label: string;
    requiresAuth?: boolean;
}

/* ── Safe Image component to handle fallbacks ──────────────── */
const SafeImage: React.FC<{ src?: string; alt?: string; style?: React.CSSProperties; className?: string }> = ({ src, alt, style, className }) => {
    const [failed, setFailed] = useState(false);
    return (
        <img
            src={failed || !src ? FALLBACK_AVATAR : src}
            alt={alt || ""}
            className={className}
            style={style}
            onError={() => setFailed(true)}
            referrerPolicy="no-referrer"
        />
    );
};

/* ── Avatar component ──────────────────────────────────────── */
const Avatar: React.FC<{ src?: string; size?: number; className?: string; onClick?: () => void }> = ({ src, size = 36, className = '', onClick }) => {
    return (
        <div
            className={`rounded overflow-hidden shrink-0 ${className}`}
            style={{ width: size, height: size, minWidth: size, backgroundColor: '#ddd', cursor: onClick ? 'pointer' : undefined }}
            onClick={onClick}
        >
            <SafeImage
                src={src}
                style={{ width: size, height: size, objectFit: 'cover', display: 'block' }}
            />
        </div>
    );
};

/* ── Main Settings Layout ──────────────────────────────────── */
const SettingsLayout: React.FC<SettingsLayoutProps> = ({ settings, updateSettings, continueWatching }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { settings: globalSettings, user } = useGlobalContext();

    // Parse the current view from URL
    const pathParts = location.pathname.replace(/\/$/, '').split('/');
    const segments = pathParts.slice(2); // after /settings/
    let currentView: SettingsView = 'overview';
    if (segments.length >= 2 && segments[0] === 'profile') {
        if (segments[1] === 'edit' || segments[1] === 'profiles') currentView = 'profile-edit';
        else if (segments[1] === 'avatar') currentView = 'profile-avatar';
        else currentView = 'profile-edit';
    } else if (segments.length >= 1 && segments[0]) {
        const viewMap: Record<string, SettingsView> = {
            'profiles': 'profile-edit', 
            'language': 'language', 
            'subtitle': 'subtitle',
            'playback': 'playback', 
            'activity': 'activity', 
            'privacy': 'privacy',
            'transfer': 'transfer', 
            'account': 'overview',
        };
        currentView = viewMap[segments[0]] || 'overview';
    }

    const handleBack = () => {
        if (currentView === 'overview') {
            navigate('/');
        } else if (currentView === 'profile-edit' || currentView === 'profile-avatar') {
            navigate('/settings/overview');
        } else {
            navigate('/settings/overview');
        }
    };

    /* ── Page titles ──────────────────────────────────────────── */
    const getTitle = (): { title: string; subtitle: string | null } => {
        switch (currentView) {
            case 'overview': return { title: t('settings.manageAccountPreferences', { defaultValue: 'Manage profile and preferences' }), subtitle: null };
            case 'profile-edit': return { title: t('settings.profile', { defaultValue: 'Profile' }), subtitle: t('settings.editProfile', { defaultValue: 'Edit profile' }) };
            case 'profile-avatar': return { title: t('settings.chooseIcon', { defaultValue: 'Choose profile icon' }), subtitle: null };
            case 'language': return { title: t('settings.languages', { defaultValue: 'Languages' }), subtitle: t('settings.languagesSub', { defaultValue: 'Set languages for display and audio' }) };
            case 'subtitle': return { title: t('settings.subtitleAppearance', { defaultValue: 'Subtitle appearance' }), subtitle: t('settings.subtitleAppearanceSub', { defaultValue: 'Customize the way subtitles appear' }) };
            case 'playback': return { title: t('settings.playbackSettings', { defaultValue: 'Playback settings' }), subtitle: t('settings.playbackSettingsSub', { defaultValue: 'Set autoplay and audio, video quality' }) };
            case 'activity': return { title: t('settings.viewingActivity', { defaultValue: 'Viewing activity' }), subtitle: t('settings.viewingActivitySub', { defaultValue: 'Manage viewing history and ratings' }) };
            case 'privacy': return { title: t('settings.privacy', { defaultValue: 'Privacy and data settings' }), subtitle: t('settings.privacySub', { defaultValue: 'Manage usage of personal information' }) };
            case 'transfer': return { title: t('settings.profileTransfer', { defaultValue: 'Profile transfer' }), subtitle: t('settings.profileTransferSub', { defaultValue: 'Copy this profile to another account' }) };
            default: return { title: 'Settings', subtitle: null };
        }
    };

    const { title } = getTitle();

    /* ── Render page content ──────────────────────────────────── */
    const renderContent = () => {
        // Protection for guest users
        const isProtected = ['profile-edit', 'profile-avatar', 'activity', 'privacy', 'transfer'].includes(currentView);
        if (isProtected && !user) {
            return <AccountSection />;
        }

        switch (currentView) {
            case 'profile-edit':
                return <ProfileEditPage settings={settings} updateSettings={updateSettings} />;
            case 'profile-avatar':
                return <ProfileAvatarPage settings={settings} updateSettings={updateSettings} />;
            case 'language':
                return <LanguageSection settings={settings} updateSettings={updateSettings} />;
            case 'subtitle':
                return <SubtitleSection settings={settings} updateSettings={updateSettings} continueWatching={continueWatching} />;
            case 'playback':
                return <PlaybackSection settings={settings} updateSettings={updateSettings} />;
            case 'activity':
                return <ViewingActivitySection />;
            case 'privacy':
                return <PrivacySection />;
            case 'transfer':
                return <ProfileTransferSection />;
            case 'overview':
            default:
                return <AccountSection />;
        }
    };

    return (
        <div style={{ position: 'relative', minHeight: '100vh', backgroundColor: '#fff', display: 'flex', flexDirection: 'column', fontFamily: 'Inter, sans-serif' }}>

            {/* ── Header ────────────────────────────────── */}
            <header style={{
                height: 64, borderBottom: '1px solid #e5e5e5',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0 40px', backgroundColor: '#fff', position: 'sticky', top: 0, zIndex: 100
            }}>
                <div onClick={() => navigate('/')} style={{ cursor: 'pointer', height: 32, display: 'flex', alignItems: 'center' }}>
                    <img 
                        src="/assets/pstream-logo.png" 
                        alt="P-STREAM" 
                        style={{ height: '32px', width: 'auto' }} 
                        onError={(e) => { (e.target as any).style.display = 'none'; }}
                    />
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }} onClick={() => navigate('/settings')}>
                    <Avatar src={settings.avatarUrl} size={32} />
                </div>
            </header>

            {/* ── Main Content Area (Centered) ────────────────── */}
            <main style={{
                width: '100%', maxWidth: 950, margin: '0 auto',
                padding: '40px 24px 80px', display: 'flex', gap: 32
            }}>
                
                {/* Back Arrow Column */}
                <div style={{ paddingTop: 6, flexShrink: 0 }}>
                    <button 
                        onClick={handleBack}
                        style={{ background: 'none', border: 'none', color: '#111', cursor: 'pointer', padding: 0 }}
                    >
                        <ArrowLeftIcon size={26} weight="bold" />
                    </button>
                </div>

                {/* Content Column */}
                <div style={{ flex: 1, maxWidth: 800 }}>
                    <h1 style={{ fontSize: 32, fontWeight: 900, color: '#111', letterSpacing: '-0.5px', marginBottom: 32 }}>
                        {title}
                    </h1>

                    {renderContent()}
                </div>
            </main>
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════════
   PROFILE EDIT PAGE — Large avatar + name input
   ═══════════════════════════════════════════════════════════════ */
import { AVATAR_CATEGORIES } from '../constants';

const ProfileEditPage: React.FC<{ settings: AppSettings; updateSettings: (s: Partial<AppSettings>) => void }> = ({ settings, updateSettings }) => {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { user } = useGlobalContext();
    const [displayName, setDisplayName] = useState(settings.displayName || user?.display_name || '');
    const [imgFailed, setImgFailed] = useState(false);
    const avatarSrc = imgFailed ? FALLBACK_AVATAR : (settings.avatarUrl || DEFAULT_AVATAR);

    const handleSaveName = async () => {
        const trimmed = displayName.trim();
        updateSettings({ displayName: trimmed || undefined });
        // Also push display_name to the Supabase profiles row so it persists
        if (trimmed) {
            try {
                const { AuthService } = await import('../services/AuthService');
                await AuthService.syncProfile({ display_name: trimmed } as any);
            } catch (e) {
                console.warn('[ProfileEdit] Could not sync display_name to Supabase:', e);
            }
        }
    };

    return (
        <div style={{ color: '#111', maxWidth: 640 }}>
            {/* Avatar + Name row */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 28, marginBottom: 40, marginTop: 20 }}>
                {/* Clickable avatar */}
                <div
                    style={{ position: 'relative', cursor: 'pointer', width: 120, height: 120, borderRadius: 6, overflow: 'hidden', backgroundColor: '#ddd', flexShrink: 0 }}
                    onClick={() => navigate('/settings/profile/avatar')}
                >
                    <img
                        src={avatarSrc} alt=""
                        style={{ width: 120, height: 120, objectFit: 'cover', display: 'block' }}
                        onError={() => setImgFailed(true)}
                    />
                    {/* Pencil overlay */}
                    <div style={{
                        position: 'absolute', bottom: 8, left: 8,
                        width: 28, height: 28, borderRadius: '50%',
                        backgroundColor: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <PencilSimpleIcon size={14} weight="bold" style={{ color: '#fff' }} />
                    </div>
                </div>

                {/* Name input - Labeled Box Style */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{
                        border: '1px solid #a3a3a3',
                        borderRadius: 2,
                        padding: '6px 14px 8px',
                        transition: 'box-shadow 0.2s ease',
                        backgroundColor: '#fff',
                    }}
                    onFocus={(e) => { e.currentTarget.style.boxShadow = '0 0 0 2px #111'; }}
                    onBlur={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
                    >
                        <label style={{ display: 'block', fontSize: 11, color: '#737373', marginBottom: 2, fontWeight: 500 }}>
                            {t('settings.profileName', { defaultValue: 'Profile name' })}
                        </label>
                        <input
                            type="text"
                            value={displayName}
                            autoFocus
                            onChange={(e) => setDisplayName(e.target.value)}
                            onBlur={handleSaveName}
                            placeholder={t('settings.enterName', { defaultValue: 'Enter your name' })}
                            style={{
                                width: '100%', padding: 0,
                                border: 'none',
                                fontSize: 15, fontWeight: 500, color: '#111', outline: 'none',
                                backgroundColor: 'transparent',
                            }}
                        />
                    </div>
                    <p style={{ fontSize: 13, color: '#737373', marginTop: -4 }}>
                        {t('settings.nameVisibilityDesc', { defaultValue: 'This name will be shown on all your profiles and shared watch lists.' })}
                    </p>
                </div>
            </div>

            <div style={{ height: 1, backgroundColor: '#e5e5e5', marginBottom: 40 }} />

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: 16 }}>
                <button
                    onClick={() => { handleSaveName(); navigate('/settings/overview'); }}
                    style={{
                        padding: '12px 48px',
                        backgroundColor: '#111', color: '#fff',
                        border: 'none', borderRadius: 2,
                        fontSize: 16, fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'background-color 0.2s',
                    }}
                >
                    {t('common.save', { defaultValue: 'Save' })}
                </button>
                <button
                    onClick={() => navigate('/settings/overview')}
                    style={{
                        padding: '12px 48px',
                        backgroundColor: 'transparent', color: '#525252',
                        border: '1px solid #d4d4d4', borderRadius: 2,
                        fontSize: 16, fontWeight: 700,
                        cursor: 'pointer',
                    }}
                >
                    {t('common.cancel', { defaultValue: 'Cancel' })}
                </button>
            </div>
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════════
   AVATAR PICKER PAGE — Horizontal scrollable rows by category
   ═══════════════════════════════════════════════════════════════ */
import { CaretRightIcon } from '@phosphor-icons/react';

const ProfileAvatarPage: React.FC<{ settings: AppSettings; updateSettings: (s: Partial<AppSettings>) => void }> = ({ settings, updateSettings }) => {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { settings: globalSettings } = useGlobalContext();

    const profileName = globalSettings.displayName || 'Guest';

    const handleSelectAvatar = (url: string) => {
        updateSettings({ avatarUrl: url });
        navigate('/settings/profile/edit');
    };

    return (
        <div style={{ color: '#111', maxWidth: 1100 }}>
            {/* Current avatar — "History" row */}
            {settings.avatarUrl && (
                <div style={{ marginBottom: 48 }}>
                    <h3 style={{ fontSize: 22, fontWeight: 700, color: '#111', marginBottom: 16 }}>
                        {t('settings.history', { defaultValue: 'History' })}
                    </h3>
                    <div style={{ display: 'flex', gap: 16 }}>
                        <div 
                            style={{
                                width: 114, height: 114, borderRadius: 4, overflow: 'hidden',
                                border: '3px solid #111', backgroundColor: '#ddd',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                            }}
                        >
                            <SafeImage src={settings.avatarUrl} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                        </div>
                    </div>
                </div>
            )}

            {/* Category rows */}
            {AVATAR_CATEGORIES.map((category) => (
                <div key={category.id} style={{ marginBottom: 48, position: 'relative' }}>
                    <h3 style={{ fontSize: 22, fontWeight: 700, color: '#111', marginBottom: 16 }}>
                        {category.name}
                    </h3>
                    
                    {/* Horizontal scroll container */}
                    <div style={{ position: 'relative' }}>
                        <div 
                            className="hide-scrollbar"
                            style={{
                                display: 'flex', gap: 16, overflowX: 'auto',
                                padding: '4px 0 12px',
                                scrollBehavior: 'smooth',
                                // Hide scrollbar for consistency with reference
                                scrollbarWidth: 'none',
                                msOverflowStyle: 'none',
                            }}
                        >
                            {category.avatars.map((avatar) => {
                                const isSelected = settings.avatarUrl === avatar.url;
                                return (
                                    <div
                                        key={avatar.url}
                                        onClick={() => handleSelectAvatar(avatar.url)}
                                        title={avatar.name}
                                        style={{
                                            width: 114, height: 114, minWidth: 114,
                                            borderRadius: 4, overflow: 'hidden',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s ease-in-out',
                                            backgroundColor: '#ddd',
                                            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                                            outline: isSelected ? '3px solid #111' : '3px solid transparent',
                                            outlineOffset: 2,
                                        }}
                                        onMouseEnter={(e) => {
                                            if (!isSelected) {
                                                e.currentTarget.style.transform = 'scale(1.05)';
                                                e.currentTarget.style.outlineColor = '#e5e5e5';
                                            }
                                        }}
                                        onMouseLeave={(e) => {
                                            if (!isSelected) {
                                                e.currentTarget.style.transform = 'scale(1)';
                                                e.currentTarget.style.outlineColor = 'transparent';
                                            }
                                        }}
                                    >
                                        <SafeImage
                                            src={avatar.url} alt={avatar.name}
                                            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                        
                        {/* Right fade indicator (Netflix style) */}
                        <div style={{
                            position: 'absolute', right: 0, top: 0, bottom: 12, width: 60,
                            background: 'linear-gradient(to left, rgba(255,255,255,0.9), transparent)',
                            pointerEvents: 'none',
                            borderRadius: '0 4px 4px 0',
                        }} />
                    </div>
                </div>
            ))}
        </div>
    );
};

export default SettingsLayout;
