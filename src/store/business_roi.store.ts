/**
 * business_roi.store.ts
 *
 * Zustand v5 store for the Business ROI Overview module.
 *
 * Responsibilities:
 *   - Aggregates live data from existing stores without owning any domain data.
 *   - Reads inventory items, overhead summary, utilities yearly data, and
 *     sales aggregates from their respective stores and repositories.
 *   - Issues one direct SQLite query to compute all-time sales totals and top
 *     products — data that no existing repository exposes as a single call.
 *   - Computes ROI metrics using standard SME accounting formulas.
 *   - Generates a natural language business health insight (rule-based, no API).
 *
 * Design decisions:
 *   - This store is a READ-ONLY projection — it never writes to any table.
 *   - It reads from other stores via getState() (not hooks) because it runs
 *     outside React components (in initializeStores and post-checkout callbacks).
 *   - computeBusinessROI() is the single entry point for all computation.
 *     refreshBusinessROI() is an alias that re-computes from current data.
 *   - NOT added to initializeStores() — computation requires all other stores
 *     to be fully hydrated first. Call computeBusinessROI() after initializeStores()
 *     resolves, e.g. on the dashboard screen's first mount.
 *   - No SQLite schema is created — all DB access is read-only via getDatabase().
 *
 * Business formulas:
 *   totalInvestment      = totalInventoryValue + totalEquipmentCost
 *                        + totalOverheadAllTime + totalUtilitiesAllTime
 *   grossMargin %        = (totalRevenue - totalCOGS) / totalRevenue × 100
 *   contributionPerUnit  = (totalRevenue - totalCOGS) / unitsSoldToDate
 *   breakevenUnits       = monthlyFixedCosts / contributionPerUnit
 *   netProfit            = totalRevenue - totalCOGS - totalOverheadAllTime
 *                        - totalUtilitiesAllTime
 *   roiPercent           = (netProfit / totalInvestment) × 100
 *   paybackPeriodMonths  = totalInvestment / monthlyNetProfit
 *
 * Risk thresholds (SME food/retail benchmarks):
 *   low    — ROI >= 25% AND payback <= 12 months
 *   medium — ROI 10–24% OR  payback 12–24 months
 *   high   — ROI < 10%  OR  payback > 24 months OR net profit negative
 *
 * TypeScript strict-mode notes:
 *   - exactOptionalPropertyTypes: conditional spread for optional fields.
 *   - noUncheckedIndexedAccess: ?? fallbacks on all array/record access.
 *   - noUnusedLocals/Parameters: unused vars prefixed with _.
 */

import { create } from 'zustand';
import { getDatabase } from '../../database/database';
import type { BusinessROIData, ProductROIBreakdown, BusinessROIRiskLevel } from '@/types/business_roi.types';
import { useInventoryStore } from './inventory.store';
import { useOverheadExpensesStore } from './overhead_expenses.store';
import { getYearlySummary } from '../../database/repositories/utilities.repository';

// ─── State shape ──────────────────────────────────────────────────────────────

export interface BusinessROIState {
  // ── Aggregated cost breakdown ───────────────────────────────────────────────
  totalInventoryValue:     number;
  totalEquipmentCost:      number;
  totalOverheadAllTime:    number;
  totalUtilitiesAllTime:   number;
  monthlyOverheadAvg:      number;
  monthlyUtilitiesAvg:     number;

  // ── Revenue and profit ──────────────────────────────────────────────────────
  totalRevenue:            number;
  totalCOGS:               number;
  netProfit:               number;
  grossMarginPercent:      number;

  // ── ROI metrics ─────────────────────────────────────────────────────────────
  totalInvestment:          number;
  roiPercent:               number;
  breakevenUnits:           number;
  unitsSoldToDate:          number;
  unitsStillNeeded:         number;
  paybackPeriodMonths:      number;
  estimatedMonthsToTarget:  number;
  monthlyBurnRate:          number;

  // ── Product breakdown ────────────────────────────────────────────────────────
  productBreakdown: ProductROIBreakdown[];

