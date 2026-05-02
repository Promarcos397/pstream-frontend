/**
 * ProviderHealthService
 *
 * Dual-layer health tracking:
 *  1. Fire-and-forget reports to backend (/api/stream/report-*)
 *  2. Local in-memory store for Ghost panel visibility
 *
 * - Errors: reported when HLS.js fires a fatal error (429, 403, network)
 * - Successes: reported after 10s of uninterrupted playback
 */

const BACKEND = import.meta.env.VITE_GIGA_BACKEND_URL || 'https://ibrahimar397-pstream-giga.hf.space';

// ─── Local client-side health store ──────────────────────────────────────────
interface ProviderRecord {
  providerId:   string;
  successCount: number;
  failCount:    number;
  avgLatencyMs: number | null;
  lastSeen:     number;
  status:       'healthy' | 'degraded' | 'down';
}

const _store = new Map<string, ProviderRecord>();

function _upsert(id: string, success: boolean, latencyMs?: number) {
  const existing = _store.get(id) || {
    providerId: id, successCount: 0, failCount: 0,
    avgLatencyMs: null, lastSeen: 0, status: 'healthy' as const,
  };
  if (success) {
    existing.successCount++;
    if (latencyMs != null) {
      existing.avgLatencyMs = existing.avgLatencyMs == null
        ? latencyMs
        : Math.round((existing.avgLatencyMs * 0.7 + latencyMs * 0.3));
    }
  } else {
    existing.failCount++;
  }
  existing.lastSeen = Date.now();
  const total = existing.successCount + existing.failCount;
  const failRate = total > 0 ? existing.failCount / total : 0;
  existing.status = failRate > 0.6 ? 'down' : failRate > 0.3 ? 'degraded' : 'healthy';
  _store.set(id, existing);
}

/** Returns sorted provider health records for Ghost panel display. */
export function getAllProviderHealth(): ProviderRecord[] {
  return Array.from(_store.values()).sort((a, b) => b.lastSeen - a.lastSeen);
}

// ─── Backend reporting ─────────────────────────────────────────────────────

export async function reportStreamError(params: {
  provider:     string;
  providerId?:  string;
  tmdbId?:      string;
  type?:        string;
  season?:      number;
  episode?:     number;
  error?:       string;
  errorCode?:   string | number;
}): Promise<void> {
  _upsert(params.providerId || params.provider, false);
  try {
    await fetch(`${BACKEND}/api/stream/report-error`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
      signal: AbortSignal.timeout(5000),
    });
  } catch { /* non-critical */ }
}

export async function reportStreamSuccess(
  provider: string, providerId?: string, latencyMs?: number
): Promise<void> {
  _upsert(providerId || provider, true, latencyMs);
  try {
    await fetch(`${BACKEND}/api/stream/report-success`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, providerId }),
      signal: AbortSignal.timeout(5000),
    });
  } catch { /* non-critical */ }
}

