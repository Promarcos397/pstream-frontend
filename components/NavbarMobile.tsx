import React, { useState, useEffect, useRef, startTransition } from 'react';
import { House, Bookmark, AirplayIcon, ScreencastIcon } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence, useMotionValue, useSpring, useVelocity, useTransform } from 'framer-motion';
import { useSettingsStore } from '../store/useSettingsStore';
import { useAuthStore } from '../store/useAuthStore';
import { useHeroColor } from '../context/HeroColorContext';
import { DEFAULT_AVATAR } from '../constants';
import { useAvatarReady } from '../hooks/useAvatarReady';
import pLogoSymbol from '../assets/logos/p-pstream-logo.svg';
import { useCastStore } from '../store/useCastStore';
// removing red pulsing underline from Nav
// ─── Component ────────────────────────────────────────────────────────────────
interface NavbarMobileProps {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const NavbarMobile: React.FC<NavbarMobileProps> = ({
  searchQuery,
  setSearchQuery,
  activeTab,
  setActiveTab
}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isSearchActive, setIsSearchActive] = useState(() => {
    return searchParams.get('search') === 'true' || !!searchParams.get('q');
  });
  const [scrollY, setScrollY] = useState(() => (typeof window !== 'undefined' ? window.scrollY : 0));
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { heroColor } = useHeroColor();
  const settings = useSettingsStore(s => s.settings);
  const user = useAuthStore(s => s.user);
  const {
    isChromecastAvailable,
    isChromecastConnected,
    isChromecastConnecting,
    isAirPlayAvailable,
    isAirPlayActive,
    startAirPlay,
    startChromecast
  } = useCastStore();

  // --- LIQUID BUBBLE STATE ---
  const containerRef = useRef<HTMLDivElement>(null);
  const navRefs = useRef<(HTMLDivElement | null)[]>([]);
  // Tracks the very first render so we teleport the bubble instead of animating it in
  const isFirstRender = useRef(true);
  const [bubbleState, setBubbleState] = useState({ opacity: 0, width: 0, height: 0 });

  // Tab order: Home=0, List=1, Search=2, Settings=3
  const activeIndex = isSearchActive ? 2 : activeTab === 'list' ? 1 : activeTab === 'settings' ? 3 : 0;

  // Motion values for the bubble's position and size
  const activeX      = useMotionValue(0);
  const activeY      = useMotionValue(0);
  const activeWidth  = useMotionValue(0);
  const activeHeight = useMotionValue(0);

  // Sloshy springs for smooth animated movement
  const springX      = useSpring(activeX,      { stiffness: 280, damping: 22, mass: 0.9 });
  const springY      = useSpring(activeY,      { stiffness: 280, damping: 22, mass: 0.9 });
  const springWidth  = useSpring(activeWidth,  { stiffness: 320, damping: 24, mass: 0.7 });
  const springHeight = useSpring(activeHeight, { stiffness: 320, damping: 24, mass: 0.7 });

  // Velocity-based squash & stretch (symbiote effect)
  const xVel   = useVelocity(springX);
  const scaleY = useTransform(xVel, [-800, 0, 800], [0.55, 1, 0.55], { clamp: true });
  const scaleX = useTransform(xVel, [-800, 0, 800], [1.25, 1, 1.25], { clamp: true });

