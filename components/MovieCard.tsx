import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { SpeakerSlashIcon, SpeakerHighIcon, PlayIcon, CheckIcon, PlusIcon, ThumbsUpIcon, ThumbsDownIcon, HeartIcon, CaretDownIcon, BookOpenIcon, TicketIcon } from '@phosphor-icons/react';
import { useYouTubePlayer } from '../hooks/useYouTubePlayer';
import { useIsInTheaters } from '../hooks/useIsInTheaters';
import { useNavigate, Link } from 'react-router-dom';
import YouTube from 'react-youtube';
import { useGlobalContext } from '../context/GlobalContext';
import axios from 'axios';
import { GENRES, LOGO_SIZE } from '../constants';
import { getMovieImages, prefetchStream, getExternalIds, getMovieDetails, fetchTrailers } from '../services/api';
import { Movie } from '../types';
import { searchTrailersWithFallback } from '../services/YouTubeService';
import { NetworkPriority } from '../services/NetworkPriority';

import { useIsMobile } from '../hooks/useIsMobile';

interface MovieCardProps {
  movie: Movie;
  onSelect: (movie: Movie, time?: number, videoId?: string) => void;
  onPlay?: (movie: Movie) => void;
  isGrid?: boolean;
}

const BadgeOverlay: React.FC<{ badge: { text: string; type: string } | null; isBook: boolean }> = React.memo(({ badge, isBook }) => {
  if (isBook) {
    return (
      <div className="absolute top-2 left-2 bg-black/50 border border-white/40 text-white px-2 py-0.5 text-[10px] font-medium uppercase backdrop-blur-sm">
        Comic
      </div>
    );
  }
  if (!badge) return null;

  if (badge.type === 'top') {
    return (
      <div
        className="absolute top-0 right-0 z-10 w-[23px] h-[32px] bg-[#E50914] flex flex-col items-center justify-start pt-[2px] pr-[1px] shadow-sm pointer-events-none"
        style={{ clipPath: 'polygon(100% 0, 100% 100%, 100% 85%, 0 100%, 0 0)' }}
      >
        <div className="text-white text-[9px] font-bold tracking-tighter, leading-none mb-[2px]" style={{ fontFamily: "'Niva Bold', sans-serif", letterSpacing: '0.5px' }}>TOP</div>
        <div className="text-white text-[13px] leading-none" style={{ fontFamily: "'Niva Bold', sans-serif", letterSpacing: '-0.5px' }}>10</div>
      </div>
    );
  }
  if (badge.type === 'new') {
    return (
      <div className="absolute bottom-0 left-0 right-0 z-10 flex justify-center">
        <div className="bg-[#E50914] text-white text-[8px] font-bold px-3 py-[3px] tracking-wider uppercase leading-none">
          {badge.text}
        </div>
      </div>
    );
  }
  if (badge.type === 'upcoming') {
    return (
      <div className="absolute bottom-0 left-0 right-0 z-10 flex justify-center">
        <div className="bg-black/70 border border-white/30 text-white text-[8px] font-bold px-3 py-[3px] tracking-wider uppercase leading-none backdrop-blur-sm">
          {badge.text}
        </div>
      </div>
    );
  }
  return null;
});

