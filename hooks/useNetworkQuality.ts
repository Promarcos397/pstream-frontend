import { useState, useEffect } from 'react';

type YouTubeQuality = 'hd720' | 'hd1080' | 'default';

interface NetworkQuality {
    quality: YouTubeQuality;
    isSlowNetwork: boolean;
}

/**
 * Hook to detect network quality and return appropriate YouTube quality setting.
 * Works on Electron (navigator.connection) and Capacitor Android.
 */
export const useNetworkQuality = (): NetworkQuality => {
    const [networkQuality, setNetworkQuality] = useState<NetworkQuality>({
        quality: 'hd1080',
        isSlowNetwork: false
    });

    useEffect(() => {
        const checkNetworkQuality = async () => {
            let quality: YouTubeQuality = 'hd1080';
            let isSlowNetwork = false;

            // Check for Capacitor (mobile) - uses global Capacitor.Plugins
            const capacitor = (window as any).Capacitor;
            if (capacitor?.Plugins?.Network) {
                try {
                    const status = await capacitor.Plugins.Network.getStatus();
                    if (status.connectionType === 'cellular') {
                        quality = 'hd720';
                        isSlowNetwork = true;
                    }
                } catch {
                    // Capacitor Network not available
                }
            }

            // Browser Network Information API (Chromium/Electron)
            const connection = (navigator as any).connection ||
                (navigator as any).mozConnection ||
                (navigator as any).webkitConnection;

            if (connection) {
                const effectiveType = connection.effectiveType;
                const downlink = connection.downlink; // Mbps

                if (['slow-2g', '2g', '3g'].includes(effectiveType) || downlink < 5) {
                    quality = 'hd720';
                    isSlowNetwork = true;
                }
            }

            setNetworkQuality({ quality, isSlowNetwork });
        };

        checkNetworkQuality();

        // Listen for network changes
        const connection = (navigator as any).connection;
        if (connection) {
            connection.addEventListener('change', checkNetworkQuality);
            return () => connection.removeEventListener('change', checkNetworkQuality);
        }
    }, []);

    return networkQuality;
};

/**
 * Utility function to apply YouTube quality setting to a player.
 */
export const applyYouTubeQuality = (player: any, quality: YouTubeQuality) => {
    if (player && typeof player.setPlaybackQuality === 'function') {
        try {
            player.setPlaybackQuality(quality);
        } catch {
            // Quality setting not supported or failed
        }
    }
};

export default useNetworkQuality;
