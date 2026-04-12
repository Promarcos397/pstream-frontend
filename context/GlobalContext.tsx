import React, { createContext, useState, useEffect, useCallback, useContext, ReactNode } from 'react';
import { Movie, AppSettings } from '../types';
import { setApiLanguage } from '../services/api';
import { AuthService, UserProfile } from '../services/AuthService';
import { DEFAULT_AVATAR } from '../constants';
import i18n from '../i18n';
import { prefetchStream } from '../services/api';
import Cookies from 'js-cookie';

interface VideoState {
  time: number;
  duration?: number;
  videoId?: string;
}

interface EpisodeProgress {
  time: number;
  duration: number;
  season: number;
  episode: number;
  updatedAt: number;
}

type MovieRating = 'dislike' | 'like' | 'love';

interface LikedEntry {
  movie: Movie;
  rating: MovieRating;
}

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
  user: UserProfile | null;
  login: (mnemonic: string, displayName?: string, isSignUp?: boolean) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  deleteAccountData: () => Promise<boolean>;
  importProfileData: (data: any) => Promise<boolean>;
  syncStatus: 'idle' | 'syncing' | 'synced' | 'error';
  heroVideoState: {
    movieId?: number | string;
    videoId?: string;
    time: number;
    movie?: Movie | null;
  };
  setHeroVideoState: (state: Partial<GlobalContextType['heroVideoState']>) => void;
  activeVideoId: string | null;
  setActiveVideoId: React.Dispatch<React.SetStateAction<string | null>>;
  globalMute: boolean;
  setGlobalMute: (mute: boolean) => void;
  isKidsMode: boolean;
  pageSeenIds: number[];
  registerSeenIds: (ids: number[]) => void;
  clearSeenIds: () => void;
}

const GlobalContext = createContext<GlobalContextType | undefined>(undefined);

export const DEFAULT_SETTINGS: AppSettings = {
  autoplayPreviews: true,
  autoplayNextEpisode: true,
  showSubtitles: true,
  subtitleSize: 'medium',
  subtitleColor: 'white',
  subtitleBackground: 'none',
  subtitleOpacity: 75,
  subtitleBlur: 0,
  subtitleFontFamily: "'Harmonia Sans Mono', 'Consolas', monospace",
  subtitleEdgeStyle: 'drop-shadow',
  subtitleWindowColor: 'black',
  displayLanguage: 'en-US',
  subtitleLanguage: 'en',
  avatarUrl: DEFAULT_AVATAR,
  isKidsMode: false,
};