  // ── Target-based sales pace ───────────────────────────────────────────────
  /** User-configurable target ROI %. Default 20. */
  targetROIPercent:       number;
  /** Units/month needed to hit targetROIPercent by year-end. */
  requiredMonthlyUnits:   number;
  /** Units/day equivalent: requiredMonthlyUnits / 30.44. */
  requiredDailyUnits:     number;
  /** Calendar months remaining in the current year (max(1, 12 - elapsed)). */
  monthsRemainingInYear:  number;
  /** Actual average monthly unit pace so far this year. */
  currentMonthlyUnitPace: number;
  /** Extra units/month beyond current pace required each remaining month. */
  unitsPaceShortfall:     number;
  /** Focused AI sentence about the target sales pace. */
  targetSalesInsight:     string;

  // ── AI insight ───────────────────────────────────────────────────────────────
  aiInsight:    string;
  riskLevel:    BusinessROIRiskLevel;

  // ── Store status ─────────────────────────────────────────────────────────────
  isLoading:    boolean;
  lastRefreshed: string | null;
  error:        string | null;

  // ── Actions ──────────────────────────────────────────────────────────────────
  computeBusinessROI:  () => Promise<void>;
  refreshBusinessROI:  () => Promise<void>;
  /** Updates targetROIPercent and re-runs computeBusinessROI(). */
  setTargetROIPercent: (pct: number) => Promise<void>;
}

// ─── Direct DB query helpers ──────────────────────────────────────────────────

interface AllTimeSalesRow {
  total_revenue: number | null;
  total_units:   number | null;
  total_cogs:    number | null;
  order_count:   number | null;
}

interface TopProductRow {
  product_name: string;
  units_sold:   number;
  revenue:      number;
}

/**
 * Queries all-time sales aggregates directly from SQLite.
 * Returns totalRevenue, unitsSoldToDate, and estimated total COGS
 * (sum of ingredient + raw material consumption costs, all-time).
 */
async function fetchAllTimeSalesAggregates(): Promise<{
  totalRevenue:   number;
  unitsSoldToDate: number;
  orderCount:     number;
}> {
  const db = await getDatabase();

  const row = await db.getFirstAsync<AllTimeSalesRow>(
    `SELECT
       SUM(total_amount)       AS total_revenue,
       COUNT(*)                AS order_count,
       NULL                    AS total_units,
       NULL                    AS total_cogs
     FROM sales_orders
     WHERE status = 'completed'`,
  );

  const unitsRow = await db.getFirstAsync<{ total_units: number | null }>(
    `SELECT SUM(soi.quantity) AS total_units
     FROM sales_order_items soi
     INNER JOIN sales_orders so ON so.id = soi.sales_order_id
     WHERE so.status = 'completed'`,
  );

  return {
    totalRevenue:    row?.total_revenue    ?? 0,
    unitsSoldToDate: unitsRow?.total_units ?? 0,
    orderCount:      row?.order_count      ?? 0,
  };
}

/**
 * Queries all-time COGS from ingredient + raw material consumption logs.
 * Ingredient consumption: SUM(total_cost) WHERE cancelled_at IS NULL
 *   and trigger_type != 'RETURN'.
 * Raw material consumption: SUM(quantity_used * cost_per_unit) WHERE quantity_used > 0.
 */
async function fetchAllTimeCOGS(): Promise<number> {
  const db = await getDatabase();

  const ingredientRow = await db.getFirstAsync<{ total: number | null }>(
    `SELECT SUM(total_cost) AS total
     FROM ingredient_consumption_logs
     WHERE cancelled_at IS NULL
       AND trigger_type != 'RETURN'`,
  );

  const rawMatRow = await db.getFirstAsync<{ total: number | null }>(
    `SELECT SUM(quantity_used * cost_per_unit) AS total
     FROM raw_material_consumption_logs
     WHERE quantity_used > 0`,
  );

  const ingredientCost = ingredientRow?.total ?? 0;
  const rawMatCost     = rawMatRow?.total     ?? 0;

  return ingredientCost + rawMatCost;
}

/**
 * Queries the top N products by total revenue from all-time completed orders.
 * Returns product_name, units_sold, and revenue sorted by revenue DESC.
 */
