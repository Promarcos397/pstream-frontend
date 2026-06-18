import React from 'react';
import { useTranslation } from 'react-i18next';
import { AppSettings } from '../types';
import { SettingsToggle } from '../ui/SettingsUI';

interface PlaybackSettingsProps {
    settings: AppSettings;
    updateSettings: (s: Partial<AppSettings>) => void;
}

const PlaybackSettings: React.FC<PlaybackSettingsProps> = ({ settings, updateSettings }) => {
    const { t } = useTranslation();
    return (
        <div className="space-y-6">
            <div className="border-b border-white/5 pb-2 mb-4">
                <h2 className="text-lg font-bold text-white">{t('settings.playbackSettings')}</h2>
                <p className="text-xs text-gray-500">{t('settings.playbackSettingsSub')}</p>
            </div>

            <div className="grid grid-cols-1 gap-4">
                <SettingsToggle
                    label={t('player.autoplayVideo')}
                    subLabel={t('player.autoplayVideoDesc')}
                    checked={settings.autoplayVideo}
                    onChange={() => updateSettings({ autoplayVideo: !settings.autoplayVideo })}
                    icon="play_arrow"
                />
                <SettingsToggle
                    label={t('playback.autoplayPreviews')}
                    subLabel={t('playback.autoplayPreviewsDesc')}
                    checked={settings.autoplayPreviews}
                    onChange={() => updateSettings({ autoplayPreviews: !settings.autoplayPreviews })}
                    icon="play_circle_filled"
                />
                <SettingsToggle
                    label={t('playback.autoplayNext')}
                    subLabel={t('playback.autoplayNextDesc')}
                    checked={settings.autoplayNextEpisode}
                    onChange={() => updateSettings({ autoplayNextEpisode: !settings.autoplayNextEpisode })}
                    icon="queue_play_next"
                />
            </div>
        </div>
    );
};

export default PlaybackSettings;
