/**
 * dashboard.types.ts
 *
 * Domain types for the ERP Dashboard feature.
 *
 * The dashboard aggregates data across eight sources:
 *   - sales_orders                → grossSales, totalOrders
 *   - sales_order_items           → totalProductsSold (SUM of quantity for completed orders)
 *   - ingredient_consumption_logs → ingredientCost, ingredientWasteCost
 *   - utility_logs                → utilitiesCost
 *   - production_logs             → productsMade
 *   - raw_material_consumption_logs → rawMaterialWasteCost (all-time, reason = 'waste')
 *   - raw_materials               → rawMaterialStockValue (point-in-time, is_active = 1)
 *   - overhead_expenses           → overheadThisMonth, overheadThisYear
 *
 * netProfit is a derived value: grossSales − ingredientCost − utilitiesCost.
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
 */
export interface DashboardKPIs {
  /** Sum of sales_orders.total_amount WHERE status = 'completed'. */
  grossSales:     number;
  /** Sum of ingredient_consumption_logs.total_cost (excluding RETURN triggers). */
  ingredientCost: number;
  /** Sum of utility_logs.amount for bills whose period_year/period_month matches the selected period. */
  utilitiesCost:  number;
  /** grossSales − ingredientCost − utilitiesCost */
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
   * Source: SUM(amount) FROM overhead_expenses
   *   WHERE strftime('%Y-%m', expense_date) = current month.
   */
  overheadThisMonth: number;
  /**
   * Total overhead expenses recorded in the current calendar year.
   * Source: SUM(amount) FROM overhead_expenses
   *   WHERE strftime('%Y', expense_date) = current year.
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
