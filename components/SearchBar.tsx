import React, { useState, useRef, useEffect } from 'react';
import { MagnifyingGlassIcon, XIcon } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { searchMovies } from '../services/api';

interface SearchBarProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  /** Called when search active/inactive state changes (mobile: hide burger/avatar) */
  onActiveChange?: (active: boolean) => void;
}

const SearchBar: React.FC<SearchBarProps> = ({ searchQuery, setSearchQuery, onActiveChange }) => {
  const [isActive, setIsActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // On mount, restore query from URL ?q= param (deep-link support)
  useEffect(() => {
    const qFromUrl = searchParams.get('q');
    if (qFromUrl && qFromUrl !== searchQuery) {
      setSearchQuery(qFromUrl);
      setIsActive(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Sync query to URL for shareability / deep-linking
  useEffect(() => {
    if (!searchQuery) {
      // Remove ?q= from URL if cleared
      if (location.search.includes('q=')) {
        navigate(location.pathname, { replace: true });
      }
      return;
    }
    const timer = setTimeout(() => {
      const params = new URLSearchParams(location.search);
      params.set('q', searchQuery);
      navigate(`${location.pathname}?${params.toString()}`, { replace: true });
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery, location.pathname, navigate]);

  // Click outside to collapse
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        if (!searchQuery) {
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
    if (!searchQuery || searchQuery.length < 3) return;
    const timer = setTimeout(() => {
      searchMovies(searchQuery);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleClear = (e: React.MouseEvent) => {
    e.preventDefault();
    setSearchQuery('');
    inputRef.current?.focus();
    // Remove q from URL
    navigate(location.pathname, { replace: true });
  };

  const closeSearch = () => {
    setIsActive(false);
    setSearchQuery('');
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
    <div
      ref={containerRef}
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
        className={`bg-transparent border-none outline-none text-white text-xs md:text-sm ml-2 transition-all duration-300 font-harmonia-condensed
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
          className="text-white/70 hover:text-white cursor-pointer mx-1 flex-shrink-0 transition-opacity"
          aria-label={searchQuery ? 'Clear search' : 'Close search'}
        >
          <XIcon size={20} />
        </button>
      )}
    </div>
  );
};

export default SearchBar;
