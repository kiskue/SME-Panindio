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
import type { InventoryItem } from '@/types';

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
    ...(row.condition    !== null ? { condition:    row.condition as InventoryItem['condition'] } : {}),
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
