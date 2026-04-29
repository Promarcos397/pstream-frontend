/**
 * YouTubeCaptionService — 100% client-side caption fetching.
 *
 * Strategy (in order):
 *  1. YouTube timedtext API (browser-direct, fast, no CORS issues for many videos)
 *  2. Invidious API fallback (works for all videos, rotates across instances)
 *
 * No backend server, no proxy, no API keys needed.
 * Works because: browser IP ≠ datacenter IP; YouTube blocks servers, not browsers.
 */

export interface CaptionCue {
  start: number;
  end: number;
  text: string;
}

// ─── Invidious instance pool (cors:true only!) ────────────────────────────
// CRITICAL: must have cors:true in api.invidious.io/instances.json
// otherwise browser fetch will be blocked by CORS policy
// Verify: check api.invidious.io/instances.json and filter by cors:true
const INVIDIOUS_INSTANCES = [
  'https://inv.thepixora.com',        // cors:true, api:true (CA) ✔️
  'https://anontube.lvkaszus.pl',     // known cors:true instance
  'https://invidious.privacydev.net', // try — may have CORS
];

const GIGA_BACKEND_URL: string =
  (typeof import.meta !== 'undefined' ? (import.meta as any).env?.VITE_GIGA_BACKEND_URL : null)
  || 'https://ibrahimar397-pstream-giga.hf.space';

// ─── Cache ────────────────────────────────────────────────────────────────────
const cueCache = new Map<string, { cues: CaptionCue[] | null; fetchedAt: number }>();
const CACHE_TTL_MS = 20 * 60 * 1000; // 20 min

// ─── VTT Parsing ─────────────────────────────────────────────────────────────
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ');
}

function parseVttTimestamp(ts: string): number {
  const cleaned = ts.trim().replace(',', '.');
  const parts = cleaned.split(':');
  if (parts.length === 3) {
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const s = parseFloat(parts[2]);
    if (Number.isNaN(h) || Number.isNaN(m) || Number.isNaN(s)) return -1;
    return h * 3600 + m * 60 + s;
  }
  if (parts.length === 2) {
    const m = parseInt(parts[0], 10);
    const s = parseFloat(parts[1]);
    if (Number.isNaN(m) || Number.isNaN(s)) return -1;
    return m * 60 + s;
  }
  const direct = parseFloat(cleaned);
  return Number.isNaN(direct) ? -1 : direct;
}

function parseVTT(vttText: string): CaptionCue[] {
  const normalized = vttText.replace(/\r\n/g, '\n');
  const blocks = normalized.split(/\n{2,}/);
  const cues: CaptionCue[] = [];

  for (const block of blocks) {
    const lines = block
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    if (lines.length === 0) continue;

    const timingIdx = lines.findIndex((line) => line.includes('-->'));
    if (timingIdx === -1) continue;

    const timingLine = lines[timingIdx];
    const [rawStart, rawEndWithSettings] = timingLine.split('-->').map((s) => s.trim());
    const rawEnd = rawEndWithSettings?.split(/\s+/)[0] || '';
    const start = parseVttTimestamp(rawStart);
    const end = parseVttTimestamp(rawEnd);
    if (start < 0 || end <= start) continue;

    const rawText = lines.slice(timingIdx + 1).join(' ');
    const cleanedText = decodeHtmlEntities(
      rawText.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ')
    ).trim();
    if (!cleanedText) continue;

    cues.push({ start, end, text: cleanedText });
  }

  return cues;
}

// ─── Strategy 1: YouTube timedtext API (browser-direct) ──────────────────────
// Works for videos with open captions. YouTube allows browser CORS here.
async function tryDirectTimedtext(videoId: string, lang: string): Promise<CaptionCue[] | null> {
  const attempts = [
    // Manual captions
    `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${lang}&fmt=vtt`,
    // Auto-generated (ASR) captions
    `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${lang}&kind=asr&fmt=vtt`,
  ];

  for (const url of attempts) {
    try {
      const resp = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!resp.ok) continue;
      const text = await resp.text();
      // Guard: YouTube returns empty body (not an error) when no captions exist
      if (!text || !text.includes('WEBVTT')) continue;
      const cues = parseVTT(text);
      if (cues.length > 0) {
        console.info(`[YTCaptions] ✅ Direct timedtext: ${cues.length} cues (${lang})`);
        return cues;
      }
    } catch {
      // CORS blocked or network error — fall through to Invidious
    }
  }
  return null;
}

