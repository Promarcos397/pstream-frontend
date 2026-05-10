import React from 'react';
import { useTranslation } from 'react-i18next';
import { AppSettings } from '../types';
import { useSubtitleStyle } from '../hooks/useSubtitleStyle';

interface SubtitlePreviewProps {
    settings: AppSettings;
    backdropUrl: string;
}

const SubtitlePreview: React.FC<SubtitlePreviewProps> = ({ settings, backdropUrl }) => {
    const { t } = useTranslation();
    const { overlayStyle } = useSubtitleStyle(settings);

    return (
        <div className="relative w-full h-full bg-black md:rounded-sm overflow-hidden shadow-2xl group select-none">
            {/* Background Image */}
            <div className="absolute inset-0">
                <img
                    src={backdropUrl}
                    className="w-full h-full object-cover opacity-80 transition-transform duration-[60s] ease-linear group-hover:scale-110"
                    alt={t('auth.background')}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/40" />
                <div className="absolute inset-0 bg-gradient-to-r from-black/20 to-transparent" />
            </div>

            {/* Subtitles Overlay */}
            <div 
                className="absolute inset-x-0 bottom-10 md:bottom-16 flex justify-center items-end min-h-[120px] transition-opacity duration-300" 
                style={{ opacity: settings.showSubtitles ? 1 : 0 }}
            >
                {/* We wrap the preview text in a span with the actual player styles */}
                <span 
                    style={{
                        color: overlayStyle.color,
                        fontFamily: overlayStyle.fontFamily,
                        fontSize: overlayStyle.fontSize,
                        textShadow: overlayStyle.textShadow,
                        backgroundColor: overlayStyle.backgroundColor,
                        padding: overlayStyle.padding,
                        borderRadius: overlayStyle.borderRadius,
                        backdropFilter: overlayStyle.backdropFilter,
                        display: 'inline-block',
                        whiteSpace: 'pre-wrap',
                        textAlign: 'center',
                        maxWidth: '85%',
                        lineHeight: 1.45,
                    }}
                >
                    {t('subtitles.previewText')}
                </span>
            </div>
        </div>
    );
};

export default SubtitlePreview;
