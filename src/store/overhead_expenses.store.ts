/**
 * overhead_expenses.store.ts
 *
 * Zustand v5 store for the Overhead Expenses module.
 * SQLite is the source of truth — this store is an in-memory cache.
 *
 * Boot sequence:
 *   1. `initDatabase()` runs in `_layout.tsx` (table and indexes exist).
 *   2. `initializeOverheadExpenses()` hydrates the first page from SQLite.
 *   3. `loadMore()` appends subsequent pages as the user scrolls.
 *
 * Design decisions:
 *   - Entries are immutable once written. There is no update action.
 *     Corrections are new entries; the `logExpense` action handles inserts only.
 *   - `expenses` is always sorted newest-first (expense_date DESC, created_at DESC),
 *     matching the repository query order.
 *   - `filters` is a plain object. `setFilters` replaces it in full, resets
 *     pagination, and re-fetches the first page — one action, one DB round-trip.
 *   - `isLoading` guards the initial load and filter changes.
 *     `isLoadingMore` guards pagination appends so the list header and footer
 *     spinners can be shown independently.
 *   - `hasMore` is derived from `totalCount > expenses.length`. It is NOT stored
 *     separately to avoid the classic off-by-one bug where hasMore stays true
 *     after the last page is loaded.
 *
 * TypeScript strict-mode notes:
 *   - exactOptionalPropertyTypes: optional filter fields use conditional spread.
 *   - noUncheckedIndexedAccess: all array/record access uses ?? fallbacks.
 */

import { create } from 'zustand';
import type {
  OverheadExpense,
  OverheadExpenseSummary,
  CreateOverheadExpenseInput,
  GetOverheadExpensesOptions,
  OverheadCategory,
  OverheadFrequency,
} from '@/types';
import {
  createOverheadExpense,
  getOverheadExpenses,
  getOverheadExpenseCount,
  getOverheadExpenseSummary,
} from '../../database/repositories/overhead_expenses.repository';

// ─── Page size constant ───────────────────────────────────────────────────────

const PAGE_SIZE = 20;

// ─── Filter shape ─────────────────────────────────────────────────────────────

/**
 * Active filter state. All fields are optional — the default (all undefined)
 * returns all expenses with no filtering.
 */
export interface OverheadFilters {
  category?:    OverheadCategory;
  fromDate?:    string;
  toDate?:      string;
  isRecurring?: boolean;
}

// ─── State shape ──────────────────────────────────────────────────────────────

interface OverheadExpensesState {
  /** Current page of expenses (newest-first). */
  expenses:       OverheadExpense[];
  /** Total row count matching current filters — used to derive `hasMore`. */
  totalCount:     number;
  /** True when there are more rows to load beyond what is in `expenses`. */
  hasMore:        boolean;
  /** Currently active filter state. */
  filters:        OverheadFilters;
  /** True during the initial load or a filter change re-fetch. */
  isLoading:      boolean;
  /** True while appending the next page (pagination). */
  isLoadingMore:  boolean;
  /** Last error message, or null when no error. */
  error:          string | null;
  /** Period-aggregate KPIs — thisMonth, thisYear, allTime. */
  summary:        OverheadExpenseSummary;

  // ── Boot ───────────────────────────────────────────────────────────────────
  /**
   * Loads the first page and total count from SQLite.
   * Called once from `initializeStores()` at app launch.
   */
  initializeExpenses: () => Promise<void>;
  /** Fetches the period-aggregate summary (thisMonth, thisYear, allTime). */
  loadSummary: () => Promise<void>;

  // ── Reads ──────────────────────────────────────────────────────────────────
  /**
   * Re-fetches the first page with the current filters.
   * Resets the list to page 1 — discards any previously loaded pages.
   */
  refreshExpenses: () => Promise<void>;
  /**
   * Appends the next page to `expenses`.
   * No-ops if `hasMore` is false or `isLoadingMore` is already true.
   */
  loadMore: () => Promise<void>;
  /**
   * Replaces the active filters, resets pagination, and re-fetches page 1.
   */
  setFilters: (filters: OverheadFilters) => Promise<void>;

  // ── Mutations ─────────────────────────────────────────────────────────────
  /**
   * Inserts a new overhead expense and prepends it to `expenses`.
   * Also increments `totalCount` so `hasMore` stays consistent.
   *
   * @returns The fully persisted `OverheadExpense` object.
   * @throws  Re-throws the repository error so the screen can show an Alert.
   */
  logExpense: (input: CreateOverheadExpenseInput) => Promise<OverheadExpense>;
}

// ─── Store ───────────────────────────────────────────────────────────────────

const EMPTY_SUMMARY: OverheadExpenseSummary = { thisMonth: 0, thisYear: 0, allTime: 0 };

