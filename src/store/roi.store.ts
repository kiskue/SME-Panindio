/**
 * roi.store.ts
 *
 * Zustand v5 store for the ROI (Return on Investment) Calculator module.
 *
 * Responsibilities:
 *   - Holds the live calculator state: inputs, computed results, scenario
 *     comparison, and the generated insight string.
 *   - Implements ROIStoreState & ROIStoreActions as declared in roi.types.ts
 *     so the UI layer never needs to change when internals are upgraded.
 *   - Computes all ROI metrics in-memory on each computeROI() call.
 *   - Generates natural language insights using local rule-based logic.
 *   - Persists named scenario snapshots to SQLite via the ROI repository.
 *   - Loads the list of saved scenarios on initializeROIStore().
 *
 * IMPORTANT: All selector and action names declared in roi.types.ts are
 * preserved exactly. The UI layer depends on these names.
 *
 * Business formulas (standard SME accounting):
 *   totalInvestment      = equipmentCost + setupCost
 *   contributionMargin   = sellingPrice − costPerUnit
 *   grossMargin %        = contributionMargin / sellingPrice × 100
 *   breakevenUnits/mo    = monthlyOverhead / contributionMargin
 *   monthlyProfit        = monthlyVolume × contributionMargin − monthlyOverhead
 *   paybackPeriod (mo.)  = totalInvestment / monthlyProfit
 *   projectedROI(N)      = (monthlyProfit × N − totalInvestment) / totalInvestment × 100
 *
 * Risk thresholds:
 *   high   — payback > 18 months  OR  grossMargin < 20%
 *   medium — payback 6–18 months  OR  grossMargin 20–35%
 *   low    — payback <= 6 months  AND grossMargin >= 35%
 *
 * TypeScript strict-mode notes:
 *   - exactOptionalPropertyTypes: conditional spread for optional fields.
 *   - noUncheckedIndexedAccess: ?? fallbacks on all array/record access.
 *   - noUnusedLocals/Parameters: unused vars prefixed with _.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  ROIInputs,
  ROIResults,
  ROIScenarios,
  ROIScenarioItem,
  ROIRiskLevel,
  ROIStoreState,
  ROIStoreActions,
  ROIScenario,
  CreateROIScenarioInput,
} from '@/types/roi.types';
import {
  createROIScenario,
  listROIScenarios,
  deleteROIScenario,
  renameROIScenario,
} from '../../database/repositories/roi.repository';

// ─── Default inputs ────────────────────────────────────────────────────────

const DEFAULT_INPUTS: ROIInputs = {
  equipmentCost:    0,
  setupCost:        0,
  monthlyOverhead:  0,
  costPerUnit:      0,
  sellingPrice:     0,
  monthlyVolume:    0,
  targetROIPercent: 20,
};

// ─── Calculation helpers ───────────────────────────────────────────────────

function calcScenario(
  inputs:        ROIInputs,
  priceOverride: number,
  label:         string,
): ROIScenarioItem {
  const { equipmentCost, setupCost, monthlyOverhead, costPerUnit, monthlyVolume } = inputs;
  const price           = priceOverride;
  const totalInvestment = equipmentCost + setupCost;

  const contributionMargin = price - costPerUnit;
  const grossMargin        = price > 0 ? (contributionMargin / price) * 100 : 0;

  // Monthly net contribution at target volume
  const monthlyContribution = contributionMargin * monthlyVolume - monthlyOverhead;

  // Breakeven units per month: units to cover overhead alone
  // Use 5-year amortisation for the display-level "units needed" figure
  const monthlyFixedCosts = monthlyOverhead + (totalInvestment / 60);
  const breakevenUnits    = contributionMargin > 0
    ? Math.ceil(monthlyFixedCosts / contributionMargin)
    : Infinity;

  // Breakeven months: months to recover totalInvestment from monthlyContribution
  const breakevenMonthsExact = monthlyContribution > 0
    ? totalInvestment / monthlyContribution
    : Infinity;
  const breakevenMonths = isFinite(breakevenMonthsExact)
    ? Math.floor(breakevenMonthsExact)
    : 999;

  // ROI at 12 months
  const annualContribution = monthlyContribution * 12;
  const roi = totalInvestment > 0
    ? (annualContribution / totalInvestment) * 100
    : 0;

  const riskLevel: ROIRiskLevel =
    breakevenMonths > 18 ? 'high'   :
    grossMargin     < 20 ? 'medium' :
    roi             < 0  ? 'high'   :
    'low';

  return {
    label,
    price,
    roi:            Math.round(roi * 10) / 10,
    breakevenMonths,
    unitsNeeded:    isFinite(breakevenUnits) ? breakevenUnits : 9999,
    grossMargin:    Math.round(grossMargin * 10) / 10,
    riskLevel,
  };
}

// ─── Target sales pace helpers ─────────────────────────────────────────────

/**
 * Builds the standalone target-pace insight sentence.
 * Extracted so both computeResults() and buildInsight() produce a
 * consistent string without duplicating logic.
 */
