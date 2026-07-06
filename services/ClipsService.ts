/**
 * services/ClipsService.ts
 * ────────────────────────
 * Real content source for the Clips feed (a vertical, TikTok-style trailer
 * feed reached from the mobile bottom nav). Reuses the exact same trailer
 * resolution pipeline as everywhere else in the app (services/YouTubeService.ts
 * + hooks/useTrailer.ts's preloadTrailer) — Clips doesn't invent a new video
 * source, it just plays real trailers full-screen instead of on a hover card.
 *
 * fetchData() already applies kids-mode filtering globally (see services/tmdb.ts),
 * so Clips content is automatically kid-safe when a Kids profile is active.
 */
import { fetchData, getMovieVideos } from './tmdb';
import { REQUESTS } from '../constants';
import { Movie } from '../types';
import { SHADOW_BANNED_IDS } from '../constants';
import { searchClip, getVideoAspect } from './YouTubeService';
import { preloadTrailer } from '../hooks/useTrailer';

const MIN_VOTE_COUNT = 20;

const withPage = (url: string, page: number): string => {
  if (page <= 1) return url;
  return url.includes('page=')
    ? url.replace(/page=\d+/, `page=${page}`)
    : `${url}${url.includes('?') ? '&' : '?'}page=${page}`;
};

/** Fetches one page of Clips-eligible titles: real backdrop, enough votes, not shadow-banned. */
export const fetchClipsPage = async (page: number, seenIds: Set<number>): Promise<Movie[]> => {
  const results = await fetchData(withPage(REQUESTS.fetchTrending, page));
  if (!results) return [];

  return (results as Movie[]).filter((m) => {
    const id = Number(m.id);
    return (
      !!m.backdrop_path &&
      !seenIds.has(id) &&
      !SHADOW_BANNED_IDS.has(id) &&
      (!m.vote_count || m.vote_count >= MIN_VOTE_COUNT)
    );
  });
};

/** Gathers a shuffled starter batch of Clips titles across a few pages. */
export const fetchClipsBatch = async (pageCount: number = 3): Promise<Movie[]> => {
  const seenIds = new Set<number>();
  const gathered: Movie[] = [];

  for (let page = 1; page <= pageCount; page++) {
    const batch = await fetchClipsPage(page, seenIds);
    for (const m of batch) {
      const id = Number(m.id);
      if (!seenIds.has(id)) {
        seenIds.add(id);
        gathered.push(m);
      }
    }
  }

  // Fisher-Yates shuffle — Clips is a discovery feed, not a ranked list.
  for (let i = gathered.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [gathered[i], gathered[j]] = [gathered[j], gathered[i]];
  }
  return gathered;
};

// ─── Feed warm-up ─────────────────────────────────────────────────────────────
// The starter batch is cached at module level and shared between the idle-time
// warm-up (NavbarMobile) and ClipsPage itself — so by the time the user taps
// the Clips tab, the titles AND the first few clip videos are already resolved
// and the feed paints instantly.

let _feedPromise: Promise<Movie[]> | null = null;

/** The session's starter feed — fetched once, shared by warm-up and the page. */
export const getClipsFeed = (): Promise<Movie[]> => {
  if (!_feedPromise) _feedPromise = fetchClipsBatch(3);
  return _feedPromise;
};

/** Idle-time warm-up: fetch the starter batch and pre-resolve the first clips. */
export const warmClipsFeed = async (): Promise<void> => {
  try {
    const feed = await getClipsFeed();
    // Resolve the first few slides' videos so slide 1 plays immediately.
    await Promise.all(feed.slice(0, 3).map(m => resolveClip(m)));
  } catch { /* warm-up is best-effort */ }
};

// ─── Clip video resolution ────────────────────────────────────────────────────
// Priority chain for what actually PLAYS on each slide:
//   1. TMDB's typed videos — real "Clip" / "Behind the Scenes" / "Featurette" /
//      "Bloopers" entries curated per title (free, exact, no search guessing).
//   2. Clip-tuned YouTube search (searchClip — scores FOR "clip"/"scene"/BTS,
//      unlike the trailer scorer which penalizes them).
//   3. The regular trailer pipeline, so a slide is never dead.

