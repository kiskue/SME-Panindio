/**
 * inventory_items.repository.ts
 *
 * All SQLite access for the `inventory_items` table lives here.
 * No SQL may appear in screens, hooks, or Zustand stores — they call
 * these functions exclusively.
 *
 * ID generation:
 *   expo-crypto is not installed in this project. The Hermes engine bundled
 *   with React Native 0.81 / Expo SDK 54 does NOT expose a global `crypto`
 *   object, so `crypto.randomUUID()` throws at runtime. A self-contained
 *   RFC 4122 v4 UUID helper (`generateUUID`) is defined in this file instead.
 *
 * Type mapping:
 *   The repository works with `InventoryItemRow` (snake_case DB columns)
 *   internally and exposes a `toDomain` helper to convert to the camelCase
 *   `InventoryItem` type used by the Zustand store and UI layer.
 */

import { getDatabase } from '../database';
import type {
  InventoryItemRow,
  CreateInventoryItemInput,
  UpdateInventoryItemInput,
} from '../schemas/inventory_items.schema';
import { INVENTORY_ITEM_COLUMNS } from '../schemas/inventory_items.schema';
import type { InventoryItem, EquipmentCondition, StockReductionReason, BomShortageItem, BomValidationResult } from '@/types';
import { canConvert, convertUnit } from '@/utils/unitConversion';

// ─── UUID helper ──────────────────────────────────────────────────────────────

/**
 * RFC 4122 v4 UUID using Math.random().
 *
 * `crypto.randomUUID()` is NOT available in the Hermes engine bundled with
 * React Native 0.81 / Expo SDK 54 — calling it throws:
 *   ReferenceError: Property 'crypto' doesn't exist
 *
 * `expo-crypto` is not in this project's dependencies. This pure-JS fallback
 * is cryptographically sufficient for local primary-key generation where
 * collision probability across a single device's SQLite database is negligible.
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ─── Column projection ────────────────────────────────────────────────────────

/**
 * Explicit column list for every SELECT — never SELECT *.
 */
const COLUMNS = INVENTORY_ITEM_COLUMNS.join(', ');

const TABLE = 'inventory_items';

// ─── Domain mapping ───────────────────────────────────────────────────────────

/**
 * Converts a raw DB row (snake_case, nulls) to the camelCase `InventoryItem`
 * domain type consumed by the Zustand store and UI screens.
 *
 * Optional fields are omitted entirely (not set to `undefined`) to satisfy
 * `exactOptionalPropertyTypes: true`.
 */
export function toDomain(row: InventoryItemRow): InventoryItem {
  return {
    id:        row.id,
    name:      row.name,
    category:  row.category,
    quantity:  row.quantity,
    unit:      row.unit as InventoryItem['unit'],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    // Optional fields — only spread when value is non-null
    ...(row.description  !== null ? { description:  row.description }          : {}),
    ...(row.cost_price   !== null ? { costPrice:    row.cost_price }            : {}),
    ...(row.image_uri    !== null ? { imageUri:     row.image_uri }             : {}),
    ...(row.price        !== null ? { price:        row.price }                 : {}),
    ...(row.sku          !== null ? { sku:          row.sku }                   : {}),
    ...(row.reorder_level !== null ? { reorderLevel: row.reorder_level }        : {}),
    ...(row.condition    !== null ? { condition:    row.condition as EquipmentCondition } : {}),
    ...(row.serial_number !== null ? { serialNumber: row.serial_number }        : {}),
    ...(row.purchase_date !== null ? { purchaseDate: row.purchase_date }        : {}),
  };
}

/**
 * Converts a domain `InventoryItem` to the flat parameter array expected by
 * the INSERT prepared statement. Keeps column order in sync with
 * `INVENTORY_ITEM_COLUMNS`.
 */
function toRowParams(
  id: string,
  input: CreateInventoryItemInput,
  now: string,
): (string | number | null)[] {
  return [
    id,
    input.name,
    input.category,
    input.quantity,
    input.unit,
    input.description  ?? null,
    input.cost_price   ?? null,
    input.image_uri    ?? null,
    input.price        ?? null,
    input.sku          ?? null,
    input.reorder_level ?? null,
    input.condition    ?? null,
    input.serial_number ?? null,
    input.purchase_date ?? null,
    'active',
    now,
    now,
    0,   // is_synced
    null, // deleted_at
  ];
}

// ─── CRUD functions ───────────────────────────────────────────────────────────

/**
 * Inserts a new inventory item and returns its full domain representation.
 *
 * The caller provides all business columns; `id`, timestamps, `is_synced`,
 * `status`, and `deleted_at` are managed here.
 */
export async function insertItem(
  input: CreateInventoryItemInput,
): Promise<InventoryItem> {
  const db  = await getDatabase();
  const id  = generateUUID();
  const now = new Date().toISOString();

  const placeholders = INVENTORY_ITEM_COLUMNS.map(() => '?').join(', ');

  await db.runAsync(
    `INSERT INTO ${TABLE} (${COLUMNS}) VALUES (${placeholders})`,
    toRowParams(id, input, now),
  );

  const row = await db.getFirstAsync<InventoryItemRow>(
    `SELECT ${COLUMNS} FROM ${TABLE} WHERE id = ?`,
    [id],
  );

  if (row === null) {
    throw new Error(`[inventory_items] INSERT succeeded but SELECT returned null for id=${id}`);
  }

  return toDomain(row);
}

