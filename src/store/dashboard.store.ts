/**
 * dashboard.store.ts
 *
 * Zustand v5 store for the ERP Dashboard.
 *
 * Responsibilities:
 *   - Holds the current dashboard payload (KPIs + trend) for the selected period.
 *   - Delegates all data access to `getDashboardData` from the dashboard repository.
 *   - Exposes `loadDashboard`, `setPeriod`, and `refreshDashboard` actions.
 *
 * The store is intentionally thin: no date arithmetic, no SQL — all of that
 * lives in the repository layer. The store's only job is to manage async state
 * and expose selectors.
 *
 * Error handling:
 *   - A failed load sets `error` with the message string and leaves the
 *     previous `data` intact so the UI can continue showing stale data with
 *     an error banner rather than going blank.
 *   - `isLoading` is always reset to false after each load (success or failure).
 */

import { create } from 'zustand';
import type {
  DashboardData,
  DashboardKPIs,
  DashboardPeriod,
  DashboardTrendPoint,
} from '@/types';
import { getDashboardData } from '../../database/repositories/dashboard.repository';

// ─── State shape ──────────────────────────────────────────────────────────────

interface DashboardState {
  /** The last successfully fetched dashboard payload, or null before first load. */
  data:           DashboardData | null;
  /** True while a repository fetch is in flight. */
  isLoading:      boolean;
  /** Error message from the last failed fetch, or null. */
  error:          string | null;
  /** The period currently shown on the dashboard. Defaults to 'day'. */
  selectedPeriod: DashboardPeriod;

  // ── Actions ────────────────────────────────────────────────────────────────

  /**
   * Fetches dashboard data for the given period and updates state.
   * Sets `isLoading` during the fetch; sets `error` on failure.
   * On success, overwrites `data` and clears `error`.
   */
  loadDashboard: (period: DashboardPeriod) => Promise<void>;

  /**
   * Updates `selectedPeriod` then immediately triggers `loadDashboard`.
   * Use this for the period-picker UI control.
   */
  setPeriod: (period: DashboardPeriod) => Promise<void>;

  /**
   * Re-fetches dashboard data for the currently selected period.
   * Useful for pull-to-refresh or post-checkout auto-refresh.
   */
  refreshDashboard: () => Promise<void>;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useDashboardStore = create<DashboardState>()((set, get) => ({
  data:           null,
  isLoading:      false,
  error:          null,
  selectedPeriod: 'day',

  // ── Actions ────────────────────────────────────────────────────────────────

  loadDashboard: async (period) => {
    set({ isLoading: true, error: null, selectedPeriod: period });

    try {
      const dashboardData = await getDashboardData(period);
      set({ data: dashboardData, isLoading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load dashboard data.';
      set({ isLoading: false, error: message });
    }
  },

  setPeriod: async (period) => {
    // Update the period immediately so the UI can reflect the selection
    // before the load completes (e.g. to switch the period-picker highlight).
    set({ selectedPeriod: period });
    await get().loadDashboard(period);
  },

  refreshDashboard: async () => {
    await get().loadDashboard(get().selectedPeriod);
  },
}));

// ─── Selectors ────────────────────────────────────────────────────────────────

/** The full dashboard payload, or null before the first successful load. */
export const selectDashboardData = (s: DashboardState): DashboardData | null => s.data;

/** True while a repository fetch is in flight. */
export const selectDashboardLoading = (s: DashboardState): boolean => s.isLoading;

/** The last fetch error message, or null. */
export const selectDashboardError = (s: DashboardState): string | null => s.error;

/** The currently selected time period. */
export const selectDashboardPeriod = (s: DashboardState): DashboardPeriod => s.selectedPeriod;

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
