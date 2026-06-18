import React from 'react';
import { useTranslation } from 'react-i18next';
import { AppSettings } from '../types';

interface AppearanceSectionProps {
    settings: AppSettings;
    updateSettings: (s: Partial<AppSettings>) => void;
}

const AppearanceSection: React.FC<AppearanceSectionProps> = ({ settings, updateSettings }) => {
    const { t } = useTranslation();
    return (
        <div className="space-y-12 animate-fadeIn font-bold">

            {/* Field 1 */}
            <div>
                <h3 className="text-xl md:text-2xl text-white mb-2">{t('settings.profileName', { defaultValue: 'Profile Name' })}</h3>
                <p className="text-lg text-gray-400">{t('settings.guestUser', { defaultValue: 'Guest User' })}</p>
            </div>

            {/* Field 2 */}
            <div>
                <h3 className="text-xl md:text-2xl text-white mb-2">{t('playback.autoplayPreviews')}</h3>
                <button
                    onClick={() => updateSettings({ autoplayPreviews: !settings.autoplayPreviews })}
                    className="text-lg text-gray-400 hover:text-white transition-colors text-left"
                >
                    {settings.autoplayPreviews ? t('common.on', { defaultValue: 'On' }) : t('common.off', { defaultValue: 'Off' })}
                </button>
            </div>

            {/* Field 3 */}
            <div>
                <h3 className="text-xl md:text-2xl text-white mb-2">{t('settings.displayLanguage')}</h3>
                <p className="text-lg text-gray-400">US / en-US</p>
            </div>

            <div className="pt-8 border-t border-white/20">
                <p className="text-gray-500">{t('settings.memberSince', { defaultValue: 'Member since 2024' })}</p>
            </div>

        </div>
    );
};

export default AppearanceSection;
