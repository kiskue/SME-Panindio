export const theme = {
  colors: {
    // Primary — Navy Blue (SME brand)
    primary: {
      50:  '#EAF0FA',
      100: '#C5D5F0',
      200: '#9FBBE6',
      300: '#7AA0DC',
      400: '#4E7EC9',
      500: '#1E4D8C', // brand navy
      600: '#18407A',
      700: '#123265',
      800: '#0C2550',
      900: '#06183B',
    },
    // Accent — Green (PANINDIO lettering)
    accent: {
      50:  '#E9F7EF',
      100: '#C6ECD7',
      200: '#9ED9B9',
      300: '#71C699',
      400: '#45B47B',
      500: '#27AE60', // brand green
      600: '#209150',
      700: '#187540',
      800: '#105830',
      900: '#083C1F',
    },
    // Highlight — Amber/Orange (awning stripe + "i" dot)
    highlight: {
      50:  '#FEF7E8',
      100: '#FCECC4',
      200: '#F9D98A',
      300: '#F7C650',
      400: '#F5A623', // brand amber
      500: '#F39C12', // brand orange-dot
      600: '#D4880F',
      700: '#B5730C',
      800: '#965F09',
      900: '#784A06',
    },
    // Secondary scale (kept for library compat)
    secondary: {
      50:  '#F0EEFF',
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
      50:  '#F9FAFB',
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
    // Semantic scales
    error: {
      50:  '#FFF5F5',
      100: '#FFEBEB',
      200: '#FFD6D6',
      400: '#FF5C55',
      500: '#FF3B30',
      600: '#E03428',
      700: '#CC2F26',
    },
    warning: {
      50:  '#FFFBEB',
      100: '#FEF3C7',
      200: '#FDE68A',
      400: '#FFA730',
      500: '#FF9500',
      600: '#E07F00',
      700: '#CC7700',
    },
    success: {
      50:  '#E9F7EF',
      100: '#C6ECD7',
      200: '#9ED9B9',
      400: '#45B47B',
      500: '#27AE60',
      600: '#209150',
      700: '#187540',
    },
    info: {
      50:  '#EAF0FA',
      100: '#C5D5F0',
      200: '#9FBBE6',
      400: '#4E7EC9',
      500: '#1E4D8C',
      600: '#18407A',
      700: '#123265',
    },
    // Flat semantic tokens
    background:    '#F8F9FA',
    surface:       '#FFFFFF',
    surfaceSubtle: '#EAF0FA',
    text:          '#1A3A6B',   // brand dark navy
    textSecondary: '#6B7280',
    textInverse:   '#FFFFFF',
    border:        '#D1DAE8',
    borderSubtle:  '#E5EAF2',
    disabled:      '#C7C7CC',
    placeholder:   '#9CA3AF',
    white:         '#FFFFFF',
    black:         '#000000',
  },
  spacing: {
    xs:  4,
    sm:  8,
    md:  16,
    lg:  24,
    xl:  32,
    xxl: 48,
  },
  typography: {
    fontFamily: undefined as string | undefined,
    sizes: {
      xs:    12,
      sm:    14,
      base:  16,
      md:    16,
      lg:    18,
      xl:    20,
      '2xl': 24,
      xxl:   24,
      '3xl': 30,
      xxxl:  32,
      '4xl': 36,
    },
    weights: {
      light:    '300' as const,
      regular:  '400' as const,
      normal:   '400' as const,
      medium:   '500' as const,
      semibold: '600' as const,
      bold:     '700' as const,
    },
    lineHeights: {
      tight:   1.2,
      normal:  1.4,
      relaxed: 1.6,
    },
  },
  borderRadius: {
    none:  0,
    sm:    4,
    md:    8,
    lg:    12,
    xl:    16,
    '2xl': 24,
    full:  9999,
    round: 9999,
  },
  shadows: {
    none: {},
    sm: {
      shadowColor:   '#1E4D8C',
      shadowOffset:  { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius:  2,
      elevation:     2,
    },
    md: {
      shadowColor:   '#1E4D8C',
      shadowOffset:  { width: 0, height: 2 },
      shadowOpacity: 0.10,
      shadowRadius:  6,
      elevation:     4,
    },
    lg: {
      shadowColor:   '#1E4D8C',
      shadowOffset:  { width: 0, height: 4 },
      shadowOpacity: 0.14,
      shadowRadius:  12,
      elevation:     8,
    },
    xl: {
      shadowColor:   '#1E4D8C',
      shadowOffset:  { width: 0, height: 8 },
      shadowOpacity: 0.18,
      shadowRadius:  24,
      elevation:     16,
    },
  },
  animations: {
    durations: {
      fast:   150,
      normal: 300,
      slow:   500,
    },
  },
} as const;

export type Theme       = typeof theme;
export type Colors      = typeof theme.colors;
export type Spacing     = typeof theme.spacing;
export type Typography  = typeof theme.typography;
export type BorderRadius = typeof theme.borderRadius;
export type Shadows     = typeof theme.shadows;

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
