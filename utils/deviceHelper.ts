/**
 * Device Helper Utilities
 * 
 * Provides robust media-query and screen-state helpers to distinguish
 * between mobile devices (phones/tablets) and touchscreen desktop computers.
 * Provides optimized TMDB image resolution mapping based on the active viewport.
 */

const TMDB_IMG_BASE = 'https://image.tmdb.org/t/p';

/**
 * Returns the optimized TMDB image URL based on screen mode (mobile vs desktop).
 * Slices the request sizes to prevent bandwidth waste on mobile while keeping desktop images crisp.
 */
export const getOptimizedImageUrl = (
  path: string | null | undefined,
  type: 'backdrop' | 'poster' | 'logo',
  isMobile: boolean
): string => {
  if (!path) return '';
  if (
    path.startsWith('http') || 
    path.startsWith('comic:') || 
    path.startsWith('/assets') || 
    path.includes('/404_assets') || 
    path.startsWith('data:')
  ) return path;

  switch (type) {
    case 'backdrop':
      // Desktop backdrops need higher crispness (w1280), mobile screen is small enough for w780
      return `${TMDB_IMG_BASE}/${isMobile ? 'w780' : 'w1280'}${path}`;
    case 'poster':
      // Desktop posters match w500, mobile posters fit perfectly in w342
      return `${TMDB_IMG_BASE}/${isMobile ? 'w342' : 'w500'}${path}`;
    case 'logo':
      // Logos: w300 is plenty on mobile, w500 is used on desktop
      return `${TMDB_IMG_BASE}/${isMobile ? 'w300' : 'w500'}${path}`;
    default:
      return `${TMDB_IMG_BASE}/original${path}`;
  }
};

/**
 * Returns the recommended number of skeleton card items to render depending on the screen mode.
 * Standardizes skeleton grid volumes to avoid layout shifts.
 */
export const getSkeletonCount = (isMobile: boolean): number => {
  return isMobile ? 12 : 24;
};
