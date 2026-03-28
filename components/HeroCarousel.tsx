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
import { getMovieImages, prefetchStream, getExternalIds } from '../services/api';
import { searchTrailersWithFallback } from '../services/YouTubeService';

interface HeroCarouselProps {
  onSelect: (movie: Movie, time?: number, videoId?: string) => void;
  onPlay: (movie: Movie) => void;
  fetchUrl?: string;
  seekTime?: number; // Command to seek
  heroMovie?: Movie; // Optional: Override with explicit movie (e.g. Cloud Series)
}

const HeroCarousel: React.FC<HeroCarouselProps> = ({ onSelect, onPlay, fetchUrl, seekTime, heroMovie }) => {
  const { getVideoState, updateVideoState } = useGlobalContext();
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
  const { isMuted, setIsMuted, playerRef } = useYouTubePlayer(false);
  const [videoDimensions, setVideoDimensions] = useState<{ width: string | number, height: string | number }>({ width: '120%', height: '120%' });

  // playerRef handled by hook
  const videoTimerRef = useRef<any>(null);
  const fadeIntervalRef = useRef<any>(null);

  // Daily Consistent Selection - same movie all day, changes at midnight
  const getDailyIndex = (results: Movie[], pageType: string): number => {
    const seed = new Date().toDateString() + "_" + pageType;
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = ((hash << 5) - hash) + seed.charCodeAt(i);
      hash |= 0; // Convert to 32bit integer
    }
    return Math.abs(hash) % results.length;
  };

  // Derive page type from fetchUrl
  const getPageType = (url: string): string => {
    if (url.includes('tv')) return 'tv';
    if (url.includes('movie')) return 'movie';
    return 'home';
  };

  // Fetch One Movie (Daily Consistent) OR Use Provided Hero Movie
  useEffect(() => {
    async function fetchData() {
      setLoading(true);

      // 1. Explicit Override (Cloud Library)
      if (heroMovie) {
        setMovie(heroMovie);
        setLoading(false);
        return;
      }

      // 2. Fetch from TMDB
      try {
        const url = fetchUrl || REQUESTS.fetchNetflixOriginals;
        const request = await axios.get<TMDBResponse>(url);
        const validResults = (request?.data?.results || []).filter(m => m.backdrop_path);

        if (validResults.length > 0) {
          // Use date-seeded index for daily consistent selection
          const pageType = getPageType(url);
          const dailyIndex = getDailyIndex(validResults, pageType);
          let selectedMovie = validResults[dailyIndex];

          // Fetch full details for IMDb ID if missing
          if (!selectedMovie.imdb_id) {
            try {
              const mediaType = (selectedMovie.media_type || (selectedMovie.title ? 'movie' : 'tv')) as 'movie' | 'tv';
              const externalIds = await getExternalIds(selectedMovie.id, mediaType);
              if (externalIds?.imdb_id) {
                selectedMovie = { ...selectedMovie, imdb_id: externalIds.imdb_id };
              }
            } catch (e) {}
          }

          setMovie(selectedMovie);

          // Prefetch stream for hero movie (user likely to click play)
          if (selectedMovie) {
            console.log('[HeroCarousel] Selected Hero Content:', selectedMovie.title || selectedMovie.name, selectedMovie.imdb_id ? `(IMDb: ${selectedMovie.imdb_id})` : '(No IMDb)');
            const mediaType = (selectedMovie.media_type || (selectedMovie.title ? 'movie' : 'tv')) as 'movie' | 'tv';
            const releaseDate = selectedMovie.release_date || selectedMovie.first_air_date;
            const year = releaseDate ? new Date(releaseDate).getFullYear() : undefined;
            
            prefetchStream(
              selectedMovie.title || selectedMovie.name || '',
              year,
              String(selectedMovie.id),
              mediaType,
              1,
              1,
              selectedMovie.imdb_id
            );
          }
        }
        setLoading(false);
      } catch (error) {
        console.error("Failed to fetch hero content", error);
        setLoading(false);
      }
    }
    fetchData();
  }, [fetchUrl, heroMovie]);

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
      }, 50);
    } catch (e) { if (callback) callback(); }
  };

  // Handle Resize for "Cover" Effect (No Black Bars)
  useEffect(() => {
    const handleResize = () => {
      const container = document.getElementById('hero-container');
      if (container) {
        const { clientWidth, clientHeight } = container;
        const targetAspect = 16 / 9; // YouTube aspect ratio
        const containerAspect = clientWidth / clientHeight;

        const ZOOM_FACTOR = 1.5; // Aggressive zoom to crop YouTube UI (logos/titles) off-screen

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

  // Scroll Listener
  const [isOutOfView, setIsOutOfView] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const scrolled = window.scrollY > 400;
      setIsOutOfView(scrolled);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Re-detect hover after alt-tab (focus/visibility change)
  useEffect(() => {
    const heroContainer = document.getElementById('hero-container');

    const recheckHover = () => {
      if (!heroContainer) return;
      const rect = heroContainer.getBoundingClientRect();
      const mouseX = (window as any).__lastMouseX ?? -1;
      const mouseY = (window as any).__lastMouseY ?? -1;
      const isMouseInside = mouseX >= rect.left && mouseX <= rect.right && mouseY >= rect.top && mouseY <= rect.bottom;
      setIsHovered(isMouseInside);
    };

    const trackMouse = (e: MouseEvent) => {
      (window as any).__lastMouseX = e.clientX;
      (window as any).__lastMouseY = e.clientY;
    };

    const handleFocus = () => recheckHover();
    window.addEventListener('mousemove', trackMouse);
    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('mousemove', trackMouse);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  // Cinematic: Window Visibility Pause (Netflix Logic)
  useEffect(() => {
      const handleVisibility = () => {
          if (document.visibilityState === 'hidden' && playerRef.current) {
              playerRef.current.pauseVideo?.();
          } else if (document.visibilityState === 'visible' && !isOutOfView && isHovered && playerRef.current) {
              playerRef.current.playVideo?.();
          }
      };
      document.addEventListener('visibilitychange', handleVisibility);
      return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [isOutOfView, isHovered]);

  // Handle Play/Pause
  useEffect(() => {
    if (playerRef.current && isVideoReady && showVideo) {
      const shouldPlay = !isOutOfView && isHovered;
      if (shouldPlay) {
        try {
          if (playerRef.current.playVideo) playerRef.current.playVideo();
          else playerRef.current.play();
          if (!isMuted) fadeAudioIn();
        } catch (e) { }
      } else {
        if (!isMuted) {
          fadeAudioOut(() => {
            try {
              if (playerRef.current.pauseVideo) playerRef.current.pauseVideo();
              else playerRef.current.pause();
            } catch (e) { }
          });
        } else {
          try {
            if (playerRef.current.pauseVideo) playerRef.current.pauseVideo();
            else playerRef.current.pause();
          } catch (e) { }
        }
      }
    }
  }, [isOutOfView, isVideoReady, showVideo, isHovered, isMuted]);

  // Handle Seek
  useEffect(() => {
    if (seekTime && seekTime > 0 && playerRef.current) {
      try {
        if (playerRef.current.seekTo) playerRef.current.seekTo(seekTime, true);
        else playerRef.current.currentTime = seekTime;
        if (playerRef.current.playVideo) playerRef.current.playVideo();
        else playerRef.current.play();
      } catch (e) { }
    }
  }, [seekTime]);

  // Handle Assets
  useEffect(() => {
    if (!movie) return;
    setLogoUrl(null);
    setShowVideo(false);
    setIsVideoReady(false);
    setTrailerQueue([]);
    clearTimeout(videoTimerRef.current);
    const fetchAssets = async () => {
      try {
        const mediaType = (movie.media_type || (movie.title ? 'movie' : 'tv')) as 'movie' | 'tv';
        try {
          const imageData = await getMovieImages(movie.id, mediaType);
          if (imageData?.logos) {
            const logo = imageData.logos.find((l: any) => l.iso_639_1 === 'en' || l.iso_639_1 === null);
            if (logo) setLogoUrl(`https://image.tmdb.org/t/p/${LOGO_SIZE}${logo.file_path}`);
          }
        } catch (e) {}
        videoTimerRef.current = setTimeout(async () => {
          if (window.scrollY < 400) {
            const title = movie.title || movie.name;
            if (title) {
              const releaseDate = movie.release_date || movie.first_air_date;
              const year = releaseDate ? releaseDate.split('-')[0] : undefined;
              console.log('[HeroCarousel] Searching trailers for:', title, year, movie.imdb_id);
              const keys = await searchTrailersWithFallback({ title, year, type: mediaType }, 5);
              console.log('[HeroCarousel] Trailer keys found:', keys);
              if (keys?.length > 0) {
                setTrailerQueue(keys);
                setShowVideo(true);
              } else {
                console.warn('[HeroCarousel] No trailer keys found. Content will stay static.');
              }
            }
          }
        }, 1000);
      } catch (e) {}
    };
    fetchAssets();
    return () => clearTimeout(videoTimerRef.current);
  }, [movie]);

  if (loading) return (
    <div className="relative h-[50vh] sm:h-[60vh] md:h-[80vh] w-full bg-[#141414] overflow-hidden">
      <div className="absolute inset-0 bg-[#1f1f1f] animate-pulse" />
    </div>
  );

  if (!movie) return null;

  return (
    <div id="hero-container" className="relative h-[50vh] sm:h-[60vh] md:h-[80vh] w-full overflow-hidden group bg-black"
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
          const actualTime = playerRef.current?.getCurrentTime?.() || 0;
          if (videoId) updateVideoState(m.id, actualTime, videoId);
          onSelect(m, actualTime, videoId);
        }}
        trailerVideoId={trailerQueue[0]} hasVideoEnded={hasVideoEnded}
      />
      <div className="absolute right-0 bottom-[34%] flex items-center gap-3 z-30 pointer-events-auto">
        {showVideo && isVideoReady && !hasVideoEnded && (
          <button onClick={() => setIsMuted(!isMuted)} className="w-9 h-9 md:w-10 md:h-10 border-[1.5px] border-white/70 rounded-full flex items-center justify-center bg-transparent hover:bg-white/10 transition group">
            {isMuted ? <SpeakerSlashIcon size={20} className="text-white" /> : <SpeakerHighIcon size={20} className="text-white" />}
          </button>
        )}
        {hasVideoEnded && (
          <button onClick={() => { setHasVideoEnded(false); setReplayCount(prev => prev + 1); setShowVideo(true); }} className="w-9 h-9 md:w-10 md:h-10 border-[1.5px] border-white/70 rounded-full flex items-center justify-center bg-transparent hover:bg-white/10 transition group">
            <ArrowCounterClockwise size={20} className="text-white" />
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