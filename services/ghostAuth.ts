/**
 * PIN gate for /ghost admin panel.
 * - PIN compared via SHA-256 (not plaintext in bundle)
 * - Session-only auth (clears on tab close)
 * - 5-attempt lockout for 10 minutes
 */

const ADMIN_PIN_HASH = (import.meta.env.VITE_ADMIN_PIN_HASH || '').toLowerCase().trim();
const SESSION_KEY    = '__psg__';
const LOCK_KEY       = '__psl__';
const MAX_ATTEMPTS   = 5;
const LOCK_MS        = 10 * 60 * 1000;

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function checkPin(pin: string): Promise<boolean> {
  // Dev bypass: if no hash configured, any non-empty input passes
  if (!ADMIN_PIN_HASH) return pin.length > 0;
  const hash = await sha256Hex(pin);
  return hash === ADMIN_PIN_HASH;
}

export function isAuthenticated(): boolean {
  // In dev, skip the gate entirely — no accidental lockouts during development
  if (import.meta.env.DEV) return true;
  return sessionStorage.getItem(SESSION_KEY) === '1';
}

export function setAuthenticated() {
  sessionStorage.setItem(SESSION_KEY, '1');
}

export function getLockState(): { locked: boolean; remainingMs: number } {
  try {
    const raw = localStorage.getItem(LOCK_KEY);
    if (!raw) return { locked: false, remainingMs: 0 };
    const { until } = JSON.parse(raw);
    const remaining = until - Date.now();
    if (remaining > 0) return { locked: true, remainingMs: remaining };
    localStorage.removeItem(LOCK_KEY);
  } catch {}
  return { locked: false, remainingMs: 0 };
}

export function recordFailedAttempt(): { locked: boolean } {
  try {
    const raw = localStorage.getItem(LOCK_KEY);
    let { count = 0 } = raw ? JSON.parse(raw) : {};
    count += 1;
    if (count >= MAX_ATTEMPTS) {
      localStorage.setItem(LOCK_KEY, JSON.stringify({ count, until: Date.now() + LOCK_MS }));
      return { locked: true };
    }
    localStorage.setItem(LOCK_KEY, JSON.stringify({ count, until: 0 }));
  } catch {}
  return { locked: false };
}

export function clearAttempts() {
  localStorage.removeItem(LOCK_KEY);
}
