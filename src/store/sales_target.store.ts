/**
 * sales_target.store.ts
 *
 * Zustand v5 store for the Sales Target module.
 *
 * Responsibilities:
 *   - Holds the user-configured daily net income target (₱/day).
 *   - Derives weekly (×7) and monthly (×30) targets automatically.
 *   - Computes units needed per day/week/month based on net income per unit,
 *     which is sourced from either a specific product or the blended all-time
 *     contribution margin from the business_roi store.
 *   - Queries today's / this week's / this month's actual net income from
 *     `sales_orders` and `ingredient_consumption_logs` so progress can be shown
 *     against the target.
 *   - Persists the target configuration to the `sales_targets` SQLite table.
 *
 * Net income per unit calculation:
 *   When `targetProductId` is set and the product exists in inventory:
 *     net income/unit = price − cost_price − (monthlyFixedCosts / unitsSoldThisMonth)
 *     In practice, for simplicity and consistency with the rest of the system,
 *     we use: net income/unit = price − cost_price (variable margin only)
 *     Overhead is hard to allocate per-unit reliably at the SME level.
 *     The user sets the INCOME TARGET — not the margin. So the formula is:
 *       units_needed = daily_target / net_income_per_unit
 *       where net_income_per_unit = price − cost_price
 *   When `targetProductId` is null:
 *     We use the blended contribution margin per unit from business_roi store:
 *       blended = (totalRevenue − totalCOGS) / unitsSoldToDate
 *
 * Progress calculation:
 *   Actual daily/weekly/monthly net income is the SUM of sales_orders.total_amount
 *   minus the SUM of ingredient + raw material consumption costs for the same period.
 *   This mirrors the P&L formula in the dashboard store.
 *
 * Design decisions:
 *   - NOT added to initializeStores() because it depends on business_roi store
 *     being fully computed. Call initializeSalesTarget() after initializeStores()
 *     resolves (same pattern as business_roi).
 *   - `loadProgress()` is a cheap DB query that runs on focus, not on every render.
 *   - `isLoading` guards the initial `loadFromDB()` + `loadProgress()` calls.
 *   - `isSaving` guards the `saveTarget()` write path.
 *
 * TypeScript strict-mode notes:
 *   - exactOptionalPropertyTypes: conditional spread for optional fields.
 *   - noUncheckedIndexedAccess: ?? fallbacks on all array/record access.
 *   - noUnusedLocals/Parameters: unused vars prefixed with _.
 */

import { create } from 'zustand';
import { getDatabase } from '../../database/database';
import {
  getSalesTarget,
  saveSalesTarget,
} from '../../database/repositories/sales_targets.repository';
import { useInventoryStore } from './inventory.store';
import { useBusinessROIStore } from './business_roi.store';
import type { SalesTargetProgress, SalesTargetProgressPeriod } from '@/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns YYYY-MM-DD for today (local date).
 * Used to build the WHERE clause for today's sales query.
 */
