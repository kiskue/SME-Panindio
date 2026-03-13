---
name: Product Ingredients Persistence Pattern
description: After addItem() succeeds, replaceProductIngredients() must be called to persist ingredient links — the two steps are intentionally separate because of the SQLite FK constraint on product_id.
type: project
---

When a user saves a product that has ingredients selected in `IngredientSelector`, `onSubmit` must:
1. Call `addItem(...)` and capture the returned `newItem` (which carries the generated `id`).
2. Only after step 1 succeeds, call `replaceProductIngredients(newItem.id, selectedIngredients.map(...))`.

The FK on `product_ingredients.product_id` references `inventory_items(id)`, so the ingredient links cannot be inserted until the product row exists. This two-step pattern is by design.

**Why:** SQLite FK constraint — inserting into `product_ingredients` before the parent `inventory_items` row exists causes a constraint violation.

**How to apply:** Any add/edit form that deals with product ingredients must follow this two-step sequence. The same applies to any future edit screen (`edit.tsx`) — it should call `replaceProductIngredients` after `updateItem` succeeds.
