import React from 'react';
import { useTranslation } from 'react-i18next';
import { AppSettings } from '../types';

interface SubtitlePreviewProps {
    settings: AppSettings;
    backdropUrl: string;
}

const SubtitlePreview: React.FC<SubtitlePreviewProps> = ({ settings, backdropUrl }) => {
    const { t } = useTranslation();

    // Style Calculation Logic
    const getSubtitleStyle = () => {
        // Vibrant/Saturated Color Mapping
        const getColor = (c: string) => {
            const map: any = {
                white: '#FFFFFF',
                yellow: '#FFF000',
                cyan: '#00FFFF',
                green: '#00FF00',
                magenta: '#FF00FF', 
                red: '#FF0000',
                blue: '#0000FF',
                black: '#000000',
            };
            return map[c] || '#FFFFFF';
        };

        // Font Mapping
        const getFontFamily = (f: string) => {
            const map: any = {
                'monospace': '"Consolas", "Monaco", "Courier New", monospace', // Console
                'typewriter': '"Courier Prime", "Courier New", Courier, monospace',
                'print': '"Georgia", "Times New Roman", Times, serif',
                'block': '"Impact", "Arial Black", sans-serif',
                'casual': '"Comic Sans MS", "Comic Neue", cursive',
                'cursive': '"Brush Script MT", "Lucida Handwriting", cursive',
                'small-caps': '"Copperplate", "Papyrus", font-variant: small-caps', 
            };
            return map[f] || '"Consolas", monospace';
        };

        // Size Scale
        const getSize = (s: string) => {
            const map: any = {
                'tiny': '0.85rem',
                'small': '1.25rem',
                'medium': '1.75rem',
                'large': '2.25rem',
                'huge': '3rem',
            };
            return map[s] || '1.25rem';
        };

        const baseStyle: React.CSSProperties = {
            color: getColor(settings.subtitleColor),
            fontSize: getSize(settings.subtitleSize),
            fontFamily: getFontFamily(settings.subtitleFontFamily),
            fontVariant: settings.subtitleFontFamily === 'small-caps' ? 'small-caps' : 'normal',
            fontWeight: 'normal',
            lineHeight: '1.4',
            textAlign: 'center',
            transition: 'all 0.2s ease-out',
            whiteSpace: 'pre-wrap', 
            display: 'inline-block', 
            maxWidth: '80%',
        };

        // Calculate Edge Effect
        let textShadow = 'none';
        const shadowOpacity = 1; 
        const shadowColor = `rgba(0,0,0,${shadowOpacity})`;

        switch (settings.subtitleEdgeStyle) {
            case 'drop-shadow':
                textShadow = `2px 2px 2px ${shadowColor}`;
                break;
            case 'raised':
                textShadow = `-1px -1px 0px rgba(255,255,255,0.5), 1px 1px 0px ${shadowColor}`;
                break;
            case 'depressed':
                textShadow = `1px 1px 0px rgba(255,255,255,0.5), -1px -1px 0px ${shadowColor}`;
                break;
            case 'uniform':
                textShadow = `-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000`;
                break;
            default:
                textShadow = 'none';
        }

        baseStyle.textShadow = textShadow;

        if (settings.subtitleBackground === 'box') {
            const rgb = '0,0,0';
            baseStyle.backgroundColor = `rgba(${rgb}, ${settings.subtitleOpacity / 100})`;
            baseStyle.backdropFilter = `blur(${settings.subtitleBlur}px)`;
            (baseStyle as any).WebkitBackdropFilter = `blur(${settings.subtitleBlur}px)`;

            baseStyle.padding = '12px 24px'; 
            baseStyle.borderRadius = '8px';
        } else {
            baseStyle.backgroundColor = 'transparent';
            baseStyle.padding = '0';
        }

        return baseStyle;
    };

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
            <div className="absolute inset-x-0 bottom-10 md:bottom-16 flex justify-center items-end min-h-[120px] transition-opacity duration-300" style={{ opacity: settings.showSubtitles ? 1 : 0 }}>
                <div style={getSubtitleStyle()}>
                    {t('subtitles.previewText')}
                </div>
            </div>
        </div>
    );
};

export default SubtitlePreview;