function buildTargetSalesInsight(params: {
  targetROIPercent:            number;
  unitsPerMonthToHitTarget:    number;
  unitsPerDayToHitTarget:      number;
  monthsAtCurrentVolumeToTarget: number;
  unitsShortfallPerMonth:      number;
  monthlyVolume:               number;
  contributionMargin:          number;
}): string {
  const {
    targetROIPercent,
    unitsPerMonthToHitTarget,
    unitsPerDayToHitTarget,
    monthsAtCurrentVolumeToTarget,
    unitsShortfallPerMonth,
    monthlyVolume,
    contributionMargin,
  } = params;

  if (contributionMargin <= 0) {
    return 'Set a selling price above cost to see your required daily and monthly selling pace.';
  }

  if (monthlyVolume === 0) {
    return `Set your expected monthly volume to see how many units/day you need to sell to hit your ${targetROIPercent}% ROI target.`;
  }

  const tgtFmt  = targetROIPercent.toString();
  const moFmt   = Math.round(unitsPerMonthToHitTarget).toLocaleString('en-PH');
  const dayFmt  = (Math.round(unitsPerDayToHitTarget * 10) / 10).toLocaleString('en-PH');
  const curFmt  = monthlyVolume.toLocaleString('en-PH');

  if (unitsShortfallPerMonth === 0) {
    const mFmt = (Math.round(monthsAtCurrentVolumeToTarget * 10) / 10).toLocaleString('en-PH');
    return (
      `At ${curFmt} units/month you are already on pace to hit your ${tgtFmt}% ROI target in ${mFmt} month${monthsAtCurrentVolumeToTarget !== 1 ? 's' : ''}.`
    );
  }

  const shortFmt = Math.round(unitsShortfallPerMonth).toLocaleString('en-PH');
  return (
    `To reach your ${tgtFmt}% ROI target, sell ${moFmt} units/month (${dayFmt}/day). ` +
    `You are currently at ${curFmt}/month — ${shortFmt} units short each month.`
  );
}

