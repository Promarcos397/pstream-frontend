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
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 0', color: '#111' }}>
                <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>{t('privacy.dataWiped')}</h2>
                <p style={{ fontSize: 14, color: '#737373' }}>{t('common.loading')}</p>
            </div>
        );
    }

    return (
        <div style={{ color: '#111' }}>
            <div style={{ marginBottom: 24 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: '#111', marginBottom: 8 }}>{t('settings.deleteDataTitle')}</h3>
                <p style={{ fontSize: 14, color: '#737373', lineHeight: 1.6 }}>
                    {t('settings.deleteDataDesc')}
                </p>
            </div>

            <div style={{ height: 1, backgroundColor: '#f0f0f0', marginBottom: 24 }} />

            {!confirming ? (
                <button
                    onClick={() => setConfirming(true)}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#e50914', fontWeight: 700, fontSize: 14, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                    <TrashIcon size={18} />
                    <span>{t('settings.deleteDataButton')}</span>
                </button>
            ) : (
                <div>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, backgroundColor: '#fef2f2', border: '1px solid #fee2e2', borderRadius: 4, padding: 16, marginBottom: 16 }}>
                        <WarningCircleIcon size={20} style={{ color: '#ef4444', flexShrink: 0, marginTop: 2 }} />
                        <p style={{ fontSize: 14, color: '#b91c1c', fontWeight: 500 }}>
                            {t('settings.deleteDataConfirm')}
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: 12 }}>
                        <button
                            onClick={handleDelete}
                            style={{ display: 'flex', alignItems: 'center', gap: 8, backgroundColor: '#dc2626', color: '#fff', padding: '10px 20px', borderRadius: 4, fontWeight: 700, fontSize: 14, border: 'none', cursor: 'pointer' }}
                        >
                            <TrashIcon size={16} />
                            {t('privacy.confirmDeleteAction')}
                        </button>
                        <button
                            onClick={() => setConfirming(false)}
                            style={{ padding: '10px 20px', backgroundColor: '#fff', border: '1px solid #d4d4d4', color: '#525252', borderRadius: 4, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
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