  // Recompute bubble position whenever the active tab changes
  useEffect(() => {
    const updateBubble = () => {
      const el = navRefs.current[activeIndex];
      const container = containerRef.current;
      if (!el || !container) return;

      const elRect   = el.getBoundingClientRect();
      const contRect = container.getBoundingClientRect();

      // If the element hasn't painted yet (dimensions are 0), bail out.
      // The staggered timers below will catch it once it has.
      if (elRect.width === 0 || elRect.height === 0) return;

      const isDesktop = window.innerWidth >= 640;

      // Tight explicit padding — keeps the bubble small and snug around the icon
      const addedWidth  = isDesktop ? 8 : 16;
      const addedHeight = isDesktop ? 5  : 10;

      const bubbleWidth  = elRect.width  + addedWidth;
      const bubbleHeight = elRect.height + addedHeight;

      // Derive exact centre of the nav item relative to the container
      const centerX = (elRect.left - contRect.left) + (elRect.width  );
      const centerY = (elRect.top  - contRect.top)  + (elRect.height );

      // Subtract half the bubble's own size to place it centred over the icon
      const xPos = centerX - (bubbleWidth / 1.01);
      const yPos = centerY - (bubbleHeight / 0.9);

      if (isFirstRender.current) {
        // On the very first render: jump all spring values instantly so the
        // bubble appears in place with no fly-in from the corner.
        activeX.jump(xPos);
        activeY.jump(yPos);
        activeWidth.jump(bubbleWidth);
        activeHeight.jump(bubbleHeight);
        springX.jump(xPos);
        springY.jump(yPos);
        springWidth.jump(bubbleWidth);
        springHeight.jump(bubbleHeight);
        isFirstRender.current = false;
      } else {
        // Every subsequent tab change: animate smoothly via the springs.
        activeX.set(xPos);
        activeY.set(yPos);
        activeWidth.set(bubbleWidth);
        activeHeight.set(bubbleHeight);
      }

      setBubbleState({ opacity: 1, width: bubbleWidth, height: bubbleHeight });
    };

    // Fire immediately, then at 50 ms and 250 ms as fallbacks.
    // This guarantees we measure correctly even if fonts or SVG icons are slow to paint.
    updateBubble();
    const timer1 = setTimeout(updateBubble, 50);
    const timer2 = setTimeout(updateBubble, 250);

    window.addEventListener('resize', updateBubble);
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      window.removeEventListener('resize', updateBubble);
    };
  }, [activeIndex]);

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    onScroll(); // sync immediately in case page mounted already scrolled
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
    if (!meta) return;

    const heroPages = ['/', '/browse', '/browse/series', '/browse/films', '/latest'];
    const isSearch = searchParams.get('search') === 'true' || !!searchParams.get('q');
    const isModal = (window as any).__modal_active;

    if (!isSearch && !isModal && heroColor && heroPages.includes(location.pathname)) {
      const [r, g, b] = heroColor.split(',').map(Number);
      meta.content = `rgb(${r},${g},${b})`;
    } else {
      meta.content = '#000000';
    }

    return () => { meta.content = '#000000'; };
  }, [heroColor, location.pathname, searchParams.get('search'), searchParams.get('q')]);

  // Speculatively preload all page chunks once the app is idle so every tab
  // switch thereafter skips the lazy-load network round-trip entirely.
  useEffect(() => {
    const preload = () => {
      void import('../pages/HomePage');
      void import('../pages/ShowsPage');
      void import('../pages/MoviesPage');
      void import('../pages/NewPopularPage');
      void import('../pages/MyListPage');
      void import('../pages/SettingsPage');
    };
    if ('requestIdleCallback' in window) {
      const id = (window as any).requestIdleCallback(preload, { timeout: 3000 });
      return () => (window as any).cancelIdleCallback(id);
    }
    const id = setTimeout(preload, 1500);
    return () => clearTimeout(id);
  }, []);

  const opacity = scrollY <= 40
    ? scrollY / 80
    : Math.min(1, 0.5 + (scrollY - 40) / 160);

  // Sync search state with URL
  useEffect(() => {
    const isActive = searchParams.get('search') === 'true' || !!searchParams.get('q');
    setIsSearchActive(isActive);
  }, [searchParams]);

  const handleMobileTabClick = (tabId: string) => {
    setActiveTab(tabId);
    startTransition(() => {
      if (tabId === 'settings')  navigate('/settings');
      else if (tabId === 'home') navigate('/browse');
      else if (tabId === 'tv')   navigate('/browse/series');
      else if (tabId === 'movies') navigate('/browse/films');
      else if (tabId === 'new')  navigate('/latest');
      else if (tabId === 'list') navigate('/browse/my-list');
      else if (tabId === 'language') navigate('/browse/language');
    });
  };

  const avatarUrl     = settings.avatarUrl || DEFAULT_AVATAR;
  const avatarInitial = (settings.displayName?.[0] || user?.display_name?.[0] || 'P').toUpperCase();
  const avatarLoaded  = useAvatarReady(avatarUrl);

  // Tab wrapper class (handles text color + active state)
  const getTabClass = (isActive: boolean) =>
    `relative flex flex-col items-center justify-center cursor-pointer select-none py-0.5
     active:scale-95 group
     ${isActive ? 'text-white' : 'text-white/45 hover:text-white/80'}`;

  // Inner pill content — no static background, the animated bubble handles it
  const getPillClass = (isActive: boolean) =>
    `relative z-10 flex flex-col items-center justify-center transition-all duration-300 px-6 py-1.5 rounded-full
     ${isActive ? 'text-white' : 'text-white/45 hover:text-white/80'}`;

  if (location.pathname === '/login') return null;

  return (
    <>

      {/* ── Mobile Top Header ──────────────────────────────────────────────── */}
      {!isSearchActive ? (
        <header
          style={{ backgroundColor: `rgba(0, 0, 0, ${opacity})` }}
          className="fixed top-0 left-0 right-0 z-[80] px-6 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-3 transition-all duration-300 ease-out border-none shadow-none translate-y-0"
        >
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center justify-start gap-2.5">
              {location.pathname !== '/browse' ? (
                <button
                  onClick={() => {
                    setActiveTab('home');
                    navigate('/browse', { state: { direction: 'left' } });
                  }}
                  className="p-1 -ml-1 text-white hover:text-white/85 active:scale-95 transition-all duration-200 shrink-0 flex items-center justify-center rounded-full active:bg-white/10"
                  title={t('nav.goBack')}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-[22px] h-[22px]">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                  </svg>
                </button>
              ) : (
                <img
                  src={pLogoSymbol}
                  alt="Pstream Emblem Logo"
                  onClick={() => handleMobileTabClick('home')}
                  className="h-[38px] w-auto cursor-pointer select-none transition-transform active:scale-95"
                />
              )}
              <span className="text-[21px] font-[350] tracking-wide text-white select-none font-sans">
                {(() => {
                  const path = location.pathname;
                  if (path === '/' || path === '/browse') return t('nav.home', { defaultValue: 'Home' });
                  if (path === '/browse/my-list') return t('nav.myList', { defaultValue: 'My List' });
                  if (path === '/browse/series') return t('nav.shows', { defaultValue: 'Series' });
                  if (path === '/browse/films') return t('nav.movies', { defaultValue: 'Films' });
                  if (path === '/latest') return t('nav.newPopular', { defaultValue: 'New & Hot' });
                  if (path.startsWith('/settings')) return t('nav.profile', { defaultValue: 'Profile' });
                  if (activeTab === 'home') return t('nav.home', { defaultValue: 'Home' });
                  if (activeTab === 'list') return t('nav.myList', { defaultValue: 'My List' });
                  if (activeTab === 'settings') return t('nav.profile', { defaultValue: 'Profile' });
                  const segment = path.split('/').filter(Boolean)[0];
                  return segment ? segment.charAt(0).toUpperCase() + segment.slice(1) : '';
                })()}
              </span>
            </div>

            {/* Cast Icons */}
            <div className="flex items-center gap-3 shrink-0">
              {isAirPlayAvailable && (
                <button
                  onClick={startAirPlay}
                  className={`p-1.5 flex items-center justify-center rounded-full active:bg-white/10 transition-colors active:scale-95
                    ${isAirPlayActive ? 'text-[#3b82f6]' : 'text-white/80 hover:text-white'}`}
                  title={t('nav.airplay')}
                >
                  <AirplayIcon size={22} />
                </button>
              )}
              {isChromecastAvailable && (
                <button
                  onClick={startChromecast}
                  className={`p-1.5 flex items-center justify-center rounded-full active:bg-white/10 transition-colors active:scale-95
                    ${isChromecastConnected ? 'text-[#3b82f6]' : (isChromecastConnecting ? 'text-[#3b82f6] animate-pulse' : 'text-white/80 hover:text-white')}`}
                  title={t('nav.chromecast')}
                >
                  <ScreencastIcon size={22} />
                </button>
              )}
            </div>
          </div>
        </header>
      ) : (
        <header className="fixed top-0 left-0 right-0 z-[80] px-6 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-3 transition-all duration-300 ease-out border-none shadow-none bg-black/95 backdrop-blur-md">
          <div className="flex items-center w-full px-1 animate-in fade-in duration-200">
            <div className="flex-1 flex items-center bg-[#222222] rounded-[4px] px-3.5 py-2.5 border border-white/[0.04]">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.0" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px] text-[#8c8c8c] mr-3 shrink-0">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder={t('nav.searchPlaceholder')}
                className="bg-transparent border-none outline-none text-white text-[15px] w-full font-netflix placeholder-[#8c8c8c] focus:ring-0 focus:outline-none py-0.5"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
              />
              <button
                onClick={() => setSearchQuery('')}
                className="text-[#8c8c8c] hover:text-white shrink-0 ml-2 p-0.5 active:scale-95 transition-transform"
                title={t('common.cancel')}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.0" stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </header>
      )}

      {/* ── Bottom Nav / sm: Sidebar ───────────────────────────────────────── removing sm style and tablet style */}
      <div
        ref={containerRef}
        className="
          fixed bottom-[calc(10px+env(safe-area-inset-bottom))] left-8 right-8 z-[10020] mx-auto max-w-[340px] sm:max-w-[400px] w-auto
          bg-[#1d1d1d]/30 backdrop-blur-lg border border-white/10 rounded-[100px] py-3 sm:py-4 px-2 sm:px-3
          shadow-[0_12px_40px_rgba(0,0,0,0.65)]
        "
      >


        {/* ── THE LIQUID BUBBLE ──────────────────────────────────────────── */}
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
                scaleX,
                scaleY,
                backdropFilter: 'blur(14px) saturate(160%)',
                WebkitBackdropFilter: 'blur(14px) saturate(160%)',
                backgroundColor: 'rgba(255, 255, 255, 0.13)',
                borderRadius: '9999px',
                clipPath: 'inset(0px round 9999px)',
                transformOrigin: 'center center',
              }}
            >
              {/* Specular highlights — visible on all platforms */}
              <div className="absolute inset-0 rounded-[9999px] bg-white/5 border border-white/10 mix-blend-overlay" />
              <div className="absolute inset-0 rounded-[9999px] shadow-[inset_0_2px_10px_rgba(255,255,255,0.18)]" />
              <div className="absolute inset-x-2 top-0 h-[2px] bg-white/20 blur-[2px] rounded-full" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Nav Items ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-4 items-center justify-around w-full">

          {/* Home */}
          <div
            ref={el => { navRefs.current[0] = el; }}
            onClick={() => {
              setIsSearchActive(false);
              setSearchQuery('');
              const p = new URLSearchParams(window.location.search);
              p.delete('search'); p.delete('q');
              setSearchParams(p, { replace: true });
              handleMobileTabClick('home');
            }}
            className={getTabClass(['home', 'tv', 'movies', 'new', 'language'].includes(activeTab) && !isSearchActive)}
          >

            <div className={getPillClass(['home', 'tv', 'movies', 'new', 'language'].includes(activeTab) && !isSearchActive)}>
              <House size={22} weight="regular" className="sm:w-[26px] sm:h-[26px] transition-transform group-hover:scale-105 duration-200" />
              <span className="text-[8px] sm:text-[9px] mt-0.5 font-extralight tracking-wide whitespace-nowrap">{t('nav.home', { defaultValue: 'Home' })}</span>
            </div>
          </div>

          {/* My List */}
          <div
            ref={el => { navRefs.current[1] = el; }}
            onClick={() => {
              setIsSearchActive(false);
              setSearchQuery('');
              const p = new URLSearchParams(window.location.search);
              p.delete('search'); p.delete('q');
              setSearchParams(p, { replace: true });
              handleMobileTabClick('list');
            }}
            className={getTabClass(activeTab === 'list' && !isSearchActive)}
          >

            <div className={getPillClass(activeTab === 'list' && !isSearchActive)}>
              <Bookmark size={22} weight="regular" className="sm:w-[26px] sm:h-[26px] transition-transform group-hover:scale-105 duration-200" />
              <span className="text-[8px] sm:text-[9px] mt-0.5 font-extralight tracking-wide whitespace-nowrap">{t('nav.myList', { defaultValue: 'My List' })}</span>
            </div>
          </div>

          {/* Search */}
          <div
            ref={el => { navRefs.current[2] = el; }}
            onClick={() => {
              if (location.pathname.startsWith('/title/')) {
                // Modal is route-driven — navigate back to background page first,
                // then activate search so the modal closes cleanly.
                const backgroundPath = (location.state as any)?.backgroundLocation?.pathname || '/browse';
                navigate(`${backgroundPath}?search=true`, { replace: true });
              } else {
                setIsSearchActive(true);
                const p = new URLSearchParams(window.location.search);
                p.set('search', 'true');
                setSearchParams(p, { replace: true });
              }
            }}
            className={getTabClass(isSearchActive)}
          >

            <div className={getPillClass(isSearchActive)}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="w-[22px] h-[22px] sm:w-[26px] sm:h-[26px] shrink-0 transition-transform group-hover:scale-105 duration-200">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <span className="text-[8px] sm:text-[9px] mt-0.5 font-extralight tracking-wide whitespace-nowrap">{t('nav.search', { defaultValue: 'Search' })}</span>
            </div>
          </div>

          {/* Profile */}
          <div
            ref={el => { navRefs.current[3] = el; }}
            onClick={() => {
              setIsSearchActive(false);
              setSearchQuery('');
              const p = new URLSearchParams(window.location.search);
              p.delete('search'); p.delete('q');
              setSearchParams(p, { replace: true });
              handleMobileTabClick('settings');
            }}
            className={getTabClass(activeTab === 'settings' && !isSearchActive)}
          >

            <div className={getPillClass(activeTab === 'settings' && !isSearchActive)}>
              <div
                className={`w-[22px] h-[22px] sm:w-[26px] sm:h-[26px] rounded overflow-hidden flex items-center justify-center bg-[#E50914] text-white font-bold text-[10px] ring-[1.5px] transition-all duration-300 shrink-0 group-hover:scale-105 mb-0.5 relative
                  ${activeTab === 'settings' && !isSearchActive ? 'ring-white' : 'ring-transparent'}`}
              >
                <span className="absolute">{avatarInitial}</span>
                {avatarUrl && (
                  <img
                    src={avatarUrl}
                    alt="Profile"
                    decoding="async"
                    referrerPolicy="no-referrer"
                    className={`w-full h-full object-cover absolute inset-0 transition-opacity duration-300 ${avatarLoaded ? 'opacity-100' : 'opacity-0'}`}
                  />
                )}
              </div>
              <span className="text-[8px] sm:text-[9px] mt-0.5 font-extralight tracking-wide whitespace-nowrap">{t('nav.profile', { defaultValue: 'Profile' })}</span>
            </div>
          </div>

        </div>
      </div>
    </>
  );
};

export default NavbarMobile;