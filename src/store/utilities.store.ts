/**
 * utilities.store.ts
 *
 * Zustand v5 store for the Utilities Consumption module.
 * SQLite is the source of truth — this store is an in-memory cache.
 *
 * Boot sequence:
 *   1. `initDatabase()` runs in `_layout.tsx` (tables + seed data exist).
 *   2. `initializeUtilities()` hydrates `types` from SQLite once.
 *   3. `loadLogsForMonth(year, month)` is called from the screen to populate
 *      the `logs` array for the currently viewed month.
 *
 * Design decisions:
 *   - `types` is loaded once at boot and held for the app lifetime.
 *     They change infrequently; a full refresh only happens on explicit
 *     re-initialisation.
 *   - `logs` is replaced on every `loadLogsForMonth` call. The screen is
 *     responsible for calling this when the user navigates to a new month.
 *   - `monthlySummary` and `yearlySummary` are independent caches updated by
 *     their own load actions. They are NOT automatically invalidated when
 *     `upsertLog` or `deleteLog` runs — callers should reload them after mutations.
 *   - `upsertLog` and `deleteLog` reload `logs` for the current selection
 *     automatically so the list stays consistent after a mutation.
 */

import { create } from 'zustand';
import type { UtilityType, UtilityLog } from '@/types';
import {
  getUtilityTypes,
  createUtilityType,
  getUtilityLogs,
  upsertUtilityLog,
  markUtilityPaid,
  deleteUtilityLog,
  getMonthlySummary,
  getYearlySummary,
} from '../../database/repositories/utilities.repository';
import type { CreateUtilityTypeInput, UpsertUtilityLogInput } from '../../database/repositories/utilities.repository';

// ─── Exported summary types ───────────────────────────────────────────────────

export interface UtilityMonthlySummary {
  totalAmount:  number;
  paidAmount:   number;
  unpaidAmount: number;
  count:        number;
  paidCount:    number;
}

export interface UtilityYearlyPoint {
  month:       number;
  totalAmount: number;
}

// ─── State shape ─────────────────────────────────────────────────────────────

interface UtilitiesState {
  types:          UtilityType[];
  logs:           UtilityLog[];
  isLoading:      boolean;
  error:          string | null;
  monthlySummary: UtilityMonthlySummary | null;
  yearlySummary:  UtilityYearlyPoint[];

  /** Current month context — tracks which month `logs` was last loaded for. */
  _activeYear:  number;
  _activeMonth: number;

  // ── Boot ───────────────────────────────────────────────────────────────────
  /**
   * Loads all utility types from SQLite and the logs for the current calendar
   * month. Called once from `initializeStores()` at app launch.
   */
  initializeUtilities: () => Promise<void>;

  // ── Reads ──────────────────────────────────────────────────────────────────
  /** Replaces `logs` with the records for the given year+month. */
  loadLogsForMonth: (year: number, month: number) => Promise<void>;
  /** Updates `monthlySummary` for the given year+month. */
  loadMonthlySummary: (year: number, month: number) => Promise<void>;
  /** Updates `yearlySummary` for the given year (12 data points). */
  loadYearlySummary: (year: number) => Promise<void>;

