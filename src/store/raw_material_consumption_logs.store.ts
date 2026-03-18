/**
 * raw_material_consumption_logs.store.ts
 *
 * Zustand v5 store for the Raw Material Consumption Logs feature.
 * SQLite is the source of truth — this store is an in-memory cache.
 *
 * Design mirrors ingredient_consumption.store.ts:
 *   - `logs`       — paginated list for the main FlatList (accumulates on load-more)
 *   - `summary`    — per-material aggregates shown in the header
 *   - `dailyTrend` — 7-day daily totals for the bar chart
 *   - `filters`    — active filter state (reason only for now)
 *   - `hasMore`    — true while there are more rows to load
 *
 * Selector stability:
 *   All selectors that could return arrays use module-level EMPTY_* constants
 *   as fallbacks — NEVER inline `?? []` which would create a new array
 *   reference on every call and cause an infinite useSyncExternalStore loop.
 */

import { create } from 'zustand';
import type {
  RawMaterialReason,
  RawMaterialConsumptionLogDetail,
  RawMaterialConsumptionSummary,
  RawMaterialConsumptionTrend,
} from '@/types';
import {
  getRawMaterialConsumptionLogs,
  getRawMaterialConsumptionLogCount,
  getRawMaterialConsumptionSummary,
  getRawMaterialConsumptionTrend,
  getWasteRawMaterialCost,
} from '../../database/repositories/raw_materials.repository';

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 30;

// ─── Stable empty-array constants ─────────────────────────────────────────────
// NEVER use inline `?? []` in selectors — it creates a new reference each call.

const EMPTY_LOGS:    RawMaterialConsumptionLogDetail[] = [];
const EMPTY_SUMMARY: RawMaterialConsumptionSummary[]   = [];
const EMPTY_TREND:   RawMaterialConsumptionTrend[]      = [];

// ─── Exported types ───────────────────────────────────────────────────────────

export type { RawMaterialConsumptionLogDetail, RawMaterialConsumptionSummary, RawMaterialConsumptionTrend };

export interface RawMaterialLogFilters {
  reason?: RawMaterialReason;
}

// ─── State shape ──────────────────────────────────────────────────────────────

interface RawMaterialConsumptionLogsState {
  // Data
  logs:           RawMaterialConsumptionLogDetail[];
  summary:        RawMaterialConsumptionSummary[];
  dailyTrend:     RawMaterialConsumptionTrend[];
  wasteTotalCost: number;
  // Pagination
  totalCount:  number;
  hasMore:     boolean;
  currentPage: number;
  // Filters
  filters:     RawMaterialLogFilters;
  // Status
  isLoading:    boolean;
  isLoadingMore: boolean;
  error:         string | null;

  // Actions
  initializeLogs: () => Promise<void>;
  refreshLogs:    () => Promise<void>;
  loadMore:       () => Promise<void>;
  setFilters:     (filters: RawMaterialLogFilters) => Promise<void>;
  clearError:     () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function fetchPage(
  filters: RawMaterialLogFilters,
  offset:  number,
): Promise<{ logs: RawMaterialConsumptionLogDetail[]; totalCount: number }> {
  const [logs, totalCount] = await Promise.all([
    getRawMaterialConsumptionLogs({
      limit:  PAGE_SIZE,
      offset,
      ...(filters.reason !== undefined ? { reason: filters.reason } : {}),
    }),
    getRawMaterialConsumptionLogCount(filters.reason),
  ]);
  return { logs, totalCount };
}

async function fetchSupportingData(): Promise<{
  summary:        RawMaterialConsumptionSummary[];
  dailyTrend:     RawMaterialConsumptionTrend[];
  wasteTotalCost: number;
}> {
  const [summary, dailyTrend, wasteTotalCost] = await Promise.all([
    getRawMaterialConsumptionSummary(),
    getRawMaterialConsumptionTrend(7),
    getWasteRawMaterialCost(),
  ]);
  return { summary, dailyTrend, wasteTotalCost };
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useRawMaterialConsumptionLogsStore =
  create<RawMaterialConsumptionLogsState>()((set, get) => ({
    logs:           [],
    summary:        [],
    dailyTrend:     [],
    wasteTotalCost: 0,
    totalCount:     0,
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
        const [{ logs, totalCount }, { summary, dailyTrend, wasteTotalCost }] = await Promise.all([
          fetchPage(filters, 0),
          fetchSupportingData(),
        ]);
        set({
          logs,
          summary,
          dailyTrend,
          wasteTotalCost,
          totalCount,
          hasMore:     totalCount > logs.length,
          currentPage: 0,
          isLoading:   false,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load raw material logs';
        set({ isLoading: false, error: message });
      }
    },

    refreshLogs: async () => {
      set({ isLoading: true, error: null });
      try {
        const { filters } = get();
        const [{ logs, totalCount }, { summary, dailyTrend, wasteTotalCost }] = await Promise.all([
          fetchPage(filters, 0),
          fetchSupportingData(),
        ]);
        set({
          logs,
          summary,
          dailyTrend,
          wasteTotalCost,
          totalCount,
          hasMore:     totalCount > logs.length,
          currentPage: 0,
          isLoading:   false,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to refresh raw material logs';
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
        const [{ logs, totalCount }, { summary, dailyTrend, wasteTotalCost }] = await Promise.all([
          fetchPage(filters, 0),
          fetchSupportingData(),
        ]);
        set({
          logs,
          summary,
          dailyTrend,
          wasteTotalCost,
          totalCount,
          hasMore:   totalCount > logs.length,
          isLoading: false,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to apply filters';
        set({ isLoading: false, error: message });
      }
    },

    clearError: () => set({ error: null }),
  }));

// ─── Bootstrap ────────────────────────────────────────────────────────────────

export async function initializeRawMaterialConsumptionLogs(): Promise<void> {
  await useRawMaterialConsumptionLogsStore.getState().initializeLogs();
}

// ─── Selectors ────────────────────────────────────────────────────────────────
// All selectors returning arrays use module-level EMPTY_* constants as fallbacks.

export const selectRawMaterialLogs =
  (s: RawMaterialConsumptionLogsState): RawMaterialConsumptionLogDetail[] =>
    s.logs.length > 0 ? s.logs : EMPTY_LOGS;

export const selectRawMaterialLogSummary =
  (s: RawMaterialConsumptionLogsState): RawMaterialConsumptionSummary[] =>
    s.summary.length > 0 ? s.summary : EMPTY_SUMMARY;

export const selectRawMaterialLogTrend =
  (s: RawMaterialConsumptionLogsState): RawMaterialConsumptionTrend[] =>
    s.dailyTrend.length > 0 ? s.dailyTrend : EMPTY_TREND;

export const selectRawMaterialLogFilters =
  (s: RawMaterialConsumptionLogsState): RawMaterialLogFilters => s.filters;

export const selectRawMaterialLogHasMore =
  (s: RawMaterialConsumptionLogsState): boolean => s.hasMore;

export const selectRawMaterialLogLoading =
  (s: RawMaterialConsumptionLogsState): boolean => s.isLoading;

export const selectRawMaterialLogLoadingMore =
  (s: RawMaterialConsumptionLogsState): boolean => s.isLoadingMore;

export const selectRawMaterialLogError =
  (s: RawMaterialConsumptionLogsState): string | null => s.error;

export const selectRawMaterialLogTotalCount =
  (s: RawMaterialConsumptionLogsState): number => s.totalCount;

export const selectRawMaterialWasteCost =
  (s: RawMaterialConsumptionLogsState): number => s.wasteTotalCost;
