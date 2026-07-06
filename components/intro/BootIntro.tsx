import React, { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import PstreamIntro from './PstreamIntro';
import PIdentAnimation from './PIdentAnimation';

/**
 * App-open ident gate.
 *
 * On a cold boot it covers the whole screen with the PSTREAM ident while the
 * app does its real boot work behind it — Supabase session resolution + the
 * first view's lazy chunk/data — regardless of whether the user is signed in.
 *
 * Two idents, chosen by device:
 *   - phones + tablets → the PSTREAM wordmark build (PstreamIntro).
 *   - desktop          → the "P" stroke-build + spectrum-burst (PIdentAnimation).
 *
 * Dismiss = whichever finishes last:
 *   - the ident's animation completes, AND
 *   - `bootReady` (auth session resolved) is true.
 * If loading outlasts the animation, the ident holds on its final frame until
 * boot work is done, then fades — so it never reveals a half-loaded app. A hard
 * safety cap guarantees it can never trap the user if the network hangs.
 */

const FADE_MS = 500;
const MIN_HOLD_AFTER_BUILT_MS = 400; // brief settle before the fade
const SAFETY_CAP_MS = 9000;          // never trap the user behind the ident
const HANDHELD_MAX_WIDTH = 1024;     // width fallback for phones + tablets

// Evaluated once at module load — this is a genuine cold document boot. A
// coarse (touch) primary pointer catches iPads in any orientation — even
// landscape widths past the fallback — while a mouse-driven desktop does not.
const IS_HANDHELD_BOOT =
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(pointer: coarse)').matches || window.innerWidth < HANDHELD_MAX_WIDTH);
const PREFERS_REDUCED_MOTION =
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const BootIntro: React.FC = () => <BootIntroInner />;

const BootIntroInner: React.FC = () => {
  const isInitialized = useAuthStore((s) => s.isInitialized);
  const [phase, setPhase] = useState<'playing' | 'fading' | 'done'>('playing');
  const [built, setBuilt] = useState(false);
  const builtAtRef = useRef<number | null>(null);

  // bootReady: the session has resolved (fires signed-in or not).
  const bootReady = isInitialized;

  // Lock body scroll while the ident is up.
  useEffect(() => {
    if (phase === 'done') return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [phase]);

  // Hard safety cap — force the fade even if bootReady never arrives.
  useEffect(() => {
    const id = setTimeout(() => {
      setPhase((p) => (p === 'playing' ? 'fading' : p));
    }, SAFETY_CAP_MS);
    return () => clearTimeout(id);
  }, []);

  // Decide when to begin fading: built + a brief settle + bootReady.
  useEffect(() => {
    if (phase !== 'playing' || !built || !bootReady) return;
    const elapsed = builtAtRef.current ? Date.now() - builtAtRef.current : 0;
    const wait = Math.max(0, MIN_HOLD_AFTER_BUILT_MS - elapsed);
    const id = setTimeout(() => setPhase('fading'), wait);
    return () => clearTimeout(id);
  }, [phase, built, bootReady]);

  // After the fade transition completes, unmount.
  useEffect(() => {
    if (phase !== 'fading') return;
    const id = setTimeout(() => setPhase('done'), FADE_MS);
    return () => clearTimeout(id);
  }, [phase]);

  if (phase === 'done') return null;

  const markBuilt = () => {
    builtAtRef.current = builtAtRef.current ?? Date.now();
    setBuilt(true);
  };

  // Reduced motion: a static settled wordmark on any device (no build, no
  // burst) — still a full-screen cover, just calm. Otherwise phones/tablets
  // get the wordmark build and desktop gets the "P" spectrum-burst.
  let ident: React.ReactNode;
  if (PREFERS_REDUCED_MOTION) {
    ident = <PstreamIntro reducedMotion onBuilt={markBuilt} />;
  } else if (IS_HANDHELD_BOOT) {
    ident = <PstreamIntro onBuilt={markBuilt} />;
  } else {
    ident = (
      <PIdentAnimation
        loop={false}
        onComplete={markBuilt}
        style={{ position: 'absolute', inset: 0 }}
      />
    );
  }

  return (
    <div
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2147483000,
        background: '#000',
        opacity: phase === 'fading' ? 0 : 1,
        transition: `opacity ${FADE_MS}ms ease`,
        pointerEvents: phase === 'fading' ? 'none' : 'auto',
      }}
    >
      {ident}
    </div>
  );
};

export default BootIntro;
