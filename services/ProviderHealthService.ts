/**
 * ProviderHealthService
 *
 * Sends provider success/error signals to the backend so the self-healing
 * resolver can adjust provider priorities automatically.
 *
 * - Errors are reported when HLS.js fires a fatal error (429, 403, network)
 * - Successes are reported after 10s of uninterrupted playback
 * - All calls are fire-and-forget (non-blocking, non-critical)
 */

const BACKEND = import.meta.env.VITE_GIGA_BACKEND_URL || 'https://ibrahimar397-pstream-giga.hf.space';

/**
 * Report a stream error for a provider.
 * Called by useHls.ts when HLS.js fires a fatal error.
 */
export async function reportStreamError(params: {
    provider: string;
    tmdbId?: string;
    type?: string;
    error?: string;
    errorCode?: string | number;
}): Promise<void> {
    try {
        await fetch(`${BACKEND}/api/stream/report-error`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params),
            // Short timeout — fire-and-forget
            signal: AbortSignal.timeout(5000),
        });
    } catch {
        // Silently fail — error reporting is non-critical
    }
}

/**
 * Report a successful stream for a provider.
 * Called by VideoPlayer after 10s of uninterrupted playback.
 */
export async function reportStreamSuccess(provider: string): Promise<void> {
    try {
        await fetch(`${BACKEND}/api/stream/report-success`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ provider }),
            signal: AbortSignal.timeout(5000),
        });
    } catch {
        // Silently fail
    }
}
