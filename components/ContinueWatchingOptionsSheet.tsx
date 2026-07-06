import React from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { XCircleIcon } from '@phosphor-icons/react';
import { Movie } from '../types';
import { useLockBodyScroll } from '../hooks/useLockBodyScroll';

interface ContinueWatchingOptionsSheetProps {
  movie: Movie | null;
  onClose: () => void;
  onRemove: (movie: Movie) => void;
}

/**
 * Options sheet opened from the (⋮) icon on a mobile Continue Watching card.
 * Only "Remove from Continue Watching" is wired to real behavior (clearVideoState);
 * Netflix's fuller options (Rate, Download, Not Interested) have no backend here yet.
 */
const ContinueWatchingOptionsSheet: React.FC<ContinueWatchingOptionsSheetProps> = ({ movie, onClose, onRemove }) => {
  const { t } = useTranslation();
  const open = !!movie;
  useLockBodyScroll(open);

  // Portaled to <body> — see ShareSheet.tsx for why (avoids being trapped
  // under an ancestor's stacking context and losing to the bottom nav's z-index).
  return createPortal(
    <AnimatePresence>
      {open && movie && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[10040] bg-black/60"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'tween', ease: [0.16, 1, 0.3, 1], duration: 0.32 }}
            className="fixed inset-x-0 bottom-0 z-[10050] bg-[#1f1f1f] rounded-t-2xl px-4 pt-2 pb-[calc(20px+env(safe-area-inset-bottom))]"
          >
            <div className="w-10 h-1 rounded-full bg-white/30 mx-auto mb-4" />
            <div className="px-1 mb-4">
              <span className="text-white text-[17px] font-bold truncate block">
                {movie.title || movie.name}
              </span>
            </div>
            <button
              onClick={() => { onRemove(movie); onClose(); }}
              className="w-full flex items-center gap-4 bg-[#2a2a2a] rounded-xl px-4 py-4 active:scale-[0.99] active:bg-[#333] transition-all"
            >
              <XCircleIcon size={22} className="text-white shrink-0" />
              <span className="text-white text-[16px] font-medium">
                {t('continueWatching.remove', { defaultValue: 'Remove from Continue Watching' })}
              </span>
            </button>
            <button
              onClick={onClose}
              className="w-full text-center text-white/60 text-[15px] font-medium py-4 mt-1 active:text-white/90"
            >
              {t('common.cancel', { defaultValue: 'Cancel' })}
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default ContinueWatchingOptionsSheet;
