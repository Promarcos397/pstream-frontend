import { useState, useLayoutEffect, useEffect } from 'react';

// Module-level: evaluate ONCE before any component mounts, using matchMedia.
// This is synchronous and available immediately in browser environments.
const _getIsMobile = (breakpoint: number): boolean => {
    if (typeof window === 'undefined') return false;
    if (window.matchMedia(`(max-width: ${breakpoint - 1}px)`).matches) return true;
    const w = window.innerWidth, h = window.innerHeight;
    if (h > 0 && h < 500 && w > 0 && w <= 950) return true;
    if (breakpoint === 768) {
        const isTabletWidth = window.matchMedia('(max-width: 1023px)').matches;
        const isTouchDevice = window.matchMedia('(pointer: coarse)').matches;
        if (isTabletWidth && isTouchDevice) return true;
    }
    return false;
};

export const useIsMobile = (breakpoint: number = 768) => {
    // Initialize from module-level function — always correct on first call
    const [isMobile, setIsMobile] = useState(() => _getIsMobile(breakpoint));

    // useLayoutEffect: runs synchronously BEFORE the browser paints.
    // This guarantees that even if useState() returned a stale value,
    // it is corrected before the user ever sees a single frame of wrong layout.
    useLayoutEffect(() => {
        setIsMobile(_getIsMobile(breakpoint));
    }, [breakpoint]);

    // useEffect: keep in sync on resize / orientation change
    useEffect(() => {
        const handleResize = () => setIsMobile(_getIsMobile(breakpoint));
        window.addEventListener('resize', handleResize);
        window.addEventListener('orientationchange', handleResize);
        return () => {
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('orientationchange', handleResize);
        };
    }, [breakpoint]);

    return isMobile;
};
