import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { Movie } from './types';
import useSearch from './hooks/useSearch';
import { useTitle } from './context/TitleContext';
import Cookies from 'js-cookie';
import { useTranslation } from 'react-i18next';
import { initCodecSupport } from './utils/browserCodecSupport';
import { useAuthStore } from './store/useAuthStore';
import { useWatchStore } from './store/useWatchStore';
import { LoginWall } from './components/LoginWall';

// Warm browser codec detection immediately on app load.
// By the time the user clicks Play, the profile is already cached.
initCodecSupport().then(p => {
  console.log(`[App] 🎵 Codec profile ready — AC3:${p.canPlayAC3} EAC3:${p.canPlayEAC3} Dolby:${p.isDolbyCapable} → transcode target: ${p.preferredTranscodeTarget}`);
});



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

const App: React.FC = () => {
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

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

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
  const modalMatch = location.pathname.match(/^\/title\/(movie|tv)\/(\d+)/);
  const isModalActive = !!modalMatch;
  const modalType = modalMatch ? modalMatch[1] : null;
  const modalId = modalMatch ? Number(modalMatch[2]) : null;

  // Determine background location for routing
  const backgroundLocation = location.state?.backgroundLocation || (isModalActive ? { pathname: '/' } : location);

  // Sync modal state from URL pathname
  useEffect(() => {
    if (modalType && modalId) {
      if (!selectedMovie || selectedMovie.id !== modalId || selectedMovie.media_type !== modalType) {
        setSelectedMovie({ id: modalId, media_type: modalType } as any);
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
  const isWatching = location.pathname.startsWith('/watch');
  const isSettings = location.pathname.startsWith('/settings');

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
        <Route path="*" element={<NotFoundPage />} />
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


  const mainContent = (
    <div>
      <Routes location={backgroundLocation}>
        <Route path="/" element={<HomePage onSelectMovie={handleSelectMovie} onPlay={handlePlay} seekTime={heroSeekTime} onViewAll={handleViewAll} />} />
        <Route path="/tv" element={<ShowsPage onSelectMovie={handleSelectMovie} onPlay={handlePlay} />} />
        <Route path="/movies" element={<MoviesPage onSelectMovie={handleSelectMovie} onPlay={handlePlay} seekTime={heroSeekTime} />} />
        <Route path="/new" element={<NewPopularPage onSelectMovie={handleSelectMovie} onPlay={handlePlay} />} />
        <Route path="/list" element={<MyListPage onSelectMovie={handleSelectMovie} onPlay={handlePlay} />} />
        <Route path="/settings/*" element={<SettingsPage />} />
        <Route path="/browse/:rowKey" element={<BrowseGridPage onSelectMovie={handleSelectMovie} onPlay={handlePlay} />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </div>
  );

  return (
    <div>
      <Layout
        searchQuery={query}
        setSearchQuery={handleSearchChange}
        activeTab={activeTab}
        setActiveTab={handleTabChange}
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