const ProgressIndicator: React.FC<{ movie: Movie; getLastWatchedEpisode: any; getVideoState: any }> = React.memo(({ movie, getLastWatchedEpisode, getVideoState }) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const fetchProgress = async () => {
      try {
        // Skip background fetch if video is actively playing — don't compete for bandwidth
        if (NetworkPriority.isVideoActive()) return;

        // Fallback to local storage logic instantly for UI snap
        let localProgress = 0;
        const mediaType = movie.media_type || (movie.title ? 'movie' : 'tv');
        if (mediaType === 'tv') {
          const ep = getLastWatchedEpisode(String(movie.id));
          if (ep && ep.duration > 0) localProgress = (ep.time / ep.duration) * 100;
        } else {
          const state = getVideoState(movie.id);
          if (state && state.duration && state.duration > 0) localProgress = (state.time / state.duration) * 100;
        }

        setProgress(localProgress);

        // Then asynchronously ask the server for the precise cross-device watch percentage
        try {
          const apiBase = (import.meta as any).env?.VITE_GIGA_BACKEND_URL || (window.location.hostname === 'localhost' ? 'http://localhost:7860' : window.location.origin);
          const res = await axios.get(`${apiBase}/api/profiles/default/progress/${movie.id}`);
          if (res.data && res.data.length > 0) {
            const p = res.data[0];
            if (p.duration > 0) {
              setProgress((p.watched / p.duration) * 100);
            }
          }
        } catch (e) { /* server offline, rely on local */ }

      } catch (err) { }
    };
    fetchProgress();
  }, [movie.id]);

  if (progress > 0 && progress < 100) {
    return (
      <div className="absolute bottom-0 left-0 w-full h-[3px] bg-black/50 pointer-events-none z-10">
        <div
          className="h-full bg-[#E50914]"
          style={{ width: `${Math.max(0, Math.min(100, progress))}%`, borderRadius: 0 }}
        />
      </div>
    );
  }
  return null;
});

