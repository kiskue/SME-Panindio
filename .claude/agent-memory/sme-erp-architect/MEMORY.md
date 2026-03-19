# SME ERP Architect — Agent Memory Index

## Project Modules

- [Ingredient Consumption Logs](./project_ingredient_consumption.md) — Architecture decisions for the immutable consumption audit ledger (migration 004), integration with production logs, no-nested-transaction rule, pagination pattern, exactOptionalPropertyTypes filter spread pattern.
- [POS Module](./project_pos_module.md) — Schema (migration 007), sales.repository patterns, pos.store cart/checkout design, CartItem field names, screen wiring notes (stub→real store migration).
- [Raw Material Consumption Logs](./project_raw_material_consumption_logs.md) — repository query functions, new store/screen/card, `rawMaterialName` field convention, production logging gap, types in @/types pattern.
- [Reduce Stock Feature](./project_reduce_stock.md) — Read-only quantity on edit form, atomic `reduceProductStock()` transaction (ingredient + raw material returns), `reduceStock` store action, ingredient `addIngredientStock`/`reduceIngredientStock` (no unwinding), audit log conventions, ingredient reason picker UI pattern.
- [Overhead Expenses Module](./project_overhead_expenses.md) — Migration 014, immutable append-only ledger, frequency uses `one_time` (underscore), dashboard KPIs via repository Promise.all (not separate store subscription), stale draft files deleted (overhead.store.ts + overhead.types.ts), Quick Actions wired to overhead screen.
