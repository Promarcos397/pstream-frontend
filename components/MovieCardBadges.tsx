/**
 * MovieCardBadges.tsx
 * All badge, overlay, and progress indicator components used by MovieCard and other places.
 * Import from here instead of defining inline in each component.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Movie } from '../types';
import { useSettingsStore } from '../store/useSettingsStore';

// ─── BBFC Maturity Rating Badge ───────────────────────────────────────────────
// U/PG → upward equilateral triangle; 12A / 12 / 15 / 18 / R18 → filled circle
// Colors and shapes faithfully match UK BBFC classification marks.
interface MaturityBadgeProps {
  adult?: boolean;
  voteAverage?: number;
  certification?: string;
  label?: string;
  size?: 'xs' | 'sm' | 'md';
}

const BBFC: Record<string, { fill: string; shape: 'triangle' | 'circle' }> = {
  'U':   { fill: '#4CAF50', shape: 'triangle' }, // BBFC green
  'PG':  { fill: '#FFA000', shape: 'triangle' }, // BBFC amber
  '12A': { fill: '#E65100', shape: 'circle'   }, // deep orange
  '12':  { fill: '#E65100', shape: 'circle'   },
  '15':  { fill: '#D81B8C', shape: 'circle'   }, // BBFC pink/magenta
  '18':  { fill: '#C62828', shape: 'circle'   }, // BBFC red
  'R18': { fill: '#6A0D83', shape: 'circle'   }, // BBFC purple
};

function resolveLabel(cert?: string, adult?: boolean): string | null {
  if (cert) {
    const u = cert.trim().toUpperCase();
    if (BBFC[u]) return u;
    // Map US ratings → nearest BBFC
    if (u === 'G' || u === 'TV-G' || u === 'TV-Y' || u === 'TV-Y7') return 'U';
    if (u === 'PG' || u === 'TV-PG') return 'PG';
    if (u === 'PG-13' || u === 'TV-14') return '12A';
    if (u === 'R' || u === 'TV-MA') return '18';
    if (u === 'NC-17') return '18';
    const n = parseInt(u);
    if (!isNaN(n)) return n >= 18 ? '18' : n >= 15 ? '15' : n >= 12 ? '12' : n >= 7 ? 'PG' : 'U';
  }
  if (adult) return '18';
  return null;
}

export const MaturityBadge: React.FC<MaturityBadgeProps> = ({
  adult, voteAverage, certification, label, size = 'sm',
}) => {
  const { t } = useTranslation();
  const lbl = label || resolveLabel(certification, adult);
  if (!lbl) return null;
  const cfg = BBFC[lbl] ?? { fill: '#E65100', shape: 'circle' as const };

  // px sizes: xs=20, sm=30, md=40
  const px = size === 'md' ? 40 : size === 'xs' ? 20 : 30;

  // ── Triangle (U / PG) ──────────────────────────────────────────────────
  // viewBox 0 0 110 100 — slightly wider than tall so it looks proportional
  // Outer white triangle then inner coloured triangle create the border effect.
  // Text sits in the lower ~40% of the inner triangle.
  if (cfg.shape === 'triangle') {
    const fs = lbl.length === 1 ? 46 : 34;
    // Both triangles use quadratic bezier curves at each corner for rounded look.
    // Outer (white) is 5% smaller than the original sharp triangle.
    // Inner (coloured) is inset from the outer to form the white stroke border.
    // Path order: apex → bottom-right → bottom-left (clockwise).
    const outerPath = "M48.3,17.7 Q55,5.3 61.7,17.7 L98.7,86 Q105.4,98.4 91.4,98.4 L18.6,98.4 Q4.6,98.4 11.3,86 Z";
    const innerPath = "M50.2,17.8 Q55,9 59.8,17.8 L97.2,85.7 Q102,94.5 92,94.5 L18,94.5 Q8,94.5 12.8,85.7 Z";
    return (
      <svg
        width={px}
        height={Math.round(px * 100 / 110)}
        viewBox="0 0 110 100"
        aria-label={t('common.ratingLabel', { label: lbl })}
        className="flex-shrink-0"
        style={{ display: 'inline-block' }}
      >
        <path d={outerPath} fill="white" />
        <path d={innerPath} fill={cfg.fill} />
        <text
          x="55"
          y="79"
          textAnchor="middle"
          fontSize={fs}
          fontWeight="600"
          fontFamily="'Arial Black', Arial, sans-serif"
          fill="white"
          letterSpacing={lbl.length >= 2 ? '-2' : '0'}
        >
          {lbl}
        </text>
      </svg>
    );
  }

  // ── Circle (12A / 12 / 15 / 18 / R18) ────────────────────────────────
  // viewBox 0 0 100 100. Outer white circle (r=49) → coloured fill (r=42).
  // large font so text fills the circle — 12A needs tighter spacing
  const fs = lbl.length >= 3 ? 42 : lbl.length === 2 ? 50 : 59;
  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 100 100"
      aria-label={t('common.ratingLabel', { label: lbl })}
      className="flex-shrink-0"
      style={{ display: 'inline-block' }}
    >
      {/* white border ring */}
      <circle cx="50" cy="50" r="49" fill="white" />
      {/* coloured fill */}
      <circle cx="50" cy="50" r="44" fill={cfg.fill} />
      {/* label */}
      <text
        x="50"
        y="50"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={fs}
        fontWeight="700"
        fontFamily="'Arial Black', Arial, sans-serif"
        fill="white"
        letterSpacing={lbl.length >= 3 ? '-2' : lbl.length === 2 ? '-1' : '0'}
      >
        {lbl}
      </text>
    </svg>
  );
};

