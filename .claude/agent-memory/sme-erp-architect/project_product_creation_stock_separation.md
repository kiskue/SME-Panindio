---
name: Product Creation vs Stock Management Separation
description: ERP-standard separation of item master creation from inventory stock entry — product form no longer includes quantity; initial stock recorded via AddInitialStockSheet using stock_movements ledger
type: project
---

Product creation and stock management are now separated into two distinct operations:

**Why:** ERP best practice (Odoo, SAP B1, QBE). Product creation defines WHAT a product is (name, unit, price, BOM). Initial stock defines HOW MUCH is on hand. These are different concerns and should be different transactions with separate audit records.

**Stock movements infrastructure (migration 019):**
- `stock_movements` table already exists with `StockMovementType` including `'initial'`
- `addStockMovement()` in `stock_movements.repository.ts` is the ONLY correct write path for product stock changes
- `quantity_delta` + `quantity_after` pattern: positive = stock in, negative = stock out
- Explicit BEGIN/COMMIT (never `withTransactionAsync` — deadlocks Expo SQLite serialized queue)

**Changes made:**
- `add.tsx` Yup schema: `quantity` field REMOVED. Products always created with `quantity: 0`.
- `add.tsx` onSubmit: BOM link saving retained, but ingredient pre-flight check and `createProductionLog()` call REMOVED (those belong to the Add Stock production flow, not product creation)
- `add.tsx` post-save: For products, sets `pendingStockItem` state instead of `router.back()` — triggers `AddInitialStockSheet`
- `inventory.store.ts`: New `addInitialStock(productId, productName, quantity, costPrice?, notes?, movedAt?)` action — delegates to `addStockMovement` with `movementType: 'initial'`
- New molecule: `src/components/molecules/AddInitialStockSheet/index.tsx` — bottom sheet with quantity (required), cost price (optional), date (today, display-only), notes (optional)

**UX flow:**
1. User taps FAB → Add Product screen (no quantity field)
2. Fills in name, unit, price, BOM, etc. → Save Item
3. Product created with quantity = 0, BOM links saved
4. AddInitialStockSheet appears automatically
5. User enters opening quantity → Confirm (writes stock_movements row, updates inventory_items.quantity)
6. Or taps Skip → product stays at 0 qty, can add stock later from detail screen

**Key constraint:** `addInitialStock` uses `movementType: 'initial'`. Subsequent restocks (not BOM-driven) should use `movementType: 'restock'`. BOM-driven production continues to use `addProductStock()` in `inventory_items.repository.ts` which writes to `product_stock_additions`.

**How to apply:** When reviewing or building any product creation/edit flow, confirm quantity is never on the creation form. All stock changes must go through `addStockMovement()` or the existing `addProductStock()` / `reduceProductStock()` paths.
