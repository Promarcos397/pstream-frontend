import React, { useState, useRef } from 'react';
import { useGlobalContext } from '../context/GlobalContext';
import { useTranslation } from 'react-i18next';
import { DownloadSimpleIcon, UploadSimpleIcon, CheckCircleIcon } from '@phosphor-icons/react';

const FALLBACK_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23ddd'/%3E%3Ccircle cx='50' cy='38' r='18' fill='%23bbb'/%3E%3Cellipse cx='50' cy='85' rx='28' ry='22' fill='%23bbb'/%3E%3C/svg%3E";

const ProfileTransferSection: React.FC = () => {
    const { user, settings, importProfileData } = useGlobalContext();
    const { t } = useTranslation();
    const [imgFailed, setImgFailed] = useState(false);
    const [importing, setImporting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const avatarSrc = imgFailed ? FALLBACK_AVATAR : (settings.avatarUrl || FALLBACK_AVATAR);
    const profileName = user?.display_name || (user ? t('settings.user', { defaultValue: 'User' }) : t('settings.guest', { defaultValue: 'Guest Profile' }));

    const handleDownloadBackup = () => {
        const data = {
            settings: localStorage.getItem('pstream-settings'),
            myList: localStorage.getItem('pstream-list'),
            history: localStorage.getItem('pstream-history'),
            videoStates: localStorage.getItem('pstream-video-states'),
            episodeProgress: localStorage.getItem('pstream-episode-progress'),
            likedMovies: localStorage.getItem('pstream-liked'),
            exportedAt: new Date().toISOString()
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pstream-profile-${profileName.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const json = JSON.parse(event.target?.result as string);
                setImporting(true);
                const success = await importProfileData(json);
                if (success) {
                    alert('Profile imported successfully!');
                } else {
                    alert('Failed to import profile. Invalid data format.');
                }
            } catch (err) {
                console.error('Import error:', err);
                alert('Failed to read file.');
            } finally {
                setImporting(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        };
        reader.readAsText(file);
    };

    return (
        <div style={{ color: '#111' }}>
            {/* Profile card */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 32 }}>
                <div style={{ width: 56, height: 56, minWidth: 56, borderRadius: 4, overflow: 'hidden', backgroundColor: '#ddd' }}>
                    <img
                        src={avatarSrc} alt=""
                        width={56} height={56}
                        style={{ width: 56, height: 56, objectFit: 'cover', display: 'block' }}
                        onError={() => setImgFailed(true)}
                    />
                </div>
                <div>
                    <h3 style={{ fontSize: 18, fontWeight: 700, color: '#111' }}>
                        {profileName}
                    </h3>
                    <p style={{ fontSize: 14, color: '#737373', marginTop: 4 }}>{t('settings.profileTransfer')}</p>
                </div>
            </div>

            <div style={{ height: 1, backgroundColor: '#f0f0f0', marginBottom: 24 }} />

            {/* Description */}
            <div style={{ marginBottom: 32 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: '#111', marginBottom: 16 }}>{t('settings.transferHeader')}</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                        <CheckCircleIcon size={18} style={{ color: '#16a34a', flexShrink: 0, marginTop: 2 }} />
                        <p style={{ fontSize: 14, color: '#525252', lineHeight: 1.6 }}>{t('settings.transferFeature1')}</p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                        <CheckCircleIcon size={18} style={{ color: '#16a34a', flexShrink: 0, marginTop: 2 }} />
                        <p style={{ fontSize: 14, color: '#525252', lineHeight: 1.6 }}>{t('settings.transferFeature2')}</p>
                    </div>
                </div>
            </div>

            <div style={{ height: 1, backgroundColor: '#f0f0f0', marginBottom: 24 }} />

            {/* Actions */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                <button
                    onClick={handleDownloadBackup}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        backgroundColor: '#e50914', color: '#fff',
                        padding: '10px 24px', borderRadius: 4,
                        fontWeight: 700, fontSize: 14, border: 'none', cursor: 'pointer',
                    }}
                >
                    <DownloadSimpleIcon size={18} />
                    {t('settings.transferButton', { defaultValue: 'Export Profile' })}
                </button>

                <button
                    onClick={handleImportClick}
                    disabled={importing}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        backgroundColor: '#fff', color: '#111',
                        padding: '10px 24px', borderRadius: 4,
                        fontWeight: 700, fontSize: 14, border: '1px solid #d1d5db', cursor: 'pointer',
                        opacity: importing ? 0.6 : 1
                    }}
                >
                    <UploadSimpleIcon size={18} />
                    {importing ? 'Importing...' : t('settings.importButton', { defaultValue: 'Import Profile' })}
                </button>

                <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileChange} 
                    accept=".json" 
                    style={{ display: 'none' }} 
                />
            </div>
            
            <p style={{ fontSize: 12, color: '#a3a3a3', marginTop: 16, lineHeight: 1.5 }}>
                {t('settings.transferDesc')}
            </p>
        </div>
    );
};

export default ProfileTransferSection;
