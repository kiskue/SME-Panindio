/**
 * dashboard.repository.ts
 *
 * Read-only aggregation layer for the Dashboard module.
 * No writes, no mutations — all queries are SELECT-only.
 *
 * All SQL is isolated here. No SQL may appear in screens, hooks, or stores.
 * Callers receive a fully assembled DashboardData object via getDashboardData().
 *
 * Period semantics (device local time):
 *   day   — 00:00:00.000 → 23:59:59.999 of today
 *   week  — Monday 00:00:00.000 → Sunday 23:59:59.999 of current ISO week
 *   month — 1st 00:00:00.000 → last-day 23:59:59.999 of current calendar month
 *   year  — Jan 1 00:00:00.000 → Dec 31 23:59:59.999 of current calendar year
 *
 * All date columns in the target tables store ISO 8601 TEXT values
 * (e.g. "2026-03-16T08:30:00.000Z"), so bounds are compared with
 * standard string inequality — no CAST or strftime required.
 *
 * Concurrency strategy:
 *   - The four KPI aggregate queries and all trend sub-interval queries
 *     are dispatched with Promise.all so they run concurrently on the
 *     same WAL-mode database connection.
 *   - Individual trend points (up to 31 for month-view) are also batched
 *     in a single Promise.all to avoid serial round-trips.
 *
 * utility_logs note:
 *   utility_logs stores billing data by period_year / period_month integers,
 *   not by an ISO event timestamp. The KPI query therefore filters on
 *   period_year / period_month integers (not paid_at / created_at ranges),
 *   which is the correct semantic anchor for "what utility cost did the
 *   business incur in this billing window."
 *
 *   For the trend chart, utilities costs are omitted from sub-intervals because
 *   utility bills are monthly lump sums — plotting them per 3-hour or per-day
 *   bucket would misrepresent the data. Only sales and ingredient costs appear
 *   in trend points, consistent with DashboardTrendPoint.
 */

import { getDatabase } from '../database';
import type {
  DashboardPeriod,
  DashboardData,
  DashboardKPIs,
  DashboardTrendPoint,
  DashboardMetrics,
} from '@/types';
import { getIngredientWasteCost } from './ingredient_consumption_logs.repository';
import { getWasteRawMaterialCost, getRawMaterialStockValue } from './raw_materials.repository';
import { getOverheadExpenseSummary } from './overhead_expenses.repository';

// ─── Internal row types ───────────────────────────────────────────────────────

interface SalesAggRow {
  gross_sales:  number | null;
  order_count:  number | null;
}

interface IngredientAggRow {
  ingredient_cost: number | null;
}

interface UtilitiesAggRow {
  utilities_cost: number | null;
}

interface ProductionAggRow {
  products_made: number | null;
  batch_count:   number | null;
}

interface ProductsSoldAggRow {
  products_sold: number | null;
}

interface TrendSalesRow {
  sales: number | null;
}

interface TrendCostsRow {
  costs: number | null;
}

// ─── Period boundary helpers ──────────────────────────────────────────────────

/**
 * Returns an ISO 8601 string for midnight (start) of the given local Date.
 * We construct the local date parts manually to stay in device-local time
 * rather than UTC, matching the ISO strings stored in the database which
 * are written via `new Date().toISOString()` (UTC-based) from this device.
 *
 * Because all writes also use `new Date().toISOString()`, all stored values
 * are in UTC. We therefore derive our bounds in UTC too via the native
 * Date methods, keeping the comparison consistent.
 */
function startOfDayUTC(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}T00:00:00.000Z`;
}

function endOfDayUTC(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}T23:59:59.999Z`;
}

interface PeriodBounds {
  fromISO: string;
  toISO:   string;
}