function computeResults(inputs: ROIInputs): ROIResults {
  const {
    equipmentCost,
    setupCost,
    monthlyOverhead,
    costPerUnit,
    sellingPrice,
    monthlyVolume,
    targetROIPercent,
  } = inputs;

  const totalInvestment    = equipmentCost + setupCost;
  const contributionMargin = sellingPrice - costPerUnit;
  const grossMargin        = sellingPrice > 0
    ? (contributionMargin / sellingPrice) * 100
    : 0;

  // Monthly breakeven units: overhead / contribution per unit
  const breakevenUnits = contributionMargin > 0
    ? Math.ceil(monthlyOverhead / contributionMargin)
    : Infinity;

  // Monthly profit at expected volume
  const monthlyProfit = contributionMargin * monthlyVolume - monthlyOverhead;

  // Payback period: months to recover totalInvestment
  const breakevenExact = monthlyProfit > 0
    ? totalInvestment / monthlyProfit
    : Infinity;

  const breakevenMonths = isFinite(breakevenExact) ? Math.floor(breakevenExact) : 999;
  const breakevenDays   = isFinite(breakevenExact)
    ? Math.round((breakevenExact - breakevenMonths) * 30)
    : 0;

  const paybackPeriod = breakevenMonths;

  // Risk level
  const riskLevel: ROIRiskLevel =
    breakevenMonths > 18 ? 'high'   :
    grossMargin     < 20 ? 'medium' :
    'low';

  // Projected cumulative ROI at key milestones
  const projectROIAt = (months: number): number => {
    if (totalInvestment === 0) return 0;
    const cumulative = monthlyProfit * months;
    return Math.round((cumulative / totalInvestment) * 100 * 10) / 10;
  };

  const projectedROI: Record<number, number> = {
    1:  projectROIAt(1),
    3:  projectROIAt(3),
    6:  projectROIAt(6),
    12: projectROIAt(12),
    24: projectROIAt(24),
  };

  // ── Target-based sales pace ──────────────────────────────────────────────

  // targetProfit: how much profit is needed to achieve targetROIPercent on the investment
  const targetProfit = totalInvestment * (targetROIPercent / 100);

  // Units/month to simultaneously cover overhead AND earn targetProfit (per month)
  // We spread targetProfit over 12 months to get a monthly profit target.
  const targetMonthlyProfit = targetProfit / 12;
  const unitsPerMonthToHitTarget = contributionMargin > 0
    ? Math.ceil((targetMonthlyProfit + monthlyOverhead) / contributionMargin)
    : 0;

  const unitsPerDayToHitTarget = unitsPerMonthToHitTarget / 30.44;

  // Months at current volume to accumulate targetProfit (from zero)
  const monthsAtCurrentVolumeToTarget = monthlyProfit > 0
    ? Math.round((targetProfit / monthlyProfit) * 10) / 10
    : 999;

  const unitsShortfallPerMonth = Math.max(0, unitsPerMonthToHitTarget - monthlyVolume);

  const targetSalesInsight = buildTargetSalesInsight({
    targetROIPercent,
    unitsPerMonthToHitTarget,
    unitsPerDayToHitTarget: Math.round(unitsPerDayToHitTarget * 10) / 10,
    monthsAtCurrentVolumeToTarget,
    unitsShortfallPerMonth,
    monthlyVolume,
    contributionMargin,
  });

  return {
    breakevenUnits:     isFinite(breakevenUnits) ? breakevenUnits : 9999,
    breakevenMonths,
    breakevenDays,
    grossMargin:        Math.round(grossMargin * 10) / 10,
    contributionMargin: Math.round(contributionMargin * 100) / 100,
    projectedROI,
    paybackPeriod,
    riskLevel,
    unitsPerMonthToHitTarget,
    unitsPerDayToHitTarget:        Math.round(unitsPerDayToHitTarget * 100) / 100,
    monthsAtCurrentVolumeToTarget,
    unitsShortfallPerMonth,
    targetSalesInsight,
  };
}

function buildScenarios(inputs: ROIInputs): ROIScenarios {
  return {
    current:      calcScenario(inputs, inputs.sellingPrice,        'Current'),
    optimistic:   calcScenario(inputs, inputs.sellingPrice * 1.10, 'Optimistic (+10%)'),
    conservative: calcScenario(inputs, inputs.sellingPrice * 0.90, 'Conservative (-10%)'),
  };
}

// ─── Enhanced insight engine ───────────────────────────────────────────────

/**
 * Rule-based natural language insight. Runs entirely client-side.
 * Produces a single string (sentences separated by spaces) covering:
 *   1. Primary breakeven summary
 *   2. Margin health commentary
 *   3. Material cost sensitivity (10% reduction scenario)
 *   4. Target ROI sales pace (units/month and units/day to hit targetROIPercent)
 *   5. Price optimisation note
 *   6. Risk warning (when riskLevel = 'high')
 */
