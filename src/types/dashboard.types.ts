/**
 * dashboard.types.ts
 *
 * Domain types for the ERP Dashboard feature.
 *
 * The dashboard aggregates data across nine sources:
 *   - sales_orders                → grossSales, totalOrders
 *   - sales_order_items           → totalProductsSold (SUM of quantity for completed orders)
 *   - ingredient_consumption_logs → ingredientCost, ingredientWasteCost
 *   - raw_material_consumption_logs → rawMaterialCost (period-filtered), rawMaterialWasteCost (all-time)
 *   - utility_logs                → utilitiesCost
 *   - production_logs             → productsMade
 *   - raw_materials               → rawMaterialStockValue (point-in-time, is_active = 1)
 *   - overhead_expenses           → opexThisPeriod (period-filtered), overheadThisMonth, overheadThisYear
 *
 * P&L waterfall (standard SME accounting — matching principle):
 *   Gross Income  = grossSales
 *   COGS          = ingredientCost + rawMaterialCost
 *   Gross Profit  = grossIncome − cogs
 *   OpEx          = utilitiesCost + opexThisPeriod
 *   Net Profit    = grossProfit − utilitiesCost − opexThisPeriod
 *
 * All-time aggregates (not period-filtered):
 *   ingredientWasteCost   — lifetime SUM(total_cost) WHERE trigger_type = 'WASTAGE'
 *   rawMaterialWasteCost  — lifetime SUM(quantity_used * cost_per_unit) WHERE reason = 'waste'
 *   rawMaterialStockValue — current SUM(quantity_in_stock * cost_per_unit) WHERE is_active = 1
 *
 * Trend sub-interval granularity:
 *   day   → 8 data points (every 3 hours: 00, 03, 06, 09, 12, 15, 18, 21)
 *   week  → 7 data points (Mon – Sun)
 *   month → up to 31 data points (one per calendar day)
 *   year  → 12 data points (Jan – Dec)
 */

// ─── Period ───────────────────────────────────────────────────────────────────

/** The time window the user has selected on the dashboard. */
export type DashboardPeriod = 'day' | 'week' | 'month' | 'year';

// ─── KPIs ─────────────────────────────────────────────────────────────────────

/**
 * Top-level key performance indicators for the selected period.
 * All monetary values are in the local currency (PHP).
 *
 * P&L waterfall:
 *   grossIncome  = grossSales
 *   cogs         = ingredientCost + rawMaterialCost
 *   grossProfit  = grossIncome − cogs
 *   opex         = utilitiesCost + opexThisPeriod
 *   netProfit    = grossProfit − opex
 */