function getPeriodBounds(period: DashboardPeriod, now: Date): PeriodBounds {
  const y   = now.getUTCFullYear();
  const mon = now.getUTCMonth();      // 0-based
  const d   = now.getUTCDate();
  const dow = now.getUTCDay();        // 0 = Sunday … 6 = Saturday

  switch (period) {
    case 'day': {
      const start = new Date(Date.UTC(y, mon, d));
      return { fromISO: startOfDayUTC(start), toISO: endOfDayUTC(start) };
    }

    case 'week': {
      // ISO week: Monday = day 1. getUTCDay() returns 0 for Sunday.
      const offsetToMonday = dow === 0 ? -6 : 1 - dow;
      const monday = new Date(Date.UTC(y, mon, d + offsetToMonday));
      const sunday = new Date(Date.UTC(y, mon, d + offsetToMonday + 6));
      return { fromISO: startOfDayUTC(monday), toISO: endOfDayUTC(sunday) };
    }

    case 'month': {
      const firstDay = new Date(Date.UTC(y, mon, 1));
      const lastDay  = new Date(Date.UTC(y, mon + 1, 0));
      return { fromISO: startOfDayUTC(firstDay), toISO: endOfDayUTC(lastDay) };
    }

    case 'year': {
      const jan1  = new Date(Date.UTC(y, 0, 1));
      const dec31 = new Date(Date.UTC(y, 11, 31));
      return { fromISO: startOfDayUTC(jan1), toISO: endOfDayUTC(dec31) };
    }
  }
}

// ─── Period label helper ──────────────────────────────────────────────────────

const MONTH_NAMES = [
  'January', 'February', 'March',     'April',   'May',      'June',
  'July',    'August',   'September', 'October', 'November', 'December',
] as const;

function getPeriodLabel(period: DashboardPeriod, now: Date): string {
  switch (period) {
    case 'day':   return 'Today';
    case 'week':  return 'This Week';
    case 'month': {
      const monthName = MONTH_NAMES[now.getUTCMonth()] ?? 'Unknown';
      return `${monthName} ${now.getUTCFullYear()}`;
    }
    case 'year':  return String(now.getUTCFullYear());
  }
}

// ─── Trend sub-interval helpers ───────────────────────────────────────────────

interface SubInterval {
  label:   string;
  fromISO: string;
  toISO:   string;   // exclusive upper bound (< toISO in SQL)
}

/**
 * Builds the ordered list of sub-intervals and their display labels for the
 * trend chart. The `toISO` bound is exclusive so adjacent intervals do not
 * overlap — queries use `created_at >= fromISO AND created_at < toISO`.
 */
function buildSubIntervals(period: DashboardPeriod, now: Date): SubInterval[] {
  const y   = now.getUTCFullYear();
  const mon = now.getUTCMonth();
  const d   = now.getUTCDate();
  const dow = now.getUTCDay();

  switch (period) {
    case 'day': {
      // 8 points every 3 hours: 00:00, 03:00, 06:00 … 21:00
      const hours = [0, 3, 6, 9, 12, 15, 18, 21] as const;
      return hours.map((h, i) => {
        const nextH = hours[i + 1] ?? 24;
        const label = `${String(h).padStart(2, '0')}:00`;
        const fromISO = new Date(Date.UTC(y, mon, d, h)).toISOString();
        const toISO   = new Date(Date.UTC(y, mon, d, nextH)).toISOString();
        return { label, fromISO, toISO };
      });
    }

    case 'week': {
      const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
      const offsetToMonday = dow === 0 ? -6 : 1 - dow;
      return DAY_LABELS.map((label, i) => {
        const dayStart = new Date(Date.UTC(y, mon, d + offsetToMonday + i));
        const dayEnd   = new Date(Date.UTC(y, mon, d + offsetToMonday + i + 1));
        return {
          label,
          fromISO: dayStart.toISOString(),
          toISO:   dayEnd.toISOString(),
        };
      });
    }

    case 'month': {
      // One point per calendar day; month length derived from next-month day 0
      const daysInMonth = new Date(Date.UTC(y, mon + 1, 0)).getUTCDate();
      return Array.from({ length: daysInMonth }, (_, i) => {
        const dayNum  = i + 1;
        const dayStart = new Date(Date.UTC(y, mon, dayNum));
        const dayEnd   = new Date(Date.UTC(y, mon, dayNum + 1));
        return {
          label:   String(dayNum),
          fromISO: dayStart.toISOString(),
          toISO:   dayEnd.toISOString(),
        };
      });
    }

    case 'year': {
      const MONTH_LABELS = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
      ] as const;
      return MONTH_LABELS.map((label, i) => {
        const monthStart = new Date(Date.UTC(y, i, 1));
        const monthEnd   = new Date(Date.UTC(y, i + 1, 1));
        return {
          label,
          fromISO: monthStart.toISOString(),
          toISO:   monthEnd.toISOString(),
        };
      });
    }
  }
}

