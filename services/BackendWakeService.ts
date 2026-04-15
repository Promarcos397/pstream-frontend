/**
 * BackendWakeService
 *
 * Hugging Face free-tier Spaces sleep after ~48h of inactivity with no
 * external traffic. The first request after sleep returns 503 until the
 * container is provisioned (~15-30s). This causes the frontend to hammer
 * hundreds of simultaneous failed requests (profiles, stream, subtitles…).
 *
 * This service:
 *  1. Pings GET /api/ping on startup (fast, cheap endpoint).
 *  2. Keeps pinging every 4 minutes so the space never sleeps during a session.
 *  3. Exposes `isAwake` / `isWaking` so the UI can show a waiting indicator.
 */

const GIGA_BACKEND_URL = import.meta.env.VITE_GIGA_BACKEND_URL || 'https://ibrahimar397-pstream-giga.hf.space';
const PING_URL = `${GIGA_BACKEND_URL}/api/ping`;
const KEEPALIVE_INTERVAL_MS = 4 * 60 * 1000; // 4 minutes

type WakeListener = (awake: boolean, waking: boolean) => void;

class BackendWakeService {
    private isAwake = false;
    private isWaking = false;
    private keepAliveTimer: ReturnType<typeof setInterval> | null = null;
    private listeners: WakeListener[] = [];
    private wakePromise: Promise<void> | null = null;

    subscribe(fn: WakeListener): () => void {
        this.listeners.push(fn);
        // Immediately notify the new subscriber of current state
        fn(this.isAwake, this.isWaking);
        return () => { this.listeners = this.listeners.filter(l => l !== fn); };
    }

    private notify() {
        for (const fn of this.listeners) fn(this.isAwake, this.isWaking);
    }

    /** Call once on app mount. Returns when the backend is confirmed live. */
    wake(): Promise<void> {
        if (this.isAwake) return Promise.resolve();
        if (this.wakePromise) return this.wakePromise;

        this.wakePromise = this._doWake();
        return this.wakePromise;
    }

    private async _doWake(): Promise<void> {
        this.isWaking = true;
        this.notify();

        let attempts = 0;
        const maxAttempts = 12; // 12 × 5s = 60s max wait
        while (attempts < maxAttempts) {
            try {
                const res = await fetch(PING_URL, {
                    method: 'GET',
                    cache: 'no-store',
                    signal: AbortSignal.timeout(6000),
                });
                if (res.ok) {
                    this.isAwake = true;
                    this.isWaking = false;
                    this.notify();
                    this._startKeepAlive();
                    console.log(`[WakeService] ✅ Backend is live after ${attempts} retries`);
                    return;
                }
            } catch (_) {
                // 503 or network error — space is waking
            }
            attempts++;
            if (attempts < maxAttempts) {
                // Exponential backoff: 2s, 3s, 4s… capped at 8s
                await new Promise(r => setTimeout(r, Math.min(2000 + attempts * 1000, 8000)));
            }
        }

        // Gave up — still mark as "awake" so app doesn't block forever
        // (user may have ad-blocker, offline, etc.)
        this.isAwake = true;
        this.isWaking = false;
        this.notify();
        console.warn('[WakeService] ⚠️ Backend wake timed out — proceeding anyway');
    }

    private _startKeepAlive() {
        if (this.keepAliveTimer) return;
        this.keepAliveTimer = setInterval(async () => {
            try {
                await fetch(PING_URL, { method: 'GET', cache: 'no-store', signal: AbortSignal.timeout(5000) });
            } catch (_) {
                // If ping fails, next real request will wake it again
                this.isAwake = false;
                this.notify();
            }
        }, KEEPALIVE_INTERVAL_MS);
    }

    destroy() {
        if (this.keepAliveTimer) {
            clearInterval(this.keepAliveTimer);
            this.keepAliveTimer = null;
        }
        this.listeners = [];
    }
}

export const backendWakeService = new BackendWakeService();
