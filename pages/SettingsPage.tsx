import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useGlobalContext, DEFAULT_SETTINGS } from '../context/GlobalContext';
import SettingsLayout from '../settings/SettingsLayout';
import { LockSimpleIcon, CaretRightIcon } from '@phosphor-icons/react';

const SettingsPage: React.FC = () => {
    const { settings, updateSettings, continueWatching, user } = useGlobalContext();
    const { t } = useTranslation();
    const navigate = useNavigate();

    // ── Login gate ────────────────────────────────────────────────────────────
    // Settings are a signed-in privilege — they sync to the cloud profile.
    // Guests see a prompt instead of the settings UI.
    if (!user) {
        return (
            <div className="min-h-screen bg-[#141414] flex items-center justify-center px-6">
                <div className="max-w-[420px] w-full text-center space-y-6 animate-fadeIn">
                    {/* Lock icon */}
                    <div className="w-20 h-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto">
                        <LockSimpleIcon size={40} weight="duotone" className="text-white/40" />
                    </div>

                    <div className="space-y-2">
                        <h1 className="text-2xl font-bold text-white tracking-tight">
                            {t('settings.loginRequired', { defaultValue: 'Sign in to access Settings' })}
                        </h1>
                        <p className="text-white/40 text-sm leading-relaxed">
                            {t('settings.loginRequiredDesc', {
                                defaultValue: 'Your subtitle preferences, display language, and playback settings are saved to your account and sync across all your devices.'
                            })}
                        </p>
                    </div>

                    <div className="flex flex-col gap-3 pt-2">
                        <button
                            onClick={() => navigate('/login')}
                            className="w-full h-14 bg-[#e50914] text-white font-bold rounded flex items-center justify-center gap-2 hover:bg-[#f40612] transition-all shadow-lg hover:scale-[1.02] active:scale-95 group"
                        >
                            {t('auth.signIn', { defaultValue: 'Sign In' })}
                            <CaretRightIcon size={20} weight="bold" className="group-hover:translate-x-1 transition-transform" />
                        </button>
                        <button
                            onClick={() => navigate('/')}
                            className="w-full h-10 text-white/40 hover:text-white text-sm transition-colors"
                        >
                            {t('common.back', { defaultValue: 'Back' })}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const handleReset = () => {
        if (window.confirm(t('settings.resetConfirm'))) {
            updateSettings(DEFAULT_SETTINGS);
        }
    };

    return (
        <SettingsLayout
            settings={settings}
            updateSettings={updateSettings}
            continueWatching={continueWatching}
            onReset={handleReset}
        />
    );
};

export default SettingsPage;