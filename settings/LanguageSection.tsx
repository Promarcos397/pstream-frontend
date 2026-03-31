import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppSettings } from '../types';
import { DISPLAY_LANGUAGES, SUBTITLE_LANGUAGES } from '../constants';
import { CheckIcon } from '@phosphor-icons/react';

interface LanguageSectionProps {
    settings: AppSettings;
    updateSettings: (s: Partial<AppSettings>) => void;
}

const LanguageSection: React.FC<LanguageSectionProps> = ({ settings, updateSettings }) => {
    const { t } = useTranslation();
    const [pendingDisplay, setPendingDisplay] = useState(settings.displayLanguage);
    const [pendingSubtitle, setPendingSubtitle] = useState(settings.subtitleLanguage);
    
    const hasChanges = pendingDisplay !== settings.displayLanguage || pendingSubtitle !== settings.subtitleLanguage;

    const handleSave = () => {
        updateSettings({ displayLanguage: pendingDisplay, subtitleLanguage: pendingSubtitle });
    };

    return (
        <div style={{ color: '#111' }}>

            {/* 1. Display Language — Netflix uses a dropdown for this usually */}
            <div style={{ marginBottom: 40 }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111', marginBottom: 12 }}>
                    {t('settings.displayLanguage', { defaultValue: 'Display Language' })}
                </h2>
                <p style={{ fontSize: 14, color: '#737373', marginBottom: 20, lineHeight: 1.5 }}>
                    {t('settings.displayLanguageDesc', { defaultValue: 'Choose the language you see in menus, emails, and more.' })}
                </p>
                
                <div style={{ position: 'relative', maxWidth: 400 }}>
                    <select
                        value={pendingDisplay}
                        onChange={(e) => setPendingDisplay(e.target.value)}
                        style={{
                            width: '100%', 
                            padding: '12px 16px',
                            fontSize: 15,
                            backgroundColor: '#fff',
                            color: '#111',
                            border: '1px solid #a3a3a3',
                            borderRadius: 2,
                            appearance: 'none',
                            cursor: 'pointer',
                        }}
                    >
                        {DISPLAY_LANGUAGES.map((lang) => (
                            <option key={lang.code} value={lang.code}>{lang.label}</option>
                        ))}
                    </select>
                    {/* Custom Arrow */}
                    <div style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#737373' }}>
                        <svg width="12" height="8" viewBox="0 0 12 8" fill="none">
                            <path d="M1 1L6 6L11 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                        </svg>
                    </div>
                </div>
            </div>

            <div style={{ height: 1, backgroundColor: '#e5e5e5', marginBottom: 40 }} />

            {/* 2. Subtitle Languages — Netflix uses a multi-select checkbox list for this */}
            <div style={{ marginBottom: 40 }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111', marginBottom: 12 }}>
                    {t('settings.subtitleLanguage', { defaultValue: 'Subtitles & Audio' })}
                </h2>
                <p style={{ fontSize: 14, color: '#737373', marginBottom: 24, lineHeight: 1.5 }}>
                    {t('settings.subtitleLanguageDesc', { defaultValue: 'Help us improve your experience by selecting the languages you prefer for subtitles and audio.' })}
                </p>

                <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', 
                    gap: '12px 24px',
                    padding: '8px 0',
                }}>
                    {SUBTITLE_LANGUAGES.map((lang) => {
                        const isSelected = pendingSubtitle === lang.code;
                        return (
                            <label 
                                key={lang.code}
                                style={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    gap: 12, 
                                    cursor: 'pointer',
                                    fontSize: 14,
                                    color: '#525252',
                                    padding: '4px 0',
                                }}
                            >
                                <div style={{ 
                                    width: 20, height: 20, 
                                    border: isSelected ? 'none' : '2px solid #a3a3a3', 
                                    borderRadius: 3,
                                    backgroundColor: isSelected ? '#111' : 'transparent',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    transition: 'all 0.1s ease',
                                }}>
                                    {isSelected && <CheckIcon size={14} weight="bold" style={{ color: '#fff' }} />}
                                </div>
                                <input 
                                    type="radio" 
                                    name="subtitleLanguage"
                                    checked={isSelected}
                                    onChange={() => setPendingSubtitle(lang.code)}
                                    style={{ display: 'none' }}
                                />
                                <span style={{ fontWeight: isSelected ? 600 : 400, color: isSelected ? '#111' : '#525252' }}>
                                    {lang.label}
                                </span>
                            </label>
                        );
                    })}
                </div>
            </div>

            {/* Save Button */}
            <div style={{ marginTop: 48, display: 'flex', gap: 16, alignItems: 'center' }}>
                <button
                    onClick={handleSave}
                    disabled={!hasChanges}
                    style={{
                        padding: '12px 40px',
                        backgroundColor: hasChanges ? '#111' : '#e5e5e5',
                        color: hasChanges ? '#fff' : '#a3a3a3',
                        border: 'none', borderRadius: 2,
                        fontSize: 16, fontWeight: 700,
                        cursor: hasChanges ? 'pointer' : 'not-allowed',
                        transition: 'all 0.2s ease',
                    }}
                >
                    {t('common.save', { defaultValue: 'Save' })}
                </button>
                <button
                    onClick={() => { setPendingDisplay(settings.displayLanguage); setPendingSubtitle(settings.subtitleLanguage); }}
                    style={{
                        padding: '12px 40px',
                        backgroundColor: 'transparent',
                        color: '#525252',
                        border: '1px solid #d4d4d4',
                        borderRadius: 2,
                        fontSize: 16, fontWeight: 700,
                        cursor: 'pointer',
                    }}
                >
                    {t('common.cancel', { defaultValue: 'Cancel' })}
                </button>
            </div>
        </div>
    );
};

export default LanguageSection;
