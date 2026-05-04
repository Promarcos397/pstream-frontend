import { useState, useEffect, RefObject } from 'react';

interface VideoDimensions {
  width: number;
  height: number;
}

/**
 * useVideoCover
 * ─────────────
 * Calculates the precise pixel dimensions for a 16:9 video/iframe to fully
 * cover its container (object-fit:cover equivalent), using ResizeObserver.
 *
 * zoomBuffer (default 1.05) slightly overflows to push YouTube UI chrome
 * off-screen. Keep it between 1.04–1.10 for the best balance of coverage
 * vs. cropping — too high and you lose too much of the video frame.
 */
export function useVideoCover(
  containerRef: RefObject<HTMLElement | null>,
  zoomBuffer = 1.05,
): VideoDimensions {
  // Boot with a sensible viewport-based estimate so the first render
  // never shows a 0×0 gap before the ResizeObserver fires.
  const [dimensions, setDimensions] = useState<VideoDimensions>(() => {
    if (typeof window === 'undefined') return { width: 1920, height: 1080 };
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    return computeCover(vw, vh, zoomBuffer);
  });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const recalculate = () => {
      const el = containerRef.current;
      if (!el) return;
      const cw = el.clientWidth;
      const ch = el.clientHeight;
      if (cw <= 0 || ch <= 0) return;
      const next = computeCover(cw, ch, zoomBuffer);
      setDimensions(prev =>
        prev.width === next.width && prev.height === next.height ? prev : next,
      );
    };

    recalculate();

    const ro = new ResizeObserver(() => requestAnimationFrame(recalculate));
    ro.observe(el);
    return () => ro.disconnect();
  }, [containerRef, zoomBuffer]);

  return dimensions;
}

/** Core cover math — exported so callers can pre-compute without a ref */
export function computeCover(cw: number, ch: number, zoomBuffer: number): VideoDimensions {
  const RATIO = 16 / 9; // target video aspect ratio
  const containerRatio = cw / ch;

  // If container is wider than 16:9 → constrain by width, overflow height
  // If container is taller than 16:9 → constrain by height, overflow width
  const w = containerRatio >= RATIO
    ? cw * zoomBuffer
    : ch * RATIO * zoomBuffer;
  const h = containerRatio >= RATIO
    ? (cw / RATIO) * zoomBuffer
    : ch * zoomBuffer;

  // Ceil to avoid sub-pixel gaps showing through
  return { width: Math.ceil(w), height: Math.ceil(h) };
}
