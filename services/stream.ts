/**
 * services/stream.ts
 * ───────────────────
 * Giga Backend stream resolution — moved out of api.ts.
 * Handles the main stream fetch and torrent fallback URL builder.
 */

import axios from 'axios';

const GIGA_URL = (import.meta as any).env?.VITE_GIGA_BACKEND_URL || 'https://ibrahimar397-pstream-giga.hf.space';

export const getStream = async (
  title:     string,
  type:      'movie' | 'tv',
  year?:     number,
  season:    number = 1,
  episode:   number = 1,
  tmdbId?:   string,
  imdbId?:   string,
  bustCache = false,
) => {
  const params = new URLSearchParams({
    tmdbId:  tmdbId  || '',
    type,
    season:  season.toString(),
    episode: episode.toString(),
    imdbId:  imdbId  || '',
    title:   title   || '',
    year:    year ? year.toString() : '',
  });
  if (bustCache) params.set('force', '1');

  const label = bustCache
    ? '[Stream] 🔥 Force-fresh (busting Redis)...'
    : '[Stream] Requesting via Giga Backend...';
  console.log(label);

  const { data } = await axios.get(`${GIGA_URL}/api/stream?${params}`, {
    timeout: 50000,
  });
  return data;
};

/**
 * Build a torrent GET stream URL for use as a native video src.
 * Requires an auth token (JWT from AuthService.getToken()).
 */
export function buildTorrentStreamUrl(opts: {
  infoHash: string;
  imdbId?:  string;
  type?:    'movie' | 'tv';
  season?:  number;
  episode?: number;
  fileIdx?: number;
  token:    string;
}): string {
  const p = new URLSearchParams({
    infoHash: opts.infoHash,
    token:    opts.token,
  });
  if (opts.imdbId)  p.set('imdbId',  opts.imdbId);
  if (opts.type)    p.set('type',    opts.type);
  if (opts.season)  p.set('season',  String(opts.season));
  if (opts.episode) p.set('episode', String(opts.episode));
  if (opts.fileIdx != null) p.set('fileIdx', String(opts.fileIdx));
  return `${GIGA_URL}/api/torrent/stream?${p}`;
}
