import React from 'react';
import { useTranslation } from 'react-i18next';
import { AppSettings } from '../types';
import { SettingsToggle } from '../ui/SettingsUI';
import { useIsMobile } from '../hooks/useIsMobile';

interface PlaybackSectionProps {
    settings: AppSettings;
    updateSettings: (s: Partial<AppSettings>) => void;
}

const PlaybackSection: React.FC<PlaybackSectionProps> = ({ settings, updateSettings }) => {
    const { t } = useTranslation();
    const isMobile = useIsMobile(768);

    return (
        <div className="text-white md:text-gray-900 space-y-6 animate-fadeIn">
            <div>
                <SettingsToggle
                    label={t('playback.autoplayVideo')}
                    subLabel={t('playback.autoplayVideoDesc')}
                    checked={settings.autoplayVideo}
                    onChange={() => updateSettings({ autoplayVideo: !settings.autoplayVideo })}
                    darkTheme={isMobile}
                />
            </div>

            <div className="h-px bg-white/10 md:bg-gray-100" />

            <div>
                <SettingsToggle
                    label={t('playback.autoplayPreviews')}
                    subLabel={t('playback.autoplayPreviewsDesc')}
                    checked={settings.autoplayPreviews}
                    onChange={() => updateSettings({ autoplayPreviews: !settings.autoplayPreviews })}
                    darkTheme={isMobile}
                />
            </div>

            <div className="h-px bg-white/10 md:bg-gray-100" />

            <div>
                <SettingsToggle
                    label={t('playback.autoplayNext')}
                    subLabel={t('playback.autoplayNextDesc')}
                    checked={settings.autoplayNextEpisode}
                    onChange={() => updateSettings({ autoplayNextEpisode: !settings.autoplayNextEpisode })}
                    darkTheme={isMobile}
                />
            </div>

            <div className="h-px bg-white/10 md:bg-gray-100" />

            <p className="text-sm text-white/40 md:text-gray-500 leading-relaxed max-w-lg">
                {t('playback.dataNote')}
            </p>
        </div>
    );
};

export default PlaybackSection;
