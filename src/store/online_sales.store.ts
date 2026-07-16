/**
 * Online Sales Store  (Suki — Business-Owner Module)
 * ==================================================
 * Owns the owner's LOCAL ledger of completed online ("Suki") orders — a summary
 * of today's online revenue plus the single entry point for recording a sale.
 *
 * Kept separate from the POS `usePosStore` summary so online and in-store revenue
 * are reported independently (the owner chose a separate online ledger).
 *
 * All SQLite work is delegated to `online_sales.repository.ts`. `recordSale` is
 * the one place a completed order becomes a local sale + a local stock deduction;
 * it is idempotent (guarded by the repository's UNIQUE order_id), so callers
 * (completion handler AND reconciliation) can invoke it freely.
 */

import { create } from 'zustand';
import {
  recordOnlineSale,
  getTodayOnlineSalesTotal,
} from '@/database/repositories/online_sales.repository';
import type { BusinessOrder } from '@/types';
import { useInventoryStore } from './inventory.store';
import { useDashboardStore } from './dashboard.store';

interface OnlineSalesState {
  /** Total online-sales revenue recorded today (device local date). */
  todayTotal: number;
  /** Number of online sales recorded today. */
  todayOrderCount: number;
  isLoading: boolean;
  error: string | null;
}

interface OnlineSalesActions {
  /** Loads today's online-sales total + count from the local ledger. */
  loadTodaySummary: () => Promise<void>;

  /**
   * Records a completed online order into the local ledger and deducts local
   * inventory (atomic + idempotent). On a fresh write, refreshes the inventory
   * store cache and today's summary. Never throws — returns whether a NEW sale
   * was written (false if already recorded or on failure); failures are left for
   * reconciliation to retry.
   */
  recordSale: (order: BusinessOrder) => Promise<boolean>;
}

export type OnlineSalesStore = OnlineSalesState & OnlineSalesActions;

const initialState: OnlineSalesState = {
  todayTotal: 0,
  todayOrderCount: 0,
  isLoading: false,
  error: null,
};

export const useOnlineSalesStore = create<OnlineSalesStore>()((set) => ({
  ...initialState,

  loadTodaySummary: async () => {
    set({ isLoading: true, error: null });
    try {
      const { total, orderCount } = await getTodayOnlineSalesTotal();
      set({ todayTotal: total, todayOrderCount: orderCount, isLoading: false });
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to load online sales',
      });
    }
  },

  recordSale: async (order) => {
    try {
      const recorded = await recordOnlineSale(order);
      if (recorded) {
        // Reflect the local stock deduction in the inventory cache, then refresh
        // today's online-sales summary.
        await useInventoryStore.getState().initializeInventory();
        const { total, orderCount } = await getTodayOnlineSalesTotal();
        set({ todayTotal: total, todayOrderCount: orderCount });

        // Overall sales on the dashboard include this ledger. Refreshing HERE —
        // after the ledger write — is deliberate: refreshing from the
        // order:completed socket handler races the write (the echo can arrive
        // before recordSale/reconciliation inserts the row) and would stamp a
        // fresh updatedAt over stale numbers. Guarded so it never triggers the
        // dashboard's initial load (that stays out of cold-start on purpose).
        const dashboard = useDashboardStore.getState();
        if (dashboard.data !== null && !dashboard.isLoading) {
          void dashboard.refreshDashboard();
        }
      }
      return recorded;
    } catch (err) {
      if (__DEV__) {
        console.warn('[online_sales] recordSale failed:', err);
      }
      set({ error: err instanceof Error ? err.message : 'Failed to record online sale' });
      return false;
    }
  },
}));

// ─── Selectors ──────────────────────────────────────────────────────────────

export const selectOnlineSalesTodayTotal = (s: OnlineSalesStore) => s.todayTotal;
export const selectOnlineSalesTodayCount = (s: OnlineSalesStore) => s.todayOrderCount;
export const selectOnlineSalesLoading    = (s: OnlineSalesStore) => s.isLoading;
export const selectOnlineSalesError      = (s: OnlineSalesStore) => s.error;
