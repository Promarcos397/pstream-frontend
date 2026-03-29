import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { Movie } from './types';
import useSearch from './hooks/useSearch';
import { useTitle } from './context/TitleContext';
import { useGlobalContext } from './context/GlobalContext';
import { prefetchStream } from './services/api';
import Cookies from 'js-cookie';
import { useTranslation } from 'react-i18next';
import { HeroEngine } from './services/HeroEngine';


// Components
import Layout from './components/Layout';
import InfoModal from './components/InfoModal';
import WatchPage from './pages/WatchPage';
// Pages
import HomePage from './pages/HomePage';
import ShowsPage from './pages/ShowsPage';
import MoviesPage from './pages/MoviesPage';
import NewPopularPage from './pages/NewPopularPage';
import MyListPage from './pages/MyListPage';
import SearchResultsPage from './pages/SearchResultsPage';
import SettingsPage from './pages/SettingsPage';
import LoginPage from './pages/LoginPage';

const App: React.FC = () => {
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const { query, setQuery, results, isLoading, mode, setMode } = useSearch();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { setPageTitle } = useTitle();
  const { updateVideoState } = useGlobalContext();
  const { t } = useTranslation();

  // Inject navigate into window for non-React context access
  useEffect(() => {
    (window as any).reactNavigate = navigate;
  }, [navigate]);

  // Sync search query from URL on mount
  useEffect(() => {
    const urlQuery = searchParams.get('q');
    if (urlQuery && !query) {
      setQuery(urlQuery);
    }
  }, []);

  // React Router Scroll Restoration
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [location.pathname]);

  // Prefetch last played on mount
  useEffect(() => {
    try {
      const last = Cookies.get('pstream-last-played');
      if (last) {
        const data = JSON.parse(last);
        if (data.id && data.title && data.year) {
          prefetchStream(data.title, data.year, String(data.id), data.type, data.season, data.episode);
        }
      }
    } catch (e) { }
    
    // Warm up the Hero Engines for all pages instantly
    HeroEngine.prepareAllHeroes();
  }, []);

  // Update page title based on route
  useEffect(() => {
    const path = location.pathname;
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
  }, [location.pathname, query, setPageTitle, t]);

  const [heroSeekTime, setHeroSeekTime] = useState(0);
  const [infoInitialTime, setInfoInitialTime] = useState(0);
  const [infoVideoId, setInfoVideoId] = useState<string | undefined>(undefined);

  // Scroll to top on route change
  useEffect(() => {
    if (!location.pathname.startsWith('/watch')) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [location.pathname]);

  const handleSelectMovie = (movie: Movie, time?: number, videoId?: string) => {
    setInfoInitialTime(time || 0);
    setInfoVideoId(videoId);
    setSelectedMovie(movie);
  };

  const handleCloseModal = (finalTime?: number) => {
    setSelectedMovie(null);
    setInfoVideoId(undefined);
    if (finalTime && finalTime > 0) {
      setHeroSeekTime(finalTime);
      if (selectedMovie) {
        updateVideoState(selectedMovie.id, finalTime);
      }
    }
  };

  const handlePlay = (movie: Movie, season?: number, episode?: number) => {
    const type = movie.media_type || (movie.title ? 'movie' : 'tv');
    let url = `/watch/${type}/${movie.id}`;
    if (season && episode) {
      url += `?season=${season}&episode=${episode}`;
    }

    const releaseDate = movie.release_date || movie.first_air_date;
    const year = releaseDate ? new Date(releaseDate).getFullYear() : undefined;
    const cookieData = {
      id: movie.id,
      tmdbId: String(movie.id),
      title: movie.title || movie.name,
      type,
      year,
      season: season || 1,
      episode: episode || 1,
      timestamp: Date.now()
    };
    
    Cookies.set('pstream-last-played', JSON.stringify(cookieData), { expires: 7 });
    navigate(url);
    setSelectedMovie(null);
  };

  const getActiveTab = () => {
    const path = location.pathname;
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
    setQuery('');
    if (tab === 'home') navigate('/');
    else navigate(`/${tab}`);
  };

  const handleSearchChange = (newQuery: string) => {
    setQuery(newQuery);
  };

  if (isWatching) {
    return (
      <Routes>
        <Route path="/watch/:type/:id" element={<WatchPage />} />
      </Routes>
    );
  }

  const mainContent = (
    <div key={location.pathname}>
      <Routes>
        <Route path="/" element={<HomePage onSelectMovie={handleSelectMovie} onPlay={handlePlay} seekTime={heroSeekTime} />} />
        <Route path="/tv" element={<ShowsPage onSelectMovie={handleSelectMovie} onPlay={handlePlay} />} />
        <Route path="/movies" element={<MoviesPage onSelectMovie={handleSelectMovie} onPlay={handlePlay} seekTime={heroSeekTime} />} />
        <Route path="/new" element={<NewPopularPage onSelectMovie={handleSelectMovie} />} />
        <Route path="/list" element={<MyListPage onSelectMovie={handleSelectMovie} />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/settings/*" element={<SettingsPage />} />
      </Routes>
    </div>
  );

  return (
    <div className={`${selectedMovie ? 'overflow-hidden h-screen' : ''}`}>
      {isSettings ? (
        mainContent
      ) : (
        <Layout
          searchQuery={query}
          setSearchQuery={handleSearchChange}
          activeTab={activeTab}
          setActiveTab={handleTabChange}
          showFooter={!query}
        >
          {query.trim().length > 0 ? (
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
      )}

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
