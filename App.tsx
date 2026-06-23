import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { Routes, Route, useNavigate, useLocation, useSearchParams, Navigate } from 'react-router-dom';
import { Movie } from './types';
import useSearch from './hooks/useSearch';
import { useTitle } from './context/TitleContext';
import Cookies from 'js-cookie';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from './store/useAuthStore';
import { useWatchStore } from './store/useWatchStore';
import { LoginWall } from './components/LoginWall';
import { useCastStore } from './store/useCastStore';
import { AnimatePresence, motion } from 'framer-motion';

const TAB_ORDER = ['home', 'tv', 'movies', 'new', 'list', 'language', 'settings'];

const pageVariants = {
  initial: (dir: 'left' | 'right') => ({
    x: dir === 'right' ? '100%' : 0,
    zIndex: dir === 'right' ? 1 : 0,
  }),
  animate: (dir: 'left' | 'right') => ({
    x: 0,
    zIndex: dir === 'right' ? 1 : 0,
    position: 'relative' as const,
  }),
  exit: (dir: 'left' | 'right') => ({
    x: dir === 'right' ? 0 : '100%',
    zIndex: dir === 'right' ? 0 : 1,
    position: 'absolute' as const,
    top: 0,
    left: 0,
  }),
};

const pageTransition = {
  type: 'tween' as const,
  ease: [0.16, 1, 0.3, 1] as const,
  duration: 0.28,
};

// Components (always needed — eager)
import Layout from './components/Layout';
import InfoModal from './components/InfoModal';
import LoginPage from './pages/LoginPage';
import { dimensionsAsMovies } from './data/notFoundDimensions';

// Pages (lazy — each becomes its own split chunk)
const WatchPage        = lazy(() => import('./pages/CinemaPage'));
const HomePage         = lazy(() => import('./pages/HomePage'));
const ShowsPage        = lazy(() => import('./pages/ShowsPage'));
const MoviesPage       = lazy(() => import('./pages/MoviesPage'));
const NewPopularPage   = lazy(() => import('./pages/NewPopularPage'));
const MyListPage       = lazy(() => import('./pages/MyListPage'));
const SearchResultsPage = lazy(() => import('./pages/SearchResultsPage'));
const SettingsPage     = lazy(() => import('./pages/SettingsPage'));
const BrowseGridPage      = lazy(() => import('./pages/BrowseGridPage'));
const BrowseLanguagePage  = lazy(() => import('./pages/BrowseLanguagePage'));
const GhostPage           = lazy(() => import('./pages/GhostPage'));
const NotFoundPage     = lazy(() => import('./pages/NotFoundPage'));

// Prefetch nav pages + hero data during idle time
const idle = (window as any).requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 200));
idle(() => {
  import('./pages/HomePage');
  import('./pages/ShowsPage');
  import('./pages/MoviesPage');
  import('./pages/NewPopularPage');
  import('./pages/MyListPage');
  import('./pages/BrowseLanguagePage');
  // Warm hero data for all main pages so backdrop images are browser-cached before first visit
  import('./services/HeroEngine').then(({ HeroEngine }) => {
    HeroEngine.getHero('home');
    HeroEngine.getHero('tv');
    HeroEngine.getHero('movie');
    HeroEngine.getHero('new_popular');
  });
});

const PageFallback = <div className="h-screen w-screen bg-black" />;

