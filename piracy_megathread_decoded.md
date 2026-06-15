// ... existing code ...
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring, useVelocity, useTransform } from 'framer-motion';
import { House, Bookmark } from '@phosphor-icons/react';
// ... existing code ...
import pLogoSymbol from '../assets/logos/p-pstream-logo.svg';
import { useCastStore } from '../store/useCastStore';

const generatePillMap = (width: number, height: number) => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  const imgData = ctx.createImageData(width, height);
  
  const r = height / 2;
  const cx1 = r; 
  const cx2 = width - r; 
  const cy = r; 
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let dx = 0;
      let dy = y - cy;
      let dist = 0;
      
      if (x < cx1) {
        dx = x - cx1;
        dist = Math.sqrt(dx * dx + dy * dy);
      } else if (x > cx2) {
        dx = x - cx2;
        dist = Math.sqrt(dx * dx + dy * dy);
      } else {
        dx = 0;
        dist = Math.abs(dy);
      }
      
      let rCol = 128;
      let gCol = 128;
      
      if (dist < r) {
        const normalizedDist = dist / r;
        let magnitude = 0;
        const edgeStart = 0.4; 

        if (normalizedDist > edgeStart) {
          const t = (normalizedDist - edgeStart) / (1 - edgeStart);
          magnitude = Math.pow(t, 3) * 1.8; 
        } else {
          magnitude = -0.05 * Math.sin(normalizedDist * Math.PI);
        }

        magnitude = Math.max(-1.2, Math.min(1.2, magnitude));

        const dirX = dist === 0 ? 0 : dx / dist;
        const dirY = dist === 0 ? 0 : dy / dist;

        const dispX = dirX * magnitude;
        const dispY = dirY * magnitude;

        rCol = Math.min(255, Math.max(0, 128 + dispX * 100));
        gCol = Math.min(255, Math.max(0, 128 + dispY * 100));
      }

      const index = (y * width + x) * 4;
      imgData.data[index] = rCol;
      imgData.data[index + 1] = gCol;
      imgData.data[index + 2] = 128;
      imgData.data[index + 3] = 255;
    }
  }
  
  ctx.putImageData(imgData, 0, 0);
  return canvas.toDataURL('image/png');
};

interface NavbarMobileProps {
// ... existing code ...
  const {
    isChromecastAvailable,
    isChromecastConnected,
    isChromecastConnecting,
    isAirPlayAvailable,
    isAirPlayActive,
    startAirPlay,
    startChromecast
  } = useCastStore();

  // --- LIQUID NAV STATE ---
  const containerRef = useRef<HTMLDivElement>(null);
  const navRefs = useRef<(HTMLDivElement | null)[]>([]);
  const mapCache = useRef(new Map<string, string>());
  
  const activeIndex = isSearchActive ? 2 : activeTab === 'list' ? 1 : activeTab === 'settings' ? 3 : 0;
  
  const [bubbleState, setBubbleState] = useState({ opacity: 0, width: 0, height: 48, mapUrl: '' });
  const activeX = useMotionValue(0);
  const activeY = useMotionValue(0);
  const activeWidth = useMotionValue(0);
  const activeHeight = useMotionValue(0);
  
  const springX = useSpring(activeX, { stiffness: 200, damping: 20, mass: 1 });
  const springY = useSpring(activeY, { stiffness: 200, damping: 20, mass: 1 });
  const springWidth = useSpring(activeWidth, { stiffness: 250, damping: 22, mass: 0.8 });
  const springHeight = useSpring(activeHeight, { stiffness: 250, damping: 22, mass: 0.8 });
  
  const xVel = useVelocity(springX);
  const scaleY = useTransform(xVel, [-800, 0, 800], [0.5, 1, 0.5], { clamp: true });
  const scaleX = useTransform(xVel, [-800, 0, 800], [1.3, 1, 1.3], { clamp: true });

