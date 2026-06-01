import { Movie, Episode } from '../types';

// Import all 404 cinematic assets natively
import dim1Backdrop from '../assets/404_assets/dim1-backdrop.jpeg';
import dim1Poster from '../assets/404_assets/dim1-poster.jpeg';
import dim1Title from '../assets/404_assets/dim1-title.png';

import dim2Backdrop from '../assets/404_assets/dim2-backdrop.jpeg';
import dim2Poster from '../assets/404_assets/dim2-poster.jpeg';
import dim2Title from '../assets/404_assets/dim2-title.png';

import dim3Backdrop from '../assets/404_assets/dim3-backdrop.jpeg';
import dim3Poster from '../assets/404_assets/dim3-poster.jpeg';
import dim3Title from '../assets/404_assets/dim3-title.png';

import dim4Backdrop from '../assets/404_assets/dim4-backdrop.jpeg';
import dim4Poster from '../assets/404_assets/dim4-poster.jpeg';
import dim4Title from '../assets/404_assets/dim4-title.png';

import dim5Backdrop from '../assets/404_assets/dim5-backdrop.jpeg';
import dim5Poster from '../assets/404_assets/dim5-poster.jpeg';
import dim5Title from '../assets/404_assets/dim5-title.png';

import dim6Backdrop from '../assets/404_assets/dim6-backdrop.jpeg';
import dim6Poster from '../assets/404_assets/dim6-poster.jpeg';
import dim6Title from '../assets/404_assets/dim6-title.png';

export interface DimensionConfig {
  id: string;
  title: string;
  backdrop: string;
  poster: string;
  titleImg: string;
  subtitle: string;
  synopsis: string;
  errorCode: string;
}

export const DIMENSIONS: DimensionConfig[] = [
  {
    id: 'dim1',
    title: '404: The Silicon Void',
    backdrop: dim1Backdrop,
    poster: dim1Poster,
    titleImg: dim1Title,
    subtitle: 'AN ERROR 404 ORIGINAL',
    synopsis: 'Deep inside the motherboard, a glowing red pixel cube falls into a dark vortex, watched by a silhouetted crimson eye peeking from the shadows of a torn canvas.',
    errorCode: 'NSES-404-CUBE'
  },
  {
    id: 'dim2',
    title: '404: Offline Signal',
    backdrop: dim2Backdrop,
    poster: dim2Poster,
    titleImg: dim2Title,
    subtitle: 'AN ERROR 404 ORIGINAL',
    synopsis: 'Row after row of velvet cinema seats sit completely empty. On stage, a broken retro CRT television flickers with color-bars and signal static under a glitchy sky.',
    errorCode: 'NSES-404-SIGNAL'
  },
  {
    id: 'dim3',
    title: '404: Shattered Clues',
    backdrop: dim3Backdrop,
    poster: dim3Poster,
    titleImg: dim3Title,
    subtitle: 'AN ERROR 404 ORIGINAL',
    synopsis: 'A lone detective in a trench coat searches a dark room, tracking a missing web asset that shattered into a thousand shards of glass. Every lead is a broken redirect.',
    errorCode: 'NSES-404-SHATTER'
  },
  {
    id: 'dim4',
    title: '404: Lost Reels',
    backdrop: dim4Backdrop,
    poster: dim4Poster,
    titleImg: dim4Title,
    subtitle: 'AN ERROR 404 ORIGINAL',
    synopsis: 'A massive, breathing grid of forgotten movie reels pulses in high-contrast red. As you search the archive, the celluloid strip snaps, leaving you in the cinematic dark.',
    errorCode: 'NSES-404-REEL'
  },
  {
    id: 'dim5',
    title: '404: The Watcher',
    backdrop: dim5Backdrop,
    poster: dim5Poster,
    titleImg: dim5Title,
    subtitle: 'AN ERROR 404 ORIGINAL',
    synopsis: 'A glowing digital projector beam cuts through a swirling black hole, shining through a shattered lens that stares back like a towering mechanical watcher.',
    errorCode: 'NSES-404-EYE'
  },
  {
    id: 'dim6',
    title: '404: Cosmic Drift',
    backdrop: dim6Backdrop,
    poster: dim6Poster,
    titleImg: dim6Title,
    subtitle: 'AN ERROR 404 ORIGINAL',
    synopsis: 'Adrift in a cosmic cloud, ancient space cables float through a stellar nebula, trying to route packets through a tear in the space-time fabric. Connection timed out.',
    errorCode: 'NSES-404-NEBULA'
  }
];

// Map our custom dimensions to fully compliant Movie objects
export const dimensionsAsMovies: Movie[] = DIMENSIONS.map((dim) => ({
  id: dim.id,
  title: dim.title,
  name: dim.title,
  overview: dim.synopsis,
  backdrop_path: dim.backdrop,
  poster_path: dim.poster,
  image_url: dim.titleImg, // Map titleImg to image_url for logo rendering bypasses
  vote_average: 9.8,
  media_type: 'tv', // Mark as TV series so the episodes view is rendered natively!
  release_date: '2026',
  first_air_date: '2026',
  genre_ids: [878, 53],
  vote_count: 404,
  popularity: 404,
  number_of_seasons: 1
}));

// Generates custom local Episode mock data for a given 404 dimension
export const get404Episodes = (): Episode[] => {
  return DIMENSIONS.map((dim, idx) => ({
    id: 10001 + idx,
    name: dim.title,
    overview: dim.synopsis,
    still_path: dim.backdrop, // Use our gorgeous horizontal backdrops as episode thumbnails!
    episode_number: idx + 1,
    season_number: 1,
    air_date: '2026-05-30',
    vote_average: 9.8,
    runtime: 404
  }));
};
