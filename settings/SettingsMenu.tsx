import React, { useState } from 'react';
import { TranslateIcon, SubtitlesIcon, PlayCircleIcon, CaretRightIcon, ClockIcon, ShieldCheckIcon, IdentificationCardIcon } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { useGlobalContext } from '../context/GlobalContext';

export type SettingsView = 'menu' | 'profile' | 'appearance' | 'playback' | 'subtitle' | 'language' | 'account' | 'activity' | 'privacy' | 'transfer';

interface SettingsMenuProps {
    onNavigate: (view: SettingsView) => void;
}

/* Tiny gray user silhouette for broken images */
const FALLBACK_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23ddd'/%3E%3Ccircle cx='50' cy='38' r='18' fill='%23bbb'/%3E%3Cellipse cx='50' cy='85' rx='28' ry='22' fill='%23bbb'/%3E%3C/svg%3E";

/* ── Small avatar component with bulletproof sizing ──── */
const Avatar: React.FC<{ src?: string; size?: number }> = ({ src, size = 44 }) => {
    const [failed, setFailed] = useState(false);
    return (
        <div
            className="rounded overflow-hidden shrink-0"
            style={{ width: size, height: size, minWidth: size, minHeight: size, backgroundColor: '#ddd' }}
        >
            <img
                src={failed ? FALLBACK_AVATAR : (src || FALLBACK_AVATAR)}
                alt=""
                width={size}
                height={size}
                style={{ width: size, height: size, objectFit: 'cover', display: 'block' }}
                onError={() => setFailed(true)}
            />
        </div>
    );
};

/* ── Reusable menu row ─────────────────────────────────────── */
const MenuRow: React.FC<{
    icon: React.ReactNode;
    label: string;
    sub: string;
    onClick: () => void;
}> = ({ icon, label, sub, onClick }) => (
    <button
        onClick={onClick}
        className="w-full flex items-center gap-5 px-5 py-[18px] text-left hover:bg-gray-50 active:bg-gray-100 transition-colors group"
    >
        <span className="text-gray-400 shrink-0">{icon}</span>
        <div className="flex-1 min-w-0">
            <span className="block text-[15px] font-bold leading-snug" style={{ color: '#111' }}>{label}</span>
            <span className="block text-[13px] leading-snug mt-0.5 truncate" style={{ color: '#737373' }}>{sub}</span>
        </div>
        <CaretRightIcon size={16} className="text-gray-300 shrink-0 group-hover:text-gray-500 transition-colors" />
    </button>
);

/* ── Main Menu ─────────────────────────────────────────────── */
const SettingsMenu: React.FC<SettingsMenuProps> = ({ onNavigate }) => {
    const { t } = useTranslation();
    const { settings } = useGlobalContext();

    return (
        <div className="space-y-8 animate-fadeIn">

            {/* ── Account card ──────────────────────────── */}
            <div className="rounded-lg overflow-hidden" style={{ backgroundColor: '#fff', border: '1px solid #e5e5e5' }}>
                <button
                    onClick={() => onNavigate('account')}
                    className="w-full flex items-center gap-5 p-5 text-left hover:bg-gray-50 active:bg-gray-100 transition-colors group"
                >
                    <Avatar src={settings.avatarUrl} size={44} />
                    <div className="flex-1">
                        <span className="block text-[15px] font-bold" style={{ color: '#111' }}>{t('settings.manageAccount')}</span>
                        <span className="block text-[13px] mt-0.5" style={{ color: '#737373' }}>{t('settings.account')}</span>
                    </div>
                    <CaretRightIcon size={16} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
                </button>
            </div>

            {/* ── Preferences card ──────────────────────── */}
            <div>
                <h2 className="mb-3 ml-1" style={{ fontSize: '13px', fontWeight: 500, color: '#737373' }}>{t('settings.preferences')}</h2>
                <div className="rounded-lg overflow-hidden divide-y" style={{ backgroundColor: '#fff', border: '1px solid #e5e5e5', borderColor: '#e5e5e5' }}>
                    <MenuRow
                        icon={<TranslateIcon size={24} />}
                        label={t('settings.languages')}
                        sub={t('settings.languagesSub')}
                        onClick={() => onNavigate('language')}
                    />
                    <MenuRow
                        icon={<SubtitlesIcon size={24} />}
                        label={t('settings.subtitleAppearance')}
                        sub={t('settings.subtitleAppearanceSub')}
                        onClick={() => onNavigate('subtitle')}
                    />
                    <MenuRow
                        icon={<PlayCircleIcon size={24} />}
                        label={t('settings.playbackSettings')}
                        sub={t('settings.playbackSettingsSub')}
                        onClick={() => onNavigate('playback')}
                    />
                    <MenuRow
                        icon={<ClockIcon size={24} />}
                        label={t('settings.viewingActivity')}
                        sub={t('settings.viewingActivitySub')}
                        onClick={() => onNavigate('activity')}
                    />
                    <MenuRow
                        icon={<ShieldCheckIcon size={24} />}
                        label={t('settings.privacy')}
                        sub={t('settings.privacySub')}
                        onClick={() => onNavigate('privacy')}
                    />
                    <MenuRow
                        icon={<IdentificationCardIcon size={24} />}
                        label={t('settings.profileTransfer')}
                        sub={t('settings.profileTransferSub')}
                        onClick={() => onNavigate('transfer')}
                    />
                </div>
            </div>
        </div>
    );
};

export default SettingsMenu;
