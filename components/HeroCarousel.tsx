import React, { useState, useEffect, useRef } from 'react';
import { SpeakerSlashIcon, SpeakerHighIcon, ArrowCounterClockwise } from '@phosphor-icons/react';
import { useVideoPlayer } from '../hooks/useVideoPlayer';
import { useGlobalContext } from '../context/GlobalContext';
import { useNetworkQuality } from '../hooks/useNetworkQuality';
import axios from 'axios';
import HeroCarouselBackground from './HeroCarouselBackground';
import HeroCarouselContent from './HeroCarouselContent';
import { Movie, TMDBResponse } from '../types';
import { REQUESTS, LOGO_SIZE } from '../constants';
import { getMovieImages, prefetchStream, getExternalIds } from '../services/api';
import { searchTrailersWithFallback } from '../services/YouTubeService';
import { HeroEngine, HeroPackage } from '../services/HeroEngine';
import { NetworkPriority } from '../services/NetworkPriority';
import { MaturityBadge } from './MovieCardBadges';

interface HeroCarouselProps {
  onSelect: (movie: Movie, time?: number, videoId?: string) => void;
  onPlay: (movie: Movie) => void;
  fetchUrl?: string;
  seekTime?: number; // Command to seek
  heroMovie?: Movie; // Optional: Override with explicit movie (e.g. Cloud Series)
  genreId?: number; // Optional: Genre filter
  pageType?: 'home' | 'movie' | 'tv' | 'new_popular';
}