export const useOverheadExpensesStore = create<OverheadExpensesState>()(
  (set, get) => ({
    expenses:      [],
    totalCount:    0,
    hasMore:       false,
    filters:       {},
    isLoading:     false,
    isLoadingMore: false,
    error:         null,
    summary:       EMPTY_SUMMARY,

    // ── Boot ─────────────────────────────────────────────────────────────────

    loadSummary: async () => {
      try {
        const summary = await getOverheadExpenseSummary();
        set({ summary });
      } catch {
        // Non-fatal — summary stays at previous value
      }
    },

    initializeExpenses: async () => {
      set({ isLoading: true, error: null });
      try {
        const filters  = get().filters;
        const queryOpts = filtersToQueryOptions(filters, 0);

        const [expenses, totalCount, summary] = await Promise.all([
          getOverheadExpenses(queryOpts),
          getOverheadExpenseCount(filtersToQueryOptions(filters)),
          getOverheadExpenseSummary(),
        ]);

        set({
          expenses,
          totalCount,
          summary,
          hasMore:   totalCount > expenses.length,
          isLoading: false,
        });
      } catch (err) {
        const message = err instanceof Error
          ? err.message
          : 'Failed to initialize overhead expenses';
        set({ isLoading: false, error: message });
      }
    },

    // ── Reads ─────────────────────────────────────────────────────────────────

    refreshExpenses: async () => {
      set({ isLoading: true, error: null });
      try {
        const filters   = get().filters;
        const queryOpts = filtersToQueryOptions(filters, 0);

        const [expenses, totalCount] = await Promise.all([
          getOverheadExpenses(queryOpts),
          getOverheadExpenseCount(filtersToQueryOptions(filters)),
        ]);

        set({
          expenses,
          totalCount,
          hasMore:   totalCount > expenses.length,
          isLoading: false,
        });
      } catch (err) {
        const message = err instanceof Error
          ? err.message
          : 'Failed to refresh overhead expenses';
        set({ isLoading: false, error: message });
      }
    },

    loadMore: async () => {
      const { hasMore, isLoadingMore, expenses, filters } = get();
      if (!hasMore || isLoadingMore) return;

      set({ isLoadingMore: true, error: null });
      try {
        const offset    = expenses.length;
        const queryOpts = filtersToQueryOptions(filters, offset);
        const nextPage  = await getOverheadExpenses(queryOpts);

        set((state) => {
          const updated = [...state.expenses, ...nextPage];
          return {
            expenses:      updated,
            hasMore:       state.totalCount > updated.length,
            isLoadingMore: false,
          };
        });
      } catch (err) {
        const message = err instanceof Error
          ? err.message
          : 'Failed to load more overhead expenses';
        set({ isLoadingMore: false, error: message });
      }
    },

    setFilters: async (filters) => {
      set({ filters, isLoading: true, error: null });
      try {
        const queryOpts = filtersToQueryOptions(filters, 0);

        const [expenses, totalCount] = await Promise.all([
          getOverheadExpenses(queryOpts),
          getOverheadExpenseCount(filtersToQueryOptions(filters)),
        ]);

        set({
          expenses,
          totalCount,
          hasMore:   totalCount > expenses.length,
          isLoading: false,
        });
      } catch (err) {
        const message = err instanceof Error
          ? err.message
          : 'Failed to apply overhead expense filters';
        set({ isLoading: false, error: message });
      }
    },

    // ── Mutations ─────────────────────────────────────────────────────────────

    logExpense: async (input) => {
      set({ isLoading: true, error: null });
      try {
        const expense = await createOverheadExpense(input);

        // Prepend to the list and bump totalCount.
        // We do NOT re-fetch from the DB to avoid a round-trip — the
        // repository already read back the full persisted row.
        // Refresh summary in the background after insert — non-blocking
        void getOverheadExpenseSummary().then((summary) => set({ summary })).catch(() => undefined);

        set((state) => ({
          expenses:   [expense, ...state.expenses],
          totalCount: state.totalCount + 1,
          hasMore:    (state.totalCount + 1) > (state.expenses.length + 1),
          isLoading:  false,
        }));

        return expense;
      } catch (err) {
        const message = err instanceof Error
          ? err.message
          : 'Failed to log overhead expense';
        set({ isLoading: false, error: message });
        // Re-throw so the screen's catch block can show an Alert.
        throw err;
      }
    },
  }),
);

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Converts the store's filter shape to the repository's `GetOverheadExpensesOptions`.
 * Uses conditional spreading to satisfy `exactOptionalPropertyTypes: true`.
 *
 * @param filters - The active store filter state.
 * @param offset  - Pagination offset (default 0 = first page).
 */
function filtersToQueryOptions(
  filters: OverheadFilters,
  offset = 0,
): GetOverheadExpensesOptions {
  return {
    limit:  PAGE_SIZE,
    offset,
    ...(filters.category    !== undefined ? { category:    filters.category }    : {}),
    ...(filters.fromDate    !== undefined ? { fromDate:    filters.fromDate }     : {}),
    ...(filters.toDate      !== undefined ? { toDate:      filters.toDate }       : {}),
    ...(filters.isRecurring !== undefined ? { isRecurring: filters.isRecurring }  : {}),
  };
}

// ─── Selectors ────────────────────────────────────────────────────────────────

export const selectOverheadExpenses = (
  state: OverheadExpensesState,
): OverheadExpense[] => state.expenses;

export const selectOverheadLoading = (
  state: OverheadExpensesState,
): boolean => state.isLoading;

export const selectOverheadLoadingMore = (
  state: OverheadExpensesState,
): boolean => state.isLoadingMore;

export const selectOverheadError = (
  state: OverheadExpensesState,
): string | null => state.error;

export const selectOverheadTotalCount = (
  state: OverheadExpensesState,
): number => state.totalCount;

export const selectOverheadHasMore = (
  state: OverheadExpensesState,
): boolean => state.hasMore;

export const selectOverheadFilters = (
  state: OverheadExpensesState,
): OverheadFilters => state.filters;

export const selectOverheadSummary = (
  state: OverheadExpensesState,
): OverheadExpenseSummary => state.summary;

// ─── Initialiser (called from initializeStores) ───────────────────────────────

/**
 * Hydrates the overhead expenses store from SQLite.
 * Must be called after `initDatabase()` has completed.
 */
export async function initializeOverheadExpenses(): Promise<void> {
  await useOverheadExpensesStore.getState().initializeExpenses();
}

// ─── Re-export filter-related types so consumers can import from the store ────

export type { OverheadCategory, OverheadFrequency };
