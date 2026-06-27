import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

const CACHE_KEY = 'pstream-hero-color';
const CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

function readCache(): string | null {
    try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (!raw) return null;
        const { rgb, ts } = JSON.parse(raw);
        if (Date.now() - ts < CACHE_TTL_MS) return rgb as string;
    } catch {}
    return null;
}

function writeCache(rgb: string) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ rgb, ts: Date.now() })); } catch {}
}

interface HeroColorContextType {
    heroColor: string | null;
    setHeroColor: (rgb: string | null) => void;
}

const HeroColorContext = createContext<HeroColorContextType | undefined>(undefined);

export const HeroColorProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [heroColor, setHeroColorState] = useState<string | null>(readCache);

    const setHeroColor = useCallback((rgb: string | null) => {
        setHeroColorState(rgb);
        if (rgb) writeCache(rgb);
    }, []);

    return (
        <HeroColorContext.Provider value={{ heroColor, setHeroColor }}>
            {children}
        </HeroColorContext.Provider>
    );
};

export function useHeroColor() {
    const ctx = useContext(HeroColorContext);
    if (!ctx) throw new Error('useHeroColor must be used inside HeroColorProvider');
    return ctx;
}
