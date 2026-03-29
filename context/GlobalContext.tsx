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

// Extended state for TV episode tracking
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
  // Episode-specific progress tracking
  updateEpisodeProgress: (showId: number | string, season: number, episode: number, time: number, duration: number) => void;
  getEpisodeProgress: (showId: number | string, season: number, episode: number) => EpisodeProgress | undefined;
  getLastWatchedEpisode: (showId: number | string) => { season: number; episode: number; time: number; duration: number } | undefined;
  top10TV: number[];
  top10Movies: number[];
  // Liked movies system
  rateMovie: (movie: Movie, rating: MovieRating) => void;
  getMovieRating: (movieId: number | string) => MovieRating | undefined;
  getLikedMovies: () => LikedEntry[];
  // Auth system
  user: UserProfile | null;
  login: (mnemonic: string, displayName?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  deleteAccountData: () => Promise<boolean>;
  importProfileData: (data: any) => Promise<boolean>;
  syncStatus: 'idle' | 'syncing' | 'synced' | 'error';
  // 🛰️ Real-time Video Sync (What is Hero/Card playing right now?)
  heroVideoState: {
    movieId?: number | string;
    videoId?: string;
    time: number;
    movie?: Movie | null;
  };
  setHeroVideoState: (state: Partial<GlobalContextType['heroVideoState']>) => void;
  // Universal Player Synchronizer
  activeVideoId: string | null;
  setActiveVideoId: (id: string | null) => void;
  // Universal Mute State
  globalMute: boolean;
  setGlobalMute: (mute: boolean) => void;
  // Deduplication system
  pageSeenIds: number[];
  registerSeenIds: (ids: number[]) => void;
  clearSeenIds: () => void;
}

const GlobalContext = createContext<GlobalContextType | undefined>(undefined);

export const DEFAULT_SETTINGS: AppSettings = {
  autoplayPreviews: true,
  autoplayNextEpisode: true,
  showSubtitles: true,
  subtitleSize: 'medium', // Default to medium
  subtitleColor: 'white',
  subtitleBackground: 'none',
  subtitleOpacity: 75,
  subtitleBlur: 0,
  subtitleFontFamily: "'Harmonia Sans Mono', 'Consolas', monospace", // Premium Harmonia Mono default
  subtitleEdgeStyle: 'drop-shadow',
  subtitleWindowColor: 'black',
  displayLanguage: 'en-US',
  subtitleLanguage: 'en',
  avatarUrl: DEFAULT_AVATAR,
};

