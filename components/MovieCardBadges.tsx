/**
 * MovieCardBadges.tsx
 * All badge, overlay, and progress indicator components used by MovieCard and other places.
 * Import from here instead of defining inline in each component.
 */
import React from 'react';
import { Movie } from '../types';

// ─── Maturity Rating Badge ────────────────────────────────────────────────────
// Netflix-style colored circle with a thin white border
// 13+ = light orange, 15 = pink, 18+ = red
interface MaturityBadgeProps {
  adult?: boolean;
  voteAverage?: number;
  /** Override the auto-computed label */
  label?: string;
  size?: 'sm' | 'md';
}

export const MaturityBadge: React.FC<MaturityBadgeProps> = ({ adult, voteAverage, label, size = 'sm' }) => {
  const rating = label || (adult ? '18+' : (voteAverage ?? 0) >= 7.5 ? '15' : '13');
  const bg =
    rating === '18+' ? '#DC0A0A'
    : rating === '15' ? '#FB4FAE'
    : '#F97316'; // orange for 13+

  // Tweak 'dim' sizes here to make the circle bigger/smaller
  const dim = size === 'md' ? 'w-10 h-10 text-[18px]' : 'w-9 h-9 text-[14px]';

  return (
    <span
      // Tweak 'border-[1.5px]' below to change the stroke thickness
      className={`inline-flex items-center justify-center rounded-full ${dim} text-white font-bold flex-shrink-0 border-[2.5px] border-white shadow-sm`}
      style={{ backgroundColor: bg }}
    >
      {rating}
    </span>
  );
};

// ─── Badge Overlay ────────────────────────────────────────────────────────────
// TOP 10 banner, New Episodes ribbon, Upcoming ribbon, Comic label
interface BadgeOverlayProps {
  badge: { text: string; type: string } | null;
  isBook?: boolean;
}

export const BadgeOverlay: React.FC<BadgeOverlayProps> = React.memo(({ badge, isBook }) => {
  if (isBook) {
    return (
      <div className="absolute top-2 left-2 bg-black/50 border border-white/40 text-white px-2 py-0.5 text-[10px] font-medium uppercase backdrop-blur-sm">
        Comic
      </div>
    );
  }
  if (!badge) return null;

  if (badge.type === 'top') {
    return (
      <div
        className="absolute top-0 right-0 z-10 w-[23px] h-[32px] bg-[#E50914] flex flex-col items-center justify-start pt-[2px] pr-[1px] shadow-sm pointer-events-none"
        style={{ clipPath: 'polygon(100% 0, 100% 100%, 100% 85%, 0 100%, 0 0)' }}
      >
        <div className="text-white text-[9px] font-bold tracking-tighter leading-none mb-[2px]" style={{ letterSpacing: '0.5px' }}>TOP</div>
        <div className="text-white text-[13px] leading-none" style={{ letterSpacing: '-0.5px' }}>10</div>
      </div>
    );
  }
  if (badge.type === 'new') {
    return (
      <div className="absolute bottom-0 left-0 right-0 z-10 flex justify-center">
        <div className="bg-[#E50914] text-white text-[8px] font-bold px-3 py-[3px] tracking-wider uppercase leading-none">
          {badge.text}
        </div>
      </div>
    );
  }
  if (badge.type === 'upcoming') {
    return (
      <div className="absolute bottom-0 left-0 right-0 z-10 flex justify-center">
        <div className="bg-black/70 border border-white/30 text-white text-[8px] font-bold px-3 py-[3px] tracking-wider uppercase leading-none backdrop-blur-sm">
          {badge.text}
        </div>
      </div>
    );
  }
  return null;
});

// ─── Watch progress helpers ────────────────────────────────────────────────────
interface ProgressProps {
  movie: Movie;
  getLastWatchedEpisode: (id: string) => { season: number; episode: number; time: number; duration: number } | undefined;
  getVideoState: (id: number | string) => { time: number; duration?: number } | undefined;
}

export function getWatchData(movie: Movie, getLastWatchedEpisode: any, getVideoState: any) {
  const isTV = movie.media_type === 'tv' || (!movie.media_type && !movie.title);
  if (isTV) {
    const ep = getLastWatchedEpisode(movie.id);
    if (ep && ep.duration) {
      const pct = (ep.time / ep.duration) * 100;
      if (pct >= 5) {
        return {
          pct: Math.min(100, pct),
          watchMins: Math.round(ep.time / 60),
          totalMins: Math.round(ep.duration / 60),
        };
      }
    }
  } else {
    const state = getVideoState(movie.id);
    if (state && state.duration && state.time > 30) {
      const pct = (state.time / state.duration) * 100;
      if (pct >= 5) {
        return {
          pct: Math.min(100, pct),
          watchMins: Math.round(state.time / 60),
          totalMins: Math.round(state.duration / 60),
        };
      }
    }
  }
  return { pct: 0, watchMins: 0, totalMins: 0 };
}

// ─── ProgressIndicator ────────────────────────────────────────────────────────
// Thin flat red bar BELOW the card thumbnail (not overlapping)
export const ProgressIndicator: React.FC<ProgressProps> = React.memo(({ movie, getLastWatchedEpisode, getVideoState }) => {
  const { pct } = getWatchData(movie, getLastWatchedEpisode, getVideoState);
  if (pct <= 0) return null;
  return (
    <div
      className="absolute left-0 right-0 h-[3px] pointer-events-none z-20"
      style={{ bottom: '-3px', borderRadius: 0 }}
    >
      <div className="w-full h-full bg-white/20" style={{ borderRadius: 0 }}>
        <div className="h-full bg-[#E50914]" style={{ width: `${pct}%`, borderRadius: 0 }} />
      </div>
    </div>
  );
});

// ─── HoverProgressBar ─────────────────────────────────────────────────────────
// Flat bar with "11 of 43m" text — rendered inside the hover popup
export const HoverProgressBar: React.FC<ProgressProps> = React.memo(({ movie, getLastWatchedEpisode, getVideoState }) => {
  const { pct, watchMins, totalMins } = getWatchData(movie, getLastWatchedEpisode, getVideoState);
  if (pct <= 0) return null;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-[3px] bg-white/20" style={{ borderRadius: 0 }}>
        <div
          className="h-full bg-[#e50914] transition-all duration-300"
          style={{ width: `${pct}%`, borderRadius: 0 }}
        />
      </div>
      {totalMins > 0 && (
        <span className="text-gray-100 text-[16px] whitespace-nowrap flex-shrink-0 font-medium ">
          {watchMins} of {totalMins}m
        </span>
      )}
    </div>
  );
});

export default { MaturityBadge, BadgeOverlay, ProgressIndicator, HoverProgressBar, getWatchData };
