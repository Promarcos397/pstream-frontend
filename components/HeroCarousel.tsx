import React, { useState, useEffect, useRef } from 'react';
import MobileHero from './MobileHero';
import { ManifestSkeleton } from '../components/ManifestSkeleton';
import { useGlobalContext } from '../context/GlobalContext';
import { useNetworkQuality } from '../hooks/useNetworkQuality';
import { useIsMobile } from '../hooks/useIsMobile';
import HeroCarouselBackground from './HeroCarouselBackground';
import HeroCarouselContent from './HeroCarouselContent';
import { Movie } from '../types';
import { HeroEngine, HeroPackage } from '../services/HeroEngine';
import HeroSkeleton from './HeroSkeleton';
import { preloadTrailer } from '../hooks/useTrailer';

interface HeroCarouselProps {
  onSelect: (movie: Movie, time?: number, videoId?: string) => void;
  onPlay: (movie: Movie) => void;
  fetchUrl?: string;
  seekTime?: number;
  heroMovie?: Movie;
  genreId?: number;
  pageType?: 'home' | 'movie' | 'tv' | 'new_popular';
}

const resolveHeroCacheKey = (url: string, explicitType?: string, gid?: number): string => {
  let type = explicitType;
  if (!type) {
    if (url.includes('tv')) type = 'tv';
    else if (url.includes('movie')) type = 'movie';
    else type = 'home';
  }
  return gid ? `${type}_${gid}` : type;
};

const HeroCarousel: React.FC<HeroCarouselProps> = ({ onSelect, onPlay, fetchUrl, heroMovie, genreId, pageType: explicitPageType }) => {
  const { activeVideoId, setActiveVideoId, globalMute, setGlobalMute, clearVideoState, setIsAppReady, settings } = useGlobalContext();
  const networkQuality = useNetworkQuality();
  const isMobile = useIsMobile();

  // Seed state from cache synchronously — eliminates skeleton flash on revisit
  const [movie, setMovie] = useState<Movie | null>(() => {
    const cached = HeroEngine.getCachedHero(resolveHeroCacheKey(fetchUrl || '', explicitPageType, genreId));
    return cached?.movie ?? null;
  });
  const [logoUrl, setLogoUrl] = useState<string | null>(() => {
    const cached = HeroEngine.getCachedHero(resolveHeroCacheKey(fetchUrl || '', explicitPageType, genreId));
    return cached?.logoUrl ?? null;
  });
  const [loading, setLoading] = useState(() => {
    return !HeroEngine.getCachedHero(resolveHeroCacheKey(fetchUrl || '', explicitPageType, genreId));
  });
  const [isBackdropLoaded, setIsBackdropLoaded] = useState(false);
  const [isLogoLoaded, setIsLogoLoaded] = useState(false);
  const [showVideo, setShowVideo] = useState(false);

  // If we started with cached data, mark app ready immediately
  useEffect(() => {
    if (!loading) setIsAppReady(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [isVideoReady, setIsVideoReady] = useState(false);
  const [isActuallyPlaying, setIsActuallyPlaying] = useState(false);
  const [hasVideoEnded, setHasVideoEnded] = useState(false);
  const [replayCount, setReplayCount] = useState(0);

  const [showBackdropOverlay, setShowBackdropOverlay] = useState(false);
  const visibilityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backdropForcedRef = useRef(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const heroPlayerRef = useRef<any>(null);
  const trailerTimeRef = useRef<number>(0);

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
      if (pkg.movie) {
        preloadTrailer(pkg.movie);
      }
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

    // On mobile, reveal instantly since MobileHero handles its own smooth asset loading
    if (isMobile) {
      reveal();
      return;
    }

    // Case 1: All assets ready
    if (isBackdropLoaded && (logoUrl ? isLogoLoaded : true)) {
      reveal();
    }

    // Case 2: Safety Timeout (3s)
    const safety = setTimeout(reveal, 3000);

    return () => clearTimeout(safety);
  }, [movie, isBackdropLoaded, isLogoLoaded, logoUrl, setIsAppReady, isMobile]);


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

    if (isOutOfView || isMobile || !settings.autoplayPreviews) {
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
    // investigate where is the code responible for viewpoint and height of hero carousel and change it to video aspect ratio

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
  }, [isOutOfView, isTabVisible, loading, movie, networkQuality.isSlowNetwork, setActiveVideoId, isMobile, activeVideoId, showVideo, settings.autoplayPreviews]);

  // Clean up activeVideoId upon unmount of the hero carousel to prevent locking other cards
  useEffect(() => {
    if (!movie) return;
    const myVideoId = `hero-${movie.id}`;
    return () => {
      setActiveVideoId(prev => (prev === myVideoId ? null : prev));
    };
  }, [movie, setActiveVideoId]);

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
    if (!loading) return null; // Don't block the rest of the page if Hero fails make it stay skeleton 
    return <> <HeroSkeleton /> <ManifestSkeleton /> </>
  }
  // if rows of movies are ready to show , hold them untill , i dont know how to code but i will visit this later in sha Allah 
  // const [rowsReady, setRowsReady] = useState(false);
  // const [rows, setRows] = useState([]);

  // useEffect(() => {
  //   if (rowsReady) return;
  //   if (rows.length > 0 && movie) {
  //     setRowsReady(true);
  //   }
  // }, [rows, movie]);

  if (isMobile) {
    return <MobileHero movie={movie} logoUrl={logoUrl} onSelect={onSelect} onPlay={onPlay} />;
  }

  return (
    <div
      id="hero-container"
      ref={containerRef}
      className="relative w-full aspect-[16/7] overflow-hidden group bg-black"
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
        onTimeUpdate={(currentTime) => { trailerTimeRef.current = currentTime; }}
        onPlayerReady={(player) => { heroPlayerRef.current = player; }}
        onEnded={() => {
          setHasVideoEnded(true);
          setShowVideo(false);
          setIsVideoReady(false);
          setIsActuallyPlaying(false);
        }}
        onErrored={() => { setShowVideo(false); setIsVideoReady(false); setIsActuallyPlaying(false); }}
      />
      <HeroCarouselContent
        movie={movie}
        logoUrl={logoUrl}
        isVideoReady={isActuallyPlaying}
        onPlay={onPlay}
        onImageLoad={() => setIsLogoLoaded(true)}
        onSelect={(m) => {
          let t = trailerTimeRef.current;
          try {
            if (heroPlayerRef.current && typeof heroPlayerRef.current.getCurrentTime === 'function') {
              t = heroPlayerRef.current.getCurrentTime() || t;
            }
          } catch {}
          onSelect(m, t > 0 ? t : undefined);
        }}
        hasVideoEnded={hasVideoEnded}
        showMuteButton={(showVideo && isVideoReady) || hasVideoEnded}
        globalMute={globalMute}
        onMuteButtonClick={() => {
          if (hasVideoEnded) {
            clearVideoState(movie.id);
            setHasVideoEnded(false);
            setReplayCount(prev => prev + 1);
            setShowVideo(true);
          } else {
            setGlobalMute(!globalMute);
          }
        }}
      />
    </div>
  );
};

export default HeroCarousel;