import { useState, useEffect } from 'react';
import { isAvatarLoaded, onAvatarLoaded, preloadAvatar } from '../utils/avatarCache';

/**
 * Returns true when the avatar image is ready to display without a network wait.
 *
 * Reads from the module-level cache first — images preloaded before this component
 * mounted return `true` on the very first render, so there is zero flash.
 */
export function useAvatarReady(url: string | undefined): boolean {
  const src = url ?? '';

  const [ready, setReady] = useState<boolean>(() => isAvatarLoaded(src));

  useEffect(() => {
    if (!src) {
      setReady(false);
      return;
    }
    if (isAvatarLoaded(src)) {
      setReady(true);
      return;
    }
    setReady(false);
    preloadAvatar(src);
    return onAvatarLoaded(src, () => setReady(true));
  }, [src]);

  return ready;
}
