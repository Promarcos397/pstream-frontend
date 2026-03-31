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
        <div style={{ color: '#111' }}>

            {/* Live Preview */}
            <div style={{ marginBottom: 32 }}>
                <div style={{
                    height: 220, width: '100%',
                    backgroundColor: '#000', position: 'relative',
                    borderRadius: 4, overflow: 'hidden', border: '1px solid #e5e5e5',
                }}>
                    <SubtitlePreview settings={settings} backdropUrl={previewBackdrop} />
                </div>
            </div>

            <div style={{ height: 1, backgroundColor: '#f0f0f0', marginBottom: 32 }} />

            {/* Controls */}
            <SubtitleSettings settings={settings} updateSettings={updateSettings} />
        </div>
    );
};

export default SubtitleSection;
