---
name: Reduce Stock Feature
description: Architecture and business rules for the Reduce Stock feature on product inventory items — atomic transaction, ingredient/raw-material returns, audit log.
type: project
---

## Feature: Reduce Stock (implemented 2026-03-19)

Product stock quantity is now managed exclusively via two explicit stock actions — never via direct form edit. The edit form's quantity field was made read-only.

### Quantity is read-only on the edit form
- Removed `quantity` from the Yup schema in `src/app/(app)/(tabs)/inventory/[id].tsx`
- Removed `quantity` from `onSubmit` payload to `updateItem`
- Replaced `FormField name="quantity"` with a read-only display pill showing current stock
- Business rule: stock changes must go through Add Stock (production) or Reduce Stock actions only

### Reduce Stock Flow (atomic SQLite transaction) — updated 2026-03-19
Repository function: `reduceProductStock()` in `database/repositories/inventory_items.repository.ts`

Function signature (updated):
```
reduceProductStock(productId, productName, quantityToReduce, reason, ingredients, rawMaterials, notes?)
```
NOTE: `productName` and `quantityToReduce` were reordered (productName now 2nd, reason is 4th) when `reason` was added.

`reason: StockReductionReason` controls the branch logic:
- `'correction'`: `isReturn = true` — stock is returned to ingredients and raw materials
- all others (`waste`, `damage`, `expiry`, `other`): `isReturn = false` — audit-only logs, no stock change

Transaction steps (all-or-nothing):
1. Decrement `inventory_items.quantity` for the product (clamped at MAX 0)
2. Write `stock_reduction_logs` row with `item_type = 'product'`
3a. (isReturn) For each linked ingredient: increment `inventory_items.quantity` + write `ingredient_consumption_logs` with `trigger_type = 'RETURN'`
3b. (not isReturn) For each linked ingredient: write `ingredient_consumption_logs` with `trigger_type = 'WASTAGE'` — NO quantity update
4a. (isReturn) For each linked raw material: increment `raw_materials.quantity_in_stock` + write `raw_material_consumption_logs` with `reason = 'adjustment'`
4b. (not isReturn) For each linked raw material: write `raw_material_consumption_logs` with `reason = 'waste'` — NO quantity update

Pre-flight validation: throws if `quantityToReduce > current.quantity` (checked before opening transaction)

### StockReductionReason type
`src/types/stock_reduction_logs.types.ts`:
```ts
export type StockReductionReason = 'correction' | 'waste' | 'damage' | 'expiry' | 'other';
```
`'waste'` was added in 2026-03-19 session. `reduceIngredientStock` also updated to include `'waste'` in the WASTAGE trigger condition.

### Store action
`reduceStock(productId, productName, quantityToReduce, reason, ingredients, rawMaterials, notes?)` on `useInventoryStore`:
- Signature matches repository (productName 2nd, reason 4th)
- Calls repository, then patches the Zustand in-memory cache for the product
- Ingredient cache patched only when `ingredientsReturned.length > 0` (correction only)
- Raw material cache refreshed via `initializeRawMaterials()` (called from the UI layer)

### UI
- Two buttons shown side-by-side in the hero section for `category === 'product'` items: "Add Stock" (blue) and "Reduce Stock" (red)
- Reduce Stock modal: quantity input + reason picker (GenericPickerModal) + optional notes field
- `reduceStockReason` state (default `'correction'`), `reduceStockReasonVisible` state
- Hint text: "Correction returns linked ingredients to inventory. Damage, Waste, Expiry, and Other write audit logs only."
- Product Reduce reason picker registered as separate `GenericPickerModal` after the ingredient reduce reason picker in JSX
- `REDUCTION_REASON_OPTIONS` updated to 5 entries: correction / waste / damage / expiry / other
- Reset `reduceStockReason` to `'correction'` on modal close/cancel/confirm
- Notes field prefills `"Stock reduction: {qty} {unit} of {name}"` when left blank
- Over-stock guard: `Alert` fires before the async call if qty > available stock

### Ingredient Add/Reduce Stock (implemented 2026-03-19)

Ingredients are leaf-level inventory — no sub-ingredient unwinding when reducing.

**`addIngredientStock(ingredientId, quantity, notes?)`** in repository:
- Increments `inventory_items.quantity` for the ingredient
- Writes `ingredient_consumption_logs` row: `trigger_type = 'RETURN'`, `reference_type = 'manual_stock_addition'`, positive `quantity_consumed` = units added back

**`reduceIngredientStock(ingredientId, ingredientName, quantity, reason, notes?)`** in repository:
- Pre-flight: throws if `quantity > current.quantity`
- Atomic transaction:
  1. Decrements `inventory_items.quantity` (clamped at MAX 0)
  2. Writes `ingredient_consumption_logs` row: `trigger_type = 'MANUAL_ADJUSTMENT'`, `reference_type = 'manual_stock_reduction'`
  3. Writes `stock_reduction_logs` row (reuses `product_id`/`product_name` columns with ingredient id/name)
- Returns `IngredientStockResult { newQuantity }`

**Store actions** on `useInventoryStore`: `addIngredientStock` and `reduceIngredientStock` — both call repo then patch Zustand cache.

**UI changes in `[id].tsx`**:
- Added `REDUCTION_REASON_OPTIONS` constant (correction/damage/expiry/other)
- Ingredient hero section shows its own Add Stock (green) + Reduce Stock (red) buttons, separate from the product buttons
- Ingredient Add Stock modal: quantity (decimal-pad) + optional notes, writes RETURN log
- Ingredient Reduce Stock modal: quantity + reason picker (GenericPickerModal reuse) + optional notes
- All state variables prefixed `ing` to avoid collision with product modal state: `ingAddStockVisible`, `ingReduceVisible`, `ingReduceReason`, `ingReduceReasonVisible`, etc.
- `ingReduceStyles` StyleSheet for the reason picker trigger element
- `handleIngAddStock` and `handleIngReduceStock` callbacks use rest-arg spread for optional `notes` to satisfy `exactOptionalPropertyTypes`

### Key files
- `database/repositories/inventory_items.repository.ts` — `reduceProductStock()`, `addIngredientStock()`, `reduceIngredientStock()`, `IngredientStockResult`
- `src/store/inventory.store.ts` — `reduceStock`, `addIngredientStock`, `reduceIngredientStock` actions
- `src/app/(app)/(tabs)/inventory/[id].tsx` — read-only qty display, product+ingredient stock action buttons and modals

**Why:** ERP best practice — stock levels must be traceable via movement audit logs, not mutable fields.
**How to apply:** Never add quantity as an editable field on any category's edit form. All stock changes go through dedicated stock action flows that write audit rows.
