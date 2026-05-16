import { useMemo } from 'react';
import { useGlobalContext } from '../context/GlobalContext';
import type { CSSProperties } from 'react';
import { AppSettings } from '../types';
import { SUBTITLE_FONTS, SUBTITLE_COLORS, SUBTITLE_SIZES, SUBTITLE_EDGES } from '../constants';

/**
 * Single source of truth for subtitle visuals + language.
 * Use this in every subtitle renderer in the app:
 *  - VideoPlayer (native <track> / custom cue div)
 *  - HeroCarouselBackground YouTube overlay
 *  - InfoModal YouTube overlay
 *  - MovieCard hover preview overlay
 */
export function useSubtitleStyle(customSettings?: AppSettings): {
  overlayStyle: CSSProperties;
  overlayStyleCompact: CSSProperties;
  lang: string;
  enabled: boolean;
} {
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
      subtitleFontFamily = 'monospace',
      subtitleEdgeStyle = 'drop-shadow',
      subtitleLanguage = 'en',
    } = settings;

    // Resolve tokens to CSS values
    const color = SUBTITLE_COLORS.find(c => c.id === subtitleColor)?.value || subtitleColor || '#ffffff';
    const shadow = SUBTITLE_EDGES.find(e => e.id === subtitleEdgeStyle)?.value || 'none';
    const fontStack = SUBTITLE_FONTS.find(f => f.id === subtitleFontFamily)?.value || subtitleFontFamily || 'sans-serif';
    
    // Size logic
    const fontSize = SUBTITLE_SIZES.find(s => s.id === subtitleSize)?.value || '18px';
    // Small scaling for compact views (clamped)
    const fontSizeCompact = `calc(${fontSize} * 0.7)`;

    // Background build
    const alpha = (subtitleOpacity / 100).toFixed(2);
    const bg = subtitleBackground === 'none' ? 'transparent' : `rgba(0,0,0,${alpha})`;

    const base: CSSProperties = {
      position:        'absolute',
      bottom:          '18%', // Default — can be overridden by consumer (VideoPlayer)
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
      fontFamily:      fontStack,
      fontWeight:      500,
      lineHeight:      1.4,
      letterSpacing:   '0.01em',
      textShadow:      shadow,
      transition:      'opacity 0.15s ease',
      backdropFilter:  subtitleBlur > 0 ? `blur(${subtitleBlur}px)` : undefined,
      fontSize,
      fontVariant:     subtitleFontFamily === 'small-caps' ? 'small-caps' : 'normal',
    };

    const compact: CSSProperties = {
      ...base,
      bottom:       '8%',
      maxWidth:     '88%',
      padding:      bg === 'transparent' ? '0' : '3px 10px',
      fontSize:     fontSizeCompact,
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