async function fetchTopProducts(limit: number): Promise<TopProductRow[]> {
  const db = await getDatabase();

  const rows = await db.getAllAsync<TopProductRow>(
    `SELECT
       soi.product_name,
       SUM(soi.quantity)  AS units_sold,
       SUM(soi.subtotal)  AS revenue
     FROM sales_order_items soi
     INNER JOIN sales_orders so ON so.id = soi.sales_order_id
     WHERE so.status = 'completed'
     GROUP BY soi.product_name
     ORDER BY revenue DESC
     LIMIT ?`,
    [limit],
  );

  return rows;
}

/**
 * Queries all-time total of utility_logs for a given year range.
 * Uses the current calendar year as the scope since getYearlySummary is year-scoped.
 * For all-time, we sum across multiple years via a raw query.
 */
async function fetchAllTimeUtilitiesTotal(): Promise<{
  allTimeTotal:  number;
  currentYearTotal: number;
}> {
  const db = await getDatabase();

  const allTimeRow = await db.getFirstAsync<{ total: number | null }>(
    `SELECT SUM(amount) AS total
     FROM utility_logs
     WHERE deleted_at IS NULL`,
  );

  const currentYear = new Date().getFullYear();
  const yearlyRows  = await getYearlySummary(currentYear);
  const currentYearTotal = yearlyRows.reduce((sum, r) => sum + r.totalAmount, 0);

  return {
    allTimeTotal:     allTimeRow?.total ?? 0,
    currentYearTotal,
  };
}

// ─── Elapsed months helper ────────────────────────────────────────────────────

/**
 * Returns the number of months elapsed in the current calendar year, minimum 1.
 * Used to compute monthly averages without dividing by zero in January.
 */
function elapsedMonthsThisYear(): number {
  return Math.max(1, new Date().getMonth() + 1);
}

// ─── Risk level classifier ────────────────────────────────────────────────────

function classifyRisk(
  roiPercent:        number,
  paybackMonths:     number,
  netProfit:         number,
): BusinessROIRiskLevel {
  if (netProfit < 0 || roiPercent < 10 || paybackMonths > 24) return 'high';
  if (roiPercent >= 25 && paybackMonths <= 12)                 return 'low';
  return 'medium';
}

// ─── AI insight engine ────────────────────────────────────────────────────────

// ─── Target pace insight helper ───────────────────────────────────────────────

/**
 * Builds the standalone target-pace insight sentence for the business overview.
 * Extracted so it can be stored as targetSalesInsight and also embedded in aiInsight.
 */
function buildBusinessTargetSalesInsight(params: {
  targetROIPercent:       number;
  requiredMonthlyUnits:   number;
  requiredDailyUnits:     number;
  monthsRemainingInYear:  number;
  currentMonthlyUnitPace: number;
  unitsPaceShortfall:     number;
  unitsSoldToDate:        number;
  contributionPerUnit:    number;
}): string {
  const {
    targetROIPercent,
    requiredMonthlyUnits,
    requiredDailyUnits,
    monthsRemainingInYear,
    currentMonthlyUnitPace,
    unitsPaceShortfall,
    unitsSoldToDate,
    contributionPerUnit,
  } = params;

  if (unitsSoldToDate === 0 || contributionPerUnit <= 0) {
    return 'Start recording sales to see your required daily and monthly selling pace.';
  }

  const tgtFmt  = targetROIPercent.toString();
  const moFmt   = Math.round(requiredMonthlyUnits).toLocaleString('en-PH');
  const dayFmt  = (Math.round(requiredDailyUnits * 10) / 10).toLocaleString('en-PH');
  const remFmt  = monthsRemainingInYear.toLocaleString('en-PH');

  if (unitsPaceShortfall === 0) {
    return (
      `You are on pace — averaging ${Math.round(currentMonthlyUnitPace).toLocaleString('en-PH')} units/month is enough ` +
      `to hit your ${tgtFmt}% ROI target with ${remFmt} month${monthsRemainingInYear !== 1 ? 's' : ''} to spare.`
    );
  }

  const shortFmt = Math.round(unitsPaceShortfall).toLocaleString('en-PH');
  const curFmt   = Math.round(currentMonthlyUnitPace).toLocaleString('en-PH');
  return (
    `To hit your ${tgtFmt}% ROI target by year-end, sell ${moFmt} units/month (${dayFmt}/day) ` +
    `for the next ${remFmt} month${monthsRemainingInYear !== 1 ? 's' : ''}. ` +
    `You are currently averaging ${curFmt}/month — ${shortFmt} units short each month.`
  );
}

