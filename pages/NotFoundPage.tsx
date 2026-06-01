import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CaretLeftIcon, HouseIcon, InfoIcon, PlayIcon, WarningIcon } from '@phosphor-icons/react';
import { AnimatePresence, motion } from 'framer-motion';
import { Movie } from '../types';
import Row from '../components/Row';
import MobileHero from '../components/MobileHero';
import { useIsMobile } from '../hooks/useIsMobile';
import { DIMENSIONS, dimensionsAsMovies } from '../data/notFoundDimensions';
import CategorySubNavMobile from '../components/CategorySubNavMobile';
import CategorySubNav, { Genre } from '../components/CategorySubNav';

interface NotFoundPageProps {
  onSelectMovie?: (movie: Movie, time?: number, videoId?: string) => void;
  onPlay?: (movie: Movie) => void;
}

// Convert string-based dimensions into fun sci-fi categories for the subnav
const DIMENSION_GENRES: Genre[] = [
  { id: 0, name: 'Hardware Glitches' },
  { id: 1, name: 'Signal Failures' },
  { id: 2, name: 'Lost Data Files' },
  { id: 3, name: 'Analog Corruption' },
  { id: 4, name: 'Void Sentinels' },
  { id: 5, name: 'Cosmic Drift' }
];

const NotFoundPage: React.FC<NotFoundPageProps> = ({ onSelectMovie, onPlay }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedGenre, setSelectedGenre] = useState<Genre | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const active = DIMENSIONS[activeIndex];

  const handleSelectMovie = (movie: Movie) => {
    const idx = DIMENSIONS.findIndex((dim) => dim.id === movie.id);
    if (idx !== -1) {
      setActiveIndex(idx);
      setSelectedGenre(DIMENSION_GENRES[idx]);
      // Smooth scroll back to the top of the details banner
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleGenreSelect = (genre: Genre | null) => {
    setSelectedGenre(genre);
    setActiveIndex(genre ? genre.id : 0);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleMoreInfo = () => {
    if (onSelectMovie) {
      // Trigger the native InfoModal globally with the mapped Movie object
      onSelectMovie(dimensionsAsMovies[activeIndex]);
    } else {
      setIsDrawerOpen(true);
    }
  };

  if (isMobile) {
    return (
      <div className="relative min-h-screen bg-[#141414] text-white overflow-x-hidden select-none">
        
        {/* ─── PROJECTOR SCANLINES & CRT GLITCH FILTER ─── */}
        <div 
          className="fixed inset-0 pointer-events-none z-[60] opacity-[0.22] mix-blend-overlay bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.3)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[size:100%_4px,6px_100%]" 
        />

        {/* ─── SUB-NAV PILLS (Series, Films, New & Hot, Categories) ─── */}
        <CategorySubNavMobile
          genres={DIMENSION_GENRES}
          selectedGenre={selectedGenre}
          onGenreSelect={handleGenreSelect}
          dropdownLabel="Glitch Zones"
        />

        {/* ─── NATIVE MOBILE HERO ─── */}
        <MobileHero 
          movie={dimensionsAsMovies[activeIndex]}
          logoUrl={dimensionsAsMovies[activeIndex].image_url}
          onSelect={(movie) => {
            if (onSelectMovie) {
              onSelectMovie(movie);
            }
          }}
          onPlay={() => navigate('/')}
        />

        {/* ─── NATIVE INTERACTIVE ROW CAROUSEL ─── */}
        <main className="relative z-10 -mt-2 space-y-4">
          <Row
            title={t('notFound.alternativeDimensions', { defaultValue: 'Alternate Dimensions: More Like This' })}
            data={dimensionsAsMovies}
            onSelect={onSelectMovie || handleSelectMovie}
            onPlay={() => navigate('/')}
            rowKey="404-dimensions"
          />
        </main>
      </div>
    );
  }

  // ─── DESKTOP CINE-LAYOUT ───
  return (
    <div className="relative min-h-screen bg-[#141414] text-white overflow-x-hidden select-none pb-16">
      
      {/* ─── 404 DIMENSION NAVIGATION (Renders into portal) ─── */}
      <CategorySubNav
        title={t('notFound.dimensionsTitle', { defaultValue: 'Alternate Dimensions' })}
        genres={DIMENSION_GENRES}
        selectedGenre={selectedGenre}
        onGenreSelect={handleGenreSelect}
        dropdownLabel="Glitch Zones"
      />

      {/* ─── PROJECTOR SCANLINES & CRT GLITCH FILTER (Repeating linear gradients) ─── */}
      <div 
        className="fixed inset-0 pointer-events-none z-[60] opacity-[0.25] mix-blend-overlay bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.3)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[size:100%_4px,6px_100%]" 
      />

      {/* ─── DYNAMIC BANNER BACKDROP ─── */}
      <div className="relative h-[60vh] sm:h-[70vh] md:h-[80vh] w-full overflow-hidden bg-black">
        <div className="absolute inset-0 z-0 pointer-events-none transition-all duration-700">
          <img 
            src={active.backdrop} 
            className="w-full h-full object-cover opacity-70 scale-105 transition-all duration-1000 ease-out" 
            alt="Cinematic Background" 
          />
          {/* Upper dark fade to blend with fixed layout header */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/15 to-transparent" />
          {/* Lower heavy fade to blend into the slider row */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#141414] via-[#141414]/30 to-transparent" />
          {/* Center theatrical vignetted spotlight */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_20%,#000000_90%)] opacity-65" />
        </div>

        {/* ─── HERO DETAILS CONTENT (Formatted exactly like HeroCarouselContent) ─── */}
        <div className="absolute top-0 left-0 w-full h-full flex flex-col justify-end z-20 pl-[calc(1.5rem+env(safe-area-inset-left))] md:pl-14 lg:pl-16 pr-4 md:pr-12 pointer-events-none pb-[12%] sm:pb-[9%] md:pb-[6%]">
          <div className="max-w-[95%] sm:max-w-lg md:max-w-xl lg:max-w-2xl space-y-4 md:space-y-5 pointer-events-auto">
            
            {/* Tagline / Subtitle */}
            <div className="text-[10px] sm:text-xs font-bold tracking-[0.25em] text-red-500 drop-shadow-[0_2px_8px_rgba(229,9,20,0.4)]">
              {active.subtitle}
            </div>

            {/* Glowing Neon 404 Title Image (Mathematically blended) */}
            <div className="relative flex items-end mb-2 md:mb-4">
              <div className="relative inline-flex items-end">
                {/* Multi-layer gaussian blur shadow for realistic glowing red ambient lighting */}
                <img
                  src={active.titleImg}
                  aria-hidden
                  className="absolute object-contain object-bottom select-none opacity-45 blur-[20px] scale-[1.06]"
                  style={{
                    filter: 'brightness(1.5) sepia(1) hue-rotate(-50deg)',
                    width: '100%', height: '100%', inset: 0,
                    mixBlendMode: 'screen'
                  }}
                />
                <img
                  src={active.titleImg}
                  aria-hidden
                  className="absolute object-contain object-bottom select-none opacity-60 blur-[4px] scale-[1.01]"
                  style={{
                    filter: 'brightness(1.2) sepia(1) hue-rotate(-50deg)',
                    width: '100%', height: '100%', inset: 0,
                    mixBlendMode: 'screen'
                  }}
                />
                {/* Core opaque neon vector */}
                <img
                  src={active.titleImg}
                  alt={active.title}
                  className="relative object-contain object-bottom select-none animate-pulse duration-[3000ms]"
                  style={{ 
                    maxHeight: 'clamp(80px, 18vw, 190px)', 
                    maxWidth: 'clamp(250px, 55vw, 550px)',
                    mixBlendMode: 'screen'
                  }}
                />
              </div>
            </div>

            {/* Description / Synopsis */}
            <p className="text-[12px] sm:text-[13px] md:text-[15px] font-medium text-white/90 line-clamp-3 leading-relaxed max-w-[90%] sm:max-w-lg transition-all duration-700 drop-shadow-md">
              {active.synopsis}
            </p>

            {/* Action CTAs (Play & More Info) */}
            <div className="flex items-center flex-wrap gap-2 md:gap-3 pt-2">
              <button
                onClick={() => navigate('/')}
                className="flex items-center justify-center bg-white text-black px-6 sm:px-8 h-[36px] md:h-[42px] rounded-[4px] font-bold hover:bg-white/80 transition-colors text-[14px] md:text-[17px] gap-2 active:scale-95 shadow-lg duration-200"
              >
                <HouseIcon size={24} weight="fill" className="fill-black" />
                <span>{t('notFound.homeButton', { defaultValue: 'Home' })}</span>
              </button>

              <button
                onClick={handleMoreInfo}
                className="flex items-center justify-center bg-[#6d6d6e]/80 text-white px-5 sm:px-8 h-[36px] md:h-[42px] rounded-[4px] font-bold hover:bg-[#6d6d6e]/60 transition-all text-[14px] md:text-[17px] gap-2 active:scale-95 shadow-lg duration-200"
              >
                <InfoIcon size={24} weight="bold" />
                <span>{t('hero.moreInfo', { defaultValue: 'Error Details' })}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ─── NATIVE INTERACTIVE ROW CAROUSEL ─── */}
      <main className="relative z-10 -mt-8 sm:-mt-12 md:-mt-16 space-y-4 md:space-y-6">
        <Row
          title={t('notFound.alternativeDimensions', { defaultValue: 'More Like This: Alternate Dimensions' })}
          data={dimensionsAsMovies}
          onSelect={handleSelectMovie}
          onPlay={() => navigate('/')}
          rowKey="404-dimensions"
        />
      </main>

      {/* ─── GLASSMORPHIC TECHNICAL DETAILS SLIDING DRAWER (Fallback only if global modal is not wired) ─── */}
      <AnimatePresence>
        {isDrawerOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-end bg-black/60 backdrop-blur-sm">
            {/* Click outside to close */}
            <div className="absolute inset-0" onClick={() => setIsDrawerOpen(false)} />

            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="relative w-full max-w-md sm:max-w-lg h-full bg-[#181818]/95 border-l border-white/10 p-6 sm:p-8 flex flex-col justify-between shadow-[0_0_50px_rgba(0,0,0,0.8)]"
            >
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <div className="flex items-center gap-3">
                    <WarningIcon size={28} className="text-red-500" weight="fill" />
                    <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-white font-sans">
                      {t('notFound.technicalReport', { defaultValue: 'Diagnostic Report' })}
                    </h3>
                  </div>
                  <button 
                    onClick={() => setIsDrawerOpen(false)}
                    className="p-1 rounded-full hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                  >
                    <CaretLeftIcon size={24} weight="bold" className="rotate-180" />
                  </button>
                </div>

                <div className="space-y-4 text-sm font-sans text-white/80">
                  <div className="space-y-1">
                    <span className="text-xs text-white/40 uppercase tracking-wider">{t('notFound.errorCodeLabel', { defaultValue: 'System Code' })}</span>
                    <p className="text-base font-mono text-red-500 font-semibold">{active.errorCode}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-white/40 uppercase tracking-wider">{t('notFound.requestPathLabel', { defaultValue: 'Requested Endpoint' })}</span>
                    <p className="text-base font-mono bg-black/40 px-3 py-1.5 rounded border border-white/5 whitespace-nowrap overflow-x-auto select-text scrollbar-hide">
                      {location.pathname}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-white/40 uppercase tracking-wider">{t('notFound.timestampLabel', { defaultValue: 'Incident Timestamp' })}</span>
                    <p className="text-base font-mono">{new Date().toISOString()}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-white/40 uppercase tracking-wider">{t('notFound.browserLabel', { defaultValue: 'Platform Agent' })}</span>
                    <p className="text-xs font-mono text-white/50 bg-black/20 p-2 rounded leading-normal border border-white/5 max-h-24 overflow-y-auto select-text">
                      {navigator.userAgent}
                    </p>
                  </div>
                </div>

                <div className="bg-red-500/10 border border-red-500/20 rounded p-4 text-[13px] leading-relaxed text-red-300 font-sans">
                  <strong>System Notice:</strong> The targeted router endpoint has been de-referenced or has failed to load from our CDN space. Please redirect back to our secure home streaming environment to resume playback.
                </div>
              </div>

              <button
                onClick={() => {
                  setIsDrawerOpen(false);
                  navigate('/');
                }}
                className="w-full py-3.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded flex items-center justify-center gap-2 transition-colors duration-200 active:scale-[0.98] shadow-lg font-sans text-sm sm:text-base mt-8"
              >
                <CaretLeftIcon size={20} weight="bold" />
                <span>{t('notFound.homeButton', { defaultValue: 'Return to Home' })}</span>
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default NotFoundPage;