export const GlobalProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [myList, setMyList] = useState<Movie[]>(() => {
    try {
      const saved = localStorage.getItem('pstream-list');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const [continueWatching, setContinueWatching] = useState<Movie[]>(() => {
    try {
      const saved = localStorage.getItem('pstream-history');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem('pstream-settings');
      return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
    } catch { return DEFAULT_SETTINGS; }
  });

  const [videoStates, setVideoStates] = useState<{ [key: string]: VideoState }>(() => {
    try {
      const saved = localStorage.getItem('pstream-video-states');
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });

  const [episodeProgress, setEpisodeProgress] = useState<{ [key: string]: EpisodeProgress }>(() => {
    try {
      const saved = localStorage.getItem('pstream-episode-progress');
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });

  const [likedMovies, setLikedMovies] = useState<Record<string, LikedEntry>>(() => {
    try {
      const saved = localStorage.getItem('pstream-liked');
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });

  const [globalMute, setGlobalMuteState] = useState<boolean>(() => {
    const saved = Cookies.get('muted_profile');
    return saved === 'true'; 
  });

  const setGlobalMute = useCallback((mute: boolean) => {
    setGlobalMuteState(mute);
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const msUntilMidnight = Math.max(0, midnight.getTime() - now.getTime());
    const daysToMidnight = msUntilMidnight / (1000 * 60 * 60 * 24);
    Cookies.set('muted_profile', String(mute), { expires: daysToMidnight });
  }, []);

  const isKidsMode = settings.isKidsMode || false;

  useEffect(() => { localStorage.setItem('pstream-list', JSON.stringify(myList)); }, [myList]);
  useEffect(() => { localStorage.setItem('pstream-history', JSON.stringify(continueWatching)); }, [continueWatching]);
  useEffect(() => { localStorage.setItem('pstream-settings', JSON.stringify(settings)); }, [settings]);
  useEffect(() => { localStorage.setItem('pstream-episode-progress', JSON.stringify(episodeProgress)); }, [episodeProgress]);
  useEffect(() => { localStorage.setItem('pstream-video-states', JSON.stringify(videoStates)); }, [videoStates]);
  useEffect(() => { localStorage.setItem('pstream-liked', JSON.stringify(likedMovies)); }, [likedMovies]);

  const [user, setUser] = useState<UserProfile | null>(null);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');

  useEffect(() => {
    const restoreSession = async () => {
      const profile = await AuthService.getProfile();
      if (profile) {
        setUser(profile);
        if (profile.settings) setSettings(s => ({ ...s, ...profile.settings }));
        if (profile.list) setMyList(profile.list);
        if (profile.history) setContinueWatching(profile.history);
        if (profile.videoStates) setVideoStates(profile.videoStates);
        if (profile.episodeProgress) setEpisodeProgress(profile.episodeProgress);
        if (profile.likedMovies) setLikedMovies(profile.likedMovies);
      }
    };
    restoreSession();
  }, []);

  useEffect(() => {
    if (!user) return;
    const syncTimeout = setTimeout(() => {
      setSyncStatus('syncing');
      AuthService.syncProfile({
        settings,
        list: myList,
        history: continueWatching,
        videoStates,
        episodeProgress,
        likedMovies
      }).then(() => setSyncStatus('synced'))
        .catch(() => setSyncStatus('error'));
    }, 2000);
    return () => clearTimeout(syncTimeout);
  }, [user, settings, myList, continueWatching, videoStates, episodeProgress, likedMovies]);

  useEffect(() => {
    setApiLanguage(settings.displayLanguage);
    const langCode = settings.displayLanguage.split('-')[0];
    i18n.changeLanguage(langCode);
  }, [settings.displayLanguage]);

  const [top10TV, setTop10TV] = useState<number[]>([]);
  const [top10Movies, setTop10Movies] = useState<number[]>([]);
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
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

  const toggleList = useCallback((movie: Movie) => {
    setMyList(prev => {
      const exists = prev.find(m => m.id === movie.id);
      return exists ? prev.filter(m => m.id !== movie.id) : [...prev, movie];
    });
  }, []);

  const addToHistory = useCallback((movie: Movie) => {
    setContinueWatching(prev => {
      if (prev.length > 0 && prev[0].id === movie.id) return prev;
      const filtered = prev.filter(m => m.id !== movie.id);
      return [movie, ...filtered].slice(0, 20);
    });
  }, []);

  const updateSettings = useCallback((newSettings: Partial<AppSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  }, []);

  const updateVideoState = useCallback((movieId: number | string, time: number, videoId?: string, duration?: number) => {
    setVideoStates(prev => ({
      ...prev,
      [movieId]: { time, videoId: videoId || prev[movieId]?.videoId, duration: duration || prev[movieId]?.duration }
    }));
  }, []);

  const getVideoState = useCallback((movieId: number | string) => videoStates[movieId], [videoStates]);
  const clearVideoState = useCallback((movieId: number | string) => {
    setVideoStates(prev => {
      const next = { ...prev };
      delete next[movieId];
      return next;
    });
  }, []);

  const updateEpisodeProgress = useCallback((showId: number | string, season: number, episode: number, time: number, duration: number) => {
    const key = `${showId}-S${season}E${episode}`;
    setEpisodeProgress(prev => ({
      ...prev,
      [key]: { time, duration, season, episode, updatedAt: Date.now() }
    }));
  }, []);

  const getEpisodeProgress = useCallback((showId: number | string, season: number, episode: number) => {
    return episodeProgress[`${showId}-S${season}E${episode}`];
  }, [episodeProgress]);

  const getLastWatchedEpisode = useCallback((showId: number | string) => {
    const showPrefix = `${showId}-S`;
    let latest: any;
    for (const [key, value] of Object.entries(episodeProgress)) {
      if (key.startsWith(showPrefix)) {
        if (!latest || value.updatedAt > latest.updatedAt) latest = { ...value };
      }
    }
    return latest;
  }, [episodeProgress]);

  const rateMovie = useCallback((movie: Movie, rating: MovieRating) => {
    setLikedMovies(prev => {
      const key = String(movie.id);
      if (prev[key]?.rating === rating) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return { ...prev, [key]: { movie, rating } };
    });
  }, []);

  const getMovieRating = useCallback((movieId: number | string) => likedMovies[String(movieId)]?.rating, [likedMovies]);
  const getLikedMovies = useCallback(() => Object.values(likedMovies).filter(e => e.rating === 'like' || e.rating === 'love'), [likedMovies]);

  const clearAppData = useCallback(() => {
    setMyList([]); setContinueWatching([]); setSettings(DEFAULT_SETTINGS);
    setVideoStates({}); setEpisodeProgress({}); setLikedMovies({});
    // Only remove P-Stream's own keys — do NOT nuke unrelated browser storage
    const pstreamKeys = ['pstream-list', 'pstream-history', 'pstream-settings', 
      'pstream-episode-progress', 'pstream-video-states', 'pstream-liked', 'pstream_session_token'];
    pstreamKeys.forEach(key => localStorage.removeItem(key));
  }, []);

  const login = async (mnemonic: string, displayName?: string, isSignUp?: boolean) => {
    setSyncStatus('syncing');
    const result = await AuthService.login(mnemonic, displayName, isSignUp);
    if (result.success && result.profile) {
      setUser(result.profile);
      if (result.profile.settings) setSettings(s => ({ ...s, ...result.profile!.settings }));
      if (result.profile.list) setMyList(result.profile.list);
      if (result.profile.history) setContinueWatching(result.profile.history);
      setSyncStatus('synced');
      return { success: true };
    }
    setSyncStatus('error');
    return { success: false, error: result.error };
  };

  const logout = () => { AuthService.logout(); setUser(null); clearAppData(); };

  const deleteAccountData = async () => {
    if (!user) { clearAppData(); return true; }
    const success = await AuthService.deleteProfile();
    if (success) { logout(); return true; }
    return false;
  };

  const importProfileData = async (data: any) => {
    try {
      if (data.settings) setSettings(s => ({ ...s, ...data.settings }));
      if (data.myList) setMyList(data.myList);
      if (data.history) setContinueWatching(data.history);
      return true;
    } catch { return false; }
  };

  return (
    <GlobalContext.Provider value={{
      myList, continueWatching, settings, toggleList, addToHistory, updateSettings,
      videoStates, updateVideoState, getVideoState, clearVideoState,
      updateEpisodeProgress, getEpisodeProgress, getLastWatchedEpisode,
      top10TV, top10Movies, rateMovie, getMovieRating, getLikedMovies,
      user, login, logout, deleteAccountData, importProfileData, syncStatus,
      heroVideoState, setHeroVideoState, activeVideoId, setActiveVideoId,
      globalMute, setGlobalMute, isKidsMode, pageSeenIds, registerSeenIds, clearSeenIds
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
