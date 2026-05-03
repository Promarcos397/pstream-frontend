/**
 * services/PipedService.ts
 * ─────────────────────────
 * Resolves a YouTube video ID to a playable stream URL via Piped.video —
 * an open-source YouTube debrid network. Their CDN delivers the bytes,
 * so there's no IP-lock and no YouTube branding.
 *
 * For regular videos Piped returns a DASH manifest (video + audio muxed
 * by dashjs in the player). HLS is only returned for livestreams.
 *
 * Multiple public instances are tried in order — if one fails or is rate-
 * limited, the next one takes over.
 */

// Public instances from different operators — not just kavin.rocks
// so a single operator going down doesn't kill everything.
const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',           // kavin (most popular)
  'https://api.piped.projectsegfau.lt',     // projectsegfault
  'https://piped-api.garudalinux.org',      // garuda linux
  'https://api.piped.privacydev.net',       // privacydev
  'https://pipedapi.in.projectsegfau.lt',   // india region
  'https://pipedapi.adminforge.de',         // adminforge
];

export interface PipedStream {
  streamUrl:    string;        // DASH manifest URL (use dashjs) or HLS URL (use hls.js)
  isDASH:       boolean;       // true → dashjs  |  false → hls.js
  isHLS:        boolean;       // true → hls.js  |  false → dashjs
  subtitleUrl:  string | null; // WebVTT subtitle (proxied through Piped CDN)
  videoId:      string;
  proxyUrl:     string | null; // Piped proxy base URL for rewrites
}

// 25-minute module cache (Piped DASH URLs typically expire in ~30 min)
const _cache = new Map<string, { ts: number; data: PipedStream }>();
const CACHE_TTL = 25 * 60 * 1000;

function cacheGet(key: string): PipedStream | null {
  const hit = _cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.ts > CACHE_TTL) { _cache.delete(key); return null; }
  return hit.data;
}

async function fetchFromPiped(videoId: string): Promise<any> {
  let lastErr: any;
  for (const base of PIPED_INSTANCES) {
    try {
      const res = await fetch(`${base}/streams/${videoId}`, {
        signal: AbortSignal.timeout(8000),
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) { lastErr = new Error(`HTTP ${res.status} from ${base}`); continue; }
      return await res.json();
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('All Piped instances failed');
}

/**
 * Resolve a YouTube video ID → playable stream via Piped CDN.
 *
 * Response shape from Piped /streams/{videoId}:
 *   dash        — DASH manifest URL (non-null for regular videos ✓)
 *   hls         — HLS manifest URL  (non-null for livestreams only)
 *   videoStreams — array, all entries have videoOnly:true (can't use directly)
 *   audioStreams — separate audio tracks
 *   subtitles   — array of subtitle objects
 *   proxyUrl    — Piped proxy base for URL rewrites
 */
export async function getPipedStream(videoId: string): Promise<PipedStream> {
  const cached = cacheGet(videoId);
  if (cached) return cached;

  const data = await fetchFromPiped(videoId);

  // DASH manifest — present for all regular (non-livestream) YouTube videos
  const dash: string | null = data.dash || null;

  // HLS manifest — present only for livestreams
  const hls: string | null = data.hls || null;

  if (!dash && !hls) {
    throw new Error(`Piped returned no playable manifest for ${videoId}`);
  }

  // Subtitle — prefer English VTT
  const subtitles: any[] = data.subtitles || [];
  const sub = subtitles.find(
    (s: any) =>
      (s.code === 'en' || s.code === 'en-US') &&
      (s.mimeType === 'text/vtt' || s.mimeType === 'application/ttml+xml')
  );

  const result: PipedStream = {
    streamUrl:   (dash || hls)!,
    isDASH:      !!dash,
    isHLS:       !dash && !!hls,
    subtitleUrl: sub?.url || null,
    videoId,
    proxyUrl:    data.proxyUrl || null,
  };

  _cache.set(videoId, { ts: Date.now(), data: result });
  return result;
}
