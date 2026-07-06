import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  SpeakerHighIcon, SpeakerXIcon, PlusIcon, CheckIcon,
  ShareNetworkIcon, PlayIcon,
} from '@phosphor-icons/react';
import { Movie } from '../types';
import { useGlobalContext } from '../context/GlobalContext';
import { useUIStore } from '../store/useUIStore';
import { TrailerPlayer } from './TrailerPlayer';
import { resolveClip } from '../services/ClipsService';
import { MaturityBadge } from './MovieCardBadges';
import { GENRES } from '../data/genres';
import { getOptimizedImageUrl } from '../utils/deviceHelper';
import { useTitleLogo } from '../hooks/useTitleLogo';
import ShareSheet from './ShareSheet';

interface ClipCardProps {
  movie: Movie;
  onSelect: (movie: Movie) => void;
  nextMovie?: Movie | null;
  /** Resolve this slide's clip immediately on mount (first few slides only —
   * the rest resolve just-in-time via the previous slide's nextMovie preload,
   * so a long feed doesn't fire dozens of searches at once). */
  eager?: boolean;
}

/**
 * One full-screen slide of the Clips vertical feed. Autoplays its trailer
 * muted while in view (same TrailerPlayer engine used everywhere else in the
 * app); tapping the video only ever toggles mute — it never pauses, matching
 * the real Clips interaction model. The right-side buttons stay visible as
 * plain icons at rest; any tap on the video briefly reveals their text
 * labels (Sound/My List/Share) together, then they fade back to icon-only.
 */
