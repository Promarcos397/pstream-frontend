/**
 * services/prefetch.ts
 * ─────────────────────
 * Stream prefetch queue — moved out of api.ts.
 *
 * Strategy:
 *  WARM mode (batch list/history): fires a backend /api/stream hit to prime
 *    Redis cache + prevent HF Space sleep. No local storage (tokens expire).
 *  HOT mode (hover/InfoModal): intentional no-op — IP-locked tokens (2-5min TTL)
 *    make local caching useless. Backend Redis handles the hot path.
 *
 * Concurrency: max 2 concurrent prefetches, 700ms min interval, 40 item queue cap.
 */

const GIGA_URL = (import.meta as any).env?.VITE_GIGA_BACKEND_URL || 'https://ibrahimar397-pstream-giga.hf.space';

const COOLDOWN_MS     = 10 * 60 * 1000; // 10 min — keeps warmed content hot between views
const MIN_INTERVAL_MS = 500;             // slightly faster spacing
const MAX_CONCURRENCY = 3;
const QUEUE_LIMIT     = 60;

const warmedSet   = new Set<string>();
const lastQueued  = new Map<string, number>();
const queue: Array<{ key: string; run: () => Promise<void>; priority: number }> = [];

let active    = 0;
let lastStart = 0;
let pumpTimer: ReturnType<typeof setTimeout> | null = null;

function enqueue(key: string, priority: number, run: () => Promise<void>) {
  if (queue.some(t => t.key === key)) return;
  if (queue.length >= QUEUE_LIMIT) return;
  queue.push({ key, priority, run });
  queue.sort((a, b) => b.priority - a.priority);
  pump();
}

function pump() {
  if (active >= MAX_CONCURRENCY || queue.length === 0 || pumpTimer) return;
  const wait = Math.max(0, MIN_INTERVAL_MS - (Date.now() - lastStart));
  pumpTimer = setTimeout(async () => {
    pumpTimer = null;
    if (active >= MAX_CONCURRENCY) return;
    const next = queue.shift();
    if (!next) return;
    active++;
    lastStart = Date.now();
    try { await next.run(); } finally {
      active = Math.max(0, active - 1);
      pump();
    }
  }, wait);
}

export const prefetchStream = async (
  title:    string,
  year:     number | undefined,
  tmdbId:   string,
  type:     'movie' | 'tv',
  season:   number = 1,
  episode:  number = 1,
  imdbId?:  string,
  _mode:    'warm' | 'hot' = 'warm',
): Promise<void> => {
  if (!tmdbId) return;

  const key = `${tmdbId}-${type}-${season}-${episode}`;
  const now = Date.now();
  if (now - (lastQueued.get(key) || 0) < COOLDOWN_MS) return;
  lastQueued.set(key, now);
  if (warmedSet.has(key)) return;

  const params = new URLSearchParams({
    tmdbId, type,
    season:  season.toString(),
    episode: episode.toString(),
    title:   title || '',
    year:    year ? year.toString() : '',
    imdbId:  imdbId || '',
  });

  enqueue(key, _mode === 'hot' ? 3 : 1, async () => {
    warmedSet.add(key);
    await fetch(`${GIGA_URL}/api/stream?${params}`, { signal: AbortSignal.timeout(25000) })
      .catch(() => { /* silent — prefetch failures never affect UX */ });
    console.log(`[Prefetch] 🔥 Warmed: ${title} (${type})`);
  });
};

export const schedulePrefetchQueue = (
  items: Array<{
    tmdbId:   string;
    type:     'movie' | 'tv';
    title:    string;
    year?:    number;
    season?:  number;
    episode?: number;
    imdbId?:  string;
  }>,
  maxItems = 6,
): void => {
  items.slice(0, maxItems).forEach(item =>
    prefetchStream(item.title, item.year, item.tmdbId, item.type,
      item.season || 1, item.episode || 1, item.imdbId, 'warm')
  );
  console.log(`[Prefetch] 📋 Queued ${Math.min(items.length, maxItems)} warm prefetches`);
};