  useEffect(() => {
    const updateBubble = () => {
      if (!navRefs.current[activeIndex] || !containerRef.current) return;

      const el = navRefs.current[activeIndex];
      const container = containerRef.current;
      const elRect = el.getBoundingClientRect();
      const contRect = container.getBoundingClientRect();
      
      const isDesktop = window.innerWidth >= 640;
      const paddingX = isDesktop ? 8 : 16;
      const paddingY = isDesktop ? 8 : 8;
      
      const bubbleWidth = elRect.width + paddingX * 2;
      const bubbleHeight = elRect.height + paddingY * 2;
      const xPos = elRect.left - contRect.left - paddingX;
      const yPos = elRect.top - contRect.top - paddingY;

      const cacheKey = `${Math.round(bubbleWidth)}x${Math.round(bubbleHeight)}`;
      let url = mapCache.current.get(cacheKey);
      
      if (!url) {
        url = generatePillMap(bubbleWidth, bubbleHeight);
        mapCache.current.set(cacheKey, url);
      }

      activeX.set(xPos);
      activeY.set(yPos);
      activeWidth.set(bubbleWidth);
      activeHeight.set(bubbleHeight);

      setBubbleState({ opacity: 1, width: bubbleWidth, height: bubbleHeight, mapUrl: url });
    };

    const timer = setTimeout(updateBubble, 50);
    window.addEventListener('resize', updateBubble);
    return () => { clearTimeout(timer); window.removeEventListener('resize', updateBubble); };
  }, [activeIndex]);
  