type MovieRating = 'like' | 'dislike' | 'love';
const RatingPill: React.FC<{ rating: MovieRating | undefined; onRate: (r: MovieRating) => void }> = ({ rating, onRate }) => {
  const [expanded, setExpanded] = useState(false);
  const CurrentIcon = rating === 'love' ? HeartIcon : rating === 'dislike' ? ThumbsDownIcon : ThumbsUpIcon;
  return (
    <div
      className="relative flex items-center"
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
    >
      <div
        className={`flex items-center gap-1 overflow-hidden transition-all duration-200 border-2 rounded-full bg-[#2a2a2a]/80
          ${expanded ? 'border-white/60 px-2 gap-2' : 'border-gray-500 justify-center w-8 h-8 md:w-9 md:h-9'}`}
        style={{ height: expanded ? 36 : undefined }}
      >
        {expanded ? (
          <>
            {(['love', 'like', 'dislike'] as MovieRating[]).map(r => {
              const Icon = r === 'love' ? HeartIcon : r === 'like' ? ThumbsUpIcon : ThumbsDownIcon;
              const isActive = rating === r;
              return (
                <button
                  key={r}
                  onClick={(e) => { e.stopPropagation(); onRate(r); setExpanded(false); }}
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-150 hover:scale-125 flex-shrink-0
                    ${isActive ? 'text-white' : 'text-white/60 hover:text-white'}`}
                  title={r.charAt(0).toUpperCase() + r.slice(1)}
                >
                  <Icon size={16} weight={isActive ? 'fill' : 'bold'} />
                </button>
              );
            })}
          </>
        ) : (
          <CurrentIcon size={16} weight={rating ? 'fill' : 'bold'} className={rating ? 'text-white' : 'text-white'} />
        )}
      </div>
    </div>
  );
};

const MovieCard: React.FC<MovieCardProps> = ({ movie, onSelect, onPlay, isGrid = false }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { 
    myList, toggleList, rateMovie, getMovieRating, getVideoState, 
    updateVideoState, getEpisodeProgress, getLastWatchedEpisode, 
    top10TV, top10Movies, activeVideoId, setActiveVideoId,
    globalMute, setGlobalMute
  } = useGlobalContext();
  const [isHovered, setIsHovered] = useState(false);
  const [isPrimed, setIsPrimed] = useState(false); // Immediate visual feedback
  const { trailerUrl, setTrailerUrl, playerRef, handleMuteToggle } = useYouTubePlayer();
  // We use our local context destructured vars to avoid any stale closures
  const isMuted = globalMute;
  const setIsMuted = setGlobalMute;
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [imgFailed, setImgFailed] = useState(false);
  const isCinemaOnly = useIsInTheaters(movie);
  const [lastSyncTime, setLastSyncTime] = useState(0);

  // --- 4. Bidirectional Sync Layer: Modal -> Card ---
  useEffect(() => {
    // When the global video claim is released (activeVideoId === null),
    // and this card is still hovered/alive, we check if we need to catch up
    if (isHovered && playerRef.current && activeVideoId === null && trailerUrl) {
      const savedState = getVideoState(movie.id);
      if (savedState && savedState.time > 0 && savedState.videoId === trailerUrl) {
        // Sync if the difference is meaningful (> 1s) to avoid unnecessary jitter
        const currentTime = playerRef.current.getCurrentTime();
        if (Math.abs(currentTime - savedState.time) > 1) {
          playerRef.current.seekTo(savedState.time, true);
        }
      }
    }
  }, [activeVideoId, isHovered, trailerUrl, movie.id, getVideoState]);

  // 'center' | 'left' | 'right' - determines expansion direction
  const [hoverPosition, setHoverPosition] = useState<'center' | 'left' | 'right'>('center');

  const isAdded = myList.find(m => m.id === movie.id);
  const timerRef = useRef<any>(null);
  const leaveTimerRef = useRef<any>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // --- Dynamic Badge Logic (strict thresholds to reduce clutter) ---
  const getBadgeInfo = () => {
    const isTV = movie.media_type === 'tv' || (!movie.media_type && !movie.title);
    const movieIdNum = Number(movie.id);

    // Sync with New & Popular Top 10 Lists
    if (isTV && top10TV?.includes(movieIdNum)) {
      return { text: 'Top 10', type: 'top' };
    }
    if (!isTV && top10Movies?.includes(movieIdNum)) {
      return { text: 'Top 10', type: 'top' };
    }

    const dateStr = movie.release_date || movie.first_air_date;
    const now = new Date();

    // Check release recency
    if (dateStr) {
      const releaseDate = new Date(dateStr);
      const diffTime = releaseDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      // Coming soon (within next 30 days)
      if (diffDays > 0 && diffDays <= 30) {
        return { text: 'Coming Soon', type: 'upcoming' };
      }

      // Recently added (within last 45 days)
      if (diffDays >= -45 && diffDays <= 0) {
        return {
          text: isTV ? 'New Episodes' : 'Recently Added',
          type: 'new'
        };
      }
    }

    return null;
  };

  const badge = getBadgeInfo();

  const [isVisible, setIsVisible] = useState(false);

  // Intersection Observer for Lazy Logo Fetching
  useEffect(() => {
    if (!cardRef.current) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        setIsVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: '200px' });
    observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, []);

  // Adaptive Logo Engine
  const [logoDim, setLogoDim] = useState<{ ratio: number; isSquare: boolean }>({ ratio: 1.5, isSquare: false });
  const handleLogoLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = e.currentTarget;
    const ratio = naturalWidth / naturalHeight;
    setLogoDim({ ratio, isSquare: ratio < 1.35 });
  };

  // Fetch Logo only when visible
  useEffect(() => {
    if (!isVisible) return;
    let isMounted = true;
    const fetchLogo = async () => {
      try {
        const mediaType = (movie.media_type || (movie.title ? 'movie' : 'tv')) as 'movie' | 'tv';
        const data = await getMovieImages(String(movie.id), mediaType);

        if (!isMounted) return;

        if (data && data.logos) {
          const logo = data.logos.find((l: any) => l.iso_639_1 === 'en' || l.iso_639_1 === null);
          if (logo) {
            setLogoUrl(`https://image.tmdb.org/t/p/${LOGO_SIZE}${logo.file_path}`);
          }
        }
      } catch (e) { }
    };

    fetchLogo();
    return () => { isMounted = false; };
  }, [isVisible, movie.id, movie.media_type, movie.title]);

  // Prefetch stream on hover
  const handleMouseEnter = (e: React.MouseEvent) => {
    // CSS media query is the most reliable touch/cursor signal.
    // (hover: hover) = device supports hover. (pointer: fine) = precise pointer (mouse/trackpad).
    // Touch screens, tablets, and touch-mode laptops all fail (pointer: fine).
    const hasRealCursor = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (!hasRealCursor || isMobile) return;

    const mediaType = (movie.media_type || (movie.title ? 'movie' : 'tv')) as 'movie' | 'tv';
    const dateStr = movie.release_date || movie.first_air_date;
    const yearString = dateStr ? dateStr.split('-')[0] : '';

    // Determine screen position for smart popup alignment
    let currentPos: 'center' | 'left' | 'right' = 'center';
    if (cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect();
      const popupWidth = window.innerWidth > 1024 ? 300 : 260;
      const expansionBuffer = (popupWidth * 1.05 - rect.width) / 2;

      if (rect.left < expansionBuffer) currentPos = 'left';
      else if (window.innerWidth - rect.right < expansionBuffer) currentPos = 'right';
      setHoverPosition(currentPos);
    }

    // 1. INSTANT PRE-FETCH: Shared Precision Trailer Logic
    if (!trailerUrl && !isBook && movie.id) {
      // First, check if we already have it in the global state (found by a previous hover)
      const savedVideoId = getVideoState(movie.id)?.videoId;
      if (savedVideoId) {
        setTrailerUrl(savedVideoId);
      } else {
        fetchTrailers(movie.id, mediaType).then(keys => {
          if (keys && keys.length > 0) {
            const firstKey = keys[0];
            setTrailerUrl(firstKey);
            // Save to context immediately so InfoModal can grab it without waiting
            updateVideoState(movie.id, 0, firstKey);
          }
        }).catch(() => {});
      }
    }

    // Immediate visual priming
    setIsPrimed(true);
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }

    // 2. VISUAL DELAY: Wait 600ms before expanding and playing
    timerRef.current = setTimeout(() => {
      setIsHovered(true);

      // Claim the global stage IMMEDIATELY using the Movie ID
      setActiveVideoId(String(movie.id));

      const year = yearString ? parseInt(yearString) : undefined;
      if (year) {
        prefetchStream(movie.title || movie.name || '', year, String(movie.id), mediaType, 1, 1);
      }
    }, 600);
  };

  const handleMouseLeave = () => {
    setIsPrimed(false);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    leaveTimerRef.current = setTimeout(() => {
      if (isHovered && playerRef.current && trailerUrl) {
        try {
          // Safely check if the function exists before calling it
          const currentTime = playerRef.current?.getCurrentTime?.() || 0;
          updateVideoState(movie.id, currentTime, trailerUrl);
        } catch (e) {
          // Ignore YouTube API readiness errors
        }
      }

      setIsHovered(false);
      setTrailerUrl(null);
      // ONLY release the claim if this specific card still owns it. 
      // If the InfoModal opened, it will have stolen the claim, so we leave it alone!
      setActiveVideoId(prev => prev === String(movie.id) ? null : prev);
    }, 160);
      // setIsMuted(true); // Left commented out to prevent global mute ghosting
  };

  const getGenreNames = () => {
    if (!movie.genre_ids) return [];
    return movie.genre_ids.map(id => t(`genres.${id}`, { defaultValue: GENRES[id] })).filter(Boolean).slice(0, 3);
  };

  // Dynamic Class Calculation
  const getPositionClasses = () => {
    switch (hoverPosition) {
      case 'left': return { wrapper: 'left-0 translate-x-0', inner: 'origin-left' };
      case 'right': return { wrapper: 'right-0 translate-x-0', inner: 'origin-right' };
      default: return { wrapper: 'left-1/2 -translate-x-1/2', inner: 'origin-center' };
    }
  };

  const posClasses = getPositionClasses();

  // Handler that saves state to context before opening modal
  const handleOpenModal = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const currentTime = playerRef.current && typeof playerRef.current.getCurrentTime === 'function' 
      ? playerRef.current.getCurrentTime() 
      : 0;
    
    const finalTrailerUrl = trailerUrl || getVideoState(movie.id)?.videoId;

    // Pass card coordinates for Spring Effect
    const rect = cardRef.current?.getBoundingClientRect();
    const coordinates = rect ? { x: rect.left, y: rect.top, width: rect.width, height: rect.height } : undefined;

    if (finalTrailerUrl) {
      updateVideoState(movie.id, currentTime, finalTrailerUrl);
    }
    onSelect(movie, currentTime, finalTrailerUrl);

    // Store coordinates in window for modal to pick up
    (window as any).__last_card_rect = coordinates;
  };

  const handleDirectPlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    const currentTime = playerRef.current?.getCurrentTime?.() || 0;
    if (trailerUrl) {
      updateVideoState(movie.id, currentTime, trailerUrl);
    }
    
    if (onPlay) {
      onPlay(movie);
    } else {
      const type = movie.media_type === 'tv' || (!movie.media_type && !movie.title) ? 'tv' : 'movie';
      navigate(`/watch/${type}/${movie.id}`);
    }
  };

  const isBook = ['series', 'comic', 'manga', 'local'].includes(movie.media_type || '');

  const imageSrc = (movie.poster_path?.startsWith('http') || movie.backdrop_path?.startsWith('http') || movie.poster_path?.startsWith('comic://') || movie.backdrop_path?.startsWith('comic://'))
    ? (movie.backdrop_path || movie.poster_path)
    : `https://image.tmdb.org/t/p/w780${movie.backdrop_path || movie.poster_path}`;

  const posterSrc = (movie.poster_path?.startsWith('http') || movie.poster_path?.startsWith('comic://'))
    ? movie.poster_path
    : `https://image.tmdb.org/t/p/w780${movie.poster_path}`;

  return (
    <div
      ref={cardRef}
      className={`relative z-10 group/card transition-all duration-200 select-none
        ${isPrimed ? 'scale-[1.04] z-50 brightness-110' : 'scale-100 brightness-100'}
        ${isGrid
          ? 'w-full aspect-video cursor-pointer'
          : 'flex-none w-[calc((100vw-3rem)/2.3)] sm:w-[calc((100vw-3rem)/3.3)] md:w-[calc((100vw-3.5rem)/4.3)] lg:w-[calc((100vw-4rem)/6.6)] aspect-[7/4.32] cursor-pointer'
        }`}
      style={{ transformOrigin: 'center center' }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={(e) => { e.preventDefault(); handleOpenModal(e); }}
    >
      <div className="w-full h-full relative rounded-sm overflow-hidden movie-card-glow">
        <img
          src={isGrid ? posterSrc : imageSrc}
          className={`w-full h-full object-cover rounded-sm backdrop-pop ${isBook && !isGrid ? 'object-[50%_30%]' : 'object-center'}`}
          alt={movie.name || movie.title}
          loading="lazy"
          draggable={false}
        />

        {/* Base Title Overlay */}
        {!isHovered && (
          <>
            <div className="absolute inset-x-0 bottom-0 min-h-[40%] bg-gradient-to-t from-black/50 via-black/10 to-transparent flex items-end justify-center pb-3 px-3 opacity-100 transition-opacity duration-300">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={movie.title || movie.name}
                  onLoad={handleLogoLoad}
                  className={`w-auto object-contain drop-shadow-2xl transition-all duration-300 ${logoDim.isSquare ? 'max-h-16' : 'max-h-11'}`}
                  draggable={false}
                />
              ) : (
                <h3 className={`text-white font-leaner text-center tracking-wide leading-tight drop-shadow-md line-clamp-3 mb-2 w-full px-1 ${isBook ? 'text-2xl' : 'text-xl'}`}>
                  {movie.title || movie.name}
                </h3>
              )}
            </div>

            {/* Dynamic Badges on Base Card */}
            <BadgeOverlay badge={badge} isBook={isBook} />
          </>
        )}
      </div>

      {/* Progress Bar underneath the poster */}
      {!isHovered && <ProgressIndicator movie={movie} getLastWatchedEpisode={getLastWatchedEpisode} getVideoState={getVideoState} />}

      {/* Hover Popup - Active on all views */}
      {isHovered && (
        <div className={`absolute top-[-20px] md:top-[-30px] lg:top-[-50px] z-[100] animate-netflix-zoom-${hoverPosition} ${posClasses.wrapper}`}>
          <div
            className={`w-[220px] md:w-[245px] lg:w-[275px] bg-[#141414] rounded-lg overflow-hidden ring-1 ring-zinc-700/60 shadow-[0_8px_32px_rgba(0,0,0,0.8)] ${posClasses.inner}`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Media Container */}
            <div className="relative h-[147px] md:h-[159px] bg-[#141414] overflow-hidden rounded-t-md" onClick={handleOpenModal}>
              {(trailerUrl && !isBook) ? (
                <div className="absolute top-[40%] left-1/2 w-[200%] h-[200%] -translate-x-1/2 -translate-y-1/2 pointer-events-none">
                  <YouTube
                    videoId={trailerUrl}
                    opts={{
                      height: '100%',
                      width: '100%',
                      playerVars: {
                        autoplay: 1,
                        controls: 0,
                        modestbranding: 1,
                        loop: 1,
                        playlist: trailerUrl,
                        disablekb: 1,
                        fs: 0,
                        rel: 0,
                        iv_load_policy: 3,
                        cc_load_policy: 0,
                        vq: 'hd1080', // Force HD
                        start: 5,
                      }
                    }}
                    onReady={(e) => {
                      playerRef.current = e.target;
                      if (isMuted) {
                        e.target.mute();
                      } else {
                        e.target.unMute();
                      }

                      // Seamless sync from Context - only seek if same video
                      const savedState = getVideoState(movie.id);
                      if (savedState && savedState.time > 0 && savedState.videoId === trailerUrl) {
                        e.target.seekTo(savedState.time, true);
                      }
                    }}
                    onStateChange={(e) => {
                      // Save progress in real-time so other surfaces (like Modal) can pick up exactly where we are
                      try {
                        const time = e.target.getCurrentTime();
                        if (time > 0 && trailerUrl) {
                          updateVideoState(movie.id, time, trailerUrl);
                        }
                      } catch (err) {}
                    }}
                    onError={(e) => { 
                      console.warn("YouTube blocked playback:", e);
                      setTrailerUrl(""); // Reset to empty string, matching state type
                    }}
                    onEnd={(e) => {
                      e.target.seekTo(0);
                      e.target.playVideo();
                    }}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <img
                  src={imageSrc}
                  className={`w-full h-full object-cover backdrop-pop ${isBook ? 'object-[50%_30%]' : 'object-center'}`}
                  alt="preview"
                />
              )}

              {/* Mute Button - Hide for books */}
              {trailerUrl && !isBook && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleMuteToggle(e); }}
                  className="absolute bottom-4 right-4 w-9 h-9 rounded-full border border-white/40 bg-zinc-900/40 backdrop-blur-md flex items-center justify-center transition-all duration-300 hover:bg-white/10 hover:scale-110 hover:border-white z-50 pointer-events-auto cursor-pointer shadow-lg"
                >
                  {isMuted ? <SpeakerSlashIcon size={18} className="text-white" /> : <SpeakerHighIcon size={18} className="text-white" />}
                </button>
              )}

              <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[#181818] to-transparent z-10 pointer-events-none" />

              <div className="absolute bottom-3 left-4 right-12 pointer-events-none z-20">
                {logoUrl && !imgFailed ? (
                  <img
                    src={logoUrl}
                    alt={movie.title || movie.name}
                    className={`w-auto object-contain origin-bottom-left drop-shadow-2xl transition-all duration-300 ${logoDim.isSquare ? 'h-14 md:h-20' : 'h-10 md:h-12'}`}
                    onError={() => setImgFailed(true)}
                  />
                ) : (
                  <h4 className="text-white font-leaner text-4xl line-clamp-2 drop-shadow-md tracking-wide text-center mb-2 leading-none">{movie.title || movie.name}</h4>
                )}
              </div>
            </div>

            {/* Info Section */}
            <div className="px-3 pt-2.5 pb-3 space-y-2.5 bg-[#181818]">
              {/* Action Buttons Row */}
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  {/* Play/Read/Theater Button */}
                      {isCinemaOnly && !isBook ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleOpenModal(); }}
                          className="bg-[#6d6d6e] text-white rounded-full w-8 h-8 md:w-9 md:h-9 flex items-center justify-center hover:bg-neutral-500 transition active:scale-95"
                          title="In Theaters"
                        >
                          <TicketIcon size={18} weight="bold" />
                        </button>
                      ) : (
                        <Link
                          to={`/watch/${movie.media_type === 'tv' || (!movie.media_type && !movie.title) ? 'tv' : 'movie'}/${movie.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="bg-white text-black rounded-full w-8 h-8 md:w-9 md:h-9 flex items-center justify-center hover:bg-neutral-200 transition active:scale-95 shadow-md hover:scale-110 duration-200"
                          title={isBook ? "Read Now" : "Play"}
                        >
                          {isBook ? <BookOpenIcon size={18} weight="fill" /> : <PlayIcon size={22} weight="fill" className="ml-0.5" />}
                        </Link>
                      )}
                  {/* Add to List — subtle animation on state change */}
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleList(movie); }}
                    className={`border-2 rounded-full w-8 h-8 md:w-9 md:h-9 flex items-center justify-center text-white transition-all duration-200 hover:scale-110 active:scale-90
                      ${isAdded ? 'border-white bg-white/10 shadow-[0_0_8px_rgba(255,255,255,0.25)]' : 'border-gray-500 bg-[#2a2a2a]/80 hover:border-white'}`}
                    title={isAdded ? 'Remove from My List' : 'Add to My List'}
                  >
                    {isAdded ? <CheckIcon size={16} weight="bold" /> : <PlusIcon size={16} weight="bold" />}
                  </button>
                  {/* Rate — Love / Like / Dislike pill */}
                  <RatingPill
                    rating={getMovieRating(movie.id)}
                    onRate={(r) => { rateMovie(movie, r); }}
                  />
                </div>

                {/* More Info - Chevron Down */}
                <button
                  onClick={handleOpenModal}
                  className="border-2 border-gray-500 bg-[#2a2a2a]/80 rounded-full w-8 h-8 md:w-9 md:h-9 flex items-center justify-center hover:border-white hover:scale-110 transition-all duration-200 text-white"
                  title="More Info"
                >
                  <CaretDownIcon size={18} weight="bold" />
                </button>
              </div>

              {/* Metadata Row */}
              <div className="flex items-center flex-wrap gap-1.5 text-[13px] font-medium">
                {/* Maturity Rating Badge */}
                <span className="border border-white/40 text-white/90 px-1 py-[1px] text-[10px] font-medium">
                  {movie.adult ? 'TV-MA' : movie.vote_average >= 7.5 ? 'TV-14' : 'TV-PG'}
                </span>

                {/* Runtime or Season count */}
                <span className="text-white/70">
                  {isBook ? (movie.media_type === 'series' ? 'Series' : 'Comic') :
                    movie.media_type === 'tv' ? `${Math.max(1, Math.ceil((movie.vote_count || 10) / 500))} Seasons` :
                      movie.runtime ? `${Math.floor(movie.runtime / 60)}h ${movie.runtime % 60}m` :
                        `${Math.floor((movie.popularity || 100) / 10 + 80)}m`
                  }
                </span>

                {!isBook && <span className="border border-gray-500 text-gray-400 px-1 py-[0.5px] text-[9px] rounded-[2px]">HD</span>}
              </div>

              {/* Genres Row — bullet-separated */}
              <div className="flex flex-wrap items-center text-[12px] font-medium">
                {getGenreNames().map((genre, idx) => (
                  <span key={idx} className="flex items-center">
                    <span className="text-white/80 hover:text-white cursor-default">{genre}</span>
                    {idx < getGenreNames().length - 1 && <span className="text-gray-500 mx-2 text-[8px]">•</span>}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MovieCard;