import React, { createContext, useState, useEffect, useCallback, useContext, ReactNode } from 'react';
import { Movie, AppSettings } from '../types';
import { setApiLanguage } from '../services/api';
import i18n from '../i18n';
import Cookies from 'js-cookie';
import { useSettingsStore, DEFAULT_SETTINGS } from '../store/useSettingsStore';
export { DEFAULT_SETTINGS };
import { useWatchStore } from '../store/useWatchStore';
import { useLibraryStore } from '../store/useLibraryStore';
import { useAuthStore } from '../store/useAuthStore';

// We keep the types for backwards compatibility
interface VideoState { time: number; duration?: number; videoId?: string; }
interface EpisodeProgress { time: number; duration: number; season: number; episode: number; updatedAt: number; }
type MovieRating = 'dislike' | 'like' | 'love';
interface LikedEntry { movie: Movie; rating: MovieRating; }

interface GlobalContextType {
  myList: Movie[];
  continueWatching: Movie[];
  settings: AppSettings;
  toggleList: (movie: Movie) => void;
  addToHistory: (movie: Movie) => void;
  updateSettings: (newSettings: Partial<AppSettings>) => void;
  videoStates: { [key: string]: VideoState };
  updateVideoState: (movieId: number | string, time: number, videoId?: string, duration?: number) => void;
  getVideoState: (movieId: number | string) => VideoState | undefined;
  clearVideoState: (movieId: number | string) => void;
  updateEpisodeProgress: (showId: number | string, season: number, episode: number, time: number, duration: number) => void;
  getEpisodeProgress: (showId: number | string, season: number, episode: number) => EpisodeProgress | undefined;
  getLastWatchedEpisode: (showId: number | string) => { season: number; episode: number; time: number; duration: number } | undefined;
  top10TV: number[];
  top10Movies: number[];
  rateMovie: (movie: Movie, rating: MovieRating) => void;
  getMovieRating: (movieId: number | string) => MovieRating | undefined;
  getLikedMovies: () => LikedEntry[];
  user: any;
  login: (email: string, password?: string, isSignUp?: boolean) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  deleteAccountData: () => Promise<boolean>;
  importProfileData: (data: any) => Promise<boolean>;
  syncStatus: 'idle' | 'syncing' | 'synced' | 'error';
  heroVideoState: { movieId?: number | string; videoId?: string; time: number; movie?: Movie | null; };
  setHeroVideoState: (state: Partial<GlobalContextType['heroVideoState']>) => void;
  activeVideoId: string | null;
  setActiveVideoId: React.Dispatch<React.SetStateAction<string | null>>;
  activePopupId: string | null;
  setActivePopupId: React.Dispatch<React.SetStateAction<string | null>>;
  globalMute: boolean;
  setGlobalMute: (mute: boolean) => void;
  isKidsMode: boolean;
  pageSeenIds: number[];
  registerSeenIds: (ids: number[]) => void;
  isScrolling: boolean;
  isAppReady: boolean;
  setIsAppReady: (ready: boolean) => void;
  clearSeenIds: () => void;
}

const GlobalContext = createContext<GlobalContextType | undefined>(undefined);