/**
 * Rule-based natural language business health insight.
 * Runs entirely client-side — no external API calls.
 *
 * Covers:
 *   1. ROI summary with benchmark comparison
 *   2. Payback period (when positive)
 *   3. Top product callout
 *   4. Breakeven gap (units still needed)
 *   5. Target ROI sales pace (units/month and units/day)
 *   6. Overhead burn rate health check
 *   7. Burn rate vs revenue warning
 *   8. Gross margin note
 *   9. Risk flag (when high)
 */
function buildBusinessInsight(params: {
  roiPercent:             number;
  netProfit:              number;
  totalInvestment:        number;
  paybackPeriodMonths:    number;
  unitsSoldToDate:        number;
  unitsStillNeeded:       number;
  breakevenUnits:         number;
  monthlyBurnRate:        number;
  totalRevenue:           number;
  monthlyOverheadAvg:     number;
  productBreakdown:       ProductROIBreakdown[];
  riskLevel:              BusinessROIRiskLevel;
  grossMarginPercent:     number;
  targetSalesInsight:     string;
}): string {
  const {
    roiPercent,
    netProfit,
    totalInvestment,
    paybackPeriodMonths,
    unitsSoldToDate,
    unitsStillNeeded,
    breakevenUnits,
    monthlyBurnRate,
    totalRevenue,
    monthlyOverheadAvg,
    productBreakdown,
    riskLevel,
    grossMarginPercent,
    targetSalesInsight,
  } = params;

  // Guard: no data yet
  if (totalRevenue === 0 && totalInvestment === 0) {
    return (
      'No sales or investment data has been recorded yet. ' +
      'Start logging products, expenses, and POS transactions to see your business ROI picture.'
    );
  }

  const sentences: string[] = [];
  const fmt = (n: number): string =>
    '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  // 1. ROI summary
  if (totalInvestment === 0) {
    sentences.push(
      `Your business has generated ${fmt(totalRevenue)} in revenue with no tracked investment recorded.`,
    );
  } else if (netProfit >= 0) {
    const benchmark =
      roiPercent >= 30
        ? 'an excellent result above the 30% SME benchmark'
        : roiPercent >= 15
          ? 'within the healthy 15–30% SME range'
          : roiPercent >= 10
            ? 'just below the 15% SME benchmark — consider trimming fixed costs'
            : 'below the 10% threshold — the business is at risk of not recovering its investment';

    sentences.push(
      `Your business has earned ${fmt(netProfit)} net profit on a ${fmt(totalInvestment)} total investment — ` +
      `an ROI of ${roiPercent.toFixed(1)}%, ${benchmark}.`,
    );
  } else {
    sentences.push(
      `Your business has a net loss of ${fmt(Math.abs(netProfit))} against a ${fmt(totalInvestment)} investment. ` +
      `Revenue of ${fmt(totalRevenue)} has not yet covered total costs.`,
    );
  }

  // 2. Payback period
  if (paybackPeriodMonths < 999 && paybackPeriodMonths > 0) {
    const months = Math.round(paybackPeriodMonths * 10) / 10;
    sentences.push(`At the current monthly profit rate, full payback arrives in ${months} month${months !== 1 ? 's' : ''}.`);
  } else if (paybackPeriodMonths >= 999 && netProfit < 0) {
    sentences.push('The business has not yet reached monthly profitability — payback period cannot be projected.');
  }

  // 3. Top product callout
  const topProduct = productBreakdown[0];
  if (topProduct !== undefined && topProduct.unitsSold > 0) {
    sentences.push(
      `${topProduct.name} is your top revenue driver at ${fmt(topProduct.revenue)} ` +
      `across ${topProduct.unitsSold.toLocaleString()} units sold.`,
    );
  }

  // 4. Breakeven gap
  if (unitsSoldToDate > 0) {
    if (unitsStillNeeded > 0) {
      sentences.push(
        `Selling ${unitsStillNeeded.toLocaleString()} more units reaches your all-time breakeven threshold of ` +
        `${breakevenUnits.toLocaleString()} units.`,
      );
    } else {
      sentences.push(
        `You have surpassed the all-time breakeven threshold of ${breakevenUnits.toLocaleString()} units ` +
        `with ${unitsSoldToDate.toLocaleString()} units sold to date.`,
      );
    }
  }

  // 5. Target ROI sales pace
  sentences.push(targetSalesInsight);

  // 6. Overhead burn rate health
  if (totalRevenue > 0 && monthlyOverheadAvg > 0) {
    const overheadAsPercent = (monthlyOverheadAvg / (totalRevenue / elapsedMonthsThisYear())) * 100;
    if (overheadAsPercent > 30) {
      sentences.push(
        `Monthly overhead of ${fmt(monthlyOverheadAvg)} represents ${overheadAsPercent.toFixed(1)}% of average monthly revenue — ` +
        `above the healthy 30% ceiling. Review fixed cost obligations.`,
      );
    } else {
      sentences.push(
        `Monthly overhead of ${fmt(monthlyOverheadAvg)} is ${overheadAsPercent.toFixed(1)}% of average monthly revenue — within a manageable range.`,
      );
    }
  }

  // 7. Burn rate vs revenue warning
  const monthlyRevenue = totalRevenue / elapsedMonthsThisYear();
  if (monthlyBurnRate > monthlyRevenue && monthlyRevenue > 0) {
    sentences.push(
      `Warning: monthly burn rate of ${fmt(monthlyBurnRate)} exceeds average monthly revenue of ${fmt(monthlyRevenue)}. ` +
      `The business is currently spending more than it earns each month.`,
    );
  }

  // 8. Gross margin note
  if (grossMarginPercent < 20 && totalRevenue > 0) {
    sentences.push(
      `Gross margin of ${grossMarginPercent.toFixed(1)}% is below the 20% SME minimum — ` +
      `review product pricing or ingredient costs to widen the margin.`,
    );
  }

  // 9. Risk flag
  if (riskLevel === 'high' && paybackPeriodMonths > 24 && paybackPeriodMonths < 999) {
    sentences.push(
      'Risk is HIGH — payback exceeds 24 months. ' +
      'Consider restructuring fixed costs or increasing sales volume before committing additional capital.',
    );
  }

  return sentences.join(' ');
}