/**
 * Returns a single item by its primary key, or `null` if not found /
 * soft-deleted.
 */
export async function getItemById(id: string): Promise<InventoryItem | null> {
  const db = await getDatabase();

  const row = await db.getFirstAsync<InventoryItemRow>(
    `SELECT ${COLUMNS} FROM ${TABLE} WHERE id = ? AND deleted_at IS NULL`,
    [id],
  );

  return row !== null ? toDomain(row) : null;
}

/**
 * Returns all live (non-deleted) items, ordered by `created_at` descending.
 * Optionally filtered by `category`.
 */
export async function getAllItems(filters?: {
  category?: 'product' | 'ingredient' | 'equipment';
  is_synced?: 0 | 1;
}): Promise<InventoryItem[]> {
  const db = await getDatabase();

  const conditions: string[] = ['deleted_at IS NULL'];
  const params: (string | number)[] = [];

  if (filters?.category !== undefined) {
    conditions.push('category = ?');
    params.push(filters.category);
  }
  if (filters?.is_synced !== undefined) {
    conditions.push('is_synced = ?');
    params.push(filters.is_synced);
  }

  const where = conditions.join(' AND ');

  const rows = await db.getAllAsync<InventoryItemRow>(
    `SELECT ${COLUMNS} FROM ${TABLE} WHERE ${where} ORDER BY created_at DESC`,
    params,
  );

  return rows.map(toDomain);
}

/**
 * Returns all live items belonging to a specific category.
 * Sugar over `getAllItems` — kept as a named export so callers read clearly.
 */
export async function getItemsByCategory(
  category: 'product' | 'ingredient' | 'equipment',
): Promise<InventoryItem[]> {
  return getAllItems({ category });
}

/**
 * Returns all ingredients where `quantity <= reorder_level` (reorder_level IS NOT NULL).
 * Used to populate the low-stock badge and alert banner.
 */
export async function getLowStockItems(): Promise<InventoryItem[]> {
  const db = await getDatabase();

  const rows = await db.getAllAsync<InventoryItemRow>(
    `SELECT ${COLUMNS}
     FROM ${TABLE}
     WHERE deleted_at IS NULL
       AND category = 'ingredient'
       AND reorder_level IS NOT NULL
       AND quantity <= reorder_level
     ORDER BY quantity ASC`,
    [],
  );

  return rows.map(toDomain);
}

/**
 * Updates one or more columns on an existing item.
 * `updated_at` is always refreshed; `is_synced` is always reset to 0.
 * Passing an empty `input` is a no-op.
 */
export async function updateItem(
  id: string,
  input: UpdateInventoryItemInput,
): Promise<void> {
  const db = await getDatabase();

  // Build dynamic SET clause from provided keys only
  const entries = Object.entries(input) as [keyof UpdateInventoryItemInput, unknown][];
  if (entries.length === 0) return;

  const setClauses = entries.map(([col]) => `${String(col)} = ?`).join(', ');
  const values     = entries.map(([, v]) => (v === undefined ? null : (v as string | number | null)));
  const now        = new Date().toISOString();

  await db.runAsync(
    `UPDATE ${TABLE}
     SET ${setClauses}, updated_at = ?, is_synced = 0
     WHERE id = ? AND deleted_at IS NULL`,
    [...values, now, id],
  );
}

/**
 * Soft-deletes an item by setting `deleted_at` to the current timestamp.
 * The row is retained for sync purposes; hard purge is handled separately
 * via `purgeDeletedItems`.
 */
export async function deleteItem(id: string): Promise<void> {
  const db  = await getDatabase();
  const now = new Date().toISOString();

  await db.runAsync(
    `UPDATE ${TABLE}
     SET deleted_at = ?, updated_at = ?, is_synced = 0
     WHERE id = ?`,
    [now, now, id],
  );
}

/**
 * Marks a batch of items as synced after a successful remote write.
 * Batching keeps the transaction overhead low when syncing many items.
 */
export async function markItemsSynced(ids: string[]): Promise<void> {
  if (ids.length === 0) return;

  const db           = await getDatabase();
  const placeholders = ids.map(() => '?').join(', ');

  await db.runAsync(
    `UPDATE ${TABLE} SET is_synced = 1 WHERE id IN (${placeholders})`,
    ids,
  );
}

/**
 * Atomically adjusts the `quantity` of an inventory item by a signed delta.
 *
 * Uses a single `UPDATE ... SET quantity = quantity + ?` so there is no
 * read-modify-write race condition. The quantity is clamped to a minimum of 0
 * — it can never go negative in the DB, which matches business rules.
 *
 * @param id     - Primary key of the inventory item.
 * @param delta  - Signed quantity change.
 *                 Negative to deduct (consumption / wastage / transfer).
 *                 Positive to add back (return event).
 * @returns      The new quantity value after the update, or `null` if the item
 *               was not found / has been soft-deleted.
 */