  const avatarUrl = settings.avatarUrl || DEFAULT_AVATAR;
// ... existing code ...
  // Refactored helper functions to avoid class duplication and make customization easy
  const getTabClass = (isActive: boolean) => {
    return `relative z-10 flex flex-col items-center justify-center cursor-pointer select-none py-0.5 sm:py-5 sm:w-full
      active:scale-95 sm:hover:bg-white/[0.03] group
      ${isActive ? 'text-white' : 'text-white/45 hover:text-white/80'}`;
  };
  const getPillClass = (isActive: boolean) => {
    return `relative z-10 flex flex-col items-center justify-center transition-all duration-300 px-6 py-1.5 rounded-full
      sm:w-full sm:h-auto sm:bg-transparent sm:rounded-none sm:px-0 sm:py-0
      ${isActive 
        ? 'text-white sm:bg-transparent' 
        : 'text-white/45 hover:text-white/80'}`;
  };
  return (
    <>
      {/* --- LIQUID DISPLACEMENT MAP FILTER --- */}
      <svg className="absolute w-0 h-0 pointer-events-none">
        <defs>
          <filter id="liquid-bubble-nav" colorInterpolationFilters="sRGB" x="-50%" y="-50%" width="200%" height="200%">
            <feImage href={bubbleState.mapUrl} result="disp_map" width={bubbleState.width || 64} height={bubbleState.height || 64} preserveAspectRatio="none" />
            <feDisplacementMap in="SourceGraphic" in2="disp_map" scale={bubbleState.height ? bubbleState.height * 1.2 : 50} xChannelSelector="R" yChannelSelector="G" result="refracted"/>
            <feGaussianBlur in="refracted" stdDeviation="0.5" result="blurred" />
            <feMerge><feMergeNode in="blurred" /></feMerge>
          </filter>
        </defs>
      </svg>

      {/* Mobile Top Header (Netflix style) */}
// ... existing code ...
      {/* Mobile Bottom Navigation Bar → Left Sidebar on sm: (foldable/tablet) */}
      <div 
        ref={containerRef}
        className="
        fixed bottom-[calc(16px+env(safe-area-inset-bottom))] left-8 right-8 z-[10020] mx-auto max-w-[310px] w-auto bg-[#1d1d1d] border border-white/10 rounded-full py-1 px-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.65)]
        sm:bottom-0 sm:top-0 sm:left-0 sm:right-auto sm:w-[72px] sm:h-full sm:rounded-none sm:border-0 sm:border-r sm:border-white/[0.08]
        sm:bg-[#121212] sm:shadow-2xl sm:flex sm:flex-col sm:items-center sm:justify-start sm:py-0 sm:px-0 sm:pb-0 sm:pt-0 sm:mx-0 sm:max-w-none
      ">
        {/* Brand Logo/Icon at the very top of the Sidebar (Tablet only) */}
        <div className="hidden sm:flex items-center justify-center w-full pt-[calc(1.5rem+env(safe-area-inset-top))] pb-6 shrink-0">
// ... existing code ...
          <img
            src={pLogoSymbol}
            alt="Pstream Emblem Logo"
            onClick={() => handleMobileTabClick('home')}
            className="h-[46px] w-auto cursor-pointer select-none transition-all active:scale-95 hover:scale-105 duration-200"
          />
        </div>

        <div className="grid grid-cols-4 items-center justify-around w-full sm:flex sm:flex-col sm:items-center sm:justify-start sm:h-full sm:gap-2 sm:pt-0 sm:w-full relative">
          
          {/* THE LIQUID BUBBLE */}
          <AnimatePresence>
            {bubbleState.opacity > 0 && (
              <motion.div
                className="absolute pointer-events-none z-0"
                initial={false}
                animate={{ opacity: 1 }}
                style={{
                  x: springX,
                  y: springY,
                  width: springWidth,
                  height: springHeight,
                  scaleX: scaleX,
                  scaleY: scaleY,
                  backdropFilter: `url(#liquid-bubble-nav) blur(2px)`,
                  WebkitBackdropFilter: `url(#liquid-bubble-nav) blur(2px)`,
                  borderRadius: '9999px',
                  clipPath: 'inset(0px round 9999px)',
                  transformOrigin: 'center center'
                }}
              >
                <div className="absolute inset-0 rounded-[9999px] bg-white/5 border border-white/10 mix-blend-overlay" />
                <div className="absolute inset-0 rounded-[9999px] shadow-[inset_0_2px_10px_rgba(255,255,255,0.2)]" />
                <div className="absolute inset-x-2 bottom-0 h-[2px] bg-white/20 blur-[2px] rounded-full" />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Home */}
          <div
            onClick={() => {
// ... existing code ...
            {activeTab === 'home' && !isSearchActive && (
              <div className="hidden sm:block absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-8 bg-[#E50914] rounded-r-md shadow-[0_0_12px_rgba(229,9,20,0.85)] animate-pulse" />
            )}
            <div className={getPillClass(activeTab === 'home' && !isSearchActive)} ref={el => navRefs.current[0] = el}>
              <House size={22} weight="regular" className="transition-transform group-hover:scale-105 duration-200" />
              <span className="text-[8px] mt-0.5 font-extralight tracking-wide whitespace-nowrap">{t('nav.home', { defaultValue: 'Home' })}</span>
            </div>
          </div>

          {/* My List */}
          <div
            onClick={() => {
// ... existing code ...
            {activeTab === 'list' && !isSearchActive && (
              <div className="hidden sm:block absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-8 bg-[#E50914] rounded-r-md shadow-[0_0_12px_rgba(229,9,20,0.85)] animate-pulse" />
            )}
            <div className={getPillClass(activeTab === 'list' && !isSearchActive)} ref={el => navRefs.current[1] = el}>
              <Bookmark size={22} weight="regular" className="transition-transform group-hover:scale-105 duration-200" />
              <span className="text-[8px] mt-0.5 font-extralight tracking-wide whitespace-nowrap">{t('nav.myList', { defaultValue: 'My List' })}</span>
            </div>
          </div>

          {/* Search */}
          <div
            onClick={() => {
// ... existing code ...
            {isSearchActive && (
              <div className="hidden sm:block absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-8 bg-[#E50914] rounded-r-md shadow-[0_0_12px_rgba(229,9,20,0.85)] animate-pulse" />
            )}
            <div className={getPillClass(isSearchActive)} ref={el => navRefs.current[2] = el}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="w-[22px] h-[22px] shrink-0 transition-transform group-hover:scale-105 duration-200">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <span className="text-[8px] mt-0.5 font-extralight tracking-wide whitespace-nowrap">{t('nav.search', { defaultValue: 'Search' })}</span>
            </div>
          </div>

          {/* Profile (Settings) */}
          <div
            onClick={() => {
// ... existing code ...
            {activeTab === 'settings' && !isSearchActive && (
              <div className="hidden sm:block absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-8 bg-[#E50914] rounded-r-md shadow-[0_0_12px_rgba(229,9,20,0.85)] animate-pulse" />
            )}
            <div className={getPillClass(activeTab === 'settings' && !isSearchActive)} ref={el => navRefs.current[3] = el}>
              <div
                className={`w-[22px] h-[22px] rounded overflow-hidden flex items-center justify-center bg-[#E50914] text-white font-bold text-[10px] ring-[1.5px] transition-all duration-300 shrink-0 group-hover:scale-105 mb-0.5
                  ${activeTab === 'settings' && !isSearchActive ? 'ring-white sm:ring-2' : 'ring-transparent'}`}
// ... existing code ...