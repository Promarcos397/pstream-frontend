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
        <div style={{ color: '#111' }}>
            <div style={{ marginBottom: 24 }}>
                <SettingsToggle
                    label={t('playback.autoplayPreviews')}
                    subLabel={t('playback.autoplayPreviewsDesc')}
                    checked={settings.autoplayPreviews}
                    onChange={() => updateSettings({ autoplayPreviews: !settings.autoplayPreviews })}
                    darkTheme={false}
                />
            </div>

            <div style={{ height: 1, backgroundColor: '#f0f0f0', marginBottom: 24 }} />

            <div style={{ marginBottom: 24 }}>
                <SettingsToggle
                    label={t('playback.autoplayNext')}
                    subLabel={t('playback.autoplayNextDesc')}
                    checked={settings.autoplayNextEpisode}
                    onChange={() => updateSettings({ autoplayNextEpisode: !settings.autoplayNextEpisode })}
                    darkTheme={false}
                />
            </div>

            <div style={{ height: 1, backgroundColor: '#f0f0f0', marginBottom: 24 }} />

            <p style={{ fontSize: 14, color: '#737373', lineHeight: 1.6 }}>
                {t('playback.dataNote')}
            </p>
        </div>
    );
};

export default PlaybackSection;
