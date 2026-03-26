/**
 * business_roi.types.ts
 *
 * Domain types for the Business ROI Overview module.
 *
 * This module is a read-only projection layer — it aggregates live data from
 * existing stores (dashboard, inventory, overhead expenses, utilities, POS)
 * and derives executive-level ROI metrics without storing any new data.
 *
 * All monetary values are in Philippine Pesos (PHP).
 *
 * TypeScript strict-mode notes:
 *   - exactOptionalPropertyTypes: true — use conditional spreading for optional fields.
 *   - noUncheckedIndexedAccess: true — use ?? fallbacks on all indexed access.
 *   - noUnusedLocals/Parameters: true — prefix unused params with _.
 */

// ─── Product breakdown ────────────────────────────────────────────────────────

/**
 * Per-product contribution to revenue and ROI.
 * Derived from all-time sales_order_items aggregates.
 */
export interface ProductROIBreakdown {
  /** Product name (snapshot from sales_order_items.product_name). */
  name:               string;
  /** Total units sold across all completed orders. */
  unitsSold:          number;
  /** Total revenue generated (SUM of subtotal). */
  revenue:            number;
  /**
   * Contribution margin = revenue - estimated COGS for this product.
   * Estimated COGS = unitsSold × costPrice (from inventory_items).
   * When costPrice is unavailable, contribution margin equals revenue.
   */
  contributionMargin: number;
}

// ─── Risk level ───────────────────────────────────────────────────────────────

/**
 * Business health risk classification based on ROI% and payback period.
 *
 *   low    — ROI >= 25% AND payback <= 12 months
 *   medium — ROI 10–24% OR payback 12–24 months
 *   high   — ROI < 10%  OR payback > 24 months OR net profit is negative
 */
export type BusinessROIRiskLevel = 'low' | 'medium' | 'high';

// ─── Full aggregated snapshot ──────────────────────────────────────────────────

/**
 * The complete Business ROI snapshot computed by computeBusinessROI().
 * All fields are derived — none are user-supplied.
 */
export interface BusinessROIData {
  // ── Cost breakdown ──────────────────────────────────────────────────────────

  /** SUM(quantity * costPrice) for all inventory items with category = 'product' or 'ingredient'. */
  totalInventoryValue:  number;
  /** SUM(quantity * costPrice) for all inventory items with category = 'equipment'. */
  totalEquipmentCost:   number;
  /** All-time SUM of overhead_expenses.amount. From OverheadExpenseSummary.allTime. */
  totalOverheadAllTime: number;
  /** All-time SUM of utility_logs.amount for the current year. */
  totalUtilitiesAllTime: number;
  /** Average monthly overhead = thisYear / elapsed months (min 1). */
  monthlyOverheadAvg:   number;
  /** Average monthly utility cost = totalUtilitiesAllTime / elapsed months (min 1). */
  monthlyUtilitiesAvg:  number;

  // ── Revenue and profit ──────────────────────────────────────────────────────

  /** All-time SUM of sales_orders.total_amount WHERE status = 'completed'. */
  totalRevenue:         number;
  /** All-time COGS = SUM of ingredient_consumption + raw_material_consumption. */
  totalCOGS:            number;
  /**
   * Net Profit = totalRevenue - totalCOGS - totalOverheadAllTime - totalUtilitiesAllTime.
   * May be negative when the business is not yet profitable.
   */
  netProfit:            number;
  /**
   * Gross Margin % = (totalRevenue - totalCOGS) / totalRevenue * 100.
   * 0 when totalRevenue = 0.
   */
  grossMarginPercent:   number;

  // ── ROI metrics ─────────────────────────────────────────────────────────────

  /**
   * Total Investment = totalInventoryValue + totalEquipmentCost
   *                  + totalOverheadAllTime + totalUtilitiesAllTime.
   */
  totalInvestment:          number;
  /**
   * ROI % = (netProfit / totalInvestment) * 100.
   * 0 when totalInvestment = 0.
   */
  roiPercent:               number;
  /**
   * Breakeven units = Total Fixed Monthly Costs / Contribution Margin per Unit.
   * Contribution Margin per Unit = (totalRevenue - totalCOGS) / unitsSoldToDate.
   * 0 when no units have been sold.
   */
  breakevenUnits:           number;
  /** All-time total units sold from sales_order_items. */
  unitsSoldToDate:          number;
  /** max(0, breakevenUnits - unitsSoldToDate). */
  unitsStillNeeded:         number;
  /**
   * Payback Period (months) = totalInvestment / monthlyNetProfit.
   * 999 when monthlyNetProfit <= 0.
   */
  paybackPeriodMonths:      number;
  /**
   * Estimated months to reach 20% ROI target from current position.
   * Based on current monthly net profit rate.
   * 999 when monthly net profit <= 0.
   */
  estimatedMonthsToTarget:  number;
  /**
   * Monthly Burn Rate = monthlyOverheadAvg + monthlyUtilitiesAvg + monthly COGS estimate.
   */
  monthlyBurnRate:          number;

  // ── Product breakdown ────────────────────────────────────────────────────────

  /** Top 3 products ranked by revenue contribution. */
  productBreakdown: ProductROIBreakdown[];

  // ── Target-based sales pace ────────────────────────────────────────────────

  /**
   * User-configurable target ROI percentage (default 20).
   * Used to compute requiredMonthlyUnits and requiredDailyUnits.
   */
  targetROIPercent: number;

  /**
   * Units per month required to reach targetROIPercent by year-end,
   * given months remaining in the current calendar year.
   * Formula: (remainingProfit / monthsRemaining) / contributionPerUnit.
   * 0 when contributionPerUnit <= 0 or already on target.
   */
  requiredMonthlyUnits: number;

  /**
   * Units per day equivalent: requiredMonthlyUnits / 30.44.
   */
  requiredDailyUnits: number;

  /**
   * Calendar months remaining in the current year (max(1, 12 - elapsed)).
   */
  monthsRemainingInYear: number;

  /**
   * Actual average monthly unit pace so far this year.
   * unitsSoldToDate / elapsedMonthsThisYear().
   * 0 when no units have been sold.
   */
  currentMonthlyUnitPace: number;

  /**
   * Extra units per month beyond current pace needed each remaining month.
   * max(0, requiredMonthlyUnits - currentMonthlyUnitPace).
   */
  unitsPaceShortfall: number;

  /**
   * Focused AI sentence about the target sales pace.
   * Embedded in aiInsight and also available standalone.
   */
  targetSalesInsight: string;

  // ── AI insight ───────────────────────────────────────────────────────────────

  /** Multi-sentence rule-based business health analysis. */
  aiInsight:  string;
  /** Business health classification. */
  riskLevel:  BusinessROIRiskLevel;
}