const ClipCard: React.FC<ClipCardProps> = ({ movie, onSelect, nextMovie, eager = false }) => {
  const { myList, toggleList, globalMute, setGlobalMute } = useGlobalContext();
  const activeVideoId = useUIStore(s => s.activeVideoId);
  const setActiveVideoId = useUIStore(s => s.setActiveVideoId);
  const isAdded = myList.some(m => String(m.id) === String(movie.id));

  const cardRef = useRef<HTMLDivElement>(null);
  const labelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isInView, setIsInView] = useState(false);
  const [isNear, setIsNear] = useState(false);
  const [clipVideoId, setClipVideoId] = useState<string | null>(null);
  const [clipAspect, setClipAspect] = useState(16 / 9);
  const [pct, setPct] = useState(0);
  const [showLabels, setShowLabels] = useState(false);
  const [expandOverview, setExpandOverview] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const myVideoId = `clips-${movie.id}`;
  const isMyVideoActive = activeVideoId === myVideoId;

  const backdropSrc = getOptimizedImageUrl(movie.backdrop_path, 'backdrop', false) || '';
  const posterSrc = getOptimizedImageUrl(movie.poster_path || movie.backdrop_path, 'poster', true) || backdropSrc;
  const titleLogo = useTitleLogo(movie);
  // The info-circle prefers the textless backdrop still — most poster art
  // bakes the title treatment right into the image, which would double up
  // with the real logo art hanging below it.
  const badgeSrc = backdropSrc || posterSrc;

  // Full-bleed center-crop, like Netflix Clips: whatever the source video's
  // real aspect is, it must cover the whole portrait viewport, so the zoom
  // needed depends on both the device's screen ratio AND the source's actual
  // aspect (a horizontal 16:9 clip needs heavy zoom; a genuinely vertical
  // source needs almost none — a fixed factor can't work for both).
  // Derivation: TrailerPlayer renders the iframe at 1.15×zoom of the
  // container, and YouTube letterboxes the video to iframeWidth / aspect
  // tall — so we need 1.15 × zoom × vw / aspect ≥ vh, plus a 4% overscan buffer.
  const clipCrop = useMemo(() => {
    const vw = window.innerWidth || 390;
    const vh = window.innerHeight || 844;
    return Math.max(1.02, ((vh / vw) * clipAspect / 1.15) * 1.04);
  }, [clipAspect]);

  // Resolve this slide's clip before it's on screen: eagerly for the first
  // slides, otherwise once scrolled to (by which point the previous slide's
  // nextMovie preload has usually already cached it — mount is then instant).
  useEffect(() => {
    if (!eager && !isInView && !isNear) return;
    let mounted = true;
    resolveClip(movie).then(result => {
      if (!mounted || !result) return;
      setClipVideoId(result.videoId);
      setClipAspect(result.aspect);
    });
    return () => { mounted = false; };
  }, [movie, eager, isInView, isNear]);

  // ── IntersectionObserver: this slide plays only while it's the majority-visible one ──
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsInView(entry.intersectionRatio >= 0.6),
      { threshold: [0, 0.6, 1] }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // ── Second observer with a generous margin: "near" slides mount their
  // player early (muted, paused by the global coordinator) so the iframe has
  // already booted and buffered by the time the user swipes to them —
  // this is what makes slide transitions feel instant.
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsNear(entry.isIntersecting),
      { rootMargin: '150% 0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (isInView) {
      setActiveVideoId(myVideoId);
      if (nextMovie) resolveClip(nextMovie);
    } else {
      setActiveVideoId(prev => (prev === myVideoId ? null : prev));
      setPct(0);
    }
  }, [isInView, myVideoId, nextMovie, setActiveVideoId]);

  useEffect(() => () => {
    if (labelTimerRef.current) clearTimeout(labelTimerRef.current);
  }, []);

  const handleToggleMute = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setGlobalMute(!globalMute);
    setShowLabels(true);
    if (labelTimerRef.current) clearTimeout(labelTimerRef.current);
    labelTimerRef.current = setTimeout(() => setShowLabels(false), 2600);
  }, [globalMute, setGlobalMute]);

  const tags = (movie.genre_ids || []).slice(0, 3).map(id => GENRES[id]).filter(Boolean);
  const movieTitle = movie.title || movie.name || '';
  const shareUrl = `${window.location.origin}/title/${movie.media_type || (movie.title ? 'movie' : 'tv')}/${movie.id}`;

  return (
    <section
      ref={cardRef}
      className="relative w-full h-dvh shrink-0 snap-start overflow-hidden bg-black"
      onClick={handleToggleMute}
    >
      {/* Player mounts as soon as the slide is NEAR the viewport (preload) —
          the global activeVideoId coordinator keeps it paused until in view. */}
      {(isNear || isInView) && clipVideoId && (
        <TrailerPlayer
          movie={movie}
          variant="clips"
          cropFactor={clipCrop}
          videoIdOverride={clipVideoId}
          initialSeekTime={1}
          onTimeUpdate={(current, duration) => setPct(duration > 0 ? Math.min(100, (current / duration) * 100) : 0)}
        />
      )}

      {/* Backdrop cover — sits ABOVE the player and only fades once playback
          has genuinely started (first time-tick), so there's never a black
          flash or a frozen paused frame from a preloading slide. */}
      {backdropSrc && (
        <img
          src={backdropSrc}
          alt=""
          className={`absolute inset-0 z-[5] w-full h-full object-cover transition-opacity duration-500 pointer-events-none ${isMyVideoActive && pct > 0 ? 'opacity-0' : 'opacity-100'}`}
        />
      )}

      {/* Centered spinner until playback genuinely starts (first time-tick) —
          the backdrop keeps the slide visually full meanwhile, like Netflix */}
      {isInView && pct === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="w-10 h-10 border-[3px] border-white/25 border-t-white rounded-full animate-spin" />
        </div>
      )}

      {/* Scrim for text legibility */}
      <div className="absolute inset-x-0 bottom-0 h-[45%] bg-gradient-to-t from-black/85 via-black/35 to-transparent pointer-events-none" />

      {/* Maturity badge, top-right */}
      <div className="absolute top-[calc(14px+env(safe-area-inset-top))] right-4 z-10 pointer-events-none drop-shadow-md">
        <MaturityBadge adult={movie.adult} voteAverage={movie.vote_average} certification={(movie as any).certification} size="xs" />
      </div>

      {/* Right-side control stack — plain circles at rest; any tap on the
          video seamlessly stretches each into a horizontal pill (icon only,
          no text inside) and fades in its plain-text label underneath —
          no background behind the label, matching Netflix's own Clips UI. */}
      <div className={`absolute right-3 bottom-[calc(210px+env(safe-area-inset-bottom))] z-20 flex flex-col items-center transition-[gap] duration-300 ease-[cubic-bezier(0.34,1.35,0.64,1)] ${showLabels ? 'gap-6' : 'gap-2'}`}>
        <button onClick={handleToggleMute} className="flex flex-col items-center gap-1.5">
          <div className={`h-[54px] rounded-full bg-[#4d4d4d]/20 backdrop-blur-sm text-white flex items-center justify-center active:scale-90 transition-[width] duration-300 ease-[cubic-bezier(0.34,1.35,0.64,1)] ${showLabels ? 'w-[68px]' : 'w-[54px]'}`}>
            {globalMute ? <SpeakerXIcon size={22} /> : <SpeakerHighIcon size={22} weight="fill" />}
          </div>
          <span className={`text-white text-[13px] font-medium drop-shadow-md transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.34,1.35,0.64,1)] ${showLabels ? 'opacity-100 scale-100 delay-150' : 'opacity-0 scale-90'}`}>{globalMute ? 'Muted' : 'Sound'}</span>
        </button>

        <button onClick={(e) => { e.stopPropagation(); toggleList(movie); }} className="flex flex-col items-center gap-1.5">
          <div className={`h-[54px] rounded-full bg-[#4d4d4d]/20 backdrop-blur-sm text-white flex items-center justify-center active:scale-90 transition-[width] duration-300 ease-[cubic-bezier(0.34,1.35,0.64,1)] ${showLabels ? 'w-[68px]' : 'w-[54px]'}`}>
            {isAdded ? <CheckIcon size={22} weight="bold" /> : <PlusIcon size={22} weight="bold" />}
          </div>
          <span className={`text-white text-[13px] font-medium drop-shadow-md transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.34,1.35,0.64,1)] ${showLabels ? 'opacity-100 scale-100 delay-150' : 'opacity-0 scale-90'}`}>My List</span>
        </button>

        <button onClick={(e) => { e.stopPropagation(); setShareOpen(true); }} className="flex flex-col items-center gap-1.5">
          <div className={`h-[54px] rounded-full bg-[#4d4d4d]/20 backdrop-blur-sm text-white flex items-center justify-center active:scale-90 transition-[width] duration-300 ease-[cubic-bezier(0.34,1.35,0.64,1)] ${showLabels ? 'w-[68px]' : 'w-[54px]'}`}>
            <ShareNetworkIcon size={22} />
          </div>
          <span className={`text-white text-[13px] font-medium drop-shadow-md transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.34,1.35,0.64,1)] ${showLabels ? 'opacity-100 scale-100 delay-150' : 'opacity-0 scale-90'}`}>Share</span>
        </button>
      </div>

      {/* Bottom-left info block */}
      <div
        className="absolute left-4 right-28 bottom-[calc(96px+env(safe-area-inset-bottom))] z-20 text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-[28px] font-bold drop-shadow-md mb-1 leading-tight">{movieTitle}</h2>
        {tags.length > 0 && (
          <p className="text-[16px] font-bold text-white/90 mb-2">{tags.join('  •  ')}</p>
        )}
        {movie.overview && (
          <p className={`text-[16px] leading-snug text-white/95 ${expandOverview ? '' : 'line-clamp-1'}`}>
            {movie.overview}{' '}
            {!expandOverview && (
              <button onClick={() => setExpandOverview(true)} className="font-bold underline underline-offset-1">
                more
              </button>
            )}
          </p>
        )}
        <div className="h-[2px] bg-white/25 mt-3 rounded-full overflow-hidden">
          <div className="h-full bg-white" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Circular poster-art badge (Netflix-style boxart circle) → opens the
          title's info modal. Grows slightly during the label-reveal stage
          (same timer as the right-side pills); the title's real TMDB logo
          art hangs off its bottom edge, like Netflix's own Clips UI. */}
      <div className="absolute right-3 bottom-[calc(96px+env(safe-area-inset-bottom))] z-20 flex flex-col items-center">
        <button
          onClick={(e) => { e.stopPropagation(); onSelect(movie); }}
          className={`rounded-full overflow-hidden border-2 border-white/80 shadow-lg active:scale-90 transition-all duration-300 ease-[cubic-bezier(0.34,1.35,0.64,1)] ${showLabels ? 'w-[92px] h-[92px]' : 'w-20 h-20'}`}
          aria-label={`More about ${movieTitle}`}
        >
          {badgeSrc ? (
            <img src={badgeSrc} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-white/10 flex items-center justify-center">
              <PlayIcon size={16} className="text-white" />
            </div>
          )}
        </button>
        {titleLogo && (
          <img
            src={titleLogo}
            alt={movieTitle}
            className="w-12 -mt-1 object-contain drop-shadow-[0_2px_3px_rgba(0,0,0,0.8)] pointer-events-none"
          />
        )}
      </div>

      <ShareSheet
        open={shareOpen}
        title={movieTitle}
        url={shareUrl}
        thumbnailUrl={backdropSrc}
        onClose={() => setShareOpen(false)}
      />
    </section>
  );
};

export default ClipCard;
