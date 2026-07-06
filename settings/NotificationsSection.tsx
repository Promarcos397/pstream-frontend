import React from 'react';
import { useTranslation } from 'react-i18next';
import { AppSettings } from '../types';
import { ToggleSwitch } from '../ui/SettingsUI';

interface NotificationsSectionProps {
    settings: AppSettings;
    updateSettings: (s: Partial<AppSettings>) => void;
}

/**
 * Netflix's real Notification Settings page mostly configures push/email
 * delivery, which this app has no backend for — so this only exposes the one
 * notification-adjacent behavior that's actually real: the "New Episodes" /
 * "Recently Added" ribbons shown on cards throughout the app.
 */
const NotificationsSection: React.FC<NotificationsSectionProps> = ({ settings, updateSettings }) => {
    const { t } = useTranslation();

    return (
        <div className="text-white md:text-gray-900 animate-fadeIn">
            <div className="border border-white/10 md:border-gray-200 rounded-lg bg-white/5 md:bg-white overflow-hidden shadow-sm">
                <div className="flex items-center justify-between gap-4 p-5">
                    <div>
                        <span className="block text-[16px] font-bold text-white md:text-gray-900">
                            {t('settings.newContentBadges', { defaultValue: 'New & Recently Added badges' })}
                        </span>
                        <p className="text-[13px] text-white/40 md:text-gray-500 mt-0.5 max-w-md leading-relaxed">
                            {t('settings.newContentBadgesDesc', { defaultValue: 'Show "New Episodes" and "Recently Added" ribbons on titles across the app.' })}
                        </p>
                    </div>
                    <ToggleSwitch
                        checked={settings.showNewContentBadges}
                        onChange={() => updateSettings({ showNewContentBadges: !settings.showNewContentBadges })}
                    />
                </div>
            </div>
        </div>
    );
};

export default NotificationsSection;
