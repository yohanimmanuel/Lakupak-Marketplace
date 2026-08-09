import { create } from 'zustand';

const TOP_REVEAL_Y = 16;
const DIRECTION_THRESHOLD = 8;

type TabBarScrollState = {
  labelsCollapsed: boolean;
  reportScrollY: (y: number) => void;
  resetLabels: () => void;
};

/** `null` = uninitialized baseline after reset / first mount. */
let lastY: number | null = null;

export const useTabBarScrollStore = create<TabBarScrollState>((set, get) => ({
  labelsCollapsed: false,
  reportScrollY: (y: number) => {
    if (lastY == null) {
      lastY = y;
      return;
    }

    const dy = y - lastY;
    lastY = y;

    if (y <= TOP_REVEAL_Y) {
      if (get().labelsCollapsed) set({ labelsCollapsed: false });
      return;
    }

    if (dy > DIRECTION_THRESHOLD && !get().labelsCollapsed) {
      set({ labelsCollapsed: true });
      return;
    }

    if (dy < -DIRECTION_THRESHOLD && get().labelsCollapsed) {
      set({ labelsCollapsed: false });
    }
  },
  resetLabels: () => {
    lastY = null;
    set({ labelsCollapsed: false });
  },
}));