const HeroCarousel: React.FC<HeroCarouselProps> = ({ onSelect, onPlay, fetchUrl, seekTime, heroMovie, genreId, pageType: explicitPageType }) => {
  const { getVideoState, updateVideoState, setHeroVideoState, heroVideoState, activeVideoId, setActiveVideoId } = useGlobalContext();
  const networkQuality = useNetworkQuality();
  const [movie, setMovie] = useState<Movie | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isHovered, setIsHovered] = useState(false);

  // Smart Video State
  const [trailerQueue, setTrailerQueue] = useState<string[]>([]);
  const [showVideo, setShowVideo] = useState(false);

  const player = useVideoPlayer({
    movieId: movie?.id || 0,
    videoId: trailerQueue[0] || null,
    autoSync: true,
    earlyStop: 3,
    startMuted: true,
    onEnded: () => {
      setHasVideoEnded(true);
      setShowVideo(false);
    },
    onErrored: () => {
      setTrailerQueue(prev => {
        const next = prev.slice(1);
        if (next.length === 0) setShowVideo(false);
        return next;
      });
    },
  });

  const isVideoReady = player.isReady;
  const setIsVideoReady = player.setIsReady;
  const hasVideoEnded = player.hasEnded;
  const setHasVideoEnded = player.setHasEnded;
  const [replayCount, setReplayCount] = useState(0); 

  const isMuted = player.isMuted;
  const setIsMuted = player.setIsMuted;
  const playerRef = player.playerRef;
  const [showBackdropOverlay, setShowBackdropOverlay] = useState(false);
  const visibilityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backdropForcedRef = useRef(false);

  // Refs
  const videoTimerRef = useRef<any>(null);
  const fadeIntervalRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null); // Shared ref for resize and intersection observer

  // 1. Tab Visibility Tracking
  const [isTabVisible, setIsTabVisible] = useState(true);
  useEffect(() => {
    const handleVisibilityChange = () => {
      const visible = document.visibilityState === 'visible';
      setIsTabVisible(visible);
      if (!visible) {
        try { playerRef.current?.pauseVideo?.(); } catch (_) {}
        if (visibilityTimerRef.current) clearTimeout(visibilityTimerRef.current);
        visibilityTimerRef.current = setTimeout(() => {
          backdropForcedRef.current = true;
          setShowBackdropOverlay(true);
        }, 30_000);
      } else {
        if (visibilityTimerRef.current) clearTimeout(visibilityTimerRef.current);
        backdropForcedRef.current = false;
        setShowBackdropOverlay(false);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (visibilityTimerRef.current) clearTimeout(visibilityTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (showVideo && isVideoReady && backdropForcedRef.current && isTabVisible) {
      backdropForcedRef.current = false;
      setShowBackdropOverlay(false);
    }
  }, [showVideo, isVideoReady, isTabVisible]);

  // 2. Viewport Tracking — scroll-based with rAF for buttery smooth response
  const [isOutOfView, setIsOutOfView] = useState(false);
  useEffect(() => {
    let rafId: number;
    let lastState = false;

    const check = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const heroHeight = rect.height;
      // Pause once more than 30% of the hero has scrolled above the viewport top
      const visiblePx = Math.min(rect.bottom, heroHeight) - Math.max(rect.top, 0);
      const visibleFraction = Math.max(0, visiblePx / heroHeight);
      const outOfView = visibleFraction < 0.55; // pause when less than 55% visible
      if (outOfView !== lastState) {
        lastState = outOfView;
        setIsOutOfView(outOfView);
      }
    };

    const onScroll = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(check);
    };

    // Also use an IntersectionObserver as a fallback safety net
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.intersectionRatio < 0.4) setIsOutOfView(true); },
      { threshold: [0.4] }
    );
    if (containerRef.current) observer.observe(containerRef.current);

    window.addEventListener('scroll', onScroll, { passive: true });
    check(); // run once on mount
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(rafId);
      observer.disconnect();
    };
  }, []);

  // --- Magic System: Hero Selection is now handled by HeroEngine service ---

  // Fetch One Movie (Daily Consistent) OR Use Provided Hero Movie
  useEffect(() => {
    const applyHeroPackage = (pkg: HeroPackage) => {
      setMovie(pkg.movie);
      if (pkg.logoUrl) setLogoUrl(pkg.logoUrl);
      if (pkg.videoId) {
        setTrailerQueue([pkg.videoId]);
        setHeroVideoState({ movie: pkg.movie, videoId: pkg.videoId, movieId: pkg.movie.id });
      }
      setLoading(false);
    };

    const getHeroPageType = (url: string): string => {
      if (explicitPageType) return explicitPageType;
      if (url.includes('tv')) return 'tv';
      if (url.includes('movie')) return 'movie';
      return 'home';
    };

    const getCacheKey = (url: string, gid?: number): string => {
      const type = getHeroPageType(url);
      return gid ? `${type}_${gid}` : type;
    };

    const loadHero = async () => {
      const pageType = getHeroPageType(fetchUrl || '');
      const cacheKey = getCacheKey(fetchUrl || '', genreId);
      const cached = HeroEngine.getCachedHero(cacheKey);
      
      if (cached) {
        applyHeroPackage(cached);
      } else {
        const pkg = await HeroEngine.getHero(pageType, fetchUrl, genreId);
        if (pkg) applyHeroPackage(pkg);
        else setLoading(false);
      }
    };

    loadHero();
    const unsubscribe = HeroEngine.subscribe((type, pkg) => {
      const currentPageType = getHeroPageType(fetchUrl || '');
      if (type === currentPageType) {
        // If it's a genre-specific wait, check if the pkg matches the genreId
        applyHeroPackage(pkg);
      }
    });

    return () => {
        unsubscribe();
    };
  }, [fetchUrl, heroMovie, genreId]);

  // Handle trailer playback timer
  useEffect(() => {
    if (trailerQueue.length > 0) {
      if (videoTimerRef.current) clearTimeout(videoTimerRef.current);
      setShowVideo(false);
      setIsVideoReady(false);
      setHasVideoEnded(false);
      
      const delay = networkQuality.isSlowNetwork ? 2000 : 1000;
      videoTimerRef.current = setTimeout(() => {
        setShowVideo(true);
      }, delay);
    }
    return () => { if (videoTimerRef.current) clearTimeout(videoTimerRef.current); };
  }, [trailerQueue, networkQuality]);

  // Audio Fading Logic
  const fadeAudioIn = () => {
    try {
      const player = playerRef.current;
      if (!player || isMuted) return;

      if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);

      let vol = player.volume !== undefined ? player.volume : (player.getVolume?.() / 100 || 0);
      if (vol > 1) vol = 1;

      fadeIntervalRef.current = setInterval(() => {
        try {
          if (vol < 1) {
            vol += 0.05;
            if (vol > 1) vol = 1;
            if (player.setVolume) player.setVolume(vol * 100);
            else player.volume = vol;
          } else {
            clearInterval(fadeIntervalRef.current);
          }
        } catch (e) { clearInterval(fadeIntervalRef.current); }
      }, 50);
    } catch (e) { }
  };

  const fadeAudioOut = (callback?: () => void) => {
    try {
      const player = playerRef.current;
      if (!player) {
        if (callback) callback();
        return;
      }

      if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);

      let vol = player.volume !== undefined ? player.volume : (player.getVolume?.() / 100 || 1);

      fadeIntervalRef.current = setInterval(() => {
        try {
          if (vol > 0) {
            vol -= 0.05;
            if (vol < 0) vol = 0;
            if (player.setVolume) player.setVolume(vol * 100);
            else player.volume = vol;
          } else {
            clearInterval(fadeIntervalRef.current);
            if (callback) callback();
          }
        } catch (e) { clearInterval(fadeIntervalRef.current); if (callback) callback(); }
      }, 35);
    } catch (e) { if (callback) callback(); }
  };

  
  // Universal Sync: Listen to global player activity, scrolling, and tabs
  const currentHeroVideoId = movie ? String(movie.id) : null;
