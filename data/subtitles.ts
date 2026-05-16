export interface SubtitleOption {
  id: string;
  label: string;
  value?: string; // Optional raw value (like HEX or CSS stack)
}

export const SUBTITLE_FONTS: SubtitleOption[] = [
  { id: 'brand',      label: 'Netflix Sans',               value: "'Netflix Sans', sans-serif" },
  { id: 'sans-serif', label: 'subtitles.fonts.sansSerif',  value: "'Netflix Sans', 'Roboto', 'Helvetica Neue', Arial, sans-serif" },
  { id: 'monospace',  label: 'subtitles.fonts.monospace',  value: "'Netflix Sans', 'Consolas', monospace" },
  { id: 'typewriter', label: 'subtitles.fonts.typewriter', value: "'Courier New', Courier, monospace" },
  { id: 'print',      label: 'subtitles.fonts.print',      value: "'Palatino', 'Book Antiqua', Palatino, serif" },
  { id: 'block',      label: 'subtitles.fonts.block',      value: "'Impact', 'Charcoal', sans-serif" },
  { id: 'casual',     label: 'subtitles.fonts.casual',     value: "'Comic Sans MS', 'Comic Sans', cursive" },
  { id: 'cursive',    label: 'subtitles.fonts.cursive',    value: "'Monotype Corsiva', 'Apple Chancery', cursive" },
  { id: 'small-caps', label: 'subtitles.fonts.smallCaps',  value: "'Netflix Sans', sans-serif" }, 
];

export const SUBTITLE_COLORS: SubtitleOption[] = [
  { id: 'white',   label: 'colors.white',   value: '#ffffff' },
  { id: 'yellow',  label: 'colors.yellow',  value: '#facc15' },
  { id: 'cyan',    label: 'colors.cyan',    value: '#67e8f9' },
  { id: 'green',   label: 'colors.green',   value: '#86efac' },
  { id: 'red',     label: 'colors.red',     value: '#ef4444' },
  { id: 'blue',    label: 'colors.blue',    value: '#3b82f6' },
  { id: 'magenta', label: 'colors.magenta', value: '#d946ef' },
  { id: 'black',   label: 'colors.black',   value: '#000000' },
];

export const SUBTITLE_SIZES: SubtitleOption[] = [
  { id: 'tiny',   label: 'subtitles.sizes.tiny',   value: 'clamp(10px, 1.0vw, 13px)' },
  { id: 'small',  label: 'subtitles.sizes.small',  value: 'clamp(12px, 1.3vw, 16px)' },
  { id: 'medium', label: 'subtitles.sizes.medium', value: 'clamp(15px, 1.9vw, 22px)' },
  { id: 'large',  label: 'subtitles.sizes.large',  value: 'clamp(19px, 2.5vw, 30px)' },
  { id: 'huge',   label: 'subtitles.sizes.huge',   value: 'clamp(24px, 3.2vw, 42px)' },
];

export const SUBTITLE_EDGES: SubtitleOption[] = [
  { id: 'none',         label: 'subtitles.edges.none',       value: 'none' },
  { id: 'drop-shadow',  label: 'subtitles.edges.dropShadow', value: '0 1px 4px rgba(0,0,0,0.95), 0 0 12px rgba(0,0,0,0.8)' },
  { id: 'outline',      label: 'subtitles.edges.outline',    value: '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000' },
  { id: 'raised',       label: 'subtitles.edges.raised',     value: '0 2px 0 rgba(0,0,0,0.8), 0 4px 6px rgba(0,0,0,0.5)' },
  { id: 'depressed',    label: 'subtitles.edges.depressed',  value: 'inset 0 1px 2px rgba(0,0,0,0.6)' },
  { id: 'uniform',      label: 'subtitles.edges.uniform',    value: '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000' },
];

export const DEFAULT_SUBTITLE_SETTINGS = {
  showSubtitles: true,
  subtitleSize: 'medium',
  subtitleColor: 'white',
  subtitleBackground: 'none',
  subtitleOpacity: 75,
  subtitleBlur: 0,
  subtitleFontFamily: 'brand', 
  subtitleEdgeStyle: 'drop-shadow',
  subtitleWindowColor: 'black',
  subtitleLanguage: 'en',
} as const;