function buildInsight(inputs: ROIInputs, results: ROIResults): string {
  const {
    breakevenMonths,
    breakevenDays,
    breakevenUnits,
    riskLevel,
    grossMargin,
    paybackPeriod,
    targetSalesInsight,
  } = results;
  const {
    monthlyVolume,
    sellingPrice,
    costPerUnit,
    monthlyOverhead,
    equipmentCost,
    setupCost,
    targetROIPercent,
  } = inputs;

  // Guard: missing price or cost
  if (sellingPrice === 0 || costPerUnit === 0) {
    return 'Enter your product economics to see a smart break-even insight.';
  }

  // Guard: selling below cost
  if (sellingPrice <= costPerUnit) {
    return (
      'Your selling price does not exceed your cost per unit — every sale generates a loss. ' +
      'Raise your price or reduce material costs before projecting ROI.'
    );
  }

  const sentences: string[] = [];

  // 1. Primary breakeven summary
  const periodStr =
    breakevenMonths > 0
      ? `${breakevenMonths} month${breakevenMonths !== 1 ? 's' : ''}` +
        (breakevenDays > 0 ? ` ${breakevenDays} day${breakevenDays !== 1 ? 's' : ''}` : '')
      : `${breakevenDays} day${breakevenDays !== 1 ? 's' : ''}`;

  if (paybackPeriod >= 999) {
    sentences.push(
      `At ${monthlyVolume.toLocaleString()} units/month, your monthly expenses exceed your revenue. ` +
      `Sell at least ${breakevenUnits.toLocaleString()} units/month to cover overhead.`,
    );
  } else if (monthlyVolume >= breakevenUnits) {
    sentences.push(
      `You will break even in ${periodStr} at your current volume of ${monthlyVolume.toLocaleString()} units/month — ` +
      `already above the ${breakevenUnits.toLocaleString()}-unit overhead threshold.`,
    );
  } else {
    const shortfall = breakevenUnits - monthlyVolume;
    const dailyVol  = Math.round((monthlyVolume / 30.44) * 10) / 10;
    sentences.push(
      `Selling ${monthlyVolume.toLocaleString()} units/month (${dailyVol}/day), you will break even in ${periodStr}. ` +
      `Increase volume by ${shortfall.toLocaleString()} units/month to reach the overhead breakeven threshold.`,
    );
  }

  // 2. Margin health
  if (grossMargin < 20) {
    sentences.push(
      `Gross margin of ${grossMargin.toFixed(1)}% is below the 20% SME benchmark — ` +
      `consider raising your price or reducing material costs.`,
    );
  } else if (grossMargin >= 50) {
    sentences.push(
      `Strong gross margin of ${grossMargin.toFixed(1)}% gives you good cushion against cost increases.`,
    );
  } else {
    sentences.push(`Gross margin of ${grossMargin.toFixed(1)}% is within a healthy range.`);
  }

  // 3. Material cost sensitivity (10% reduction)
  if (costPerUnit > 0 && paybackPeriod < 999) {
    const totalInvestment       = equipmentCost + setupCost;
    const reducedCost           = costPerUnit * 0.90;
    const reducedContribution   = sellingPrice - reducedCost;
    const reducedMonthlyProfit  = monthlyVolume * reducedContribution - monthlyOverhead;
    const reducedPayback        = reducedMonthlyProfit > 0
      ? Math.floor(totalInvestment / reducedMonthlyProfit)
      : 999;

    if (reducedPayback < paybackPeriod) {
      const savedMonths = paybackPeriod - reducedPayback;
      sentences.push(
        `Cutting material cost by 10% (to ₱${reducedCost.toFixed(2)}/unit) ` +
        `shortens payback by ${savedMonths} month${savedMonths !== 1 ? 's' : ''}.`,
      );
    }
  }

  // 4. Target ROI sales pace
  if (targetROIPercent > 0) {
    sentences.push(targetSalesInsight);
  }

  // 5. Optimistic price note
  if (paybackPeriod < 999) {
    const totalInvestment        = equipmentCost + setupCost;
    const optimisticPrice        = sellingPrice * 1.10;
    const optimisticContribution = optimisticPrice - costPerUnit;
    const optimisticMonthlyProfit = monthlyVolume * optimisticContribution - monthlyOverhead;
    const optimisticPayback       = optimisticMonthlyProfit > 0
      ? Math.floor(totalInvestment / optimisticMonthlyProfit)
      : 999;

    if (optimisticPayback < paybackPeriod) {
      sentences.push(
        `Raising your price by 10% (to ₱${optimisticPrice.toFixed(2)}) ` +
        `cuts payback to ${optimisticPayback} month${optimisticPayback !== 1 ? 's' : ''}.`,
      );
    }
  }

  // 6. Risk warning
  if (riskLevel === 'high') {
    if (paybackPeriod > 18 && paybackPeriod < 999) {
      sentences.push(
        'Risk is HIGH — payback exceeds 18 months. ' +
        'Consider phasing your investment or securing pre-committed customers before purchasing equipment.',
      );
    } else {
      sentences.push(
        'Risk is HIGH due to thin margins. ' +
        'Aim for at least 20% gross margin to absorb unexpected cost increases.',
      );
    }
  }

  return sentences.join(' ');
}

