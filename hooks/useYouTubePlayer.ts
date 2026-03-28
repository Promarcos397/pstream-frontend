import { useState, useRef, useEffect, useCallback } from 'react';

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
    const [isPlayingTrailer, setIsPlayingTrailer] = useState(false);
    const [isMuted, setIsMuted] = useState(initialMuted);
    const [trailerUrl, setTrailerUrl] = useState("");
    const playerRef = useRef<any>(null);

    useEffect(() => {
        if (playerRef.current) {
            if (isMuted) playerRef.current.mute();
            else playerRef.current.unMute();
        }
    }, [isMuted]);

    const handleMuteToggle = useCallback((e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setIsMuted(prev => !prev);
    }, []);

    return {
        isPlayingTrailer,
        setIsPlayingTrailer,
        isMuted,
        setIsMuted,
        trailerUrl,
        setTrailerUrl,
        playerRef,
        handleMuteToggle
    };
};
