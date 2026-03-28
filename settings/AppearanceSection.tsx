import React from 'react';
import { AppSettings } from '../types';

interface AppearanceSectionProps {
    settings: AppSettings;
    updateSettings: (s: Partial<AppSettings>) => void;
}

const AppearanceSection: React.FC<AppearanceSectionProps> = ({ settings, updateSettings }) => {
    return (
        <div className="space-y-12 animate-fadeIn font-bold">

            {/* Field 1 */}
            <div>
                <h3 className="text-xl md:text-2xl text-white mb-2">Profile Name</h3>
                <p className="text-lg text-gray-400">Guest User</p>
            </div>

            {/* Field 2 */}
            <div>
                <h3 className="text-xl md:text-2xl text-white mb-2">Autoplay Trailers</h3>
                <button
                    onClick={() => updateSettings({ autoplayPreviews: !settings.autoplayPreviews })}
                    className="text-lg text-gray-400 hover:text-white transition-colors text-left"
                >
                    {settings.autoplayPreviews ? 'On' : 'Off'}
                </button>
            </div>

            {/* Field 3 */}
            <div>
                <h3 className="text-xl md:text-2xl text-white mb-2">Country / Language</h3>
                <p className="text-lg text-gray-400">US / en-US</p>
            </div>

            <div className="pt-8 border-t border-white/20">
                <p className="text-gray-500">Member since 2024</p>
            </div>

        </div>
    );
};

export default AppearanceSection;