export const GlobalProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // My List State
  const [myList, setMyList] = useState<Movie[]>(() => {
    try {
      const saved = localStorage.getItem('pstream-list');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Continue Watching History State
  const [continueWatching, setContinueWatching] = useState<Movie[]>(() => {
    try {
      const saved = localStorage.getItem('pstream-history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Settings State
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem('pstream-settings');
      return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  // Universal Mute State
  const [globalMute, setGlobalMuteState] = useState<boolean>(() => {
    const saved = Cookies.get('pstream-mute-state');
    return saved === 'flase'; // Default is false (unmuted)
  });

  const setGlobalMute = useCallback((mute: boolean) => {
    setGlobalMuteState(mute);
    Cookies.set('pstream-mute-state', String(mute), { expires: 365 });
  }, []);

  // Video Sync State (Persisted) - Stores movie progress
  const [videoStates, setVideoStates] = useState<{ [key: string]: VideoState }>(() => {
    try {
      const saved = localStorage.getItem('pstream-video-states');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Episode Progress State (Persisted) - keyed by "showId-SxEy"
  const [episodeProgress, setEpisodeProgress] = useState<{ [key: string]: EpisodeProgress }>(() => {
    try {
      const saved = localStorage.getItem('pstream-episode-progress');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Liked Movies State (dislike / like / love)
  const [likedMovies, setLikedMovies] = useState<Record<string, LikedEntry>>(() => {
    try {
      const saved = localStorage.getItem('pstream-liked');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Persist Local State Changes
  useEffect(() => { localStorage.setItem('pstream-list', JSON.stringify(myList)); }, [myList]);
  useEffect(() => { localStorage.setItem('pstream-history', JSON.stringify(continueWatching)); }, [continueWatching]);
  useEffect(() => { localStorage.setItem('pstream-settings', JSON.stringify(settings)); }, [settings]);
  useEffect(() => { localStorage.setItem('pstream-episode-progress', JSON.stringify(episodeProgress)); }, [episodeProgress]);
  useEffect(() => { localStorage.setItem('pstream-video-states', JSON.stringify(videoStates)); }, [videoStates]);
  useEffect(() => { localStorage.setItem('pstream-liked', JSON.stringify(likedMovies)); }, [likedMovies]);


  // Auth & Sync State
  const [user, setUser] = useState<UserProfile | null>(null);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');

  // Restore auth on mount
  useEffect(() => {
    const restoreSession = async () => {
      const profile = await AuthService.getProfile();
      if (profile) {
        setUser(profile);
        // Sync local state from cloud if profile exists
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

  // Sync state with cloud when modified (debounced)
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
  }, [user, settings, myList, continueWatching, videoStates, episodeProgress]);

  // Sync API and Interface language with settings
  useEffect(() => {
    setApiLanguage(settings.displayLanguage);
    const langCode = settings.displayLanguage.split('-')[0];
    i18n.changeLanguage(langCode);
  }, [settings.displayLanguage]);

  // Top 10 Tracking
  const [top10TV, setTop10TV] = useState<number[]>([]);
  const [top10Movies, setTop10Movies] = useState<number[]>([]);

  // Universal Player Synchronizer
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);

  // Global Hero Sync
  const [heroVideoState, _setHeroVideoState] = useState<GlobalContextType['heroVideoState']>({ time: 0, movie: null });
  const setHeroVideoState = useCallback((state: Partial<GlobalContextType['heroVideoState']>) => {
    _setHeroVideoState(prev => ({ ...prev, ...state }));
  }, []);

  useEffect(() => {
    import('../constants').then(({ REQUESTS }) => {
      import('../services/api').then(({ fetchData }) => {
        // Run requests asynchronously in the background
        fetchData(REQUESTS.fetchTrendingTV).then(res => {
          if (res) setTop10TV(res.slice(0, 10).map((m: any) => m.id));
        });
        fetchData(REQUESTS.fetchTrendingMovies).then(res => {
          if (res) setTop10Movies(res.slice(0, 10).map((m: any) => m.id));
        });
      });
    });
  }, [settings.displayLanguage]);

  // Page Deduplication State (Short-term memory: ~3 rows / 45 items)
  const [pageSeenIds, setPageSeenIds] = useState<number[]>([]);
  const registerSeenIds = useCallback((ids: number[]) => {
    setPageSeenIds(prev => {
      const next = [...prev, ...ids];
      // Keep only the most recent 45 items to allow huge blockbusters to reappear further down the page
      if (next.length > 45) return next.slice(next.length - 45);
      return next;
    });
  }, []);
  const clearSeenIds = useCallback(() => {
    setPageSeenIds([]);
  }, []);

  const toggleList = useCallback((movie: Movie) => {
    setMyList((prev) => {
      const exists = prev.find((m) => m.id === movie.id);
      if (exists) {
        return prev.filter((m) => m.id !== movie.id);
      }
      return [...prev, movie];
    });
  }, []);

  const addToHistory = useCallback((movie: Movie) => {
    setContinueWatching((prev) => {
      // Prevent redundant updates if the movie is already at the top
      if (prev.length > 0 && prev[0].id === movie.id) {
        return prev;
      }
      // Remove if exists to bubble it to the top
      const filtered = prev.filter((m) => m.id !== movie.id);
      // Add to front, limit to 20 items
      return [movie, ...filtered].slice(0, 20);
    });
  }, []);

  const updateSettings = useCallback((newSettings: Partial<AppSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  }, []);

  // Updated function to store both time and videoId
  // Updated function to store both time and videoId, and now duration
  const updateVideoState = useCallback((movieId: number | string, time: number, videoId?: string, duration?: number) => {
    setVideoStates(prev => ({
      ...prev,
      [movieId]: {
        time,
        videoId: videoId || prev[movieId]?.videoId,
        duration: duration || prev[movieId]?.duration
      }
    }));
  }, []);

  const getVideoState = useCallback((movieId: number | string): VideoState | undefined => {
    return videoStates[movieId];
  }, [videoStates]);

  const clearVideoState = useCallback((movieId: number | string) => {
    setVideoStates(prev => {
      const next = { ...prev };
      delete next[movieId];
      return next;
    });
  }, []);

  // Episode progress functions
  const updateEpisodeProgress = useCallback((showId: number | string, season: number, episode: number, time: number, duration: number) => {
    const key = `${showId}-S${season}E${episode}`;
    setEpisodeProgress(prev => ({
      ...prev,
      [key]: { time, duration, season, episode, updatedAt: Date.now() }
    }));
  }, []);

  const getEpisodeProgress = useCallback((showId: number | string, season: number, episode: number): EpisodeProgress | undefined => {
    const key = `${showId}-S${season}E${episode}`;
    return episodeProgress[key];
  }, [episodeProgress]);

  const getLastWatchedEpisode = useCallback((showId: number | string): { season: number; episode: number; time: number; duration: number } | undefined => {
    // Find the most recently watched episode for this show
    const showPrefix = `${showId}-S`;
    let latest: { season: number; episode: number; time: number; duration: number; updatedAt: number } | undefined;

    for (const [key, value] of Object.entries(episodeProgress)) {
      if (key.startsWith(showPrefix)) {
        if (!latest || value.updatedAt > latest.updatedAt) {
          latest = { season: value.season, episode: value.episode, time: value.time, duration: value.duration || 0, updatedAt: value.updatedAt };
        }
      }
    }

    return latest ? { season: latest.season, episode: latest.episode, time: latest.time, duration: latest.duration } : undefined;
  }, [episodeProgress]);

  // Liked movies functions
  const rateMovie = useCallback((movie: Movie, rating: MovieRating) => {
    setLikedMovies(prev => {
      const key = String(movie.id);
      // If same rating, toggle it off
      if (prev[key]?.rating === rating) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return { ...prev, [key]: { movie, rating } };
    });
  }, []);

  const getMovieRating = useCallback((movieId: number | string): MovieRating | undefined => {
    return likedMovies[String(movieId)]?.rating;
  }, [likedMovies]);

  const getLikedMovies = useCallback((): LikedEntry[] => {
    return Object.values(likedMovies).filter(e => e.rating === 'like' || e.rating === 'love');
  }, [likedMovies]);

  const clearAppData = useCallback(() => {
    setMyList([]);
    setContinueWatching([]);
    setSettings(DEFAULT_SETTINGS);
    setVideoStates({});
    setEpisodeProgress({});
    setLikedMovies({});
    // Also clear localStorage completely to prevent race conditions
    localStorage.removeItem('pstream-list');
    localStorage.removeItem('pstream-history');
    localStorage.removeItem('pstream-settings');
    localStorage.removeItem('pstream-video-states');
    localStorage.removeItem('pstream-episode-progress');
    localStorage.removeItem('pstream-liked');
  }, []);

  const login = async (mnemonic: string, displayName?: string) => {
    setSyncStatus('syncing');

    // Capture current local state (Guest data) for potential migration
    const guestData = {
      settings: { ...settings },
      list: [...myList],
      history: [...continueWatching],
      videoStates: { ...videoStates },
      episodeProgress: { ...episodeProgress },
      likedMovies: { ...likedMovies }
    };

    const result = await AuthService.login(mnemonic, displayName);
    if (result.success && result.profile) {
      const cloudProfile = result.profile;

      // SMART MIGRATION LOGIC:
      // If we are logging into a FRESH account (no settings, no list, no history),
      // we migrate the current Guest data to the cloud instead of wiping it.
      const isNewAccount = !cloudProfile.settings &&
        (!cloudProfile.list || cloudProfile.list.length === 0) &&
        (!cloudProfile.history || cloudProfile.history.length === 0);

      if (isNewAccount && (guestData.list.length > 0 || guestData.history.length > 0 || Object.keys(guestData.videoStates).length > 0)) {
        console.log('Sync Architecture: New account detected. Migrating detailed guest data (Watch Progress & Lists) to cloud...');
        // Push local data to the new account's cloud store
        await AuthService.syncProfile(guestData);
        setUser(cloudProfile);
        // We keep our local state as it's already what we want
      } else {
        // Standard Account Switch: Wipe local and load cloud truth
        clearAppData();
        setUser(cloudProfile);

        // Apply cloud data
        if (cloudProfile.settings) setSettings(s => ({ ...s, ...cloudProfile.settings }));
        if (cloudProfile.list) setMyList(cloudProfile.list);
        if (cloudProfile.history) setContinueWatching(cloudProfile.history);
        if (cloudProfile.videoStates) setVideoStates(cloudProfile.videoStates);
        if (cloudProfile.episodeProgress) setEpisodeProgress(cloudProfile.episodeProgress);
      }

      setSyncStatus('synced');
      return { success: true };
    }
    setSyncStatus('error');
    return { success: false, error: result.error };
  };

  const logout = () => {
    AuthService.logout();
    setUser(null);
    clearAppData();
  };

  const deleteAccountData = async () => {
    if (!user) {
      clearAppData();
      return true;
    }
    const success = await AuthService.deleteProfile();
    if (success) {
      logout();
      return true;
    }
    return false;
  };

  // --- PRE-LOADING SYSTEM ---
  useEffect(() => {
    const lastWatched = continueWatching[0];
    if (lastWatched) {
      console.log(`[GlobalContext] Pre-loading last watched: ${lastWatched.title || lastWatched.name}`);
      const mediaType = lastWatched.media_type || (lastWatched.title ? 'movie' : 'tv');
      const releaseDate = lastWatched.release_date || lastWatched.first_air_date;
      const year = releaseDate ? new Date(releaseDate).getFullYear() : undefined;

      // Determine resume point (default 1,1 for movies or first episodes)
      let s = 1, e = 1;
      if (mediaType === 'tv') {
        const lastEp = getLastWatchedEpisode(String(lastWatched.id));
        if (lastEp) {
          s = lastEp.season;
          e = lastEp.episode;
        }
      }

      prefetchStream(
        lastWatched.title || lastWatched.name || '',
        year,
        String(lastWatched.id),
        mediaType as 'movie' | 'tv',
        s,
        e,
        lastWatched.imdb_id
      );
    }
  }, [continueWatching[0]?.id]);

  const importProfileData = async (data: any) => {
    try {
      if (!data) return false;

      const parsedSettings = typeof data.settings === 'string' ? JSON.parse(data.settings) : data.settings;
      const parsedList = typeof data.myList === 'string' ? JSON.parse(data.myList) : (data.myList || []);
      const parsedHistory = typeof data.history === 'string' ? JSON.parse(data.history) : (data.history || []);
      const parsedVideoStates = typeof data.videoStates === 'string' ? JSON.parse(data.videoStates) : (data.videoStates || {});
      const parsedEpisodeProgress = typeof data.episodeProgress === 'string' ? JSON.parse(data.episodeProgress) : (data.episodeProgress || {});
      const parsedLikedMovies = typeof data.likedMovies === 'string' ? JSON.parse(data.likedMovies) : (data.likedMovies || {});

      if (parsedSettings) setSettings(s => ({ ...s, ...parsedSettings }));
      if (parsedList) setMyList(parsedList);
      if (parsedHistory) setContinueWatching(parsedHistory);
      if (parsedVideoStates) setVideoStates(parsedVideoStates);
      if (parsedEpisodeProgress) setEpisodeProgress(parsedEpisodeProgress);
      if (parsedLikedMovies) setLikedMovies(parsedLikedMovies);

      // If logged in, trigger a sync to save imported data to cloud
      if (user) {
        setSyncStatus('syncing');
        await AuthService.syncProfile({
          settings: parsedSettings || settings,
          list: parsedList || myList,
          history: parsedHistory || continueWatching,
          videoStates: parsedVideoStates || videoStates,
          episodeProgress: parsedEpisodeProgress || episodeProgress,
          likedMovies: parsedLikedMovies || likedMovies
        });
        setSyncStatus('synced');
      }

      return true;
    } catch (error) {
      console.error('Import failed:', error);
      setSyncStatus('error');
      return false;
    }
  };

  return (
    <GlobalContext.Provider value={{
      myList,
      continueWatching,
      settings,
      toggleList,
      addToHistory,
      updateSettings,
      videoStates,
      updateVideoState,
      getVideoState,
      clearVideoState,
      updateEpisodeProgress,
      getEpisodeProgress,
      getLastWatchedEpisode,
      top10TV,
      top10Movies,
      rateMovie,
      getMovieRating,
      getLikedMovies,
      user,
      login,
      logout,
      deleteAccountData,
      importProfileData,
      syncStatus,
      heroVideoState,
      setHeroVideoState,
      activeVideoId,
      setActiveVideoId,
      globalMute,
      setGlobalMute,
      pageSeenIds,
      registerSeenIds,
      clearSeenIds
    }}>
      {children}
    </GlobalContext.Provider>
  );
};

export const useGlobalContext = () => {
  const context = useContext(GlobalContext);
  if (!context) {
    throw new Error('useGlobalContext must be used within a GlobalProvider');
  }
  return context;
};
