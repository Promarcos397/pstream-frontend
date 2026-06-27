import { create } from 'zustand';

interface UIState {
  activeVideoId: string | null;
  setActiveVideoId: (id: string | null | ((prev: string | null) => string | null)) => void;
  activePopupId: string | null;
  setActivePopupId: (id: string | null | ((prev: string | null) => string | null)) => void;
}

export const useUIStore = create<UIState>()(set => ({
  activeVideoId: null,
  setActiveVideoId: (id) => set(s => ({
    activeVideoId: typeof id === 'function' ? id(s.activeVideoId) : id,
  })),
  activePopupId: null,
  setActivePopupId: (id) => set(s => ({
    activePopupId: typeof id === 'function' ? id(s.activePopupId) : id,
  })),
}));
