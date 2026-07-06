import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  CaretDownIcon, PencilSimpleIcon, ArrowSquareOutIcon,
  IdentificationCardIcon, UserIcon,
} from '@phosphor-icons/react';
import { useGlobalContext } from '../../context/GlobalContext';
import { DEFAULT_AVATAR } from '../../constants';
import KidsAvatar from './KidsAvatar';

const FALLBACK_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23ddd'/%3E%3Ccircle cx='50' cy='38' r='18' fill='%23bbb'/%3E%3Cellipse cx='50' cy='85' rx='28' ry='22' fill='%23bbb'/%3E%3C/svg%3E";

const MenuAvatar: React.FC<{ src?: string; size: number; isKids?: boolean }> = ({ src, size, isKids }) => {
  const [failed, setFailed] = useState(false);
  if (isKids && !src) {
    return (
      <div style={{ width: size, height: size }} className="rounded-[4px] overflow-hidden block shrink-0">
        <KidsAvatar size={size} />
      </div>
    );
  }
  return (
    <img
      src={failed || !src ? FALLBACK_AVATAR : src}
      alt=""
      style={{ width: size, height: size }}
      className="rounded-[4px] object-cover block shrink-0"
      onError={() => setFailed(true)}
      referrerPolicy="no-referrer"
    />
  );
};

/** Row with the fixed icon column — text underlines on hover, Netflix-style. */
const MenuRow: React.FC<{
  icon?: React.ReactNode;
  label: string;
  onClick: () => void;
}> = ({ icon, label, onClick }) => (
  <button
    onClick={onClick}
    className="w-full flex items-center gap-3 px-3 py-[7px] text-left group/row"
  >
    {icon && <span className="w-7 flex items-center justify-center text-[#b3b3b3] shrink-0">{icon}</span>}
    <span className="text-[#e5e5e5] text-[13px] leading-snug group-hover/row:underline">{label}</span>
  </button>
);

/**
 * Netflix-style navbar profile control: avatar + caret trigger, hover-opened
 * dropdown with the other profiles, management actions, and a sign-out footer.
 * Modeled on docs/reference/netflix-profiles/05-in-session-navbar-dropdown.png.
 */
const NavbarProfileMenu: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { activeProfile, profiles, switchProfile, logout } = useGlobalContext();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | null>(null);

  const openNow = () => {
    if (closeTimer.current) { window.clearTimeout(closeTimer.current); closeTimer.current = null; }
    setOpen(true);
  };
  const scheduleClose = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpen(false), 300);
  };

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onEscape);
    };
  }, [open]);

  useEffect(() => () => { if (closeTimer.current) window.clearTimeout(closeTimer.current); }, []);

  const avatarUrl = activeProfile?.isKids ? activeProfile.avatarUrl : (activeProfile?.avatarUrl || DEFAULT_AVATAR);
  const otherProfiles = profiles.filter(p => p.id !== activeProfile?.id);

  const manageProfiles = () => {
    setOpen(false);
    navigate('/settings/profiles');   // native in-app management, not the gate
  };

  // In Kids mode the navbar avatar is completely inert — no dropdown, no hover,
  // no click. Kids can't switch or manage profiles from here; the only way out
  // is the red "Exit Kids" button. Rendered as a plain, non-interactive tile.
  if (activeProfile?.isKids) {
    return (
      <div className="w-8 h-8 rounded-[4px] overflow-hidden shadow-md select-none pointer-events-none" aria-hidden="true">
        <MenuAvatar src={avatarUrl} size={32} isKids />
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      className="relative"
      onMouseEnter={openNow}
      onMouseLeave={scheduleClose}
    >
      <button
        onClick={() => setOpen(v => !v)}
        aria-label={t('nav.accountSettings', { defaultValue: 'Account' })}
        aria-expanded={open}
        className="flex items-center gap-2 group focus-visible:outline-none"
      >
        <div className="w-8 h-8 rounded-[4px] overflow-hidden shadow-md">
          <MenuAvatar src={avatarUrl} size={32} isKids={activeProfile?.isKids} />
        </div>
        <CaretDownIcon
          size={13}
          weight="fill"
          className={`text-white transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence>
        {open && (
          /* pt-[18px] doubles as an invisible hover bridge between trigger and panel */
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full pt-[18px] z-[95]"
          >
            <div className="relative">
              {/* White notch pointing at the caret */}
              <div className="absolute -top-[7px] right-[6px] w-0 h-0 border-l-[7px] border-r-[7px] border-b-[8px] border-l-transparent border-r-transparent border-b-[#e5e5e5]" />

              <div className="w-[230px] bg-black/90 border border-white/15 backdrop-blur-sm">
                {/* Other profiles */}
                {otherProfiles.length > 0 && (
                  <div className="pt-3 pb-1">
                    {otherProfiles.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => { setOpen(false); switchProfile(p.id); }}
                        className="w-full flex items-center gap-3 px-3 py-[6px] text-left group/row"
                      >
                        <MenuAvatar src={p.avatarUrl} size={32} isKids={p.isKids} />
                        <span className="text-[#e5e5e5] text-[13px] truncate group-hover/row:underline">{p.name}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Management actions */}
                <div className={otherProfiles.length > 0 ? 'pb-2' : 'py-2'}>
                  <MenuRow
                    icon={<PencilSimpleIcon size={20} />}
                    label={t('profiles.manageProfiles', { defaultValue: 'Manage Profiles' })}
                    onClick={manageProfiles}
                  />
                  <MenuRow
                    icon={<ArrowSquareOutIcon size={20} />}
                    label={t('profiles.exitProfile', { defaultValue: 'Exit Profile' })}
                    onClick={() => { setOpen(false); switchProfile(null); }}
                  />
                  <MenuRow
                    icon={<IdentificationCardIcon size={20} />}
                    label={t('profiles.transferProfile', { defaultValue: 'Transfer Profile' })}
                    onClick={() => { setOpen(false); navigate('/settings/transfer'); }}
                  />
                  <MenuRow
                    icon={<UserIcon size={20} />}
                    label={t('nav.accountSettings', { defaultValue: 'Account' })}
                    onClick={() => { setOpen(false); navigate('/settings/overview'); }}
                  />
                </div>

                {/* Sign out footer */}
                <div className="border-t border-white/15">
                  <button
                    onClick={() => { setOpen(false); logout(); }}
                    className="w-full py-3 text-center text-[#e5e5e5] text-[13px] hover:underline"
                  >
                    {t('profiles.signOutOf', { defaultValue: 'Sign out of Pstream' })}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NavbarProfileMenu;
