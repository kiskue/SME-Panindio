/**
 * target_sales_allocation.store.ts
 *
 * Zustand v5 store for the Target Sales Unit Allocation feature.
 *
 * Responsibilities:
 *   - Holds the user's selected products, total target units, and target date.
 *   - Runs the allocation algorithm (even / weighted / smart) and stores
 *     the computed ProductTarget[] in state.
 *   - Persists the final plan to SQLite via target_sales.repository.ts
 *     (normalised target_sales_plans + target_sales_items tables from
 *     migration 024).
 *   - Loads all saved plans from SQLite into savedPlans on init.
 *   - Exposes a soft-delete action for removing saved plans.
 *
 * Algorithm selection (delegated to targetSalesAllocation.ts):
 *   - targetDate > today AND prior sales exist   → 'SMART_NEXT_DAY'
 *   - targetDate <= today AND prior sales exist  → 'WEIGHTED'
 *   - no prior sales (all-zero history)          → 'EVEN'
 *   - only 1 product selected                    → 'EVEN'
 *
 * Previous-day sales source:
 *   `computeAllocations` fetches the most recent daily_sales_summary rows
 *   (via getPreviousDaySalesSummary) and builds the weight map.
 *   This is the ONLY place in the store that reads from the DB — the rest
 *   of state is derived in-memory from the already-loaded data.
 *
 * Design decisions:
 *   - NOT added to initializeStores() because allocation planning is an
 *     on-demand action, not a background initialisation task. The screen
 *     calls initializeTargetSalesAllocation() on mount.
 *   - `isComputing` guards the async allocation run (DB fetch + algorithm).
 *   - `isSaving` guards the DB write (createTargetSalesPlan + replaceTargetSalesItems).
 *   - `savedPlans` is loaded on init and updated optimistically on save/delete.
 *   - Strategy label maps 'even'→'EVEN', 'weighted'→'WEIGHTED', 'smart'→'SMART_NEXT_DAY'
 *     to match the DB enum stored in target_sales_plans.strategy.
 *
 * TypeScript strict-mode compliance:
 *   - exactOptionalPropertyTypes: no undefined passed to optional props.
 *   - noUncheckedIndexedAccess: all array index accesses guarded with ?? fallbacks.
 *   - noUnusedLocals/Parameters: unused params prefixed with _.
 */

import { create } from 'zustand';
import {
  computeTargetSalesAllocation,
} from '../core/utils/targetSalesAllocation';
import {
  createTargetSalesPlan,
  getTargetSalesPlanByDate,
  getTargetSalesPlans,
  deleteTargetSalesPlan,
  replaceTargetSalesItems,
  getPreviousDaySalesSummary,
  updateTargetSalesPlan,
} from '@/database/repositories/target_sales.repository';
import type {
  InventoryItem,
  ProductTarget,
  AllocationStrategy,
  TargetSalesPlanRecord,
  TargetSalesItemRecord,
} from '@/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns today's date as "YYYY-MM-DD" in the device's local time zone.
 */
