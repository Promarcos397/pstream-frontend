const GIGA_BACKEND_URL =
  import.meta.env.VITE_GIGA_BACKEND_URL || 'https://ibrahimar397-pstream-giga.hf.space';

export interface CaptionCue {
  start: number;
  end: number;
  text: string;
}

const cueCache = new Map<string, { cues: CaptionCue[] | null; fetchedAt: number }>();
const CACHE_TTL_MS = 15 * 60 * 1000;

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
    const cleanedText = decodeHtmlEntities(rawText.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ')).trim();
    if (!cleanedText) continue;

    cues.push({ start, end, text: cleanedText });
  }

  return cues;
}

async function fetchCaptionsOnce(videoId: string, lang: string, timeoutMs: number): Promise<Response> {
  const params = new URLSearchParams({ videoId, lang });
  return fetch(`${GIGA_BACKEND_URL}/api/youtube/captions?${params.toString()}`, {
    signal: AbortSignal.timeout(timeoutMs),
  });
}

export async function getCaptionCues(videoId: string, lang = 'en'): Promise<CaptionCue[] | null> {
  const cacheKey = `${videoId}:${lang}`;
  const cached = cueCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.cues;
  }

  try {
    // Retry once with a longer timeout. HF cold starts and transient network jitter
    // can exceed the first request window.
    let response: Response;
    try {
      response = await fetchCaptionsOnce(videoId, lang, 12000);
    } catch (firstError: any) {
      const isTimeout = firstError?.name === 'TimeoutError' || /timed out/i.test(firstError?.message || '');
      if (!isTimeout) throw firstError;
      response = await fetchCaptionsOnce(videoId, lang, 22000);
    }

    if (!response.ok) {
      cueCache.set(cacheKey, { cues: null, fetchedAt: Date.now() });
      return null;
    }

    const vttText = await response.text();
    const cues = parseVTT(vttText);
    const normalized = cues.length > 0 ? cues : null;
    cueCache.set(cacheKey, { cues: normalized, fetchedAt: Date.now() });
    return normalized;
  } catch (error: any) {
    console.warn(`[YTCaptions] Failed for ${videoId}: ${error?.message || 'unknown error'}`);
    cueCache.set(cacheKey, { cues: null, fetchedAt: Date.now() });
    return null;
  }
}
