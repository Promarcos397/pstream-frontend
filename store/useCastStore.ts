import { create } from 'zustand';

export type CastState = 'NO_DEVICES_AVAILABLE' | 'NOT_CONNECTED' | 'CONNECTING' | 'CONNECTED';

interface CastStore {
  castState: CastState;
  isChromecastAvailable: boolean;
  isChromecastConnected: boolean;
  isChromecastConnecting: boolean;
  isAirPlayAvailable: boolean;
  isAirPlayActive: boolean;
  isSdkLoaded: boolean;
  initializeCast: () => void;
  setCastState: (state: CastState) => void;
  setAirPlayAvailable: (available: boolean) => void;
  setAirPlayActive: (active: boolean) => void;
  startAirPlay: () => void;
  startChromecast: () => Promise<void>;
}

export const useCastStore = create<CastStore>((set, get) => {
  let activeVideo: HTMLVideoElement | null = null;
  let cleanupAvailabilityListener: (() => void) | null = null;

  return {
    castState: 'NO_DEVICES_AVAILABLE',
    isChromecastAvailable: false,
    isChromecastConnected: false,
    isChromecastConnecting: false,
    isAirPlayAvailable: false,
    isAirPlayActive: false,
    isSdkLoaded: false,

    setCastState: (state) => set({ 
      castState: state,
      isChromecastAvailable: state !== 'NO_DEVICES_AVAILABLE',
      isChromecastConnected: state === 'CONNECTED',
      isChromecastConnecting: state === 'CONNECTING'
    }),
    setAirPlayAvailable: (available) => set({ isAirPlayAvailable: available }),
    setAirPlayActive: (active) => set({ isAirPlayActive: active }),

    initializeCast: () => {
      if (get().isSdkLoaded) return;

      const initCast = () => {
        try {
          const context = (window as any).cast.framework.CastContext.getInstance();
          context.setOptions({
            receiverApplicationId: (window as any).chrome?.cast?.media?.DEFAULT_MEDIA_RECEIVER_APP_ID || 'CC1AD845',
            autoJoinPolicy: (window as any).chrome?.cast?.AutoJoinPolicy.ORIGIN_SCOPED,
          });

          const state = context.getCastState() as CastState;
          set({ 
            castState: state, 
            isChromecastAvailable: state !== 'NO_DEVICES_AVAILABLE',
            isChromecastConnected: state === 'CONNECTED',
            isChromecastConnecting: state === 'CONNECTING',
            isSdkLoaded: true 
          });

          context.addEventListener(
            (window as any).cast.framework.CastContextEventType.CAST_STATE_CHANGED,
            (event: any) => {
              const newState = event.castState as CastState;
              set({ 
                castState: newState,
                isChromecastAvailable: newState !== 'NO_DEVICES_AVAILABLE',
                isChromecastConnected: newState === 'CONNECTED',
                isChromecastConnecting: newState === 'CONNECTING'
              });
            }
          );
        } catch (e) {
          console.error('Error initializing Chromecast:', e);
        }
      };

      // Load Google Cast SDK
      if ((window as any).cast && (window as any).cast.framework) {
        initCast();
      } else {
        (window as any).__onGCastApiAvailable = (isAvailable: boolean) => {
          if (isAvailable) initCast();
        };

        if (!document.getElementById('chromecast-sdk-script')) {
          const script = document.createElement('script');
          script.id = 'chromecast-sdk-script';
          script.src = 'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1';
          script.async = true;
          document.body.appendChild(script);
        }
      }

      // AirPlay capability detection
      const isAirPlaySupported = 'WebKitPlaybackTargetAvailabilityEvent' in window;
      if (!isAirPlaySupported) return;

      const setupAirPlayForVideo = (video: HTMLVideoElement) => {
        if (activeVideo === video) return;
        if (cleanupAvailabilityListener) cleanupAvailabilityListener();

        activeVideo = video;

        const handleAvailability = (event: any) => {
          set({ isAirPlayAvailable: event.availability === 'available' });
        };

        const handlePlaybackTargetChanged = () => {
          set({ isAirPlayActive: true });
        };

        video.addEventListener('webkitplaybacktargetavailabilitychanged', handleAvailability);
        video.addEventListener('webkitcurrentplaybacktargetiswirelesschanged', handlePlaybackTargetChanged);

        cleanupAvailabilityListener = () => {
          video.removeEventListener('webkitplaybacktargetavailabilitychanged', handleAvailability);
          video.removeEventListener('webkitcurrentplaybacktargetiswirelesschanged', handlePlaybackTargetChanged);
        };
      };

      // Poll for active DOM video elements to bind AirPlay event listeners
      const interval = setInterval(() => {
        const video = document.querySelector('video');
        if (video) {
          setupAirPlayForVideo(video);
        } else {
          set({ isAirPlayAvailable: false, isAirPlayActive: false });
          if (cleanupAvailabilityListener) {
            cleanupAvailabilityListener();
            cleanupAvailabilityListener = null;
            activeVideo = null;
          }
        }
      }, 1500);

      (window as any).__airPlayInterval = interval;
    },

    startAirPlay: () => {
      const video = document.querySelector('video');
      if (video && typeof (video as any).webkitShowPlaybackTargetPicker === 'function') {
        try {
          (video as any).webkitShowPlaybackTargetPicker();
        } catch (e) {
          console.error('Failed to open AirPlay picker:', e);
        }
      }
    },

    startChromecast: async () => {
      if ((window as any).cast && (window as any).cast.framework) {
        const context = (window as any).cast.framework.CastContext.getInstance();
        try {
          await context.requestSession();
        } catch (e) {
          console.error('Failed to request Cast session:', e);
        }
      }
    },
  };
});