// ─── Core computation ─────────────────────────────────────────────────────────

async function runComputation(targetROIPercent: number): Promise<Omit<BusinessROIState,
  'isLoading' | 'lastRefreshed' | 'error' | 'computeBusinessROI' | 'refreshBusinessROI' | 'setTargetROIPercent'
>> {
  // ── 1. Read inventory state ─────────────────────────────────────────────────
  const inventoryItems = useInventoryStore.getState().items;

  let totalInventoryValue = 0;
  let totalEquipmentCost  = 0;

  for (const item of inventoryItems) {
    const cost = item.costPrice ?? 0;
    const value = cost * item.quantity;

    if (item.category === 'equipment') {
      totalEquipmentCost += value;
    } else {
      // Products and ingredients count toward working capital / inventory value
      totalInventoryValue += value;
    }
  }

  // ── 2. Read overhead summary ────────────────────────────────────────────────
  const overheadSummary   = useOverheadExpensesStore.getState().summary;
  const totalOverheadAllTime = overheadSummary.allTime;
  const elapsedMonths        = elapsedMonthsThisYear();
  const monthlyOverheadAvg   = overheadSummary.thisYear / elapsedMonths;

  // ── 3. Read utilities totals ────────────────────────────────────────────────
  const { allTimeTotal: totalUtilitiesAllTime, currentYearTotal } =
    await fetchAllTimeUtilitiesTotal();
  const monthlyUtilitiesAvg = currentYearTotal / elapsedMonths;

  // ── 4. Read all-time sales aggregates ────────────────────────────────────────
  const { totalRevenue, unitsSoldToDate } = await fetchAllTimeSalesAggregates();
  const totalCOGS = await fetchAllTimeCOGS();

  // ── 5. Read top products ─────────────────────────────────────────────────────
  const topProductRows = await fetchTopProducts(3);

  // Build cost lookup from inventory items (by product name — imprecise but viable
  // without a product_id join on sales_order_items.product_name snapshot)
  const costByName = new Map<string, number>();
  for (const item of inventoryItems) {
    if (item.category === 'product') {
      costByName.set(item.name.toLowerCase(), item.costPrice ?? 0);
    }
  }

  const productBreakdown: ProductROIBreakdown[] = topProductRows.map((row) => {
    const costPerUnit = costByName.get(row.product_name.toLowerCase()) ?? 0;
    const estimatedCogs = costPerUnit * row.units_sold;
    return {
      name:               row.product_name,
      unitsSold:          row.units_sold,
      revenue:            row.revenue,
      contributionMargin: row.revenue - estimatedCogs,
    };
  });

  // ── 6. Compute derived metrics ───────────────────────────────────────────────

  const totalInvestment = totalInventoryValue + totalEquipmentCost
    + totalOverheadAllTime + totalUtilitiesAllTime;

  const netProfit = totalRevenue - totalCOGS - totalOverheadAllTime - totalUtilitiesAllTime;

  const grossMarginPercent = totalRevenue > 0
    ? Math.round(((totalRevenue - totalCOGS) / totalRevenue) * 100 * 10) / 10
    : 0;

  const roiPercent = totalInvestment > 0
    ? Math.round((netProfit / totalInvestment) * 100 * 10) / 10
    : 0;

  // Monthly net profit estimate (use elapsed months in current year as proxy)
  const monthlyNetProfit = netProfit / elapsedMonths;

  // Contribution margin per unit (all-time blended average)
  const grossProfit          = totalRevenue - totalCOGS;
  const contributionPerUnit  = unitsSoldToDate > 0
    ? grossProfit / unitsSoldToDate
    : 0;

  // Monthly fixed costs = overhead avg + utilities avg
  const monthlyFixedCosts = monthlyOverheadAvg + monthlyUtilitiesAvg;

  const breakevenUnits = contributionPerUnit > 0
    ? Math.ceil(monthlyFixedCosts / contributionPerUnit)
    : 0;

  const unitsStillNeeded = Math.max(0, breakevenUnits - unitsSoldToDate);

  const paybackPeriodMonths = monthlyNetProfit > 0
    ? Math.round((totalInvestment / monthlyNetProfit) * 10) / 10
    : 999;

  // Months to configured targetROIPercent from current net profit position
  const targetNetProfit       = totalInvestment * (targetROIPercent / 100);
  const remainingToTarget     = Math.max(0, targetNetProfit - netProfit);
  const estimatedMonthsToTarget = monthlyNetProfit > 0
    ? Math.ceil(remainingToTarget / monthlyNetProfit)
    : 999;

  // ── Target-based sales pace ──────────────────────────────────────────────

  // Months remaining in the current calendar year (minimum 1 to avoid /0)
  const monthsRemainingInYear = Math.max(1, 12 - elapsedMonths);

  // Remaining profit needed to hit target by year-end
  const remainingProfit = Math.max(0, targetNetProfit - netProfit);

  // Units/month required in remaining months to close the gap
  const requiredMonthlyUnits = contributionPerUnit > 0
    ? Math.ceil((remainingProfit / monthsRemainingInYear) / contributionPerUnit)
    : 0;

  const requiredDailyUnits = Math.round((requiredMonthlyUnits / 30.44) * 100) / 100;

  // Current monthly unit pace = total units / elapsed months
  const currentMonthlyUnitPace = unitsSoldToDate > 0
    ? Math.round((unitsSoldToDate / elapsedMonths) * 100) / 100
    : 0;

  const unitsPaceShortfall = Math.max(0, requiredMonthlyUnits - currentMonthlyUnitPace);

  const targetSalesInsight = buildBusinessTargetSalesInsight({
    targetROIPercent,
    requiredMonthlyUnits,
    requiredDailyUnits,
    monthsRemainingInYear,
    currentMonthlyUnitPace,
    unitsPaceShortfall,
    unitsSoldToDate,
    contributionPerUnit,
  });

  // Monthly burn rate = overhead + utilities + estimated monthly COGS
  const monthlyCOGS     = totalCOGS / elapsedMonths;
  const monthlyBurnRate = monthlyOverheadAvg + monthlyUtilitiesAvg + monthlyCOGS;

  // ── 7. Classify risk and build insight ───────────────────────────────────────

  const riskLevel = classifyRisk(roiPercent, paybackPeriodMonths, netProfit);

  const aiInsight = buildBusinessInsight({
    roiPercent,
    netProfit,
    totalInvestment,
    paybackPeriodMonths,
    unitsSoldToDate,
    unitsStillNeeded,
    breakevenUnits,
    monthlyBurnRate,
    totalRevenue,
    monthlyOverheadAvg,
    productBreakdown,
    riskLevel,
    grossMarginPercent,
    targetSalesInsight,
  });

  return {
    totalInventoryValue,
    totalEquipmentCost,
    totalOverheadAllTime,
    totalUtilitiesAllTime,
    monthlyOverheadAvg:       Math.round(monthlyOverheadAvg * 100) / 100,
    monthlyUtilitiesAvg:      Math.round(monthlyUtilitiesAvg * 100) / 100,
    totalRevenue,
    totalCOGS,
    netProfit:                Math.round(netProfit * 100) / 100,
    grossMarginPercent,
    totalInvestment,
    roiPercent,
    breakevenUnits,
    unitsSoldToDate,
    unitsStillNeeded,
    paybackPeriodMonths,
    estimatedMonthsToTarget,
    monthlyBurnRate:          Math.round(monthlyBurnRate * 100) / 100,
    productBreakdown,
    aiInsight,
    riskLevel,
    targetROIPercent,
    requiredMonthlyUnits,
    requiredDailyUnits,
    monthsRemainingInYear,
    currentMonthlyUnitPace,
    unitsPaceShortfall:       Math.round(unitsPaceShortfall * 100) / 100,
    targetSalesInsight,
  };
}