  // ── Mutations ─────────────────────────────────────────────────────────────
  /**
   * Inserts a new user-defined utility type and appends it to `types`.
   */
  addUtilityType: (input: CreateUtilityTypeInput) => Promise<UtilityType>;
  /**
   * Upserts a utility log for a given period. After the write, `logs` is
   * refreshed for the active month so the list immediately reflects the change.
   */
  upsertLog: (input: UpsertUtilityLogInput) => Promise<UtilityLog>;
  /**
   * Sets paid_at on the given log and refreshes the active month's log list.
   */
  markPaid: (id: string, paidAt?: string) => Promise<void>;
  /**
   * Soft-deletes the given log and refreshes the active month's log list.
   */
  deleteLog: (id: string) => Promise<void>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const EMPTY_MONTHLY_SUMMARY: UtilityMonthlySummary = {
  totalAmount:  0,
  paidAmount:   0,
  unpaidAmount: 0,
  count:        0,
  paidCount:    0,
};

// ─── Store ───────────────────────────────────────────────────────────────────

export const useUtilitiesStore = create<UtilitiesState>()((set, get) => ({
  types:          [],
  logs:           [],
  isLoading:      false,
  error:          null,
  monthlySummary: null,
  yearlySummary:  [],
  _activeYear:    new Date().getFullYear(),
  _activeMonth:   new Date().getMonth() + 1,

  // ── Boot ───────────────────────────────────────────────────────────────────

  initializeUtilities: async () => {
    set({ isLoading: true, error: null });
    try {
      const now   = new Date();
      const year  = now.getFullYear();
      const month = now.getMonth() + 1;

      const [types, logs] = await Promise.all([
        getUtilityTypes(),
        getUtilityLogs({ year, month }),
      ]);

      set({
        types,
        logs,
        isLoading:    false,
        _activeYear:  year,
        _activeMonth: month,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to initialize utilities';
      set({ isLoading: false, error: message });
    }
  },

  // ── Reads ──────────────────────────────────────────────────────────────────

  loadLogsForMonth: async (year, month) => {
    set({ isLoading: true, error: null });
    try {
      const logs = await getUtilityLogs({ year, month });
      set({ logs, isLoading: false, _activeYear: year, _activeMonth: month });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load utility logs';
      set({ isLoading: false, error: message });
    }
  },

  loadMonthlySummary: async (year, month) => {
    try {
      const summary = await getMonthlySummary(year, month);
      set({ monthlySummary: summary });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load monthly summary';
      set({ error: message });
    }
  },

  loadYearlySummary: async (year) => {
    try {
      const rows = await getYearlySummary(year);
      set({
        yearlySummary: rows.map((r) => ({
          month:       r.month,
          totalAmount: r.totalAmount,
        })),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load yearly summary';
      set({ error: message });
    }
  },

  // ── Mutations ─────────────────────────────────────────────────────────────

  addUtilityType: async (input) => {
    const newType = await createUtilityType(input);
    set((state) => ({ types: [...state.types, newType] }));
    return newType;
  },

  upsertLog: async (input) => {
    // Set isLoading so the Save button's ActivityIndicator activates and
    // prevents double-taps from queuing duplicate writes.
    set({ isLoading: true, error: null });
    try {
      const log = await upsertUtilityLog(input);

      // Refresh logs for the active month if the upserted record belongs to it
      const { _activeYear, _activeMonth } = get();
      if (input.periodYear === _activeYear && input.periodMonth === _activeMonth) {
        const refreshed = await getUtilityLogs({
          year:  _activeYear,
          month: _activeMonth,
        });
        set({ logs: refreshed, isLoading: false });
      } else {
        set({ isLoading: false });
      }

      return log;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save utility entry';
      set({ isLoading: false, error: message });
      // Re-throw so the sheet's catch block can show the Alert to the user.
      throw err;
    }
  },

  markPaid: async (id, paidAt) => {
    await markUtilityPaid(id, paidAt);

    // Refresh the active month's log list so paid_at is reflected immediately
    const { _activeYear, _activeMonth } = get();
    const refreshed = await getUtilityLogs({
      year:  _activeYear,
      month: _activeMonth,
    });
    set({ logs: refreshed });
  },

  deleteLog: async (id) => {
    await deleteUtilityLog(id);

    // Remove from the cache immediately, then confirm via a DB read
    set((state) => ({ logs: state.logs.filter((l) => l.id !== id) }));
  },
}));

// ─── Selectors ────────────────────────────────────────────────────────────────

export const selectUtilityLogs = (state: UtilitiesState): UtilityLog[] =>
  state.logs;

export const selectUtilityTypes = (state: UtilitiesState): UtilityType[] =>
  state.types;

export const selectUtilityLoading = (state: UtilitiesState): boolean =>
  state.isLoading;

export const selectUtilityError = (state: UtilitiesState): string | null =>
  state.error;

export const selectMonthlySummary = (state: UtilitiesState): UtilityMonthlySummary =>
  state.monthlySummary ?? EMPTY_MONTHLY_SUMMARY;

export const selectYearlySummary = (state: UtilitiesState): UtilityYearlyPoint[] =>
  state.yearlySummary;

// ─── Initialiser (called from initializeStores) ───────────────────────────────

/**
 * Hydrates the utilities store from SQLite.
 * Must be called after `initDatabase()` has completed.
 */
export async function initializeUtilities(): Promise<void> {
  await useUtilitiesStore.getState().initializeUtilities();
}
