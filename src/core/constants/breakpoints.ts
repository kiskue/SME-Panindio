/**
 * Responsive breakpoints — single source of truth.
 *
 * Replaces the `width >= 768` literal that was hand-rolled across pos.tsx,
 * the dashboard index, business-roi, roi and breakeven screens. Consume via
 * the `useResponsive()` hook (src/hooks/useResponsive.ts) rather than reading
 * `Dimensions.get()` at module load (that value never updates on rotate /
 * Split View / Stage Manager).
 */

/** Minimum window width (dp) for each device class. Phone is the 0 baseline. */
export const BREAKPOINTS = {
  phone:  0,
  tablet: 768,
  wide:   1024,
} as const;

export type Breakpoint = keyof typeof BREAKPOINTS;

/** Convenience alias for the tablet threshold (matches the legacy `>= 768`). */
export const TABLET_MIN_WIDTH = BREAKPOINTS.tablet;

/**
 * Column ladder for inventory card/list grids:
 * phone = 1 (single column), tablet portrait = 2, tablet landscape / wide = 3.
 */
export const INVENTORY_GRID_COLUMNS = {
  phone:  1,
  tablet: 2,
  wide:   3,
} as const;
