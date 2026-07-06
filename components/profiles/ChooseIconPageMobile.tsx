import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeftIcon } from '@phosphor-icons/react';
import { AVATAR_CATEGORIES } from '../../constants';
import { useCategoryLogo } from '../../hooks/useCategoryLogo';

const FALLBACK_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23ddd'/%3E%3Ccircle cx='50' cy='38' r='18' fill='%23bbb'/%3E%3Cellipse cx='50' cy='85' rx='28' ry='22' fill='%23bbb'/%3E%3C/svg%3E";

const SafeTile: React.FC<{ src: string; selected: boolean; onClick: () => void; title?: string }> = ({ src, selected, onClick, title }) => {
  const [failed, setFailed] = useState(false);
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`aspect-square rounded-lg overflow-hidden bg-white/10 transition-all active:scale-95
        ${selected ? 'ring-4 ring-white' : ''}`}
    >
      <img
        src={failed ? FALLBACK_AVATAR : src}
        alt=""
        className="w-full h-full object-cover block"
        onError={() => setFailed(true)}
        referrerPolicy="no-referrer"
      />
    </button>
  );
};

const CategoryHeader: React.FC<{ id: string; name: string }> = ({ id, name }) => {
  const logo = useCategoryLogo(id);
  if (logo) {
    return <img src={logo} alt={name} className="h-6 max-w-[70%] object-contain object-left mb-3" />;
  }
  return <h2 className="text-white/70 text-[15px] font-bold mb-3">{name}</h2>;
};

interface ChooseIconPageMobileProps {
  open: boolean;
  currentUrl?: string;
  history?: string[];
  onClose: () => void;
  onSelect: (url: string) => void;
}

/**
 * Full-screen mobile "Choose Icon" page — opened from the avatar's pencil
 * badge on the Add/Edit Profile page. Category rows from AVATAR_CATEGORIES,
 * plus a "History" row of this profile's most recently used icons.
 */
const ChooseIconPageMobile: React.FC<ChooseIconPageMobileProps> = ({ open, currentUrl, history, onClose, onSelect }) => {
  const { t } = useTranslation();

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'tween', ease: [0.16, 1, 0.3, 1], duration: 0.28 }}
          className="fixed inset-0 z-[10070] bg-black overflow-y-auto"
        >
          <div className="sticky top-0 z-10 bg-black/95 backdrop-blur-sm flex items-center gap-4 px-4 pt-[calc(14px+env(safe-area-inset-top))] pb-3">
            <button onClick={onClose} className="text-white active:scale-90 transition-transform" aria-label={t('common.back', { defaultValue: 'Back' })}>
              <ArrowLeftIcon size={24} />
            </button>
            <h1 className="text-white text-[19px] font-bold">
              {t('profiles.chooseIcon', { defaultValue: 'Choose Icon' })}
            </h1>
          </div>

          <div className="px-4 pb-10">
            {!!history?.length && (
              <div className="mb-7">
                <h2 className="text-white/70 text-[15px] font-bold mb-3">
                  {t('profiles.history', { defaultValue: 'History' })}
                </h2>
                <div className="grid grid-cols-3 gap-3">
                  {history.map((url) => (
                    <SafeTile
                      key={url}
                      src={url}
                      selected={currentUrl === url}
                      onClick={() => onSelect(url)}
                    />
                  ))}
                </div>
              </div>
            )}

            {AVATAR_CATEGORIES.map((category) => (
              <div key={category.id} className="mb-7">
                <CategoryHeader id={category.id} name={category.name} />
                <div className="grid grid-cols-3 gap-3">
                  {category.avatars.map((avatar) => (
                    <SafeTile
                      key={avatar.url}
                      src={avatar.url}
                      title={avatar.name}
                      selected={currentUrl === avatar.url}
                      onClick={() => onSelect(avatar.url)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ChooseIconPageMobile;
