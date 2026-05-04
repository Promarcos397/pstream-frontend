/**
 * services/PipedService.ts
 * ─────────────────────────
 * Resolves a YouTube video ID to a playable stream URL via Cobalt.
 *
 * Flow:
 *  1. Frontend calls getPipedStream(videoId)
 *  2. Giga backend /trailer/cobalt calls Cobalt API server-side (no CORS issue)
 *  3. Cobalt returns a tunnel URL — their servers handle YouTube extraction + 4K merge
 *  4. Browser plays the Cobalt tunnel URL as a plain <video src> mp4
 *
 * Quality: up to 4K (Cobalt handles bestvideo+bestaudio server-side)
 * No YouTube player UI, no branding, fully custom.
 */

const BACKEND = import.meta.env.VITE_GIGA_BACKEND_URL || '';

export interface PipedStream {
  streamUrl:    string;
  isDASH:       boolean;
  isHLS:        boolean;
  subtitleUrl:  string | null;
  videoId:      string;
  proxyUrl:     string | null;
  source:       'cobalt' | 'piped';
  quality?:     string;
}

const _cache = new Map<string, { ts: number; data: PipedStream }>();
const CACHE_TTL = 25 * 60 * 1000; // 25 min (Cobalt tunnel URLs valid ~30 min)

function cacheGet(key: string): PipedStream | null {
  const hit = _cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.ts > CACHE_TTL) { _cache.delete(key); return null; }
  return hit.data;
}

export async function getPipedStream(videoId: string, quality = '1080'): Promise<PipedStream> {
  const cacheKey = `${videoId}:${quality}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  if (!BACKEND) throw new Error('VITE_GIGA_BACKEND_URL not set');

  // ── Primary: Cobalt (their servers, their IP, their bot detection) ────────
  try {
    const params = new URLSearchParams({ videoId, quality });
    const res = await fetch(`${BACKEND}/trailer/cobalt?${params}`, {
      signal: AbortSignal.timeout(20000),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.url) {
        const result: PipedStream = {
          streamUrl:   data.url,
          isDASH:      false,   // Cobalt tunnel is a plain mp4 stream
          isHLS:       false,
          subtitleUrl: null,
          videoId,
          proxyUrl:    null,
          source:      'cobalt',
          quality:     data.quality,
        };
        _cache.set(cacheKey, { ts: Date.now(), data: result });
        return result;
      }
    }
  } catch {
    // Cobalt unavailable — fall through to Piped
  }

  // ── Fallback: Piped DASH manifest via backend proxy ───────────────────────
  const res = await fetch(
    `${BACKEND}/trailer/stream?videoId=${encodeURIComponent(videoId)}`,
    { signal: AbortSignal.timeout(15000) }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `Stream resolve failed: ${res.status}`);
  }

  const data = await res.json();
  if (!data.streamUrl) throw new Error('No stream URL returned');

  const result: PipedStream = {
    streamUrl:   data.streamUrl,
    isDASH:      data.isDASH ?? true,
    isHLS:       data.isHLS  ?? false,
    subtitleUrl: data.subtitleUrl ?? null,
    videoId,
    proxyUrl:    data.proxyUrl ?? null,
    source:      'piped',
  };

  _cache.set(cacheKey, { ts: Date.now(), data: result });
  return result;
}