export async function adjustItemQuantity(
  id:    string,
  delta: number,
): Promise<number | null> {
  const db  = await getDatabase();
  const now = new Date().toISOString();

  // MAX(quantity + delta, 0) prevents the column going negative.
  await db.runAsync(
    `UPDATE ${TABLE}
     SET quantity   = MAX(quantity + ?, 0),
         updated_at = ?,
         is_synced  = 0
     WHERE id = ? AND deleted_at IS NULL`,
    [delta, now, id],
  );

  const row = await db.getFirstAsync<{ quantity: number } | null>(
    `SELECT quantity FROM ${TABLE} WHERE id = ? AND deleted_at IS NULL`,
    [id],
  );

  return row?.quantity ?? null;
}

// ─── Reduce Stock (atomic, with ingredient + raw material returns) ────────────

/**
 * Input for a single ingredient return when reducing product stock.
 * All amounts are in the ingredient's stock unit (post-conversion).
 */
export interface IngredientReturnInput {
  ingredientId:   string;
  amountToReturn: number;  // in stock unit
  stockUnit:      string;
  costPrice:      number;  // snapshot for audit log
  ingredientName: string;
}

/**
 * Input for a single raw material return when reducing product stock.
 */
export interface RawMaterialReturnInput {
  rawMaterialId:    string;
  amountToReturn:   number;
  unit:             string;
  costPerUnit:      number; // snapshot for audit log
}

/**
 * Result returned by `reduceProductStock` — shows actual new quantities
 * after the atomic transaction completes.
 */
export interface ReduceStockResult {
  newProductQuantity:  number;
  ingredientsReturned: { ingredientId: string; returned: number }[];
  rawMaterialsReturned: { rawMaterialId: string; returned: number }[];
}

/**
 * Atomically reduces a product's stock quantity.
 *
 * The `reason` determines whether linked ingredient and raw-material stock is
 * returned to inventory or only audit-logged:
 *
 *   correction — stock was added by mistake. Ingredients AND raw materials are
 *                returned to inventory (reverse the production). Writes
 *                ingredient_consumption_logs with trigger_type = 'RETURN' and
 *                raw_material_consumption_logs with reason = 'adjustment'.
 *
 *   damage / expiry / waste / other — the loss is real. Ingredients and raw
 *                materials are NOT returned. Writes ingredient_consumption_logs
 *                with trigger_type = 'WASTAGE' and raw_material_consumption_logs
 *                with reason = 'waste' for the audit trail only.
 *
 * All writes happen in a single SQLite transaction — either everything
 * succeeds or nothing is persisted.
 *
 * Validation: throws if `quantityToReduce` exceeds current product stock.
 *
 * @param productId          Primary key of the product inventory item.
 * @param productName        Display name (snapshot for audit logs).
 * @param quantityToReduce   Positive number of product units to remove.
 * @param reason             Business reason — drives return vs. audit-only logic.
 * @param ingredients        Per-ingredient amounts (may be empty).
 * @param rawMaterials       Per-raw-material amounts (may be empty).
 * @param notes              Optional audit note for all log entries.
 */
