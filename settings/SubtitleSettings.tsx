import React from 'react';
import { useTranslation } from 'react-i18next';
import { AppSettings } from '../types';
import { SettingsToggle, SettingsSlider, SettingsSelectGroup } from '../ui/SettingsUI';

interface SubtitleSettingsProps {
    settings: AppSettings;
    updateSettings: (s: Partial<AppSettings>) => void;
}

const SubtitleSettings: React.FC<SubtitleSettingsProps> = ({ settings, updateSettings }) => {
    const { t } = useTranslation();

    // Helper to render the custom select group with boxy style
    const BoxySelect = (props: { label: string; selectedId: string; options: any[]; onChange: (val: any) => void }) => (
        <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#111', marginBottom: 10 }}>
                {props.label}
            </label>
            <div style={{ position: 'relative' }}>
                <select
                    value={props.selectedId}
                    onChange={(e) => props.onChange(e.target.value)}
                    style={{
                        width: '100%',
                        padding: '12px 14px',
                        fontSize: 14,
                        backgroundColor: '#fff',
                        color: '#111',
                        border: '1px solid #d4d4d4',
                        borderRadius: 2,
                        appearance: 'none',
                        cursor: 'pointer',
                        outline: 'none',
                    }}
                >
                    {props.options.map((opt) => (
                        <option key={opt.id} value={opt.id}>{opt.label}</option>
                    ))}
                </select>
                <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#737373' }}>
                    <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
                        <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                </div>
            </div>
        </div>
    );

    return (
        <div style={{ color: '#111' }}>
            
            {/* Show Subtitles Toggle */}
            <div style={{ 
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
                paddingBottom: 24, borderBottom: '1px solid #f0f0f0', marginBottom: 32 
            }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: '#111' }}>{t('subtitles.show')}</span>
                    <span style={{ fontSize: 13, color: '#737373' }}>{t('settings.subtitleAppearanceSub', { defaultValue: 'Enable or disable subtitles' })}</span>
                </div>
                <SettingsToggle
                    label=""
                    checked={settings.showSubtitles}
                    onChange={() => updateSettings({ showSubtitles: !settings.showSubtitles })}
                    darkTheme={false}
                />
            </div>

            <div style={{ 
                opacity: settings.showSubtitles ? 1 : 0.4, 
                pointerEvents: settings.showSubtitles ? 'auto' : 'none',
                transition: 'all 0.3s ease'
            }}>
                
                {/* 1. Typography Grid */}
                <div style={{ 
                    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
                    gap: '24px 32px', marginBottom: 40 
                }}>
                    <BoxySelect
                        label={t('subtitles.fontFamily')}
                        selectedId={settings.subtitleFontFamily}
                        onChange={(val) => updateSettings({ subtitleFontFamily: val })}
                        options={[
                            { id: 'monospace', label: t('subtitles.fonts.monospace') },
                            { id: 'typewriter', label: t('subtitles.fonts.typewriter') },
                            { id: 'print', label: t('subtitles.fonts.print') },
                            { id: 'block', label: t('subtitles.fonts.block') },
                            { id: 'casual', label: t('subtitles.fonts.casual') },
                            { id: 'cursive', label: t('subtitles.fonts.cursive') },
                            { id: 'small-caps', label: t('subtitles.fonts.smallCaps') },
                        ]}
                    />

                    <BoxySelect
                        label={t('subtitles.edgeEffect')}
                        selectedId={settings.subtitleEdgeStyle}
                        onChange={(val) => updateSettings({ subtitleEdgeStyle: val })}
                        options={[
                            { id: 'none', label: t('subtitles.edges.none') },
                            { id: 'raised', label: t('subtitles.edges.raised') },
                            { id: 'depressed', label: t('subtitles.edges.depressed') },
                            { id: 'uniform', label: t('subtitles.edges.uniform') },
                            { id: 'drop-shadow', label: t('subtitles.edges.dropShadow') },
                        ]}
                    />

                    <BoxySelect
                        label={t('subtitles.textSize')}
                        selectedId={settings.subtitleSize}
                        onChange={(val) => updateSettings({ subtitleSize: val })}
                        options={[
                            { id: 'tiny', label: t('subtitles.sizes.tiny') },
                            { id: 'small', label: t('subtitles.sizes.small') },
                            { id: 'medium', label: t('subtitles.sizes.medium') },
                            { id: 'large', label: t('subtitles.sizes.large') },
                            { id: 'huge', label: t('subtitles.sizes.huge') },
                        ]}
                    />

                    <BoxySelect
                        label={t('subtitles.textColor')}
                        selectedId={settings.subtitleColor}
                        onChange={(val) => updateSettings({ subtitleColor: val })}
                        options={[
                            { id: 'white', label: t('colors.white', { defaultValue: 'White' }) },
                            { id: 'yellow', label: t('colors.yellow', { defaultValue: 'Yellow' }) },
                            { id: 'cyan', label: t('colors.cyan', { defaultValue: 'Cyan' }) },
                            { id: 'green', label: t('colors.green', { defaultValue: 'Green' }) },
                            { id: 'red', label: t('colors.red', { defaultValue: 'Red' }) },
                            { id: 'blue', label: t('colors.blue', { defaultValue: 'Blue' }) },
                            { id: 'black', label: t('colors.black', { defaultValue: 'Black' }) },
                        ]}
                    />
                </div>

                {/* 2. Window / Background Section */}
                <div style={{ height: 1, backgroundColor: '#f0f0f0', marginBottom: 32 }} />
                
                <div style={{ marginBottom: 32 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#111' }}>{t('subtitles.windowBackground')}</h3>
                            <span style={{ fontSize: 13, color: '#737373' }}>{t('subtitles.windowBackgroundDesc', { defaultValue: 'Add a shaded box behind subtitles for better contrast' })}</span>
                        </div>
                        <SettingsToggle
                            label=""
                            checked={settings.subtitleBackground === 'box'}
                            onChange={() => updateSettings({ subtitleBackground: settings.subtitleBackground === 'box' ? 'none' : 'box' })}
                            darkTheme={false}
                        />
                    </div>

                    {settings.subtitleBackground === 'box' && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '32px' }}>
                            <div style={{ padding: '0 4px' }}>
                                <SettingsSlider
                                    label={t('subtitles.opacity')}
                                    value={settings.subtitleOpacity}
                                    min={0} max={100} unit="%"
                                    onChange={(val) => updateSettings({ subtitleOpacity: val })}
                                    darkTheme={false}
                                />
                            </div>
                            <div style={{ padding: '0 4px' }}>
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
