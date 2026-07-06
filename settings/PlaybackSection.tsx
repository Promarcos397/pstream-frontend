import React from 'react';
import { useTranslation } from 'react-i18next';
import { AppSettings } from '../types';
import { SettingsToggle } from '../ui/SettingsUI';
import { useIsMobile } from '../hooks/useIsMobile';
import { useGlobalContext } from '../context/GlobalContext';
import { DEFAULT_AVATAR } from '../constants';
import KidsAvatar from '../components/profiles/KidsAvatar';

interface PlaybackSectionProps {
    settings: AppSettings;
    updateSettings: (s: Partial<AppSettings>) => void;
}

const PlaybackSection: React.FC<PlaybackSectionProps> = ({ settings, updateSettings }) => {
    const { t } = useTranslation();
    const isMobile = useIsMobile(768);
    const { activeProfile } = useGlobalContext();

    return (
        <div className="text-white md:text-gray-900 space-y-8 animate-fadeIn">
            {activeProfile && (
                <div className="flex items-center gap-2.5 -mb-2">
                    <span className="text-[15px] text-white/50 md:text-gray-500 font-medium">
                        {t('settings.forProfile', { defaultValue: 'For {{name}}', name: activeProfile.name })}
                    </span>
                    <div className="w-6 h-6 rounded overflow-hidden shrink-0">
                        {activeProfile.isKids && !activeProfile.avatarUrl
                            ? <KidsAvatar size={24} />
                            : <img src={activeProfile.avatarUrl || DEFAULT_AVATAR} alt="" className="w-full h-full object-cover" />}
                    </div>
                </div>
            )}

            {/* Autoplay and transitions */}
            <section>
                <h2 className="text-[13px] font-bold text-white/40 md:text-gray-500 uppercase tracking-wider mb-3">
                    {t('playback.autoplaySection', { defaultValue: 'Autoplay and transitions' })}
                </h2>
                <div className="border border-white/10 md:border-gray-200 rounded-lg bg-white/5 md:bg-white divide-y divide-white/8 md:divide-gray-100 px-5">
                    <SettingsToggle
                        label={t('playback.autoplayNext')}
                        subLabel={t('playback.autoplayNextDesc')}
                        checked={settings.autoplayNextEpisode}
                        onChange={() => updateSettings({ autoplayNextEpisode: !settings.autoplayNextEpisode })}
                        darkTheme={isMobile}
                    />
                    <SettingsToggle
                        label={t('playback.autoplayPreviews')}
                        subLabel={t('playback.autoplayPreviewsDesc')}
                        checked={settings.autoplayPreviews}
                        onChange={() => updateSettings({ autoplayPreviews: !settings.autoplayPreviews })}
                        darkTheme={isMobile}
                    />
                    <SettingsToggle
                        label={t('playback.autoplayVideo')}
                        subLabel={t('playback.autoplayVideoDesc')}
                        checked={settings.autoplayVideo}
                        onChange={() => updateSettings({ autoplayVideo: !settings.autoplayVideo })}
                        darkTheme={isMobile}
                    />
                </div>
            </section>

            <p className="text-sm text-white/40 md:text-gray-500 leading-relaxed max-w-lg">
                {t('playback.dataNote')}
            </p>
        </div>
    );
};

export default PlaybackSection;