// ─── Badge Overlay ────────────────────────────────────────────────────────────
// TOP 10 banner, New Episodes ribbon, Upcoming ribbon, Comic label
interface BadgeOverlayProps {
  badge: { text: string; type: string } | null;
  isBook?: boolean;
}

export const BadgeOverlay: React.FC<BadgeOverlayProps> = React.memo(({ badge, isBook }) => {
  const { t } = useTranslation();
  const showNewContentBadges = useSettingsStore(s => s.settings.showNewContentBadges);
  if (badge?.type === 'new' && !showNewContentBadges) return null;
  if (isBook) {
    return (
      <div className="absolute top-2 left-2 bg-black/50 border border-white/40 text-white px-2 py-0.5 text-[10px] font-medium uppercase backdrop-blur-sm">
        {t('badge.comic', { defaultValue: 'Comic' })}
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
    const label = badge.text === 'New Episodes'
      ? t('badges.newEpisodes')
      : t('badges.recentlyAdded');
    return (
      <div className="absolute bottom-0 left-0 right-0 z-10 flex justify-center">
        <div className="bg-[#E50914] text-white text-[8px] font-bold px-3 py-[3px] tracking-wider uppercase leading-none">
          {label}
        </div>
      </div>
    );
  }
  if (badge.type === 'upcoming') {
    return (
      <div className="absolute bottom-0 left-0 right-0 z-10 flex justify-center">
        <div className="bg-black/70 border border-white/30 text-white text-[8px] font-bold px-3 py-[3px] tracking-wider uppercase leading-none backdrop-blur-sm">
          {t('badges.comingSoon')}
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
      if (pct >= 1) {
        return {
          pct: Math.min(100, pct),
          watchMins: Math.round(ep.time / 60),
          totalMins: Math.round(ep.duration / 60),
        };
      }
    }
  } else {
    const state = getVideoState(movie.id);
    if (state && state.duration && state.time > 10) {
      const pct = (state.time / state.duration) * 100;
      if (pct >= 1) {
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
// Thin flat red bar at the very bottom edge of the card thumbnail (not leaking outside)
export const ProgressIndicator: React.FC<ProgressProps> = React.memo(({ movie, getLastWatchedEpisode, getVideoState }) => {
  const { pct } = getWatchData(movie, getLastWatchedEpisode, getVideoState);
  if (pct <= 0) return null;
  return (
    <div
      className="absolute left-[15%] right-[15%] h-[1px] pointer-events-none z-20"
      style={{ bottom: '0', borderRadius: 0 }}
    >
      <div className="w-full h-full bg-[#808080]" style={{ borderRadius: 0 }}>
        <div className="h-full bg-[#E50914]" style={{ width: `${pct}%`, borderRadius: 0 }} />
      </div>
    </div>
  );
});

// ─── HoverProgressBar ─────────────────────────────────────────────────────────
// Flat bar with "11 of 43m" text — rendered inside the hover popup
export const HoverProgressBar: React.FC<ProgressProps> = React.memo(({ movie, getLastWatchedEpisode, getVideoState }) => {
  const { t } = useTranslation();
  const { pct, watchMins, totalMins } = getWatchData(movie, getLastWatchedEpisode, getVideoState);
  if (pct <= 0) return null;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-[2.5px] bg-[#808080]" style={{ borderRadius: 0 }}>
        <div
          className="h-full bg-[#e50914] transition-all duration-300"
          style={{ width: `${pct}%`, borderRadius: 0 }}
        />
      </div>
      {totalMins > 0 && (
        <span className="text-gray-100 text-[16px] whitespace-nowrap flex-shrink-0 font-medium">
          {t('common.watchProgress', { watched: watchMins, total: totalMins, defaultValue: '{{watched}} of {{total}}m' })}
        </span>
      )}
    </div>
  );
});

export default { MaturityBadge, BadgeOverlay, ProgressIndicator, HoverProgressBar, getWatchData };
