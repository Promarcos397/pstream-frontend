/**
 * usePrefetchQueue — Smart Prefetch Hook
 *
 * Triggers warm prefetches for the user's recent history and watchlist
 * after the app has fully loaded (5s delay to avoid blocking initial render).
 *
 * Schedule:
 * - 5s after mount: warm prefetch last 3 from continueWatching + last 3 from myList
 * - On InfoModal open: HOT prefetch (called by InfoModal directly via prefetchStream)
 *
 * Warm prefetch = just wakes HF Space + primes Redis. Does NOT store URLs locally.
 * Hot prefetch = stores in local streamCache for 4min for instant play.
 */
import { useEffect, useRef } from 'react';
import { Movie } from '../types';
import { schedulePrefetchQueue } from '../services/api';

interface UsePrefetchQueueOptions {
  continueWatching: Movie[];
  myList: Movie[];
  isReady: boolean; // only fire after auth/profile is loaded
}

export function usePrefetchQueue({ continueWatching, myList, isReady }: UsePrefetchQueueOptions) {
  const hasFiredRef = useRef(false);

  useEffect(() => {
    if (!isReady || hasFiredRef.current) return;

    // Wait 5 seconds after mount before firing to not compete with the initial render
    const timer = setTimeout(() => {
      hasFiredRef.current = true;

      // Build the queue: last 3 watched + last 3 in list (most recent first)
      const recentWatched = [...continueWatching].reverse().slice(0, 3);
      const recentList = [...myList].reverse().slice(0, 3);

      // Deduplicate by tmdbId (in case user has same item in both)
      const seen = new Set<string>();
      const queue = [...recentWatched, ...recentList]
        .filter(m => {
          const id = String(m.id);
          if (seen.has(id)) return false;
          seen.add(id);
          return true;
        })
        .map(m => ({
          tmdbId: String(m.id),
          type: (m.media_type || (m.first_air_date ? 'tv' : 'movie')) as 'movie' | 'tv',
          title: m.title || m.name || '',
          year: m.release_date
            ? parseInt(m.release_date.slice(0, 4))
            : m.first_air_date
            ? parseInt(m.first_air_date.slice(0, 4))
            : undefined,
        }));

      if (queue.length > 0) {
        schedulePrefetchQueue(queue, 6);
      }
    }, 5000);

    return () => clearTimeout(timer);
  }, [isReady, continueWatching, myList]);
}