// ─── Extended state shape ──────────────────────────────────────────────────

interface ROIExtendedState extends ROIStoreState {
  /** Saved scenarios from SQLite, newest first. */
  savedScenarios:     ROIScenario[];
  /** True while loading the scenario list from SQLite. */
  isScenariosLoading: boolean;
  /** Error from the last persistence operation, or null. */
  error:              string | null;
}

interface ROIExtendedActions extends ROIStoreActions {
  /**
   * Loads saved scenarios from SQLite.
   * Called once from initializeStores() at app boot.
   */
  initializeROIStore: () => Promise<void>;

  /** Hard-deletes a saved scenario. */
  removeSavedScenario: (id: string) => Promise<void>;

  /** Renames a saved scenario and refreshes the in-memory list. */
  renameSavedScenario: (id: string, name: string) => Promise<void>;

  /**
   * Loads a saved scenario's inputs into the live calculator and
   * re-derives results, so the user can inspect or tweak the scenario.
   */
  loadSavedScenario: (scenario: ROIScenario) => void;

  /** Resets the live calculator to blank defaults. */
  resetInputs: () => void;

  /** Clears the last persistence error. */
  clearError: () => void;
}

type ROIStore = ROIExtendedState & ROIExtendedActions;

// ─── Store ─────────────────────────────────────────────────────────────────

