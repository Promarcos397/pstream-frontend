import React from 'react';
import { AppSettings } from '../types';
import SubtitleSettings from './SubtitleSettings';
import SubtitlePreview from './SubtitlePreview';
import { IMG_PATH } from '../constants';
import landingBg from '../assets/landing-bg.png';

interface SubtitleSectionProps {
    settings: AppSettings;
    updateSettings: (s: Partial<AppSettings>) => void;
    continueWatching: any[];
}

const SubtitleSection: React.FC<SubtitleSectionProps> = ({ settings, updateSettings, continueWatching }) => {
    const previewBackdrop = continueWatching && continueWatching.length > 0
        ? `${IMG_PATH}${continueWatching[0].backdrop_path}`
        : landingBg;

    return (
        <div className="text-gray-900 animate-fadeIn space-y-8 pb-10">

            {/* Live Preview */}
            <div className="relative">
                <div className="h-[220px] md:h-[280px] w-full bg-black relative rounded-md overflow-hidden border border-gray-100 shadow-lg">
                    <SubtitlePreview settings={settings} backdropUrl={previewBackdrop} />
                </div>
                <div className="mt-4 flex items-center justify-center">
                    <span className="text-xs md:text-sm font-bold text-gray-400 uppercase tracking-widest">
                        Live Appearance Preview
                    </span>
                </div>
            </div>

            <div className="h-px bg-gray-100" />

            {/* Controls */}
            <div className="bg-white">
                <SubtitleSettings settings={settings} updateSettings={updateSettings} />
            </div>
        </div>
    );
};

export default SubtitleSection;