// ─── KPI queries ──────────────────────────────────────────────────────────────

async function querySalesKPI(
  db: import('expo-sqlite').SQLiteDatabase,
  fromISO: string,
  toISO:   string,
): Promise<{ grossSales: number; totalOrders: number }> {
  const row = await db.getFirstAsync<SalesAggRow>(
    `SELECT SUM(total_amount) AS gross_sales,
            COUNT(*)          AS order_count
     FROM sales_orders
     WHERE status     = 'completed'
       AND created_at >= ?
       AND created_at <= ?`,
    [fromISO, toISO],
  );
  return {
    grossSales:  row?.gross_sales  ?? 0,
    totalOrders: row?.order_count  ?? 0,
  };
}

async function queryIngredientKPI(
  db: import('expo-sqlite').SQLiteDatabase,
  fromISO: string,
  toISO:   string,
): Promise<number> {
  const row = await db.getFirstAsync<IngredientAggRow>(
    `SELECT SUM(total_cost) AS ingredient_cost
     FROM ingredient_consumption_logs
     WHERE cancelled_at IS NULL
       AND consumed_at >= ?
       AND consumed_at <= ?`,
    [fromISO, toISO],
  );
  return row?.ingredient_cost ?? 0;
}

/**
 * Computes utility cost for the given period.
 *
 * utility_logs stores billing data by (period_year, period_month) integers,
 * NOT by event timestamp. Using paid_at / created_at date ranges is semantically
 * wrong because a bill entered months ago can still represent a future billing
 * period, and a bill created within the window may cover a different month.
 *
 * Correct semantics: a bill "belongs" to a period if its (period_year, period_month)
 * falls within the requested window. That is the user's intent when asking
 * "what utility cost did the business incur this month / year."
 *
 * Period mapping:
 *   day  — bills whose period_year/period_month matches today's year + month
 *           (utility bills are monthly lump sums; the daily view shows the same total)
 *   week — bills whose period matches the calendar month containing the week start
 *           (same rationale: utility bills are monthly; show the covering month)
 *   month — bills whose period_year = Y AND period_month = M
 *   year  — bills whose period_year = Y (all months in that calendar year)
 */
async function queryUtilitiesKPI(
  db: import('expo-sqlite').SQLiteDatabase,
  period: DashboardPeriod,
  now: Date,
): Promise<number> {
  const y   = now.getUTCFullYear();
  const mon = now.getUTCMonth() + 1; // 1-based

  // Initialise with the month/year=current-month default (day/week/month path).
  // The year path overwrites if needed. Using definite initialisers avoids
  // TypeScript "variable used before being assigned" under strict mode.
  let sql: string =
    `SELECT SUM(amount) AS utilities_cost
     FROM utility_logs
     WHERE deleted_at IS NULL
       AND period_year  = ?
       AND period_month = ?`;
  let params: (number | string)[] = [y, mon];

  if (period === 'year') {
    sql    = `SELECT SUM(amount) AS utilities_cost
              FROM utility_logs
              WHERE deleted_at IS NULL
                AND period_year = ?`;
    params = [y];
  }

  const row = await db.getFirstAsync<UtilitiesAggRow>(sql, params);
  return row?.utilities_cost ?? 0;
}

async function queryProductionKPI(
  db: import('expo-sqlite').SQLiteDatabase,
  fromISO: string,
  toISO:   string,
): Promise<number> {
  const row = await db.getFirstAsync<ProductionAggRow>(
    `SELECT SUM(units_produced) AS products_made,
            COUNT(*)            AS batch_count
     FROM production_logs
     WHERE created_at >= ?
       AND created_at <= ?`,
    [fromISO, toISO],
  );
  return row?.products_made ?? 0;
}

