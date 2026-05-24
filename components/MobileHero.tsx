import React, { useState, useEffect } from 'react';
import { Play, Plus, Check } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { useGlobalContext } from '../context/GlobalContext';
import { GENRES } from '../constants';
import { Movie } from '../types';
import { getMovieImages } from '../services/api';

interface MobileHeroProps {
  movie: Movie;
  logoUrl?: string | null;
  onSelect: (movie: Movie) => void;
  onPlay: (movie: Movie) => void;
}

const MobileHero: React.FC<MobileHeroProps> = ({ movie, logoUrl, onSelect, onPlay }) => {
  const { t } = useTranslation();
  const { myList, toggleList } = useGlobalContext();
  const isAdded = myList.some(m => String(m.id) === String(movie.id));

  const [localLogoUrl, setLocalLogoUrl] = useState<string | null>(logoUrl || null);
  
  // Default to standard poster path
  const defaultPoster = (movie.poster_path?.startsWith('http') || movie.poster_path?.startsWith('comic://'))
    ? movie.poster_path
    : movie.poster_path ? `https://image.tmdb.org/t/p/w780${movie.poster_path}` : '';

  const [bgImageSrc, setBgImageSrc] = useState<string>(defaultPoster);
  const [hasBakedInText, setHasBakedInText] = useState<boolean>(true);
  const [logoImgFailed, setLogoImgFailed] = useState<boolean>(false);
  const [accentColor, setAccentColor] = useState<string>('rgba(20, 20, 20, 0)');

  // 1. Dynamic Hero Image Selection & Logo Fetching
  useEffect(() => {
    let isMounted = true;
    
    // Reset state on movie/logoUrl change
    setLocalLogoUrl(logoUrl || null);
    setBgImageSrc(defaultPoster);
    setHasBakedInText(true);
    setLogoImgFailed(false);

    const loadHeroAssets = async () => {
      try {
        const mediaType = (movie.media_type || (movie.title ? 'movie' : 'tv')) as 'movie' | 'tv';
        const data = await getMovieImages(String(movie.id), mediaType);
        
        if (!isMounted) return;

        let resolvedBg = '';
        let bakedInText = true;

        if (data) {
          // A. Try to find a textless poster (iso_639_1 === null)
          if (data.posters && data.posters.length > 0) {
            const textless = data.posters.find((p: any) => p.iso_639_1 === null);
            if (textless) {
              resolvedBg = `https://image.tmdb.org/t/p/w780${textless.file_path}`;
              bakedInText = false;
            }
          }

          // B. If no textless poster is found, try backdrop
          if (!resolvedBg && movie.backdrop_path) {
            resolvedBg = movie.backdrop_path.startsWith('http')
              ? movie.backdrop_path
              : `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}`;
            bakedInText = false;
          }

          // C. Fallback to standard logo if not passed or null
          if (!logoUrl && data.logos && data.logos.length > 0) {
            const logoObj = data.logos.find((l: any) => l.iso_639_1 === 'en' || l.iso_639_1 === null);
            if (logoObj) {
              setLocalLogoUrl(`https://image.tmdb.org/t/p/w500${logoObj.file_path}`);
            }
          }
        }

        if (resolvedBg) {
          setBgImageSrc(resolvedBg);
          setHasBakedInText(bakedInText);
        }
      } catch (e) {
        console.error('Failed loading mobile hero assets:', e);
      }
    };

    loadHeroAssets();

    return () => {
      isMounted = false;
    };
  }, [movie.id, logoUrl, defaultPoster]);

  // 2. Dynamic Dominant Accent Color Extraction via HTML5 Canvas
  useEffect(() => {
    if (!bgImageSrc) {
      setAccentColor('rgba(20, 20, 20, 0)');
      return;
    }

    let isMounted = true;
    const img = new Image();
    img.crossOrigin = 'anonymous'; // Fully CORS-compliant since TMDB supports it
    // Add cache-busting parameter to prevent CORS failures due to cached non-CORS headers
    img.src = bgImageSrc.includes('?') ? `${bgImageSrc}&cors=true` : `${bgImageSrc}?cors=true`;
    img.onload = () => {
      if (!isMounted) return;
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        // Scale down to a very small size (10x10) for automatic hardware-accelerated averaging
        canvas.width = 10;
        canvas.height = 10;
        ctx.drawImage(img, 0, 0, 10, 10);
        
        const imgData = ctx.getImageData(0, 0, 10, 10).data;
        let r = 0, g = 0, b = 0, count = 0;
        
        for (let i = 0; i < imgData.length; i += 4) {
          const pixelR = imgData[i];
          const pixelG = imgData[i + 1];
          const pixelB = imgData[i + 2];
          const pixelA = imgData[i + 3];
          
          if (pixelA > 200) { // Skip semi-transparent boundary pixels
            const brightness = (pixelR * 299 + pixelG * 587 + pixelB * 114) / 1000;
            // Focus on vibrant/colorful tones, skipping pure black and extreme white
            if (brightness > 35 && brightness < 220) {
              r += pixelR;
              g += pixelG;
              b += pixelB;
              count++;
            }
          }
        }
        
        if (count > 0) {
          const avgR = Math.round(r / count);
          const avgG = Math.round(g / count);
          const avgB = Math.round(b / count);
          
          // Boost opacity to create a beautiful, clearly visible ambient glow
          setAccentColor(`rgba(${avgR}, ${avgG}, ${avgB}, 0.70)`);
        } else {
          // Fallback to absolute average if all pixels are dark/bright
          let fallbackR = 0, fallbackG = 0, fallbackB = 0;
          for (let i = 0; i < imgData.length; i += 4) {
            fallbackR += imgData[i];
            fallbackG += imgData[i + 1];
            fallbackB += imgData[i + 2];
          }
          const avgR = Math.round(fallbackR / 100);
          const avgG = Math.round(fallbackG / 100);
          const avgB = Math.round(fallbackB / 100);
          setAccentColor(`rgba(${avgR}, ${avgG}, ${avgB}, 0.55)`);
        }
      } catch (err) {
        // Graceful fallback for local test/custom files without CORS headers
        setAccentColor('rgba(100, 100, 100, 0.55)');
      }
    };
    img.onerror = () => {
      if (isMounted) setAccentColor('rgba(100, 100, 100, 0.55)');
    };

    return () => {
      isMounted = false;
    };
  }, [bgImageSrc]);

  const genresList = movie.genre_ids 
    ? movie.genre_ids.map(id => t(`genres.${id}`, { defaultValue: GENRES[id] })).filter(Boolean).slice(0, 3)
    : [];

  return (
    <div 
      className="relative z-0 overflow-visible w-full px-6 pt-[calc(136px+env(safe-area-inset-top))] pb-6 flex flex-col items-center justify-center transition-all duration-700 ease-in-out"
    >
      {/* Dynamic Ambient Bleed Layer (fades behind content rows) */}
      <div 
        style={{
          background: `linear-gradient(to bottom, ${accentColor} 0%, ${accentColor} 20%, rgba(20, 20, 20, 0.25) 55%, rgba(20, 20, 20, 0.8) 80%, #141414 100%)`,
          transition: 'background 0.8s ease-in-out'
        }}
        className="absolute inset-x-0 top-0 h-[140vh] pointer-events-none -z-10"
      />
      {/* Poster/Backdrop Card */}
      <div 
        onClick={() => onSelect(movie)}
        className="w-full max-w-[360px] aspect-[2/2.8] relative rounded-xl overflow-hidden border border-white/15 shadow-[0_12px_36px_rgba(0,0,0,0.9)] cursor-pointer active:scale-[0.98] transition-transform duration-200"
      >
        {/* Background Image (Textless poster, cropped backdrop, or fallback standard poster) */}
        <img 
          src={bgImageSrc} 
          alt={movie.title || movie.name} 
          className="w-full h-full object-cover rounded-xl"
          loading="eager"
        />

        {/* Bottom Gradient overlay for text/buttons readability */}
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-[#141414]/95 via-[#141414]/65 to-transparent pointer-events-none" />

        {/* Card bottom details */}
        <div className="absolute inset-x-0 bottom-0 px-4 pb-3.5 pt-12 flex flex-col items-center text-center z-10 w-full">
          
          {/* Transparent Logo or Text Title Overlay (only rendered if background has no baked-in text) */}
          {!hasBakedInText && (
            localLogoUrl && !logoImgFailed ? (
              <div className="relative inline-flex items-end mb-4 max-w-[75%] max-h-[85px] w-full justify-center">
                {/* Premium dual-layer drop shadow for maximum readability on detailed backgrounds */}
                <img
                  src={localLogoUrl}
                  aria-hidden
                  className="absolute object-contain object-bottom"
                  style={{
                    filter: 'blur(20px) brightness(0) opacity(0.6)',
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
                    filter: 'blur(3px) brightness(0) opacity(0.4)',
                    transform: 'translate(1px, 2px) scale(1.01)',
                    pointerEvents: 'none',
                    zIndex: 0,
                    width: '100%', height: '100%', inset: 0
                  }}
                />
                <img
                  src={localLogoUrl}
                  alt={movie.title || movie.name}
                  className="relative object-contain object-bottom max-h-[80px] w-auto"
                  style={{ zIndex: 1 }}
                  onError={() => setLogoImgFailed(true)}
                />
              </div>
            ) : (
              <h2 className="text-xl sm:text-2xl font-black font-leaner drop-shadow-xl leading-none text-white tracking-wide uppercase mb-4 max-w-[90%] line-clamp-2">
                {movie.title || movie.name}
              </h2>
            )
          )}

          {/* Categories (up to 3) */}
          {genresList.length > 0 && (
            <div className="flex items-center justify-center flex-wrap gap-x-2 gap-y-1 mb-4 text-xs font-semibold text-white/80 tracking-wide select-none drop-shadow-[0_1.5px_3px_rgba(0,0,0,0.8)]">
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
          <div className="flex items-center w-full gap-3 mt-1">
            {/* Play Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPlay(movie);
              }}
              className="flex-1 flex items-center justify-center h-[48px] rounded-[4px] bg-white hover:bg-neutral-200 text-black font-semibold text-[18px] gap-2.5 transition-all active:scale-95 shadow-md font-sans"
            >
              <Play size={25} weight="fill" />
              <span>{t('hero.play', { defaultValue: 'Play' })}</span>
            </button>

            {/* Add to My List Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleList(movie);
              }}
              className="flex-1 flex items-center justify-center h-[48px] rounded-[4px] bg-[#6d6d6e]/40 hover:bg-[#6d6d6e]/25 text-white font-semibold text-[18px] gap-2.5 transition-all active:scale-95 shadow-md font-sans"
            >
              {isAdded ? <Check size={25} weight="bold" /> : <Plus size={25} weight="bold" />}
              <span>{t('nav.myList', { defaultValue: 'My List' })}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MobileHero;
