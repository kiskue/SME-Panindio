---
name: project_database_state
description: Current state of the SQLite database layer — tables, migrations, patterns, and FK relationships
type: project
---

## Database Setup (as of 2026-03-16)

### Package
- `expo-sqlite: ~16.0.10` — already installed
- `expo-crypto` is NOT installed; use Math.random()-based RFC 4122 v4 UUID helper (see existing repositories)
  NOTE: `crypto.randomUUID()` is NOT available in Hermes (RN 0.81 / Expo SDK 54) — use the inline generateUUID() helper

### Directory structure
All database files live under `/database/` at the project root (not inside `src/`):
```
database/
  database.ts               — singleton via openDatabaseAsync; WAL + FK PRAGMAs
  initDatabase.ts           — runs schema registry + versioned migrations on boot
  schemas/
    inventory_items.schema.ts
    product_ingredients.schema.ts
    production_logs.schema.ts
    ingredient_consumption_logs.schema.ts
  repositories/
    inventory_items.repository.ts
    product_ingredients.repository.ts
    production_logs.repository.ts
    ingredient_consumption_logs.repository.ts
  migrations/
    001_create_inventory_items.ts
    002_add_product_ingredients.ts
    003_add_production_logs.ts
    004_add_ingredient_consumption_logs.ts
    005_add_product_to_consumption_logs.ts
    006_add_stock_unit_to_product_ingredients.ts
  registry/
    schemaRegistry.ts
```

Also:
- `src/utils/unitConversion.ts` — UOM conversion utility (g/kg/mg/lb/oz, mL/L/cl/fl_oz, pcs/dozen)
- `src/utils/ingredientPreflight.ts` — pure sync pre-flight check: `runPreflightCheck(ingredients, qty, items) → InsufficientStockItem[]` and `buildShortageMessage(shortfalls, productName) → string`; used in add.tsx before any DB write

### Tables registered
| Table                          | Purpose                                                                        | Migration |
|--------------------------------|--------------------------------------------------------------------------------|-----------|
| inventory_items                | Offline-first inventory (product/ingredient/equipment in one table)            | 001       |
| product_ingredients            | Recipe junction: product → ingredient with recipe qty + stock_unit for UOM     | 002, 006  |
| production_logs                | Header row per production run                                                  | 003       |
| production_log_ingredients     | Ingredient line items consumed in a production run                             | 003       |
| ingredient_consumption_logs    | Immutable audit ledger for every ingredient quantity reduction                  | 004       |
| schema_migrations              | Tracks applied migration versions (created in initDatabase.ts)                 | —         |
| sales_orders                   | POS sale headers (order_number, payment_method, totals, status)                | 007       |
| sales_order_items              | POS line items — FK to sales_orders + inventory_items; immutable price snapshot| 007       |
| utility_types                  | Master list of utility categories (Electricity/Water/Gas/Internet/Rent + custom)| 008      |
| utility_logs                   | Monthly billing records per utility type; UNIQUE(type_id, year, month)         | 008       |
| raw_materials                  | Operational supplies (packaging, cleaning, etc.); is_active replaces deleted_at | 010      |
| product_raw_materials          | Many-to-many: products ↔ raw materials; UNIQUE(product_id, raw_material_id)    | 010       |
| raw_material_consumption_logs  | Immutable audit ledger for raw material usage; cancelled_at for void events     | 010       |

### IMPORTANT: No separate `products` table
Products live in `inventory_items` with `category = 'product'`. Never propose a separate `products` table — it would conflict with existing architecture and all existing JOINs.

### product_ingredients columns (after migration 006)
- id, product_id, ingredient_id, quantity_used (how much per 1 unit of product in recipe unit)
- unit      — the recipe unit (e.g. 'g')
- stock_unit — the ingredient's canonical stock unit (e.g. 'kg'); NULL on pre-006 rows
- created_at, updated_at