async function queryProductsSoldKPI(
  db: import('expo-sqlite').SQLiteDatabase,
  fromISO: string,
  toISO:   string,
): Promise<number> {
  const row = await db.getFirstAsync<ProductsSoldAggRow>(
    `SELECT SUM(soi.quantity) AS products_sold
     FROM sales_order_items soi
     INNER JOIN sales_orders so ON so.id = soi.sales_order_id
     WHERE so.status     = 'completed'
       AND so.created_at >= ?
       AND so.created_at <= ?`,
    [fromISO, toISO],
  );
  return row?.products_sold ?? 0;
}

/**
 * Computes raw material consumption cost for the period.
 *
 * raw_material_consumption_logs stores signed quantity_used values:
 *   positive = consumed (cost); negative = returned (credit).
 * Multiplying by cost_per_unit and summing gives the net COGS contribution
 * from raw materials for the period.
 */
async function queryRawMaterialCostKPI(
  db: import('expo-sqlite').SQLiteDatabase,
  fromISO: string,
  toISO:   string,
): Promise<number> {
  interface RawMaterialAggRow { rm_cost: number | null }
  const row = await db.getFirstAsync<RawMaterialAggRow>(
    `SELECT SUM(quantity_used * cost_per_unit) AS rm_cost
     FROM raw_material_consumption_logs
     WHERE consumed_at >= ?
       AND consumed_at <= ?`,
    [fromISO, toISO],
  );
  return row?.rm_cost ?? 0;
}

/** Waste-only portion of ingredient cost for the period (sub-line of ingredientCost). */
async function queryIngredientWastePeriod(
  db: import('expo-sqlite').SQLiteDatabase,
  fromISO: string,
  toISO:   string,
): Promise<number> {
  interface Row { waste: number | null }
  const row = await db.getFirstAsync<Row>(
    `SELECT SUM(total_cost) AS waste
     FROM ingredient_consumption_logs
     WHERE trigger_type  = 'WASTAGE'
       AND cancelled_at  IS NULL
       AND consumed_at  >= ?
       AND consumed_at  <= ?`,
    [fromISO, toISO],
  );
  return row?.waste ?? 0;
}

/** Waste-only portion of raw material cost for the period (sub-line of rawMaterialCost). */
async function queryRawMaterialWastePeriod(
  db: import('expo-sqlite').SQLiteDatabase,
  fromISO: string,
  toISO:   string,
): Promise<number> {
  interface Row { waste: number | null }
  const row = await db.getFirstAsync<Row>(
    `SELECT SUM(quantity_used * cost_per_unit) AS waste
     FROM raw_material_consumption_logs
     WHERE reason      = 'waste'
       AND consumed_at >= ?
       AND consumed_at <= ?`,
    [fromISO, toISO],
  );
  return row?.waste ?? 0;
}

/**
 * Computes overhead expenses incurred within the selected period.
 *
 * Unlike getOverheadExpenseSummary() (which uses fixed calendar month/year windows),
 * this filters by expense_date within the fromISO–toISO bounds — matching the
 * accounting principle: only overhead booked in the selected period contributes
 * to that period's OpEx and Net Profit.
 */
async function queryOverheadForPeriod(
  db: import('expo-sqlite').SQLiteDatabase,
  fromISO: string,
  toISO:   string,
): Promise<number> {
  interface OverheadPeriodRow { overhead: number | null }
  const row = await db.getFirstAsync<OverheadPeriodRow>(
    `SELECT SUM(amount) AS overhead
     FROM overhead_expenses
     WHERE expense_date >= ?
       AND expense_date <= ?`,
    [fromISO, toISO],
  );
  return row?.overhead ?? 0;
}

// ─── Trend point query ────────────────────────────────────────────────────────