useEffect(() => {
    const isSharedConflict = activeVideoId && activeVideoId !== currentHeroVideoId;
    
    if (playerRef.current && isVideoReady && showVideo) {
      const shouldPlay = !isOutOfView && !isSharedConflict && isTabVisible;
      
      if (shouldPlay) {
        // Clear any stale backdrop the visibility timer may have set while modal was open
        if (backdropForcedRef.current) {
          backdropForcedRef.current = false;
          setShowBackdropOverlay(false);
        }
        try {
          if (typeof playerRef.current?.playVideo === 'function') {
            const latestState = movie ? getVideoState(movie.id) : null;
            if (latestState && latestState.time > 0 && typeof playerRef.current?.getCurrentTime === 'function') {
              const diff = Math.abs(playerRef.current.getCurrentTime() - latestState.time);
              if (diff > 5) {
                playerRef.current.seekTo(latestState.time, true);
              }
            }
            playerRef.current.playVideo();
          }
          if (!isMuted) fadeAudioIn();
          NetworkPriority.setVideoActive(true);
        } catch (e) { }
      } else {
        // FULL PAUSE - Save current time before stopping so Cards/Modal can grab it
        try {
          if (movie && typeof playerRef.current?.getCurrentTime === 'function') {
             const currentTime = playerRef.current.getCurrentTime();
             const videoId = trailerQueue[0];
             if (currentTime > 0 && videoId) {
               updateVideoState(movie.id, currentTime, videoId);
             }
          }

          NetworkPriority.setVideoActive(false);
          if (!isMuted) {
            // If sound is on, smooth fade out before hitting pause
            fadeAudioOut(() => {
              if (typeof playerRef.current?.pauseVideo === 'function') playerRef.current.pauseVideo();
            });
          } else {
            // If already muted, just pause instantly
            if (typeof playerRef.current?.pauseVideo === 'function') playerRef.current.pauseVideo();
          }
        } catch (e) { }
      }
    }
  }, [isOutOfView, isVideoReady, showVideo, isMuted, activeVideoId, currentHeroVideoId, isTabVisible]);

  // Handle Seek
  useEffect(() => {
    if (seekTime && seekTime > 0 && playerRef.current) {
      try {
        if (typeof playerRef.current?.seekTo === 'function') playerRef.current.seekTo(seekTime, true);
        else playerRef.current.currentTime = seekTime;
        
        if (typeof playerRef.current?.playVideo === 'function') playerRef.current.playVideo();
        else playerRef.current.play?.();
      } catch (e) { }
    }
  }, [seekTime]);

  if (loading) return (
    <div className="relative h-[50vh] sm:h-[60vh] md:h-[80vh] w-full bg-[#141414] overflow-hidden">
      <div className="absolute inset-0 bg-[#1f1f1f] animate-pulse" />
    </div>
  );

  if (!movie) return null;

  return (
    <div 
      id="hero-container" 
      ref={containerRef} 
      className="relative h-[50vh] sm:h-[60vh] md:h-[80vh] w-full overflow-hidden group bg-black"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={(e) => {
        if (e.clientY < 60 || e.clientX > window.innerWidth - 20) return;
        setIsHovered(false);
      }}
    >
      <HeroCarouselBackground
        movie={movie} 
        showVideo={showVideo} 
        trailerQueue={trailerQueue} 
        setTrailerQueue={setTrailerQueue} 
        setShowVideo={setShowVideo} 
        playerRef={playerRef} 
        isHovered={isHovered} 
        replayCount={replayCount}
        showBackdropOverlay={showBackdropOverlay}
        player={player}
        onSyncCheck={(videoId) => {
          const state = getVideoState(movie.id);
          return state?.videoId === videoId ? state.time : undefined;
        }}
        onVideoEnd={() => { setHasVideoEnded(true); setShowVideo(false); setIsVideoReady(false); }}
        youtubeQuality={networkQuality.quality}
        onUpdateState={updateVideoState}
      />
      <HeroCarouselContent
        movie={movie} logoUrl={logoUrl} isVideoReady={isVideoReady} onPlay={onPlay}
        onSelect={(m, _, videoId) => {
          const actualTime = typeof playerRef.current?.getCurrentTime === 'function' ? playerRef.current.getCurrentTime() : 0;
          if (videoId) updateVideoState(m.id, actualTime, videoId);
          onSelect(m, actualTime, videoId);
        }}
        trailerVideoId={trailerQueue[0]} hasVideoEnded={hasVideoEnded}
      />
        {/* Mute + Age Rating — standardized MaturityBadge */}
        <div className="absolute right-0 flex items-center gap-3 z-30 pointer-events-auto 
          bottom-[25%] sm:bottom-[21%] md:bottom-[17%]"
        >
          {showVideo && isVideoReady && (
            <button 
              onClick={() => {
                if (hasVideoEnded) {
                  setHasVideoEnded(false);
                  setReplayCount(prev => prev + 1);
                  setShowVideo(true);
                } else {
                  setIsMuted(!isMuted);
                }
              }} 
              className="w-9 h-9 md:w-10 md:h-10 border-[1.5px] border-white/40 rounded-full flex items-center justify-center bg-zinc-900/40 backdrop-blur-md transition-all duration-300 hover:bg-white/10 hover:scale-110 hover:border-white shadow-lg group mr-4 active:scale-90"
              aria-label={isMuted ? 'Unmute' : 'Mute'}
            >
              {hasVideoEnded ? (
                <ArrowCounterClockwise size={20} className="text-white" />
              ) : (
                isMuted ? <SpeakerSlashIcon size={20} className="text-white" /> : <SpeakerHighIcon size={20} className="text-white" />
              )}
            </button>
          )}
          {/* Use standardized MaturityBadge — md size for hero prominence */}
          <div className="mr-4">
            <MaturityBadge adult={movie.adult} voteAverage={movie.vote_average} size="md" />
          </div>
        </div>
    </div>
  );
};

export default HeroCarousel;