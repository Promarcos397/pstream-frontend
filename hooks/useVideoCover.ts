import { useState, useEffect, RefObject } from 'react';

interface VideoDimensions {
  width: number;
  height: number;
}

/**
 * Calculates the perfect dimensions for a 16:9 video to act like `object-fit: cover`
 * inside a container of any aspect ratio.
 * 
 * @param containerRef Reference to the parent container element
 * @param zoomBuffer A multiplier to slightly push YouTube UI off-screen (e.g., 1.1 = 10% zoom)
 */
export function useVideoCover(containerRef: RefObject<HTMLElement>, zoomBuffer = 1.05): VideoDimensions {
  const [dimensions, setDimensions] = useState<VideoDimensions>({ width: 0, height: 0 });

  useEffect(() => {
    if (!containerRef.current) return;

    const calculate = () => {
      if (!containerRef.current) return;
      
      const cw = containerRef.current.clientWidth;
      const ch = containerRef.current.clientHeight;
      if (cw === 0 || ch === 0) return;
      
      const targetRatio = 16 / 9;
      const containerRatio = cw / ch;

      let videoWidth, videoHeight;

      if (containerRatio > targetRatio) {
        // Container is wider than 16:9
        videoWidth = cw * zoomBuffer;
        videoHeight = (cw / targetRatio) * zoomBuffer;
      } else {
        // Container is taller than 16:9
        videoHeight = ch * zoomBuffer;
        videoWidth = (ch * targetRatio) * zoomBuffer;
      }

      setDimensions({ width: videoWidth, height: videoHeight });
    };

    calculate();

    const observer = new ResizeObserver(() => {
      window.requestAnimationFrame(calculate);
    });
    
    observer.observe(containerRef.current);

    return () => observer.disconnect();
  }, [zoomBuffer, containerRef]);

  return dimensions;
}
