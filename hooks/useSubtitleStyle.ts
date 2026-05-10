import { useMemo } from 'react';
import { useGlobalContext } from '../context/GlobalContext';
import type { CSSProperties } from 'react';
import { AppSettings } from '../types';

// ─── Size map ────────────────────────────────────────────────────────────────
const SIZE_MAP: Record<string, string> = {
  tiny:   'clamp(10px, 1.0vw, 13px)',
  small:  'clamp(12px, 1.3vw, 16px)',
  medium: 'clamp(15px, 1.9vw, 22px)',
  large:  'clamp(19px, 2.5vw, 30px)',
  huge:   'clamp(24px, 3.2vw, 42px)',
};

// For compact contexts (MovieCard hover preview), scale down one step
const SIZE_MAP_COMPACT: Record<string, string> = {
  tiny:   'clamp(9px, 0.8vw, 11px)',
  small:  'clamp(10px, 0.9vw, 12px)',
  medium: 'clamp(11px, 1.1vw, 13px)',
  large:  'clamp(13px, 1.4vw, 16px)',
  huge:   'clamp(16px, 1.8vw, 20px)',
};

// ─── Color map ───────────────────────────────────────────────────────────────
const COLOR_MAP: Record<string, string> = {
  white:   '#ffffff',
  yellow:  '#facc15',
  cyan:    '#67e8f9',
  green:   '#86efac',
  red:     '#ef4444',
  blue:    '#3b82f6',
  magenta: '#d946ef',
  black:   '#000000',
};

// ─── Background map ──────────────────────────────────────────────────────────
// subtitleOpacity (0-100) drives the alpha of the background pill
function buildBackground(style: string, opacity: number): string {
  if (style === 'none') return 'transparent';
  // Handle 'box' (from UI) or explicit colors
  const alpha = (opacity / 100).toFixed(2);
  return `rgba(0,0,0,${alpha})`;
}

// ─── Edge style → textShadow ─────────────────────────────────────────────────
function buildTextShadow(edge: string): string {
  switch (edge) {
    case 'drop-shadow': return '0 1px 4px rgba(0,0,0,0.95), 0 0 12px rgba(0,0,0,0.8)';
    case 'outline':
    case 'uniform':     return '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000';
    case 'raised':      return '0 2px 0 rgba(0,0,0,0.8), 0 4px 6px rgba(0,0,0,0.5)';
    case 'depressed':   return 'inset 0 1px 2px rgba(0,0,0,0.6)'; // Note: inset shadow doesn't work well on text, usually it's just a light/dark shadow pair
    case 'none':        return 'none';
    default:            return '0 1px 3px rgba(0,0,0,0.95)';
  }
}

export interface SubtitleStyleResult {
  /** CSS properties for the subtitle container div */
  overlayStyle: CSSProperties;
  /** Same but scaled down for compact contexts (MovieCard) */
  overlayStyleCompact: CSSProperties;
  /** BCP-47 language code to pass to getCaptionCues() */
  lang: string;
  /** Whether subtitles are enabled at all in settings */
  enabled: boolean;
}

/**
 * Single source of truth for subtitle visuals + language.
 * Use this in every subtitle renderer in the app:
 *  - VideoPlayer (native <track> / custom cue div)
 *  - HeroCarouselBackground YouTube overlay
 *  - InfoModal YouTube overlay
 *  - MovieCard hover preview overlay
 *
 * Changing a subtitle setting instantly propagates to all of them.
 */
export function useSubtitleStyle(customSettings?: AppSettings): SubtitleStyleResult {
  const { settings: globalSettings } = useGlobalContext();
  const settings = customSettings || globalSettings;

  return useMemo(() => {
    const {
      showSubtitles,
      subtitleSize = 'medium',
      subtitleColor = 'white',
      subtitleBackground = 'none',
      subtitleOpacity = 75,
      subtitleBlur = 0,
      subtitleFontFamily = "'Inter', sans-serif",
      subtitleEdgeStyle = 'drop-shadow',
      subtitleLanguage = 'en',
    } = settings;

    const color     = COLOR_MAP[subtitleColor]  || subtitleColor  || '#ffffff';
    const bg        = buildBackground(subtitleBackground, subtitleOpacity);
    const shadow    = buildTextShadow(subtitleEdgeStyle);
    const fontSize  = SIZE_MAP[subtitleSize]   || SIZE_MAP.medium;
    const fontSizeC = SIZE_MAP_COMPACT[subtitleSize] || SIZE_MAP_COMPACT.medium;

    const base: CSSProperties = {
      position:        'absolute',
      bottom:          '18%',
      left:            '50%',
      transform:       'translateX(-50%)',
      zIndex:          20,
      pointerEvents:   'none',
      textAlign:       'center',
      maxWidth:        '80%',
      padding:         bg === 'transparent' ? '0' : '6px 14px',
      backgroundColor: bg,
      borderRadius:    bg === 'transparent' ? 0 : 6,
      color,
      fontFamily:      subtitleFontFamily,
      fontWeight:      500,
      lineHeight:      1.4,
      letterSpacing:   '0.01em',
      textShadow:      shadow,
      transition:      'opacity 0.15s ease',
      backdropFilter:  subtitleBlur > 0 ? `blur(${subtitleBlur}px)` : undefined,
      fontSize,
    };

    const compact: CSSProperties = {
      ...base,
      bottom:       '8%',
      maxWidth:     '88%',
      padding:      bg === 'transparent' ? '0' : '3px 10px',
      fontSize:     fontSizeC,
      lineHeight:   1.35,
      whiteSpace:   'nowrap',
      overflow:     'hidden',
      textOverflow: 'ellipsis',
    };

    return {
      overlayStyle:        base,
      overlayStyleCompact: compact,
      lang:                subtitleLanguage || 'en',
      enabled:             showSubtitles !== false,
    };
  }, [settings]);
}
