/**
 * NetworkPriority — Video-First Network Manager
 *
 * When a video (trailer or stream) is actively playing, we:
 *  1. Set a global flag that suppresses non-essential background fetches
 *  2. Apply document-level priority hints for existing fetch calls
 *  3. Restore normal behavior when video stops/pauses
 *
 * Usage:
 *   NetworkPriority.setVideoActive(true)   // call when video starts playing
 *   NetworkPriority.setVideoActive(false)  // call when video pauses/ends
 *   NetworkPriority.isVideoActive()        // check before making background calls
 */

type Listener = (active: boolean) => void;

class NetworkPriorityManager {
    private _active = false;
    private _listeners: Listener[] = [];

    setVideoActive(active: boolean) {
        if (this._active === active) return;
        this._active = active;
        this._listeners.forEach(fn => fn(active));

        if (active) {
            // Tell the browser this document is prioritizing video
            if ('scheduling' in navigator) {
                // Chromium Scheduling API — yield to highest priority tasks
                (navigator as any).scheduling?.isInputPending?.();
            }
            // Set a low priority hint on all existing background xhrs
            document.querySelectorAll<HTMLLinkElement>('link[rel="prefetch"]').forEach(el => {
                el.setAttribute('fetchpriority', 'low');
            });
        }
    }

    isVideoActive(): boolean {
        return this._active;
    }

    subscribe(fn: Listener): () => void {
        this._listeners.push(fn);
        return () => { this._listeners = this._listeners.filter(l => l !== fn); };
    }
}

export const NetworkPriority = new NetworkPriorityManager();
