const primaryBlue = '#0a61d7';
const tintColorLight = primaryBlue;
const tintColorDark = '#ffffff';

export const LakuTheme = {
  primary: primaryBlue,
  inactive: '#6B7280',
  text: '#111827',
  textSecondary: '#6B7280',
  background: '#f9fafb',
  backgroundCard: '#ffffff',
  border: '#e5e7eb',
  mapFallback: '#0b1220',
  mapScreen: '#e8eef5',
  tabBar: {
    active: primaryBlue,
    inactive: '#6B7280',
    background: 'rgba(255, 255, 255, 0.95)',
    activePill: 'rgba(10, 97, 215, 0.12)',
  },
} as const;

export default {
  light: {
    text: '#111827',
    background: '#ffffff',
    tint: tintColorLight,
    tabIconDefault: '#9CA3AF',
    tabIconSelected: tintColorLight,
    primaryStart: '#084ba6',
    primaryEnd: '#0a61d7',
  },
  dark: {
    text: '#ffffff',
    background: '#0b0f19',
    tint: tintColorDark,
    tabIconDefault: '#9CA3AF',
    tabIconSelected: tintColorDark,
    primaryStart: '#0b3d82',
    primaryEnd: '#0a61d7',
  },
};
