/**
 * Module-level avatar preload cache.
 *
 * Lives outside React — persists across component mounts/unmounts for the
 * entire browser session. Two layers of caching:
 *   1. <link rel="preload"> hint   → browser fetches at highest priority, before React even renders
 *   2. in-memory `loaded` Set      → components skip the fade-in transition for already-loaded images
 *
 * Usage:
 *   preloadAvatar(url)         – fire-and-forget, safe to call many times
 *   preloadAvatars([...urls])  – batch version
 *   isAvatarLoaded(url)        – synchronous check for initial state
 *   onAvatarLoaded(url, cb)    – subscribe to load completion, returns unsubscribe fn
 */

const loaded = new Set<string>();
const pending = new Set<string>();
const subscribers = new Map<string, Set<() => void>>();

function notify(url: string): void {
  subscribers.get(url)?.forEach(cb => cb());
  subscribers.delete(url);
}

export function isAvatarLoaded(url: string): boolean {
  return loaded.has(url);
}

/**
 * Subscribe to an avatar's load completion.
 * If already loaded, fires callback synchronously and returns a no-op.
 * Returns an unsubscribe function.
 */
export function onAvatarLoaded(url: string, cb: () => void): () => void {
  if (loaded.has(url)) {
    cb();
    return () => {};
  }
  if (!subscribers.has(url)) subscribers.set(url, new Set());
  subscribers.get(url)!.add(cb);
  return () => subscribers.get(url)?.delete(cb);
}

/**
 * Inject a <link rel="preload"> hint and track load completion.
 * Safe to call multiple times with the same URL — deduped automatically.
 */
export function preloadAvatar(url: string): void {
  if (!url || loaded.has(url) || pending.has(url)) return;
  pending.add(url);

  // Ask the browser to fetch the image at highest priority before components need it.
  // This is a hint, not a guarantee — ignored in environments without document (SSR).
  if (typeof document !== 'undefined') {
    if (!document.querySelector(`link[rel="preload"][href="${url}"]`)) {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = url;
      // Google Drive (lh3.googleusercontent.com) rejects requests that include
      // a Referer header pointing to another domain — must suppress it.
      link.setAttribute('referrerpolicy', 'no-referrer');
      document.head.appendChild(link);
    }
  }

  // Track actual completion so isAvatarLoaded() is accurate for instant renders.
  const img = new Image();
  img.referrerPolicy = 'no-referrer';
  img.onload = () => {
    loaded.add(url);
    pending.delete(url);
    notify(url);
  };
  img.onerror = () => {
    // Mark done anyway — the component's own onError handles the fallback display.
    loaded.add(url);
    pending.delete(url);
    notify(url);
  };
  img.src = url;
}

/** Batch-preload a list of avatar URLs (e.g. all avatars in the picker). */
export function preloadAvatars(urls: string[]): void {
  urls.forEach(preloadAvatar);
}
