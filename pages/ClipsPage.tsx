import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import { Movie } from '../types';
import ClipCard from '../components/ClipCard';
import { getClipsFeed, fetchClipsPage } from '../services/ClipsService';
import { useIsMobile } from '../hooks/useIsMobile';

interface ClipsPageProps {
  onSelectMovie: (movie: Movie, time?: number, videoId?: string) => void;
}

/**
 * Vertical, TikTok-style trailer feed — reached from the mobile bottom nav's
 * "Clips" tab. Real trailers via the same TrailerPlayer/useTrailer pipeline
 * used across the rest of the app; content sourced from services/ClipsService.ts.
 * Mobile-only — Netflix's own Clips is a phone-app feature, and this feed's
 * full-viewport vertical-swipe layout has no sensible desktop equivalent.
 */
const ClipsPage: React.FC<ClipsPageProps> = ({ onSelectMovie }) => {
  const isMobile = useIsMobile(768);
  const [movies, setMovies] = useState<Movie[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const seenIds = useRef<Set<number>>(new Set());
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;
    // Shared session-cached batch — usually already warmed at idle time by
    // NavbarMobile (warmClipsFeed), so this resolves instantly on tab open.
    getClipsFeed().then((batch) => {
      if (!mounted) return;
      batch.forEach(m => seenIds.current.add(Number(m.id)));
      setMovies(batch);
      setPage(3);
      setIsLoading(false);
    });
    return () => { mounted = false; };
  }, []);

  const loadMore = useCallback(async () => {
    if (isFetchingMore) return;
    setIsFetchingMore(true);
    const nextPage = page + 1;
    const batch = await fetchClipsPage(nextPage, seenIds.current);
    batch.forEach(m => seenIds.current.add(Number(m.id)));
    setMovies(prev => [...prev, ...batch]);
    setPage(nextPage);
    setIsFetchingMore(false);
  }, [page, isFetchingMore]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) loadMore(); },
      { rootMargin: '0px 0px 200% 0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

  if (!isMobile) {
    return <Navigate to="/browse" replace />;
  }

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="w-9 h-9 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black overflow-y-scroll snap-y snap-mandatory scrollbar-hide">
      {movies.map((movie, idx) => (
        <ClipCard
          key={`${movie.id}-${idx}`}
          movie={movie}
          onSelect={onSelectMovie}
          nextMovie={movies[idx + 1] || null}
          eager={idx < 3}
        />
      ))}
      <div ref={sentinelRef} className="h-1 w-full" />
    </div>
  );
};

export default ClipsPage;
