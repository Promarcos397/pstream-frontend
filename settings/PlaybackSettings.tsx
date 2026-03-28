import React from 'react';
import { AppSettings } from '../types';
import { SettingsToggle } from '../ui/SettingsUI';

interface PlaybackSettingsProps {
    settings: AppSettings;
    updateSettings: (s: Partial<AppSettings>) => void;
}

const PlaybackSettings: React.FC<PlaybackSettingsProps> = ({ settings, updateSettings }) => {
    return (
        <div className="space-y-6">
            <div className="border-b border-white/5 pb-2 mb-4">
                <h2 className="text-lg font-bold text-white">Playback Controls</h2>
                <p className="text-xs text-gray-500">Manage how video content behaves.</p>
            </div>
            
            <div className="grid grid-cols-1 gap-4">
                <SettingsToggle 
                    label="Autoplay Previews" 
                    subLabel="Play trailers while browsing content."
                    checked={settings.autoplayPreviews} 
                    onChange={() => updateSettings({ autoplayPreviews: !settings.autoplayPreviews })}
                    icon="play_circle_filled"
                />
                <SettingsToggle 
                    label="Autoplay Next Episode" 
                    subLabel="Start the next episode automatically."
                    checked={settings.autoplayNextEpisode} 
                    onChange={() => updateSettings({ autoplayNextEpisode: !settings.autoplayNextEpisode })}
                    icon="queue_play_next"
                />
            </div>
        </div>
    );
};

export default PlaybackSettings;
