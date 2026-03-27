---
name: BOM-Constrained Stock Addition
description: Design decisions for the BOM availability validation system that blocks product stock additions when ingredients/raw materials are insufficient
type: project
---

Migration 018 introduces `product_stock_additions` — an immutable audit table for every product stock-in event. The direct `updateItem(id, { quantity: item.quantity + qty })` pattern in `[id].tsx` handleAddStock is a known gap (mutable write, no event record).

**Why:** ERP requires an immutable stock-in ledger (GRN equivalent). Direct quantity mutation gives no traceability.

**How to apply:** When implementing the stock-add handler, always write to `product_stock_additions` AND update `inventory_items.quantity` in the same transaction.

## Key design decisions

### No new BOM tables needed
`product_ingredients` + `product_raw_materials` together constitute the BOM. The feature does not add a separate BOM versioning table — that is future scope.

### Validation is synchronous (in-memory)
`validateBOMAvailability()` in `src/utils/bomValidation.ts` is a pure synchronous function — it reads from Zustand store state (items + rawMaterials), not from SQLite. BOM line data (per-ingredient quantities) requires an async DB read via `getProductIngredients()` on modal open, not on every keystroke.

### Hard block, not advisory
The confirm button is DISABLED when `!canProduce`. This replaces the "Add Anyway" advisory pattern from `runPreflightCheck` in `add.tsx`. The `add.tsx` advisory check is follow-on scope (not in scope for migration 018).

### maxProducible calculation
```
For each ingredient i:
  convertedPerUnit = convertUnit(quantityUsed, unit, stockUnit)
  maxFromThisIng   = floor(currentStock / convertedPerUnit)

For each raw material r:
  maxFromThisRM    = floor(quantityInStock / quantityRequired)

maxProducible = min over all constraints
```
- No BOM (no ingredients, no raw materials): maxProducible = Infinity, hasBOM = false — no constraint panel shown.
- Sentinel for no-BOM in DB: `max_producible = -1` (REAL column, -1 means unconstrained).

### No-nested-transaction rule applies
`addProductStock()` in `inventory_items.repository.ts` must inline all SQL (ingredient deductions, production log, raw material deductions, product qty update, stock_additions insert) inside a single `withTransactionAsync`. Do NOT call `consumeIngredients()` or `createProductionLog()` from inside another `withTransactionAsync` — they use their own transactions internally which causes deadlock in expo-sqlite.

### Raw material unit mismatch gap
`product_raw_materials` has no `stock_unit` column (unlike `product_ingredients` which has `stock_unit` from migration 006). Validation treats `product_raw_materials.unit` as the stock unit — same assumption `createProductionLog` makes. A future migration 019 should add `stock_unit` to `product_raw_materials` to enable proper UOM conversion.

### BOM data loading strategy
Load `getProductIngredients()` + `getRawMaterialsByProduct()` lazily when the Add Stock modal opens (Option A). Do NOT pre-load on every product detail screen mount (Option B) — too expensive.

### `handleAddStock` migration
Current `[id].tsx` handleAddStock calls `updateItem`, `consumeIngredients`, `createProductionLog`, `initializeInventory`, `initializeRawMaterials` sequentially from the screen. New version: call a single `store.addProductStock()` action that handles all of this — consistent with the `reduceStock` store action pattern.

### `parseFloat` not `parseInt`
Change `parseInt(addStockQty, 10)` to `parseFloat(addStockQty)` to support fractional quantities (e.g. 2.5 kg of bulk products).

## New files
- `database/migrations/018_add_product_stock_additions.ts`
- `database/schemas/product_stock_additions.schema.ts`
- `src/utils/bomValidation.ts`
- `src/components/molecules/BOMConstraintPanel/index.tsx`
- New types: `BOMLineShortfall`, `BOMValidationResult`, `CreateProductStockAdditionInput` in `src/types/index.ts`

## Modified files
- `database/repositories/inventory_items.repository.ts` — add `addProductStock()`
- `src/store/inventory.store.ts` — add `addProductStock` action
- `src/app/(app)/(tabs)/inventory/[id].tsx` — replace handleAddStock
- `src/components/molecules/index.ts` — export BOMConstraintPanel
- `database/initDatabase.ts` — import migration018
