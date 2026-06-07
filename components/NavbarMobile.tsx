import React, { useState, useEffect, useRef } from 'react';
import { House, Bookmark } from '@phosphor-icons/react';
import { MdCast, MdAirplay } from 'react-icons/md';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useGlobalContext } from '../context/GlobalContext';
import { DEFAULT_AVATAR } from '../constants';
import pLogo from '../assets/logos/pstream-logo.svg';
import pLogoSymbol from '../assets/logos/p-pstream-logo.svg';
import { useCastStore } from '../store/useCastStore';

interface NavbarMobileProps {
  isScrolled: boolean;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const NavbarMobile: React.FC<NavbarMobileProps> = ({
  isScrolled,
  searchQuery,
  setSearchQuery,
  activeTab,
  setActiveTab
}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isSearchActive, setIsSearchActive] = useState(() => {
    return searchParams.get('search') === 'true' || !!searchParams.get('q');
  });
  const [scrollY, setScrollY] = useState(0);
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { settings, user } = useGlobalContext();
  const {
    isChromecastAvailable,
    isChromecastConnected,
    isChromecastConnecting,
    isAirPlayAvailable,
    isAirPlayActive,
    startAirPlay,
    startChromecast
  } = useCastStore();
  
  const avatarUrl = settings.avatarUrl || DEFAULT_AVATAR;
  const avatarInitial = (settings.displayName?.[0] || user?.display_name?.[0] || 'P').toUpperCase();

  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/') return t('nav.home', { defaultValue: 'Home' });
    if (path === '/list') return t('nav.myList', { defaultValue: 'My List' });
    if (path === '/tv' || path === '/series') return t('nav.shows', { defaultValue: 'Series' });
    if (path === '/movies' || path === '/films') return t('nav.movies', { defaultValue: 'Films' });
    if (path === '/new') return 'New & Hot';
    if (path.startsWith('/settings')) return t('nav.profile', { defaultValue: 'Profile' });
    
    if (activeTab === 'home') return t('nav.home', { defaultValue: 'Home' });
    if (activeTab === 'list') return t('nav.myList', { defaultValue: 'My List' });
    if (activeTab === 'settings') return t('nav.profile', { defaultValue: 'Profile' });
    if (activeTab === 'tv') return t('nav.shows', { defaultValue: 'Series' });
    if (activeTab === 'movies') return t('nav.movies', { defaultValue: 'Films' });
    if (activeTab === 'new') return 'New & Hot';
    
