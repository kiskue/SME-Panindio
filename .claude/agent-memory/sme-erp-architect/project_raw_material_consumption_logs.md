---
name: Raw Material Consumption Logs Module
description: Architecture for raw_material_consumption_logs screen, store, repository query functions, card component, and navigation wiring.
type: project
---

## What was built

Full consumption log viewer for the Raw Materials module, mirroring the ingredient-logs screen design.

### Files created/modified
- `database/repositories/raw_materials.repository.ts` — added `getRawMaterialConsumptionLogs`, `getRawMaterialConsumptionLogCount`, `getRawMaterialConsumptionSummary`, `getRawMaterialConsumptionTrend` (gap-filled, always emits `days` entries)
- `src/types/raw_materials.types.ts` — added `RawMaterialConsumptionLogDetail`, `RawMaterialConsumptionSummary`, `RawMaterialConsumptionTrend`, `GetRawMaterialLogsOptions` (auto-added by linter, now source of truth for these types)
- `src/types/index.ts` — re-exports the four new types from raw_materials.types.ts
- `src/store/raw_material_consumption_logs.store.ts` — new Zustand store; selectors: `selectRawMaterialLogs`, `selectRawMaterialLogSummary`, `selectRawMaterialLogTrend`, `selectRawMaterialLogFilters`, `selectRawMaterialLogHasMore`, `selectRawMaterialLogLoading`, `selectRawMaterialLogLoadingMore`, `selectRawMaterialLogError`, `selectRawMaterialLogTotalCount`
- `src/store/index.ts` — exports new store and types
- `src/components/molecules/RawMaterialConsumptionLogCard/index.tsx` — card molecule
- `src/app/(app)/(tabs)/inventory/raw-materials/logs.tsx` — consumption log screen
- `src/app/(app)/(tabs)/inventory/raw-materials/index.tsx` — added ClipboardList "View Logs" icon button
- `src/app/(app)/(tabs)/_layout.tsx` — added route title `/inventory/raw-materials/logs` = 'Usage Logs'

## Key design decisions

### Types live in @/types, not in repository
The linter moves enriched repository types (Detail, Summary, Trend) to `src/types/raw_materials.types.ts` and imports them back into the repository. Future enriched query return types for raw materials should follow this pattern.

### `RawMaterialConsumptionLogDetail` field name
Uses `rawMaterialName` (not `ingredientName` or `materialName`). Matches the `RawMaterialConsumptionLogDetail` definition in `raw_materials.types.ts`.

### `getRawMaterialConsumptionTrend` gap-fills
The trend function always returns exactly `days` entries (zeroed out for days with no data). The bar chart does not need gap-fill logic in the UI layer.

### `getRawMaterialConsumptionSummary` takes no filters
The current implementation aggregates across all recorded events. If date-range filtering is needed in future, add optional `fromDate`/`toDate` params following the ingredient_consumption_logs.repository pattern.

### Filters shape
`RawMaterialLogFilters = { reason?: RawMaterialReason }`. Only reason filter is wired currently. Date-range filters can be added by extending the shape and updating `fetchPage`/`fetchSupportingData` in the store.

### Production logging — IMPLEMENTED
`createProductionLog` in `production_logs.repository.ts` now:
1. Fetches `product_raw_materials` links BEFORE opening the transaction (no nested tx).
2. Calls `batchDeductRawMaterialsInTx(db, inputs, now)` inside the same `withTransactionAsync` block — deducts stock and writes `raw_material_consumption_logs` rows with `reason='production'`, `reference_id=productionLogId`.
3. `batchDeductRawMaterialsInTx` is exported from `raw_materials.repository.ts` and accepts an open `SQLiteDatabase` handle.

The in-transaction helper follows the same pattern as `batchInsertConsumptionLogsInTx` in `ingredient_consumption_logs.repository.ts`.

**No-nested-transaction rule enforced:** SELECT for raw material links runs before `withTransactionAsync`, not inside it.

## Product form — raw material linking (Add Product screen)

### Files created/modified
- `src/components/organisms/RawMaterialSelector.tsx` — new organism, mirrors IngredientSelector but without unit conversion chips. Reads from `useRawMaterialsStore(selectRawMaterials)`. Emits `SelectedRawMaterial[]`. Accent color: amber (`#F59E0B` dark / `theme.colors.highlight[500]` light).
- `src/app/(app)/(tabs)/inventory/add.tsx` — added `selectedRawMaterials` state, `handleRawMaterialsChange` callback, `setProductRawMaterials` call in onSubmit, `initializeRawMaterials` refresh after production. Import: `setProductRawMaterials` from `raw_materials.repository`.

### Design decisions
- No unit conversion in RawMaterialSelector. `RawMaterialUnit` is the canonical unit; recipe quantities are always in that unit. This is correct because raw materials (packaging, rolls, etc.) don't have weight/volume dimensions.
- `costPrice` auto-fill now sums both ingredient cost AND raw material cost.
- `setProductRawMaterials` is called only when `selectedRawMaterials.length > 0`. `consumeIngredients` is called only when `selectedIngredients.length > 0` (both guards prevent empty-loop repository calls).
- The production log outer condition was broadened: fires when `selectedIngredients.length > 0 || selectedRawMaterials.length > 0` (previously required ingredients).
- Raw material stock refresh (`initializeRawMaterials`) is fire-and-forget, not awaited, so it doesn't block navigation.

## Navigation
Route: `/(app)/(tabs)/inventory/raw-materials/logs`
Access: ClipboardList icon button in the raw-materials list header (top right, left of "New Material").
