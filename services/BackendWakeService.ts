/**
 * BackendWakeService
 *
 * Hugging Face free-tier Spaces sleep after ~48h of inactivity.
 * Pings both Giga backend and NewPipe on startup, keeps them alive every 4min.
 * Exposes getStatus() for the admin panel.
 */

const GIGA_BACKEND_URL = import.meta.env.VITE_GIGA_BACKEND_URL || 'https://ibrahimar397-pstream-giga.hf.space';
const NEWPIPE_URL      = import.meta.env.VITE_NEWPIPE_URL      || '';
const PING_URL         = `${GIGA_BACKEND_URL}/api/ping`;
const NEWPIPE_PING_URL = NEWPIPE_URL ? `${NEWPIPE_URL}/health` : '';
const KEEPALIVE_INTERVAL_MS = 4 * 60 * 1000;

type WakeListener = (awake: boolean, waking: boolean) => void;

export interface ServiceStatus {
  giga:     'up' | 'waking' | 'down';
  newpipe:  'up' | 'waking' | 'down' | 'unconfigured';
  lastPing: number;
}

class BackendWakeService {
    private isAwake  = false;
    private isWaking = false;
    private keepAliveTimer: ReturnType<typeof setInterval> | null = null;
    private listeners: WakeListener[] = [];
    private wakePromise: Promise<void> | null = null;
    private _status: ServiceStatus = {
        giga:    'waking',
        newpipe: NEWPIPE_URL ? 'waking' : 'unconfigured',
        lastPing: 0,
    };

    subscribe(fn: WakeListener): () => void {
        this.listeners.push(fn);
        fn(this.isAwake, this.isWaking);
        return () => { this.listeners = this.listeners.filter(l => l !== fn); };
    }

    private notify() {
        for (const fn of this.listeners) fn(this.isAwake, this.isWaking);
    }

    getStatus(): ServiceStatus { return { ...this._status }; }
    get awake()  { return this.isAwake;  }
    get waking() { return this.isWaking; }

    wake(): Promise<void> {
        if (this.isAwake) return Promise.resolve();
        if (this.wakePromise) return this.wakePromise;
        this.wakePromise = this._doWake();
        return this.wakePromise;
    }

    /** Force a manual re-ping (used by admin panel) */
    async pingNow(): Promise<ServiceStatus> {
        try {
            const [g, n] = await Promise.allSettled([
                fetch(PING_URL, { cache: 'no-store', signal: AbortSignal.timeout(6000) }),
                NEWPIPE_PING_URL
                    ? fetch(NEWPIPE_PING_URL, { cache: 'no-store', signal: AbortSignal.timeout(6000) })
                    : Promise.resolve(null),
            ]);
            this._status.giga    = g.status === 'fulfilled' && (g.value as Response)?.ok ? 'up' : 'down';
            this._status.newpipe = NEWPIPE_URL
                ? (n.status === 'fulfilled' && (n.value as Response | null)?.ok ? 'up' : 'down')
                : 'unconfigured';
            this._status.lastPing = Date.now();
        } catch {
            this._status.giga = 'down';
        }
        return this.getStatus();
    }

    private async _pingNewPipe() {
        if (!NEWPIPE_PING_URL) return;
        try {
            const r = await fetch(NEWPIPE_PING_URL, { cache: 'no-store', signal: AbortSignal.timeout(10000) });
            this._status.newpipe = r.ok ? 'up' : 'waking';
        } catch {
            this._status.newpipe = 'waking';
        }
    }

    private async _doWake(): Promise<void> {
        this.isWaking = true;
        this.notify();
        this._pingNewPipe(); // parallel, non-blocking

        let attempts = 0;
        while (attempts < 12) {
            try {
                const res = await fetch(PING_URL, { cache: 'no-store', signal: AbortSignal.timeout(6000) });
                if (res.ok) {
                    this.isAwake = true;
                    this.isWaking = false;
                    this._status.giga = 'up';
                    this._status.lastPing = Date.now();
                    this.notify();
                    this._startKeepAlive();
                    console.log(`[WakeService] ✅ Giga live after ${attempts} retries`);
                    return;
                }
            } catch (_) {}
            attempts++;
            if (attempts < 12) await new Promise(r => setTimeout(r, Math.min(2000 + attempts * 1000, 8000)));
        }
        this.isAwake = true;
        this.isWaking = false;
        this._status.giga = 'down';
        this.notify();
        console.warn('[WakeService] ⚠️ Wake timed out — proceeding anyway');
    }

    private _startKeepAlive() {
        if (this.keepAliveTimer) return;
        this.keepAliveTimer = setInterval(async () => {
            try {
                await fetch(PING_URL, { cache: 'no-store', signal: AbortSignal.timeout(5000) });
                this._status.giga = 'up';
                this._status.lastPing = Date.now();
            } catch (_) {
                this.isAwake = false;
                this._status.giga = 'down';
                this.notify();
            }
            this._pingNewPipe();
        }, KEEPALIVE_INTERVAL_MS);
    }

    destroy() {
        if (this.keepAliveTimer) { clearInterval(this.keepAliveTimer); this.keepAliveTimer = null; }
        this.listeners = [];
    }
}

export const backendWakeService = new BackendWakeService();
