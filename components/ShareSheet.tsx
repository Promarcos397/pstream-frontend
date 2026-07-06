import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { XIcon, LinkIcon, DotsThreeIcon, CheckIcon } from '@phosphor-icons/react';
import { useLockBodyScroll } from '../hooks/useLockBodyScroll';

// ─── Simplified, brand-colored glyphs ──────────────────────────────────────
// Not pixel-exact trademarked logos — small stylized icons in each brand's
// recognizable color/shape so the grid reads instantly (same approach any
// share-sheet clone takes without bundling the real logo assets).
const WhatsAppGlyph: React.FC = () => (
  <svg viewBox="0 0 24 24" width="26" height="26" fill="white">
    <path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.4A10 10 0 1 0 12 2Zm0 18.2a8.15 8.15 0 0 1-4.2-1.15l-.3-.18-3.1.82.83-3-.2-.32A8.2 8.2 0 1 1 12 20.2Zm4.5-6.13c-.25-.12-1.45-.72-1.67-.8-.22-.08-.39-.12-.55.12-.16.25-.63.8-.78.96-.14.16-.29.18-.53.06-.25-.12-1.04-.38-1.98-1.22-.73-.65-1.22-1.46-1.37-1.7-.14-.25-.02-.38.11-.5.11-.11.25-.29.37-.43.12-.15.16-.25.25-.41.08-.16.04-.31-.02-.43-.06-.12-.55-1.33-.76-1.82-.2-.48-.4-.41-.55-.42h-.47a.9.9 0 0 0-.65.3c-.22.25-.86.84-.86 2.04 0 1.2.88 2.36 1 2.52.12.16 1.73 2.64 4.2 3.7.59.25 1.05.4 1.4.52.59.19 1.12.16 1.55.1.47-.07 1.45-.6 1.66-1.17.2-.58.2-1.07.14-1.17-.06-.1-.22-.16-.47-.28Z" />
  </svg>
);
const MessagesGlyph: React.FC = () => (
  <svg viewBox="0 0 24 24" width="26" height="26" fill="white">
    <path d="M12 3C6.48 3 2 6.7 2 11.2c0 2.55 1.44 4.83 3.7 6.32-.12.9-.5 2.16-1.4 3.36a.5.5 0 0 0 .5.78c2.06-.4 3.6-1.28 4.55-1.95A12.6 12.6 0 0 0 12 19.4c5.52 0 10-3.7 10-8.2S17.52 3 12 3Z" />
  </svg>
);
const InstagramGlyph: React.FC = () => (
  <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="white" strokeWidth="1.8">
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <circle cx="12" cy="12" r="4.2" />
    <circle cx="17.4" cy="6.6" r="1" fill="white" stroke="none" />
  </svg>
);
const SnapchatGlyph: React.FC = () => (
  <svg viewBox="0 0 24 24" width="26" height="26" fill="#111">
    <path d="M12 2.5c2.9 0 4.6 2.1 4.7 4.4.05 1.1 0 2 .1 2.4.1.3.5.5 1 .6.6.1 1.4.1 1.6.6.15.4-.2.8-.7 1.1-.4.25-.9.4-.9.7 0 .25.3.5.6.9.35.45.3.9-.4 1.15-.55.2-1.25.25-1.5.55-.2.25 0 .7-.3 1-.35.35-1.1.15-1.75.35-.6.2-1 .9-2.45.9s-1.85-.7-2.45-.9c-.65-.2-1.4 0-1.75-.35-.3-.3-.1-.75-.3-1-.25-.3-.95-.35-1.5-.55-.7-.25-.75-.7-.4-1.15.3-.4.6-.65.6-.9 0-.3-.5-.45-.9-.7-.5-.3-.85-.7-.7-1.1.2-.5 1-.5 1.6-.6.5-.1.9-.3 1-.6.1-.4.05-1.3.1-2.4.1-2.3 1.8-4.4 4.7-4.4Z" />
  </svg>
);
const XGlyph: React.FC = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="white">
    <path d="M18.9 2H22l-7.2 8.2L23 22h-6.6l-5.2-6.8L5.2 22H2l7.7-8.8L1.3 2H8l4.7 6.2L18.9 2Zm-1.2 18h1.8L7.4 4H5.5L17.7 20Z" />
  </svg>
);

interface ShareTarget {
  id: string;
  label: string;
  bg: string;
  glyph: React.ReactNode;
  action: (url: string, title: string) => void;
}

