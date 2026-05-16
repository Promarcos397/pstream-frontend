import React from 'react';
import { useTranslation } from 'react-i18next';
import { AppSettings } from '../types';
import { SettingsToggle, SettingsSlider } from '../ui/SettingsUI';
import { CaretDownIcon } from '@phosphor-icons/react';

interface SubtitleSettingsProps {
    settings: AppSettings;
    updateSettings: (s: Partial<AppSettings>) => void;
}

import { SUBTITLE_FONTS, SUBTITLE_COLORS, SUBTITLE_SIZES, SUBTITLE_EDGES } from '../constants';

const SubtitleSettings: React.FC<SubtitleSettingsProps> = ({ settings, updateSettings }) => {
    const { t } = useTranslation();

    // Helper to render the custom select group with boxy style
    const BoxySelect = ({ label, selectedId, options, onChange }: { label: string; selectedId: string; options: any[]; onChange: (val: any) => void }) => (
        <div className="space-y-2.5">
            <label className="block text-[13px] font-bold text-gray-900 uppercase tracking-wider">
                {label}
            </label>
            <div className="relative group">
                <select
                    value={selectedId}
                    onChange={(e) => onChange(e.target.value)}
                    className="w-full px-4 py-3 text-sm bg-white text-gray-900 border border-gray-300 rounded-sm appearance-none cursor-pointer focus:ring-2 focus:ring-black focus:border-black transition-all outline-none"
                >
                    {options.map((opt) => (
                        <option key={opt.id} value={opt.id}>{t(opt.label, { defaultValue: opt.id })}</option>
                    ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 group-hover:text-gray-600 transition-colors">
                    <CaretDownIcon size={18} weight="bold" />
                </div>
            </div>
        </div>
    );

    return (
        <div className="text-gray-900 space-y-10">
            
            {/* Show Subtitles Toggle */}
            <div className="flex items-center justify-between py-6 border-b border-gray-100">
                <div className="flex flex-col gap-1 pr-4">
                    <span className="text-base md:text-lg font-bold text-gray-900">{t('subtitles.show')}</span>
                    <span className="text-xs md:text-sm text-gray-500 font-medium">
                        {t('settings.subtitleAppearanceSub', { defaultValue: 'Enable or disable subtitles' })}
                    </span>
                </div>
                <SettingsToggle
                    label=""
                    checked={settings.showSubtitles}
                    onChange={() => updateSettings({ showSubtitles: !settings.showSubtitles })}
                    darkTheme={false}
                />
            </div>

            <div className={`space-y-10 transition-all duration-300 ${settings.showSubtitles ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                
                {/* Typography Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 lg:gap-8">
                    <BoxySelect
                        label={t('subtitles.fontFamily')}
                        selectedId={settings.subtitleFontFamily}
                        onChange={(val) => updateSettings({ subtitleFontFamily: val })}
                        options={SUBTITLE_FONTS}
                    />

                    <BoxySelect
                        label={t('subtitles.edgeEffect')}
                        selectedId={settings.subtitleEdgeStyle}
                        onChange={(val) => updateSettings({ subtitleEdgeStyle: val })}
                        options={SUBTITLE_EDGES}
                    />

                    <BoxySelect
                        label={t('subtitles.textSize')}
                        selectedId={settings.subtitleSize}
                        onChange={(val) => updateSettings({ subtitleSize: val })}
                        options={SUBTITLE_SIZES}
                    />

                    <BoxySelect
                        label={t('subtitles.textColor')}
                        selectedId={settings.subtitleColor}
                        onChange={(val) => updateSettings({ subtitleColor: val })}
                        options={SUBTITLE_COLORS}
                    />
                </div>

                <div className="h-px bg-gray-100" />
                
                {/* Window / Background Section */}
                <div className="space-y-8 pb-4">
                    <div className="flex items-center justify-between group">
                        <div className="flex flex-col gap-1 pr-4">
                            <h3 className="text-base md:text-lg font-bold text-gray-900">{t('subtitles.windowBackground')}</h3>
                            <span className="text-xs md:text-sm text-gray-500 font-medium">
                                {t('subtitles.windowBackgroundDesc', { defaultValue: 'Add a shaded box behind subtitles for better contrast' })}
                            </span>
                        </div>
                        <SettingsToggle
                            label=""
                            checked={settings.subtitleBackground === 'box'}
                            onChange={() => updateSettings({ subtitleBackground: settings.subtitleBackground === 'box' ? 'none' : 'box' })}
                            darkTheme={false}
                        />
                    </div>

                    {settings.subtitleBackground === 'box' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 p-6 bg-gray-50 rounded-lg animate-slideIn">
                            <div className="px-1">
                                <SettingsSlider
                                    label={t('subtitles.opacity')}
                                    value={settings.subtitleOpacity}
                                    min={0} max={100} unit="%"
                                    onChange={(val) => updateSettings({ subtitleOpacity: val })}
                                    darkTheme={false}
                                />
                            </div>
                            <div className="px-1">
                                <SettingsSlider
                                    label={t('subtitles.blur')}
                                    value={settings.subtitleBlur}
                                    min={0} max={20} unit="px"
                                    onChange={(val) => updateSettings({ subtitleBlur: val })}
                                    darkTheme={false}
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SubtitleSettings;
