import { useRef, useCallback, useEffect } from 'react';

interface TouchGestureOptions {
    onSwipeLeft?: (distance: number) => void;
    onSwipeRight?: (distance: number) => void;
    onSwipeUp?: () => void;
    onSwipeDown?: () => void;
    onSingleTap?: () => void;
}

interface TouchState {
    startX: number;
    startY: number;
    startTime: number;
}

export function useTouchGestures(
    ref: React.RefObject<HTMLElement>,
    options: TouchGestureOptions
) {
    const touchState = useRef<TouchState>({ startX: 0, startY: 0, startTime: 0 });

    const SWIPE_THRESHOLD = 50;
    const TAP_THRESHOLD = 15;

    const shouldIgnoreEvent = (e: TouchEvent) => {
        const target = e.target as HTMLElement;
        return (
            target.closest('#video-controls-container') ||
            target.closest('#video-panel-shell') ||
            target.closest('#video-panel-shell-touch') ||
            target.closest('.no-gesture') ||
            target.closest('button') ||
            target.closest('.subtitle-overlay')
        );
    };

    const handleTouchStart = useCallback((e: TouchEvent) => {
        if (shouldIgnoreEvent(e)) return;
        const touch = e.touches[0];
        touchState.current = {
            startX: touch.clientX,
            startY: touch.clientY,
            startTime: Date.now(),
        };
    }, []);

    const handleTouchEnd = useCallback((e: TouchEvent) => {
        if (shouldIgnoreEvent(e)) return;
        const touch = e.changedTouches[0];

        const deltaX = touch.clientX - touchState.current.startX;
        const deltaY = touch.clientY - touchState.current.startY;
        const deltaTime = Date.now() - touchState.current.startTime;

        const isSwipe = Math.abs(deltaX) > SWIPE_THRESHOLD || Math.abs(deltaY) > SWIPE_THRESHOLD;
        const isTap = Math.abs(deltaX) < TAP_THRESHOLD && Math.abs(deltaY) < TAP_THRESHOLD && deltaTime < 300;

        if (isSwipe) {
            if (Math.abs(deltaX) > Math.abs(deltaY)) {
                if (deltaX > 0) options.onSwipeRight?.(Math.abs(deltaX));
                else options.onSwipeLeft?.(Math.abs(deltaX));
            } else {
                if (deltaY > 0) options.onSwipeDown?.();
                else options.onSwipeUp?.();
            }
        } else if (isTap) {
            options.onSingleTap?.();
        }
    }, [options]);

    useEffect(() => {
        const element = ref.current;
        if (!element) return;
        element.addEventListener('touchstart', handleTouchStart, { passive: true });
        element.addEventListener('touchend', handleTouchEnd, { passive: true });
        return () => {
            element.removeEventListener('touchstart', handleTouchStart);
            element.removeEventListener('touchend', handleTouchEnd);
        };
    }, [ref, handleTouchStart, handleTouchEnd]);
}

export default useTouchGestures;
