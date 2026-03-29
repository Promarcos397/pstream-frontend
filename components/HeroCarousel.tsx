import React, { useState, useEffect, useRef } from 'react';
import { SpeakerSlashIcon, SpeakerHighIcon, ArrowCounterClockwise } from '@phosphor-icons/react';
import { useYouTubePlayer } from '../hooks/useYouTubePlayer';
import { useGlobalContext } from '../context/GlobalContext';
import { useNetworkQuality } from '../hooks/useNetworkQuality';
import axios from 'axios';
import HeroCarouselBackground from './HeroCarouselBackground';
import HeroCarouselContent from './HeroCarouselContent';
import { Movie, TMDBResponse } from '../types';
import { REQUESTS, LOGO_SIZE } from '../constants';
import { getMovieImages, prefetchStream, getExternalIds, getMovieVideos } from '../services/api';
import { searchTrailersWithFallback } from '../services/YouTubeService';
import { HeroEngine, HeroPackage } from '../services/HeroEngine';

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
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [hasVideoEnded, setHasVideoEnded] = useState(false);
  const [replayCount, setReplayCount] = useState(0); // Forces fresh YouTube mount on replay
  const { isMuted, setIsMuted, playerRef } = useYouTubePlayer(true); // Must start muted to bypass browser autoplay blocks.
  const [videoDimensions, setVideoDimensions] = useState<{ width: string | number, height: string | number }>({ width: '140%', height: '140%' });

  // Refs
  const videoTimerRef = useRef<any>(null);
  const fadeIntervalRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null); // Shared ref for resize and intersection observer

  // 1. Tab Visibility Tracking
  const [isTabVisible, setIsTabVisible] = useState(true);
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsTabVisible(document.visibilityState === 'visible');
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // 2. Viewport Tracking (Intersection Observer)
  const [isOutOfView, setIsOutOfView] = useState(false);
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsOutOfView(!entry.isIntersecting);
      },
      { threshold: 0.40 } // Pause as soon as 65% is off-screen
    );

    observer.observe(containerRef.current);
    return () => observer.disconnect();
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

  // Handle Resize for "Cover" Effect (No Black Bars)
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        const targetAspect = 16 / 9; // YouTube aspect ratio
        const containerAspect = clientWidth / clientHeight;

        const ZOOM_FACTOR = 1.9; // Extreme zoom to crop YouTube UI off-screen

        if (containerAspect > targetAspect) {
          // Container is wider than video (Panoramic) -> Match Width, Crop Vertical
          setVideoDimensions({ width: clientWidth * ZOOM_FACTOR, height: (clientWidth / targetAspect) * ZOOM_FACTOR });
        } else {
          // Container is taller than video (Portrait/Box) -> Match Height, Crop Horizontal
          setVideoDimensions({ width: (clientHeight * targetAspect) * ZOOM_FACTOR, height: clientHeight * ZOOM_FACTOR });
        }
      }
    };

    window.addEventListener('resize', handleResize);
    const timer = setTimeout(handleResize, 100); // Initial check
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timer);
    };
  }, []);

  // Universal Sync: Listen to global player activity, scrolling, and tabs
  const currentHeroVideoId = movie ? String(movie.id) : null;
  useEffect(() => {
    const isSharedConflict = activeVideoId && activeVideoId !== currentHeroVideoId;
    
    if (playerRef.current && isVideoReady && showVideo) {
      // It should play if: it's on screen AND no other video is playing AND the tab is active
      const shouldPlay = !isOutOfView && !isSharedConflict && isTabVisible;
      
      if (shouldPlay) {
        try {
          if (typeof playerRef.current?.playVideo === 'function') playerRef.current.playVideo();
          if (!isMuted) fadeAudioIn();
        } catch (e) { }
      } else {
        // FULL PAUSE
        try {
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
        movie={movie} showVideo={showVideo} trailerQueue={trailerQueue} isVideoReady={isVideoReady} setIsVideoReady={setIsVideoReady} setTrailerQueue={setTrailerQueue} setShowVideo={setShowVideo} isMuted={isMuted} videoDimensions={videoDimensions} playerRef={playerRef} isHovered={isHovered} replayCount={replayCount}
        onSyncCheck={(videoId) => {
          const state = getVideoState(movie.id);
          return state?.videoId === videoId ? state.time : undefined;
        }}
        onVideoEnd={() => { setHasVideoEnded(true); setShowVideo(false); setIsVideoReady(false); }}
        youtubeQuality={networkQuality.quality}
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
      <div className="absolute right-0 bottom-[34%] flex items-center gap-3 z-30 pointer-events-auto">
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
            className="w-9 h-9 md:w-10 md:h-10 border-[1.5px] border-white/40 rounded-full flex items-center justify-center bg-zinc-900/40 backdrop-blur-md transition-all duration-300 hover:bg-white/10 hover:scale-110 hover:border-white shadow-lg group mr-4"
          >
            {hasVideoEnded ? (
              <ArrowCounterClockwise size={20} className="text-white" />
            ) : (
              isMuted ? <SpeakerSlashIcon size={20} className="text-white" /> : <SpeakerHighIcon size={20} className="text-white" />
            )}
          </button>
        )}
        <div className="bg-gray-500/40 border-l-[3px] border-gray-300 py-1.5 px-3 md:px-5 min-w-[60px] md:min-w-[90px] flex items-center justify-start">
          <span className="text-white text-sm md:text-lg font-medium drop-shadow-md select-none">{movie.adult ? '18+' : '13+'}</span>
        </div>
      </div>
    </div>
  );
};

export default HeroCarousel;