export interface DashboardKPIs {
  /** Sum of sales_orders.total_amount WHERE status = 'completed'. Also called Gross Income. */
  grossSales:     number;
  /** Sum of ingredient_consumption_logs.total_cost for the period (excluding RETURN triggers and cancelled entries). */
  ingredientCost: number;
  /**
   * Sum of raw_material_consumption_logs costs for the period.
   * Computed as SUM(quantity_used * cost_per_unit) WHERE consumed_at in period.
   * Positive quantity_used = consumed (cost); negative = returned (credit).
   */
  rawMaterialCost: number;
  /**
   * Waste portion of ingredientCost for the period.
   * SUM(total_cost) WHERE trigger_type = 'WASTAGE' AND cancelled_at IS NULL.
   * Subset of ingredientCost — shown as a sub-line for visibility.
   */
  ingredientWastePeriod: number;
  /**
   * Waste portion of rawMaterialCost for the period.
   * SUM(quantity_used * cost_per_unit) WHERE reason = 'waste'.
   * Subset of rawMaterialCost — shown as a sub-line for visibility.
   */
  rawMaterialWastePeriod: number;
  /**
   * Cost of Goods Sold for the period.
   * Derived: ingredientCost + rawMaterialCost.
   */
  cogs:           number;
  /**
   * Gross Profit for the period.
   * Derived: grossSales − cogs.
   */
  grossProfit:    number;
  /** Sum of utility_logs.amount for bills whose period_year/period_month matches the selected period. */
  utilitiesCost:  number;
  /**
   * Overhead expenses whose expense_date falls within the selected period's ISO date range.
   * Period-aware — only expenses booked in the selected window contribute to OpEx.
   */
  opexThisPeriod: number;
  /**
   * Net Profit for the period.
   * Derived: grossProfit − utilitiesCost − opexThisPeriod.
   */
  netProfit:      number;
  /** Count of completed sales orders in the period. */
  totalOrders:       number;
  /**
   * Total units sold (SUM of sales_order_items.quantity) across all completed
   * sales_orders whose created_at falls in the period.
   */
  totalProductsSold: number;
  /** Total units produced across all production_logs in the period. */
  productsMade:      number;
  /**
   * All-time total cost of ingredient consumption events with trigger_type = 'WASTAGE'.
   * Not period-filtered — represents the lifetime waste spend across all time.
   * Source: SUM(total_cost) FROM ingredient_consumption_logs WHERE trigger_type = 'WASTAGE'
   *   AND cancelled_at IS NULL
   */
  ingredientWasteCost:   number;
  /**
   * All-time total cost of raw material consumption events with reason = 'waste'.
   * Not period-filtered — represents the lifetime raw material waste spend.
   * Source: SUM(quantity_used * cost_per_unit) FROM raw_material_consumption_logs
   *   WHERE reason = 'waste'
   */
  rawMaterialWasteCost:  number;
  /**
   * Current total inventory value of all active raw materials.
   * Point-in-time snapshot (not period-filtered).
   * Source: SUM(quantity_in_stock * cost_per_unit) FROM raw_materials WHERE is_active = 1
   */
  rawMaterialStockValue: number;
  /**
   * Total overhead expenses recorded in the current calendar month.
   * Always reflects the current calendar month regardless of the dashboard period selector.
   * Source: SUM(amount) FROM overhead_expenses WHERE strftime('%Y-%m', expense_date) = current month.
   */
  overheadThisMonth: number;
  /**
   * Total overhead expenses recorded in the current calendar year.
   * Always reflects the current calendar year regardless of the dashboard period selector.
   * Source: SUM(amount) FROM overhead_expenses WHERE strftime('%Y', expense_date) = current year.
   */
  overheadThisYear:  number;
  /**
   * Human-readable label for the period.
   * Examples: "Today", "This Week", "March 2026", "2026"
   */
  periodLabel:    string;
}

// ─── Trend ────────────────────────────────────────────────────────────────────

/**
 * A single data point in the trend series.
 * The `label` is the X-axis tick shown in the chart.
 */
export interface DashboardTrendPoint {
  /** X-axis label: "Mon", "Jan", "12:00", "15" (day of month), etc. */
  label:     string;
  /** Gross sales revenue for this sub-interval. */
  sales:     number;
  /** Combined cost (ingredientCost + utilitiesCost) for this sub-interval. */
  cost:      number;
  /** sales − cost for this sub-interval. */
  netProfit: number;
}

// ─── Finance / date-range P&L ─────────────────────────────────────────────────

/**
 * An arbitrary date-range window used by the finance repository.
 * `from` and `to` are ISO 8601 date strings (YYYY-MM-DD, inclusive).
 *
 * Named `DashboardDateRange` to avoid conflicting with the existing
 * `DashboardPeriod` granularity enum ('day' | 'week' | 'month' | 'year').
 */
export interface DashboardDateRange {
  label: 'today' | 'week' | 'month' | 'custom';
  /** Start of the range — ISO 8601 date (YYYY-MM-DD). */
  from:  string;
  /** End of the range — ISO 8601 date (YYYY-MM-DD). */
  to:    string;
}

/**
 * P&L summary metrics for a specific date range.
 * Computed by `getDashboardMetrics()` in dashboard.repository.ts.
 *
 *   grossProfit = grossIncome − cogs
 *   netProfit   = grossProfit − opex
 */
export interface DashboardMetrics {
  /** Total revenue from completed sales orders in the period. */
  grossIncome:  number;
  /** Cost of Goods Sold (ingredient + raw material waste costs) for the period. */
  cogs:         number;
  /** grossIncome − cogs */
  grossProfit:  number;
  /** Operating Expenses (overhead + utilities) for the period. */
  opex:         number;
  /** grossProfit − opex */
  netProfit:    number;
  /** The date window this snapshot covers. */
  period:       { from: string; to: string };
}

// ─── Dashboard payload ────────────────────────────────────────────────────────

/**
 * The full dashboard payload returned by the repository and held in the store.
 */
export interface DashboardData {
  /** The period this data was fetched for. */
  period:    DashboardPeriod;
  /** Aggregated KPIs for the period. */
  kpis:      DashboardKPIs;
  /** Time-series breakdown of the period into sub-intervals. */
  trend:     DashboardTrendPoint[];
  /** ISO 8601 timestamp of when this data was last fetched from SQLite. */
  updatedAt: string;
}
