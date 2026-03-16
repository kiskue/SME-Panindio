/**
 * ingredient_consumption.store.ts
 *
 * Zustand v5 store for the Ingredient Consumption Logs feature.
 * SQLite is the source of truth — this store is an in-memory cache.
 *
 * Design:
 *   - `logs`    — paginated list for the main FlatList (accumulates on load-more)
 *   - `summary` — per-ingredient aggregates shown in the header
 *   - `filters` — active filter state (ingredient, triggerType, date range)
 *   - `hasMore`  — true while there are more rows to load
 *
 * Pagination uses LIMIT + OFFSET on `consumed_at DESC` ordering.
 */

import { create } from 'zustand';
import type {
  IngredientConsumptionLogDetail,
  IngredientConsumptionSummary,
  IngredientConsumptionTrigger,
} from '@/types';
import {
  getConsumptionLogs,
  getConsumptionLogCount,
  getIngredientConsumptionSummary,
  getDailyConsumptionTrend,
  createConsumptionLog,
} from '../../database/repositories/ingredient_consumption_logs.repository';
import type { CreateConsumptionLogInput } from '../../database/repositories/ingredient_consumption_logs.repository';
import { adjustItemQuantity } from '../../database/repositories/inventory_items.repository';
import { useInventoryStore } from './inventory.store';

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 30;

// ─── Exported types ───────────────────────────────────────────────────────────

export interface ConsumptionFilters {
  ingredientId?:  string;
  triggerType?:   IngredientConsumptionTrigger;
  fromDate?:      string; // 'YYYY-MM-DD'
  toDate?:        string; // 'YYYY-MM-DD'
}

export interface ConsumptionDailyTrend {
  date:          string;
  totalConsumed: number;
  totalCost:     number;
}

// ─── State shape ──────────────────────────────────────────────────────────────

interface IngredientConsumptionState {
  // Data
  logs:        IngredientConsumptionLogDetail[];
  summary:     IngredientConsumptionSummary[];
  dailyTrend:  ConsumptionDailyTrend[];
  // Pagination
  totalCount:  number;
  hasMore:     boolean;
  currentPage: number;
  // Filters
  filters:     ConsumptionFilters;
  // Status
  isLoading:    boolean;
  isLoadingMore: boolean;
  error:         string | null;

