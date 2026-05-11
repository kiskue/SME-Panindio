---
name: Sales Target Module
description: Architecture decisions for the income-based sales target feature (migration 023, singleton table, dashboard card, bottom sheet molecule, Zustand store)
type: project
---

Migration 023 creates a `sales_targets` singleton table (id = 1 always) seeded by the migration so all writes are UPDATE-only. No schema drift possible.

**Why:** The user wants to set a daily net income goal and see how many units to sell, plus track actual daily/weekly/monthly progress vs target.

**How to apply:** When extending the sales target feature, always use `saveSalesTarget()` from `sales_targets.repository.ts` (INSERT OR CONFLICT UPDATE). Never INSERT a second row.

## Key design decisions

- **Singleton row pattern**: `id = 1` seeded by migration. All writes use `INSERT ... ON CONFLICT DO UPDATE`. The store's `loadFromDB()` always calls `getFirstAsync` with `WHERE id = 1`.

- **Net income per unit resolution priority**:
  1. If `targetProductId` is set and product has both `price` and `costPrice`: use `price - costPrice`.
  2. Fallback: blended `(totalRevenue - totalCOGS) / unitsSoldToDate` from `useBusinessROIStore.getState()`.
  3. Returns 0 if no data available (prevents division by zero).

- **Progress calculation formula**: `actual = revenue - ingredientCost - rawMaterialCost` for a date range. Mirrors the P&L formula in the dashboard store. Uses `date(created_at)` / `date(consumed_at)` comparisons for daily/weekly/monthly windows.

- **Initialization order**: `initializeSalesTarget()` is called AFTER `initializeStores()` in `_layout.tsx` because it reads from `business_roi.store` (via `getState()`, not hooks). It is wrapped in a non-fatal `.catch()` so a DB failure does not block app startup.

- **NOT in `initializeStores()`**: Same pattern as `business_roi.store`. Depends on other stores being hydrated first.

- **Dashboard placement**: `SalesTargetCard` is inserted between the P&L Waterfall and the Trend Chart in `index.tsx`. Progress is reloaded via `useFocusEffect` on every tab focus so it stays fresh after POS sales.

- **Bottom sheet target**: `SalesTargetSetupSheet` (molecule) is rendered inside a `BottomSheet` organism inside `SalesTargetCard`. The card owns the `sheetVisible` state — no external ref needed.

## File paths
- Migration: `database/migrations/023_add_sales_targets.ts`
- Repository: `database/repositories/sales_targets.repository.ts`
- Store: `src/store/sales_target.store.ts`
- Molecule: `src/components/molecules/SalesTargetSetupSheet/index.tsx`
- Organism: `src/components/organisms/SalesTargetCard.tsx`
- Types added to: `src/types/index.ts` (SalesTarget, SalesTargetProgressPeriod, SalesTargetProgress)
- Store exports: `src/store/index.ts`
- Wired into dashboard: `src/app/(app)/(tabs)/index.tsx`
- Initialized in: `src/app/_layout.tsx`

## Business rules
- `weeklyTarget = dailyTarget × 7`, `monthlyTarget = dailyTarget × 30`
- `unitsNeededPerDay = ceil(dailyTarget / netIncomePerUnit)`
- `percentage` is capped at 100 for progress bar display
- `isConfigured = dailyTarget > 0`
- Empty state card shown when not configured; full card with progress bar when configured
