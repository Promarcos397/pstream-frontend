import React, { useState, useEffect } from 'react';
import { Play, Plus, Check, House } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { useLibraryStore } from '../store/useLibraryStore';
import { useShallow } from 'zustand/react/shallow';
import { useHeroColor } from '../context/HeroColorContext';
import { GENRES } from '../constants';
import { Movie } from '../types';
import { getMovieImages, getCachedMovieImages } from '../services/api';
// removing tablet and ipad styles and sidebar

interface MobileHeroProps {
  movie: Movie;
  logoUrl?: string | null;
  onSelect: (movie: Movie) => void;
  onPlay: (movie: Movie) => void;
}

const MobileHero: React.FC<MobileHeroProps> = ({ movie, logoUrl, onSelect, onPlay }) => {
  const { t } = useTranslation();
  const myList = useLibraryStore(useShallow(s => s.getListArray()));
  const toggleList = useLibraryStore(s => s.toggleMyList);
  const { setHeroColor } = useHeroColor();
  const isAdded = myList.some(m => String(m.id) === String(movie.id));
  const is404 = typeof movie.id === 'string' && movie.id.startsWith('dim');
  const mediaType = (movie.media_type || (movie.title ? 'movie' : 'tv')) as 'movie' | 'tv';
  
  const isLocalAsset = (path?: string | null) => {
    if (!path) return false;
    return path.startsWith('http') ||
      path.startsWith('comic:') ||
      path.startsWith('/assets') ||
      path.includes('/404_assets') ||
      path.startsWith('data:');
  };

  // Default to standard poster path
  const defaultPoster = isLocalAsset(movie.poster_path)
    ? movie.poster_path!
    : movie.poster_path ? `https://image.tmdb.org/t/p/w780${movie.poster_path}` : '';

  // Default to standard backdrop path for landscape views (tablets/desktops)
  const defaultBackdrop = isLocalAsset(movie.backdrop_path)
    ? movie.backdrop_path!
    : movie.backdrop_path ? `https://image.tmdb.org/t/p/w780${movie.backdrop_path}` : '';

  // Synchronous cache lookup to avoid layout flashes on mount
  const cachedImages = getCachedMovieImages(movie.id, mediaType);
  let initialBg = is404 ? defaultBackdrop : defaultPoster;
  let initialHasBakedText = true;
  let initialLogo = logoUrl || null;

  if (cachedImages && !is404) {
    const isTabletOrDesktop = typeof window !== 'undefined' && window.innerWidth >= 500;
    let textlessPoster = cachedImages.posters?.find((p: any) => p.iso_639_1 === null);
    if (isTabletOrDesktop) {
      if (movie.backdrop_path) {
        initialBg = movie.backdrop_path.startsWith('http')
          ? movie.backdrop_path
          : `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}`;
        initialHasBakedText = false;
      } else if (textlessPoster) {
        initialBg = `https://image.tmdb.org/t/p/w780${textlessPoster.file_path}`;
        initialHasBakedText = false;
      }
    } else {
      if (textlessPoster) {
        initialBg = `https://image.tmdb.org/t/p/w780${textlessPoster.file_path}`;
        initialHasBakedText = false;
      } else if (movie.backdrop_path) {
        initialBg = movie.backdrop_path.startsWith('http')
          ? movie.backdrop_path
          : `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}`;
        initialHasBakedText = false;
      }
    }

    if (!logoUrl && cachedImages.logos && cachedImages.logos.length > 0) {
      const logoObj = cachedImages.logos.find((l: any) => l.iso_639_1 === 'en' || l.iso_639_1 === null);
      if (logoObj) {
        initialLogo = `https://image.tmdb.org/t/p/w500${logoObj.file_path}`;
      }
    }
  }

  const [localLogoUrl, setLocalLogoUrl] = useState<string | null>(initialLogo);
  const [isHighResLoaded, setIsHighResLoaded] = useState<boolean>(!!cachedImages);
  const [isLogoLoaded, setIsLogoLoaded] = useState<boolean>(!!initialLogo);
  const [bgImageSrc, setBgImageSrc] = useState<string>(initialBg);
  const [fallbackBg, setFallbackBg] = useState<string>(initialBg);
  const [hasBakedInText, setHasBakedInText] = useState<boolean>(initialHasBakedText);
  const [logoImgFailed, setLogoImgFailed] = useState<boolean>(false);
  const [accentRGB, setAccentRGB] = useState<{r:number;g:number;b:number} | null>(null);

  // 1. Dynamic Hero Image Selection, Parallel Preloading & Logo Fetching
  useEffect(() => {
    let isMounted = true;
    
    // Synchronous cache lookup for the new movie ID
    const cachedImages = getCachedMovieImages(movie.id, mediaType);
    let resolvedBg = is404 ? defaultBackdrop : defaultPoster;
    let bakedInText = true;
    let resolvedLogo = logoUrl || null;

    if (cachedImages && !is404) {
      const isTabletOrDesktop = typeof window !== 'undefined' && window.innerWidth >= 500;
      let textlessPoster = cachedImages.posters?.find((p: any) => p.iso_639_1 === null);
      if (isTabletOrDesktop) {
        if (movie.backdrop_path) {
          resolvedBg = movie.backdrop_path.startsWith('http')
            ? movie.backdrop_path
            : `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}`;
          bakedInText = false;
        } else if (textlessPoster) {
          resolvedBg = `https://image.tmdb.org/t/p/w780${textlessPoster.file_path}`;
          bakedInText = false;
        }
      } else {
        if (textlessPoster) {
          resolvedBg = `https://image.tmdb.org/t/p/w780${textlessPoster.file_path}`;
          bakedInText = false;
        } else if (movie.backdrop_path) {
          resolvedBg = movie.backdrop_path.startsWith('http')
            ? movie.backdrop_path
            : `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}`;
          bakedInText = false;
        }
      }

      if (!logoUrl && cachedImages.logos && cachedImages.logos.length > 0) {
        const logoObj = cachedImages.logos.find((l: any) => l.iso_639_1 === 'en' || l.iso_639_1 === null);
        if (logoObj) {
          resolvedLogo = `https://image.tmdb.org/t/p/w500${logoObj.file_path}`;
        }
      }
    }

    setLocalLogoUrl(resolvedLogo);
    setBgImageSrc(resolvedBg);
    setFallbackBg(resolvedBg);
    setIsHighResLoaded(!!cachedImages);
    setIsLogoLoaded(!!resolvedLogo);
    setHasBakedInText(bakedInText);
    setLogoImgFailed(false);

    const loadHeroAssets = async () => {
      try {
        const is404 = typeof movie.id === 'string' && movie.id.startsWith('dim');
        if (is404) {
          if (!isMounted) return;
          if (logoUrl) {
            setLocalLogoUrl(logoUrl);
            setIsLogoLoaded(true);
          } else if (movie.image_url) {
            setLocalLogoUrl(movie.image_url);
            setIsLogoLoaded(true);
          }
          const resolvedBg = movie.backdrop_path || movie.poster_path || '';
          setBgImageSrc(resolvedBg);
          setIsHighResLoaded(true);
          setHasBakedInText(false);
          return;
        }

        const mediaType = (movie.media_type || (movie.title ? 'movie' : 'tv')) as 'movie' | 'tv';
        const data = await getMovieImages(String(movie.id), mediaType);
        
        if (!isMounted) return;

        let resolvedBg = '';
        let bakedInText = true;

        const isTabletOrDesktop = typeof window !== 'undefined' && window.innerWidth >= 500;

        if (data) {
          if (isTabletOrDesktop) {
            // A. Tablet: Prioritize landscape cinematic backdrop path for the wide landscape card
            if (movie.backdrop_path) {
              resolvedBg = movie.backdrop_path.startsWith('http')
                ? movie.backdrop_path
                : `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}`;
              bakedInText = false;
            } else if (data.posters && data.posters.length > 0) {
              const textless = data.posters.find((p: any) => p.iso_639_1 === null);
              if (textless) {
                resolvedBg = `https://image.tmdb.org/t/p/w780${textless.file_path}`;
                bakedInText = false;
              }
            }
          } else {
            // B. Mobile: Prioritize textless poster (iso_639_1 === null) for the portrait card
            if (data.posters && data.posters.length > 0) {
              const textless = data.posters.find((p: any) => p.iso_639_1 === null);
              if (textless) {
                resolvedBg = `https://image.tmdb.org/t/p/w780${textless.file_path}`;
                bakedInText = false;
              }
            }

            // Fallback to backdrop on mobile if no textless poster is found
            if (!resolvedBg && movie.backdrop_path) {
              resolvedBg = movie.backdrop_path.startsWith('http')
                ? movie.backdrop_path
                : `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}`;
              bakedInText = false;
            }
          }

          // C. Logo preloading
          if (!logoUrl && data.logos && data.logos.length > 0) {
            const logoObj = data.logos.find((l: any) => l.iso_639_1 === 'en' || l.iso_639_1 === null);
            if (logoObj) {
              const resolvedLogo = `https://image.tmdb.org/t/p/w500${logoObj.file_path}`;
              const logoLoader = new Image();
              logoLoader.src = resolvedLogo;
              logoLoader.onload = () => {
                if (isMounted) {
                  setLocalLogoUrl(resolvedLogo);
                  setIsLogoLoaded(true);
                }
              };
              logoLoader.onerror = () => {
                if (isMounted) {
                  setLocalLogoUrl(resolvedLogo);
                  setIsLogoLoaded(true);
                }
              };
            }
          }
        }

        // Fallback backdrop selection if api failed or returned nothing
        if (!resolvedBg && movie.backdrop_path) {
          resolvedBg = movie.backdrop_path.startsWith('http')
            ? movie.backdrop_path
            : `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}`;
          bakedInText = false;
        }

        // D. High-res background image parallel preloading (avoid frame flash)
        if (resolvedBg) {
          const imgLoader = new Image();
          imgLoader.crossOrigin = 'anonymous';
          imgLoader.src = resolvedBg.includes('?') ? `${resolvedBg}&cors=true` : `${resolvedBg}?cors=true`;
          
          imgLoader.onload = () => {
            if (isMounted) {
              setBgImageSrc(resolvedBg);
              setIsHighResLoaded(true);
              setHasBakedInText(bakedInText);
            }
          };
          imgLoader.onerror = () => {
            if (isMounted) {
              setBgImageSrc(resolvedBg);
              setIsHighResLoaded(true);
              setHasBakedInText(bakedInText);
            }
          };
        } else {
          // If no high-res background is possible, trigger loaded on defaultPoster
          setIsHighResLoaded(true);
        }
      } catch (e) {
        console.error('Failed loading mobile hero assets:', e);
        setIsHighResLoaded(true);
      }
    };

    loadHeroAssets();

    return () => {
      isMounted = false;
    };
  }, [movie.id, logoUrl, defaultPoster, defaultBackdrop]);

  // 2. Dynamic Dominant Accent Color Extraction via HTML5 Canvas
  useEffect(() => {
    if (!bgImageSrc) {
      setAccentRGB(null);
      setHeroColor(null);
      return;
    }

    let isMounted = true;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = bgImageSrc.includes('?') ? `${bgImageSrc}&cors=true` : `${bgImageSrc}?cors=true`;
    img.onload = () => {
      if (!isMounted) return;
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Sample at 16x16 for richer color data
        canvas.width = 16;
        canvas.height = 16;
        ctx.drawImage(img, 0, 0, 16, 16);

        const imgData = ctx.getImageData(0, 0, 16, 16).data;
        let r = 0, g = 0, b = 0, count = 0;
        let maxSat = 0, vibR = 0, vibG = 0, vibB = 0;

        for (let i = 0; i < imgData.length; i += 4) {
          const pixelR = imgData[i] ?? 0;
          const pixelG = imgData[i + 1] ?? 0;
          const pixelB = imgData[i + 2] ?? 0;
          const pixelA = imgData[i + 3] ?? 0;

          if (pixelA > 180) {
            const brightness = (pixelR * 299 + pixelG * 587 + pixelB * 114) / 1000;
            if (brightness > 25 && brightness < 230) {
              r += pixelR;
              g += pixelG;
              b += pixelB;
              count++;

              // Track most saturated pixel for vibrant overlay
              const max = Math.max(pixelR, pixelG, pixelB);
              const min = Math.min(pixelR, pixelG, pixelB);
              const sat = max === 0 ? 0 : (max - min) / max;
              if (sat > maxSat) {
                maxSat = sat;
                vibR = pixelR;
                vibG = pixelG;
                vibB = pixelB;
              }
            }
          }
        }

        if (count > 0) {
          let avgR = Math.round(r / count);
          let avgG = Math.round(g / count);
          let avgB = Math.round(b / count);

          // Boost saturation aggressively: 45% average + 55% most vibrant pixel
          avgR = Math.min(255, Math.round(avgR * 0.45 + vibR * 0.55));
          avgG = Math.min(255, Math.round(avgG * 0.45 + vibG * 0.55));
          avgB = Math.min(255, Math.round(avgB * 0.45 + vibB * 0.55));

          // Extra saturation punch: push the dominant channel higher
          const maxCh = Math.max(avgR, avgG, avgB);
          const boostFactor = maxCh > 60 ? 1.15 : 1.0;
          avgR = Math.min(255, Math.round(avgR * (avgR === maxCh ? boostFactor : 1)));
          avgG = Math.min(255, Math.round(avgG * (avgG === maxCh ? boostFactor : 1)));
          avgB = Math.min(255, Math.round(avgB * (avgB === maxCh ? boostFactor : 1)));

          // Luminance floor: AMOLED screens render anything below ~50 as indistinguishable
          // from pure black, so we scale the color up while preserving its hue.
          const lum = (avgR * 299 + avgG * 587 + avgB * 114) / 1000;
          if (lum < 55) {
            const scale = 55 / Math.max(lum, 1);
            avgR = Math.min(255, Math.round(avgR * scale));
            avgG = Math.min(255, Math.round(avgG * scale));
            avgB = Math.min(255, Math.round(avgB * scale));
          }

          setAccentRGB({ r: avgR, g: avgG, b: avgB });
          setHeroColor(`${avgR},${avgG},${avgB}`);
        } else {
          let fallbackR = 0, fallbackG = 0, fallbackB = 0;
          const total = imgData.length / 4;
          for (let i = 0; i < imgData.length; i += 4) {
            fallbackR += imgData[i] ?? 0;
            fallbackG += imgData[i + 1] ?? 0;
            fallbackB += imgData[i + 2] ?? 0;
          }
          const fr = Math.round(fallbackR / total);
          const fg = Math.round(fallbackG / total);
          const fb = Math.round(fallbackB / total);
          setAccentRGB({ r: fr, g: fg, b: fb });
          setHeroColor(`${fr},${fg},${fb}`);
        }
      } catch {
        setAccentRGB({ r: 80, g: 80, b: 120 });
        setHeroColor('80,80,120');
      }
    };
    img.onerror = () => {
      if (isMounted) {
        setAccentRGB({ r: 80, g: 80, b: 120 });
        setHeroColor('80,80,120');
      }
    };

    return () => {
      isMounted = false;
    };
  }, [bgImageSrc]);

  const genresList = movie.genre_ids 
    ? movie.genre_ids.map(id => {
        const fallbackName = typeof id === 'number' ? Reflect.get(GENRES, String(id)) : undefined;
        return t(`genres.${id}`, { defaultValue: fallbackName || '' });
      }).filter(Boolean).slice(0, 3)
    : [];

  // Build gradient helpers from extracted RGB
  const rgb = accentRGB;
  const c = (a: number) => rgb ? `rgba(${rgb.r},${rgb.g},${rgb.b},${a})` : `rgba(0,0,0,0)`;

  return (
    <div 
      className="relative z-0 overflow-visible w-full px-4 pt-[calc(122px+env(safe-area-inset-top))] pb-6 flex flex-col items-center justify-center transition-all duration-700 ease-in-out"
    >
      {/* ── Layer 1: Deep background wash ── */}
      <div 
        style={{
          background: `linear-gradient(to bottom,
            ${c(0.92)} 0%,
            ${c(0.85)} 8%,
            ${c(0.60)} 20%,
            ${c(0.35)} 35%,
            ${c(0.18)} 50%,
            ${c(0.08)} 65%,
            ${c(0.02)} 80%,
            rgba(0,0,0,0) 95%
          )`,
          transition: 'background 0.35s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
        className="absolute inset-x-0 top-0 h-[190vh] pointer-events-none -z-10"
      />
      {/* ── Layer 2: Wide radial spotlight ── */}
      <div
        style={{
          background: `radial-gradient(ellipse 110% 65% at 50% 20%, ${c(0.8)} 0%, ${c(0.2)} 50%, transparent 70%)`,
          transition: 'background 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        className="absolute inset-x-0 top-0 h-[130vh] pointer-events-none -z-10"
      />
      {/* ── Layer 3: Tight hot-spot glow ── */}
      <div
        style={{
          background: `radial-gradient(ellipse 75% 30% at 50% 8%, ${c(0.7)} 0%, transparent 60%)`,
          transition: 'background 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        className="absolute inset-x-0 top-0 h-[55vh] pointer-events-none -z-10"
      />

      {/* Poster/Backdrop Card (Floating, centered card layout for both mobile and tablet) */}
      <div 
        onClick={() => onSelect(movie)}
        className="w-[94%] max-w-[400px] min-[500px]:w-full min-[500px]:max-w-[740px] aspect-[2/3] min-[500px]:aspect-[4/3] relative rounded-2xl overflow-hidden border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.95)] cursor-pointer active:scale-[0.98] transition-all duration-200"
      >
        {/* High-Resolution Resolved Image */}
        <img 
          src={bgImageSrc} 
          alt={movie.title || movie.name} 
          className="absolute inset-0 w-full h-full object-cover select-none pointer-events-none"
          loading="eager"
          draggable={false}
        />

        {/* Bottom Vignette overlay for excellent text/buttons contrast */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/60 to-transparent pointer-events-none" />

        {/* Details Container (Centered vertically and horizontally on all screen sizes) */}
        <div className="absolute inset-x-0 bottom-0 px-4 sm:px-6 pb-4 sm:pb-6 pt-12 sm:pt-16 flex flex-col items-center text-center z-10 w-full">
          
          {/* Logo or Text Title Overlay */}
          {!hasBakedInText && (
            localLogoUrl && !logoImgFailed ? (
              <div className="relative inline-flex items-end mb-4 max-w-[75%] sm:max-w-[80%] max-h-[75px] sm:max-h-[95px] w-full justify-center">
                {/* Premium dual-layer drop shadow for maximum readability */}
                <img
                  src={localLogoUrl}
                  aria-hidden
                  className="absolute object-contain object-bottom"
                  style={{
                    filter: 'blur(20px) brightness(0) opacity(0.7)',
                    transform: 'translate(2px, 6px) scale(1.05)',
                    pointerEvents: 'none',
                    zIndex: 0,
                    width: '100%', height: '100%', inset: 0
                  }}
                />
                <img
                  src={localLogoUrl}
                  aria-hidden
                  className="absolute object-contain object-bottom"
                  style={{
                    filter: 'blur(3px) brightness(0) opacity(0.5)',
                    transform: 'translate(1px, 2px) scale(1.01)',
                    pointerEvents: 'none',
                    zIndex: 0,
                    width: '100%', height: '100%', inset: 0
                  }}
                />
                <img
                  src={localLogoUrl}
                  alt={movie.title || movie.name}
                  className="relative object-contain object-bottom max-h-[70px] sm:max-h-[85px] w-auto transition-opacity duration-300"
                  style={{ zIndex: 1 }}
                  onError={() => setLogoImgFailed(true)}
                />
              </div>
            ) : (
              <h2 className="text-lg sm:text-xl font-black font-leaner drop-shadow-xl leading-tight text-white tracking-wide uppercase mb-4 max-w-[90%] line-clamp-2">
                {movie.title || movie.name}
              </h2>
            )
          )}

          {/* Categories / Genres */}
          {genresList.length > 0 && (
            <div className="flex items-center justify-center flex-wrap gap-x-2 gap-y-1 mb-4 text-[11px] sm:text-xs font-semibold text-white/80 tracking-wide select-none drop-shadow-[0_1.5px_3px_rgba(0,0,0,0.8)]">
              {genresList.map((g, idx) => (
                <React.Fragment key={g}>
                  <span>{g}</span>
                  {idx < genresList.length - 1 && (
                    <span className="text-white/30">•</span>
                  )}
                </React.Fragment>
              ))}
            </div>
          )}

          {/* Buttons Row */}
          <div className="flex items-center justify-center w-full max-w-[380px] gap-3 mt-1">
            {/* Play/Home Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPlay(movie);
              }}
              className="flex-1 flex items-center justify-center h-[50px] sm:h-[56px] rounded-[4px] bg-white hover:bg-neutral-200 text-black font-bold text-[21px] sm:text-[22px] gap-2 transition-all active:scale-95 shadow-md font-sans"
            >
              {is404 ? (
                <House size={30} weight="fill" />
              ) : (
                <Play size={30} weight="fill" />
              )}
              <span>{is404 ? t('nav.home', { defaultValue: 'Home' }) : t('hero.play', { defaultValue: 'Play' })}</span>
            </button>

            {/* Add to My List Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleList(movie);
              }}
              className="flex-1 flex items-center justify-center h-[50px] sm:h-[56px] rounded-[4px] bg-[#6d6d6e]/40 hover:bg-[#6d6d6e]/25 text-white font-bold text-[21px] sm:text-[22px] gap-2 transition-all active:scale-95 shadow-md font-sans"
            >
              {isAdded ? <Check size={30} weight="bold" /> : <Plus size={30} weight="bold" />}
              <span>{t('nav.myList', { defaultValue: 'My List' })}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MobileHero;