function todayYMD(): string {
  const d   = new Date();
  const y   = d.getFullYear();
  const m   = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Maps the AllocationStrategy union ('even' | 'weighted' | 'smart') to the
 * uppercase DB enum stored in target_sales_plans.strategy.
 */
function strategyToDbEnum(
  strategy: AllocationStrategy,
): 'EVEN' | 'WEIGHTED' | 'SMART_NEXT_DAY' {
  if (strategy === 'weighted') return 'WEIGHTED';
  if (strategy === 'smart')    return 'SMART_NEXT_DAY';
  return 'EVEN';
}

/**
 * Converts allocation weight for a product into a 0-1 normalised fraction.
 * Weight is the proportion of this product's allocated units vs the total.
 * Returns 0 when totalUnits is 0 (avoids division by zero on empty plans).
 */
function computeWeight(allocatedUnits: number, totalUnits: number): number {
  if (totalUnits <= 0) return 0;
  return allocatedUnits / totalUnits;
}

// ─── State shape ──────────────────────────────────────────────────────────────

export interface TargetSalesAllocationState {
  // ── Setup inputs (controlled by the user) ─────────────────────────────────
  /** Products the user has selected for this plan. */
  selectedProducts:  InventoryItem[];
  /** Total units the user wants to sell across all selected products. */
  totalTargetUnits:  number;
  /** "YYYY-MM-DD" date this plan is targeting. Defaults to today. */
  targetDate:        string;

  // ── Computed outputs ──────────────────────────────────────────────────────
  /** Allocation results — one entry per selectedProducts element. */
  allocations:       ProductTarget[];
  /** Which strategy produced the current allocations. */
  strategy:          AllocationStrategy;
  /**
   * True when the allocations are stale relative to the inputs.
   * Set to true whenever selectedProducts / totalTargetUnits / targetDate
   * changes; cleared when computeAllocations completes successfully.
   */
  isStale:           boolean;

  // ── Persisted plans (loaded on init) ─────────────────────────────────────
  savedPlans:        TargetSalesPlanRecord[];
  /**
   * Items for the most recently loaded plan, keyed by planId.
   * Populated after saveTargetSales() completes so the confirmation screen
   * can render the saved line items without a second DB read.
   */
  lastSavedItems:    TargetSalesItemRecord[];

  // ── Status ────────────────────────────────────────────────────────────────
  isLoading:    boolean;
  isComputing:  boolean;
  isSaving:     boolean;
  error:        string | null;

  // ── Actions ───────────────────────────────────────────────────────────────

  /** Replaces the selected product list and marks allocations stale. */
  setSelectedProducts: (products: InventoryItem[]) => void;

  /** Updates the total unit target and marks allocations stale. */
  setTotalTargetUnits: (units: number) => void;

  /** Updates the target date and marks allocations stale. */
  setTargetDate: (date: string) => void;

  /**
   * Fetches previous-day sales history from SQLite, runs the allocation
   * algorithm, and stores results in state.
   * Guards against concurrent calls with isComputing.
   */
  computeAllocations: () => Promise<void>;

  /**
   * Persists the current allocation plan to SQLite.
   * - If a live plan already exists for targetDate it is updated in-place
   *   (items are replaced atomically via replaceTargetSalesItems).
   * - If no plan exists for targetDate a new one is created.
   * - Calls computeAllocations first when allocations are stale.
   * - On success, prepends the saved plan to savedPlans (optimistic update).
   */
  saveTargetSales: () => Promise<void>;

  /** Loads all non-deleted saved plans from SQLite into savedPlans. */
  loadTargetSales: () => Promise<void>;

  /**
   * Soft-deletes a saved plan by id.
   * Removes it from savedPlans immediately (optimistic) then issues the DB call.
   */
  deletePlan: (id: string) => Promise<void>;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useTargetSalesAllocationStore = create<TargetSalesAllocationState>()(
  (set, get) => ({
    // ── Initial state ────────────────────────────────────────────────────────
    selectedProducts: [],
    totalTargetUnits: 0,
    targetDate:       todayYMD(),
    allocations:      [],
    strategy:         'even',
    isStale:          false,
    savedPlans:       [],
    lastSavedItems:   [],
    isLoading:        false,
    isComputing:      false,
    isSaving:         false,
    error:            null,

    // ── Actions ──────────────────────────────────────────────────────────────

    setSelectedProducts: (products) => {
      set({ selectedProducts: products, isStale: true, error: null });
    },

    setTotalTargetUnits: (units) => {
      set({ totalTargetUnits: Math.max(0, units), isStale: true, error: null });
    },

    setTargetDate: (date) => {
      set({ targetDate: date, isStale: true, error: null });
    },

    computeAllocations: async () => {
      const { selectedProducts, totalTargetUnits, targetDate, isComputing } = get();

      if (isComputing) return;

      if (selectedProducts.length === 0) {
        set({ allocations: [], strategy: 'even', isStale: false, error: null });
        return;
      }

      if (totalTargetUnits <= 0) {
        set({
          error: 'Total target units must be at least 1.',
          isStale: false,
        });
        return;
      }

      set({ isComputing: true, error: null });

      try {
        // Fetch the most recent day with actual sales from daily_sales_summary
        const prevSummaries = await getPreviousDaySalesSummary(targetDate);

        // Build the previousDaySales record: productId → unitsSold
        const previousDaySales: Record<string, number> = {};
        for (const summary of prevSummaries) {
          previousDaySales[summary.productId] = summary.unitsSold;
        }

        const targetDateObj = new Date(targetDate);

        const { allocations, strategy } = computeTargetSalesAllocation({
          products:         selectedProducts,
          totalTargetUnits,
          previousDaySales,
          targetDate:       targetDateObj,
        });

        set({ allocations, strategy, isStale: false, isComputing: false });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to compute allocations.';
        set({ isComputing: false, error: message });
      }
    },

    saveTargetSales: async () => {
      const {
        selectedProducts,
        totalTargetUnits,
        targetDate,
        allocations,
        strategy,
        isStale,
        isSaving,
      } = get();

      if (isSaving) return;

      if (selectedProducts.length === 0) {
        set({ error: 'Select at least one product before saving.' });
        return;
      }
      if (totalTargetUnits <= 0) {
        set({ error: 'Total target units must be at least 1.' });
        return;
      }

      set({ isSaving: true, error: null });

      try {
        // Ensure allocations are fresh before persisting
        let currentAllocations = allocations;
        let currentStrategy    = strategy;

        if (isStale || allocations.length === 0) {
          await get().computeAllocations();
          currentAllocations = get().allocations;
          currentStrategy    = get().strategy;

          // Abort if computeAllocations set an error
          if (get().error !== null) {
            set({ isSaving: false });
            return;
          }
        }

        const dbStrategy = strategyToDbEnum(currentStrategy);

        // Check for an existing plan on this date
        const existingPlan = await getTargetSalesPlanByDate(targetDate);

        let planId: string;

        if (existingPlan !== null) {
          // Update the header
          await updateTargetSalesPlan(existingPlan.id, {
            total_target_units: totalTargetUnits,
            strategy:           dbStrategy,
            status:             'DRAFT',
          });
          planId = existingPlan.id;
        } else {
          // Create a new plan header
          const created = await createTargetSalesPlan({
            plan_date:          targetDate,
            total_target_units: totalTargetUnits,
            strategy:           dbStrategy,
            status:             'DRAFT',
          });
          planId = created.id;
        }

        // Replace all items atomically
        const itemInputs = currentAllocations.map((alloc) => ({
          plan_id:         planId,
          product_id:      alloc.productId,
          product_name:    alloc.productName,
          allocated_units: alloc.targetUnits,
          weight:          computeWeight(alloc.targetUnits, totalTargetUnits),
        }));

        const savedItems = await replaceTargetSalesItems(planId, itemInputs);

        // Reload saved plans to keep the list in sync
        const updatedPlans = await getTargetSalesPlans();

        set({
          savedPlans:     updatedPlans,
          lastSavedItems: savedItems,
          isSaving:       false,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to save target sales plan.';
        set({ isSaving: false, error: message });
      }
    },

    loadTargetSales: async () => {
      if (get().isLoading) return;
      set({ isLoading: true, error: null });
      try {
        const plans = await getTargetSalesPlans();
        set({ savedPlans: plans, isLoading: false });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load saved plans.';
        set({ isLoading: false, error: message });
      }
    },

    deletePlan: async (id) => {
      // Optimistic removal
      set((state) => ({
        savedPlans: state.savedPlans.filter((p) => p.id !== id),
      }));
      try {
        await deleteTargetSalesPlan(id);
      } catch (err) {
        // Reload to restore consistent state on failure
        const message = err instanceof Error ? err.message : 'Failed to delete plan.';
        set({ error: message });
        // Reload so the item reappears if the delete failed
        const plans = await getTargetSalesPlans();
        set({ savedPlans: plans });
      }
    },
  }),
);

// ─── Selectors ────────────────────────────────────────────────────────────────

export const selectSelectedProducts =
  (s: TargetSalesAllocationState): InventoryItem[]         => s.selectedProducts;

export const selectTotalTargetUnits =
  (s: TargetSalesAllocationState): number                  => s.totalTargetUnits;

export const selectTargetAllocationDate =
  (s: TargetSalesAllocationState): string                  => s.targetDate;

export const selectTargetSalesAllocations =
  (s: TargetSalesAllocationState): ProductTarget[]         => s.allocations;

export const selectAllocationStrategy =
  (s: TargetSalesAllocationState): AllocationStrategy      => s.strategy;

export const selectAllocationsStale =
  (s: TargetSalesAllocationState): boolean                 => s.isStale;

export const selectSavedPlans =
  (s: TargetSalesAllocationState): TargetSalesPlanRecord[] => s.savedPlans;

export const selectLastSavedItems =
  (s: TargetSalesAllocationState): TargetSalesItemRecord[] => s.lastSavedItems;

export const selectAllocationLoading =
  (s: TargetSalesAllocationState): boolean                 => s.isLoading;

export const selectAllocationComputing =
  (s: TargetSalesAllocationState): boolean                 => s.isComputing;

export const selectAllocationSaving =
  (s: TargetSalesAllocationState): boolean                 => s.isSaving;

export const selectAllocationError =
  (s: TargetSalesAllocationState): string | null           => s.error;

/** True when there are products selected and a non-zero unit target. */
export const selectAllocationReady =
  (s: TargetSalesAllocationState): boolean =>
    s.selectedProducts.length > 0 && s.totalTargetUnits > 0;

/** True when allocations have been computed and are not stale. */
export const selectAllocationsComputed =
  (s: TargetSalesAllocationState): boolean =>
    s.allocations.length > 0 && !s.isStale;

// ─── Initializer ──────────────────────────────────────────────────────────────

/**
 * Loads all saved plans from SQLite and sets the target date to today.
 * Call from the screen's useEffect on mount.
 *
 * NOT included in initializeStores() because allocation planning is an
 * on-demand action. The screen initialises this store when the user navigates
 * to the target sales screen.
 */
export async function initializeTargetSalesAllocation(): Promise<void> {
  const store = useTargetSalesAllocationStore.getState();
  store.setTargetDate(todayYMD());
  await store.loadTargetSales();
}
