import { createContext } from 'react';
import { Platform, type ViewStyle } from 'react-native';
import { useThemeStore, selectResolvedMode } from '@/store/theme.store';

// ── Light theme (original — DO NOT change existing keys) ───────────────────

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
    background:      '#F2F5FA',   // subtle navy-tinted canvas (unified)
    surface:         '#FFFFFF',
    surfaceElevated: '#FFFFFF',   // sheets/modals/menus (light = white)
    surfaceSubtle:   '#EAF0FA',
    text:            '#1A3A6B',   // brand dark navy
    textSecondary:   '#6B7280',
    textInverse:     '#FFFFFF',
    border:          '#D1DAE8',
    borderSubtle:    '#E5EAF2',
    disabled:        '#C7C7CC',
    placeholder:     '#9CA3AF',
    white:           '#FFFFFF',
    black:           '#000000',
    // Adaptive brand FOREGROUND tints — readable brand text/icon colors.
    // Light = deepened brand for AA contrast on white; dark overrides below.
    tintPrimary:     '#1E4D8C',
    tintAccent:      '#187540',
    tintHighlight:   '#B5730C',
    // On-color text for FILLED brand surfaces.
    onPrimary:       '#FFFFFF',
    onAccent:        '#FFFFFF',
    onHighlight:     '#1A3A6B',
    // Scrim behind modals/sheets.
    overlay:         'rgba(20,33,58,0.45)',
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
  // Cross-platform elevation. iOS gets a soft `shadow*` set; Android gets a
  // matching `elevation` dp (Android ignores `shadow*`, and `shadowColor` only
  // applies API 28+ — older devices fall back to a neutral system shadow). The
  // shadow color is a deep navy-black so it reads as depth, not a blue haze.
  // NOTE: a shadow is clipped on iOS if it shares a node with `overflow:'hidden'`
  // — keep the shadow on an outer wrapper (see Card/Modal).
  shadows: {
    none: {},
    sm: Platform.select({
      ios:     { shadowColor: '#0A1F3D', shadowOffset: { width: 0, height: 1 },  shadowOpacity: 0.10, shadowRadius: 3 },
      android: { elevation: 2,  shadowColor: '#0A1F3D' },
      default: {},
    }),
    md: Platform.select({
      ios:     { shadowColor: '#0A1F3D', shadowOffset: { width: 0, height: 3 },  shadowOpacity: 0.12, shadowRadius: 8 },
      android: { elevation: 5,  shadowColor: '#0A1F3D' },
      default: {},
    }),
    lg: Platform.select({
      ios:     { shadowColor: '#0A1F3D', shadowOffset: { width: 0, height: 8 },  shadowOpacity: 0.16, shadowRadius: 16 },
      android: { elevation: 9,  shadowColor: '#0A1F3D' },
      default: {},
    }),
    xl: Platform.select({
      ios:     { shadowColor: '#0A1F3D', shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.20, shadowRadius: 28 },
      android: { elevation: 16, shadowColor: '#0A1F3D' },
      default: {},
    }),
  },
  animations: {
    durations: {
      fast:   150,
      normal: 300,
      slow:   500,
    },
  },
} as const;

// ── Dark theme ─────────────────────────────────────────────────────────────
// Color palettes (primary/accent/highlight/secondary/gray/error/warning/
// success/info) are intentionally identical — only the flat semantic tokens
// change so that brand identity is preserved in both modes.

export const darkTheme = {
  ...theme,
  colors: {
    ...theme.colors,
    // Flat semantic tokens — dark overrides (navy-tinted elevation ladder).
    // Dark elevation is conveyed by a surface step + a 1px borderSubtle
    // hairline, since shadows are effectively invisible on dark.
    background:      '#0C1322', // app canvas (elevation 0)
    surface:         '#141D2E', // cards (elevation +1)
    surfaceElevated: '#1C2740', // sheets/modals/menus (elevation +2)
    surfaceSubtle:   '#19233A', // input fills / chips
    text:            '#ECF1F8', // ~16:1 on background
    textSecondary:   '#9FB0C8', // 7.6:1 on surface
    textInverse:     '#0C1322',
    border:          '#2B3A55',
    borderSubtle:    '#1E2A40', // also carries the dark elevation hairline
    disabled:        '#44516B',
    placeholder:     '#647288',
    white:           '#141D2E', // card-flip hack — realigned to new surface
    black:           '#ECF1F8',
    // Adaptive brand foreground tints — readable brand-on-dark
    // (replaces the per-screen hardcoded #4F9EFF / #3DD68C / #FFB020).
    tintPrimary:     '#4F9EFF',
    tintAccent:      '#3DD68C',
    tintHighlight:   '#FFB020',
    // onPrimary / onAccent stay white (inherited); only onHighlight differs.
    onHighlight:     '#1A3A6B',
    overlay:         'rgba(2,6,15,0.65)',
  },
  // Shadows are suppressed in dark — depth is conveyed by the surface-step +
  // 1px borderSubtle convention instead (shadows are invisible on dark anyway).
  shadows: { none: {}, sm: {}, md: {}, lg: {}, xl: {} },
} as const;

