import React from 'react';
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

const Navbar: React.FC<NavbarProps> = ({ isScrolled, searchQuery, setSearchQuery, activeTab, setActiveTab }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { settings, user, logout } = useGlobalContext();
  const isSettings = location.pathname.startsWith('/settings');
  const isMobile = useIsMobile();
  const avatarUrl = settings.avatarUrl || DEFAULT_AVATAR;
  const avatarInitial = (settings.displayName?.[0] || user?.display_name?.[0] || 'P').toUpperCase();

  const navItems = [
    { id: 'home', label: t('nav.home', { defaultValue: 'Home' }) },
    { id: 'tv', label: t('nav.shows', { defaultValue: 'Series' }) },
    { id: 'movies', label: t('nav.movies', { defaultValue: 'Films' }) },
    { id: 'new', label: t('nav.newPopular', { defaultValue: 'New & Popular' }) },
    { id: 'list', label: t('nav.myList', { defaultValue: 'My List' }) },
  ];

  const handleTabClick = (tabId: string) => {
    setActiveTab(tabId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setSearchQuery('');
    
    if (tabId === 'settings') {
      navigate('/settings');
    } else if (tabId === 'home') {
      navigate('/');
    } else {
      navigate(`/${tabId}`);
    }
  };

  if (location.pathname === '/login') return null;

  // --- MOBILE LAYOUT RENDERING ---
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

  // --- DESKTOP LAYOUT RENDERING (Standard Layout) ---
  return (
    <nav
      className={`fixed top-0 w-full z-[80] transition-all duration-500 
        px-6 md:px-14 lg:px-16
        ${isSettings ? 'bg-white border-b border-gray-100' : (isScrolled ? 'bg-[#141414]/100' : 'bg-transparent')}
        ${isSettings ? 'pt-4 pb-4' : 'pt-[calc(1rem+env(safe-area-inset-top))] pb-3 md:py-4'}`}
    >
      <div className="flex items-center justify-between relative w-full">
        <div className="contents md:flex md:items-center md:space-x-4 md:space-x-8">
          <img
            src={pstreamWordmark}
            alt="Pstream"
            className={`h-8 sm:h-9 md:h-6 lg:h-7 cursor-pointer transition-transform hover:scale-105 relative z-10 md:static md:translate-x-0 absolute left-1/2 -translate-x-1/2`}
            onClick={() => handleTabClick('home')}
          />

          {!isSettings && (
            <ul className="hidden md:flex items-center space-x-4 lg:space-x-5 text-[13px] lg:text-[14px] tracking-[-0.2px] font-normal text-[#e5e5e5]">
              {navItems.map((item) => (
                <li
                  key={item.id}
                  onClick={() => handleTabClick(item.id)}
                  className={`cursor-pointer transition-colors whitespace-nowrap ${activeTab === item.id ? 'text-white font-bold' : 'hover:text-[#b3b3b3]'}`}
                >
                  {item.label}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex items-center space-x-3 md:space-x-5">
          {/* Search Bar — hidden on desktop settings */}
          {!isSettings && (
            <SearchBar
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
            />
          )}

          {/* Profile / Login — hidden on desktop settings */}
          <div className={`hidden md:flex items-center space-x-5 transition-all duration-300 ${isSettings ? 'md:hidden' : ''}`}>
              {!user ? (
                <button
                  onClick={() => navigate('/login')}
                  className="px-4 py-1.5 bg-[#e50914] text-white text-[13px] font-semibold rounded hover:bg-[#f40612] transition-colors shadow-lg active:scale-95"
                >
                  {t('nav.signIn')}
                </button>
              ) : (
                <div 
                  className="flex items-center space-x-2 cursor-pointer group/profile"
                  onClick={() => handleTabClick('settings')}
                >
                  {isSettings ? (
                    <button 
                      onClick={(e) => { e.stopPropagation(); logout(); navigate('/'); }}
                      className="text-sm font-bold text-black hover:underline px-4 py-2"
                    >
                      {t('nav.signOut')}
                    </button>
                  ) : (
                    <div
                      className="w-8 h-8 rounded overflow-hidden shadow-md group-hover/profile:ring-1 ring-white/50 transition-all flex items-center justify-center"
                      style={{ background: avatarUrl ? undefined : '#E50914' }}
                    >
                      {avatarUrl ? (
                        <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-white font-bold text-sm">{avatarInitial}</span>
                      )}
                    </div>
                  )}
                </div>
              )}
          </div>
        </div>
      </div>
      <div id="category-subnav-portal" className="w-full"></div>
    </nav>
  );
};

export default Navbar;