---
name: project-target-sales-allocation
description: Multi-product unit allocation feature — algorithm, store, DB schema, and repo for target_sales_plans + target_sales_items + daily_sales_summary
metadata:
  type: project
---

## Target Sales Allocation Module

Migration 024 (`database/migrations/024_add_target_sales.ts`) creates three tables:
- `target_sales_plans` — plan header (plan_date UNIQUE WHERE deleted_at IS NULL, strategy enum 'EVEN'|'WEIGHTED'|'SMART_NEXT_DAY', status 'DRAFT'|'ACTIVE'|'COMPLETED')
- `target_sales_items` — per-product allocations (allocated_units, weight 0-1, actual_units_sold)
- `daily_sales_summary` — historical aggregates keyed on (summary_date, product_id); source data for the weighting algorithm

**Domain types added to `src/types/index.ts`:**
- `TargetSalesPlanRecord`, `TargetSalesItemRecord`, `DailySalesSummaryRecord` — normalised DB records
- `AllocationStrategy` = `'even' | 'weighted' | 'smart'` — lowercase in TS, maps to DB uppercase enum
- `ProductTarget` — per-product allocation result (productId, productName, targetUnits, previousDayUnits, multiplier)
- `TargetSalesPlan` — UI-facing plan shape with `products: ProductTarget[]` array
- `TargetSalesAllocationState` — Zustand state contract

**Allocation algorithm (`src/core/utils/targetSalesAllocation.ts`):**
- `allocateUnitsEvenly(products, totalUnits)` — equal weight, largest-remainder rounding
- `allocateUnitsByHistory(products, totalUnits, previousDaySales)` — weighted by prev-day sales, 1-unit reserve per product first
- `allocateUnitsSmartNextDay(products, totalUnits, previousDaySales, targetDate)` — weighted × DoW multiplier (Sun/Sat +10%, Fri +5%, Tue -5%)
- `computeTargetSalesAllocation(params)` — unified entry point; selects strategy based on isNextDay + hasHistory
- Rounding: Largest Remainder Method — guarantees SUM(targetUnits) === totalTargetUnits exactly, no off-by-one
- Minimum 1 unit per product: N units reserved before proportional distribution of (totalUnits - N) remainder

**Repository (`database/repositories/target_sales.repository.ts`):**
- `createTargetSalesPlan`, `getTargetSalesPlanByDate`, `getTargetSalesPlans`, `updateTargetSalesPlan`, `deleteTargetSalesPlan` (soft-delete)
- `replaceTargetSalesItems` — atomic BEGIN/COMMIT pattern (no withTransactionAsync — no-nested-transaction rule)
- `getPreviousDaySalesSummary(beforeDate)` — finds most recent date < beforeDate with summary rows
- `upsertDailySalesSummary` — INSERT … ON CONFLICT DO UPDATE keyed on (summary_date, product_id)

**Zustand store (`src/store/target_sales_allocation.store.ts`):**
- `useTargetSalesAllocationStore`, exported via `src/store/index.ts`
- Key actions: `setSelectedProducts`, `setTotalTargetUnits`, `setTargetDate`, `computeAllocations`, `saveTargetSales`, `loadTargetSales`, `deletePlan`
- `isStale` flag: set true on any input change, cleared after `computeAllocations` completes
- `saveTargetSales` auto-calls `computeAllocations` when stale; upserts plan (creates or updates existing plan for same date)
- NOT in `initializeStores()` — call `initializeTargetSalesAllocation()` on screen mount

**Strategy-to-DB mapping:**
- `'even'` → `'EVEN'`, `'weighted'` → `'WEIGHTED'`, `'smart'` → `'SMART_NEXT_DAY'`

**Why:** Needed multi-product daily unit planning with history-aware weighting for the Sales Target module. The income-based `sales_targets` singleton (migration 023) handles ₱ targets; this handles per-product unit allocation.