UOM conversion: when recipe unit ≠ stock unit, use `convertUnit(quantity_used * unitsProduced, unit, stock_unit)` to get the correct deduction amount.

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
- IDs use inline generateUUID() (Math.random RFC4122 v4) — no expo-crypto
- Single flat table for all inventory categories (no per-category sub-tables)

### Boot sequence
1. `src/app/_layout.tsx` calls `await initDatabase()` first
2. Then `await initializeStores()` which includes `initializeInventory()`
3. `initializeInventory()` calls `getAllItems()` from the repository to hydrate the Zustand cache

### CRITICAL: Migration transaction pattern (fixed 2026-03-16)
`initDatabase.ts` MUST NOT use `db.withTransactionAsync()` to wrap migration.up() calls.
`withTransactionAsync` acquires an exclusive lock on the Expo SQLite serialized queue; any
`db.runAsync` / `db.execAsync` called inside the callback (including those inside migration.up())
deadlock because they queue behind the same held lock.
CORRECT pattern: explicit `await db.execAsync('BEGIN')` / `COMMIT` / `ROLLBACK` in a try/catch.

### utilities.repository.ts patterns (fixed 2026-03-16)
- `getUtilityLogs` and `getUtilityLogById` use LEFT JOIN (not INNER JOIN) on utility_types.
  INNER JOIN caused silent empty results when seed INSERTs were skipped (e.g. migration deadlock).
- `upsertUtilityLog` SELECT must NOT filter `deleted_at IS NULL`. The UNIQUE constraint on
  (utility_type_id, period_year, period_month) covers ALL rows including soft-deleted ones.
  Querying only live rows and then INSERTing for a soft-deleted slot causes a UNIQUE violation.
  Fix: select without deleted_at filter; if existing row found, UPDATE with deleted_at = NULL
  to revive it (covers both live-update and soft-delete-revival in one path).
- `UtilityLogJoinRow.utility_type_{name,icon,color,unit}` are `string | null` (LEFT JOIN).
  The mapper uses `?? ''` fallbacks so the domain `UtilityLog` type remains non-nullable.

### FK relationships
- `utility_logs.utility_type_id` → `utility_types.id`
- `sales_order_items.sales_order_id` → `sales_orders.id`
- `sales_order_items.product_id` → `inventory_items.id`
- `product_ingredients.product_id` → `inventory_items.id`
- `product_ingredients.ingredient_id` → `inventory_items.id`
- `production_logs.product_id` → `inventory_items.id`
- `production_log_ingredients.production_log_id` → `production_logs.id`
- `production_log_ingredients.ingredient_id` → `inventory_items.id`
- `ingredient_consumption_logs.ingredient_id` → `inventory_items.id`
- `ingredient_consumption_logs.product_id` → `inventory_items.id` (nullable — set for PRODUCTION trigger_type)
- `product_raw_materials.product_id` → `inventory_items.id`
- `product_raw_materials.raw_material_id` → `raw_materials.id`
- `raw_material_consumption_logs.raw_material_id` → `raw_materials.id`

### ingredient_consumption_logs notable columns
- `product_id TEXT` (nullable) — FK to inventory_items; records which finished product the ingredient was consumed for
- `product_name TEXT` (nullable) — denormalized product name snapshot at time of consumption; avoids JOIN at query time
- `reference_id` + `reference_type` — polymorphic FK to source document (e.g. production_log id)
- Rows are NEVER updated; corrections use a RETURN entry with negative quantity_consumed
- `cancelled_at` is the only mutable column

### Current migration version
Latest migration: `010_add_raw_materials.ts` (version = 10)
Next migration should be: `011_<description>.ts` (version = 11)

#### Migration 009 — dashboard index audit (applied 2026-03-17)
Added three composite indexes for dashboard period queries. All files confirmed written:
- `database/migrations/009_add_dashboard_indexes.ts`
- `database/schemas/sales_orders.schema.ts` — composite `(status, created_at)` on salesOrdersIndexes
- `database/schemas/ingredient_consumption_logs.schema.ts` — composite `(cancelled_at, consumed_at)` on ingredientConsumptionLogsIndexes
- `database/schemas/utilities.schema.ts` — `(created_at)` on utilityLogsIndexes
- `database/initDatabase.ts` — migration009 imported and registered

