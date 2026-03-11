export const theme = {
  colors: {
    // Primary scale
    primary: {
      50: '#EBF5FF',
      100: '#CCE5FF',
      200: '#99CBFF',
      300: '#66B0FF',
      400: '#3396FF',
      500: '#007AFF',
      600: '#0062CC',
      700: '#004A99',
      800: '#003166',
      900: '#001933',
    },
    // Secondary scale
    secondary: {
      50: '#F0EEFF',
      100: '#D9D7FF',
      200: '#B3AFFF',
      300: '#8D88FF',
      400: '#6760FF',
      500: '#5856D6',
      600: '#4644AB',
      700: '#343380',
      800: '#232256',
      900: '#11112B',
    },
    // Gray scale
    gray: {
      50: '#F9FAFB',
      100: '#F3F4F6',
      200: '#E5E7EB',
      300: '#D1D5DB',
      400: '#9CA3AF',
      500: '#6B7280',
      600: '#4B5563',
      700: '#374151',
      800: '#1F2937',
      900: '#111827',
    },
    // Error scale
    error: {
      50: '#FFF5F5',
      100: '#FFEBEB',
      200: '#FFD6D6',
      500: '#FF3B30',
      700: '#CC2F26',
    },
    // Warning scale
    warning: {
      50: '#FFFBEB',
      100: '#FEF3C7',
      200: '#FDE68A',
      500: '#FF9500',
      700: '#CC7700',
    },
    // Success scale
    success: {
      50: '#F0FFF4',
      100: '#DCFFE4',
      200: '#B9FFCC',
      500: '#34C759',
      700: '#28A046',
    },
    // Info scale (same base as primary)
    info: {
      50: '#EBF5FF',
      100: '#CCE5FF',
      200: '#99CBFF',
      500: '#007AFF',
      700: '#004A99',
    },
    // Flat semantic tokens
    background: '#FFFFFF',
    surface: '#F2F2F7',
    text: '#000000',
    textSecondary: '#8E8E93',
    border: '#C6C6C8',
    disabled: '#C7C7CC',
    placeholder: '#8E8E93',
    white: '#FFFFFF',
    black: '#000000',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  typography: {
    fontFamily: undefined as string | undefined,
    sizes: {
      xs: 12,
      sm: 14,
      base: 16,
      md: 16,
      lg: 18,
      xl: 20,
      '2xl': 24,
      xxl: 24,
      '3xl': 30,
      xxxl: 32,
      '4xl': 36,
    },
    weights: {
      light: '300' as const,
      regular: '400' as const,
      normal: '400' as const,
      medium: '500' as const,
      semibold: '600' as const,
      bold: '700' as const,
    },
    lineHeights: {
      tight: 1.2,
      normal: 1.4,
      relaxed: 1.6,
    },
  },
  borderRadius: {
    none: 0,
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    full: 9999,
    round: 9999,
  },
  shadows: {
    none: {},
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
    xl: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.2,
      shadowRadius: 16,
      elevation: 16,
    },
  },
  animations: {
    durations: {
      fast: 150,
      normal: 300,
      slow: 500,
    },
  },
} as const;

export type Theme = typeof theme;
export type Colors = typeof theme.colors;
export type Spacing = typeof theme.spacing;
export type Typography = typeof theme.typography;
export type BorderRadius = typeof theme.borderRadius;
export type Shadows = typeof theme.shadows;

export const getSpacing = (size: keyof typeof theme.spacing): number =>
  theme.spacing[size];

export const getTypographySize = (
  size: keyof typeof theme.typography.sizes,
): number => theme.typography.sizes[size];

export const getBorderRadius = (size: keyof typeof theme.borderRadius): number =>
  theme.borderRadius[size];

export const getShadow = (
  size: keyof typeof theme.shadows,
): (typeof theme.shadows)[keyof typeof theme.shadows] => theme.shadows[size];
