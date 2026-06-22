let _isScrolling = false;
let _timer: ReturnType<typeof setTimeout> | null = null;
const _startCallbacks = new Set<() => void>();
const _endCallbacks = new Set<() => void>();

// Last known pointer position in screen coords (updated on every pointermove)
let _lastPointerX = 0;
let _lastPointerY = 0;

// Pointer velocity tracking
let _lastPointerTime = 0;
let _pointerVx = 0;
let _pointerVy = 0;
const VELOCITY_DECAY = 0.85;
let _velRaf: number | null = null;

function _decayVelocity() {
  _pointerVx *= VELOCITY_DECAY;
  _pointerVy *= VELOCITY_DECAY;
  const speed = Math.sqrt(_pointerVx ** 2 + _pointerVy ** 2);
  if (speed > 0.5) {
    _velRaf = requestAnimationFrame(_decayVelocity);
  } else {
    _pointerVx = 0;
    _pointerVy = 0;
    _velRaf = null;
  }
}

function _onScrollEnd() {
  _isScrolling = false;
  _endCallbacks.forEach(cb => cb());

  // Find whatever card is now under the stationary pointer after the scroll settled.
  // This handles the case where scrolling moved a different card under the cursor.
  const el = document.elementFromPoint(_lastPointerX, _lastPointerY);
  const card = el?.closest?.('[data-card="true"]');
  if (card) {
    window.dispatchEvent(new CustomEvent('pstream:scroll-settled', {
      detail: { element: card, x: _lastPointerX, y: _lastPointerY },
    }));
  }
}

if (typeof window !== 'undefined') {
  const markScrolling = () => {
    if (!_isScrolling) {
      _isScrolling = true;
      _startCallbacks.forEach(cb => cb());
    }
    if (_timer) clearTimeout(_timer);
    _timer = setTimeout(_onScrollEnd, 40);
  };

  // capture:true catches scroll from ANY container (rows, overflow-x panels, etc.)
  window.addEventListener('scroll', markScrolling, { passive: true, capture: true });
  // wheel fires before scroll — gives earlier warning
  window.addEventListener('wheel', markScrolling, { passive: true });

  window.addEventListener('pointermove', (e: PointerEvent) => {
    const now = performance.now();
    const dt = now - _lastPointerTime;
    if (dt > 0 && dt < 100) {
      const dx = e.clientX - _lastPointerX;
      const dy = e.clientY - _lastPointerY;
      _pointerVx = dx / dt;
      _pointerVy = dy / dt;
      if (_velRaf === null) _velRaf = requestAnimationFrame(_decayVelocity);
    }
    _lastPointerX = e.clientX;
    _lastPointerY = e.clientY;
    _lastPointerTime = now;
  }, { passive: true });
}

/** Read scroll state synchronously — zero re-renders, safe inside event handlers. */
export const getIsScrolling = (): boolean => _isScrolling;

/**
 * Returns true if the pointer has been moving fast recently.
 * Use to suppress hover popups when user is sweeping the cursor quickly.
 */
export const getIsPointerFast = (threshold = 0.8): boolean =>
  Math.sqrt(_pointerVx ** 2 + _pointerVy ** 2) > threshold;

/** Fires once when scrolling begins. Returns unsubscribe fn. */
export const onScrollStart = (cb: () => void): (() => void) => {
  _startCallbacks.add(cb);
  return () => _startCallbacks.delete(cb);
};

/** Fires once when scrolling stops. Returns unsubscribe fn. */
export const onScrollEnd = (cb: () => void): (() => void) => {
  _endCallbacks.add(cb);
  return () => _endCallbacks.delete(cb);
};

/** @deprecated Use getIsScrolling() in handlers, onScrollStart/onScrollEnd() for effects. */
export const useIsScrolling = getIsScrolling;
