import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import { BellIcon } from '@phosphor-icons/react';
import { useNotifications, formatRelativeTime } from '../hooks/useNotifications';
import { getOptimizedImageUrl } from '../utils/deviceHelper';

/**
 * Desktop's bell + dropdown panel — the same real weekly-release feed that
 * powers the mobile Notifications page (hooks/useNotifications.ts), just
 * rendered inline under the bell instead of as a full-screen takeover, like
 * Netflix's own desktop UI.
 */
const NotificationsDropdown: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { items, readIds, markRead, unreadCount, isLoading } = useNotifications();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  const handleSelect = (n: (typeof items)[number]) => {
    markRead(n.id);
    setOpen(false);
    const type = n.movie.media_type || (n.movie.title ? 'movie' : 'tv');
    navigate(`/title/${type}/${n.movie.id}`, { state: { backgroundLocation: location } });
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="relative p-1.5 flex items-center justify-center rounded-full text-white/85 hover:text-white active:scale-95 transition-colors"
        title={t('notifications.title', { defaultValue: 'Notifications' })}
      >
        <BellIcon size={22} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-[#E50914] text-white text-[10px] font-bold flex items-center justify-center leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+10px)] w-[420px] max-h-[560px] overflow-y-auto bg-[#141414] border border-white/10 rounded-sm shadow-2xl z-50">
          {isLoading ? (
            <div className="flex justify-center py-10">
              <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <p className="text-white/40 text-center text-[13px] py-10 px-6">
              {t('notifications.empty', { defaultValue: "You're all caught up — new arrivals will show up here." })}
            </p>
          ) : (
            items.map(n => {
              const thumb = getOptimizedImageUrl(n.movie.backdrop_path || n.movie.poster_path, 'backdrop', true);
              const unread = !readIds.has(n.id);
              return (
                <button
                  key={n.id}
                  onClick={() => handleSelect(n)}
                  className="w-full flex items-start gap-3 px-4 py-3 text-left border-b border-white/[0.06] last:border-0 hover:bg-white/[0.06] transition-colors"
                >
                  <span className={`mt-1.5 w-[7px] h-[7px] rounded-full shrink-0 ${unread ? 'bg-[#E50914]' : 'bg-transparent'}`} />
                  <div className="w-[90px] h-[60px] rounded overflow-hidden bg-zinc-900 shrink-0">
                    {thumb && <img src={thumb} alt="" className="w-full h-full object-cover" loading="lazy" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-[14px] font-bold leading-snug">{n.headline}</p>
                    <p className="text-white/80 text-[14px] leading-snug">{n.body}</p>
                    <p className="text-white/40 text-[12px] mt-1">{formatRelativeTime(n.date)}</p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationsDropdown;
