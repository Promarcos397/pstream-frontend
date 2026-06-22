import React, { useEffect, useState, startTransition } from 'react';
import { useTranslation } from 'react-i18next';
import SearchBar from './SearchBar';
import pstreamWordmark from '../assets/logos/pstream-logo.svg';
import { useGlobalContext } from '../context/GlobalContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { DEFAULT_AVATAR } from '../constants';
import { useIsMobile } from '../hooks/useIsMobile';
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
  const { settings, user, logout } = useGlobalContext();
  const isSettings = location.pathname.startsWith('/settings');
  const isMobile = useIsMobile();
  const avatarUrl = settings.avatarUrl || DEFAULT_AVATAR;
  const avatarInitial = (settings.displayName?.[0] || user?.display_name?.[0] || 'P').toUpperCase();

  const [navScrollY, setNavScrollY] = useState(0);
  const [avatarLoaded, setAvatarLoaded] = useState(false);

  useEffect(() => {
    setAvatarLoaded(false);
    if (!avatarUrl) return;
    const img = new Image();
    img.onload = () => setAvatarLoaded(true);
    img.src = avatarUrl;
  }, [avatarUrl]);

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
        isScrolled={isScrolled}
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
          className="h-[22px] cursor-pointer transition-transform hover:scale-105 flex-shrink-0"
          onClick={() => handleTabClick('home')}
        />

        {!isSettings && (
          <ul className="flex items-center gap-5 ml-8 text-xs lg:text-sm tracking-[-0.2px] font-normal text-[#e5e5e5]">
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
            <div className="relative group/profile py-2 flex items-center">
              <div className="flex items-center cursor-pointer">
                <div
                  className="w-8 h-8 rounded overflow-hidden shadow-md group-hover/profile:ring-2 ring-white/60 transition-all flex items-center justify-center relative"
                  style={{ background: '#E50914' }}
                >
                  <span className="text-white font-bold text-sm absolute">{avatarInitial}</span>
                  {avatarUrl && (
                    <img
                      src={avatarUrl}
                      alt="Profile"
                      decoding="async"
                      className={`w-full h-full object-cover absolute inset-0 transition-opacity duration-300 ${avatarLoaded ? 'opacity-100' : 'opacity-0'}`}
                    />
                  )}
                </div>
                <span className="border-t-[4px] border-t-white border-x-[4px] border-x-transparent ml-2 transition-transform duration-300 group-hover/profile:rotate-180" />
              </div>

              {/* Dropdown */}
              <div className="absolute right-0 top-full mt-2 w-56 bg-black/95 border border-white/10 rounded-md shadow-2xl p-2 hidden group-hover/profile:flex flex-col text-sm text-white/90 animate-fadeIn z-[90] backdrop-blur-md">
                <div className="absolute right-3.5 bottom-full w-0 h-0 border-b-[6px] border-b-black/95 border-x-[6px] border-x-transparent" />

                <div className="px-3 py-2 flex items-center gap-2.5 border-b border-white/10">
                  <div
                    className="w-6 h-6 rounded overflow-hidden flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-white relative"
                    style={{ background: '#E50914' }}
                  >
                    <span className="absolute">{avatarInitial}</span>
                    {avatarUrl && (
                      <img src={avatarUrl} decoding="async" className={`w-full h-full object-cover absolute inset-0 transition-opacity duration-300 ${avatarLoaded ? 'opacity-100' : 'opacity-0'}`} alt="" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold truncate leading-none text-white text-xs">
                      {settings.displayName || user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'User'}
                    </p>
                    <p className="text-[10px] text-white/40 truncate mt-0.5">{user?.email}</p>
                  </div>
                </div>

                <button
                  onClick={() => handleTabClick('settings')}
                  className="w-full text-left px-3 py-2 hover:bg-white/10 rounded transition-colors text-xs font-semibold mt-1"
                >
                  {t('nav.accountSettings')}
                </button>
                <button
                  onClick={() => handleTabClick('list')}
                  className="w-full text-left px-3 py-2 hover:bg-white/10 rounded transition-colors text-xs font-semibold"
                >
                  {t('nav.myList')}
                </button>

                <div className="h-px bg-white/10 my-1" />

                <button
                  onClick={() => { logout(); navigate('/'); }}
                  className="w-full text-left px-3 py-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors text-xs font-bold"
                >
                  {t('nav.logOut')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default Navbar;
