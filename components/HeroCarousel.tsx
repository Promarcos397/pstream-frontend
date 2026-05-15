import React, { useState, useEffect, useRef } from 'react';
import { SpeakerSlashIcon, SpeakerHighIcon, ArrowCounterClockwise } from '@phosphor-icons/react';

import { useGlobalContext } from '../context/GlobalContext';
import { useNetworkQuality } from '../hooks/useNetworkQuality';
import { useIsMobile } from '../hooks/useIsMobile';
import HeroCarouselBackground from './HeroCarouselBackground';
import HeroCarouselContent from './HeroCarouselContent';
import { Movie } from '../types';
import { HeroEngine, HeroPackage } from '../services/HeroEngine';
import { MaturityBadge } from './MovieCardBadges';
import HeroSkeleton from './HeroSkeleton';

interface HeroCarouselProps {
  onSelect: (movie: Movie, time?: number, videoId?: string) => void;
  onPlay: (movie: Movie) => void;
  fetchUrl?: string;
  seekTime?: number;
  heroMovie?: Movie;
  genreId?: number;
  pageType?: 'home' | 'movie' | 'tv' | 'new_popular';
}

const HeroCarousel: React.FC<HeroCarouselProps> = ({ onSelect, onPlay, fetchUrl, seekTime, heroMovie, genreId, pageType: explicitPageType }) => {
  const { activeVideoId, setActiveVideoId, globalMute, setGlobalMute, clearVideoState, setIsAppReady } = useGlobalContext();
  const networkQuality = useNetworkQuality();
  const isMobile = useIsMobile();
  const [movie, setMovie] = useState<Movie | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isBackdropLoaded, setIsBackdropLoaded] = useState(false);
  const [isLogoLoaded, setIsLogoLoaded] = useState(false);
  const [showVideo, setShowVideo] = useState(false);

  const [isVideoReady, setIsVideoReady] = useState(false);
  const [isActuallyPlaying, setIsActuallyPlaying] = useState(false);
  const [hasVideoEnded, setHasVideoEnded] = useState(false);
  const [replayCount, setReplayCount] = useState(0); 

  const [showBackdropOverlay, setShowBackdropOverlay] = useState(false);
  const visibilityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backdropForcedRef = useRef(false);

  const containerRef = useRef<HTMLDivElement>(null);

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
        }, 15_000);
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

  const [isOutOfView, setIsOutOfView] = useState(false);
  useEffect(() => {
    let rafId: number;
    let lastState = false;

    const check = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const heroHeight = rect.height;
      const visiblePx = Math.min(rect.bottom, heroHeight) - Math.max(rect.top, 0);
      const visibleFraction = Math.max(0, visiblePx / heroHeight);
      const outOfView = visibleFraction < 0.55;
      if (outOfView !== lastState) {
        lastState = outOfView;
        setIsOutOfView(outOfView);
      }
    };

    const onScroll = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(check);
    };

    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.intersectionRatio < 0.4) setIsOutOfView(true); },
      { threshold: [0.4] }
    );
    if (containerRef.current) observer.observe(containerRef.current);

    window.addEventListener('scroll', onScroll, { passive: true });
    check();
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(rafId);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const applyHeroPackage = (pkg: HeroPackage) => {
      setMovie(pkg.movie);
      if (pkg.logoUrl) setLogoUrl(pkg.logoUrl);
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
        else {
            setLoading(false);
            setIsAppReady(true);
        }
      }
    };

    loadHero();
    const unsubscribe = HeroEngine.subscribe((type, pkg) => {
      const currentPageType = getHeroPageType(fetchUrl || '');
      if (type === currentPageType) {
        applyHeroPackage(pkg);
      }
    });

    return () => {
        unsubscribe();
    };
  }, [explicitPageType, fetchUrl, heroMovie, genreId, setIsAppReady]);

  // Unified Blink Reveal & Safety Timeout
  useEffect(() => {
    if (!movie) return;

    let isRevealed = false;
    const reveal = () => {
      if (isRevealed) return;
      isRevealed = true;
      setLoading(false);
      setIsAppReady(true);
    };

    // Case 1: All assets ready
    if (isBackdropLoaded && (logoUrl ? isLogoLoaded : true)) {
      reveal();
    }

    // Case 2: Safety Timeout (3s)
    const safety = setTimeout(reveal, 3000);

    return () => clearTimeout(safety);
  }, [movie, isBackdropLoaded, isLogoLoaded, logoUrl, setIsAppReady]);


  const hasInterruptedRef = useRef(false);
  const prevMovieIdRef = useRef<number | string | null>(null);
  const prevActiveIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (loading || !movie) return;
    
    // Reset interruption state if the movie actually changes
    if (prevMovieIdRef.current !== movie.id) {
        hasInterruptedRef.current = false;
        prevMovieIdRef.current = movie.id;
    }

    const myVideoId = `hero-${movie.id}`;

    if (isOutOfView || isMobile) {
        if (showVideo) hasInterruptedRef.current = true;
        setShowVideo(false);
        setIsActuallyPlaying(false);
        if (activeVideoId === myVideoId) setActiveVideoId(null);
        prevActiveIdRef.current = activeVideoId;
        return;
    }

    if (!isTabVisible) {
        if (activeVideoId === myVideoId) setActiveVideoId(null);
        prevActiveIdRef.current = activeVideoId;
        return;
    }

    // If another player is active, mark as interrupted and stop
    if (activeVideoId && activeVideoId !== myVideoId && !activeVideoId.startsWith('hero-')) {
        hasInterruptedRef.current = true;
        setShowVideo(false);
        setIsActuallyPlaying(false);
        prevActiveIdRef.current = activeVideoId;
        return;
    }

    // If the modal was open for this movie, we treat it as an interruption.
    // The user has transitioned to a deeper detail view, so we don't need to auto-resume the hero trailer.
    if (prevActiveIdRef.current === `modal-${movie.id}`) {
        hasInterruptedRef.current = true;
    }

    // AUTO-RESUME LOGIC: Only resume if we haven't been interrupted
    if (!hasInterruptedRef.current && activeVideoId !== myVideoId && (!activeVideoId || activeVideoId.startsWith('hero-'))) {
        const wasJustActiveElsewhere = prevActiveIdRef.current && 
            prevActiveIdRef.current !== myVideoId && 
            !prevActiveIdRef.current.startsWith('hero-');
        const delay = wasJustActiveElsewhere ? 0 : 80;
        
        const timer = setTimeout(() => {
            setShowVideo(true);
            setActiveVideoId(myVideoId);
        }, delay);
        prevActiveIdRef.current = activeVideoId;
        return () => clearTimeout(timer);
    }

    prevActiveIdRef.current = activeVideoId;
  }, [isOutOfView, isTabVisible, loading, movie, networkQuality.isSlowNetwork, setActiveVideoId, isMobile, activeVideoId, showVideo]);

  const backdropTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!movie) return;
    const myVideoId = `hero-${movie.id}`;
    
    if (activeVideoId && activeVideoId !== myVideoId) {
        if (backdropTimerRef.current) clearTimeout(backdropTimerRef.current);
        backdropTimerRef.current = setTimeout(() => {
            setShowBackdropOverlay(true);
        }, 1800);
    } else {
        if (backdropTimerRef.current) clearTimeout(backdropTimerRef.current);
        if (!backdropForcedRef.current) {
            setShowBackdropOverlay(false);
        }
    }
    
    return () => {
        if (backdropTimerRef.current) clearTimeout(backdropTimerRef.current);
    };
  }, [activeVideoId, movie]);

  if (!movie) {
    if (!loading) return null; // Don't block the rest of the page if Hero fails
    return <HeroSkeleton />;
  }

  return (
    <div 
      id="hero-container" 
      ref={containerRef} 
      className="relative h-[50vh] sm:h-[66vh] md:h-[77vh] lg:h-[80vh] w-full overflow-hidden group bg-black"
    >
      {/* Global Skeleton Overlay (Unified Blink) */}
      {loading && (
        <div className="absolute inset-0 z-[100] bg-black">
          <HeroSkeleton />
        </div>
      )}
      <HeroCarouselBackground
        movie={movie} 
        showVideo={showVideo} 
        isActuallyPlaying={isActuallyPlaying}
        replayCount={replayCount}
        showBackdropOverlay={showBackdropOverlay}
        onReady={() => setIsVideoReady(true)}
        onPlay={() => setIsActuallyPlaying(true)}
        onImageLoad={() => setIsBackdropLoaded(true)}
        onEnded={() => { 
            setHasVideoEnded(true); 
            setShowVideo(false); 
            setIsVideoReady(false); 
            setIsActuallyPlaying(false);
        }}
        onErrored={() => { setShowVideo(false); setIsVideoReady(false); setIsActuallyPlaying(false); }}
      />
      <HeroCarouselContent
        movie={movie} logoUrl={logoUrl} isVideoReady={isActuallyPlaying} onPlay={onPlay}
        onImageLoad={() => setIsLogoLoaded(true)}
        onSelect={(m, _, __) => {
          onSelect(m);
        }}
        hasVideoEnded={hasVideoEnded}
      />
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
          <div className="mr-4">
            <MaturityBadge adult={movie.adult} voteAverage={movie.vote_average} size="md" />
          </div>
        </div>
    </div>
  );
};

export default HeroCarousel;