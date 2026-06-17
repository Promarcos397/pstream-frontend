import { useState, useEffect } from 'react';

type Listener = (v: boolean) => void;
const _listeners = new Set<Listener>();
let _isScrolling = false;
let _timer: ReturnType<typeof setTimeout> | null = null;

const notify = (v: boolean) => {
    _isScrolling = v;
    _listeners.forEach(l => l(v));
};

if (typeof window !== 'undefined') {
    window.addEventListener('scroll', () => {
        if (!_isScrolling) notify(true);
        if (_timer) clearTimeout(_timer);
        _timer = setTimeout(() => notify(false), 60);
    }, { passive: true });
}

export const useIsScrolling = (): boolean => {
    const [isScrolling, setIsScrolling] = useState(_isScrolling);
    useEffect(() => {
        _listeners.add(setIsScrolling);
        return () => { _listeners.delete(setIsScrolling); };
    }, []);
    return isScrolling;
};
