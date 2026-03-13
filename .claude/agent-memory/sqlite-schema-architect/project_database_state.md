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
| Table                          | Purpose                                                                      | Migration |
|--------------------------------|------------------------------------------------------------------------------|-----------|
| inventory_items                | Offline-first inventory (product/ingredient/equipment)                       | 001       |
| product_ingredients            | Junction: links product to its required ingredients with quantity_used        | 002       |
| production_logs                | Header row per production run (product_id FK → inventory_items)              | 003       |
| production_log_ingredients     | Ingredient line items consumed in a production run                           | 003       |
| ingredient_consumption_logs    | Immutable audit ledger for every ingredient quantity reduction                | 004       |
| schema_migrations              | Tracks which migration versions have been applied (created in initDatabase.ts) | —        |

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
- `product_ingredients.product_id` → `inventory_items.id`
- `product_ingredients.ingredient_id` → `inventory_items.id`
- `production_logs.product_id` → `inventory_items.id`
- `production_log_ingredients.production_log_id` → `production_logs.id`
- `production_log_ingredients.ingredient_id` → `inventory_items.id`
- `ingredient_consumption_logs.ingredient_id` → `inventory_items.id`
- `ingredient_consumption_logs.product_id` → `inventory_items.id` (nullable — set for PRODUCTION trigger_type)

### ingredient_consumption_logs notable columns
- `product_id TEXT` (nullable) — FK to inventory_items; records which finished product the ingredient was consumed for
- `product_name TEXT` (nullable) — denormalized product name snapshot at time of consumption; avoids JOIN at query time
- `reference_id` + `reference_type` — polymorphic FK to source document (e.g. production_log id)
- Rows are NEVER updated; corrections use a RETURN entry with negative quantity_consumed
- `cancelled_at` is the only mutable column

### Current migration version
Latest migration: `005_add_product_to_consumption_logs.ts` (version = 5)
Next migration should be: `006_<description>.ts` (version = 6)

### createProductionLog signature (as of migration 005)
```ts
createProductionLog(
  productId:     string,
  unitsProduced: number,
  totalCost:     number,
  ingredients:   ProductionLogIngredientInput[],
  notes?:        string,
  productName?:  string,   // ← added in 005; pass for denormalized audit trail
): Promise<ProductionLog>
```
Callers should pass `productName` from the UI/store; it flows through to every consumption log row.
