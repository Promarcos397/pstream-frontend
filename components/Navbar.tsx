import React, { useEffect, useState, startTransition } from 'react';
import { useTranslation } from 'react-i18next';
import SearchBar from './SearchBar';
import pstreamWordmark from '../assets/logos/pstream-logo.svg';
import { useSettingsStore } from '../store/useSettingsStore';
import { useAuthStore } from '../store/useAuthStore';
import { useNavigate, useLocation } from 'react-router-dom';
import { DEFAULT_AVATAR } from '../constants';
import { useIsMobile } from '../hooks/useIsMobile';
import { useAvatarReady } from '../hooks/useAvatarReady';
import NavbarMobile from './NavbarMobile';

interface NavbarProps {
  isScrolled: boolean;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const NAV_H = 'h-16';
const NAV_PX = 'px-14';

const Navbar: React.FC<NavbarProps> = ({ isScrolled, searchQuery, setSearchQuery, activeTab, setActiveTab }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const settings = useSettingsStore(s => s.settings);
  const user = useAuthStore(s => s.user);
  const isSettings = location.pathname.startsWith('/settings');
  const isMobile = useIsMobile();
  const avatarUrl = settings.avatarUrl || DEFAULT_AVATAR;
  const avatarInitial = (settings.displayName?.[0] || user?.display_name?.[0] || 'P').toUpperCase();

  const [navScrollY, setNavScrollY] = useState(0);
  const avatarLoaded = useAvatarReady(avatarUrl);

  useEffect(() => {
    if (isMobile) return;
    const onScroll = () => setNavScrollY(window.scrollY);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [isMobile]);

  useEffect(() => {
    if (!isMobile) {
      const meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
      if (meta) meta.content = '#141414';
      return () => {
        const m = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
        if (m) m.content = '#000000';
      };
    }
  }, [isMobile]);

  const navBgOpacity = navScrollY <= 40
    ? navScrollY / 80
    : Math.min(1, 0.5 + (navScrollY - 40) / 160);

  const navItems = [
    { id: 'home',     label: t('nav.home',              { defaultValue: 'Home' }) },
    { id: 'tv',       label: t('nav.shows',             { defaultValue: 'Series' }) },
    { id: 'movies',   label: t('nav.movies',            { defaultValue: 'Films' }) },
    { id: 'new',      label: t('nav.newPopular',        { defaultValue: 'New & Popular' }) },
    { id: 'list',     label: t('nav.myList',            { defaultValue: 'My List' }) },
    { id: 'language', label: t('nav.browseByLanguage',  { defaultValue: 'Browse by Language' }) },
  ];

  const preloadPage = (tabId: string) => {
    switch (tabId) {
      case 'home':     void import('../pages/HomePage'); break;
      case 'tv':       void import('../pages/ShowsPage'); break;
      case 'movies':   void import('../pages/MoviesPage'); break;
      case 'new':      void import('../pages/NewPopularPage'); break;
      case 'list':     void import('../pages/MyListPage'); break;
      case 'language': void import('../pages/BrowseLanguagePage'); break;
      case 'settings': void import('../pages/SettingsPage'); break;
    }
  };

  const handleTabClick = (tabId: string) => {
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

  if (location.pathname === '/login') return null;
  if (isMobile) {
    return (
      <NavbarMobile
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />
    );
  }

  const settingsStyle: React.CSSProperties = { backgroundColor: 'white', borderBottom: '1px solid #e5e7eb' };
  const scrollStyle: React.CSSProperties = { backgroundColor: `rgba(20,20,20,${navBgOpacity})` };

  return (
    <>
      {/* ── Primary nav: full-width background + logo + links ──────────── */}
      <nav
        className={`fixed inset-x-0 top-0 z-[80] ${NAV_H} flex items-center ${NAV_PX}`}
        style={isSettings ? settingsStyle : scrollStyle}
      >
        <img
          src={pstreamWordmark}
          alt="Pstream"
          className="h-[26px] cursor-pointer flex-shrink-0"
          onClick={() => handleTabClick('home')}
        />

        {!isSettings && (
          <ul className="flex items-center gap-5 ml-8 text-[14px] tracking-[-0.2px] font-normal text-[#e5e5e5]">
            {navItems.map((item) => (
              <li
                key={item.id}
                onClick={() => handleTabClick(item.id)}
                onMouseEnter={() => preloadPage(item.id)}
                className={`cursor-pointer transition-colors whitespace-nowrap ${activeTab === item.id ? 'text-white font-bold' : 'hover:text-[#8c8c8c]'}`}
              >
                {item.label}
              </li>
            ))}
          </ul>
        )}

      </nav>

      {/* Subnav portal — separate fixed element, sits flush below the primary nav */}
      <div id="category-subnav-portal" className="fixed inset-x-0 top-16 z-[79]" style={isSettings ? undefined : scrollStyle} />

      {/* ── Secondary nav: search + profile — independent z-stack ───────── */}
      <div className={`fixed top-0 right-14 z-[85] ${NAV_H} flex items-center gap-4`}>
        {!isSettings && (
          <SearchBar searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
        )}

        <div className={`flex items-center gap-4 ${isSettings ? 'hidden' : ''}`}>
          {!user ? (
            <button
              onClick={() => navigate('/login')}
              className="px-4 py-1.5 bg-[#e50914] text-white text-[13px] font-semibold rounded hover:bg-[#f40612] transition-colors shadow-lg active:scale-95"
            >
              {t('nav.signIn')}
            </button>
          ) : (
            <button
              onClick={() => handleTabClick('settings')}
              onMouseEnter={() => preloadPage('settings')}
              className="w-8 h-8 rounded overflow-hidden shadow-md transition-all flex items-center justify-center relative focus-visible:outline-none"
              style={{ background: '#E50914' }}
              aria-label={t('nav.accountSettings')}
            >
              <span className="text-white font-bold text-sm absolute">{avatarInitial}</span>
              {avatarUrl && (
                <img
                  src={avatarUrl}
                  alt="Profile"
                  decoding="async"
                  referrerPolicy="no-referrer"
                  className={`w-full h-full object-cover absolute inset-0 transition-opacity duration-300 ${avatarLoaded ? 'opacity-100' : 'opacity-0'}`}
                />
              )}
            </button>
          )}
        </div>
      </div>
    </>
  );
};

export default Navbar;
