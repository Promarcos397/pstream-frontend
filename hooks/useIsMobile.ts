import { useState, useEffect } from 'react';

export const useIsMobile = (breakpoint: number = 768) => {
    const getIsMobile = () => {
        if (typeof window === 'undefined') return false;
        
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        // 1. Strict Width Check (standard portrait phone)
        if (width < breakpoint) return true;
        
        // 2. Landscape Phone Check
        // Large phones in landscape (like iPhone Pro Max) exceed 768px width,
        // but have very short heights (< 500px).
        if (height < 500 && width <= 950) return true;
        
        // 3. True Touch Device Check
        // For standard UI responsive toggles (768px), we want iPads and tablets 
        // to also use the mobile touch-friendly UI.
        if (breakpoint === 768 && window.matchMedia('(pointer: coarse)').matches) {
            return true;
        }

        return false;
    };

    const [isMobile, setIsMobile] = useState(getIsMobile());

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(getIsMobile());
        };

        window.addEventListener('resize', handleResize);
        window.addEventListener('orientationchange', handleResize);
        return () => {
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('orientationchange', handleResize);
        };
    }, [breakpoint]);

    return isMobile;
};
