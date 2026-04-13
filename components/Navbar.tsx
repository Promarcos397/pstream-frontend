import React, { useState } from 'react';
import { ListIcon, XIcon } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import SearchBar from './SearchBar';
import pstreamLogo from '../assets/pstream-logo.png';
import { useGlobalContext } from '../context/GlobalContext';
import { useNavigate, useLocation } from 'react-router-dom';

interface NavbarProps {
  isScrolled: boolean;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const Navbar: React.FC<NavbarProps> = ({ isScrolled, searchQuery, setSearchQuery, activeTab, setActiveTab }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSearchActive, setMobileSearchActive] = useState(false);
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { settings, user, logout } = useGlobalContext();
  const isSettings = location.pathname.startsWith('/settings');

  const navItems = [
    { id: 'home', label: t('nav.home', { defaultValue: 'Home' }) },
    { id: 'tv', label: t('nav.shows', { defaultValue: 'Series' }) },
    { id: 'movies', label: t('nav.movies', { defaultValue: 'Films' }) },
    { id: 'new', label: t('nav.newPopular', { defaultValue: 'New & Popular' }) },
    { id: 'list', label: t('nav.myList', { defaultValue: 'My List' }) },
  ];

  const handleTabClick = (tabId: string) => {
    setActiveTab(tabId);
    setMobileMenuOpen(false);
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

  return (
    <nav
      className={`fixed top-0 w-full z-[80] transition-all duration-500 
        px-6 md:px-14 lg:px-16
        ${isSettings ? 'bg-white border-b border-gray-100' : (isScrolled || mobileMenuOpen ? 'bg-[#141414]/90 backdrop-blur-md shadow-2xl' : 'bg-gradient-to-b from-black/60 via-black/20 to-transparent')}
        ${isSettings ? 'pt-4 pb-4' : 'pt-[calc(1rem+env(safe-area-inset-top))] pb-3 md:py-4'}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4 md:space-x-8">
          <img
            src={pstreamLogo}
            alt="P-Stream"
            className={`h-4 sm:h-5 md:h-6 lg:h-7 cursor-pointer drop-shadow-md transition-transform hover:scale-105 relative z-10 ${isSettings ? 'brightness-100' : ''}`}
            onClick={() => handleTabClick('home')}
          />

          {!isSettings && (
            <ul className="hidden md:flex items-center space-x-5 lg:space-x-6 text-[13px] lg:text-[15px] font-normal text-[#e5e5e5]">
              {navItems.map((item) => (
                <li
                  key={item.id}
                  onClick={() => handleTabClick(item.id)}
                  className={`cursor-pointer transition-colors whitespace-nowrap text-shadow-minimal ${activeTab === item.id ? 'text-white font-semibold' : 'hover:text-[#b3b3b3]'}`}
                >
                  {item.label}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex items-center space-x-3 md:space-x-5">
          {/* Search Bar — expands to fill; on mobile hides burger+avatar when active */}
          {!isSettings && activeTab !== 'settings' && (
            <SearchBar
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              onActiveChange={(active) => setMobileSearchActive(active)}
            />
          )}

          {/* Profile / Login — hidden on mobile when search is active */}
          <div className={`flex items-center space-x-5 transition-all duration-300 ${mobileSearchActive ? 'md:flex hidden' : 'flex'}`}>
              {/* Profile Dropdown & Sign In */}
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
                    <div className="w-8 h-8 rounded overflow-hidden shadow-md group-hover/profile:ring-1 ring-white/50 transition-all">
                      <img
                        src={settings.avatarUrl || 'https://mir-s3-cdn-cf.behance.net/project_modules/disp/10f13517652934.562bcce9bc38d.png'}
                        alt="Profile"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                </div>
              )}
          </div>

          {/* Burger menu — hidden on mobile when search is active */}
          {!isSettings && (
            <div
              className={`md:hidden flex items-center ml-2 transition-all duration-300 ${mobileSearchActive ? 'opacity-0 pointer-events-none w-0 overflow-hidden' : 'opacity-100'}`}
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <XIcon size={24} className="text-white cursor-pointer" /> : <ListIcon size={24} className="text-white cursor-pointer" />}
            </div>
          )}
        </div>
      </div>

      {!isSettings && mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 top-0 left-0 w-full h-screen bg-[#141414]/95 backdrop-blur-md flex flex-col items-center justify-center py-20 space-y-8 animate-fadeIn z-[100] transition-all overflow-y-auto">
          <div className="absolute top-6 right-6" onClick={() => setMobileMenuOpen(false)}>
            <XIcon size={32} className="text-white cursor-pointer hover:text-red-500 transition-colors" />
          </div>
          {navItems.map((item) => (
            <div
              key={item.id}
              onClick={() => handleTabClick(item.id)}
              className={`text-2xl font-bold tracking-tight text-shadow-hard transition-all duration-300 hover:scale-110 ${activeTab === item.id ? 'text-white' : 'text-gray-500 hover:text-white'}`}
            >
              {item.label}
            </div>
          ))}
          {user && (
            <div
              onClick={() => handleTabClick('settings')}
              className={`text-2xl font-bold tracking-tight text-shadow-hard transition-all duration-300 hover:scale-110 ${activeTab === 'settings' ? 'text-white' : 'text-gray-500 hover:text-white'}`}
            >
              {t('nav.accountSettings')}
            </div>
          )}
          {!user && (
            <button 
              onClick={() => { setMobileMenuOpen(false); navigate('/login'); }}
              className="px-8 py-3 bg-[#e50914] text-white font-bold rounded uppercase tracking-widest text-sm"
            >
              {t('nav.signIn')}
            </button>
          )}
          <div className="pt-10">
             <img src={pstreamLogo} alt="P-Stream" className="h-7 opacity-40" />
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;