export const GlobalProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Zustand State mappings
  const settings = useSettingsStore(s => s.settings);
  const globalMute = useSettingsStore(s => s.globalMute);
  const updateSettings = useSettingsStore(s => s.updateSettings);
  const setGlobalMuteState = useSettingsStore(s => s.setGlobalMute);

  const watchHistory = useWatchStore(s => s.history);
  const watchStore = useWatchStore();

  const libraryRatings = useLibraryStore(s => s.ratings);
  const libraryList = useLibraryStore(s => s.myList);
  const libraryStore = useLibraryStore();

  const user = useAuthStore(s => s.user);
  const authStore = useAuthStore();

  const [isScrolling, setIsScrolling] = useState(false);
  const [isAppReady, setIsAppReady] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const handleScroll = () => {
      if (!isScrolling) setIsScrolling(true);
      clearTimeout(timer);
      timer = setTimeout(() => setIsScrolling(false), 60);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      clearTimeout(timer);
    };
  }, [isScrolling]);

  const setGlobalMute = useCallback((mute: boolean) => {
    setGlobalMuteState(mute);
    Cookies.set('muted_profile', String(mute), { expires: 365 });
  }, [setGlobalMuteState]);

  useEffect(() => {
    setApiLanguage(settings.displayLanguage);
    const langCode = settings.displayLanguage.split('-')[0];
    i18n.changeLanguage(langCode);
  }, [settings.displayLanguage]);

  const [top10TV, setTop10TV] = useState<number[]>([]);
  const [top10Movies, setTop10Movies] = useState<number[]>([]);
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const [activePopupId, setActivePopupId] = useState<string | null>(null);
  const [heroVideoState, _setHeroVideoState] = useState<GlobalContextType['heroVideoState']>({ time: 0, movie: null });
  const setHeroVideoState = useCallback((state: Partial<GlobalContextType['heroVideoState']>) => {
    _setHeroVideoState(prev => ({ ...prev, ...state }));
  }, []);

  useEffect(() => {
    import('../constants').then(({ REQUESTS }) => {
      import('../services/api').then(({ fetchData }) => {
        fetchData(REQUESTS.fetchTrendingTV).then(res => { if (res) setTop10TV(res.slice(0, 10).map((m: any) => m.id)); });
        fetchData(REQUESTS.fetchTrendingMovies).then(res => { if (res) setTop10Movies(res.slice(0, 10).map((m: any) => m.id)); });
      });
    });
  }, [settings.displayLanguage]);

  const [pageSeenIds, setPageSeenIds] = useState<number[]>([]);
  const registerSeenIds = useCallback((ids: number[]) => {
    setPageSeenIds(prev => {
      const next = [...prev, ...ids];
      return next.length > 45 ? next.slice(next.length - 45) : next;
    });
  }, []);
  const clearSeenIds = useCallback(() => { setPageSeenIds([]); }, []);

  // Shim Implementations
  const myList = React.useMemo(() => libraryStore.getListArray(), [libraryRatings, libraryList]);
  
  const continueWatching = React.useMemo(() => {
    const seen = new Set<string>();
    const list: Movie[] = [];
    Object.values(watchHistory)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .forEach(entry => {
        if (entry.movieData && !seen.has(entry.tmdbId)) {
          seen.add(entry.tmdbId);
          list.push(entry.movieData);
        }
      });
    return list;
  }, [watchHistory]);

  const videoStates = React.useMemo(() => {
    const states: { [key: string]: VideoState } = {};
    Object.values(watchHistory)
      .sort((a, b) => a.updatedAt - b.updatedAt)
      .forEach(w => {
        states[w.tmdbId] = { time: w.watchedTime, duration: w.duration };
      });
    return states;
  }, [watchHistory]);

  const toggleList = useCallback((movie: Movie) => {
    libraryStore.toggleMyList(movie);
  }, [libraryStore]);

  const addToHistory = useCallback((movie: Movie) => {
    watchStore.updateProgress({
      tmdbId: String(movie.id),
      type: movie.media_type === 'tv' || movie.name ? 'tv' : 'movie',
      watchedTime: 0,
      duration: 0,
      movieData: movie
    });
  }, [watchStore]);

  const updateVideoState = useCallback((movieId: string | number, time: number, videoId?: string, duration?: number) => {
    watchStore.updateProgress({
      tmdbId: String(movieId),
      type: 'movie',
      watchedTime: time,
      duration: duration || 0
    });
  }, [watchStore]);

  const getVideoState = useCallback((movieId: number | string) => {
    const state = watchStore.getProgress(String(movieId));
    if (state) return { time: state.watchedTime, duration: state.duration };
    return undefined;
  }, [watchStore]);

  const clearVideoState = useCallback((movieId: number | string) => {
    watchStore.removeHistoryItem(String(movieId));
  }, [watchStore]);

  const updateEpisodeProgress = useCallback((showId: number | string, season: number, episode: number, time: number, duration: number) => {
    watchStore.updateProgress({
      tmdbId: String(showId),
      type: 'tv',
      season,
      episode,
      watchedTime: time,
      duration
    });
  }, [watchStore]);

  const getEpisodeProgress = useCallback((showId: number | string, season: number, episode: number) => {
    const state = watchStore.getProgress(String(showId), season, episode);
    if (state) return { time: state.watchedTime, duration: state.duration, season, episode, updatedAt: state.updatedAt };
    return undefined;
  }, [watchStore]);

  const getLastWatchedEpisode = useCallback((showId: number | string) => {
    const hist = Object.values(watchHistory).filter(w => w.tmdbId === String(showId) && w.type === 'tv');
    if (hist.length === 0) return undefined;
    const latest = hist.sort((a, b) => b.updatedAt - a.updatedAt)[0];
    return { season: latest.season!, episode: latest.episode!, time: latest.watchedTime, duration: latest.duration };
  }, [watchHistory]);

  const rateMovie = useCallback((movie: Movie, rating: MovieRating) => {
    libraryStore.setRating(String(movie.id), movie.media_type === 'tv' || movie.name ? 'tv' : 'movie', rating, movie);
  }, [libraryStore]);

  const getMovieRating = useCallback((movieId: number | string) => {
    return libraryStore.getRating(String(movieId));
  }, [libraryStore]);

  const getLikedMovies = useCallback(() => {
    return Object.values(libraryRatings)
      .filter(r => r.rating === 'like' || r.rating === 'love')
      .map(r => ({ movie: r.movieData as Movie, rating: r.rating }));
  }, [libraryRatings]);

  const login = async (email: string, password?: string, isSignUp?: boolean) => {
    // This is handled by AuthWall now, but we keep signature for backwards compatibility
    return { success: true };
  };

  const logout = () => { authStore.signOut(); };
  const deleteAccountData = async () => { return true; };
  const importProfileData = async (data: any) => { return true; };

  return (
    <GlobalContext.Provider value={{
      myList, continueWatching, settings, toggleList, addToHistory, updateSettings,
      videoStates, updateVideoState, getVideoState, clearVideoState,
      updateEpisodeProgress, getEpisodeProgress, getLastWatchedEpisode,
      top10TV, top10Movies, rateMovie, getMovieRating, getLikedMovies,
      user, login, logout, deleteAccountData, importProfileData, syncStatus: 'synced',
      heroVideoState, setHeroVideoState, activeVideoId, setActiveVideoId,
      activePopupId, setActivePopupId,
      globalMute, setGlobalMute, isKidsMode: false, pageSeenIds, registerSeenIds, clearSeenIds,
      isScrolling, isAppReady, setIsAppReady
    }}>
      {children}
    </GlobalContext.Provider>
  );
};

export const useGlobalContext = () => {
  const context = useContext(GlobalContext);
  if (!context) throw new Error('useGlobalContext must be used within a GlobalProvider');
  return context;
};
