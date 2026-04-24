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
import { AppSettings } from '../types';
import { useTranslation } from 'react-i18next';
import { useGlobalContext } from '../context/GlobalContext';
import { DEFAULT_AVATAR } from '../constants';
import pstreamLogo from '../assets/logos/pstream-logo.svg';

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
            className={`rounded overflow-hidden shrink-0 transition-transform active:scale-95 ${className} ${onClick ? 'cursor-pointer' : ''}`}
            style={{ width: size, height: size, minWidth: size, backgroundColor: '#ddd' }}
            onClick={onClick}
        >
            <SafeImage
                src={src}
                className="w-full h-full object-cover block"
                style={{ width: size, height: size }}
            />
        </div>
    );
};

import { useIsMobile } from '../hooks/useIsMobile';

/* ── Main Settings Layout ──────────────────────────────────── */
const SettingsLayout: React.FC<SettingsLayoutProps> = ({ settings, updateSettings, continueWatching }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { user } = useGlobalContext();
    const isMobile = useIsMobile(1024); // Threshold for sidebar-like layout vs mobile stack

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
        <div className="relative min-h-screen bg-white flex flex-col font-inter">

            {/* ── Header ────────────────────────────────── */}
            <header className="h-16 border-b border-gray-100 flex items-center justify-between px-6 md:px-10 lg:px-16 bg-white sticky top-0 z-[100] pt-safe">
                <div onClick={() => navigate('/')} className="cursor-pointer h-8 flex items-center">
                    <img 
                        src={pstreamLogo}
                        alt="Pstream" 
                        className="h-6 md:h-8 w-auto"
                        onError={(e) => { (e.target as any).style.display = 'none'; }}
                    />
                </div>
                {user && (
                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/settings')}>
                        <Avatar src={settings.avatarUrl} size={30} />
                    </div>
                )}
            </header>

            {/* ── Main Content Area (Centered) ────────────────── */}
            <main className={`w-full max-w-[1100px] mx-auto px-6 lg:px-12 py-8 md:py-12 flex flex-col lg:flex-row gap-8 lg:gap-16`}>
                
                {/* Back Arrow Column */}
                <div className="flex-shrink-0 lg:pt-1.5 flex items-center lg:items-start animate-slideInLeft">
                    <button 
                        onClick={handleBack}
                        className="p-2 lg:p-0 -ml-2 lg:ml-0 bg-transparent border-none text-gray-900 cursor-pointer hover:scale-110 active:scale-95 transition-transform"
                    >
                        <ArrowLeftIcon size={28} weight="bold" />
                    </button>
                    {isMobile && currentView !== 'overview' && (
                        <h2 className="ml-2 text-lg md:text-xl font-bold text-gray-900 truncate max-w-[250px]">
                            {title}
                        </h2>
                    )}
                </div>

                {/* Content Column */}
                <div className="flex-1 w-full lg:max-w-[750px]">
                    {!isMobile && (
                        <h1 className="text-3xl md:text-3xl font-black text-gray-900 tracking-tight mb-8">
                            {title}
                        </h1>
                    )}

                    <div className="animate-fadeIn">
                        {renderContent()}
                    </div>
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
        <div className="text-gray-900 max-w-[640px] w-full animate-fadeIn">
            {/* Avatar + Name row */}
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-8 sm:gap-7 mb-10 mt-5">
                {/* Clickable avatar */}
                <div
                    className="relative cursor-pointer w-[120px] h-[120px] rounded-md overflow-hidden bg-gray-200 shrink-0 shadow-sm group hover:ring-4 hover:ring-gray-100 transition-all active:scale-95"
                    onClick={() => navigate('/settings/profile/avatar')}
                >
                    <img
                        src={avatarSrc} alt=""
                        className="w-full h-full object-cover block"
                        onError={() => setImgFailed(true)}
                    />
                    {/* Pencil overlay */}
                    <div className="absolute bottom-2 left-2 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <PencilSimpleIcon size={14} weight="bold" className="text-white" />
                    </div>
                </div>

                {/* Name input - Labeled Box Style */}
                <div className="flex-1 w-full flex flex-col gap-4">
                    <div className="border border-gray-400 rounded-sm px-3.5 pt-1.5 pb-2 transition-shadow duration-200 bg-white focus-within:ring-2 focus-within:ring-black">
                        <label className="block text-[11px] text-gray-500 mb-0.5 font-medium">
                            {t('settings.profileName', { defaultValue: 'Profile name' })}
                        </label>
                        <input
                            type="text"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            onBlur={handleSaveName}
                            placeholder={t('settings.enterName', { defaultValue: 'Enter your name' })}
                            className="w-full p-0 border-none text-[15px] md:text-[16px] font-medium text-gray-900 outline-none bg-transparent"
                        />
                    </div>
                    <p className="text-[13px] text-gray-500 leading-relaxed max-w-md">
                        {t('settings.nameVisibilityDesc', { defaultValue: 'This name will be shown on all your profiles and shared watch lists.' })}
                    </p>
                </div>
            </div>

            <div className="h-px bg-gray-200 mb-10 w-full" />

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4">
                <button
                    onClick={() => { handleSaveName(); navigate('/settings/overview'); }}
                    className="px-12 py-3 bg-[#111] text-white border-none rounded-sm text-base font-bold cursor-pointer hover:bg-black transition-colors active:scale-95"
                >
                    {t('common.save', { defaultValue: 'Save' })}
                </button>
                <button
                    onClick={() => navigate('/settings/overview')}
                    className="px-12 py-3 bg-transparent text-gray-600 border border-gray-300 rounded-sm text-base font-bold cursor-pointer hover:bg-gray-50 transition-colors active:scale-95"
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
const ProfileAvatarPage: React.FC<{ settings: AppSettings; updateSettings: (s: Partial<AppSettings>) => void }> = ({ settings, updateSettings }) => {
    const navigate = useNavigate();
    const { t } = useTranslation();

    const handleSelectAvatar = (url: string) => {
        updateSettings({ avatarUrl: url });
        navigate('/settings/profile/edit');
    };

    return (
        <div className="text-gray-900 max-w-[1100px] w-full animate-fadeIn pb-20">
            {/* Current avatar — "History" row */}
            {settings.avatarUrl && (
                <div className="mb-12">
                    <h3 className="text-xl md:text-2xl font-bold text-gray-900 mb-4 px-1">
                        {t('settings.history', { defaultValue: 'History' })}
                    </h3>
                    <div className="px-1">
                        <div 
                            className="w-[114px] h-[114px] rounded-md overflow-hidden border-[3px] border-gray-900 bg-gray-200 shadow-md"
                        >
                            <SafeImage src={settings.avatarUrl} className="w-full h-full object-cover block" />
                        </div>
                    </div>
                </div>
            )}

            {/* Category rows */}
            {AVATAR_CATEGORIES.map((category) => (
                <div key={category.id} className="mb-12 relative group/row">
                    <h3 className="text-xl md:text-2xl font-bold text-gray-900 mb-4 px-1">
                        {category.name}
                    </h3>
                    
                    {/* Horizontal scroll container */}
                    <div className="relative">
                        <div 
                            className="flex gap-4 overflow-x-auto py-1 px-1 scroll-smooth hide-scrollbar -webkit-overflow-scrolling-touch"
                            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                        >
                            {category.avatars.map((avatar) => {
                                const isSelected = settings.avatarUrl === avatar.url;
                                return (
                                    <div
                                        key={avatar.url}
                                        onClick={() => handleSelectAvatar(avatar.url)}
                                        title={avatar.name}
                                        className={`w-[114px] h-[114px] min-w-[114px] rounded-md overflow-hidden cursor-pointer transition-all duration-300 bg-gray-200 shadow-sm
                                            ${isSelected ? 'ring-4 ring-gray-900 scale-[0.98]' : 'hover:scale-[1.05]'}`}
                                    >
                                        <SafeImage
                                            src={avatar.url} alt={avatar.name}
                                            className="w-full h-full object-cover block"
                                        />
                                    </div>
                                );
                            })}
                        </div>
                        
                        {/* Right fade indicator - hidden on scroll if possible but simple CSS fade works best */}
                        <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-white/90 to-transparent pointer-events-none rounded-r-md hidden sm:block" />
                    </div>
                </div>
            ))}
        </div>
    );
};

export default SettingsLayout;
