import React, { useEffect, useState } from 'react';
import { XIcon, ArrowSquareDownIcon } from '@phosphor-icons/react';

const DISMISSED_KEY = 'pstream-pwa-prompt-dismissed';
const DISMISSED_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function isStandalone() {
    return (
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true
    );
}

function isIOS() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as any).MSStream;
}

function isAndroidChrome() {
    return /android/i.test(navigator.userAgent) && /chrome/i.test(navigator.userAgent);
}

function wasDismissedRecently(): boolean {
    try {
        const ts = parseInt(localStorage.getItem(DISMISSED_KEY) || '0', 10);
        return Date.now() - ts < DISMISSED_TTL_MS;
    } catch {
        return false;
    }
}

function markDismissed() {
    try { localStorage.setItem(DISMISSED_KEY, String(Date.now())); } catch {}
}

export default function PWAInstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [visible, setVisible] = useState(false);
    const [isIOSDevice] = useState(isIOS);

    useEffect(() => {
        if (isStandalone() || wasDismissedRecently()) return;

        if (isIOS()) {
            // iOS has no beforeinstallprompt — show manual tip after delay
            const t = setTimeout(() => setVisible(true), 4000);
            return () => clearTimeout(t);
        }

        const handler = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e);
            setTimeout(() => setVisible(true), 4000);
        };
        window.addEventListener('beforeinstallprompt', handler);
        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const dismiss = () => {
        markDismissed();
        setVisible(false);
    };

    const install = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') markDismissed();
        setVisible(false);
        setDeferredPrompt(null);
    };

    if (!visible) return null;

    return (
        <div className="fixed bottom-28 left-0 right-0 z-[200] flex justify-center px-4 pointer-events-none">
            <div className="pointer-events-auto w-full max-w-sm bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl px-4 py-3 flex items-center gap-3 mb-[env(safe-area-inset-bottom)]">
                <div className="w-10 h-10 rounded-xl bg-red-600 flex items-center justify-center shrink-0">
                    <img src="/icons/icon-192.png" alt="Pstream" className="w-8 h-8 rounded-lg" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-semibold leading-tight">Install Pstream</p>
                    {isIOSDevice ? (
                        <p className="text-white/60 text-xs mt-0.5">
                            Tap <strong>Share</strong> then <strong>Add to Home Screen</strong>
                        </p>
                    ) : (
                        <p className="text-white/60 text-xs mt-0.5">
                            Get the full-screen experience
                        </p>
                    )}
                </div>
                {!isIOSDevice && (
                    <button
                        onClick={install}
                        className="shrink-0 bg-white text-black text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5"
                    >
                        <ArrowSquareDownIcon size={14} weight="bold" />
                        Install
                    </button>
                )}
                <button
                    onClick={dismiss}
                    className="shrink-0 text-white/40 hover:text-white/70 transition-colors"
                    aria-label="Dismiss"
                >
                    <XIcon size={18} weight="bold" />
                </button>
            </div>
        </div>
    );
}
