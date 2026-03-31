import React, { useState } from 'react';
import { TranslateIcon, SubtitlesIcon, PlayCircleIcon, CaretRightIcon, ClockIcon, ShieldCheckIcon, IdentificationCardIcon } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { useGlobalContext } from '../context/GlobalContext';

export type SettingsView = 'menu' | 'profile' | 'appearance' | 'playback' | 'subtitle' | 'language' | 'account' | 'activity' | 'privacy' | 'transfer';

interface SettingsMenuProps {
    onNavigate: (view: SettingsView) => void;
}

const FALLBACK_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23ddd'/%3E%3Ccircle cx='50' cy='38' r='18' fill='%23bbb'/%3E%3Cellipse cx='50' cy='85' rx='28' ry='22' fill='%23bbb'/%3E%3C/svg%3E";

const Avatar: React.FC<{ src?: string; size?: number }> = ({ src, size = 44 }) => {
    const [failed, setFailed] = useState(false);
    return (
        <div
            className="rounded-md overflow-hidden shrink-0 border border-gray-100 shadow-sm"
            style={{ width: size, height: size, minWidth: size, minHeight: size, backgroundColor: '#f1f5f9' }}
        >
            <img
                src={failed ? FALLBACK_AVATAR : (src || FALLBACK_AVATAR)}
                alt=""
                className="w-full h-full object-cover block"
                onError={() => setFailed(true)}
            />
        </div>
    );
};

const MenuRow: React.FC<{
    icon: React.ReactNode;
    label: string;
    sub: string;
    onClick: () => void;
}> = ({ icon, label, sub, onClick }) => (
    <button
        onClick={onClick}
        className="w-full flex items-center gap-5 px-5 py-5 text-left hover:bg-gray-50 active:bg-gray-100 transition-all group outline-none focus:bg-gray-50"
    >
        <span className="text-gray-400 group-hover:text-black transition-colors shrink-0">{icon}</span>
        <div className="flex-1 min-w-0">
            <span className="block text-[15px] font-bold text-gray-900 group-hover:translate-x-0.5 transition-transform">{label}</span>
            <span className="block text-[13px] text-gray-500 mt-0.5 truncate font-medium">{sub}</span>
        </div>
        <CaretRightIcon size={16} className="text-gray-300 shrink-0 group-hover:text-gray-600 group-hover:translate-x-1 transition-all" weight="bold" />
    </button>
);

const SettingsMenu: React.FC<SettingsMenuProps> = ({ onNavigate }) => {
    const { t } = useTranslation();
    const { settings } = useGlobalContext();

    return (
        <div className="space-y-10 animate-fadeIn h-full pb-20">

            {/* ── Account card ──────────────────────────── */}
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden transform transition-all hover:shadow-md hover:border-gray-300">
                <button
                    onClick={() => onNavigate('account')}
                    className="w-full flex items-center gap-5 p-6 text-left transition-colors hover:bg-gray-50 group active:scale-[0.99]"
                >
                    <Avatar src={settings.avatarUrl} size={52} />
                    <div className="flex-1">
                        <span className="block text-base font-bold text-gray-900">{t('settings.manageAccount')}</span>
                        <span className="block text-[13px] text-gray-500 mt-1 font-medium">{t('settings.account')}</span>
                    </div>
                    <CaretRightIcon size={18} className="text-gray-300 group-hover:text-gray-600 transition-colors" weight="bold" />
                </button>
            </div>

            {/* ── Preferences Section ───────────────────── */}
            <div>
                <h2 className="text-[13px] font-bold text-gray-400 uppercase tracking-widest mb-4 ml-1">
                    {t('settings.preferences')}
                </h2>
                <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden divide-y divide-gray-100">
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
