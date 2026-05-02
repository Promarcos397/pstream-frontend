/**
 * useKeepAlive — Prevents HF Space from sleeping during active sessions.
 *
 * Sends a ping to /api/ping every `intervalMs` ms (default 30s) while the
 * user is authenticated. This is critical for the torrent fallback feature:
 * if the Space sleeps, the first torrent stream request will have a 30-60s
 * cold start which is unacceptable.
 *
 * Usage: Call once in a top-level component (e.g. _app.tsx or Layout.tsx):
 *   useKeepAlive({ enabled: !!user });
 */

import { useEffect, useRef } from 'react';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://ibrahimar397-pstream-giga.hf.space';

interface KeepAliveOptions {
    /** Only ping when true — typically tied to auth state */
    enabled?: boolean;
    /** Ping interval in ms. Default: 30000 (30s). HF sleeps after 48h idle. */
    intervalMs?: number;
}

export function useKeepAlive({ enabled = false, intervalMs = 30000 }: KeepAliveOptions = {}) {
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        if (!enabled) {
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
            return;
        }

        const ping = async () => {
            try {
                await fetch(`${BACKEND_URL}/api/ping`, { method: 'GET' });
            } catch (_) {
                // Silently ignore — network blips shouldn't crash anything
            }
        };

        // Ping once immediately when enabled
        ping();

        timerRef.current = setInterval(ping, intervalMs);

        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        };
    }, [enabled, intervalMs]);
}
