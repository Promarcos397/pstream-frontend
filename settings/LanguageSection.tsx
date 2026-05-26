import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppSettings } from '../types';
import { DISPLAY_LANGUAGES, SUBTITLE_LANGUAGES } from '../constants';
import { CheckIcon, CaretDownIcon } from '@phosphor-icons/react';

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
        <div className="text-white md:text-gray-900 animate-fadeIn space-y-12">

            {/* 1. Display Language */}
            <section>
                <h2 className="text-lg md:text-xl font-bold text-white md:text-gray-900 mb-2">
                    {t('settings.displayLanguage', { defaultValue: 'Display Language' })}
                </h2>
                <p className="text-sm text-white/40 md:text-gray-500 mb-6 leading-relaxed max-w-lg">
                    {t('settings.displayLanguageDesc', { defaultValue: 'Choose the language you see in menus, emails, and more.' })}
                </p>
                
                <div className="relative max-w-md group">
                    <select
                        value={pendingDisplay}
                        onChange={(e) => setPendingDisplay(e.target.value)}
                        className="w-full px-4 py-3 text-base bg-white/5 md:bg-white text-white md:text-gray-900 border border-white/15 md:border-gray-300 rounded-sm appearance-none cursor-pointer focus:ring-2 focus:ring-white md:focus:ring-black focus:border-white md:focus:border-black transition-all outline-none"
                    >
                        {DISPLAY_LANGUAGES.map((lang) => (
                            <option key={lang.code} value={lang.code}>{lang.label}</option>
                        ))}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-white/40 md:text-gray-400 group-hover:text-white/70 md:group-hover:text-gray-600 transition-colors">
                        <CaretDownIcon size={20} weight="bold" />
                    </div>
                </div>
            </section>

            <div className="h-px bg-white/10 md:bg-gray-100" />

            {/* 2. Subtitle Languages */}
            <section>
                <h2 className="text-lg md:text-xl font-bold text-white md:text-gray-900 mb-2">
                    {t('settings.subtitleLanguage', { defaultValue: 'Subtitles & Audio' })}
                </h2>
                <p className="text-sm text-white/40 md:text-gray-500 mb-8 leading-relaxed max-w-lg">
                    {t('settings.subtitleLanguageDesc', { defaultValue: 'Help us improve your experience by selecting the languages you prefer for subtitles and audio.' })}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-y-4 gap-x-8">
                    {SUBTITLE_LANGUAGES.map((lang) => {
                        const isSelected = pendingSubtitle === lang.code;
                        return (
                            <label 
                                key={lang.code}
                                className="flex items-center gap-4 cursor-pointer group active:scale-[0.98] transition-transform"
                            >
                                <div className={`w-5 h-5 rounded-sm border-2 flex items-center justify-center transition-all
                                    ${isSelected ? 'bg-white md:bg-black border-white md:border-black' : 'border-white/20 md:border-gray-300 group-hover:border-white/40 md:group-hover:border-gray-400'}`}>
                                    {isSelected && <CheckIcon size={14} weight="bold" className="text-black md:text-white" />}
                                </div>
                                <input 
                                    type="radio" 
                                    name="subtitleLanguage"
                                    checked={isSelected}
                                    onChange={() => setPendingSubtitle(lang.code)}
                                    className="hidden"
                                />
                                <span className={`text-[15px] transition-colors ${isSelected ? 'font-semibold text-white md:text-gray-900' : 'text-white/50 md:text-gray-600 group-hover:text-white/80 md:group-hover:text-gray-800'}`}>
                                    {lang.label}
                                </span>
                            </label>
                        );
                    })}
                </div>
            </section>

            <div className="h-px bg-white/10 md:bg-gray-100" />

            {/* Save Button */}
            <div className="pt-4 flex flex-col sm:flex-row gap-4 items-center">
                <button
                    onClick={handleSave}
                    disabled={!hasChanges}
                    className={`px-12 py-3 rounded-sm text-base font-bold transition-all
                        ${hasChanges 
                            ? 'bg-white md:bg-black text-black md:text-white hover:bg-white/90 md:hover:bg-gray-800 cursor-pointer active:scale-95' 
                            : 'bg-white/10 md:bg-gray-100 text-white/30 md:text-gray-400 cursor-not-allowed'}`}
                >
                    {t('common.save', { defaultValue: 'Save' })}
                </button>
                <button
                    onClick={() => { setPendingDisplay(settings.displayLanguage); setPendingSubtitle(settings.subtitleLanguage); }}
                    className="px-12 py-3 bg-transparent text-white/50 md:text-gray-500 border border-white/15 md:border-gray-300 rounded-sm text-base font-bold cursor-pointer hover:bg-white/5 md:hover:bg-gray-50 hover:text-white/80 md:hover:text-gray-700 transition-all active:scale-95"
                >
                    {t('common.cancel', { defaultValue: 'Cancel' })}
                </button>
            </div>
        </div>
    );
};

export default LanguageSection;
