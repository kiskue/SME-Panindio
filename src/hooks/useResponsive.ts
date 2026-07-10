/**
 * useResponsive — reactive device/layout info.
 *
 * Built on `useWindowDimensions()` so it updates live on rotation, iPad Split
 * View, Stage Manager and resizable Android/desktop windows — the deliberate
 * fix for the codebase's previous `Dimensions.get('window')`-at-import pattern
 * (captured once, never updated).
 *
 * Single source of truth for the `>= 768` tablet check that was duplicated
 * across pos / dashboard / roi screens.
 */

import { useWindowDimensions } from 'react-native';
import { BREAKPOINTS, INVENTORY_GRID_COLUMNS, type Breakpoint } from '@/core/constants/breakpoints';

export interface ResponsiveInfo {
  /** Current window width (dp). */
  width: number;
  /** Current window height (dp). */
  height: number;
  /** width < 768. */
  isPhone: boolean;
  /** width >= 768. */
  isTablet: boolean;
  /** width > height. */
  isLandscape: boolean;
  /** Inventory grid columns for the active width: 1 phone / 2 tablet / 3 wide-or-landscape-tablet. */
  columns: number;
  /** Active breakpoint name. */
  breakpoint: Breakpoint;
}

function resolveBreakpoint(width: number): Breakpoint {
  if (width >= BREAKPOINTS.wide) return 'wide';
  if (width >= BREAKPOINTS.tablet) return 'tablet';
  return 'phone';
}

/** Reactive responsive info for the current window. */
export function useResponsive(): ResponsiveInfo {
  const { width, height } = useWindowDimensions();

  const isTablet = width >= BREAKPOINTS.tablet;
  const isLandscape = width > height;
  const breakpoint = resolveBreakpoint(width);

  // Tablet in landscape (or any "wide" window) earns the extra column.
  const columns =
    !isTablet
      ? INVENTORY_GRID_COLUMNS.phone
      : breakpoint === 'wide' || isLandscape
        ? INVENTORY_GRID_COLUMNS.wide
        : INVENTORY_GRID_COLUMNS.tablet;

  return {
    width,
    height,
    isPhone: !isTablet,
    isTablet,
    isLandscape,
    columns,
    breakpoint,
  };
}

/** Just the active breakpoint name. */
export function useBreakpoint(): Breakpoint {
  return useResponsive().breakpoint;
}

/**
 * Grid columns for the active width, clamped to `max` if provided.
 * Feed directly into FlatList `numColumns` (remember `key={columns}`).
 */
export function useGridColumns(max?: number): number {
  const { columns } = useResponsive();
  return max !== undefined ? Math.min(columns, max) : columns;
}