const App: React.FC = () => {
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' ? window.innerWidth < 768 : false);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setIsMobile(window.innerWidth < 768);
      }, 150); // Debounced to prevent render thrashing
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timeoutId);
    };
  }, []);

  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const { query, setQuery, results, isLoading, mode, setMode } = useSearch();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const isMobileSearchActive = searchParams.get('search') === 'true';
  const { setPageTitle } = useTitle();
  const { t } = useTranslation();
  const { isInitialized, user, initializeAuth } = useAuthStore();
  const { updateProgress, getProgress } = useWatchStore();
  const { initializeCast } = useCastStore();

  useEffect(() => {
    initializeAuth();
    initializeCast();
  }, [initializeAuth, initializeCast]);

  useEffect(() => {
    (window as any).reactNavigate = navigate;
  }, [navigate]);

  useEffect(() => {
    const urlQuery = searchParams.get('q');
    if (urlQuery) {
      setQuery(urlQuery);
    } else {
      setQuery('');
    }
  }, [location.search, setQuery, searchParams]);

  useEffect(() => {
    const handler = (e: Event) => {
      const { query: q } = (e as CustomEvent<{ query: string }>).detail;
      if (q) {
        setQuery(q);
        const newParams = new URLSearchParams(window.location.search);
        newParams.set('q', q);
        setSearchParams(newParams);
      }
    };
    window.addEventListener('pstream:search', handler);
    return () => window.removeEventListener('pstream:search', handler);
  }, [setQuery, setSearchParams]);

  const modalMatch = location.pathname.match(/^\/title\/(movie|tv)\/([a-zA-Z0-9_-]+)/);
  const isModalActive = !!modalMatch;
  const modalType = modalMatch ? modalMatch[1] : null;
  const modalIdRaw = modalMatch ? modalMatch[2] : null;
  const modalId = modalIdRaw ? (isNaN(Number(modalIdRaw)) ? modalIdRaw : Number(modalIdRaw)) : null;

  const backgroundLocation = location.state?.backgroundLocation || (isModalActive ? { pathname: '/browse' } : location);

  useEffect(() => {
    if (modalType && modalId !== null) {
      if (!selectedMovie || selectedMovie.id !== modalId || selectedMovie.media_type !== modalType) {
        const isDim = typeof modalId === 'string' && modalId.startsWith('dim');
        let mappedMovie: Movie | null = null;
        if (isDim) {
          mappedMovie = dimensionsAsMovies.find((m: any) => m.id === modalId) || null;
        }
        setSelectedMovie(mappedMovie || ({ id: modalId, media_type: modalType } as any));
      }
    } else if (selectedMovie) {
      setSelectedMovie(null);
      setInfoVideoId(undefined);
    }
  }, [location.pathname, modalType, modalId, selectedMovie]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [backgroundLocation.pathname]);

  useEffect(() => {
    const path = backgroundLocation.pathname;
    if (path.startsWith('/watch')) return;

    if (query) {
      setPageTitle(t('nav.searchTitle', { query: query }));
    } else if (path === '/' || path === '/browse') {
      setPageTitle(t('nav.homeTitle'));
    } else if (path === '/browse/series') {
      setPageTitle(t('nav.showsTitle'));
    } else if (path === '/browse/films') {
      setPageTitle(t('nav.moviesTitle'));
    } else if (path === '/latest') {
      setPageTitle(t('nav.newTitle'));
    } else if (path === '/browse/my-list') {
      setPageTitle(t('nav.listTitle'));
    } else if (path === '/browse/language') {
      setPageTitle('Browse by Language');
    } else if (path.startsWith('/settings')) {
      setPageTitle(t('nav.settingsTitle'));
    } else {
      setPageTitle('');
    }
  }, [backgroundLocation.pathname, query, setPageTitle, t]);

  const [heroSeekTime, setHeroSeekTime] = useState(0);
  const [infoInitialTime, setInfoInitialTime] = useState(0);
  const [infoVideoId, setInfoVideoId] = useState<string | undefined>(undefined);

  const handleSelectMovie = useCallback((movie: Movie, time?: number, videoId?: string) => {
    setInfoInitialTime(time || 0);
    setInfoVideoId(videoId);
    setSelectedMovie(movie);
    
    const type = movie.media_type || (movie.title ? 'movie' : 'tv');
    const searchStr = location.search;
    navigate(`/title/${type}/${movie.id}${searchStr}`, {
      state: { backgroundLocation: location }
    });
  }, [location, navigate]);

  const handleCloseModal = useCallback((finalTime?: number) => {
    setSelectedMovie(null);
    setInfoVideoId(undefined);
    if (finalTime && finalTime > 0) {
      setHeroSeekTime(finalTime);
      if (selectedMovie) {
        updateProgress({
          tmdbId: String(selectedMovie.id),
          type: selectedMovie.media_type === 'tv' || selectedMovie.name ? 'tv' : 'movie',
          watchedTime: finalTime,
          duration: 0
        });
      }
    }
    
    if (location.state?.backgroundLocation) {
      navigate(-1);
    } else {
      const searchStr = location.search;
      navigate(`/${searchStr}`, { replace: true });
    }
  }, [location, navigate, selectedMovie, updateProgress]);

  const handlePlay = useCallback((movie: Movie, season?: number, episode?: number) => {
    let finalSeason = season;
    let finalEpisode = episode;
    const type = movie.media_type || (movie.title ? 'movie' : 'tv');

    if (type === 'tv' && !finalSeason && !finalEpisode) {
      const lastWatched = getProgress(String(movie.id));
      if (lastWatched && lastWatched.season && lastWatched.episode) {
        finalSeason = lastWatched.season;
        finalEpisode = lastWatched.episode;
      } else {
        finalSeason = 1;
        finalEpisode = 1;
      }
    }

    let url = `/watch/${type}/${movie.id}`;
    if (finalSeason && finalEpisode) {
      url += `?season=${finalSeason}&episode=${finalEpisode}`;
    }

    const releaseDate = movie.release_date || movie.first_air_date;
    const year = releaseDate ? new Date(releaseDate).getFullYear() : undefined;
    const cookieData = {
      id: movie.id,
      tmdbId: String(movie.id),
      title: movie.title || movie.name,
      type,
      year,
      season: finalSeason || 1,
      episode: finalEpisode || 1,
      timestamp: Date.now()
    };
    
    Cookies.set('pstream-last-played', JSON.stringify(cookieData), { expires: 7 });
    navigate(url);
    setSelectedMovie(null);
  }, [getProgress, navigate]);

  const getActiveTab = () => {
    const path = backgroundLocation.pathname;
    if (path === '/' || path === '/browse') return 'home';
    if (path === '/browse/series') return 'tv';
    if (path === '/browse/films') return 'movies';
    if (path === '/latest') return 'new';
    if (path === '/browse/my-list') return 'list';
    if (path === '/browse/language') return 'language';
    if (path.startsWith('/settings')) return 'settings';
    return 'home';
  };

  const activeTab = getActiveTab();
  const [prevTabState, setPrevTabState] = useState(() => {
    const idx = TAB_ORDER.indexOf(activeTab);
    return {
      activeTab,
      tabIndex: idx === -1 ? 0 : idx,
      dir: 'right' as 'left' | 'right'
    };
  });

  const dir = prevTabState.dir;

  if (
    prevTabState.activeTab !== activeTab ||
    (location.state?.direction && location.state.direction !== prevTabState.dir)
  ) {
    const currentIdx = TAB_ORDER.indexOf(activeTab) === -1 ? 0 : TAB_ORDER.indexOf(activeTab);
    const prevIdx = prevTabState.tabIndex;
    let nextDir: 'left' | 'right' = 'right';

    if (location.state?.direction) {
      nextDir = location.state.direction;
    } else if (currentIdx !== prevIdx) {
      nextDir = currentIdx > prevIdx ? 'right' : 'left';
    }

    setPrevTabState({
      activeTab,
      tabIndex: currentIdx,
      dir: nextDir
    });
  }

  const isWatching = location.pathname.startsWith('/watch');
  const isSettings = location.pathname.startsWith('/settings');

  const knownRoutes = ['/', '/browse', '/browse/series', '/browse/films', '/latest', '/browse/my-list', '/browse/language', '/login', '/ghost', '/matrix'];
  const is404Route = !knownRoutes.includes(backgroundLocation.pathname)
    && !backgroundLocation.pathname.startsWith('/settings')
    && !backgroundLocation.pathname.startsWith('/browse')
    && !backgroundLocation.pathname.startsWith('/watch')
    && !backgroundLocation.pathname.startsWith('/title');

  const handleTabChange = useCallback((tab: string) => {
    setQuery('');
    const newParams = new URLSearchParams(window.location.search);
    newParams.delete('q');
    setSearchParams(newParams, { replace: true });
  }, [setQuery, setSearchParams]);

  const handleSearchChange = useCallback((newQuery: string) => {
    setQuery(newQuery);
    const newParams = new URLSearchParams(window.location.search);
    if (newQuery.trim().length > 0) {
      newParams.set('q', newQuery);
    } else {
      newParams.delete('q');
    }
    setSearchParams(newParams, { replace: true });
  }, [setQuery, setSearchParams]);

  const handleViewAll = useCallback((rowKey: string, fetchUrl: string, title: string) => {
    const params = new URLSearchParams({ url: fetchUrl, title });
    navigate(`/browse/${rowKey}?${params.toString()}`);
  }, [navigate]);

