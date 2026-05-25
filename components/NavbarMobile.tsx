import React, { useState, useEffect, useRef } from 'react';
import { House, Sparkle, Bookmark } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useGlobalContext } from '../context/GlobalContext';
import { DEFAULT_AVATAR } from '../constants';
import pLogo from '../assets/logos/pstream-logo.svg';

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
  
  const avatarUrl = settings.avatarUrl || DEFAULT_AVATAR;
  const avatarInitial = (settings.displayName?.[0] || user?.display_name?.[0] || 'P').toUpperCase();

  // Progressive scroll transition listener
  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Initial check
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Calculate opacity over a short 50px distance for instant welding/solid look upon scroll
  const maxScroll = 50;
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

  return (
    <>
      {/* Mobile Top Header (Netflix style) */}
      <header
        style={{
          backgroundColor: `rgba(20, 20, 20, ${opacity})`
        }}
        className="fixed top-0 left-0 right-0 z-[80] px-6 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-3 transition-all duration-300 ease-out border-none shadow-none translate-y-0"
      >
        {isSearchActive ? (
          // Search Input Row
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
        ) : (
          // Standard Header Row
          <div className="flex items-center justify-center py-1">
            <img
              src={pLogo}
              alt="Pstream Logo"
              onClick={() => handleMobileTabClick('home')}
              className="h-[34px] w-auto cursor-pointer select-none transition-transform active:scale-95"
            />
          </div>
        )}
      </header>

      {/* Mobile Bottom Navigation Bar (Solid dark rectangle at the bottom) */}
      <div className="fixed bottom-0 left-0 right-0 z-[90] w-full bg-[#141414] pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 px-4 shadow-[0_-4px_24px_rgba(0,0,0,0.5)] border-none">
        <div className="grid grid-cols-4 items-center justify-around w-full">
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
            className={`flex flex-col items-center justify-center cursor-pointer transition-colors duration-200 py-1
              ${activeTab === 'home' && !isSearchActive ? 'text-white' : 'text-white/45 hover:text-white/80'}`}
          >
            <House size={22} weight={activeTab === 'home' && !isSearchActive ? 'fill' : 'regular'} />
            <span className="text-[10px] mt-1 font-semibold tracking-wide">Home</span>
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
            className={`flex flex-col items-center justify-center cursor-pointer transition-colors duration-200 py-1
              ${activeTab === 'list' && !isSearchActive ? 'text-white' : 'text-white/45 hover:text-white/80'}`}
          >
            <Bookmark size={22} weight={activeTab === 'list' && !isSearchActive ? 'fill' : 'regular'} />
            <span className="text-[10px] mt-1 font-semibold tracking-wide">My List</span>
          </div>

          {/* Search */}
          <div
            onClick={() => {
              setIsSearchActive(true);
              const newParams = new URLSearchParams(window.location.search);
              newParams.set('search', 'true');
              setSearchParams(newParams, { replace: true });
            }}
            className={`flex flex-col items-center justify-center cursor-pointer transition-colors duration-200 py-1
              ${isSearchActive ? 'text-white' : 'text-white/45 hover:text-white/80'}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="w-[22px] h-[22px] shrink-0">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <span className="text-[10px] mt-1 font-semibold tracking-wide">Search</span>
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
            className={`flex flex-col items-center justify-center cursor-pointer transition-colors duration-200 py-1
              ${activeTab === 'settings' && !isSearchActive ? 'text-white' : 'text-white/45 hover:text-white/80'}`}
          >
            <div
              className={`w-[22px] h-[22px] rounded overflow-hidden flex items-center justify-center bg-[#E50914] text-white font-bold text-[10px] ring-1 transition-all duration-200 shrink-0
                ${activeTab === 'settings' ? 'ring-white scale-105' : 'ring-transparent'}`}
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <span>{avatarInitial}</span>
              )}
            </div>
            <span className="text-[10px] mt-1 font-semibold tracking-wide">Profile</span>
          </div>
        </div>
      </div>
    </>
  );
};

export default NavbarMobile;