export async function reduceProductStock(
  productId:        string,
  productName:      string,
  quantityToReduce: number,
  reason:           StockReductionReason,
  ingredients:      IngredientReturnInput[],
  rawMaterials:     RawMaterialReturnInput[],
  notes?:           string,
): Promise<ReduceStockResult> {
  const db  = await getDatabase();
  const now = new Date().toISOString();

  // Pre-flight: read current product stock BEFORE opening the transaction
  const current = await db.getFirstAsync<{ quantity: number }>(
    `SELECT quantity FROM inventory_items WHERE id = ? AND deleted_at IS NULL`,
    [productId],
  );
  if (current === null) {
    throw new Error(`[reduceProductStock] Product ${productId} not found.`);
  }
  if (current.quantity < quantityToReduce) {
    throw new Error(
      `[reduceProductStock] Cannot reduce ${quantityToReduce} — only ${current.quantity} units in stock.`,
    );
  }

  // Only 'correction' reverses the prior stock deduction.
  const isReturn = reason === 'correction';

  const ingredientsReturned:  { ingredientId: string; returned: number }[]  = [];
  const rawMaterialsReturned: { rawMaterialId: string; returned: number }[] = [];

  await db.withTransactionAsync(async () => {
    // 1. Reduce product quantity (clamped to 0 by MAX)
    await db.runAsync(
      `UPDATE inventory_items
       SET quantity   = MAX(0, quantity - ?),
           updated_at = ?,
           is_synced  = 0
       WHERE id = ? AND deleted_at IS NULL`,
      [quantityToReduce, now, productId],
    );

    // 2. Write stock_reduction_logs entry for the product
    await db.runAsync(
      `INSERT INTO stock_reduction_logs
         (id, item_type, item_name, product_id, product_name,
          units_reduced, reason, notes, performed_by, reduced_at, created_at, is_synced)
       VALUES (?, 'product', ?, ?, ?, ?, ?, ?, NULL, ?, ?, 0)`,
      [
        generateUUID(),
        productName,
        productId,
        productName,
        quantityToReduce,
        reason,
        notes ?? null,
        now,
        now,
      ],
    );

    // 3. Ingredient handling — branch on reason
    for (const ing of ingredients) {
      if (ing.amountToReturn <= 0) continue;

      const totalCost = ing.amountToReturn * ing.costPrice;

      if (isReturn) {
        // Return stock back to ingredient inventory
        await db.runAsync(
          `UPDATE inventory_items
           SET quantity   = quantity + ?,
               updated_at = ?,
               is_synced  = 0
           WHERE id = ? AND deleted_at IS NULL`,
          [ing.amountToReturn, now, ing.ingredientId],
        );

        // Write RETURN log entry (positive quantity_consumed = returning stock back in)
        await db.runAsync(
          `INSERT INTO ingredient_consumption_logs
             (id, ingredient_id, quantity_consumed, unit, trigger_type,
              reference_id, reference_type, notes, cost_price, total_cost,
              performed_by, consumed_at, created_at, cancelled_at,
              product_id, product_name)
           VALUES (?, ?, ?, ?, 'RETURN', ?, 'stock_reduction', ?, ?, ?, NULL, ?, ?, NULL, ?, ?)`,
          [
            generateUUID(),
            ing.ingredientId,
            ing.amountToReturn,
            ing.stockUnit,
            productId,
            notes ?? null,
            ing.costPrice > 0 ? ing.costPrice : null,
            totalCost,
            now,
            now,
            productId,
            productName,
          ],
        );

        ingredientsReturned.push({ ingredientId: ing.ingredientId, returned: ing.amountToReturn });
      } else {
        // Audit-only — write WASTAGE log; do NOT touch ingredient quantity
        await db.runAsync(
          `INSERT INTO ingredient_consumption_logs
             (id, ingredient_id, quantity_consumed, unit, trigger_type,
              reference_id, reference_type, notes, cost_price, total_cost,
              performed_by, consumed_at, created_at, cancelled_at,
              product_id, product_name)
           VALUES (?, ?, ?, ?, 'WASTAGE', ?, 'stock_reduction', ?, ?, ?, NULL, ?, ?, NULL, ?, ?)`,
          [
            generateUUID(),
            ing.ingredientId,
            ing.amountToReturn,
            ing.stockUnit,
            productId,
            notes ?? null,
            ing.costPrice > 0 ? ing.costPrice : null,
            totalCost,
            now,
            now,
            productId,
            productName,
          ],
        );
        // No stock delta — wastage entries do not affect ingredient quantity
      }
    }

    // 4. Raw material handling — branch on reason
    for (const rm of rawMaterials) {
      if (rm.amountToReturn <= 0) continue;

      if (isReturn) {
        // Return stock back to the raw material
        await db.runAsync(
          `UPDATE raw_materials
           SET quantity_in_stock = quantity_in_stock + ?,
               updated_at = ?
           WHERE id = ?`,
          [rm.amountToReturn, now, rm.rawMaterialId],
        );

        // Write adjustment log entry (positive quantity_used = returned to stock)
        await db.runAsync(
          `INSERT INTO raw_material_consumption_logs
             (id, raw_material_id, quantity_used, reason, reference_id, notes,
              cost_per_unit, consumed_at, created_at, is_synced)
           VALUES (?, ?, ?, 'adjustment', ?, ?, ?, ?, ?, 0)`,
          [
            generateUUID(),
            rm.rawMaterialId,
            rm.amountToReturn,
            productId,
            notes ?? null,
            rm.costPerUnit,
            now,
            now,
          ],
        );

        rawMaterialsReturned.push({ rawMaterialId: rm.rawMaterialId, returned: rm.amountToReturn });
      } else {
        // Audit-only — write waste log; do NOT touch raw material quantity
        await db.runAsync(
          `INSERT INTO raw_material_consumption_logs
             (id, raw_material_id, quantity_used, reason, reference_id, notes,
              cost_per_unit, consumed_at, created_at, is_synced)
           VALUES (?, ?, ?, 'waste', ?, ?, ?, ?, ?, 0)`,
          [
            generateUUID(),
            rm.rawMaterialId,
            rm.amountToReturn,
            productId,
            notes ?? null,
            rm.costPerUnit,
            now,
            now,
          ],
        );
        // No stock delta — waste entries do not affect raw material quantity
      }
    }
  });

  // Read back the new product quantity after the transaction
  const updated = await db.getFirstAsync<{ quantity: number }>(
    `SELECT quantity FROM inventory_items WHERE id = ? AND deleted_at IS NULL`,
    [productId],
  );

  return {
    newProductQuantity: updated?.quantity ?? Math.max(0, current.quantity - quantityToReduce),
    ingredientsReturned,
    rawMaterialsReturned,
  };
}

// ─── Ingredient Add / Reduce Stock ───────────────────────────────────────────

/**
 * Result returned by `addIngredientStock` and `reduceIngredientStock`.
 */
export interface IngredientStockResult {
  newQuantity: number;
}

