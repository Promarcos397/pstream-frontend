import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  LockSimpleIcon, EnvelopeSimpleIcon, DeviceMobileIcon, DevicesIcon,
  ShieldWarningIcon, CaretRightIcon, CheckCircleIcon,
} from '@phosphor-icons/react';
import { useGlobalContext } from '../context/GlobalContext';
import { supabase } from '../services/supabaseClient';

/**
 * Netflix's "Account" page (distinct from the Profile overview) — Security
 * rows (Password/Email/Mobile), device management, and account-level actions.
 * Password change is real (Supabase updateUser). Email/Mobile are read-only
 * displays of the real auth record — there's no billing/device-tracking
 * backend here, so this deliberately doesn't fake those; "Sign out of all
 * devices" is real (a global-scope Supabase sign-out), and Delete Account
 * reuses the existing Privacy section flow rather than duplicating it.
 */
const AccountDetailsSection: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useGlobalContext();

  const [changingPw, setChangingPw] = useState(false);
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSaved, setPwSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [signingOutAll, setSigningOutAll] = useState(false);
  const [signOutAllOnSave, setSignOutAllOnSave] = useState(true);

  const handleSavePassword = async () => {
    setPwError(null);
    if (newPw.length < 6) {
      setPwError(t('settings.passwordTooShort', { defaultValue: 'Password must be at least 6 characters.' }));
      return;
    }
    if (newPw !== confirmPw) {
      setPwError(t('settings.passwordMismatch', { defaultValue: "Passwords don't match." }));
      return;
    }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPw });
    if (!error && signOutAllOnSave) {
      // Ends every other session sharing this password; the current one
      // survives because updateUser already refreshed its local token.
      await supabase.auth.signOut({ scope: 'others' });
    }
    setSaving(false);
    if (error) {
      setPwError(error.message);
      return;
    }
    setPwSaved(true);
    setNewPw('');
    setConfirmPw('');
    setTimeout(() => { setChangingPw(false); setPwSaved(false); }, 1500);
  };

  const handleSignOutAllDevices = async () => {
    setSigningOutAll(true);
    await supabase.auth.signOut({ scope: 'global' });
    // signOut triggers the auth listener, which redirects to /login.
  };

  const Row: React.FC<{ icon: React.ReactNode; title: string; subtitle?: string; onClick?: () => void }> = ({ icon, title, subtitle, onClick }) => (
    <div
      onClick={onClick}
      className={`flex items-center p-5 transition-colors group ${onClick ? 'cursor-pointer hover:bg-white/5 md:hover:bg-gray-50 active:bg-white/10 md:active:bg-gray-100' : ''}`}
    >
      <div className="w-12 shrink-0 flex items-center text-white/70 md:text-gray-700">{icon}</div>
      <div className="flex-1 pr-4 min-w-0">
        <div className="text-[16px] font-bold text-white md:text-gray-900">{title}</div>
        {subtitle && <div className="text-[13px] text-white/40 md:text-gray-500 mt-0.5 truncate">{subtitle}</div>}
      </div>
      {onClick && <CaretRightIcon size={18} weight="bold" className="text-white/30 md:text-gray-300 group-hover:text-white/60 md:group-hover:text-gray-500 transition-colors" />}
    </div>
  );

  return (
    <div className="pb-10 space-y-8 animate-fadeIn">
      {/* Security */}
      <div className="space-y-4">
        <h2 className="text-[14px] font-bold text-white/40 md:text-gray-500 uppercase tracking-wider ml-1">
          {t('settings.security', { defaultValue: 'Security' })}
        </h2>
        <div className="border border-white/10 md:border-gray-200 rounded-lg bg-white/5 md:bg-white overflow-hidden shadow-sm divide-y divide-white/8 md:divide-gray-100">
          <Row
            icon={<LockSimpleIcon size={24} />}
            title={t('settings.password', { defaultValue: 'Password' })}
            subtitle={t('settings.passwordSub', { defaultValue: 'Change your password' })}
            onClick={() => { setChangingPw(v => !v); setPwError(null); }}
          />
          <Row
            icon={<EnvelopeSimpleIcon size={24} />}
            title={t('settings.email', { defaultValue: 'Email' })}
            subtitle={user?.email || t('settings.notSet', { defaultValue: 'Not set' })}
          />
          <Row
            icon={<DeviceMobileIcon size={24} />}
            title={t('settings.mobilePhone', { defaultValue: 'Mobile phone' })}
            subtitle={user?.phone || t('settings.notAdded', { defaultValue: 'Not added' })}
          />
        </div>

        {changingPw && (
          <div className="border border-white/10 md:border-gray-200 rounded-lg bg-white/5 md:bg-white p-5 space-y-4 animate-fadeIn">
            {pwSaved ? (
              <div className="flex items-center gap-2 text-green-500 md:text-green-600 font-semibold text-[15px]">
                <CheckCircleIcon size={20} weight="fill" />
                {t('settings.passwordUpdated', { defaultValue: 'Password updated.' })}
              </div>
            ) : (
              <>
                <input
                  type="password"
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  placeholder={t('settings.newPassword', { defaultValue: 'New password (6+ characters)' })}
                  className="w-full bg-white/5 md:bg-gray-100 rounded-md px-4 py-3 text-white md:text-gray-900 text-[15px] outline-none focus:ring-2 focus:ring-white/30 md:focus:ring-gray-400 placeholder:text-white/35 md:placeholder:text-gray-400"
                />
                <input
                  type="password"
                  value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                  placeholder={t('settings.confirmNewPassword', { defaultValue: 'Re-enter new password' })}
                  className="w-full bg-white/5 md:bg-gray-100 rounded-md px-4 py-3 text-white md:text-gray-900 text-[15px] outline-none focus:ring-2 focus:ring-white/30 md:focus:ring-gray-400 placeholder:text-white/35 md:placeholder:text-gray-400"
                />
                <label className="flex items-center gap-3 cursor-pointer select-none py-1">
                  <input
                    type="checkbox"
                    checked={signOutAllOnSave}
                    onChange={(e) => setSignOutAllOnSave(e.target.checked)}
                    className="w-[18px] h-[18px] rounded-sm accent-white md:accent-black shrink-0"
                  />
                  <span className="text-[14px] text-white/80 md:text-gray-700 font-medium">
                    {t('settings.signOutAllDevices', { defaultValue: 'Sign out all devices' })}
                  </span>
                </label>
                {pwError && <p className="text-red-500 text-[13px] font-medium">{pwError}</p>}
                <div className="flex gap-3 pt-1">
                  <button
                    onClick={handleSavePassword}
                    disabled={saving}
                    className="px-8 py-2.5 bg-white md:bg-[#111] text-black md:text-white rounded-sm font-bold text-[14px] hover:bg-white/90 md:hover:bg-black transition-colors active:scale-95 disabled:opacity-50"
                  >
                    {saving ? t('common.saving', { defaultValue: 'Saving…' }) : t('common.save', { defaultValue: 'Save' })}
                  </button>
                  <button
                    onClick={() => { setChangingPw(false); setNewPw(''); setConfirmPw(''); setPwError(null); }}
                    className="px-8 py-2.5 text-white/60 md:text-gray-600 border border-white/20 md:border-gray-300 rounded-sm font-bold text-[14px] hover:bg-white/5 md:hover:bg-gray-50 transition-colors active:scale-95"
                  >
                    {t('common.cancel', { defaultValue: 'Cancel' })}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Devices */}
      <div className="space-y-4">
        <h2 className="text-[14px] font-bold text-white/40 md:text-gray-500 uppercase tracking-wider ml-1">
          {t('settings.devices', { defaultValue: 'Devices' })}
        </h2>
        <div className="border border-white/10 md:border-gray-200 rounded-lg bg-white/5 md:bg-white overflow-hidden shadow-sm">
          <Row
            icon={<DevicesIcon size={24} />}
            title={t('settings.signOutAllDevices', { defaultValue: 'Sign out of all devices' })}
            subtitle={t('settings.signOutAllDevicesSub', { defaultValue: 'Ends every active session, including this one' })}
            onClick={signingOutAll ? undefined : handleSignOutAllDevices}
          />
        </div>
      </div>

      {/* Danger zone — reuses the existing (real) delete flow rather than duplicating it */}
      <div className="space-y-4">
        <h2 className="text-[14px] font-bold text-white/40 md:text-gray-500 uppercase tracking-wider ml-1">
          {t('settings.accountActions', { defaultValue: 'Account Actions' })}
        </h2>
        <div className="border border-white/10 md:border-gray-200 rounded-lg bg-white/5 md:bg-white overflow-hidden shadow-sm">
          <Row
            icon={<ShieldWarningIcon size={24} className="text-red-500" />}
            title={t('settings.deleteAccount', { defaultValue: 'Delete Account' })}
            subtitle={t('settings.deleteAccountSub', { defaultValue: 'Permanently erase your data' })}
            onClick={() => navigate('/settings/privacy')}
          />
        </div>
      </div>
    </div>
  );
};

export default AccountDetailsSection;
