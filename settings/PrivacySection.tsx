import React, { useState } from 'react';
import { useGlobalContext } from '../context/GlobalContext';
import { useTranslation } from 'react-i18next';
import { TrashIcon, WarningCircleIcon } from '@phosphor-icons/react';

const PrivacySection: React.FC = () => {
    const { deleteAccountData } = useGlobalContext();
    const { t } = useTranslation();
    const [confirming, setConfirming] = useState(false);
    const [deleted, setDeleted] = useState(false);

    const handleDelete = async () => {
        const success = await deleteAccountData();
        if (success) {
            setDeleted(true);
            setTimeout(() => { window.location.href = '/'; }, 2000);
        }
    };

    if (deleted) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center animate-fadeIn">
                <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mb-6">
                    <TrashIcon size={32} className="text-green-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">{t('privacy.dataWiped')}</h2>
                <p className="text-sm text-gray-500">{t('common.loading')}</p>
            </div>
        );
    }

    return (
        <div className="text-gray-900 animate-fadeIn space-y-8">
            <section>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{t('settings.deleteDataTitle')}</h3>
                <p className="text-sm text-gray-500 leading-relaxed max-w-lg">
                    {t('settings.deleteDataDesc')}
                </p>
            </section>

            <div className="h-px bg-gray-100 w-full" />

            {!confirming ? (
                <button
                    onClick={() => setConfirming(true)}
                    className="group flex items-center gap-3 text-red-600 font-bold text-[15px] p-2 -ml-2 rounded-md hover:bg-red-50 active:scale-95 transition-all"
                >
                    <TrashIcon size={20} weight="bold" />
                    <span>{t('settings.deleteDataButton')}</span>
                </button>
            ) : (
                <div className="space-y-6 animate-slideIn">
                    <div className="flex items-start gap-4 bg-red-50 border border-red-200 rounded-lg p-5">
                        <WarningCircleIcon size={24} className="text-red-600 shrink-0 mt-0.5" weight="fill" />
                        <div>
                            <h4 className="text-red-900 font-bold text-[15px] mb-1">{t('common.warning', { defaultValue: 'Warning' })}</h4>
                            <p className="text-sm text-red-700 font-medium leading-relaxed">
                                {t('settings.deleteDataConfirm')}
                            </p>
                        </div>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row gap-4 pt-2">
                        <button
                            onClick={handleDelete}
                            className="flex items-center justify-center gap-2 px-8 py-3 bg-red-600 text-white rounded-sm font-bold text-base hover:bg-red-700 active:scale-95 transition-all shadow-sm"
                        >
                            <TrashIcon size={20} weight="bold" />
                            <span>{t('privacy.confirmDeleteAction')}</span>
                        </button>
                        <button
                            onClick={() => setConfirming(false)}
                            className="px-8 py-3 bg-white text-gray-600 border border-gray-300 rounded-sm font-bold text-base hover:bg-gray-50 active:scale-95 transition-all"
                        >
                            {t('common.cancel')}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PrivacySection;
