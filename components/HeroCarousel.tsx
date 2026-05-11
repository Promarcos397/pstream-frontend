import React, { useState, useEffect, useRef } from 'react';
import { SpeakerSlashIcon, SpeakerHighIcon, ArrowCounterClockwise } from '@phosphor-icons/react';

import { useGlobalContext } from '../context/GlobalContext';
import { useNetworkQuality } from '../hooks/useNetworkQuality';
import { useIsMobile } from '../hooks/useIsMobile';
import HeroCarouselBackground from './HeroCarouselBackground';
import HeroCarouselContent from './HeroCarouselContent';
import { Movie, TMDBResponse } from '../types';
import { REQUESTS, LOGO_SIZE } from '../constants';
import { HeroEngine, HeroPackage } from '../services/HeroEngine';
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
  const { getVideoState, setHeroVideoState, heroVideoState, activeVideoId, setActiveVideoId, globalMute, setGlobalMute, clearVideoState } = useGlobalContext();
  const networkQuality = useNetworkQuality();
  const isMobile = useIsMobile();
  const [movie, setMovie] = useState<Movie | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const [showVideo, setShowVideo] = useState(false);

  const [isVideoReady, setIsVideoReady] = useState(false);
  const [hasVideoEnded, setHasVideoEnded] = useState(false);
  const [replayCount, setReplayCount] = useState(0); 

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


  useEffect(() => {
    if (loading || !movie) return;
    
    // We only mount the TrailerPlayer if the tab is visible, the hero is in view, and not on mobile
    if (isOutOfView || !isTabVisible || isMobile) {
        setShowVideo(false);
        setActiveVideoId(prev => prev === `hero-${movie.id}` ? null : prev);
    } else {
        // Delay playing by a short amount (simulating network delay aesthetic)
        const delay = networkQuality.isSlowNetwork ? 2000 : 1000;
        const timer = setTimeout(() => {
            setShowVideo(true);
            setActiveVideoId(prev => {
                // If a modal or hover card is already playing (e.g. from page refresh restore), don't steal focus!
                if (!prev || prev.startsWith('hero-')) {
                    return `hero-${movie.id}`;
                }
                return prev;
            });
        }, delay);
        return () => clearTimeout(timer);
    }
  }, [isOutOfView, isTabVisible, loading, movie, networkQuality.isSlowNetwork, setActiveVideoId, isMobile]);

  // Removed custom seek handling since TrailerPlayer does it natively via GlobalContext

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
      className="relative h-[50vh] sm:h-[66vh] md:h-[77vh] lg:h-[80vh] w-full overflow-hidden group bg-black"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={(e) => {
        if (e.clientY < 60 || e.clientX > window.innerWidth - 20) return;
        setIsHovered(false);
      }}
    >
      <HeroCarouselBackground
        movie={movie} 
        showVideo={showVideo} 
        replayCount={replayCount}
        showBackdropOverlay={showBackdropOverlay}
        onReady={() => setIsVideoReady(true)}
        onEnded={() => { setHasVideoEnded(true); setShowVideo(false); setIsVideoReady(false); }}
        onErrored={() => { setShowVideo(false); setIsVideoReady(false); }}
      />
      <HeroCarouselContent
        movie={movie} logoUrl={logoUrl} isVideoReady={isVideoReady} onPlay={onPlay}
        onSelect={(m, _, __) => {
          onSelect(m);
        }}
        hasVideoEnded={hasVideoEnded}
      />
        {/* Mute + Age Rating — standardized MaturityBadge */}
        <div className="absolute right-0 flex items-center gap-3 z-30 pointer-events-auto 
          bottom-[25%] sm:bottom-[21%] md:bottom-[17%]"
        >
          {( (showVideo && isVideoReady) || hasVideoEnded ) && (
            <button 
              onClick={() => {
                if (hasVideoEnded) {
                  clearVideoState(movie.id);
                  setHasVideoEnded(false);
                  setReplayCount(prev => prev + 1);
                  setShowVideo(true);
                } else {
                  setGlobalMute(!globalMute);
                }
              }} 
              className="w-9 h-9 md:w-10 md:h-10 border-[1.5px] border-white/40 rounded-full flex items-center justify-center bg-zinc-900/40 backdrop-blur-md transition-all duration-300 hover:bg-white/10 hover:scale-110 hover:border-white shadow-lg group mr-4 active:scale-90"
              aria-label={globalMute ? 'Unmute' : 'Mute'}
            >
              {hasVideoEnded ? (
                <ArrowCounterClockwise size={20} className="text-white" />
              ) : (
                globalMute ? <SpeakerSlashIcon size={20} className="text-white" /> : <SpeakerHighIcon size={20} className="text-white" />
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