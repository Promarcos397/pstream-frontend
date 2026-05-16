import React, { useState, useRef, useEffect } from 'react';
import { MagnifyingGlassIcon, XIcon, ArrowSquareOutIcon } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { searchMovies } from '../services/api';
import { AnimatePresence, motion } from 'framer-motion';

// ── Admin easter egg ──────────────────────────────────────────────────────────
// Trigger: type "kryptoniteelement36" (no spaces, lowercase).
// Shows a minimal popup with a red "Open Admin" button → /ghost
const ADMIN_CODE = 'kryptoniteelement36';
const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, '');

interface SearchBarProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  /** Called when search active/inactive state changes (mobile: hide burger/avatar) */
  onActiveChange?: (active: boolean) => void;
}

const SearchBar: React.FC<SearchBarProps> = ({ searchQuery, setSearchQuery, onActiveChange }) => {
  const [isActive, setIsActive] = useState(false);
  const [adminEgg, setAdminEgg] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // Sync UI expansion from URL (deep-link + shareability)
  useEffect(() => {
    const qFromUrl = searchParams.get('q');
    if (qFromUrl && !isActive) {
      setIsActive(true);
    }
  }, [searchParams, isActive]);

  // Auto-focus when active
  useEffect(() => {
    if (isActive && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isActive]);

  // Notify parent when active state changes
  useEffect(() => {
    onActiveChange?.(isActive || !!searchQuery);
  }, [isActive, searchQuery, onActiveChange]);

  // Sync query to URL + detect easter egg
  useEffect(() => {
    // Easter egg detection
    if (normalize(searchQuery) === ADMIN_CODE) {
      setAdminEgg(true);
    } else {
      setAdminEgg(false);
    }

    if (!searchQuery) {
      if (location.search.includes('q=')) {
        navigate(location.pathname, { replace: true });
      }
      return;
    }
    const timer = setTimeout(() => {
      // Use manual string construction to enforce %20 encoding for spaces instead of +
      const queryString = searchQuery ? `?q=${encodeURIComponent(searchQuery)}` : '';
      navigate(`${location.pathname}${queryString}`, { replace: true });
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery, location.pathname, navigate]);

  // Click outside to collapse
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        // Only collapse if the input is NOT focused and there is no text.
        // This prevents autofill/autocorrect popups from closing the bar.
        const isInputFocused = document.activeElement === inputRef.current;
        if (!searchQuery && !isInputFocused) {
          setIsActive(false);
          onActiveChange?.(false);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [searchQuery, onActiveChange]);

  // Pre-fetching search results as user types (debounce: 500ms)
  useEffect(() => {
    if (!searchQuery || searchQuery.length < 3 || adminEgg) return;
    const timer = setTimeout(() => {
      searchMovies(searchQuery);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery, adminEgg]);

  const handleClear = (e: React.MouseEvent) => {
    e.preventDefault();
    setSearchQuery('');
    setAdminEgg(false);
    inputRef.current?.focus();
    navigate(location.pathname, { replace: true });
  };

  const closeSearch = () => {
    setIsActive(false);
    setSearchQuery('');
    setAdminEgg(false);
    navigate(location.pathname, { replace: true });
    onActiveChange?.(false);
  };

  const toggleSearch = () => {
    const next = !isActive;
    setIsActive(next);
    if (!next && !searchQuery) onActiveChange?.(false);
  };

  const effectiveActive = isActive || !!searchQuery;

  return (
    <div ref={containerRef} className="relative flex items-center">
      {/* ── Admin Easter Egg Popup ── */}
      <AnimatePresence>
        {adminEgg && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.97 }}
            transition={{ duration: 0.18, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="absolute bottom-[calc(100%+10px)] right-0 z-[9999] bg-[#141414] border border-zinc-700/60 rounded-md shadow-[0_8px_32px_rgba(0,0,0,0.7)] p-4 min-w-[220px] ring-1 ring-zinc-700/40"
          >
            <p className="text-white/50 text-[11px] uppercase tracking-[0.12em] font-medium mb-3">
              Access Detected
            </p>
            <p className="text-white text-sm font-semibold mb-4 leading-snug">
              Administrative overview
            </p>
            <button
              onClick={() => { closeSearch(); navigate('/ghost'); }}
              className="w-full flex items-center justify-center gap-2 bg-[#e50914] hover:bg-[#f40612] active:scale-[0.97] text-white text-sm font-bold px-4 py-2.5 rounded-[3px] transition-all duration-150"
            >
              <ArrowSquareOutIcon size={16} weight="bold" />
              Open Admin Panel
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Search Input ── */}
      <div
        className={`relative flex items-center transition-all duration-300 ease-out
          ${effectiveActive
            ? 'bg-black/80 border border-white w-[180px] sm:w-[220px] md:w-[280px]'
            : 'bg-transparent border border-transparent w-8'}
          p-1 overflow-hidden`}
      >
        <button
          onClick={toggleSearch}
          className="focus:outline-none flex items-center justify-center z-10 shrink-0"
          aria-label="Toggle Search"
          id="searchbar-toggle"
        >
          <MagnifyingGlassIcon
            size={24}
            className={`cursor-pointer select-none transition-colors duration-300 ${effectiveActive ? 'text-white' : 'text-white hover:text-gray-300'}`}
          />
        </button>

        <input
          ref={inputRef}
          type="text"
          placeholder={t('common.search')}
          className={`bg-transparent border-none outline-none text-white text-xs md:text-sm ml-2 transition-all duration-300 font-netflix
            ${effectiveActive ? 'w-full opacity-100' : 'w-0 opacity-0 pointer-events-none'}`}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Escape') closeSearch(); }}
          aria-label="Search movies and shows"
          id="search-input"
        />

        {/* Clear / Close Button */}
        {effectiveActive && (
          <button
            onMouseDown={searchQuery ? handleClear : closeSearch}
            className="text-white/70 hover:text-white cursor-pointer mx-1 flex-shrink-0 transition-all duration-200 hover:scale-125 active:scale-95"
            aria-label={searchQuery ? 'Clear search' : 'Close search'}
          >
            <XIcon size={20} />
          </button>
        )}
      </div>
    </div>
  );
};

export default SearchBar;
