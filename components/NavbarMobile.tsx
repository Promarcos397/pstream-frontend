import React, { useState, useEffect, startTransition } from 'react';
import { House, Bookmark, AirplayIcon, ScreencastIcon, ArrowSquareOutIcon } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useSettingsStore } from '../store/useSettingsStore';
import { useAuthStore, activateProfile } from '../store/useAuthStore';
import { useProfileStore } from '../store/useProfileStore';
import { useHeroColor } from '../context/HeroColorContext';
import { DEFAULT_AVATAR } from '../constants';
import { useAvatarReady } from '../hooks/useAvatarReady';
import pLogoSymbol from '../assets/logos/p-pstream-logo.svg';
import { useCastStore } from '../store/useCastStore';
import KidsBadge from './profiles/KidsBadge';
import KidsAvatar from './profiles/KidsAvatar';
import BottomNavMobile, { BottomNavItem } from './BottomNavMobile';
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

  const activeProfileId = useProfileStore(s => s.activeProfileId);
  const profiles = useProfileStore(s => s.profiles);
  const activeProfile = profiles.find(p => p.id === activeProfileId);
  const isKidsMode    = !!activeProfile?.isKids;
  const showKidsTile  = isKidsMode && !activeProfile?.avatarUrl;
  const avatarUrl     = activeProfile?.avatarUrl || settings.avatarUrl || DEFAULT_AVATAR;
  const avatarInitial = (activeProfile?.name?.[0] || settings.displayName?.[0] || user?.display_name?.[0] || 'P').toUpperCase();
  const avatarLoaded  = useAvatarReady(avatarUrl);

  if (location.pathname === '/login') return null;

  // ── Bottom nav item set — Kids mode drops "My List" for a simpler 3-tab
  // layout (Home / Search / Profile), matching Netflix Kids' bottom bar.
  const clearSearchParamsAndGo = (tabId: string) => {
    setIsSearchActive(false);
    setSearchQuery('');
    const p = new URLSearchParams(window.location.search);
    p.delete('search'); p.delete('q');
    setSearchParams(p, { replace: true });
    handleMobileTabClick(tabId);
  };

  const handleSearchTabClick = () => {
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
  };

  const isProfileActive = activeTab === 'settings' && !isSearchActive;
  const profileIcon = (
    <div
      className={`w-[22px] h-[22px] sm:w-[26px] sm:h-[26px] rounded overflow-hidden flex items-center justify-center bg-[#E50914] text-white font-bold text-[10px] ring-[1.5px] transition-all duration-300 shrink-0 group-hover:scale-105 mb-0.5 relative
        ${isProfileActive ? 'ring-white' : 'ring-transparent'}`}
    >
      {showKidsTile ? (
        <KidsAvatar size={26} />
      ) : (
        <>
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
        </>
      )}
    </div>
  );

  const homeItem: BottomNavItem = {
    id: 'home',
    icon: <House size={22} weight="regular" className="sm:w-[26px] sm:h-[26px] transition-transform group-hover:scale-105 duration-200" />,
    label: t('nav.home', { defaultValue: 'Home' }),
    onClick: () => clearSearchParamsAndGo('home'),
  };

  const listItem: BottomNavItem = {
    id: 'list',
    icon: <Bookmark size={22} weight="regular" className="sm:w-[26px] sm:h-[26px] transition-transform group-hover:scale-105 duration-200" />,
    label: t('nav.myList', { defaultValue: 'My List' }),
    onClick: () => clearSearchParamsAndGo('list'),
  };

  const searchItem: BottomNavItem = {
    id: 'search',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="w-[22px] h-[22px] sm:w-[26px] sm:h-[26px] shrink-0 transition-transform group-hover:scale-105 duration-200">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    ),
    label: t('nav.search', { defaultValue: 'Search' }),
    onClick: handleSearchTabClick,
  };

  const settingsItem: BottomNavItem = {
    id: 'settings',
    icon: profileIcon,
    label: t('nav.profile', { defaultValue: 'Profile' }),
    onClick: () => clearSearchParamsAndGo('settings'),
  };

  const bottomNavItems: BottomNavItem[] = isKidsMode
    ? [homeItem, searchItem, settingsItem]
    : [homeItem, listItem, searchItem, settingsItem];

  // Tab order matches ['home', 'tv', 'movies', 'new', 'language'] all mapping
  // to the Home bubble — those sub-pages have no bottom-nav tab of their own.
  const activeBottomNavId = isSearchActive
    ? 'search'
    : activeTab === 'list'
      ? 'list'
      : activeTab === 'settings'
        ? 'settings'
        : 'home';

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
              {isKidsMode && <KidsBadge size={13} />}
            </div>

            {/* Cast Icons */}
            <div className="flex items-center gap-3 shrink-0">
              {isKidsMode && (
                <button
                  onClick={() => activateProfile(null)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-full border border-white/25 text-white/85 text-[11px] font-medium active:scale-95 transition-colors"
                  title={t('profiles.exitKids', { defaultValue: 'Exit Kids' })}
                >
                  <ArrowSquareOutIcon size={14} />
                  {t('profiles.exitKids', { defaultValue: 'Exit Kids' })}
                </button>
              )}
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

      {/* ── Bottom Nav ──────────────────────────────────────────────────────── */}
      <BottomNavMobile items={bottomNavItems} activeId={activeBottomNavId} />
    </>
  );
};

export default NavbarMobile;
