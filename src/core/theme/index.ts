import { ThemeColors } from '@/types';

export const theme = {
  colors: {
    primary: '#007AFF',
    secondary: '#5856D6',
    background: '#FFFFFF',
    surface: '#F2F2F7',
    text: '#000000',
    textSecondary: '#8E8E93',
    error: '#FF3B30',
    success: '#34C759',
    warning: '#FF9500',
    info: '#007AFF',
    border: '#C6C6C8',
    disabled: '#C7C7CC',
    placeholder: '#8E8E93',
  } as ThemeColors,
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  typography: {
    sizes: {
      xs: 12,
      sm: 14,
      md: 16,
      lg: 18,
      xl: 20,
      xxl: 24,
      xxxl: 32,
    },
    weights: {
      regular: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
    },
    lineHeights: {
      tight: 1.2,
      normal: 1.4,
      relaxed: 1.6,
    },
  },
  borderRadius: {
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    round: 9999,
  },
  shadows: {
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 4,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 8,
    },
  },
  animations: {
    durations: {
      fast: 150,
      normal: 300,
      slow: 500,
    },
    easing: {
      easeInOut: 'ease-in-out',
      easeIn: 'ease-in',
      easeOut: 'ease-out',
      linear: 'linear',
    },
  },
} as const;

export type Theme = typeof theme;
export type Colors = typeof theme.colors;
export type Spacing = typeof theme.spacing;
export type Typography = typeof theme.typography;
export type BorderRadius = typeof theme.borderRadius;
export type Shadows = typeof theme.shadows;

// Utility functions for theme
export const getSpacing = (size: keyof typeof theme.spacing): number => {
  return theme.spacing[size];
};

export const getTypographySize = (size: keyof typeof theme.typography.sizes): number => {
  return theme.typography.sizes[size];
};

export const getBorderRadius = (size: keyof typeof theme.borderRadius): number => {
  return theme.borderRadius[size];
};

export const getShadow = (size: keyof typeof theme.shadows): typeof theme.shadows[keyof typeof theme.shadows] => {
  return theme.shadows[size];
};