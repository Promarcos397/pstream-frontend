import { useMemo } from 'react';
import { useGlobalContext } from '../context/GlobalContext';
import type { CSSProperties } from 'react';

// ─── Size map ────────────────────────────────────────────────────────────────
const SIZE_MAP: Record<string, string> = {
  small:  'clamp(11px, 1.2vw, 15px)',
  medium: 'clamp(14px, 1.8vw, 20px)',
  large:  'clamp(18px, 2.4vw, 28px)',
};

// For compact contexts (MovieCard hover preview), scale down one step
const SIZE_MAP_COMPACT: Record<string, string> = {
  small:  'clamp(10px, 0.9vw, 12px)',
  medium: 'clamp(11px, 1.1vw, 13px)',
  large:  'clamp(13px, 1.4vw, 16px)',
};

// ─── Color map ───────────────────────────────────────────────────────────────
const COLOR_MAP: Record<string, string> = {
  white:  '#ffffff',
  yellow: '#facc15',
  cyan:   '#67e8f9',
  green:  '#86efac',
};

// ─── Background map ──────────────────────────────────────────────────────────
// subtitleOpacity (0-100) drives the alpha of the background pill
function buildBackground(style: string, opacity: number): string {
  const alpha = Math.round((opacity / 100) * 255).toString(16).padStart(2, '0');
  switch (style) {
    case 'black':     return `rgba(0,0,0,${(opacity / 100).toFixed(2)})`;
    case 'dark':      return `rgba(15,15,15,${(opacity / 100).toFixed(2)})`;
    case 'none':      return 'transparent';
    default:          return `rgba(0,0,0,0.72)`; // safe fallback
  }
}

// ─── Edge style → textShadow ─────────────────────────────────────────────────
function buildTextShadow(edge: string): string {
  switch (edge) {
    case 'drop-shadow': return '0 1px 3px rgba(0,0,0,0.95), 0 0 6px rgba(0,0,0,0.7)';
    case 'outline':     return '1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000';
    case 'raised':      return '0 2px 0 rgba(0,0,0,0.8)';
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
export function useSubtitleStyle(): SubtitleStyleResult {
  const { settings } = useGlobalContext();

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
      background:      bg,
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
