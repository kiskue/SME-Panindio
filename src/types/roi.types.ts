/**
 * ROI Calculator — shared type definitions
 *
 * These types form the public API surface between the ROI store, the ROI
 * screen, and the reusable ROI components. The ERP architect agent's
 * roi.store.ts must export types that satisfy these shapes exactly.
 */

// ─── Inputs ──────────────────────────────────────────────────────────────────

/** All user-supplied numbers that drive the ROI calculation. */
export interface ROIInputs {
  /** One-time capital purchase (equipment, machinery, etc.) in ₱. */
  equipmentCost: number;
  /** One-time setup / installation / pre-opening costs in ₱. */
  setupCost: number;
  /** Total fixed overhead per month (rent, salaries, utilities) in ₱. */
  monthlyOverhead: number;
  /** Variable cost to produce / purchase a single unit in ₱. */
  costPerUnit: number;
  /** Selling price of a single unit in ₱. */
  sellingPrice: number;
  /** Expected units sold per month. */
  monthlyVolume: number;
  /** Minimum acceptable ROI in percent (e.g., 20 means 20%). */
  targetROIPercent: number;
}

// ─── Results ─────────────────────────────────────────────────────────────────

/** Risk level derived from the computed metrics. */
export type ROIRiskLevel = 'low' | 'medium' | 'high';

/** Computed output after running the ROI formula. */
export interface ROIResults {
  /** Units required per month to cover all costs (fixed + variable). */
  breakevenUnits: number;
  /** Full months component of the break-even period. */
  breakevenMonths: number;
  /** Remaining days after the full-month component. */
  breakevenDays: number;
  /** (sellingPrice - costPerUnit) / sellingPrice  ×  100 */
  grossMargin: number;
  /** sellingPrice - costPerUnit (₱ per unit after variable cost) */
  contributionMargin: number;
  /**
   * Month-keyed map of cumulative ROI percentage.
   * Keys: 1, 3, 6, 12, 24.
   */
  projectedROI: Record<number, number>;
  /**
   * How many months until initial investment is fully recovered
   * (may differ from breakevenMonths when overhead is treated separately).
   */
  paybackPeriod: number;
  riskLevel: ROIRiskLevel;

  // ── Target-based sales pace ────────────────────────────────────────────────

  /**
   * Units per month the user must sell to cover overhead AND reach targetROIPercent.
   * Formula: (targetProfit + monthlyOverhead) / contributionMargin
   * where targetProfit = totalInvestment × (targetROIPercent / 100).
   * 0 when totalInvestment = 0 or contributionMargin <= 0.
   */
  unitsPerMonthToHitTarget: number;

  /**
   * Units per day equivalent: unitsPerMonthToHitTarget / 30.44.
   * 0 when unitsPerMonthToHitTarget = 0.
   */
  unitsPerDayToHitTarget: number;

  /**
   * Months at the CURRENT monthly volume to reach targetROIPercent from zero.
   * Formula: targetProfit / (monthlyVolume × contributionMargin - monthlyOverhead).
   * 999 when monthly profit <= 0 or totalInvestment = 0.
   */
  monthsAtCurrentVolumeToTarget: number;

  /**
   * Extra units per month beyond current monthly volume required to meet the target.
   * max(0, unitsPerMonthToHitTarget - monthlyVolume).
   * 0 when the current volume already meets the target.
   */
  unitsShortfallPerMonth: number;

  /**
   * Focused AI sentence specifically about the sales target pace.
   * Embedded in the main insight string and also available standalone.
   */
  targetSalesInsight: string;
}

// ─── Scenarios ────────────────────────────────────────────────────────────────

/** A single named scenario (current / optimistic / conservative). */
export interface ROIScenarioItem {
  label: string;
  /** Selling price applied in this scenario. */
  price: number;
  roi: number;
  breakevenMonths: number;
  unitsNeeded: number;
  grossMargin: number;
  riskLevel: ROIRiskLevel;
}

/** The three standard scenario comparisons. */
export interface ROIScenarios {
  current:      ROIScenarioItem;
  optimistic:   ROIScenarioItem;
  conservative: ROIScenarioItem;
}

// ─── Store shape (used by local stub + real store) ───────────────────────────

export interface ROIStoreState {
  inputs:     ROIInputs;
  results:    ROIResults | null;
  scenarios:  ROIScenarios | null;
  insight:    string;
  isLoading:  boolean;
}

export interface ROIStoreActions {
  setROIInputs(inputs: Partial<ROIInputs>): void;
  computeROI(): void;
  generateAIInsight(): void;
  saveScenario(name: string): Promise<void>;
}

// ─── Persisted scenario record ────────────────────────────────────────────────

/**
 * A saved ROI scenario stored in the `roi_scenarios` SQLite table.
 * Snapshots inputs, results, and the insight string at save time.
 * Loading a saved scenario re-populates the live calculator without re-running
 * the formula from scratch (though the store also re-derives on load for safety).
 */
export interface ROIScenario {
  id:         string;
  /** User-defined display name (e.g. "Optimistic Q1 2026"). */
  name:       string;
  /** Snapshot of all inputs at save time — stored as JSON in SQLite. */
  inputs:     ROIInputs;
  /** Snapshot of computed results at save time — stored as JSON in SQLite. */
  results:    ROIResults;
  /** Snapshot of the scenario comparison at save time — stored as JSON in SQLite. */
  scenarioCmp: ROIScenarios;
  /** Natural language insight string at save time. */
  insight:    string;
  /** ISO 8601 timestamp. */
  createdAt:  string;
  /** ISO 8601 timestamp. */
  updatedAt:  string;
}

/** Input for creating a new saved scenario. */
export interface CreateROIScenarioInput {
  name:        string;
  inputs:      ROIInputs;
  results:     ROIResults;
  scenarioCmp: ROIScenarios;
  insight:     string;
}

/** Input for updating an existing saved scenario's name only. */
export interface UpdateROIScenarioNameInput {
  name: string;
}
