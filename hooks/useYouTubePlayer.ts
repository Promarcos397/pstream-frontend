import { useState, useRef, useEffect, useCallback } from 'react';
import { useGlobalContext } from '../context/GlobalContext';

interface UseYouTubePlayerReturn {
    isPlayingTrailer: boolean;
    setIsPlayingTrailer: (isPlaying: boolean) => void;
    isMuted: boolean;
    setIsMuted: (isMuted: boolean) => void;
    trailerUrl: string;
    setTrailerUrl: (url: string) => void;
    playerRef: any;
    handleMuteToggle: (e?: React.MouseEvent) => void;
}

export const useYouTubePlayer = (initialMuted = false): UseYouTubePlayerReturn => {
    const { globalMute, setGlobalMute } = useGlobalContext();
    const [isPlayingTrailer, setIsPlayingTrailer] = useState(false);
    const [trailerUrl, setTrailerUrl] = useState("");
    const playerRef = useRef<any>(null);

    // Sync physical YouTube player with global mute state
    useEffect(() => {
        if (playerRef.current && typeof playerRef.current.mute === 'function') {
            try {
                if (globalMute) playerRef.current.mute();
                else playerRef.current.unMute();
            } catch (e) {
                console.warn("[useYouTubePlayer] Failed to sync mute state:", e);
            }
        }
    }, [globalMute]);

    const handleMuteToggle = useCallback((e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setGlobalMute(!globalMute);
    }, [globalMute, setGlobalMute]);

    return {
        isPlayingTrailer,
        setIsPlayingTrailer,
        isMuted: globalMute,
        setIsMuted: setGlobalMute,
        trailerUrl,
        setTrailerUrl,
        playerRef,
        handleMuteToggle
    };
};
