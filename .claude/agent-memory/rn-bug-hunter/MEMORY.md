# SME-Panindio Bug Hunter — Memory Index

## Project
- [Product Ingredients Persistence Pattern](./project_ingredient_link_pattern.md) — `replaceProductIngredients` must be called after `addItem` succeeds; two-step by design due to FK constraint.

## Patterns
- [Mark Paid on New Entry](./pattern_mark_paid_new_entry.md) — Use the id returned by `upsertLog`, not `editingLog.id`, when chaining markPaid; `editingLog` is null for new entries and the paid flag is silently skipped otherwise.
- [useState sentinel + fallback effect for late-hydrating store data](./pattern_usestate_late_hydration.md) — When a useState initialiser reads from a Zustand store that may still hydrating, use '' as a sentinel and add a fallback useEffect([types, visible]) to backfill once data arrives.
- [Store Initialization Pattern](./pattern_store_initialization.md) — Every new Zustand store with a bootstrap function must be added to `initializeStores()` in `src/store/index.ts` or it will not be warm-started before screens mount.
- [SQLite JOIN Safety](./pattern_sqlite_left_join.md) — All consumption/audit log queries that JOIN `inventory_items` must use LEFT JOIN; INNER JOIN silently drops rows when items are soft- or hard-deleted.
- [SQLite Migration vs Schema Registry Drift](./pattern_sqlite_migration_schema_drift.md) — Schema registry CREATE TABLE runs before migrations on every launch; ALTER TABLE ADD COLUMN in a migration must not duplicate a column already in the schema file or SQLite crashes with "duplicate column name".
- [Quantity Badge Sign Convention](./pattern_quantity_badge_sign.md) — `quantityConsumed` is negative for RETURN events; check `< 0` first to show `-N`; never use `+` prefix — original code had the ternary inverted.
- [CategoryNavCard count badge wiring](./pattern_category_nav_count_badge.md) — Consumption Logs card in `inventory/index.tsx` had `count={0}` hardcoded; all CategoryNavCard count props must come from store selectors, never literals.
- [Store Action Re-throw Convention](./pattern_store_action_rethrow.md) — Zustand actions awaited from UI try/catch blocks must re-throw after setting error state, or the form's catch block is dead code and always shows success.
- [Consumption Log and Stock Deduction Are Separate Operations](./pattern_consumption_stock_deduction.md) — `createConsumptionLog` only writes an audit row. Any trigger that changes stock must also call `adjustItemQuantity` then sync the inventory store cache.
- [useEffect Initial Prop via Ref Pattern — CORRECTED](./pattern_useeffect_initial_prop_ref.md) — The ref-sync + visibility-effect approach is BROKEN (ref-sync effect runs after the visibility effect in the same commit; ref is stale at read time). Use prevVisibleRef to detect the false→true transition and include the seed prop directly in the dep array.
- [Post-Save Side Effect Isolation](./pattern_post_save_side_effect_isolation.md) — `markPaid` and `loadMonthlySummary` after `upsertLog` must each have their own try/catch; a failure in either must not surface as "failed to save entry" to the user.
- [Zustand Action Proxy Object Anti-Pattern](./pattern_zustand_action_proxy_object.md) — Never group Zustand actions into a plain `const store = { ... }` object; the new object reference on every render defeats every useCallback that lists `store` as a dep. Extract actions as individual `const` variables.
- [Modal setSaving on Unmounted Component](./pattern_modal_setSaving_unmounted.md) — `finally { setSaving(false) }` in a bottom sheet must guard with a `mountedRef` because `onClose()` can unmount the component before `finally` executes.
