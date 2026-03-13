/**
 * production.store.ts
 *
 * Zustand v5 store for Production Monitoring.
 * SQLite is the source of truth — this store is an in-memory cache.
 *
 * `todaySummary` is a single aggregated object (not an array) so the UI
 * can consume totals directly without summing in render.
 */

import { create } from 'zustand';
import type { ProductionLogWithDetails } from '@/types';
import {
  getProductionLogs,
  getTodayProductionSummary,
  getDailyProduction,
} from '../../database/repositories/production_logs.repository';

// ─── Exported UI types ────────────────────────────────────────────────────────

/** Aggregated totals for today — single object, not per-product rows. */
export interface ProductionSummary {
  totalUnitsProduced: number;
  totalCost:          number;
  productionRuns:     number;
  topProduct:         { name: string; units: number } | null;
}

/** Single-day aggregate — mirrors getDailyProduction() row shape. */
export interface DailyTrendPoint {
  date:       string; // 'YYYY-MM-DD'
  totalUnits: number;
  totalCost:  number;
}

// ─── State shape ──────────────────────────────────────────────────────────────

interface ProductionState {
  logs:         ProductionLogWithDetails[];
  todaySummary: ProductionSummary;
  dailyTrend:   DailyTrendPoint[];
  isLoading:    boolean;
  error:        string | null;

  initializeProduction: () => Promise<void>;
  refreshProduction:    () => Promise<void>;
  loadProductLogs:      (productId: string) => Promise<ProductionLogWithDetails[]>;
  clearError:           () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const EMPTY_SUMMARY: ProductionSummary = {
  totalUnitsProduced: 0,
  totalCost:          0,
  productionRuns:     0,
  topProduct:         null,
};

function buildSummary(
  byProduct: { productName: string; totalUnits: number; totalCost: number }[],
  runs:      number,
): ProductionSummary {
  let totalUnits = 0;
  let totalCost  = 0;
  for (const p of byProduct) {
    totalUnits += p.totalUnits;
    totalCost  += p.totalCost;
  }
  const top = byProduct[0] ?? null;
  return {
    totalUnitsProduced: totalUnits,
    totalCost,
    productionRuns:     runs,
    topProduct: top !== null ? { name: top.productName, units: top.totalUnits } : null,
  };
}

async function fetchAll(todayPrefix: string): Promise<{
  logs:         ProductionLogWithDetails[];
  todaySummary: ProductionSummary;
  dailyTrend:   DailyTrendPoint[];
}> {
  const [logs, byProduct, trend] = await Promise.all([
    getProductionLogs({ fromDate: todayPrefix, toDate: todayPrefix }),
    getTodayProductionSummary(),
    getDailyProduction(7),
  ]);
  return {
    logs,
    todaySummary: buildSummary(byProduct, logs.length),
    dailyTrend:   trend,
  };
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useProductionStore = create<ProductionState>()((set) => ({
  logs:         [],
  todaySummary: EMPTY_SUMMARY,
  dailyTrend:   [],
  isLoading:    false,
  error:        null,

  initializeProduction: async () => {
    set({ isLoading: true, error: null });
    try {
      const today = new Date().toISOString().slice(0, 10);
      const data  = await fetchAll(today);
      set({ ...data, isLoading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load production data';
      set({ isLoading: false, error: message });
    }
  },

  refreshProduction: async () => {
    set({ isLoading: true, error: null });
    try {
      const today = new Date().toISOString().slice(0, 10);
      const data  = await fetchAll(today);
      set({ ...data, isLoading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to refresh production data';
      set({ isLoading: false, error: message });
    }
  },

  loadProductLogs: async (productId) => {
    try {
      return await getProductionLogs({ productId });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load product logs';
      set({ error: message });
      return [];
    }
  },

  clearError: () => set({ error: null }),
}));

// ─── Selectors ────────────────────────────────────────────────────────────────

export const selectTodaySummary      = (s: ProductionState): ProductionSummary          => s.todaySummary;
export const selectDailyTrend        = (s: ProductionState): DailyTrendPoint[]           => s.dailyTrend;
export const selectProductionLogs    = (s: ProductionState): ProductionLogWithDetails[]  => s.logs;
export const selectProductionLoading = (s: ProductionState): boolean                     => s.isLoading;
export const selectProductionError   = (s: ProductionState): string | null               => s.error;

// ─── Bootstrap ────────────────────────────────────────────────────────────────

export async function initializeProduction(): Promise<void> {
  await useProductionStore.getState().initializeProduction();
}
