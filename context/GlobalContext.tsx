import React, { createContext, useState, useEffect, useCallback, useContext, ReactNode } from 'react';
import { Movie, AppSettings, Profile } from '../types';
import { setApiLanguage, fetchData } from '../services/api';
import { REQUESTS } from '../constants';
import i18n from '../i18n';
import Cookies from 'js-cookie';
import { useSettingsStore, DEFAULT_SETTINGS } from '../store/useSettingsStore';
export { DEFAULT_SETTINGS };
import { useWatchStore } from '../store/useWatchStore';
import { useLibraryStore } from '../store/useLibraryStore';
import { useAuthStore, activateProfile } from '../store/useAuthStore';
import { useProfileStore } from '../store/useProfileStore';
import { setGlobalKidsMode } from '../services/api';

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
  updateVideoState: (movieId: number | string | Movie, time: number, videoId?: string, duration?: number, forceSyncImmediate?: boolean) => void;
  getVideoState: (movieId: number | string) => VideoState | undefined;
  clearVideoState: (movieId: number | string) => void;
  updateEpisodeProgress: (showId: number | string | Movie, season: number, episode: number, time: number, duration: number, forceSyncImmediate?: boolean) => void;
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
  globalMute: boolean;
  setGlobalMute: (mute: boolean) => void;
  isKidsMode: boolean;
  activeProfile: Profile | undefined;
  profiles: Profile[];
  switchProfile: (profileId: string | null) => void;
  pageSeenIds: number[];
  registerSeenIds: (ids: number[]) => void;
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
  const updateProgress = useWatchStore(s => s.updateProgress);
  const getProgress = useWatchStore(s => s.getProgress);
  const removeHistoryItem = useWatchStore(s => s.removeHistoryItem);

  const libraryRatings = useLibraryStore(s => s.ratings);
  const libraryList = useLibraryStore(s => s.myList);
  const toggleMyList = useLibraryStore(s => s.toggleMyList);
  const setRating = useLibraryStore(s => s.setRating);
  const getRating = useLibraryStore(s => s.getRating);
  const getListArray = useLibraryStore(s => s.getListArray);

  const user = useAuthStore(s => s.user);
  const signOut = useAuthStore(s => s.signOut);

  const profiles = useProfileStore(s => s.profiles);
  const activeProfileId = useProfileStore(s => s.activeProfileId);
  const activeProfile = profiles.find(p => p.id === activeProfileId);
  const switchProfile = useCallback((profileId: string | null) => {
    activateProfile(profileId);
  }, []);

  const [isAppReady, setIsAppReady] = useState(false);

  // Every TMDB fetch funnels through services/tmdb.ts, which consults this
  // global flag live — flipping it here is what actually makes Home/Search/
  // Hero/Recommendations adapt to Kids mode across the whole app.
  useEffect(() => {
    setGlobalKidsMode(!!activeProfile?.isKids);
  }, [activeProfile?.isKids]);

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
  const [heroVideoState, _setHeroVideoState] = useState<GlobalContextType['heroVideoState']>({ time: 0, movie: null });
  const setHeroVideoState = useCallback((state: Partial<GlobalContextType['heroVideoState']>) => {
    _setHeroVideoState(prev => ({ ...prev, ...state }));
  }, []);

  useEffect(() => {
    fetchData(REQUESTS.fetchTrendingTV).then(res => { if (res) setTop10TV(res.slice(0, 10).map((m: any) => m.id)); });
    fetchData(REQUESTS.fetchTrendingMovies).then(res => { if (res) setTop10Movies(res.slice(0, 10).map((m: any) => m.id)); });
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
  const myList = React.useMemo(() => getListArray(), [libraryRatings, libraryList, getListArray]);
  
  const continueWatching = React.useMemo(() => {
    const latestPerTmdb: Record<string, typeof watchHistory[string]> = {};
    for (const key in watchHistory) {
      const entry = watchHistory[key];
      if (!entry.movieData) continue;
      const tmdbId = entry.tmdbId;
      const existing = latestPerTmdb[tmdbId];
      if (!existing || entry.updatedAt > existing.updatedAt) {
        latestPerTmdb[tmdbId] = entry;
      }
    }
    return Object.values(latestPerTmdb)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map(entry => entry.movieData!);
  }, [watchHistory]);

  const videoStates = React.useMemo(() => {
    const states: { [key: string]: VideoState } = {};
    const latestUpdate: Record<string, number> = {};
    for (const key in watchHistory) {
      const w = watchHistory[key];
      const existingTime = latestUpdate[w.tmdbId];
      if (existingTime === undefined || w.updatedAt > existingTime) {
        states[w.tmdbId] = { time: w.watchedTime, duration: w.duration };
        latestUpdate[w.tmdbId] = w.updatedAt;
      }
    }
    return states;
  }, [watchHistory]);

  const toggleList = useCallback((movie: Movie) => {
    toggleMyList(movie);
  }, [toggleMyList]);

  const addToHistory = useCallback((movie: Movie) => {
    updateProgress({
      tmdbId: String(movie.id),
      type: movie.media_type === 'tv' || movie.name ? 'tv' : 'movie',
      watchedTime: 0,
      duration: 0,
      movieData: movie
    });
  }, [updateProgress]);

  const getVideoState = useCallback((movieId: number | string) => {
    const state = getProgress(String(movieId));
    if (state) return { time: state.watchedTime, duration: state.duration };
    return undefined;
  }, [getProgress]);

  const updateVideoState = useCallback((movieOrId: string | number | Movie, time: number, videoId?: string, duration?: number, forceSyncImmediate?: boolean) => {
    const isMovieObj = typeof movieOrId === 'object' && movieOrId !== null && 'id' in movieOrId;
    const movieId = isMovieObj ? String((movieOrId as Movie).id) : String(movieOrId);
    const movieData = isMovieObj ? (movieOrId as Movie) : undefined;

    updateProgress({
      tmdbId: movieId,
      type: 'movie',
      watchedTime: time,
      duration: duration || 0,
      movieData
    }, forceSyncImmediate);
  }, [updateProgress]);

  const clearVideoState = useCallback((movieId: number | string) => {
    removeHistoryItem(String(movieId));
  }, [removeHistoryItem]);

  const updateEpisodeProgress = useCallback((showOrId: number | string | Movie, season: number, episode: number, time: number, duration: number, forceSyncImmediate?: boolean) => {
    const isMovieObj = typeof showOrId === 'object' && showOrId !== null && 'id' in showOrId;
    const showId = isMovieObj ? String((showOrId as Movie).id) : String(showOrId);
    const movieData = isMovieObj ? (showOrId as Movie) : undefined;

    updateProgress({
      tmdbId: showId,
      type: 'tv',
      season,
      episode,
      watchedTime: time,
      duration,
      movieData
    }, forceSyncImmediate);
  }, [updateProgress]);

  const getEpisodeProgress = useCallback((showId: number | string, season: number, episode: number) => {
    const state = getProgress(String(showId), season, episode);
    if (state) return { time: state.watchedTime, duration: state.duration, season, episode, updatedAt: state.updatedAt };
    return undefined;
  }, [getProgress]);

  const getLastWatchedEpisode = useCallback((showId: number | string) => {
    const showIdStr = String(showId);
    let latest: typeof watchHistory[string] | null = null;
    for (const key in watchHistory) {
      const w = watchHistory[key];
      if (w.tmdbId === showIdStr && w.type === 'tv') {
        if (!latest || w.updatedAt > latest.updatedAt) {
          latest = w;
        }
      }
    }
    if (!latest) return undefined;
    return { season: latest.season!, episode: latest.episode!, time: latest.watchedTime, duration: latest.duration };
  }, [watchHistory]);

  const rateMovie = useCallback((movie: Movie, rating: MovieRating) => {
    setRating(String(movie.id), movie.media_type === 'tv' || movie.name ? 'tv' : 'movie', rating, movie);
  }, [setRating]);

  const getMovieRating = useCallback((movieId: number | string) => {
    return getRating(String(movieId));
  }, [getRating]);

  const getLikedMovies = useCallback(() => {
    return Object.values(libraryRatings)
      .filter(r => r.rating === 'like' || r.rating === 'love')
      .map(r => ({ movie: r.movieData as Movie, rating: r.rating }));
  }, [libraryRatings]);

  const login = useCallback(async (_email: string, _password?: string, _isSignUp?: boolean) => {
    return { success: true };
  }, []);

  const logout = useCallback(() => {
    signOut();
  }, [signOut]);
  const deleteAccountData = useCallback(async () => { return true; }, []);
  const importProfileData = useCallback(async (_data: any) => { return true; }, []);

  return (
    <GlobalContext.Provider value={{
      myList, continueWatching, settings, toggleList, addToHistory, updateSettings,
      videoStates, updateVideoState, getVideoState, clearVideoState,
      updateEpisodeProgress, getEpisodeProgress, getLastWatchedEpisode,
      top10TV, top10Movies, rateMovie, getMovieRating, getLikedMovies,
      user, login, logout, deleteAccountData, importProfileData, syncStatus: 'synced',
      heroVideoState, setHeroVideoState,
      globalMute, setGlobalMute, isKidsMode: !!activeProfile?.isKids,
      activeProfile, profiles, switchProfile,
      pageSeenIds, registerSeenIds, clearSeenIds,
      isAppReady, setIsAppReady
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