export interface ClipResult {
  videoId: string;
  /** Where the video came from — 'clip' means real scene/BTS footage. */
  kind: 'clip' | 'trailer';
  /** Real width/height ratio of the source video — drives the full-bleed
   * crop math (see ClipCard). <1 means a genuinely vertical source, which
   * needs little to no crop instead of the ~16:9 zoom horizontal sources do. */
  aspect: number;
}

// TMDB video types that count as real clip content, best-first.
const TMDB_CLIP_TYPES = ['Clip', 'Behind the Scenes', 'Featurette', 'Bloopers'];
const VERTICAL_ASPECT_THRESHOLD = 0.85;

const clipCache: Record<string, ClipResult | null> = {};
const clipInFlight: Record<string, Promise<ClipResult | null>> = {};

export const resolveClip = async (movie: Movie | null): Promise<ClipResult | null> => {
  if (!movie) return null;
  const key = String(movie.id);
  if (key in clipCache) return clipCache[key];
  if (key in clipInFlight) return clipInFlight[key];

  const promise = (async (): Promise<ClipResult | null> => {
    const type = (movie.media_type || (movie.title ? 'movie' : 'tv')) as 'movie' | 'tv';

    // 1. TMDB typed videos
    try {
      const data = await getMovieVideos(movie.id, type);
      const videos = (data?.results || []).filter((v: any) => v.site === 'YouTube' && v.key);
      for (const clipType of TMDB_CLIP_TYPES) {
        const ofType = videos.filter((v: any) => v.type === clipType);
        if (ofType.length === 0) continue;

        // TMDB entries are already curated/official — among ties of the same
        // type, prefer a genuinely vertical one (fills the screen natively)
        // over the usual first-official-else-first pick.
        const candidates = ofType.filter((v: any) => v.official).length > 0
          ? ofType.filter((v: any) => v.official)
          : ofType.slice(0, 3);
        const aspects = await Promise.all(candidates.map((v: any) => getVideoAspect(v.key)));
        const verticalIdx = aspects.findIndex(a => a < VERTICAL_ASPECT_THRESHOLD);
        const chosenIdx = verticalIdx >= 0 ? verticalIdx : 0;
        return { videoId: candidates[chosenIdx].key, kind: 'clip', aspect: aspects[chosenIdx] };
      }
    } catch (e) {
      console.warn(`[Clips] TMDB videos failed for ${movie.id}:`, e);
    }

    // 2. Clip-tuned YouTube search (already prefers a vertical match among
    // quality-passing candidates internally — see YouTubeService.searchClip)
    const title = movie.original_title || movie.original_name || movie.title || movie.name || '';
    const year = (movie.release_date || movie.first_air_date || '').slice(0, 4);
    if (title) {
      try {
        const videoId = await searchClip({ title, year, type, tmdbId: String(movie.id) });
        if (videoId) {
          const aspect = await getVideoAspect(videoId);
          return { videoId, kind: 'clip', aspect };
        }
      } catch (e) {
        console.warn(`[Clips] YouTube clip search failed for ${title}:`, e);
      }
    }

    // 3. Trailer fallback — the feed never shows a dead slide. Direct-URL
    // premium overrides are always standard horizontal footage, so skip the
    // wasted oEmbed round-trip and just use the 16:9 default for those.
    const trailer = await preloadTrailer(movie);
    if (!trailer) return null;
    const aspect = trailer.isDirect ? 16 / 9 : await getVideoAspect(trailer.videoId);
    return { videoId: trailer.videoId, kind: 'trailer', aspect };
  })();

  clipInFlight[key] = promise;
  const result = await promise;
  clipCache[key] = result;
  delete clipInFlight[key];
  return result;
};
