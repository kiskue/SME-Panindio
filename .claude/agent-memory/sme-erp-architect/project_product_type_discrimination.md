---
name: project_product_type_discrimination
description: Product type discrimination feature — manufactured vs ready_to_sell, migration 025, ProductTypeSelectionSheet molecule, conditional BOM in add form.
metadata:
  type: project
---

## Feature: Product Type Discrimination (Migration 025)

**Facts:**
- Migration 025 adds `product_type TEXT NOT NULL DEFAULT 'ready_to_sell'` to `inventory_items`.
- Two valid values: `'manufactured'` (has BOM/recipe) and `'ready_to_sell'` (no recipe, purchased for resale).
- `ProductType = 'manufactured' | 'ready_to_sell'` exported from `src/types/index.ts`.
- Field added to `InventoryItem` as required (non-optional) — pre-025 rows default to `'ready_to_sell'` via DB default and `??` guard in `toDomain()`.

**Why:**
- Production businesses (bakeries, carinderia) need BOM linking for ingredients and raw materials. Resellers buying branded goods should NOT see the BOM UI clutter.
- Separate from `BusinessOperationMode` — even a production business may sell some ready-to-sell products alongside manufactured ones (e.g., a bakery that also sells canned drinks).

**Architecture:**
- `ProductTypeSelectionSheet` molecule (`src/components/molecules/ProductTypeSelectionSheet/index.tsx`) — full-screen-height bottom sheet with two large option cards (ChefHat icon for manufactured, ShoppingBag for ready_to_sell). Accepts `visible/onClose/onConfirm(productType)` props.
- Selection sheet is shown from the FAB in `CategoryInventoryScreen` only when `category === 'product'`. Non-product categories (ingredient, equipment) navigate directly to `add`.
- `productType` is passed as a URL param to `/(app)/(tabs)/inventory/add?productType=manufactured`.
- In `add.tsx`, `initialProductType` is derived from the URL param (`'manufactured'` or `'ready_to_sell'`).
- BOM sections (IngredientSelector + RawMaterialSelector) are shown only when `showProduction && initialProductType === 'manufactured'`.
- A `ProductTypeBadge` read-only banner appears at the top of the form to confirm the user's selection.
- `product_type` is written to the DB in `addItem()` via the `product_type` field on `CreateInventoryItemInput`.

**DB/Schema notes:**
- `INVENTORY_ITEM_COLUMNS` includes `'product_type'` between `'sku'` and `'vat_type'` — INSERT param order must match.
- `toDbUpdates()` in `inventory.store.ts` maps `productType → product_type` for updates.
- Compound index `idx_inventory_items_product_type ON inventory_items (category, product_type)` created by migration 025.

**How to apply:**
- When editing the `[id].tsx` detail/edit screen, gate BOM section changes on `item.productType === 'manufactured'`.
- When the user wants to change product type post-creation, update via `updateItem({ productType: 'manufactured' })` — no migration needed, it's a regular column update.
- The `ProductTypeSelectionSheet` resets its `selectedType` to `undefined` on close, so it is stateless between opens.
