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
        a.download = `Pstream-profile-${profileName.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.json`;
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
        <div className="text-gray-900 animate-fadeIn space-y-10">
            {/* Profile card */}
            <div className="flex items-center gap-6 bg-gray-50 border border-gray-100 p-6 rounded-lg shadow-sm">
                <div className="w-16 h-16 rounded-md overflow-hidden bg-gray-200 shrink-0 border-2 border-white shadow-sm">
                    <img
                        src={avatarSrc} alt=""
                        className="w-full h-full object-cover block"
                        onError={() => setImgFailed(true)}
                    />
                </div>
                <div>
                    <h3 className="text-xl font-bold text-gray-900 leading-tight">
                        {profileName}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1 font-medium">{t('settings.profileTransfer')}</p>
                </div>
            </div>

            <div className="h-px bg-gray-100" />

            {/* Description */}
            <div className="space-y-6">
                <h3 className="text-lg font-bold text-gray-900">{t('settings.transferHeader')}</h3>
                <div className="space-y-4">
                    <div className="flex items-start gap-4">
                        <CheckCircleIcon size={22} className="text-green-600 shrink-0 mt-0.5" weight="fill" />
                        <p className="text-[15px] text-gray-600 leading-relaxed font-medium">{t('settings.transferFeature1')}</p>
                    </div>
                    <div className="flex items-start gap-4">
                        <CheckCircleIcon size={22} className="text-green-600 shrink-0 mt-0.5" weight="fill" />
                        <p className="text-[15px] text-gray-600 leading-relaxed font-medium">{t('settings.transferFeature2')}</p>
                    </div>
                </div>
            </div>

            <div className="h-px bg-gray-100" />

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-4">
                <button
                    onClick={handleDownloadBackup}
                    className="flex-1 flex items-center justify-center gap-3 bg-black text-white px-8 py-3.5 rounded-sm font-bold text-base hover:bg-gray-800 active:scale-95 transition-all shadow-sm"
                >
                    <DownloadSimpleIcon size={20} weight="bold" />
                    <span>{t('settings.transferButton', { defaultValue: 'Export Profile' })}</span>
                </button>

                <button
                    onClick={handleImportClick}
                    disabled={importing}
                    className={`flex-1 flex items-center justify-center gap-3 px-8 py-3.5 rounded-sm font-bold text-base border border-gray-300 transition-all active:scale-95
                        ${importing ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white text-gray-700 hover:bg-gray-50 hover:text-gray-900'}`}
                >
                    <UploadSimpleIcon size={20} weight="bold" />
                    <span>{importing ? 'Importing...' : t('settings.importButton', { defaultValue: 'Import Profile' })}</span>
                </button>

                <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileChange} 
                    accept=".json" 
                    className="hidden" 
                />
            </div>
            
            <p className="text-[13px] text-gray-400 leading-relaxed max-w-lg italic font-medium px-1">
                {t('settings.transferDesc')}
            </p>
        </div>
    );
};

export default ProfileTransferSection;