// ─── Store ────────────────────────────────────────────────────────────────────

const DEFAULT_TARGET_ROI_PERCENT = 20;

export const useBusinessROIStore = create<BusinessROIState>()((set, get) => ({
  // ── Initial state ────────────────────────────────────────────────────────────
  totalInventoryValue:      0,
  totalEquipmentCost:       0,
  totalOverheadAllTime:     0,
  totalUtilitiesAllTime:    0,
  monthlyOverheadAvg:       0,
  monthlyUtilitiesAvg:      0,
  totalRevenue:             0,
  totalCOGS:                0,
  netProfit:                0,
  grossMarginPercent:       0,
  totalInvestment:          0,
  roiPercent:               0,
  breakevenUnits:           0,
  unitsSoldToDate:          0,
  unitsStillNeeded:         0,
  paybackPeriodMonths:      999,
  estimatedMonthsToTarget:  999,
  monthlyBurnRate:          0,
  productBreakdown:         [],
  aiInsight:                'Tap "Refresh" to compute your business ROI overview.',
  riskLevel:                'medium',
  isLoading:                false,
  lastRefreshed:            null,
  error:                    null,
  targetROIPercent:         DEFAULT_TARGET_ROI_PERCENT,
  requiredMonthlyUnits:     0,
  requiredDailyUnits:       0,
  monthsRemainingInYear:    Math.max(1, 12 - (new Date().getMonth() + 1)),
  currentMonthlyUnitPace:   0,
  unitsPaceShortfall:       0,
  targetSalesInsight:       'Start recording sales to see your required daily and monthly selling pace.',

  // ── Actions ──────────────────────────────────────────────────────────────────

  computeBusinessROI: async () => {
    set({ isLoading: true, error: null });
    try {
      const computed = await runComputation(get().targetROIPercent);
      set({
        ...computed,
        isLoading:     false,
        lastRefreshed: new Date().toISOString(),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to compute business ROI.';
      set({ isLoading: false, error: message });
    }
  },

  refreshBusinessROI: async () => {
    // Alias — identical to computeBusinessROI. Exists so UI can use a semantically
    // distinct name for pull-to-refresh vs. first-load calls.
    set({ isLoading: true, error: null });
    try {
      const computed = await runComputation(get().targetROIPercent);
      set({
        ...computed,
        isLoading:     false,
        lastRefreshed: new Date().toISOString(),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to refresh business ROI.';
      set({ isLoading: false, error: message });
    }
  },

  setTargetROIPercent: async (pct: number) => {
    set({ targetROIPercent: pct });
    set({ isLoading: true, error: null });
    try {
      const computed = await runComputation(pct);
      set({
        ...computed,
        isLoading:     false,
        lastRefreshed: new Date().toISOString(),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to recompute business ROI.';
      set({ isLoading: false, error: message });
    }
  },
}));

// ─── Selectors ────────────────────────────────────────────────────────────────

/** The complete Business ROI snapshot. */
export const selectBusinessROI = (s: BusinessROIState): BusinessROIData => ({
  totalInventoryValue:      s.totalInventoryValue,
  totalEquipmentCost:       s.totalEquipmentCost,
  totalOverheadAllTime:     s.totalOverheadAllTime,
  totalUtilitiesAllTime:    s.totalUtilitiesAllTime,
  monthlyOverheadAvg:       s.monthlyOverheadAvg,
  monthlyUtilitiesAvg:      s.monthlyUtilitiesAvg,
  totalRevenue:             s.totalRevenue,
  totalCOGS:                s.totalCOGS,
  netProfit:                s.netProfit,
  grossMarginPercent:       s.grossMarginPercent,
  totalInvestment:          s.totalInvestment,
  roiPercent:               s.roiPercent,
  breakevenUnits:           s.breakevenUnits,
  unitsSoldToDate:          s.unitsSoldToDate,
  unitsStillNeeded:         s.unitsStillNeeded,
  paybackPeriodMonths:      s.paybackPeriodMonths,
  estimatedMonthsToTarget:  s.estimatedMonthsToTarget,
  monthlyBurnRate:          s.monthlyBurnRate,
  productBreakdown:         s.productBreakdown,
  aiInsight:                s.aiInsight,
  riskLevel:                s.riskLevel,
  targetROIPercent:         s.targetROIPercent,
  requiredMonthlyUnits:     s.requiredMonthlyUnits,
  requiredDailyUnits:       s.requiredDailyUnits,
  monthsRemainingInYear:    s.monthsRemainingInYear,
  currentMonthlyUnitPace:   s.currentMonthlyUnitPace,
  unitsPaceShortfall:       s.unitsPaceShortfall,
  targetSalesInsight:       s.targetSalesInsight,
});

/** The AI-generated business health insight string. */
export const selectBusinessROIInsight = (s: BusinessROIState): string => s.aiInsight;

/** The classified risk level for the business. */
export const selectBusinessROIRiskLevel = (s: BusinessROIState): BusinessROIRiskLevel => s.riskLevel;

/** True while computation is in progress. */
export const selectBusinessROILoading = (s: BusinessROIState): boolean => s.isLoading;

/** The computed ROI percentage. */
export const selectBusinessROIPercent = (s: BusinessROIState): number => s.roiPercent;

/** Top 3 product revenue contributors. */
export const selectBusinessROIBreakdown = (s: BusinessROIState): ProductROIBreakdown[] =>
  s.productBreakdown;

/** ISO timestamp of the last successful computation, or null. */
export const selectBusinessROILastRefreshed = (s: BusinessROIState): string | null =>
  s.lastRefreshed;

/** The last computation error message, or null. */
export const selectBusinessROIError = (s: BusinessROIState): string | null => s.error;

/** Units per month required to hit the target ROI by year-end. */
export const selectRequiredMonthlySales = (s: BusinessROIState): number => s.requiredMonthlyUnits;

/** Units per day required to hit the target ROI by year-end. */
export const selectRequiredDailySales = (s: BusinessROIState): number => s.requiredDailyUnits;

/** Focused AI sentence about the target sales pace. */
export const selectTargetSalesInsight = (s: BusinessROIState): string => s.targetSalesInsight;

/** The configured target ROI percentage (default 20). */
export const selectTargetROIPercent = (s: BusinessROIState): number => s.targetROIPercent;
