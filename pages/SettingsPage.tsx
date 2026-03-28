import React from 'react';
import { useTranslation } from 'react-i18next';
import { useGlobalContext, DEFAULT_SETTINGS } from '../context/GlobalContext';
import SettingsLayout from '../settings/SettingsLayout';

const SettingsPage: React.FC = () => {
    const { settings, updateSettings, continueWatching } = useGlobalContext();
    const { t } = useTranslation();

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