async function queryTrendPoint(
  db: import('expo-sqlite').SQLiteDatabase,
  interval: SubInterval,
): Promise<DashboardTrendPoint> {
  const [salesRow, costsRow] = await Promise.all([
    db.getFirstAsync<TrendSalesRow>(
      `SELECT SUM(total_amount) AS sales
       FROM sales_orders
       WHERE status     = 'completed'
         AND created_at >= ?
         AND created_at <  ?`,
      [interval.fromISO, interval.toISO],
    ),
    db.getFirstAsync<TrendCostsRow>(
      `SELECT SUM(total_cost) AS costs
       FROM ingredient_consumption_logs
       WHERE cancelled_at IS NULL
         AND consumed_at >= ?
         AND consumed_at <  ?`,
      [interval.fromISO, interval.toISO],
    ),
  ]);

  const cost = costsRow?.costs ?? 0;
  return {
    label:     interval.label,
    sales:     salesRow?.sales ?? 0,
    cost,
    netProfit: (salesRow?.sales ?? 0) - cost,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Assembles all KPI aggregates and trend data for the requested period.
 *
 * All database queries execute concurrently — the four KPI queries fire in
 * one Promise.all, and all trend sub-interval queries fire in a second
 * Promise.all. The total wall-clock time is dominated by the slowest single
 * query, not the sum of all queries.
 *
 * @param period - 'day' | 'week' | 'month' | 'year'
 * @returns Fully assembled DashboardData ready for the UI layer.
 */
export async function getDashboardData(period: DashboardPeriod): Promise<DashboardData> {
  const db  = await getDatabase();
  const now = new Date();

  const { fromISO, toISO }  = getPeriodBounds(period, now);
  const periodLabel         = getPeriodLabel(period, now);
  const subIntervals        = buildSubIntervals(period, now);

  // ── Round 1: all KPI aggregates in parallel ───────────────────────────────
  const [
    salesKPI,
    ingredientCost,
    rawMaterialCost,
    ingredientWastePeriod,
    rawMaterialWastePeriod,
    utilitiesCost,
    productsMade,
    totalProductsSold,
    ingredientWasteCost,
    rawMaterialWasteCost,
    rawMaterialStockValue,
    overheadSummary,
    opexThisPeriod,
  ] = await Promise.all([
    querySalesKPI(db, fromISO, toISO),
    queryIngredientKPI(db, fromISO, toISO),
    queryRawMaterialCostKPI(db, fromISO, toISO),
    // Waste sub-lines — subsets of ingredientCost / rawMaterialCost for display.
    queryIngredientWastePeriod(db, fromISO, toISO),
    queryRawMaterialWastePeriod(db, fromISO, toISO),
    queryUtilitiesKPI(db, period, now),
    queryProductionKPI(db, fromISO, toISO),
    queryProductsSoldKPI(db, fromISO, toISO),
    // All-time waste aggregates — not period-filtered.
    getIngredientWasteCost(),
    getWasteRawMaterialCost(),
    getRawMaterialStockValue(),
    getOverheadExpenseSummary(),
    queryOverheadForPeriod(db, fromISO, toISO),
  ]);

  // ── P&L waterfall derivations (matching principle) ────────────────────────
  //   Gross Income  = grossSales
  //   COGS          = ingredientCost + rawMaterialCost
  //   Gross Profit  = Gross Income − COGS
  //   OpEx          = utilitiesCost + opexThisPeriod
  //   Net Profit    = Gross Profit − OpEx
  const cogs        = ingredientCost + rawMaterialCost;
  const grossProfit = salesKPI.grossSales - cogs;
  const netProfit   = grossProfit - utilitiesCost - opexThisPeriod;

  const kpis: DashboardKPIs = {
    grossSales:           salesKPI.grossSales,
    ingredientCost,
    rawMaterialCost,
    ingredientWastePeriod,
    rawMaterialWastePeriod,
    cogs,
    grossProfit,
    utilitiesCost,
    opexThisPeriod,
    netProfit,
    totalOrders:          salesKPI.totalOrders,
    totalProductsSold,
    productsMade,
    ingredientWasteCost,
    rawMaterialWasteCost,
    rawMaterialStockValue,
    overheadThisMonth:    overheadSummary.thisMonth,
    overheadThisYear:     overheadSummary.thisYear,
    periodLabel,
  };

  // ── Round 2: all trend sub-intervals in parallel ───────────────────────────
  const trend: DashboardTrendPoint[] = await Promise.all(
    subIntervals.map((interval) => queryTrendPoint(db, interval)),
  );

  return {
    period,
    kpis,
    trend,
    updatedAt: new Date().toISOString(),
  };
}

// ─── Finance / date-range P&L API ─────────────────────────────────────────────
//
// These three functions provide a simpler from/to interface for the finance
// module where the caller supplies explicit YYYY-MM-DD date strings instead of
// the period enum used by getDashboardData.

function parseYearMonth(isoDate: string): { year: number; month: number } {
  const parts     = isoDate.split('-');
  const yearStr   = parts[0] ?? '';
  const monthStr  = parts[1] ?? '';
  const year      = parseInt(yearStr,  10);
  const month     = parseInt(monthStr, 10);
  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    throw new Error(`dashboard.repository: invalid ISO date "${isoDate}"`);
  }
  return { year, month };
}

/** Total revenue from completed sales orders within the date range (inclusive). */
export async function getGrossIncome(from: string, to: string): Promise<number> {
  const db  = await getDatabase();
  const row = await db.getFirstAsync<{ total: number | null }>(
    `SELECT SUM(total_amount) AS total
     FROM sales_orders
     WHERE status     = 'completed'
       AND created_at >= ?
       AND created_at <= ?`,
    [`${from}T00:00:00.000Z`, `${to}T23:59:59.999Z`],
  );
  return row?.total ?? 0;
}

/**
 * COGS = ingredient consumption costs + raw material consumption costs for the period.
 *
 * Both ingredient waste (trigger_type = 'WASTAGE') and raw material waste
 * (reason = 'waste') are included — waste is a real direct cost of production
 * and belongs in COGS under the matching principle.
 *
 * ingredient_consumption_logs: all non-cancelled, non-RETURN entries
 *   (includes normal consumption AND wastage).
 * raw_material_consumption_logs: all entries (signed quantity_used, so
 *   returns/credits are negative and automatically reduce COGS).
 */
export async function getCOGS(from: string, to: string): Promise<number> {
  const db     = await getDatabase();
  const fromTs = `${from}T00:00:00.000Z`;
  const toTs   = `${to}T23:59:59.999Z`;
  const row    = await db.getFirstAsync<{ total: number | null }>(
    `SELECT SUM(leg_cost) AS total
     FROM (
       -- Ingredient consumption including wastage
       SELECT total_cost AS leg_cost
       FROM ingredient_consumption_logs
       WHERE trigger_type != 'RETURN'
         AND cancelled_at IS NULL
         AND consumed_at >= ?
         AND consumed_at <= ?

       UNION ALL

       -- Raw material consumption including waste (signed: returns are negative)
       SELECT (quantity_used * cost_per_unit) AS leg_cost
       FROM raw_material_consumption_logs
       WHERE consumed_at >= ?
         AND consumed_at <= ?
     )`,
    [fromTs, toTs, fromTs, toTs],
  );
  return row?.total ?? 0;
}

/** OpEx = overhead expenses + utility bills for the period. */
export async function getOpEx(from: string, to: string): Promise<number> {
  const db    = await getDatabase();
  const { year: fromYear, month: fromMonth } = parseYearMonth(from);
  const { year: toYear,   month: toMonth   } = parseYearMonth(to);
  // Monotonically increasing ordinal that works across year boundaries.
  const fromOrdinal = fromYear * 12 + fromMonth;
  const toOrdinal   = toYear   * 12 + toMonth;
  const row = await db.getFirstAsync<{ total: number | null }>(
    `SELECT SUM(leg_amount) AS total
     FROM (
       SELECT amount AS leg_amount
       FROM overhead_expenses
       WHERE expense_date >= ?
         AND expense_date <= ?

       UNION ALL

       SELECT amount AS leg_amount
       FROM utility_logs
       WHERE deleted_at IS NULL
         AND (period_year * 12 + period_month) >= ?
         AND (period_year * 12 + period_month) <= ?
     )`,
    [`${from}T00:00:00.000Z`, `${to}T23:59:59.999Z`, fromOrdinal, toOrdinal],
  );
  return row?.total ?? 0;
}

/**
 * Fetches gross income, COGS, and OpEx in parallel and derives the full
 * P&L waterfall (grossProfit, netProfit) for the given date range.
 */
export async function getDashboardMetrics(
  from: string,
  to:   string,
): Promise<DashboardMetrics> {
  const [grossIncome, cogs, opex] = await Promise.all([
    getGrossIncome(from, to),
    getCOGS(from, to),
    getOpEx(from, to),
  ]);
  const grossProfit = grossIncome - cogs;
  const netProfit   = grossProfit - opex;
  return { grossIncome, cogs, grossProfit, opex, netProfit, period: { from, to } };
}