function todayYMD(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Returns the ISO Monday (YYYY-MM-DD) of the current week (local dates).
 */
function thisWeekMondayYMD(): string {
  const d   = new Date();
  const dow = d.getDay(); // 0=Sun … 6=Sat
  const offsetToMonday = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + offsetToMonday);
  const y   = d.getFullYear();
  const m   = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Returns the first day of the current month as YYYY-MM-DD (local dates).
 */
function thisMonthStartYMD(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
}

/**
 * Caps a percentage to [0, 100] for display.
 */
function capPct(pct: number): number {
  return Math.min(100, Math.max(0, Math.round(pct * 10) / 10));
}

/**
 * Builds a progress period object.
 */
function buildPeriod(
  target:      number,
  actual:      number,
  unitsSold:   number,
  unitsNeeded: number,
): SalesTargetProgressPeriod {
  const percentage = target > 0 ? capPct((actual / target) * 100) : 0;
  return { target, actual, percentage, units_needed: unitsNeeded, units_sold: unitsSold };
}

// ─── DB query helpers ─────────────────────────────────────────────────────────

interface NetIncomePeriodResult {
  revenue:          number;
  ingredientCost:   number;
  rawMaterialCost:  number;
  unitsSold:        number;
}

/**
 * Queries the net income for a given date range from SQLite.
 * Net income = SUM(sales_orders.total_amount) - ingredient_cost - raw_material_cost
 * for the same period (date range on completed orders).
 *
 * @param fromDate  Inclusive start date "YYYY-MM-DD"
 * @param toDate    Inclusive end date   "YYYY-MM-DD" (defaults to today)
 */
async function fetchNetIncomeForPeriod(
  fromDate: string,
  toDate:   string,
): Promise<NetIncomePeriodResult> {
  try {
    const db = await getDatabase();

    // Revenue from completed orders in the period
    const revenueRow = await db.getFirstAsync<{ revenue: number | null; units_sold: number | null }>(
      `SELECT
         SUM(so.total_amount)    AS revenue,
         SUM(soi.quantity)       AS units_sold
       FROM sales_orders so
       LEFT JOIN sales_order_items soi ON soi.sales_order_id = so.id
       WHERE so.status = 'completed'
         AND date(so.created_at) >= date(?)
         AND date(so.created_at) <= date(?)`,
      [fromDate, toDate],
    );

    // Ingredient consumption cost for the same period
    const ingredientRow = await db.getFirstAsync<{ total: number | null }>(
      `SELECT SUM(total_cost) AS total
       FROM ingredient_consumption_logs
       WHERE cancelled_at IS NULL
         AND trigger_type != 'RETURN'
         AND date(consumed_at) >= date(?)
         AND date(consumed_at) <= date(?)`,
      [fromDate, toDate],
    );

    // Raw material consumption cost for the same period
    const rawMatRow = await db.getFirstAsync<{ total: number | null }>(
      `SELECT SUM(quantity_used * cost_per_unit) AS total
       FROM raw_material_consumption_logs
       WHERE quantity_used > 0
         AND date(consumed_at) >= date(?)
         AND date(consumed_at) <= date(?)`,
      [fromDate, toDate],
    );

    return {
      revenue:         revenueRow?.revenue         ?? 0,
      ingredientCost:  ingredientRow?.total         ?? 0,
      rawMaterialCost: rawMatRow?.total             ?? 0,
      unitsSold:       revenueRow?.units_sold        ?? 0,
    };
  } catch {
    return { revenue: 0, ingredientCost: 0, rawMaterialCost: 0, unitsSold: 0 };
  }
}

// ─── State shape ──────────────────────────────────────────────────────────────

export interface SalesTargetState {
  // ── Configuration ─────────────────────────────────────────────────────────
  /** Daily net income target in ₱. */
  dailyTarget:    number;
  /** Auto-derived: dailyTarget × 7. */
  weeklyTarget:   number;
  /** Auto-derived: dailyTarget × 30. */
  monthlyTarget:  number;
  /** Optional product ID to use for per-product units-needed calculation. */
  targetProductId: string | null;

  // ── Computed units needed ──────────────────────────────────────────────────
  /** Net income per unit used in units_needed calculation. */
  netIncomePerUnit:   number;
  /** Units to sell per day to hit dailyTarget. */
  unitsNeededPerDay:  number;
  /** Units to sell per week to hit weeklyTarget. */
  unitsNeededPerWeek: number;
  /** Units to sell per month to hit monthlyTarget. */
  unitsNeededPerMonth: number;
  /** Per-product breakdown when multiple products are selected. Empty when using blended margin. */
  perProductUnits: Array<{ id: string; name: string; unitsPerDay: number }>;

  // ── Progress (loaded on demand) ───────────────────────────────────────────
  progress: SalesTargetProgress;

  // ── Status ────────────────────────────────────────────────────────────────
  isLoading:    boolean;
  isSaving:     boolean;
  isConfigured: boolean; // true when dailyTarget > 0
  error:        string | null;

  // ── Actions ───────────────────────────────────────────────────────────────
  /** Loads the persisted target from SQLite and recomputes units needed. */
  loadFromDB:           () => Promise<void>;
  /**
   * Sets a new daily target in-memory, recomputes derived fields, and
   * persists to SQLite. Pass `productId = null` to use the blended margin.
   */
  setDailyTarget:       (amount: number, productId?: string | null) => Promise<void>;
  /** Updates the target product without changing the daily target amount. */
  setTargetProduct:     (productId: string | null) => Promise<void>;
  /** Queries actual period sales from SQLite and updates `progress`. */
  loadProgress:         () => Promise<void>;
  /** Returns the progress percentage for a given actual net income vs period target. */
  getDailyProgress:     (actualNetIncome: number) => number;
  getWeeklyProgress:    (actualNetIncome: number) => number;
  getMonthlyProgress:   (actualNetIncome: number) => number;
}

// ─── Net income per unit resolver ────────────────────────────────────────────

/**
 * Resolves the net income per unit to use for units-needed calculation.
 *
 * Priority:
 *   1. If targetProductId is set and the product exists in inventory with
 *      both price and cost_price set: returns price − cost_price.
 *   2. Otherwise: returns the blended contribution margin per unit from
 *      the business_roi store (totalRevenue − totalCOGS) / unitsSoldToDate.
 *   3. Falls back to 0 if no data is available (prevents division by zero).
 */
function resolveNetIncomePerUnit(targetProductId: string | null): number {
  if (targetProductId !== null) {
    const items = useInventoryStore.getState().items;

    // Deserialize: may be a JSON array of IDs (multi-select) or a single ID
    let productIds: string[];
    try {
      const parsed = JSON.parse(targetProductId) as unknown;
      productIds = Array.isArray(parsed) ? (parsed as string[]) : [targetProductId];
    } catch {
      productIds = [targetProductId];
    }

    const margins = productIds
      .map((id) => items.find((item) => item.id === id && item.category === 'product'))
      .filter((p): p is NonNullable<typeof p> => p !== undefined)
      .map((p) => {
        const price     = p.price     ?? 0;
        const costPrice = p.costPrice ?? 0;
        return price > 0 && price > costPrice ? price - costPrice : 0;
      })
      .filter((m) => m > 0);

    if (margins.length > 0) {
      return margins.reduce((a, b) => a + b, 0) / margins.length;
    }
  }

  // Blended fallback from business ROI store
  const roi = useBusinessROIStore.getState();
  const { totalRevenue, totalCOGS, unitsSoldToDate } = roi;
  if (unitsSoldToDate > 0 && totalRevenue > totalCOGS) {
    return (totalRevenue - totalCOGS) / unitsSoldToDate;
  }

  return 0;
}

/**
 * Computes units needed per day given a daily target and net income per unit.
 * Returns 0 when net income per unit is 0 to avoid NaN / Infinity.
 */
function calcUnitsPerDay(dailyTarget: number, netIncomePerUnit: number): number {
  if (netIncomePerUnit <= 0 || dailyTarget <= 0) return 0;
  return Math.ceil(dailyTarget / netIncomePerUnit);
}

/**
 * When multiple products are selected, returns per-product daily unit targets.
 * Each product's units/day = ceil(dailyTarget / (price - costPrice)).
 * Returns [] when targetProductId is null or only one product is selected.
 */
function resolvePerProductUnits(
  targetProductId: string | null,
  dailyTarget: number,
): Array<{ id: string; name: string; unitsPerDay: number }> {
  if (targetProductId === null || dailyTarget <= 0) return [];

  let productIds: string[];
  try {
    const parsed = JSON.parse(targetProductId) as unknown;
    productIds = Array.isArray(parsed) ? (parsed as string[]) : [targetProductId];
  } catch {
    productIds = [targetProductId];
  }

  if (productIds.length < 2) return [];

  const items = useInventoryStore.getState().items;
  const result: Array<{ id: string; name: string; unitsPerDay: number }> = [];

  for (const id of productIds) {
    const item = items.find((i) => i.id === id && i.category === 'product');
    if (item === undefined) continue;
    const price     = item.price     ?? 0;
    const costPrice = item.costPrice ?? 0;
    const margin    = price > 0 && price > costPrice ? price - costPrice : 0;
    if (margin > 0) {
      result.push({ id, name: item.name, unitsPerDay: Math.ceil(dailyTarget / margin) });
    }
  }

  return result;
}

// ─── Empty progress constant ──────────────────────────────────────────────────

const EMPTY_PERIOD: SalesTargetProgressPeriod = {
  target:       0,
  actual:       0,
  percentage:   0,
  units_needed: 0,
  units_sold:   0,
};

const EMPTY_PROGRESS: SalesTargetProgress = {
  daily:   EMPTY_PERIOD,
  weekly:  EMPTY_PERIOD,
  monthly: EMPTY_PERIOD,
};

// ─── Store ────────────────────────────────────────────────────────────────────

export const useSalesTargetStore = create<SalesTargetState>()((set, get) => ({
  // ── Initial state ──────────────────────────────────────────────────────────
  dailyTarget:         0,
  weeklyTarget:        0,
  monthlyTarget:       0,
  targetProductId:     null,
  netIncomePerUnit:    0,
  unitsNeededPerDay:   0,
  unitsNeededPerWeek:  0,
  unitsNeededPerMonth: 0,
  perProductUnits:     [],
  progress:            EMPTY_PROGRESS,
  isLoading:           false,
  isSaving:            false,
  isConfigured:        false,
  error:               null,

  // ── Actions ────────────────────────────────────────────────────────────────

  loadFromDB: async () => {
    if (get().isLoading) return;
    set({ isLoading: true, error: null });
    try {
      const row            = await getSalesTarget();
      const targetProductId = row.target_product_id;
      const dailyTarget    = row.daily_target;
      const weeklyTarget   = dailyTarget * 7;
      const monthlyTarget  = dailyTarget * 30;
      const netIncomePerUnit = resolveNetIncomePerUnit(targetProductId);
      const unitsPerDay    = calcUnitsPerDay(dailyTarget, netIncomePerUnit);
      const perProductUnits = resolvePerProductUnits(targetProductId, dailyTarget);

      set({
        dailyTarget,
        weeklyTarget,
        monthlyTarget,
        targetProductId,
        netIncomePerUnit,
        unitsNeededPerDay:   unitsPerDay,
        unitsNeededPerWeek:  unitsPerDay * 7,
        unitsNeededPerMonth: unitsPerDay * 30,
        perProductUnits,
        isConfigured:        dailyTarget > 0,
        isLoading:           false,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load sales target.';
      set({ isLoading: false, error: message });
    }
  },

  setDailyTarget: async (amount: number, productId?: string | null) => {
    const targetProductId  = productId !== undefined ? productId : get().targetProductId;
    const dailyTarget      = Math.max(0, amount);
    const weeklyTarget     = dailyTarget * 7;
    const monthlyTarget    = dailyTarget * 30;
    const netIncomePerUnit = resolveNetIncomePerUnit(targetProductId);
    const unitsPerDay      = calcUnitsPerDay(dailyTarget, netIncomePerUnit);
    const perProductUnits  = resolvePerProductUnits(targetProductId, dailyTarget);

    set({
      dailyTarget,
      weeklyTarget,
      monthlyTarget,
      ...(targetProductId !== undefined ? { targetProductId } : {}),
      netIncomePerUnit,
      unitsNeededPerDay:   unitsPerDay,
      unitsNeededPerWeek:  unitsPerDay * 7,
      unitsNeededPerMonth: unitsPerDay * 30,
      perProductUnits,
      isConfigured:        dailyTarget > 0,
      isSaving:            true,
      error:               null,
    });

    try {
      await saveSalesTarget({
        daily_target: dailyTarget,
        ...(targetProductId !== null
          ? { target_product_id: targetProductId }
          : { target_product_id: null }),
      });
      set({ isSaving: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save sales target.';
      set({ isSaving: false, error: message });
    }
  },

  setTargetProduct: async (productId: string | null) => {
    const { dailyTarget } = get();
    const netIncomePerUnit = resolveNetIncomePerUnit(productId);
    const unitsPerDay      = calcUnitsPerDay(dailyTarget, netIncomePerUnit);
    const perProductUnits  = resolvePerProductUnits(productId, dailyTarget);

    set({
      targetProductId:     productId,
      netIncomePerUnit,
      unitsNeededPerDay:   unitsPerDay,
      unitsNeededPerWeek:  unitsPerDay * 7,
      unitsNeededPerMonth: unitsPerDay * 30,
      perProductUnits,
      isSaving:            true,
      error:               null,
    });

    try {
      await saveSalesTarget({
        daily_target: dailyTarget,
        ...(productId !== null
          ? { target_product_id: productId }
          : { target_product_id: null }),
      });
      set({ isSaving: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update target product.';
      set({ isSaving: false, error: message });
    }
  },

  loadProgress: async () => {
    const { dailyTarget, weeklyTarget, monthlyTarget, unitsNeededPerDay } = get();

    if (dailyTarget <= 0) {
      set({ progress: EMPTY_PROGRESS });
      return;
    }

    try {
      const today      = todayYMD();
      const weekStart  = thisWeekMondayYMD();
      const monthStart = thisMonthStartYMD();

      const [dailyData, weeklyData, monthlyData] = await Promise.all([
        fetchNetIncomeForPeriod(today, today),
        fetchNetIncomeForPeriod(weekStart, today),
        fetchNetIncomeForPeriod(monthStart, today),
      ]);

      const dailyActual   = Math.max(0, dailyData.revenue   - dailyData.ingredientCost   - dailyData.rawMaterialCost);
      const weeklyActual  = Math.max(0, weeklyData.revenue  - weeklyData.ingredientCost  - weeklyData.rawMaterialCost);
      const monthlyActual = Math.max(0, monthlyData.revenue - monthlyData.ingredientCost - monthlyData.rawMaterialCost);

      set({
        progress: {
          daily: buildPeriod(
            dailyTarget,
            dailyActual,
            dailyData.unitsSold,
            unitsNeededPerDay,
          ),
          weekly: buildPeriod(
            weeklyTarget,
            weeklyActual,
            weeklyData.unitsSold,
            unitsNeededPerDay * 7,
          ),
          monthly: buildPeriod(
            monthlyTarget,
            monthlyActual,
            monthlyData.unitsSold,
            unitsNeededPerDay * 30,
          ),
        },
      });
    } catch {
      // Non-fatal: leave previous progress intact
    }
  },

  getDailyProgress: (actualNetIncome: number) => {
    const { dailyTarget } = get();
    if (dailyTarget <= 0) return 0;
    return capPct((actualNetIncome / dailyTarget) * 100);
  },

  getWeeklyProgress: (actualNetIncome: number) => {
    const { weeklyTarget } = get();
    if (weeklyTarget <= 0) return 0;
    return capPct((actualNetIncome / weeklyTarget) * 100);
  },

  getMonthlyProgress: (actualNetIncome: number) => {
    const { monthlyTarget } = get();
    if (monthlyTarget <= 0) return 0;
    return capPct((actualNetIncome / monthlyTarget) * 100);
  },
}));

// ─── Selectors ────────────────────────────────────────────────────────────────

export const selectDailyTarget          = (s: SalesTargetState): number  => s.dailyTarget;
export const selectWeeklyTarget         = (s: SalesTargetState): number  => s.weeklyTarget;
export const selectMonthlyTarget        = (s: SalesTargetState): number  => s.monthlyTarget;
export const selectTargetProductId      = (s: SalesTargetState): string | null => s.targetProductId;
export const selectNetIncomePerUnit     = (s: SalesTargetState): number  => s.netIncomePerUnit;
export const selectUnitsNeededPerDay    = (s: SalesTargetState): number  => s.unitsNeededPerDay;
export const selectUnitsNeededPerWeek   = (s: SalesTargetState): number  => s.unitsNeededPerWeek;
export const selectUnitsNeededPerMonth  = (s: SalesTargetState): number  => s.unitsNeededPerMonth;
export const selectSalesTargetProgress  = (s: SalesTargetState): SalesTargetProgress => s.progress;
export const selectSalesTargetLoading   = (s: SalesTargetState): boolean => s.isLoading;
export const selectSalesTargetSaving    = (s: SalesTargetState): boolean => s.isSaving;
export const selectSalesTargetError     = (s: SalesTargetState): string | null => s.error;
export const selectSalesTargetConfigured = (s: SalesTargetState): boolean => s.isConfigured;

// Primitive progress selectors — return numbers so useSyncExternalStore compares
// with Object.is(number, number) and never sees a "new reference" after loadProgress.
export const selectDailyProgressPct   = (s: SalesTargetState): number => s.progress.daily.percentage;
export const selectDailyProgressActual = (s: SalesTargetState): number => s.progress.daily.actual;
export const selectDailyUnitsSold     = (s: SalesTargetState): number => s.progress.daily.units_sold;
export const selectWeeklyProgressActual = (s: SalesTargetState): number => s.progress.weekly.actual;
export const selectWeeklyProgressPct  = (s: SalesTargetState): number => s.progress.weekly.percentage;
export const selectMonthlyProgressActual = (s: SalesTargetState): number => s.progress.monthly.actual;
export const selectMonthlyProgressPct = (s: SalesTargetState): number => s.progress.monthly.percentage;
export const selectPerProductUnits    = (s: SalesTargetState): Array<{ id: string; name: string; unitsPerDay: number }> => s.perProductUnits;

// ─── Initializer ─────────────────────────────────────────────────────────────

/**
 * Call after `initializeStores()` resolves. Loads the persisted target from
 * SQLite and immediately fetches the current period progress.
 */
export async function initializeSalesTarget(): Promise<void> {
  const store = useSalesTargetStore.getState();
  await store.loadFromDB();
  await store.loadProgress();
}
