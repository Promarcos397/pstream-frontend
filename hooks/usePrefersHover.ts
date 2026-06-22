import { useState, useEffect } from 'react';

type Listener = (v: boolean) => void;
const _subs = new Set<Listener>();
let _prefersHover = typeof window !== 'undefined' ? window.matchMedia('(hover: hover)').matches : true;

if (typeof window !== 'undefined') {
  window.addEventListener('pointermove', (e: PointerEvent) => {
    const next = !((e.pointerType === 'touch' || e.pointerType === 'pen') && window.innerWidth < 768);
    if (next !== _prefersHover) { _prefersHover = next; _subs.forEach(f => f(next)); }
  }, { passive: true });
  window.addEventListener('mousedown', () => {
    if (!_prefersHover) { _prefersHover = true; _subs.forEach(f => f(true)); }
  }, { passive: true });
  window.addEventListener('resize', () => {
    const next = window.innerWidth >= 768 ? true : window.matchMedia('(hover: hover)').matches;
    if (next !== _prefersHover) { _prefersHover = next; _subs.forEach(f => f(next)); }
  }, { passive: true });
}

export function usePrefersHover(): boolean {
  const [val, setVal] = useState(_prefersHover);
  useEffect(() => {
    setVal(_prefersHover);
    _subs.add(setVal);
    return () => { _subs.delete(setVal); };
  }, []);
  return val;
}
