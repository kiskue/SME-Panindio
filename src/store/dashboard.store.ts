/**
 * dashboard.store.ts
 *
 * Zustand v5 store for the ERP Dashboard.
 *
 * Responsibilities:
 *   - Holds the current dashboard payload (KPIs + trend) for the selected period.
 *   - Delegates all data access to `getDashboardData` from the dashboard repository.
 *   - Exposes `loadDashboard`, `setPeriod`, `goToPrev`, `goToNext`, and
 *     `refreshDashboard` actions.
 *
 * Period navigation model:
 *   - `periodState` replaces the old `selectedPeriod` string.
 *     It is a { type, anchor } pair where `anchor` is a canonical YYYY-MM-DD
 *     string identifying the specific period being viewed.
 *   - The anchor is normalised on every write:
 *       day   → the day itself            (no change needed)
 *       week  → Monday of the ISO week
 *       month → 1st of the month
 *       year  → Jan 1 of the year
 *   - `goToNext` is a no-op when the anchor already represents the current
 *     period (no future data). `canGoNext` reflects this in the UI.
 *
 * Error handling:
 *   - A failed load sets `error` and leaves the previous `data` intact so
 *     the UI can show stale data with an error banner rather than going blank.
 *   - `isLoading` is always reset to false after each load.
 */

import { create } from 'zustand';
import type {
  DashboardData,
  DashboardKPIs,
  DashboardPeriod,
  DashboardPeriodState,
  DashboardTrendPoint,
} from '@/types';
import { getDashboardData } from '../../database/repositories/dashboard.repository';

// ─── Anchor normalisation helpers ─────────────────────────────────────────────

