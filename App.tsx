import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
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

const TAB_ORDER = ['home', 'tv', 'movies', 'new', 'list', 'settings'];

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
  ease: [0.16, 1, 0.3, 1] as const, // premium Apple style easeOut
  duration: 0.42,
};



// Components
import Layout from './components/Layout';
import InfoModal from './components/InfoModal';
import WatchPage from './pages/CinemaPage';
// Pages
import HomePage from './pages/HomePage';
import ShowsPage from './pages/ShowsPage';
import MoviesPage from './pages/MoviesPage';
import NewPopularPage from './pages/NewPopularPage';
import MyListPage from './pages/MyListPage';
import SearchResultsPage from './pages/SearchResultsPage';
import SettingsPage from './pages/SettingsPage';
import BrowseGridPage from './pages/BrowseGridPage';
import LoginPage from './pages/LoginPage';
import GhostPage from './pages/GhostPage';
import NotFoundPage from './pages/NotFoundPage';
import { Navigate } from 'react-router-dom';
import { dimensionsAsMovies } from './data/notFoundDimensions';

const App: React.FC = () => {
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' ? window.innerWidth < 768 : false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
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

  // Inject navigate into window for non-React context access
  useEffect(() => {
    (window as any).reactNavigate = navigate;
  }, [navigate]);

  // Sync search query from URL — reactive on location change
  useEffect(() => {
    const urlQuery = searchParams.get('q');
    if (urlQuery) {
      setQuery(urlQuery);
    } else {
      setQuery('');
    }
  }, [location.search]);

  // Global search event — fired by cast/genre clicks in InfoModal & MovieCard
  // Avoids prop-drilling setQuery all the way down the tree
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


  // Detect if modal is active in pathname
  const modalMatch = location.pathname.match(/^\/title\/(movie|tv)\/([a-zA-Z0-9_-]+)/);
  const isModalActive = !!modalMatch;
  const modalType = modalMatch ? modalMatch[1] : null;
  const modalIdRaw = modalMatch ? modalMatch[2] : null;
  const modalId = modalIdRaw ? (isNaN(Number(modalIdRaw)) ? modalIdRaw : Number(modalIdRaw)) : null;

  // Determine background location for routing
  const backgroundLocation = location.state?.backgroundLocation || (isModalActive ? { pathname: '/' } : location);

  // Sync modal state from URL pathname
  useEffect(() => {
    if (modalType && modalId !== null) {
      if (!selectedMovie || selectedMovie.id !== modalId || selectedMovie.media_type !== modalType) {
        // Find existing movie from our custom 404 dimensions database if id starts with 'dim'
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


  // React Router Scroll Restoration — single scroll-to-top on route change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [backgroundLocation.pathname]);


  // Update page title based on route
  useEffect(() => {
    const path = backgroundLocation.pathname;
    if (path.startsWith('/watch')) return;

    if (query) {
      setPageTitle(t('nav.searchTitle', { query: query }));
    } else if (path === '/') {
      setPageTitle(t('nav.homeTitle'));
    } else if (path === '/tv') {
      setPageTitle(t('nav.showsTitle'));
    } else if (path === '/movies') {
      setPageTitle(t('nav.moviesTitle'));
    } else if (path === '/new') {
      setPageTitle(t('nav.newTitle'));
    } else if (path === '/list') {
      setPageTitle(t('nav.listTitle'));
    } else if (path.startsWith('/settings')) {
      setPageTitle(t('nav.settingsTitle'));
    } else {
      setPageTitle('');
    }
  }, [backgroundLocation.pathname, query, setPageTitle, t]);

  const [heroSeekTime, setHeroSeekTime] = useState(0);
  const [infoInitialTime, setInfoInitialTime] = useState(0);
  const [infoVideoId, setInfoVideoId] = useState<string | undefined>(undefined);


  const handleSelectMovie = (movie: Movie, time?: number, videoId?: string) => {
    setInfoInitialTime(time || 0);
    setInfoVideoId(videoId);
    setSelectedMovie(movie);
    
    const type = movie.media_type || (movie.title ? 'movie' : 'tv');
    const searchStr = location.search;
    navigate(`/title/${type}/${movie.id}${searchStr}`, {
      state: { backgroundLocation: location }
    });
  };

  const handleCloseModal = (finalTime?: number) => {
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
  };

  const handlePlay = (movie: Movie, season?: number, episode?: number) => {
    let finalSeason = season;
    let finalEpisode = episode;

    const type = movie.media_type || (movie.title ? 'movie' : 'tv');

    if (type === 'tv' && !finalSeason && !finalEpisode) {
      const lastWatched = getProgress(String(movie.id));
      if (lastWatched && lastWatched.season && lastWatched.episode) {
        finalSeason = lastWatched.season;
        finalEpisode = lastWatched.episode;
      } else {
        // Default to S1E1
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
  };

  const getActiveTab = () => {
    const path = backgroundLocation.pathname;
    if (path === '/') return 'home';
    if (path === '/tv') return 'tv';
    if (path === '/movies') return 'movies';
    if (path === '/new') return 'new';
    if (path === '/list') return 'list';
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

  const knownRoutes = ['/', '/tv', '/movies', '/new', '/list', '/login', '/ghost', '/matrix'];
  const is404Route = !knownRoutes.includes(backgroundLocation.pathname)
    && !backgroundLocation.pathname.startsWith('/settings')
    && !backgroundLocation.pathname.startsWith('/browse')
    && !backgroundLocation.pathname.startsWith('/watch')
    && !backgroundLocation.pathname.startsWith('/title');

  const handleTabChange = (tab: string) => {
    setQuery(''); //fixed "Double History Push" bug
    const newParams = new URLSearchParams(window.location.search);
    newParams.delete('q');
    setSearchParams(newParams, { replace: true });
  };

  const handleSearchChange = (newQuery: string) => {
    setQuery(newQuery);
    const newParams = new URLSearchParams(window.location.search);
    if (newQuery.trim().length > 0) {
      newParams.set('q', newQuery);
    } else {
      newParams.delete('q');
    }
    setSearchParams(newParams, { replace: true });
  };

  // View All: row title click → /browse/:rowKey?url=...&title=...
  const handleViewAll = (rowKey: string, fetchUrl: string, title: string) => {
    const params = new URLSearchParams({ url: fetchUrl, title });
    navigate(`/browse/${rowKey}?${params.toString()}`);
  };

  if (isWatching) {
    return (
      <Routes>
        <Route path="/watch/:type/:id" element={<WatchPage />} />
        <Route path="*" element={<NotFoundPage onSelectMovie={handleSelectMovie} onPlay={handlePlay} />} />
      </Routes>
    );
  }

  // Ghost admin panel — standalone, no nav, no footer
  if (location.pathname === '/ghost' || location.pathname === '/matrix') {
    return (
      <Routes>
        <Route path="/ghost"  element={<GhostPage />} />
        <Route path="/matrix" element={<Navigate to="/ghost" replace />} />
      </Routes>
    );
  }

  if (!isInitialized) {
    return <div className="h-screen w-screen bg-black flex items-center justify-center"></div>;
  }

  if (!user) {
    return <LoginPage />;
  }


  const innerRoutes = (
    <Routes location={backgroundLocation}>
      <Route path="/" element={<HomePage onSelectMovie={handleSelectMovie} onPlay={handlePlay} seekTime={heroSeekTime} onViewAll={handleViewAll} />} />
      <Route path="/tv" element={<ShowsPage onSelectMovie={handleSelectMovie} onPlay={handlePlay} />} />
      <Route path="/movies" element={<MoviesPage onSelectMovie={handleSelectMovie} onPlay={handlePlay} seekTime={heroSeekTime} />} />
      <Route path="/new" element={<NewPopularPage onSelectMovie={handleSelectMovie} onPlay={handlePlay} />} />
      <Route path="/list" element={<MyListPage onSelectMovie={handleSelectMovie} onPlay={handlePlay} />} />
      <Route path="/settings/*" element={<SettingsPage />} />
      <Route path="/browse/:rowKey" element={<BrowseGridPage onSelectMovie={handleSelectMovie} onPlay={handlePlay} />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="*" element={<NotFoundPage onSelectMovie={handleSelectMovie} onPlay={handlePlay} />} />
    </Routes>
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
    </div>
  );
}

export default App;
