/**
 * services/PipedService.ts
 * ─────────────────────────
 * Resolves a YouTube video ID to a playable DASH/HLS stream URL.
 *
 * The Piped public API instances block CORS for arbitrary browser origins,
 * so all Piped API calls are proxied through the giga backend.
 * The returned DASH manifest URL is on pipedproxy CDN which HAS open CORS
 * (Piped's own web app requires it), so dashjs can load it directly.
 */

const BACKEND = import.meta.env.VITE_GIGA_BACKEND_URL || '';

export interface PipedStream {
  streamUrl:    string;        // DASH manifest URL (dashjs) or HLS URL (hls.js)
  isDASH:       boolean;
  isHLS:        boolean;
  subtitleUrl:  string | null;
  videoId:      string;
  proxyUrl:     string | null;
}

// Module-level cache — backend already caches for 20 min, this prevents
// duplicate in-flight requests within the same browser session.
const _cache = new Map<string, { ts: number; data: PipedStream }>();
const CACHE_TTL = 18 * 60 * 1000; // 18 min (slightly under backend's 20 min)

function cacheGet(key: string): PipedStream | null {
  const hit = _cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.ts > CACHE_TTL) { _cache.delete(key); return null; }
  return hit.data;
}

/**
 * Resolve a YouTube video ID → playable stream via giga backend → Piped CDN.
 * Giga backend proxies the Piped API call (no CORS issue server-side).
 */
export async function getPipedStream(videoId: string): Promise<PipedStream> {
  const cached = cacheGet(videoId);
  if (cached) return cached;

  if (!BACKEND) throw new Error('VITE_GIGA_BACKEND_URL not set');

  const res = await fetch(
    `${BACKEND}/trailer/stream?videoId=${encodeURIComponent(videoId)}`,
    { signal: AbortSignal.timeout(15000) }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `Stream resolve failed: ${res.status}`);
  }

  const data = await res.json();

  if (!data.streamUrl) throw new Error('Backend returned no stream URL');

  const result: PipedStream = {
    streamUrl:  data.streamUrl,
    isDASH:     data.isDASH ?? true,
    isHLS:      data.isHLS  ?? false,
    subtitleUrl: data.subtitleUrl ?? null,
    videoId,
    proxyUrl:   data.proxyUrl ?? null,
  };

  _cache.set(videoId, { ts: Date.now(), data: result });
  return result;
}
