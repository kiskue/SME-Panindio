/**
 * dashboard.types.ts
 *
 * Domain types for the ERP Dashboard feature.
 *
 * The dashboard aggregates data across four sources:
 *   - sales_orders                → grossSales, totalOrders
 *   - ingredient_consumption_logs → ingredientCost
 *   - utility_logs                → utilitiesCost
 *   - production_logs             → productsMade
 *
 * netProfit is a derived value: grossSales − ingredientCost − utilitiesCost.
 *
 * Trend sub-interval granularity:
 *   day   → 6 data points (every 4 hours: 00, 04, 08, 12, 16, 20)
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
  /** Sum of utility_logs.amount for bills whose paid_at (or created_at) falls in the period. */
  utilitiesCost:  number;
  /** grossSales − ingredientCost − utilitiesCost */
  netProfit:      number;
  /** Count of completed sales orders in the period. */
  totalOrders:    number;
  /** Total units produced across all production_logs in the period. */
  productsMade:   number;
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
