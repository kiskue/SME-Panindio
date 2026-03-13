# SME-Panindio Bug Hunter — Memory Index

## Project
- [Product Ingredients Persistence Pattern](./project_ingredient_link_pattern.md) — `replaceProductIngredients` must be called after `addItem` succeeds; two-step by design due to FK constraint.

## Patterns
- [Store Initialization Pattern](./pattern_store_initialization.md) — Every new Zustand store with a bootstrap function must be added to `initializeStores()` in `src/store/index.ts` or it will not be warm-started before screens mount.
- [SQLite JOIN Safety](./pattern_sqlite_left_join.md) — All consumption/audit log queries that JOIN `inventory_items` must use LEFT JOIN; INNER JOIN silently drops rows when items are soft- or hard-deleted.
