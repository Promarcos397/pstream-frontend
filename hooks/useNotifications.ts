import { useState, useEffect, useCallback } from 'react';
import { fetchData } from '../services/tmdb';
import { REQUESTS, BASE_URL } from '../constants';
import { Movie } from '../types';
import { useProfileStore } from '../store/useProfileStore';

export interface AppNotification {
  id: string;
  movie: Movie;
  headline: string;
  body: string;
  /** ISO date the notification is anchored to (release date). */
  date: string;
}

const MAX_ITEMS = 24;
const MIN_VOTE_COUNT = 5;
const WINDOW_DAYS = 14;

/** "3 days ago" / "Today" — used by both the mobile feed page and the desktop dropdown. */
export const formatRelativeTime = (iso: string): string => {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return 'Today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
};

// ─── Rolling-window bucketing ──────────────────────────────────────────────────
// The feed is anchored to real release dates in the trailing 14 days, not a
// "trending" score that reshuffles hour to hour. The cache key is just
// today's date, so the list is stable all day (a title a user has read stays
// read against the *same* list) and only grows/shifts once per day as the
// window rolls forward — never a random reshuffle mid-session.

const getFeedWindow = (d: Date): { key: string; start: Date; end: Date } => {
  const end = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (WINDOW_DAYS - 1));
  return { key: fmt(end), start, end };
};

function fmt(d: Date) { return d.toISOString().slice(0, 10); }

// ─── Per-profile read-state ────────────────────────────────────────────────────

const readKeyFor = (profileId: string | null) => `pstream-notifications-read:${profileId ?? 'default'}`;

const loadReadIds = (profileId: string | null): Set<string> => {
  try {
    const raw = localStorage.getItem(readKeyFor(profileId));
    if (raw) return new Set(JSON.parse(raw));
  } catch { }
  return new Set();
};

const saveReadIds = (profileId: string | null, ids: Set<string>) => {
  try { localStorage.setItem(readKeyFor(profileId), JSON.stringify([...ids])); } catch { }
};

// ─── Feed: real releases within the trailing 14 days ──────────────────────────
// Module-level cache keyed by today's date — shared between the bell badge
// and the feed page, and naturally invalidates itself once a day.

let feedCache: { key: string; items: AppNotification[] } | null = null;
let feedPromise: Promise<AppNotification[]> | null = null;

const discover = (type: 'movie' | 'tv', gte: string, lte: string, page: number) =>
  fetchData(
    REQUESTS._build(`${BASE_URL}/discover/${type}`, {
      sort_by: 'popularity.desc',
      page,
      [type === 'movie' ? 'primary_release_date.gte' : 'first_air_date.gte']: gte,
      [type === 'movie' ? 'primary_release_date.lte' : 'first_air_date.lte']: lte,
      'vote_count.gte': MIN_VOTE_COUNT,
    })
  );

const buildFeed = async (): Promise<AppNotification[]> => {
  const { start, end } = getFeedWindow(new Date());
  const gte = fmt(start);
  const lte = fmt(end);

  // Two pages each, movies + TV, all in parallel — a wider net than a single
  // page so a real 14-day window doesn't come back looking sparse.
  const [m1, m2, t1, t2] = await Promise.all([
    discover('movie', gte, lte, 1),
    discover('movie', gte, lte, 2),
    discover('tv', gte, lte, 1),
    discover('tv', gte, lte, 2),
  ]);

  const seen = new Set<number>();
  const items: AppNotification[] = [];
  for (const m of [...(m1 || []), ...(m2 || []), ...(t1 || []), ...(t2 || [])] as Movie[]) {
    const id = Number(m.id);
    if (seen.has(id) || !m.backdrop_path) continue;
    const dateStr = m.release_date || m.first_air_date;
    if (!dateStr) continue;
    seen.add(id);
    items.push({
      id: `new-${id}`,
      movie: m,
      headline: m.title ? 'New movie' : 'New series',
      body: m.title || m.name || '',
      date: dateStr,
    });
  }

  return items
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, MAX_ITEMS);
};

const getFeed = (): Promise<AppNotification[]> => {
  const { key } = getFeedWindow(new Date());
  if (feedCache && feedCache.key === key) return Promise.resolve(feedCache.items);
  if (!feedPromise) {
    feedPromise = buildFeed().then(items => {
      feedCache = { key, items };
      feedPromise = null;
      return items;
    });
  }
  return feedPromise;
};

/** Notification feed + unread tracking, shared between the bell badge and the feed page. */
export const useNotifications = () => {
  const activeProfileId = useProfileStore(s => s.activeProfileId);
  const { key: windowKey } = getFeedWindow(new Date());

  const [items, setItems] = useState<AppNotification[]>(feedCache?.key === windowKey ? feedCache.items : []);
  const [readIds, setReadIds] = useState<Set<string>>(() => loadReadIds(activeProfileId));
  const [isLoading, setIsLoading] = useState(feedCache?.key !== windowKey);

  useEffect(() => {
    let mounted = true;
    getFeed().then(feed => {
      if (!mounted) return;
      setItems(feed);
      setIsLoading(false);
    });
    return () => { mounted = false; };
  }, [windowKey]);

  // Re-load read-state whenever the active profile changes — each profile
  // tracks its own read/unread notifications, like Netflix profiles do.
  useEffect(() => {
    setReadIds(loadReadIds(activeProfileId));
  }, [activeProfileId]);

  const markRead = useCallback((id: string) => {
    setReadIds(prev => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      saveReadIds(activeProfileId, next);
      return next;
    });
  }, [activeProfileId]);

  const unreadCount = items.filter(n => !readIds.has(n.id)).length;

  return { items, readIds, markRead, unreadCount, isLoading };
};