    const segment = path.split('/').filter(Boolean)[0];
    if (segment) {
      return segment.charAt(0).toUpperCase() + segment.slice(1);
    }
    return '';
  };

  // Progressive scroll transition listener
  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Initial check
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Calculate opacity over a short 20px distance for instant welding/solid look upon scroll
  const maxScroll = 20;
  const opacity = Math.min(1, scrollY / maxScroll);

  // Sync isSearchActive with query changes and URL parameters
  useEffect(() => {
    const isActive = searchParams.get('search') === 'true' || !!searchParams.get('q');
    setIsSearchActive(isActive);
  }, [searchParams]);

  const handleMobileTabClick = (tabId: string) => {
    setActiveTab(tabId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    if (tabId === 'settings') {
      navigate('/settings');
    } else if (tabId === 'home') {
      navigate('/');
    } else {
      navigate(`/${tabId}`);
    }
  };

  if (location.pathname === '/login') return null;

  // Refactored helper functions to avoid class duplication and make customization easy
  const getTabClass = (isActive: boolean) => {
    return `relative flex flex-col items-center justify-center cursor-pointer select-none py-0.5 sm:py-5 sm:w-full
      active:scale-95 sm:hover:bg-white/[0.03] group
      ${isActive ? 'text-white' : 'text-white/45 hover:text-white/80'}`;
  };

  const getPillClass = (isActive: boolean) => {
    return `flex flex-col items-center justify-center transition-all duration-300 px-5 py-1.5 rounded-full
      sm:w-full sm:h-auto sm:bg-transparent sm:rounded-none sm:px-0 sm:py-0
      ${isActive 
        ? 'bg-white/15 text-white sm:bg-transparent' 
        : 'text-white/45 hover:text-white/80'}`;
  };

  return (
    <>
      {/* Mobile Top Header (Netflix style) */}
      {!isSearchActive ? (
        // Standard logo header — same for all pages including 404
        <header
          style={{
            backgroundColor: `rgba(0, 0, 0, ${opacity})`
          }}
          className="fixed top-0 left-0 right-0 z-[80] px-6 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-3 transition-all duration-300 ease-out border-none shadow-none translate-y-0 sm:hidden"
        >
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center justify-start gap-2.5">
              {location.pathname !== '/' ? (
                <button
                  onClick={() => {
                    setActiveTab('home');
                    navigate('/', { state: { direction: 'left' } });
                  }}
                  className="p-1 -ml-1 text-white hover:text-white/85 active:scale-95 transition-all duration-200 shrink-0 flex items-center justify-center rounded-full active:bg-white/10"
                  title="Go Back"
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
                  className="h-[34px] w-auto cursor-pointer select-none transition-transform active:scale-95"
                />
              )}
              <span className="text-[21px] font-[350] tracking-wide text-white select-none font-sans">
                {getPageTitle()}
              </span>
            </div>

            {/* Top Right Cast Utility Icons */}
            <div className="flex items-center gap-3 shrink-0">
              {isAirPlayAvailable && (
                <button
                  onClick={startAirPlay}
                  className={`p-1.5 flex items-center justify-center rounded-full active:bg-white/10 transition-colors active:scale-95
                    ${isAirPlayActive ? 'text-[#3b82f6]' : 'text-white/80 hover:text-white'}`}
                  title="AirPlay to TV"
                >
                  <MdAirplay size={22} />
                </button>
              )}
              {isChromecastAvailable && (
                <button
                  onClick={startChromecast}
                  className={`p-1.5 flex items-center justify-center rounded-full active:bg-white/10 transition-colors active:scale-95
                    ${isChromecastConnected ? 'text-[#3b82f6]' : (isChromecastConnecting ? 'text-[#3b82f6] animate-pulse' : 'text-white/80 hover:text-white')}`}
                  title="Chromecast to TV"
                >
                  <MdCast size={22} />
                </button>
              )}
            </div>
          </div>
        </header>
      ) : (
        // Search Header: Shown on both mobile and tablet with proper content offset (sm:left-[72px])
        <header
          className="fixed top-0 left-0 right-0 sm:left-[72px] z-[80] px-6 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-3 transition-all duration-300 ease-out border-none shadow-none bg-black/95 backdrop-blur-md"
        >
          <div className="flex items-center w-full px-1 animate-in fade-in duration-200">
            <div className="flex-1 flex items-center bg-[#222222] rounded-[4px] px-3.5 py-2.5 border border-white/[0.04]">
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2.0" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                className="w-[18px] h-[18px] text-[#8c8c8c] mr-3 shrink-0"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Search movies, shows..."
                className="bg-transparent border-none outline-none text-white text-[15px] w-full font-netflix placeholder-[#8c8c8c] focus:ring-0 focus:outline-none py-0.5"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
              />
              <button 
                onClick={() => {
                  setSearchQuery('');
                }} 
                className="text-[#8c8c8c] hover:text-white shrink-0 ml-2 p-0.5 active:scale-95 transition-transform"
                title="Clear Search"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.0" stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </header>
      )}

      {/* Mobile Bottom Navigation Bar → Left Sidebar on sm: (foldable/tablet) */}
      <div className="
        fixed bottom-[calc(16px+env(safe-area-inset-bottom))] left-8 right-8 z-[10020] mx-auto max-w-[310px] w-auto bg-[#1d1d1d] border border-white/10 rounded-full py-1 px-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.65)]
        sm:bottom-0 sm:top-0 sm:left-0 sm:right-auto sm:w-[72px] sm:h-full sm:rounded-none sm:border-0 sm:border-r sm:border-white/[0.08]
        sm:bg-[#121212] sm:shadow-2xl sm:flex sm:flex-col sm:items-center sm:justify-start sm:py-0 sm:px-0 sm:pb-0 sm:pt-0 sm:mx-0 sm:max-w-none
      ">
        {/* Brand Logo/Icon at the very top of the Sidebar (Tablet only) */}
        <div className="hidden sm:flex items-center justify-center w-full pt-[calc(1.5rem+env(safe-area-inset-top))] pb-6 shrink-0">
          <img
            src={pLogoSymbol}
            alt="Pstream Emblem Logo"
            onClick={() => handleMobileTabClick('home')}
            className="h-[46px] w-auto cursor-pointer select-none transition-all active:scale-95 hover:scale-105 duration-200"
          />
        </div>

        <div className="grid grid-cols-4 items-center justify-around w-full sm:flex sm:flex-col sm:items-center sm:justify-start sm:h-full sm:gap-2 sm:pt-0 sm:w-full">
          {/* Home */}
          <div
            onClick={() => {
              setIsSearchActive(false);
              setSearchQuery('');
              const newParams = new URLSearchParams(window.location.search);
              newParams.delete('search');
              newParams.delete('q');
              setSearchParams(newParams, { replace: true });
              handleMobileTabClick('home');
            }}
            className={getTabClass(activeTab === 'home' && !isSearchActive)}
          >
            {/* Crimson Glowing Active Indicator (Left side vertical bar on tablet) */}
            {activeTab === 'home' && !isSearchActive && (
              <div className="hidden sm:block absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-8 bg-[#E50914] rounded-r-md shadow-[0_0_12px_rgba(229,9,20,0.85)] animate-pulse" />
            )}
            <div className={getPillClass(activeTab === 'home' && !isSearchActive)}>
              <House size={22} weight="regular" className="transition-transform group-hover:scale-105 duration-200" />
              <span className="text-[8px] mt-0.5 font-extralight tracking-wide whitespace-nowrap">{t('nav.home', { defaultValue: 'Home' })}</span>
            </div>
          </div>

          {/* My List */}
          <div
            onClick={() => {
              setIsSearchActive(false);
              setSearchQuery('');
              const newParams = new URLSearchParams(window.location.search);
              newParams.delete('search');
              newParams.delete('q');
              setSearchParams(newParams, { replace: true });
              handleMobileTabClick('list');
            }}
            className={getTabClass(activeTab === 'list' && !isSearchActive)}
          >
            {/* Crimson Glowing Active Indicator (Left side vertical bar on tablet) */}
            {activeTab === 'list' && !isSearchActive && (
              <div className="hidden sm:block absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-8 bg-[#E50914] rounded-r-md shadow-[0_0_12px_rgba(229,9,20,0.85)] animate-pulse" />
            )}
            <div className={getPillClass(activeTab === 'list' && !isSearchActive)}>
              <Bookmark size={22} weight="regular" className="transition-transform group-hover:scale-105 duration-200" />
              <span className="text-[8px] mt-0.5 font-extralight tracking-wide whitespace-nowrap">{t('nav.myList', { defaultValue: 'My List' })}</span>
            </div>
          </div>

          {/* Search */}
          <div
            onClick={() => {
              setIsSearchActive(true);
              const newParams = new URLSearchParams(window.location.search);
              newParams.set('search', 'true');
              setSearchParams(newParams, { replace: true });
            }}
            className={getTabClass(isSearchActive)}
          >
            {/* Crimson Glowing Active Indicator (Left side vertical bar on tablet) */}
            {isSearchActive && (
              <div className="hidden sm:block absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-8 bg-[#E50914] rounded-r-md shadow-[0_0_12px_rgba(229,9,20,0.85)] animate-pulse" />
            )}
            <div className={getPillClass(isSearchActive)}>
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
              setIsSearchActive(false);
              setSearchQuery('');
              const newParams = new URLSearchParams(window.location.search);
              newParams.delete('search');
              newParams.delete('q');
              setSearchParams(newParams, { replace: true });
              handleMobileTabClick('settings');
            }}
            className={getTabClass(activeTab === 'settings' && !isSearchActive)}
          >
            {/* Crimson Glowing Active Indicator (Left side vertical bar on tablet) */}
            {activeTab === 'settings' && !isSearchActive && (
              <div className="hidden sm:block absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-8 bg-[#E50914] rounded-r-md shadow-[0_0_12px_rgba(229,9,20,0.85)] animate-pulse" />
            )}
            <div className={getPillClass(activeTab === 'settings' && !isSearchActive)}>
              <div
                className={`w-[22px] h-[22px] rounded overflow-hidden flex items-center justify-center bg-[#E50914] text-white font-bold text-[10px] ring-[1.5px] transition-all duration-300 shrink-0 group-hover:scale-105 mb-0.5
                  ${activeTab === 'settings' && !isSearchActive ? 'ring-white sm:ring-2' : 'ring-transparent'}`}
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <span>{avatarInitial}</span>
                )}
              </div>
              <span className="text-[8px] mt-0.5 font-extralight tracking-wide whitespace-nowrap">{t('nav.profile', { defaultValue: 'Profile' })}</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default NavbarMobile;