// ── Theme type (shared shape for light and dark) ────────────────────────────
// Both objects satisfy this type because they have identical structure.
export type Theme = typeof theme;
export type Colors      = typeof theme.colors;
export type Spacing     = typeof theme.spacing;
export type Typography  = typeof theme.typography;
export type BorderRadius = typeof theme.borderRadius;
export type Shadows     = typeof theme.shadows;

// ── getTheme factory ────────────────────────────────────────────────────────
export type ThemeMode = 'light' | 'dark';

export const getTheme = (mode: ThemeMode): Theme =>
  (mode === 'dark' ? darkTheme : theme) as unknown as Theme;

// ── ThemeContext / ThemeModeContext ─────────────────────────────────────────
// Kept for backward-compat (ThemeProvider still provides these) but the public
// hooks no longer read from context. They subscribe to the Zustand store
// directly so that ONLY the calling component re-renders when mode changes —
// navigation containers (Drawer, Stack) never re-render, which eliminates the
// Fabric "Unable to find viewState for tag X" crash that occurred when a
// root-level context change triggered a tree-wide re-render while the Drawer
// surface was still in an animation/teardown state.
export const ThemeContext     = createContext<Theme>(theme);
export const ThemeModeContext = createContext<ThemeMode>('light');

/**
 * Returns the current resolved Theme object.
 * Reads from the Zustand store — only this component re-renders on mode change,
 * not the entire React tree. getTheme() returns module-level constants so the
 * reference is stable for the same mode (no extra renders from object identity).
 */
export const useAppTheme = (): Theme => {
  const mode = useThemeStore(selectResolvedMode);
  return getTheme(mode);
};

/** Returns the active context's resolved ThemeMode ('light' | 'dark'). */
export const useThemeMode = (): ThemeMode => useThemeStore(selectResolvedMode);

// ── Existing helper functions (unchanged) ──────────────────────────────────
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

// ── Elevation (mode-aware shadow) ───────────────────────────────────────────
export type ElevationLevel = keyof typeof theme.shadows; // 'none'|'sm'|'md'|'lg'|'xl'

/** Stable empty style for dark mode — a shared reference so consumers that put
 *  the elevation in a `useMemo` dependency don't invalidate it every render. */
const FLAT_ELEVATION: ViewStyle = {};

/**
 * Resolve an elevation style for a given mode. Light returns the cross-platform
 * shadow token; dark returns a flat (shared) {} — depth is conveyed by surface +
 * border. This is the single API for elevation: use it instead of spreading
 * `theme.shadows.X` directly or hand-rolling `isDark ? {} : shadows.X`.
 * Both branches return a stable reference (module constants).
 */
export const getElevation = (level: ElevationLevel, mode: ThemeMode): ViewStyle =>
  mode === 'dark' ? FLAT_ELEVATION : (theme.shadows[level] as ViewStyle);

/** Hook form: the active context's elevation style for `level`. */
export const useElevation = (level: ElevationLevel): ViewStyle =>
  getElevation(level, useThemeMode());

// ─── Status color maps ──────────────────────────────────────────────────────
export {
  verificationStatusColor,
  orderStatusColor,
  type StatusColor,
} from './statusColors';

// NOTE: inventory accents live in ./inventoryAccents and import `theme`/`darkTheme`
// from THIS file. Re-exporting them here would create a circular import — Babel
// hoists the require above the `theme`/`darkTheme` declarations, leaving them
// undefined when inventoryAccents builds its color tables. Import inventory
// accents directly from '@/core/theme/inventoryAccents' instead.
