import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { XIcon } from '@phosphor-icons/react';
import { motion } from 'framer-motion';
import { Profile } from '../../types';
import { useIsMobile } from '../../hooks/useIsMobile';

interface ProfilePinPromptProps {
  profile: Profile;
  onUnlock: () => void;
  onCancel: () => void;
}

const ProfilePinPrompt: React.FC<ProfilePinPromptProps> = ({ profile, onUnlock, onCancel }) => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [digits, setDigits] = useState<string[]>(['', '', '', '']);
  const [shake, setShake] = useState(false);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => { inputs.current[0]?.focus(); }, []);

  const submit = (candidate: string) => {
    if (candidate === profile.pin) {
      onUnlock();
    } else {
      setShake(true);
      setDigits(['', '', '', '']);
      inputs.current[0]?.focus();
      setTimeout(() => setShake(false), 500);
    }
  };

  const handleChange = (idx: number, val: string) => {
    const clean = val.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[idx] = clean;
    setDigits(next);
    if (clean && idx < 3) {
      inputs.current[idx + 1]?.focus();
    }
    if (clean && idx === 3) {
      const candidate = next.join('');
      if (candidate.length === 4) submit(candidate);
    }
  };

  const handleKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[idx] && idx > 0) {
      inputs.current[idx - 1]?.focus();
    }
  };

  /* ── Mobile: compact centered dialog over a dim scrim, native numeric
        keyboard, dash-style digits — per the reference screenshot. ─────────── */
  if (isMobile) {
    return (
      <div className="fixed inset-0 z-[200] bg-black/70 flex items-center justify-center px-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.18 }}
          className="w-full max-w-[360px] bg-[#404040] rounded-[6px] px-6 pt-7 pb-4 shadow-2xl"
        >
          <p className="text-white text-[19px] font-medium text-center leading-snug mb-7">
            {t('profiles.enterPinShort', { defaultValue: 'Enter your PIN to access this profile.' })}
          </p>

          <motion.div
            animate={shake ? { x: [0, -10, 10, -10, 10, 0] } : { x: 0 }}
            transition={{ duration: 0.4 }}
            className="flex items-center justify-center gap-4 mb-8"
          >
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => { inputs.current[i] = el; }}
                type="password"
                inputMode="numeric"
                maxLength={1}
                value={d}
                onChange={(e) => handleChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                className="w-8 h-10 bg-transparent border-0 border-b-2 border-white/80 focus:border-white rounded-none text-center text-white text-2xl font-bold outline-none transition-colors caret-white"
              />
            ))}
          </motion.div>

          <div className="flex justify-end">
            <button
              onClick={onCancel}
              className="px-3 py-2 text-white text-[17px] font-medium active:opacity-70"
            >
              {t('common.cancel', { defaultValue: 'Cancel' })}
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  /* ── Desktop: full-screen Netflix-web style ─────────────────────────────── */
  return (
    <div className="fixed inset-0 z-[200] bg-black flex flex-col items-center justify-center px-6">
      <button
        onClick={onCancel}
        aria-label={t('common.close', { defaultValue: 'Close' })}
        className="absolute top-6 right-6 w-9 h-9 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors"
      >
        <XIcon size={22} weight="bold" />
      </button>

      <div className="w-20 h-20 rounded-md overflow-hidden mb-6 shadow-lg">
        {profile.avatarUrl && (
          <img src={profile.avatarUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
        )}
      </div>

      <p className="text-white/50 text-sm mb-1">
        {t('profiles.lockActive', { defaultValue: 'Profile Lock is currently on.' })}
      </p>
      <h1 className="text-white text-2xl font-bold mb-8 text-center">
        {t('profiles.enterPinToAccess', {
          defaultValue: "Enter your PIN to access {{name}}'s profile.",
          name: profile.name,
        })}
      </h1>

      <motion.div
        animate={shake ? { x: [0, -10, 10, -10, 10, 0] } : { x: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-center gap-3"
      >
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => { inputs.current[i] = el; }}
            type="password"
            inputMode="numeric"
            maxLength={1}
            value={d}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            className="w-14 h-16 sm:w-16 sm:h-20 bg-transparent border-2 border-white/40 rounded-md text-center text-white text-3xl font-bold outline-none focus:border-white transition-colors"
          />
        ))}
      </motion.div>
    </div>
  );
};

export default ProfilePinPrompt;