  // Actions
  initializeLogs:  () => Promise<void>;
  refreshLogs:     () => Promise<void>;
  loadMore:        () => Promise<void>;
  setFilters:      (filters: ConsumptionFilters) => Promise<void>;
  logManualEntry:  (input: CreateConsumptionLogInput) => Promise<void>;
  clearError:      () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function fetchPage(
  filters: ConsumptionFilters,
  offset:  number,
): Promise<{
  logs:       IngredientConsumptionLogDetail[];
  totalCount: number;
}> {
  const [logs, totalCount] = await Promise.all([
    getConsumptionLogs({ ...filters, limit: PAGE_SIZE, offset }),
    getConsumptionLogCount(filters),
  ]);
  return { logs, totalCount };
}

async function fetchSupportingData(filters: ConsumptionFilters): Promise<{
  summary:    IngredientConsumptionSummary[];
  dailyTrend: ConsumptionDailyTrend[];
}> {
  const [summary, dailyTrend] = await Promise.all([
    getIngredientConsumptionSummary({
      ...(filters.fromDate    !== undefined ? { fromDate:    filters.fromDate    } : {}),
      ...(filters.toDate      !== undefined ? { toDate:      filters.toDate      } : {}),
      ...(filters.triggerType !== undefined ? { triggerType: filters.triggerType } : {}),
    }),
    getDailyConsumptionTrend(7, filters.ingredientId),
  ]);
  return { summary, dailyTrend };
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useIngredientConsumptionStore = create<IngredientConsumptionState>()(
  (set, get) => ({
    logs:          [],
    summary:       [],
    dailyTrend:    [],
    totalCount:    0,
    hasMore:       false,
    currentPage:   0,
    filters:       {},
    isLoading:     false,
    isLoadingMore: false,
    error:         null,

    initializeLogs: async () => {
      set({ isLoading: true, error: null });
      try {
        const { filters } = get();
        const [{ logs, totalCount }, { summary, dailyTrend }] = await Promise.all([
          fetchPage(filters, 0),
          fetchSupportingData(filters),
        ]);
        set({
          logs,
          summary,
          dailyTrend,
          totalCount,
          hasMore:     totalCount > logs.length,
          currentPage: 0,
          isLoading:   false,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load consumption logs';
        set({ isLoading: false, error: message });
      }
    },

    refreshLogs: async () => {
      set({ isLoading: true, error: null });
      try {
        const { filters } = get();
        const [{ logs, totalCount }, { summary, dailyTrend }] = await Promise.all([
          fetchPage(filters, 0),
          fetchSupportingData(filters),
        ]);
        set({
          logs,
          summary,
          dailyTrend,
          totalCount,
          hasMore:     totalCount > logs.length,
          currentPage: 0,
          isLoading:   false,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to refresh consumption logs';
        set({ isLoading: false, error: message });
      }
    },

    loadMore: async () => {
      const { hasMore, isLoadingMore, isLoading, currentPage, filters, logs } = get();
      if (!hasMore || isLoadingMore || isLoading) return;

      set({ isLoadingMore: true });
      try {
        const nextPage = currentPage + 1;
        const offset   = nextPage * PAGE_SIZE;
        const { logs: newLogs, totalCount } = await fetchPage(filters, offset);

        set({
          logs:          [...logs, ...newLogs],
          totalCount,
          hasMore:       totalCount > (logs.length + newLogs.length),
          currentPage:   nextPage,
          isLoadingMore: false,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load more logs';
        set({ isLoadingMore: false, error: message });
      }
    },

    setFilters: async (filters) => {
      set({ filters, isLoading: true, error: null, logs: [], currentPage: 0 });
      try {
        const [{ logs, totalCount }, { summary, dailyTrend }] = await Promise.all([
          fetchPage(filters, 0),
          fetchSupportingData(filters),
        ]);
        set({
          logs,
          summary,
          dailyTrend,
          totalCount,
          hasMore:   totalCount > logs.length,
          isLoading: false,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to apply filters';
        set({ isLoading: false, error: message });
      }
    },

    logManualEntry: async (input) => {
      set({ error: null });
      try {
        // 1. Write the immutable audit log entry.
        await createConsumptionLog(input);

        // 2. Deduct (or restore for RETURN) ingredient stock.
        //    quantityConsumed is already negative for RETURN events — the
        //    signed delta passed to adjustItemQuantity is therefore correct
        //    for all trigger types without special-casing here.
        const newQuantity = await adjustItemQuantity(
          input.ingredientId,
          -input.quantityConsumed, // negate: positive consumption → negative delta
        );

        // 3. Mirror the stock change in the inventory store cache so any
        //    screen reading ingredients (e.g. the picker) reflects reality
        //    immediately, without requiring a full inventory reload.
        if (newQuantity !== null) {
          useInventoryStore.getState().updateItem(input.ingredientId, {
            quantity: newQuantity,
          });
        }

        // 4. Refresh the consumption log list so the new entry is visible.
        await get().refreshLogs();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to save consumption log';
        set({ error: message });
        // Re-throw so the form can distinguish success from failure and avoid
        // showing "Entry saved successfully!" when the DB write actually failed.
        throw err;
      }
    },

    clearError: () => set({ error: null }),
  }),
);

// ─── Selectors ────────────────────────────────────────────────────────────────

export const selectConsumptionLogs       = (s: IngredientConsumptionState): IngredientConsumptionLogDetail[]    => s.logs;
export const selectConsumptionSummary    = (s: IngredientConsumptionState): IngredientConsumptionSummary[]      => s.summary;
export const selectConsumptionTrend      = (s: IngredientConsumptionState): ConsumptionDailyTrend[]             => s.dailyTrend;
export const selectConsumptionFilters    = (s: IngredientConsumptionState): ConsumptionFilters                   => s.filters;
export const selectConsumptionHasMore    = (s: IngredientConsumptionState): boolean                              => s.hasMore;
export const selectConsumptionLoading    = (s: IngredientConsumptionState): boolean                              => s.isLoading;
export const selectConsumptionLoadingMore = (s: IngredientConsumptionState): boolean                             => s.isLoadingMore;
export const selectConsumptionError      = (s: IngredientConsumptionState): string | null                        => s.error;
export const selectConsumptionTotalCount = (s: IngredientConsumptionState): number                               => s.totalCount;

// ─── Bootstrap ────────────────────────────────────────────────────────────────

export async function initializeIngredientConsumption(): Promise<void> {
  await useIngredientConsumptionStore.getState().initializeLogs();
}