/**
 * Atomically increases an ingredient's stock quantity and writes a RETURN
 * entry in `ingredient_consumption_logs` so the change is fully audited.
 *
 * This is the counterpart to the product's Add Stock flow, but simpler:
 * ingredients ARE the raw inventory — no sub-ingredient unwinding needed.
 *
 * @param ingredientId  Primary key of the ingredient inventory item.
 * @param quantity      Positive number of units to add back into stock.
 * @param notes         Optional audit note for the consumption log entry.
 */
export async function addIngredientStock(
  ingredientId: string,
  quantity:     number,
  notes?:       string,
): Promise<IngredientStockResult> {
  const db  = await getDatabase();
  const now = new Date().toISOString();

  // Pre-flight: confirm the ingredient exists
  const current = await db.getFirstAsync<{ quantity: number; unit: string; cost_price: number | null }>(
    `SELECT quantity, unit, cost_price FROM inventory_items WHERE id = ? AND deleted_at IS NULL`,
    [ingredientId],
  );
  if (current === null) {
    throw new Error(`[addIngredientStock] Ingredient ${ingredientId} not found.`);
  }

  await db.withTransactionAsync(async () => {
    // 1. Increase stock quantity
    await db.runAsync(
      `UPDATE inventory_items
       SET quantity   = quantity + ?,
           updated_at = ?,
           is_synced  = 0
       WHERE id = ? AND deleted_at IS NULL`,
      [quantity, now, ingredientId],
    );

    // 2. Write RETURN audit log — negative quantity_consumed convention means
    //    stock is being added back, matching the pattern used in reduceProductStock.
    //    We store the raw positive amount as quantity_consumed and mark trigger_type
    //    as RETURN so aggregate queries can separate additions from deductions.
    const costPrice  = current.cost_price ?? 0;
    const totalCost  = quantity * costPrice;

    await db.runAsync(
      `INSERT INTO ingredient_consumption_logs
         (id, ingredient_id, quantity_consumed, unit, trigger_type,
          reference_id, reference_type, notes, cost_price, total_cost,
          performed_by, consumed_at, created_at, cancelled_at,
          product_id, product_name)
       VALUES (?, ?, ?, ?, 'RETURN', NULL, 'manual_stock_addition', ?, ?, ?, NULL, ?, ?, NULL, NULL, NULL)`,
      [
        generateUUID(),
        ingredientId,
        quantity,          // positive = units being returned/added
        current.unit,
        notes ?? null,
        costPrice > 0 ? costPrice : null,
        totalCost,
        now,
        now,
      ],
    );
  });

  const updated = await db.getFirstAsync<{ quantity: number }>(
    `SELECT quantity FROM inventory_items WHERE id = ? AND deleted_at IS NULL`,
    [ingredientId],
  );

  return { newQuantity: updated?.quantity ?? current.quantity + quantity };
}

/**
 * Atomically reduces an ingredient's stock quantity and writes both an
 * `ingredient_consumption_logs` entry (MANUAL_ADJUSTMENT) and a
 * `stock_reduction_logs` entry for the full audit trail.
 *
 * Pre-flight guard: throws if `quantity` exceeds current stock.
 * No sub-ingredient unwinding — ingredients are leaf-level inventory.
 *
 * @param ingredientId    Primary key of the ingredient inventory item.
 * @param ingredientName  Display name snapshot for audit log denormalisation.
 * @param quantity        Positive number of units to remove from stock.
 * @param reason          Business reason for the reduction.
 * @param notes           Optional free-text explanation.
 */
