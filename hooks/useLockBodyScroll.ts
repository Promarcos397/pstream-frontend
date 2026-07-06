import { useEffect } from 'react';

/** Locks background scroll while a full-screen sheet/modal is open, so a
 * swipe gesture on the sheet's backdrop can't scroll the page underneath it. */
export function useLockBodyScroll(locked: boolean) {
  useEffect(() => {
    if (!locked) return;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = overflow; };
  }, [locked]);
}
