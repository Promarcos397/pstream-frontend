import React from 'react';
import { useTranslation } from 'react-i18next';
import { AppSettings } from '../types';
import { SettingsToggle } from '../ui/SettingsUI';

interface PlaybackSectionProps {
    settings: AppSettings;
    updateSettings: (s: Partial<AppSettings>) => void;
}

const PlaybackSection: React.FC<PlaybackSectionProps> = ({ settings, updateSettings }) => {
    const { t } = useTranslation();

    return (
        <div className="text-gray-900 space-y-6 animate-fadeIn">
            <div>
                <SettingsToggle
                    label={t('playback.autoplayPreviews')}
                    subLabel={t('playback.autoplayPreviewsDesc')}
                    checked={settings.autoplayPreviews}
                    onChange={() => updateSettings({ autoplayPreviews: !settings.autoplayPreviews })}
                    darkTheme={false}
                />
            </div>

            <div className="h-px bg-gray-100" />

            <div>
                <SettingsToggle
                    label={t('playback.autoplayNext')}
                    subLabel={t('playback.autoplayNextDesc')}
                    checked={settings.autoplayNextEpisode}
                    onChange={() => updateSettings({ autoplayNextEpisode: !settings.autoplayNextEpisode })}
                    darkTheme={false}
                />
            </div>

            <div className="h-px bg-gray-100" />

            <p className="text-sm text-gray-500 leading-relaxed max-w-lg">
                {t('playback.dataNote')}
            </p>
        </div>
    );
};

export default PlaybackSection;
