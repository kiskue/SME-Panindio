---
name: project_database_state
description: Current state of the SQLite database layer — tables, migrations, patterns, and FK relationships
type: project
---

## Database Setup (as of 2026-03-12)

### Package
- `expo-sqlite: ~16.0.10` — already installed
- `expo-crypto` is NOT installed; use `crypto.randomUUID()` (global, available since Expo SDK 49+ / Hermes)

### Directory structure
All database files live under `/database/` at the project root (not inside `src/`):
```
database/
  database.ts               — singleton via openDatabaseAsync; WAL + FK PRAGMAs
  initDatabase.ts           — runs schema registry + versioned migrations on boot
  schemas/
    inventory_items.schema.ts
  repositories/
    inventory_items.repository.ts
  migrations/
    001_create_inventory_items.ts
  registry/
    schemaRegistry.ts
```

### Tables registered
| Table             | Purpose                                      | Migration |
|-------------------|----------------------------------------------|-----------|
| inventory_items   | Offline-first inventory (product/ingredient/equipment) | 001 |
| schema_migrations | Tracks which migration versions have been applied | created in initDatabase.ts |

### inventory_items columns
- id, name, category, quantity, unit (core, all categories)
- description, cost_price, image_uri (common optional)
- price, sku (product-specific)
- reorder_level (ingredient-specific)
- condition, serial_number, purchase_date (equipment-specific)
- status, created_at, updated_at, is_synced, deleted_at (audit/sync)

### Conventions decided for this project
- Timestamps stored as TEXT (ISO 8601 strings) — NOT INTEGER UNIX ms.
  Reason: existing domain types (InventoryItem.createdAt etc.) are already ISO 8601 strings;
  purchaseDate is a date-only string (YYYY-MM-DD), not a timestamp.
- is_synced stored as INTEGER 0|1 (standard)
- Soft-delete via deleted_at (TEXT ISO 8601, NULL when live)
- IDs use `crypto.randomUUID()` (no expo-crypto dependency)
- Single flat table for all inventory categories (no per-category sub-tables)

### Boot sequence
1. `src/app/_layout.tsx` calls `await initDatabase()` first
2. Then `await initializeStores()` which includes `initializeInventory()`
3. `initializeInventory()` calls `getAllItems()` from the repository to hydrate the Zustand cache

### Zustand store change
`src/store/inventory.store.ts` was refactored from AsyncStorage-persisted to SQLite-backed:
- `addItem` now accepts `CreateInventoryItemInput` (snake_case DB columns, no id/timestamps)
- `updateItem` maps camelCase InventoryItem fields to snake_case DB columns via `toDbUpdates()`
- `deleteItem` performs a soft-delete in SQLite
- `persist` middleware was removed (SQLite is the source of truth)

### FK relationships
None yet (inventory_items has no foreign keys to other tables).
Future: `user_id` FK to `users` table when multi-user inventory is added.

### Current migration version
Latest migration: `001_create_inventory_items.ts` (version = 1)
Next migration should be: `002_<description>.ts` (version = 2)