export const useROIStore = create<ROIStore>()(
  persist(
    (set, get) => ({
      // ── Initial state ──────────────────────────────────────────────────

      inputs:             DEFAULT_INPUTS,
      results:            null,
      scenarios:          null,
      insight:            'Enter your numbers to generate an AI-powered insight.',
      isLoading:          false,
      savedScenarios:     [],
      isScenariosLoading: false,
      error:              null,

      // ── Boot ──────────────────────────────────────────────────────────

      initializeROIStore: async () => {
        set({ isScenariosLoading: true, error: null });
        try {
          const savedScenarios = await listROIScenarios();
          set({ savedScenarios, isScenariosLoading: false });
        } catch (err) {
          set({
            error:              err instanceof Error ? err.message : 'Failed to load ROI scenarios',
            isScenariosLoading: false,
          });
        }
      },

      // ── Live calculator ────────────────────────────────────────────────

      setROIInputs(partial) {
        set((state) => ({ inputs: { ...state.inputs, ...partial } }));
      },

      computeROI() {
        const { inputs } = get();
        set({ isLoading: true });

        // Synchronous calculation wrapped in a short timeout so the isLoading
        // animation can paint before the CPU-bound work runs on the JS thread.
        setTimeout(() => {
          const results   = computeResults(inputs);
          const scenarios = buildScenarios(inputs);
          const insight   = buildInsight(inputs, results);
          set({ results, scenarios, insight, isLoading: false });
        }, 300);
      },

      generateAIInsight() {
        const { inputs, results } = get();
        if (results == null) return;
        set({ isLoading: true });
        setTimeout(() => {
          const insight = buildInsight(inputs, results);
          set({ insight, isLoading: false });
        }, 500);
      },

      // ── Persistence ────────────────────────────────────────────────────

      async saveScenario(name: string): Promise<void> {
        const { inputs, results, scenarios, insight } = get();

        // Guard: results must exist before saving
        if (results == null || scenarios == null) {
          set({ error: 'Cannot save a scenario before computing results.' });
          return;
        }

        set({ isLoading: true, error: null });
        try {
          const input: CreateROIScenarioInput = {
            name,
            inputs,
            results,
            scenarioCmp: scenarios,
            insight,
          };
          await createROIScenario(input);
          // Refresh the saved list so it stays in sync.
          const savedScenarios = await listROIScenarios();
          set({ savedScenarios, isLoading: false });
        } catch (err) {
          set({
            error:     err instanceof Error ? err.message : 'Failed to save scenario',
            isLoading: false,
          });
          throw err;
        }
      },

      removeSavedScenario: async (id) => {
        set({ isLoading: true, error: null });
        try {
          await deleteROIScenario(id);
          set((state) => ({
            savedScenarios: state.savedScenarios.filter((s) => s.id !== id),
            isLoading:      false,
          }));
        } catch (err) {
          set({
            error:     err instanceof Error ? err.message : 'Failed to delete scenario',
            isLoading: false,
          });
          throw err;
        }
      },

      renameSavedScenario: async (id, name) => {
        set({ isLoading: true, error: null });
        try {
          const updated = await renameROIScenario(id, name);
          set((state) => ({
            savedScenarios: state.savedScenarios.map((s) => (s.id === id ? updated : s)),
            isLoading:      false,
          }));
        } catch (err) {
          set({
            error:     err instanceof Error ? err.message : 'Failed to rename scenario',
            isLoading: false,
          });
          throw err;
        }
      },

      loadSavedScenario: (scenario) => {
        // Restore inputs from the saved snapshot and re-derive live results.
        set({ inputs: scenario.inputs });
        // computeROI is synchronous-ish (uses setTimeout internally),
        // so call it after set() so inputs are already in the store.
        get().computeROI();
      },

      // ── Utilities ──────────────────────────────────────────────────────

      resetInputs: () => {
        set({
          inputs:    DEFAULT_INPUTS,
          results:   null,
          scenarios: null,
          insight:   'Enter your numbers to generate an AI-powered insight.',
        });
      },

      clearError: () => set({ error: null }),
    }),
    {
      name:    'roi-store',
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist inputs — results are always recomputed from inputs.
      // savedScenarios come from SQLite, not AsyncStorage.
      partialize: (state) => ({ inputs: state.inputs }),
    },
  ),
);

// ─── Standalone initialiser (called by initializeStores) ─────────────────────

export async function initializeROIStore(): Promise<void> {
  return useROIStore.getState().initializeROIStore();
}

// ─── Selectors ─────────────────────────────────────────────────────────────

// These names MUST match the existing exports used by the UI layer.
export const selectROIInputs    = (s: ROIStore): ROIInputs          => s.inputs;
export const selectROIResults   = (s: ROIStore): ROIResults | null   => s.results;
export const selectROIInsight   = (s: ROIStore): string              => s.insight;
export const selectROILoading   = (s: ROIStore): boolean             => s.isLoading;
export const selectROIScenarios = (s: ROIStore): ROIScenarios | null => s.scenarios;

// Extended selectors for the saved-scenarios feature
export const selectSavedROIScenarios    = (s: ROIStore): ROIScenario[] => s.savedScenarios;
export const selectROIScenariosLoading  = (s: ROIStore): boolean        => s.isScenariosLoading;
export const selectROIError             = (s: ROIStore): string | null  => s.error;
