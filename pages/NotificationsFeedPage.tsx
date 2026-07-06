import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ArrowLeftIcon } from '@phosphor-icons/react';
import { Movie } from '../types';
import { useNotifications } from '../hooks/useNotifications';
import { getOptimizedImageUrl } from '../utils/deviceHelper';

interface NotificationsFeedPageProps {
  onSelectMovie: (movie: Movie, time?: number, videoId?: string) => void;
}

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

/**
 * Netflix-style Notifications inbox — real "New arrival" items derived from
 * genuinely-recent releases (see hooks/useNotifications.ts), with unread red
 * dots that clear when a row is tapped. Tapping opens the title's info modal.
 */
const NotificationsFeedPage: React.FC<NotificationsFeedPageProps> = ({ onSelectMovie }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { items, readIds, markRead, isLoading } = useNotifications();

  return (
    <div className="min-h-screen bg-black pb-28">
      {/* Sticky header, aligned to the app's standard content gutter + top inset */}
      <div className="sticky top-0 z-10 bg-black/95 backdrop-blur-sm flex items-center gap-4 px-[var(--app-x)] pt-[calc(0.75rem+env(safe-area-inset-top))] pb-3">
        <button onClick={() => navigate(-1)} className="text-white active:scale-90 transition-transform -ml-1" aria-label={t('common.back', { defaultValue: 'Back' })}>
          <ArrowLeftIcon size={26} />
        </button>
        <h1 className="text-white text-[22px] font-bold">
          {t('notifications.title', { defaultValue: 'Notifications' })}
        </h1>
      </div>

      {isLoading ? (
        <div className="flex justify-center pt-20">
          <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-white/40 text-center text-[14px] mt-16 px-8">
          {t('notifications.empty', { defaultValue: "You're all caught up — new arrivals will show up here." })}
        </p>
      ) : (
        <div className="pt-2">
          {items.map(n => {
            const thumb = getOptimizedImageUrl(n.movie.backdrop_path || n.movie.poster_path, 'backdrop', true);
            const unread = !readIds.has(n.id);
            return (
              <button
                key={n.id}
                onClick={() => { markRead(n.id); onSelectMovie(n.movie); }}
                className="w-full flex items-center gap-3 px-[var(--app-x)] py-3 text-left active:bg-white/5 transition-colors"
              >
                <span className={`w-2 h-2 rounded-full shrink-0 ${unread ? 'bg-[#E50914]' : 'bg-transparent'}`} />
                <div className="w-[132px] aspect-video rounded-md overflow-hidden bg-zinc-900 shrink-0">
                  {thumb && <img src={thumb} alt="" className="w-full h-full object-cover" loading="lazy" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-[16px] font-bold leading-snug">{n.headline}</p>
                  <p className="text-white/50 text-[15px] truncate mt-0.5">{n.body}</p>
                  <p className="text-white/40 text-[13px] mt-1">{formatDate(n.date)}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default NotificationsFeedPage;
