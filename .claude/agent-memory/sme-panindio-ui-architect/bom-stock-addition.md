---
name: BOM-Constrained Stock Addition
description: Patterns for the product Add Stock modal with BOM preflight validation and inline shortage warnings
type: project
---

## BOM Validation Flow (Product Add Stock)

### Files changed
- `src/types/index.ts` — added `BomShortageItem` and `BomValidationResult` interfaces
- `src/utils/bomValidation.ts` — `validateStockAddition(productId, requestedQty): Promise<BomValidationResult>` — queries DB directly (no repo layer) for both `product_ingredients` and `product_raw_materials`
- `src/store/inventory.store.ts` — added `addProductStock(productId, unitsToAdd, notes?)` action
- `src/app/(app)/(tabs)/inventory/[id].tsx` — replaced `handleAddStock` flow with BOM-aware version

### Store action pattern
```typescript
addProductStock: async (productId, unitsToAdd, notes) => {
  // Returns null on success, BomValidationResult when blocked, throws on unexpected error
  // Parses structured JSON from err.message to surface BomValidationResult from DB layer
}
```
Imports from repository: `addProductStock as dbAddProductStock`, `getItemById` (NOT `getInventoryItemById`).

### Screen BOM state pattern
```
bomResult: BomValidationResult | null
bomValidating: boolean
bomDebounceRef: useRef<ReturnType<typeof setTimeout> | null>
```
- `useEffect` on `addStockQty + addStockVisible` → debounced 300ms call to `validateStockAddition`
- Clearing `bomResult` on every `onChangeText` prevents stale warnings
- `closeAddStockModal` resets all four: `visible`, `qty`, `notes`, `bomResult`, `bomValidating`

### BOM warning panel
- `BomWarningPanel` + `BomShortageRow` — file-local memoized components above main screen function
- `isRawMaterial: false` (ingredient) → red dot; `true` (raw material) → amber dot
- Blocked state (maxProducible=0): red border/bg, confirm disabled
- Partial state (0 < maxProducible < requested): amber border/bg, confirm still enabled
- `BomWarningPanel` only renders when `bomResult !== null && !bomResult.isValid`

### bomValidation.ts key note
- Queries DB directly via `getDatabase()` + raw SQL JOINs (not through repository functions)
- `maxProducible = Infinity` when product has no BOM — UI treats this as "no constraint"
- `Math.max(0, maxProducible)` clamps the final value so callers never see negative

### TypeScript patterns
- `...(trimmedNotes !== '' ? [trimmedNotes] : [])` for variadic optional notes arg
- `...(notes !== undefined ? [notes] : [])` in store action for optional arg forwarding
- `BomShortageItem.ingredientId` is reused for raw materials too (stores rawMaterialId there)