#### Migration 010 — raw materials (2026-03-17)
Three new tables added for the Raw Materials feature:
- `raw_materials` — master list of operational supplies (packaging, cleaning, etc.)
- `product_raw_materials` — many-to-many junction: products ↔ raw materials
- `raw_material_consumption_logs` — immutable audit ledger for raw material usage

Files to create/update (Write permission was blocked; apply manually):
1. CREATE `database/schemas/raw_materials.schema.ts`
2. CREATE `database/schemas/product_raw_materials.schema.ts`
3. CREATE `database/schemas/raw_material_consumption_logs.schema.ts`
4. CREATE `database/repositories/raw_materials.repository.ts`
5. CREATE `src/types/raw_materials.types.ts`
6. CREATE `database/migrations/010_add_raw_materials.ts`
7. EDIT `database/registry/schemaRegistry.ts` — add 3 new imports + 3 registry entries
8. EDIT `database/initDatabase.ts` — import migration010, add to MIGRATIONS array
9. EDIT `src/types/index.ts` — re-export all types from raw_materials.types.ts

### Dashboard repository (read-only, no migration required)
- File: `database/repositories/dashboard.repository.ts`
- Public API: `getDashboardData(period: DashboardPeriod): Promise<DashboardData>`
- Reads from: `sales_orders`, `ingredient_consumption_logs`, `utility_logs`, `production_logs`
- No writes, no schema changes
- Types (`DashboardPeriod`, `DashboardData`, `DashboardKPIs`, `DashboardTrendPoint`) added to `src/types/index.ts`
- Period bounds and trend sub-intervals computed in UTC (matching ISO 8601 TEXT stored by repositories)
- production_logs uses `units_produced` (not `quantity_produced`) — confirmed from schema file
- utility_logs KPI aggregates on `paid_at` (bills paid in period) OR `created_at` (unpaid bills entered in period)
- Trend chart omits utilities cost — monthly lump sums cannot be meaningfully sub-divided per bucket
- All KPI queries fire in one Promise.all; all trend sub-interval queries fire in a second Promise.all

### Key domain types (src/types/index.ts)
- `StockUnit` uses 'mL' (capital L) and 'L' — NOT 'ml'/'l'
- `ProductIngredientDetail` extends `ProductIngredientWithDetails` adding `stockUnit` and `convertedQuantity`
- `StockDeduction` — per-ingredient deduction record with `amountToDeduct` already in `stockUnit`

### product_ingredients.repository.ts exported functions
- `addIngredientToProduct(productId, ingredientId, quantityUsed, unit, stockUnit?)` — stockUnit is optional
- `removeIngredientFromProduct(productId, ingredientId)`
- `updateIngredientQuantity(id, quantityUsed, unit, stockUnit?)` — stockUnit is optional
- `getProductIngredients(productId): Promise<ProductIngredientDetail[]>` — includes stockUnit + convertedQuantity
- `calculateProductCost(productId): Promise<number>`
- `getAllProductsWithCost(): Promise<{productId, totalCost}[]>`
- `consumeIngredients(productId, unitsProduced)` — applies UOM conversion before deducting
- `replaceProductIngredients(productId, ingredients[])` — ingredients may include optional stockUnit
- `calculateStockDeductions(productId, quantity): Promise<StockDeduction[]>` — READ-ONLY preview (requires saved productId)
- `calculateDeductionsFromIngredients(ingredients: SelectedIngredient[], qty: number): StockDeduction[]` — PURE SYNC, no DB; use for new products before first save

### createProductionLog signature (as of migration 005)
```ts
createProductionLog(
  productId:     string,
  unitsProduced: number,
  totalCost:     number,
  ingredients:   ProductionLogIngredientInput[],
  notes?:        string,
  productName?:  string,   // pass for denormalized audit trail
): Promise<ProductionLog>
```