// -------------------------------------------------------------
  // GLOBAL COLLISION ENGINE (Strictly for closing during scroll)
  // -------------------------------------------------------------
  useEffect(() => {
    const mousePos = { x: -1, y: -1 };
    
    const updateMouse = (e: MouseEvent) => {
      mousePos.x = e.clientX;
      mousePos.y = e.clientY;
    };
    
    window.addEventListener('mousemove', updateMouse);

    const handleScroll = () => {
      const { x, y } = mousePos;
      if (x < 0 || y < 0) return;
      
      const el = document.elementFromPoint(x, y);
      if (!el) return;

      // 1. If mouse is over an open popup, do nothing (keep it alive)
      if (el.closest('[data-popup="true"]')) return;

      // 2. We ONLY use scroll to CLOSE the old popup, NEVER to open a new one.
      const card = el.closest('[data-card="true"]');
      const cardId = card ? card.getAttribute('data-card-id') : null;
      
      // Dispatch check. Any currently open card will check if it's still under the mouse.
      window.dispatchEvent(new CustomEvent('pstream:scroll-check', { detail: { cardId } }));
    };

    window.addEventListener('scroll', handleScroll, true);
    
    return () => {
      window.removeEventListener('mousemove', updateMouse);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, []);
  
  if (isWatching) {
    return (
      <Suspense fallback={PageFallback}>
        <Routes>
          <Route path="/watch/:type/:id" element={<WatchPage />} />
          <Route path="*" element={<NotFoundPage onSelectMovie={handleSelectMovie} onPlay={handlePlay} />} />
        </Routes>
      </Suspense>
    );
  }

  if (location.pathname === '/ghost' || location.pathname === '/matrix') {
    return (
      <Suspense fallback={PageFallback}>
        <Routes>
          <Route path="/ghost"  element={<GhostPage />} />
          <Route path="/matrix" element={<Navigate to="/ghost" replace />} />
        </Routes>
      </Suspense>
    );
  }

  if (!isInitialized) {
    return <div className="h-screen w-screen bg-black flex items-center justify-center"></div>;
  }

  if (!user) {
    return <LoginPage />;
  }

  const innerRoutes = (
    <Suspense fallback={PageFallback}>
      <Routes location={backgroundLocation}>
        <Route path="/" element={<Navigate to="/browse" replace />} />
        <Route path="/browse" element={<HomePage onSelectMovie={handleSelectMovie} onPlay={handlePlay} seekTime={heroSeekTime} onViewAll={handleViewAll} />} />
        <Route path="/browse/series" element={<ShowsPage onSelectMovie={handleSelectMovie} onPlay={handlePlay} onViewAll={handleViewAll} />} />
        <Route path="/browse/films" element={<MoviesPage onSelectMovie={handleSelectMovie} onPlay={handlePlay} seekTime={heroSeekTime} onViewAll={handleViewAll} />} />
        <Route path="/latest" element={<NewPopularPage onSelectMovie={handleSelectMovie} onPlay={handlePlay} onViewAll={handleViewAll} />} />
        <Route path="/browse/my-list" element={<MyListPage onSelectMovie={handleSelectMovie} onPlay={handlePlay} />} />
        <Route path="/browse/language" element={<BrowseLanguagePage onSelectMovie={handleSelectMovie} onPlay={handlePlay} />} />
        <Route path="/settings/*" element={<SettingsPage />} />
        <Route path="/browse/:rowKey" element={<BrowseGridPage onSelectMovie={handleSelectMovie} onPlay={handlePlay} />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<NotFoundPage onSelectMovie={handleSelectMovie} onPlay={handlePlay} />} />
      </Routes>
    </Suspense>
  );

  const mainContent = isMobile ? (
    <div className="relative w-full overflow-hidden">
      <AnimatePresence mode="popLayout" initial={true} custom={dir}>
        <motion.div
          key={backgroundLocation.pathname}
          custom={dir}
          variants={pageVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={pageTransition}
          style={{
            willChange: 'transform',
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transform: 'translate3d(0,0,0)',
            WebkitTransform: 'translate3d(0,0,0)'
          }}
          className="w-full min-h-screen bg-black"
        >
          {innerRoutes}
        </motion.div>
      </AnimatePresence>
    </div>
  ) : (
    <div className="w-full min-h-screen bg-[#141414]">
      {innerRoutes}
    </div>
  );

  return (
    <div>
      <Layout
        searchQuery={query}
        setSearchQuery={handleSearchChange}
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        showFooter={!is404Route}
      >
        {query.trim().length > 0 || isMobileSearchActive ? (
          <SearchResultsPage
            query={query}
            results={results}
            onSelectMovie={handleSelectMovie}
            onPlay={handlePlay}
            isLoading={isLoading}
            mode={mode}
            setMode={setMode}
          />
        ) : (
          mainContent
        )}
      </Layout>

      <InfoModal
        movie={selectedMovie}
        initialTime={infoInitialTime}
        onClose={handleCloseModal}
        onPlay={handlePlay}
        trailerId={infoVideoId}
      />

      {/* Netflix-style popup overlay — fixed full-screen, pointer-events off so it doesn't block clicks */}
      <div
        id="popup-root"
        style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 100 }}
      />
    </div>
  );
}

export default App;