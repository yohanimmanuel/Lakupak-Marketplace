import { create } from 'zustand';
import { Animated } from 'react-native';

interface HeaderScrollState {
  scrollY: Animated.Value;
  setScrollY: (scrollY: Animated.Value) => void;
}

// Initialize with default value to prevent flickering
const defaultScrollY = new Animated.Value(0);

export const useHeaderScrollStore = create<HeaderScrollState>((set) => ({
  scrollY: defaultScrollY,
  setScrollY: (scrollY) => set({ scrollY }),
}));

