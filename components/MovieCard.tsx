import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { SpeakerSlashIcon, SpeakerHighIcon, PlayIcon, CheckIcon, PlusIcon, ThumbsUpIcon, CaretDownIcon, BookOpenIcon } from '@phosphor-icons/react';
import { useYouTubePlayer } from '../hooks/useYouTubePlayer';
import YouTube from 'react-youtube';
import { useGlobalContext } from '../context/GlobalContext';
import axios from 'axios';
import { GENRES, LOGO_SIZE } from '../constants';
import { fetchTrailer, getMovieImages, prefetchStream } from '../services/api';
import { Movie } from '../types';

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
        // (Assuming userId "user" profile ID for demo purposes)
        try {
          const res = await axios.get(`http://localhost:4000/api/profiles/default/progress/${movie.id}`);
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
      <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-[80%] h-1 bg-[#333] shadow-md pointer-events-none z-0">
        <div className="h-full bg-[#E50914]" style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
      </div>
    );
  }
  return null;
});

const MovieCard: React.FC<MovieCardProps> = ({ movie, onSelect, onPlay, isGrid = false }) => {
  const { t } = useTranslation();
  const { myList, toggleList, rateMovie, getMovieRating, getVideoState, updateVideoState, getEpisodeProgress, getLastWatchedEpisode, top10TV, top10Movies } = useGlobalContext();
  const [isHovered, setIsHovered] = useState(false);
  const { trailerUrl, setTrailerUrl, isMuted, setIsMuted, playerRef } = useYouTubePlayer();
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  // 'center' | 'left' | 'right' - determines expansion direction
  const [hoverPosition, setHoverPosition] = useState<'center' | 'left' | 'right'>('center');

  const isAdded = myList.find(m => m.id === movie.id);
  const timerRef = useRef<any>(null);
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

  // Fetch Logo on mount
  useEffect(() => {
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
  }, [movie.id, movie.media_type, movie.title]);

  // Fetch Trailer on Hover
  useEffect(() => {
    let isMounted = true;
    if (isHovered && !trailerUrl) {
      const getTrailer = async () => {
        try {
          const mediaType = (movie.media_type || (movie.title ? 'movie' : 'tv')) as 'movie' | 'tv';
          const url = await fetchTrailer(String(movie.id), mediaType);
          if (isMounted && url) setTrailerUrl(url);
        } catch (e) { }
      };
      getTrailer();
    }
    return () => { isMounted = false; };
  }, [isHovered, movie.id, movie.media_type, movie.title, trailerUrl, setTrailerUrl]);




  // Prefetch stream on hover
  const handleMouseEnter = (e: React.MouseEvent) => {
    // Prevent hover effect on touch devices
    if (!window.matchMedia('(hover: hover)').matches) return;

    // Determine screen position for smart popup alignment
    if (cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect();
      const popupWidth = window.innerWidth > 1024 ? 300 : 260;
      const expansionBuffer = (popupWidth * 1.05 - rect.width) / 2;
      
      if (rect.left < expansionBuffer) setHoverPosition('left');
      else if (window.innerWidth - rect.right < expansionBuffer) setHoverPosition('right');
      else setHoverPosition('center');
    }

    // Set timer for hover effect (existing logic)
    timerRef.current = setTimeout(() => {
      setIsHovered(true);

      // Request stream prefetch when user dwells on the card
      const mediaType = (movie.media_type || (movie.title ? 'movie' : 'tv')) as 'movie' | 'tv';
      const releaseDate = movie.release_date || movie.first_air_date;
      const year = releaseDate ? new Date(releaseDate).getFullYear() : undefined;

      if (year) {
        // prefetch without logging normally to reduce console spam
        prefetchStream(
          movie.title || movie.name || '',
          year,
          String(movie.id),
          mediaType,
          1,
          1
        );
      }
    }, 600); // Increased dwell time to 600ms to prevent accidental triggers while moving across rows
  };

  const handleMouseLeave = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    
    // Save state before closing if player exists
    if (isHovered && playerRef.current && trailerUrl) {
      const currentTime = playerRef.current.getCurrentTime();
      updateVideoState(movie.id, currentTime, trailerUrl);
    }

    setIsHovered(false);
    setTrailerUrl(null);
    setIsMuted(true);
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
  const handleOpenModal = () => {
    const currentTime = playerRef.current?.getCurrentTime() || 0;
    const finalTrailerUrl = trailerUrl || getVideoState(movie.id)?.videoId;
    
    if (finalTrailerUrl) {
      updateVideoState(movie.id, currentTime, finalTrailerUrl);
    }
    onSelect(movie, currentTime, finalTrailerUrl);
  };

  const handleDirectPlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onPlay) {
      const currentTime = playerRef.current?.getCurrentTime() || 0;
      if (trailerUrl) {
        updateVideoState(movie.id, currentTime, trailerUrl);
      }
      onPlay(movie);
    } else {
      handleOpenModal();
    }
  };

  const isBook = ['series', 'comic', 'manga', 'local'].includes(movie.media_type || '');

  // Pre-calculate Image Source safe for Comics
  const imageSrc = (movie.poster_path?.startsWith('http') || movie.backdrop_path?.startsWith('http') || movie.poster_path?.startsWith('comic://') || movie.backdrop_path?.startsWith('comic://'))
    ? (movie.backdrop_path || movie.poster_path)
    : `https://image.tmdb.org/t/p/w500${movie.backdrop_path || movie.poster_path}`;

  return (
    <div
      ref={cardRef}
      className={`relative z-10 
        ${isGrid
          ? 'w-full aspect-video cursor-pointer hover:z-50'
          : 'flex-none w-[calc((100vw-3rem)/2.3)] sm:w-[calc((100vw-3rem)/3.3)] md:w-[calc((100vw-3.5rem)/4.3)] lg:w-[calc((100vw-4rem)/6.6)] aspect-[7/4.32] cursor-pointer hover:z-[100]'
        }`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={() => onSelect(movie)}
    >
      <div className="w-full h-full relative rounded-sm overflow-hidden">
        {/* Base Image */}
        <img
          src={imageSrc}
          className={`w-full h-full object-cover ${isBook ? 'object-[50%_30%]' : 'object-center'}`}
          alt={movie.name || movie.title}
          loading="lazy"
        />

        {/* Base Title Overlay */}
        {!isHovered && (
          <>
            <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex items-end justify-center pb-2 px-2 opacity-100 transition-opacity duration-300">
              {logoUrl ? (
                <img src={logoUrl} alt={movie.title || movie.name} className="h-full max-h-5 w-auto object-contain drop-shadow-md" />
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
      {/* Progress Bar underneath the poster */}
      {!isHovered && <ProgressIndicator movie={movie} getLastWatchedEpisode={getLastWatchedEpisode} getVideoState={getVideoState} />}

      {/* Hover Popup - Active on all views */}
      {isHovered && (
        <div className={`absolute top-[-20px] md:top-[-30px] lg:top-[-45px] z-[100] transition-all duration-400 ease-[cubic-bezier(0.23,1,0.32,1)] ${posClasses.wrapper}`}>
          <div
            className={`w-[220px] md:w-[240px] lg:w-[280px] bg-[#141414] rounded-md shadow-[0_20px_50px_rgba(0,0,0,0.8),0_10px_20px_rgba(0,0,0,0.6)] scale-[1.05] overflow-hidden transition-all duration-400 ease-[cubic-bezier(0.23,1,0.32,1)] ring-1 ring-zinc-700/50 ${posClasses.inner}`}
            onClick={(e) => e.stopPropagation()} // Prevent click from bubbling to base card
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
                        // No start offset - seamless playback
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
                    onEnd={(e) => {
                      // Seamless loop from start
                      e.target.seekTo(0);
                      e.target.playVideo();
                    }}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <img
                  src={imageSrc}
                  className={`w-full h-full object-cover ${isBook ? 'object-[50%_30%]' : 'object-center'}`}
                  alt="preview"
                />
              )}

              {/* Mute Button - Hide for books */}
              {trailerUrl && !isBook && (
                <button
                  onClick={(e) => { e.stopPropagation(); setIsMuted(!isMuted); }}
                  className="absolute bottom-4 right-4 w-8 h-8 rounded-full border border-white/30 bg-black/50 hover:bg-white/10 flex items-center justify-center transition"
                >
                  {isMuted ? <SpeakerSlashIcon size={12} className="text-white" /> : <SpeakerHighIcon size={12} className="text-white" />}
                </button>
              )}

              <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[#181818] to-transparent z-10" />

              <div className="absolute bottom-3 left-4 right-12 pointer-events-none z-20">
                {logoUrl ? (
                  <img src={logoUrl} alt="title logo" className="h-8 md:h-10 w-auto object-contain origin-bottom-left drop-shadow-md" />
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
                  {/* Play/Read Button */}
                  <button
                    onClick={handleDirectPlay}
                    className="bg-white text-black rounded-full w-8 h-8 md:w-9 md:h-9 flex items-center justify-center hover:bg-neutral-200 transition active:scale-95"
                    title={isBook ? "Read Now" : "Play"}
                  >
                    {isBook ? <BookOpenIcon size={18} weight="fill" /> : <PlayIcon size={22} weight="fill" className="ml-0.5" />}
                  </button>
                  {/* Add to List */}
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleList(movie); }}
                    className="border-2 border-gray-500 bg-[#2a2a2a]/80 rounded-full w-8 h-8 md:w-9 md:h-9 flex items-center justify-center text-white hover:border-white transition"
                    title="Add to My List"
                  >
                    {isAdded ? <CheckIcon size={16} weight="bold" /> : <PlusIcon size={16} weight="bold" />}
                  </button>
                  {/* Rate / Thumbs Up */}
                  <button
                    onClick={(e) => { e.stopPropagation(); rateMovie(movie, 'like'); }}
                    className={`border-2 rounded-full w-8 h-8 md:w-9 md:h-9 flex items-center justify-center transition active:scale-95 ${getMovieRating(movie.id) === 'like' ? 'bg-white text-black border-white' : 'bg-[#2a2a2a]/80 text-white border-gray-500 hover:border-white'}`}
                    title="Rate"
                  >
                    <ThumbsUpIcon size={16} weight={getMovieRating(movie.id) === 'like' ? "fill" : "bold"} />
                  </button>
                </div>

                {/* More Info - Chevron Down */}
                <button
                  onClick={handleOpenModal}
                  className="border-2 border-gray-500 bg-[#2a2a2a]/80 rounded-full w-8 h-8 md:w-9 md:h-9 flex items-center justify-center hover:border-white transition text-white"
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