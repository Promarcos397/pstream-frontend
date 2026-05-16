/**
 * data/languages.ts
 * ──────────────────
 * Static language option lists — moved out of constants.ts.
 */

export const DISPLAY_LANGUAGES = [
  { code: 'en-US', label: 'English (US)' },
  { code: 'en-GB', label: 'English (UK)' },
  { code: 'es-ES', label: 'Español (España)' },
  { code: 'es-MX', label: 'Español (México)' },
  { code: 'fr-FR', label: 'Français' },
  { code: 'de-DE', label: 'Deutsch' },
  { code: 'it-IT', label: 'Italiano' },
  { code: 'pt-BR', label: 'Português (Brasil)' },
  { code: 'pt-PT', label: 'Português (Portugal)' },
  { code: 'ja-JP', label: '日本語' },
  { code: 'ko-KR', label: '한국어' },
  { code: 'zh-CN', label: '中文 (简体)' },
  { code: 'zh-TW', label: '中文 (繁體)' },
  { code: 'ar-SA', label: 'العربية' },
  { code: 'hi-IN', label: 'हिन्दी' },
  { code: 'ru-RU', label: 'Русский' },
  { code: 'tr-TR', label: 'Türkçe' },
  { code: 'pl-PL', label: 'Polski' },
  { code: 'nl-NL', label: 'Nederlands' },
  { code: 'sv-SE', label: 'Svenska' },
];

/** 
 * Central ISO 639-1 → Display Label map.
 * Used for UI display and detecting languages from raw subtitle labels.
 */
export const LANG_LABELS: Record<string, string> = {
  en: 'English', es: 'Spanish', fr: 'French', de: 'German', it: 'Italian',
  pt: 'Portuguese', ru: 'Russian', ja: 'Japanese', ko: 'Korean', zh: 'Chinese',
  ar: 'Arabic', tr: 'Turkish', nl: 'Dutch', pl: 'Polish', sv: 'Swedish',
  da: 'Danish', fi: 'Finnish', no: 'Norwegian', hu: 'Hungarian', el: 'Greek',
  he: 'Hebrew', cs: 'Czech', ro: 'Romanian', th: 'Thai', vi: 'Vietnamese',
  id: 'Indonesian', uk: 'Ukrainian', hr: 'Croatian', sk: 'Slovak', bg: 'Bulgarian',
  sr: 'Serbian', hi: 'Hindi', bn: 'Bengali', fa: 'Persian', ms: 'Malay',
  ca: 'Catalan', lt: 'Lithuanian', lv: 'Latvian', et: 'Estonian', sl: 'Slovenian',
};

/**
 * OpenSubtitles Legacy Language IDs (ISO 639-2/3 equivalents).
 */
export const LANG_TO_OS: Record<string, string> = {
  en: 'eng', es: 'spa', fr: 'fre', de: 'ger', it: 'ita', pt: 'por',
  ru: 'rus', ja: 'jpn', ko: 'kor', zh: 'chi', ar: 'ara', tr: 'tur',
  nl: 'dut', pl: 'pol', sv: 'swe', da: 'dan', fi: 'fin', no: 'nor',
  hu: 'hun', el: 'ell', he: 'heb', cs: 'cze', ro: 'rum', th: 'tha',
  vi: 'vie', id: 'ind', uk: 'ukr', hr: 'hrv', sk: 'slo', bg: 'bul',
  sr: 'srp', hi: 'hin',
};

export const SUBTITLE_LANGUAGES = Object.entries(LANG_LABELS).map(([code, label]) => ({
  code,
  label
})).sort((a, b) => a.label.localeCompare(b.label));