export async function reduceIngredientStock(
  ingredientId:   string,
  ingredientName: string,
  quantity:       number,
  reason:         StockReductionReason,
  notes?:         string,
): Promise<IngredientStockResult> {
  const db  = await getDatabase();
  const now = new Date().toISOString();

  // Pre-flight: read current stock BEFORE opening the transaction
  const current = await db.getFirstAsync<{ quantity: number; unit: string; cost_price: number | null }>(
    `SELECT quantity, unit, cost_price FROM inventory_items WHERE id = ? AND deleted_at IS NULL`,
    [ingredientId],
  );
  if (current === null) {
    throw new Error(`[reduceIngredientStock] Ingredient ${ingredientId} not found.`);
  }
  if (current.quantity < quantity) {
    throw new Error(
      `[reduceIngredientStock] Cannot reduce ${quantity} — only ${current.quantity} units in stock.`,
    );
  }

  await db.withTransactionAsync(async () => {
    // 1. Decrease stock quantity (clamped to 0 by MAX)
    await db.runAsync(
      `UPDATE inventory_items
       SET quantity   = MAX(0, quantity - ?),
           updated_at = ?,
           is_synced  = 0
       WHERE id = ? AND deleted_at IS NULL`,
      [quantity, now, ingredientId],
    );

    // 2. Write consumption log — WASTAGE for expired/damaged stock, MANUAL_ADJUSTMENT otherwise
    const costPrice   = current.cost_price ?? 0;
    const totalCost   = quantity * costPrice;
    const triggerType = (reason === 'expiry' || reason === 'damage' || reason === 'waste') ? 'WASTAGE' : 'MANUAL_ADJUSTMENT';

    await db.runAsync(
      `INSERT INTO ingredient_consumption_logs
         (id, ingredient_id, quantity_consumed, unit, trigger_type,
          reference_id, reference_type, notes, cost_price, total_cost,
          performed_by, consumed_at, created_at, cancelled_at,
          product_id, product_name)
       VALUES (?, ?, ?, ?, ?, NULL, 'manual_stock_reduction', ?, ?, ?, NULL, ?, ?, NULL, NULL, NULL)`,
      [
        generateUUID(),
        ingredientId,
        quantity,
        current.unit,
        triggerType,
        notes ?? null,
        costPrice > 0 ? costPrice : null,
        totalCost,
        now,
        now,
      ],
    );

    // 3. Write stock_reduction_logs for full audit trail.
    //    item_type = 'ingredient' and item_name = ingredientName are mandatory
    //    NOT NULL columns. product_id / product_name are NULL for ingredient rows
    //    per the post-013 schema design (ingredient_consumption_logs holds the
    //    full ingredient FK audit trail).
    await db.runAsync(
      `INSERT INTO stock_reduction_logs
         (id, item_type, item_name, product_id, product_name,
          units_reduced, reason, notes, performed_by, reduced_at, created_at, is_synced)
       VALUES (?, 'ingredient', ?, NULL, NULL, ?, ?, ?, NULL, ?, ?, 0)`,
      [
        generateUUID(),
        ingredientName,
        quantity,
        reason,
        notes ?? null,
        now,
        now,
      ],
    );
  });

  const updated = await db.getFirstAsync<{ quantity: number }>(
    `SELECT quantity FROM inventory_items WHERE id = ? AND deleted_at IS NULL`,
    [ingredientId],
  );

  return { newQuantity: updated?.quantity ?? Math.max(0, current.quantity - quantity) };
}

// ─── Add Product Stock (BOM-constrained, single-transaction) ─────────────────

/**
 * Atomically adds stock units to a finished product while deducting the
 * matching ingredient and raw-material quantities from inventory, and writing
 * a full audit trail — all inside a SINGLE `withTransactionAsync` block.
 *
 * CRITICAL: This function does NOT call `consumeIngredients()`,
 * `createProductionLog()`, or any other repository function that owns its own
 * `withTransactionAsync`. Calling those inside a transaction deadlocks the
 * Expo SQLite serialised queue. Every SQL statement is inlined here,
 * mirroring the exact pattern used in `reduceProductStock()`.
 *
 * Steps executed inside the single transaction:
 *   1.  Fetch product name from `inventory_items`.
 *   2.  Fetch all linked ingredient rows (product_ingredients JOIN inventory_items).
 *   3.  Fetch all linked raw-material rows (product_raw_materials JOIN raw_materials).
 *   4.  Validate: for each ingredient, check current_stock >= stockDeduction.
 *       For each raw material, check quantity_in_stock >= required * unitsToAdd.
 *       If any shortage: throw with a JSON-serialised `BomValidationResult` payload.
 *   5.  Increase product quantity by `unitsToAdd`.
 *   6.  Deduct each ingredient via UPDATE inventory_items.
 *   7.  Write an `ingredient_consumption_logs` row (trigger_type = 'PRODUCTION').
 *   8.  Deduct each raw material via UPDATE raw_materials.
 *   9.  Write a `raw_material_consumption_logs` row (reason = 'production').
 *   10. Insert the `product_stock_additions` audit row with JSON snapshots.
 *
 * @param productId   Primary key of the product inventory item.
 * @param unitsToAdd  Positive number of product units to add. Must be > 0.
 * @param notes       Optional free-text note stored on every audit log entry.
 * @param performedBy Optional operator identifier (name or user ID).
 *
 * @throws When the product is not found.
 * @throws When any ingredient or raw material has insufficient stock — the
 *         error message is a JSON-serialised `BomValidationResult` so callers
 *         can parse it to drive structured UI feedback.
 */
