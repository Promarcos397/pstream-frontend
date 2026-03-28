import { useRef, useCallback, useEffect } from 'react';

interface TouchGestureOptions {
    onDoubleTapLeft?: () => void;
    onDoubleTapRight?: () => void;
    onDoubleTapCenter?: () => void;
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
    lastTapTime: number;
    lastTapX: number;
}

/**
 * Custom hook for touch gestures in video player
 * 
 * Features:
 * - Double-tap left/right sides to skip ±10 seconds
 * - Double-tap center to play/pause
 * - Swipe left/right to seek
 * - Single tap to toggle UI
 */
export function useTouchGestures(
    ref: React.RefObject<HTMLElement>,
    options: TouchGestureOptions
) {
    const touchState = useRef<TouchState>({
        startX: 0,
        startY: 0,
        startTime: 0,
        lastTapTime: 0,
        lastTapX: 0,
    });

    const DOUBLE_TAP_DELAY = 300; // ms
    const SWIPE_THRESHOLD = 50; // px
    const TAP_THRESHOLD = 10; // max movement for tap

    const handleTouchStart = useCallback((e: TouchEvent) => {
        const touch = e.touches[0];
        touchState.current.startX = touch.clientX;
        touchState.current.startY = touch.clientY;
        touchState.current.startTime = Date.now();
    }, []);

    const handleTouchEnd = useCallback((e: TouchEvent) => {
        const touch = e.changedTouches[0];
        const element = ref.current;
        if (!element) return;

        const deltaX = touch.clientX - touchState.current.startX;
        const deltaY = touch.clientY - touchState.current.startY;
        const deltaTime = Date.now() - touchState.current.startTime;
        const timeSinceLastTap = Date.now() - touchState.current.lastTapTime;

        const isSwipe = Math.abs(deltaX) > SWIPE_THRESHOLD || Math.abs(deltaY) > SWIPE_THRESHOLD;
        const isTap = Math.abs(deltaX) < TAP_THRESHOLD && Math.abs(deltaY) < TAP_THRESHOLD && deltaTime < 300;

        if (isSwipe) {
            // Handle swipe
            if (Math.abs(deltaX) > Math.abs(deltaY)) {
                // Horizontal swipe
                if (deltaX > 0) {
                    options.onSwipeRight?.(Math.abs(deltaX));
                } else {
                    options.onSwipeLeft?.(Math.abs(deltaX));
                }
            } else {
                // Vertical swipe
                if (deltaY > 0) {
                    options.onSwipeDown?.();
                } else {
                    options.onSwipeUp?.();
                }
            }
        } else if (isTap) {
            const rect = element.getBoundingClientRect();
            const tapX = touch.clientX - rect.left;
            const width = rect.width;

            // Check for double tap
            const isSameZone = Math.abs(tapX - touchState.current.lastTapX) < width * 0.2;
            if (timeSinceLastTap < DOUBLE_TAP_DELAY && isSameZone) {
                // Double tap detected
                if (tapX < width * 0.3) {
                    options.onDoubleTapLeft?.();
                } else if (tapX > width * 0.7) {
                    options.onDoubleTapRight?.();
                } else {
                    options.onDoubleTapCenter?.();
                }
                touchState.current.lastTapTime = 0; // Reset to prevent triple tap
            } else {
                // Single tap - wait to see if it becomes double tap
                touchState.current.lastTapTime = Date.now();
                touchState.current.lastTapX = tapX;

                // Delayed single tap callback
                setTimeout(() => {
                    if (Date.now() - touchState.current.lastTapTime >= DOUBLE_TAP_DELAY) {
                        options.onSingleTap?.();
                    }
                }, DOUBLE_TAP_DELAY + 50);
            }
        }
    }, [ref, options]);

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