const SHARE_TARGETS: ShareTarget[] = [
  {
    id: 'whatsapp', label: 'WhatsApp', bg: '#25D366', glyph: <WhatsAppGlyph />,
    action: (url, title) => window.open(`https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`, '_blank'),
  },
  {
    id: 'messages', label: 'Messages', bg: '#2f8ff0', glyph: <MessagesGlyph />,
    action: (url, title) => { window.location.href = `sms:?&body=${encodeURIComponent(`${title} ${url}`)}`; },
  },
  {
    id: 'instagram', label: 'Instagram Stories', bg: 'linear-gradient(45deg,#f9ce34,#ee2a7b,#6228d7)', glyph: <InstagramGlyph />,
    action: (url) => { navigator.clipboard?.writeText(url).catch(() => {}); },
  },
  {
    id: 'snapchat', label: 'Snapchat', bg: '#FFFC00', glyph: <SnapchatGlyph />,
    action: (url) => { navigator.clipboard?.writeText(url).catch(() => {}); },
  },
  {
    id: 'x', label: 'X', bg: '#000000', glyph: <XGlyph />,
    action: (url, title) => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`, '_blank'),
  },
];

interface ShareSheetProps {
  open: boolean;
  title: string;
  url: string;
  thumbnailUrl?: string;
  onClose: () => void;
}

/**
 * Custom share bottom-sheet (mirrors the OS share sheet's app-grid layout).
 * Instagram Stories and Snapchat have no reliable web deep-link for arbitrary
 * URLs, so those two copy the link and toast instead of pretending to hand
 * off directly — everything here does something real, nothing is a no-op.
 */
const ShareSheet: React.FC<ShareSheetProps> = ({ open, title, url, thumbnailUrl, onClose }) => {
  const { t } = useTranslation();
  const [toast, setToast] = useState<string | null>(null);
  useLockBodyScroll(open);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(id);
  }, [toast]);

  const handleTarget = (target: ShareTarget) => {
    target.action(url, title);
    if (target.id === 'instagram' || target.id === 'snapchat') {
      setToast(t('share.linkCopiedFor', { defaultValue: 'Link copied — paste it into {{app}}', app: target.label.replace(' Stories', '') }));
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard?.writeText(url).catch(() => {});
    setToast(t('share.linkCopied', { defaultValue: 'Link copied' }));
  };

  const handleMore = () => {
    if (navigator.share) {
      navigator.share({ title, text: title, url }).catch(() => {});
    } else {
      handleCopyLink();
    }
  };

  // Portaled to <body> — rendering this deep inside a page's component tree
  // (e.g. a Clips slide) can trap it under an ancestor's stacking context,
  // letting fixed elements from elsewhere (like the bottom nav) render on
  // top of it despite a lower z-index. Mounting at body guarantees this
  // sheet's z-index is compared globally, like every other full-screen sheet.
  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[10080] bg-black/60"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'tween', ease: [0.16, 1, 0.3, 1], duration: 0.3 }}
            className="fixed inset-x-0 bottom-0 z-[10090] bg-[#1c1c1c] rounded-t-2xl px-4 pt-2 pb-[calc(20px+env(safe-area-inset-bottom))]"
          >
            <div className="w-10 h-1 rounded-full bg-white/30 mx-auto mb-3" />

            <div className="flex items-center gap-3 mb-5">
              <div className="w-12 h-12 rounded-md overflow-hidden bg-white/10 shrink-0">
                {thumbnailUrl && <img src={thumbnailUrl} alt="" className="w-full h-full object-cover" />}
              </div>
              <div className="min-w-0">
                <p className="text-white font-bold text-[15px] truncate">{title}</p>
                <p className="text-white/40 text-[13px] truncate">{url.replace(/^https?:\/\//, '')}</p>
              </div>
              <button onClick={onClose} className="ml-auto w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white shrink-0" aria-label={t('common.close', { defaultValue: 'Close' })}>
                <XIcon size={18} weight="bold" />
              </button>
            </div>

            <div className="grid grid-cols-4 gap-y-5 gap-x-2">
              {SHARE_TARGETS.map((target) => (
                <button key={target.id} onClick={() => handleTarget(target)} className="flex flex-col items-center gap-2 active:scale-95 transition-transform">
                  <div className="w-14 h-14 rounded-full flex items-center justify-center shadow-md" style={{ background: target.bg }}>
                    {target.glyph}
                  </div>
                  <span className="text-white/85 text-[11px] text-center leading-tight max-w-[70px]">{target.label}</span>
                </button>
              ))}

              <button onClick={handleCopyLink} className="flex flex-col items-center gap-2 active:scale-95 transition-transform">
                <div className="w-14 h-14 rounded-full bg-[#3a3a3a] flex items-center justify-center">
                  <LinkIcon size={22} className="text-white" />
                </div>
                <span className="text-white/85 text-[11px]">{t('share.copyLink', { defaultValue: 'Copy link' })}</span>
              </button>

              <button onClick={handleMore} className="flex flex-col items-center gap-2 active:scale-95 transition-transform">
                <div className="w-14 h-14 rounded-full bg-[#3a3a3a] flex items-center justify-center">
                  <DotsThreeIcon size={26} weight="bold" className="text-white" />
                </div>
                <span className="text-white/85 text-[11px]">{t('share.more', { defaultValue: 'More Options' })}</span>
              </button>
            </div>

            <AnimatePresence>
              {toast && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="mt-5 flex items-center justify-center gap-2 text-white/90 text-[13px] font-medium"
                >
                  <CheckIcon size={16} weight="bold" className="text-green-400" />
                  {toast}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default ShareSheet;