export async function addProductStock(
  productId:   string,
  unitsToAdd:  number,
  notes?:      string,
  performedBy?: string,
): Promise<void> {
  if (unitsToAdd <= 0) {
    throw new Error('[addProductStock] unitsToAdd must be a positive number.');
  }

  const db  = await getDatabase();
  const now = new Date().toISOString();

  // ── Pre-flight reads (outside the transaction — mirrors reduceProductStock) ──

  // 1. Product name
  const productRow = await db.getFirstAsync<{ name: string }>(
    `SELECT name FROM inventory_items WHERE id = ? AND deleted_at IS NULL`,
    [productId],
  );
  if (productRow === null) {
    throw new Error(`[addProductStock] Product ${productId} not found.`);
  }
  const productName = productRow.name;

  // 2. Ingredient links with current stock and unit metadata
  const ingredientLinks = await db.getAllAsync<{
    ingredient_id:   string;
    ingredient_name: string;
    quantity_used:   number;
    unit:            string;
    stock_unit:      string | null;
    current_stock:   number;
    cost_price:      number | null;
    item_unit:       string;
  }>(
    `SELECT
       pi.ingredient_id,
       ii.name        AS ingredient_name,
       pi.quantity_used,
       pi.unit,
       pi.stock_unit,
       ii.quantity    AS current_stock,
       ii.cost_price,
       ii.unit        AS item_unit
     FROM product_ingredients pi
     JOIN inventory_items ii
       ON ii.id = pi.ingredient_id
      AND ii.deleted_at IS NULL
     WHERE pi.product_id = ?
     ORDER BY pi.created_at ASC`,
    [productId],
  );

  // 3. Raw material links with current stock
  const rawMaterialLinks = await db.getAllAsync<{
    raw_material_id:   string;
    raw_material_name: string;
    quantity_required: number;
    unit:              string;
    current_stock:     number;
    cost_per_unit:     number;
  }>(
    `SELECT
       prm.raw_material_id,
       rm.name              AS raw_material_name,
       prm.quantity_required,
       prm.unit,
       rm.quantity_in_stock AS current_stock,
       rm.cost_per_unit
     FROM product_raw_materials prm
     JOIN raw_materials rm
       ON rm.id = prm.raw_material_id
      AND rm.is_active = 1
     WHERE prm.product_id = ?
     ORDER BY prm.created_at ASC`,
    [productId],
  );

  // ── BOM validation ───────────────────────────────────────────────────────────

  // Inline unit-conversion helper (non-throwing, mirrors resolveConvertedQuantity)
  function resolveConvertedQty(quantity: number, fromUnit: string, toUnit: string): number {
    if (fromUnit === toUnit) return quantity;
    if (!canConvert(fromUnit, toUnit)) return quantity;
    return convertUnit(quantity, fromUnit, toUnit);
  }

  // Compute per-link stock deductions and accumulate shortages
  interface IngredientPlan {
    ingredientId:   string;
    ingredientName: string;
    stockDeduction: number; // units to deduct, expressed in stock unit
    stockUnit:      string;
    costPrice:      number;
  }
  interface RawMaterialPlan {
    rawMaterialId:   string;
    rawMaterialName: string;
    deduction:       number;
    unit:            string;
    costPerUnit:     number;
  }

  const ingredientPlan: IngredientPlan[] = [];
  const rawMaterialPlan: RawMaterialPlan[] = [];

  const shortages: BomShortageItem[] = [];
  let maxProducible = Infinity;

  for (const link of ingredientLinks) {
    const effectiveSU   = link.stock_unit ?? link.unit;
    const recipeAmt     = link.quantity_used * unitsToAdd;
    const stockDeduction = resolveConvertedQty(recipeAmt, link.unit, effectiveSU);
    const requiredPerUnit = resolveConvertedQty(link.quantity_used, link.unit, effectiveSU);

    if (requiredPerUnit > 0) {
      const canMake = Math.floor(link.current_stock / requiredPerUnit);
      if (canMake < maxProducible) maxProducible = canMake;
    }

    if (link.current_stock < stockDeduction) {
      shortages.push({
        ingredientId:   link.ingredient_id,
        ingredientName: link.ingredient_name,
        required:       requiredPerUnit,
        available:      link.current_stock,
        shortage:       stockDeduction - link.current_stock,
        unit:           effectiveSU,
        isRawMaterial:  false,
      });
    }

    ingredientPlan.push({
      ingredientId:   link.ingredient_id,
      ingredientName: link.ingredient_name,
      stockDeduction,
      stockUnit:      effectiveSU,
      costPrice:      link.cost_price ?? 0,
    });
  }

  for (const rm of rawMaterialLinks) {
    const deduction      = rm.quantity_required * unitsToAdd;
    const requiredPerUnit = rm.quantity_required;

    if (requiredPerUnit > 0) {
      const canMake = Math.floor(rm.current_stock / requiredPerUnit);
      if (canMake < maxProducible) maxProducible = canMake;
    }

    if (rm.current_stock < deduction) {
      shortages.push({
        ingredientId:   rm.raw_material_id,
        ingredientName: rm.raw_material_name,
        required:       requiredPerUnit,
        available:      rm.current_stock,
        shortage:       deduction - rm.current_stock,
        unit:           rm.unit,
        isRawMaterial:  true,
      });
    }

    rawMaterialPlan.push({
      rawMaterialId:   rm.raw_material_id,
      rawMaterialName: rm.raw_material_name,
      deduction,
      unit:            rm.unit,
      costPerUnit:     rm.cost_per_unit,
    });
  }

  if (shortages.length > 0) {
    const validationResult: BomValidationResult = {
      isValid:      false,
      maxProducible: Math.max(0, isFinite(maxProducible) ? maxProducible : 0),
      shortages,
      requestedQty: unitsToAdd,
    };
    throw new Error(JSON.stringify(validationResult));
  }

  // ── Single transaction: all writes ──────────────────────────────────────────

  // Build the audit JSON snapshots before entering the transaction
  const auditIngredients = ingredientPlan.map((p) => ({
    ingredientId:   p.ingredientId,
    ingredientName: p.ingredientName,
    amountDeducted: p.stockDeduction,
    unit:           p.stockUnit,
  }));
  const auditRawMaterials = rawMaterialPlan.map((p) => ({
    rawMaterialId:   p.rawMaterialId,
    rawMaterialName: p.rawMaterialName,
    amountDeducted:  p.deduction,
    unit:            p.unit,
  }));

  await db.withTransactionAsync(async () => {
    // 5. Increase product stock
    await db.runAsync(
      `UPDATE inventory_items
       SET quantity   = quantity + ?,
           updated_at = ?,
           is_synced  = 0
       WHERE id = ? AND deleted_at IS NULL`,
      [unitsToAdd, now, productId],
    );

    // 6 + 7. Deduct each ingredient and write consumption log
    for (const plan of ingredientPlan) {
      if (plan.stockDeduction <= 0) continue;

      await db.runAsync(
        `UPDATE inventory_items
         SET quantity   = MAX(0, quantity - ?),
             updated_at = ?,
             is_synced  = 0
         WHERE id = ? AND deleted_at IS NULL`,
        [plan.stockDeduction, now, plan.ingredientId],
      );

      const costPrice = plan.costPrice;
      const totalCost = plan.stockDeduction * costPrice;

      await db.runAsync(
        `INSERT INTO ingredient_consumption_logs
           (id, ingredient_id, quantity_consumed, unit, trigger_type,
            reference_id, reference_type, notes, cost_price, total_cost,
            performed_by, consumed_at, created_at, cancelled_at,
            product_id, product_name)
         VALUES (?, ?, ?, ?, 'PRODUCTION', ?, 'product_stock_addition', ?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
        [
          generateUUID(),
          plan.ingredientId,
          plan.stockDeduction,
          plan.stockUnit,
          productId,        // reference_id = product being added to
          notes ?? null,
          costPrice > 0 ? costPrice : null,
          totalCost,
          performedBy ?? null,
          now,              // consumed_at
          now,              // created_at
          productId,        // product_id FK
          productName,      // product_name snapshot
        ],
      );
    }

    // 8 + 9. Deduct each raw material and write consumption log
    for (const plan of rawMaterialPlan) {
      if (plan.deduction <= 0) continue;

      await db.runAsync(
        `UPDATE raw_materials
         SET quantity_in_stock = MAX(0, quantity_in_stock - ?),
             updated_at = ?
         WHERE id = ?`,
        [plan.deduction, now, plan.rawMaterialId],
      );

      await db.runAsync(
        `INSERT INTO raw_material_consumption_logs
           (id, raw_material_id, quantity_used, reason, reference_id, notes,
            cost_per_unit, consumed_at, created_at, is_synced)
         VALUES (?, ?, ?, 'production', ?, ?, ?, ?, ?, 0)`,
        [
          generateUUID(),
          plan.rawMaterialId,
          plan.deduction,
          productId,             // reference_id = product being added to
          notes ?? null,
          plan.costPerUnit,
          now,                   // consumed_at
          now,                   // created_at
        ],
      );
    }

    // 10. Audit row in product_stock_additions
    await db.runAsync(
      `INSERT INTO product_stock_additions
         (id, product_id, product_name, units_added, notes, performed_by,
          ingredients_used, raw_materials_used, added_at, created_at, is_synced)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [
        generateUUID(),
        productId,
        productName,
        unitsToAdd,
        notes         ?? null,
        performedBy   ?? null,
        auditIngredients.length  > 0 ? JSON.stringify(auditIngredients)  : null,
        auditRawMaterials.length > 0 ? JSON.stringify(auditRawMaterials) : null,
        now,   // added_at
        now,   // created_at
      ],
    );
  });
}

/**
 * Permanently removes rows that have been soft-deleted AND synced.
 * Safe to call from a background job after confirming remote deletion.
 * Never call this on items that have not yet been confirmed deleted remotely.
 */
export async function purgeDeletedItems(): Promise<void> {
  const db = await getDatabase();

  await db.runAsync(
    `DELETE FROM ${TABLE} WHERE deleted_at IS NOT NULL AND is_synced = 1`,
    [],
  );
}

/**
 * Bulk-inserts an array of items inside a single transaction.
 * Use when hydrating from a remote API response.
 * Each item is upserted — existing rows with matching `id` are replaced.
 */
export async function bulkUpsertItems(
  items: InventoryItemRow[],
): Promise<void> {
  if (items.length === 0) return;

  const db           = await getDatabase();
  const placeholders = INVENTORY_ITEM_COLUMNS.map(() => '?').join(', ');

  await db.withTransactionAsync(async () => {
    for (const item of items) {
      await db.runAsync(
        `INSERT OR REPLACE INTO ${TABLE} (${COLUMNS}) VALUES (${placeholders})`,
        [
          item.id,
          item.name,
          item.category,
          item.quantity,
          item.unit,
          item.description   ?? null,
          item.cost_price    ?? null,
          item.image_uri     ?? null,
          item.price         ?? null,
          item.sku           ?? null,
          item.reorder_level ?? null,
          item.condition     ?? null,
          item.serial_number ?? null,
          item.purchase_date ?? null,
          item.status,
          item.created_at,
          item.updated_at,
          item.is_synced,
          item.deleted_at    ?? null,
        ],
      );
    }
  });
}