/** Formats a Date as "YYYY-MM-DD" using its UTC components. */
function toYMD(d: Date): string {
  const y   = d.getUTCFullYear();
  const m   = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Returns the canonical anchor (YYYY-MM-DD) for each period type relative
 * to the given reference date (`ref`). The anchor is always the start of
 * the period unit that contains `ref`:
 *   day   → ref itself
 *   week  → Monday of the ISO week containing ref
 *   month → 1st of the month
 *   year  → Jan 1 of the year
 */
function currentAnchor(type: DashboardPeriod, ref: Date = new Date()): string {
  const y   = ref.getUTCFullYear();
  const mon = ref.getUTCMonth();
  const d   = ref.getUTCDate();
  const dow = ref.getUTCDay(); // 0 = Sun … 6 = Sat

  switch (type) {
    case 'day':
      return toYMD(ref);
    case 'week': {
      const offsetToMonday = dow === 0 ? -6 : 1 - dow;
      return toYMD(new Date(Date.UTC(y, mon, d + offsetToMonday)));
    }
    case 'month':
      return toYMD(new Date(Date.UTC(y, mon, 1)));
    case 'year':
      return toYMD(new Date(Date.UTC(y, 0, 1)));
  }
}

/**
 * Shifts an anchor forward (+1) or backward (-1) by one unit of the period
 * type and returns the new canonical anchor string.
 *
 * Examples:
 *   shiftAnchor('day',   '2026-03-23', -1) → '2026-03-22'
 *   shiftAnchor('week',  '2026-03-23', -1) → '2026-03-16'  (prev Monday)
 *   shiftAnchor('month', '2026-03-01', -1) → '2026-02-01'
 *   shiftAnchor('year',  '2026-01-01', -1) → '2025-01-01'
 */
function shiftAnchor(
  type:      DashboardPeriod,
  anchor:    string,
  direction: 1 | -1,
): string {
  const base = new Date(`${anchor}T00:00:00.000Z`);
  const y    = base.getUTCFullYear();
  const mon  = base.getUTCMonth();
  const d    = base.getUTCDate();

  switch (type) {
    case 'day':
      return toYMD(new Date(Date.UTC(y, mon, d + direction)));
    case 'week':
      return toYMD(new Date(Date.UTC(y, mon, d + direction * 7)));
    case 'month':
      // Date.UTC handles month overflow/underflow automatically.
      return toYMD(new Date(Date.UTC(y, mon + direction, 1)));
    case 'year':
      return toYMD(new Date(Date.UTC(y + direction, 0, 1)));
  }
}

/**
 * Returns true when `anchor` represents the current period of `type`
 * (i.e. navigating forward would show a future period with no data).
 */
function isCurrentPeriod(type: DashboardPeriod, anchor: string): boolean {
  return anchor === currentAnchor(type);
}

// ─── State shape ──────────────────────────────────────────────────────────────

interface DashboardState {
  /** The last successfully fetched dashboard payload, or null before first load. */
  data:         DashboardData | null;
  /** True while a repository fetch is in flight. */
  isLoading:    boolean;
  /** Error message from the last failed fetch, or null. */
  error:        string | null;
  /**
   * The period type + anchor currently shown on the dashboard.
   * Replaces the old `selectedPeriod: DashboardPeriod` string.
   */
  periodState:  DashboardPeriodState;

  // ── Derived ────────────────────────────────────────────────────────────────

  /**
   * True when the anchor represents the current period — "next" navigation
   * should be disabled in the UI because there is no future data.
   */
  canGoNext: boolean;

  // ── Actions ────────────────────────────────────────────────────────────────

  /**
   * Fetches dashboard data for the given period state and updates store state.
   * Sets `isLoading` during the fetch; sets `error` on failure.
   * On success, overwrites `data` and clears `error`.
   */
  loadDashboard: (state: DashboardPeriodState) => Promise<void>;

  /**
   * Changes the period TYPE (Day / Week / Month / Year) and resets the
   * anchor to the current period of that type before triggering a load.
   * Use this for the period-type pill tabs.
   */
  setPeriod: (type: DashboardPeriod) => Promise<void>;

  /**
   * Navigates the anchor one unit backward in time (e.g. previous day,
   * previous week, previous month, previous year) and triggers a load.
   */
  goToPrev: () => Promise<void>;

  /**
   * Navigates the anchor one unit forward in time.
   * No-op when the current anchor already represents the current period
   * (canGoNext === false) — prevents navigation into the future.
   */
  goToNext: () => Promise<void>;

  /**
   * Re-fetches dashboard data for the currently active period state.
   * Useful for pull-to-refresh or post-checkout auto-refresh.
   */
  refreshDashboard: () => Promise<void>;

  /**
   * Jumps directly to a specific anchor (YYYY-MM-DD) without changing the
   * period type. Used by the direct period picker so the user can tap a
   * calendar cell / week row / month cell / year row and navigate instantly
   * rather than stepping through the arrow buttons one unit at a time.
   *
   * The anchor is assumed to already be in canonical form for the current
   * period type (i.e. Monday for week, 1st for month, Jan 1 for year).
   * It is clamped to the current period when it would be in the future.
   */
  setAnchor: (anchor: string) => Promise<void>;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useDashboardStore = create<DashboardState>()((set, get) => ({
  data:        null,
  isLoading:   false,
  error:       null,
  periodState: { type: 'day', anchor: currentAnchor('day') },
  canGoNext:   false, // starts on current day → cannot go forward

  // ── Actions ────────────────────────────────────────────────────────────────

  loadDashboard: async (state) => {
    set({
      isLoading:  true,
      error:      null,
      periodState: state,
      canGoNext:  !isCurrentPeriod(state.type, state.anchor),
    });

    try {
      const dashboardData = await getDashboardData(state);
      set({ data: dashboardData, isLoading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load dashboard data.';
      set({ isLoading: false, error: message });
    }
  },

  setPeriod: async (type) => {
    const anchor = currentAnchor(type);
    await get().loadDashboard({ type, anchor });
  },

  goToPrev: async () => {
    const { periodState } = get();
    const newAnchor = shiftAnchor(periodState.type, periodState.anchor, -1);
    await get().loadDashboard({ type: periodState.type, anchor: newAnchor });
  },

  goToNext: async () => {
    const { periodState } = get();
    // Guard: never navigate into the future.
    if (isCurrentPeriod(periodState.type, periodState.anchor)) return;
    const newAnchor = shiftAnchor(periodState.type, periodState.anchor, 1);
    // After shifting forward, clamp to the current period if we'd overshoot.
    const clampedAnchor = isCurrentPeriod(periodState.type, newAnchor)
      ? newAnchor
      : newAnchor > currentAnchor(periodState.type)
        ? currentAnchor(periodState.type)
        : newAnchor;
    await get().loadDashboard({ type: periodState.type, anchor: clampedAnchor });
  },

  refreshDashboard: async () => {
    await get().loadDashboard(get().periodState);
  },

  setAnchor: async (anchor) => {
    const { periodState } = get();
    // Clamp: never navigate past the current period.
    const current = currentAnchor(periodState.type);
    const clamped = anchor > current ? current : anchor;
    await get().loadDashboard({ type: periodState.type, anchor: clamped });
  },
}));

// ─── Selectors ────────────────────────────────────────────────────────────────

/** The full dashboard payload, or null before the first successful load. */
export const selectDashboardData = (s: DashboardState): DashboardData | null => s.data;

/** True while a repository fetch is in flight. */
export const selectDashboardLoading = (s: DashboardState): boolean => s.isLoading;

/** The last fetch error message, or null. */
export const selectDashboardError = (s: DashboardState): string | null => s.error;

/**
 * The full period state { type, anchor }.
 * Use `selectDashboardPeriodType` when you only need the granularity string
 * (e.g. for the pill-tab highlight).
 */
export const selectDashboardPeriodState = (s: DashboardState): DashboardPeriodState =>
  s.periodState;

/**
 * The period type string only ('day' | 'week' | 'month' | 'year').
 * Kept separate so components that only render the pill tabs don't re-render
 * on anchor changes.
 */
export const selectDashboardPeriodType = (s: DashboardState): DashboardPeriod =>
  s.periodState.type;

/**
 * Back-compat alias — returns the period type string.
 * The dashboard screen currently uses this selector; it still works correctly
 * because it only needs the type for the pill-tab highlight.
 * @deprecated Prefer `selectDashboardPeriodType`. Will be removed in a future refactor.
 */
export const selectDashboardPeriod = selectDashboardPeriodType;

/**
 * True when forward navigation is disabled — the anchor is already the
 * current period so there is no future data to show.
 */
export const selectDashboardCanGoNext = (s: DashboardState): boolean => s.canGoNext;

/**
 * The KPI block from the current dashboard payload.
 * Returns null when data has not yet been loaded.
 */
export const selectDashboardKPIs = (s: DashboardState): DashboardKPIs | null =>
  s.data?.kpis ?? null;

// Stable empty-array sentinel used by selectDashboardTrend.
// MUST be a module-level constant — never an inline `[]` literal inside a
// Zustand selector, because `useSyncExternalStore` calls the selector on
// every render to diff snapshots. An inline `[]` produces a new reference
// each time, making the snapshot appear "always changed" and triggering an
// infinite re-render loop.
const EMPTY_TREND: DashboardTrendPoint[] = [];

/**
 * The trend series from the current dashboard payload.
 * Returns a stable empty array when data has not yet been loaded so chart
 * components can safely iterate without null-guards.
 */
export const selectDashboardTrend = (s: DashboardState): DashboardTrendPoint[] =>
  s.data?.trend ?? EMPTY_TREND;

/**
 * The `setAnchor` action. Exposed as a selector so components can subscribe
 * to it via `useDashboardStore(selectDashboardSetAnchor)` without triggering
 * re-renders when other state slices change.
 */
export const selectDashboardSetAnchor = (s: DashboardState): ((anchor: string) => Promise<void>) =>
  s.setAnchor;