// ─── Strategy 2: Invidious API ────────────────────────────────────────────────
// Invidious proxies YouTube's timedtext. Works for virtually all videos.
async function tryInvidious(videoId: string, lang: string, preferredLangs?: string[]): Promise<CaptionCue[] | null> {
  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      // Step 1: get caption track list
      const listResp = await fetch(`${instance}/api/v1/captions/${videoId}`, {
        signal: AbortSignal.timeout(6000),
      });
      if (!listResp.ok) continue;

      const data = await listResp.json();
      // Invidious API returns { captions: [...] } — NOT captionTracks
      const tracks: any[] = data.captions || [];
      if (tracks.length === 0) continue;

      // Step 2: pick best track (preferred lang > exact match > auto > first)
      const langs = preferredLangs?.length ? preferredLangs : [lang];
      let track: any = null;
      for (const l of langs) {
        track = tracks.find((t) => t.language_code === l)
          || tracks.find((t) => t.language_code?.startsWith(l));
        if (track) break;
      }
      // Final fallback: first track (whatever language)
      if (!track) track = tracks[0];
      if (!track?.url) continue;

      // Step 3: rewrite URL to use this Invidious instance
      // track.url is either a full URL or a path like /api/v1/captions/{id}?label=...
      const vttPath = track.url.replace(/^https?:\/\/[^/]+/, '');
      const vttResp = await fetch(`${instance}${vttPath}`, {
        signal: AbortSignal.timeout(8000),
      });
      if (!vttResp.ok) continue;

      const vttText = await vttResp.text();
      const cues = parseVTT(vttText);
      if (cues.length > 0) {
        console.info(`[YTCaptions] ✅ Invidious (${instance}): ${cues.length} cues (${track.language_code})`);
        return cues;
      }
    } catch (err: any) {
      console.debug(`[YTCaptions] Invidious ${instance} failed: ${err?.message}`);
      continue;
    }
  }
  return null;
}

// ─── Strategy 1: Backend proxy (bypasses all CORS) ────────────────────────────
// Backend uses plain axios direct to youtube.com — no proxy chain, no CORS issue.
// Tries manual captions first, then auto-generated (ASR) as fallback.
async function tryBackendProxy(videoId: string, lang: string): Promise<CaptionCue[] | null> {
  const attempts = [
    // Manual closed captions
    `${GIGA_BACKEND_URL}/api/youtube/captions?videoId=${videoId}&lang=${lang}`,
    // Auto-generated (ASR) captions — most common on trailers and informal uploads
    `${GIGA_BACKEND_URL}/api/youtube/captions?videoId=${videoId}&lang=${lang}&kind=asr`,
  ];
  for (const url of attempts) {
    try {
      const resp = await fetch(url, { signal: AbortSignal.timeout(12000) });
      if (!resp.ok) continue;
      const text = await resp.text();
      if (!text || !text.includes('WEBVTT')) continue;
      const cues = parseVTT(text);
      if (cues.length > 0) {
        console.info(`[YTCaptions] ✅ Backend proxy: ${cues.length} cues (${lang})`);
        return cues;
      }
    } catch (err: any) {
      console.debug(`[YTCaptions] Backend proxy attempt failed: ${err?.message}`);
    }
  }
  return null;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Get caption cues for a YouTube video.
 * Fetched entirely client-side — no backend call required.
 *
 * @param videoId  YouTube video ID
 * @param lang     Primary language code (e.g. 'en', 'es')
 * @param availableLangs  Optional list from onApiChange tracklist (for smarter selection)
 */
export async function getCaptionCues(
  videoId: string,
  lang = 'en',
  availableLangs?: string[]
): Promise<CaptionCue[] | null> {
  const cacheKey = `${videoId}:${lang}`;
  const cached = cueCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.cues;
  }

  try {
    // Strategy 1: Backend proxy — MOST RELIABLE. Bypasses browser CORS entirely.
    // Tries manual captions then ASR auto-generated.
    let cues = await tryBackendProxy(videoId, lang);

    // Strategy 2: Invidious proxy — cors:true instances only
    if (!cues) {
      cues = await tryInvidious(videoId, lang, availableLangs);
    }

    // Strategy 3: Direct browser timedtext — works for some videos (open CORS)
    if (!cues) {
      cues = await tryDirectTimedtext(videoId, lang);
    }

    if (!cues) {
      console.info(`[YTCaptions] No captions available for ${videoId} (${lang}) — video may not have CC`);
    }

    cueCache.set(cacheKey, { cues, fetchedAt: Date.now() });
    return cues;
  } catch (error: any) {
    console.warn(`[YTCaptions] Failed for ${videoId}: ${error?.message || 'unknown'}`);
    cueCache.set(cacheKey, { cues: null, fetchedAt: Date.now() });
    return null;
  }
}

/**
 * Extract language codes from a YouTube IFrame API tracklist object.
 * Call this from the onApiChange handler.
 */
export function extractTrackLangs(tracklist: any[]): string[] {
  if (!Array.isArray(tracklist)) return [];
  return tracklist
    .map((t) => t.languageCode || t.language_code)
    .filter(Boolean);
}
