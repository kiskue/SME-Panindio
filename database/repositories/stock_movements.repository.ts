/**
 * stock_movements.repository.ts
 *
 * All SQL for the `stock_movements` table.
 *
 * Design principles:
 *   - Every movement insert is always paired with an `inventory_items.quantity`
 *     update in the SAME transaction. This keeps the denormalized running total
 *     in inventory_items consistent with the ledger at all times.
 *   - `addStockMovement` is the ONLY public write path. Callers must never
 *     directly UPDATE inventory_items.quantity for product stock changes —
 *     they must go through this function so the audit trail is maintained.
 *   - `getCurrentStock` reads from inventory_items.quantity (O(1) read).
 *     Use `reconcileStock` for the audit-accurate SUM when you need to verify
 *     the running total matches the ledger (e.g. data-integrity checks, sync).
 *
 * Timestamps: TEXT ISO 8601 — project convention (NOT INTEGER UNIX ms).
 *
 * UUID: Math.random RFC4122 v4 inline helper (expo-crypto is not installed;
 * crypto.randomUUID() is not available in Hermes / RN 0.81 / Expo SDK 54).
 *
 * Transaction pattern: explicit BEGIN / COMMIT / ROLLBACK — never
 * db.withTransactionAsync() which deadlocks Expo SQLite's serialized queue
 * when db.runAsync calls are made inside the callback.
 */

import { getDatabase } from '../database';
import type {
  StockMovementRow,
  StockMovement,
  CreateStockMovementInput,
  GetStockMovementsOptions,
  StockMovementType,
} from '../schemas/stock_movements.schema';

// ─── UUID helper ──────────────────────────────────────────────────────────────

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ─── Column projection ────────────────────────────────────────────────────────

const TABLE = 'stock_movements';

const COLUMNS = [
  'id',
  'product_id',
  'product_name',
  'quantity_delta',
  'quantity_after',
  'movement_type',
  'cost_price',
  'reference_id',
  'reference_type',
  'notes',
  'performed_by',
  'moved_at',
  'created_at',
  'is_synced',
].join(', ');

// ─── Domain mapping ───────────────────────────────────────────────────────────

function toDomain(row: StockMovementRow): StockMovement {
  return {
    id:            row.id,
    productId:     row.product_id,
    productName:   row.product_name,
    quantityDelta: row.quantity_delta,
    quantityAfter: row.quantity_after,
    movementType:  row.movement_type,
    isSynced:      row.is_synced === 1,
    movedAt:       row.moved_at,
    createdAt:     row.created_at,
    ...(row.cost_price     !== null ? { costPrice:     row.cost_price }      : {}),
    ...(row.reference_id   !== null ? { referenceId:   row.reference_id }    : {}),
    ...(row.reference_type !== null ? { referenceType: row.reference_type }  : {}),
    ...(row.notes          !== null ? { notes:         row.notes }           : {}),
    ...(row.performed_by   !== null ? { performedBy:   row.performed_by }    : {}),
  };
}

// ─── Write ────────────────────────────────────────────────────────────────────

/**
 * Records a stock movement and atomically updates inventory_items.quantity.
 *
 * This is the ONLY correct way to change product stock. Calling
 * `adjustItemQuantity` directly on a product bypasses the movement ledger
 * and will cause reconciliation drift.
 *
 * The function:
 *   1. Reads the current product quantity (pre-flight, outside the transaction).
 *   2. Opens an explicit BEGIN transaction.
 *   3. Updates inventory_items.quantity by quantity_delta (clamped at 0).
 *   4. Reads the new quantity_after value.
 *   5. Inserts the stock_movements row with the exact quantity_after snapshot.
 *   6. COMMITs. On any error, ROLLBACKs so neither write is persisted.
 *
 * Returns the newly created `StockMovement` domain object.
 *
 * Throws if:
 *   - The product does not exist / is soft-deleted.
 *   - quantityDelta is 0.
 *   - The resulting quantity would go below 0 AND the caller has not
 *     explicitly allowed it (default: throws; pass allowNegative=true to
 *     allow the MAX(0, ...) clamp to absorb the overflow silently).
 */
export async function addStockMovement(
  input: CreateStockMovementInput,
  options: { allowNegative?: boolean } = {},
): Promise<StockMovement> {
  if (input.quantityDelta === 0) {
    throw new Error('[stock_movements] quantityDelta must not be 0.');
  }

  const db  = await getDatabase();
  const now = new Date().toISOString();
  const id  = generateUUID();
  const movedAt = input.movedAt ?? now;

  // Pre-flight: verify product exists and capture current quantity.
  const product = await db.getFirstAsync<{ quantity: number; name: string }>(
    `SELECT quantity, name FROM inventory_items WHERE id = ? AND deleted_at IS NULL`,
    [input.productId],
  );
  if (product === null) {
    throw new Error(
      `[stock_movements] Product ${input.productId} not found or is deleted.`,
    );
  }

  // Guard against over-reduction when allowNegative is false (the default).
  if (!options.allowNegative && input.quantityDelta < 0) {
    if (product.quantity + input.quantityDelta < 0) {
      throw new Error(
        `[stock_movements] Cannot remove ${Math.abs(input.quantityDelta)} units — ` +
        `only ${product.quantity} in stock for product ${input.productId}.`,
      );
    }
  }

  // Use explicit BEGIN/COMMIT — withTransactionAsync deadlocks Expo SQLite's
  // serialized queue when db.runAsync is called inside the callback.
  await db.execAsync('BEGIN');
  try {
    // 1. Update the denormalized running total on inventory_items.
    await db.runAsync(
      `UPDATE inventory_items
       SET quantity   = MAX(0, quantity + ?),
           updated_at = ?,
           is_synced  = 0
       WHERE id = ? AND deleted_at IS NULL`,
      [input.quantityDelta, now, input.productId],
    );

    // 2. Read back the exact quantity_after (accounts for MAX(0,...) clamp).
    const updated = await db.getFirstAsync<{ quantity: number }>(
      `SELECT quantity FROM inventory_items WHERE id = ?`,
      [input.productId],
    );
    const quantityAfter = updated?.quantity ?? 0;

    // 3. Insert the immutable movement row.
    await db.runAsync(
      `INSERT INTO ${TABLE}
         (id, product_id, product_name, quantity_delta, quantity_after,
          movement_type, cost_price, reference_id, reference_type,
          notes, performed_by, moved_at, created_at, is_synced)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [
        id,
        input.productId,
        input.productName,
        input.quantityDelta,
        quantityAfter,
        input.movementType,
        input.costPrice      ?? null,
        input.referenceId    ?? null,
        input.referenceType  ?? null,
        input.notes          ?? null,
        input.performedBy    ?? null,
        movedAt,
        now,
      ],
    );

    await db.execAsync('COMMIT');
  } catch (err) {
    await db.execAsync('ROLLBACK');
    throw err;
  }

  // Read back the inserted row to return the full domain object.
  const row = await db.getFirstAsync<StockMovementRow>(
    `SELECT ${COLUMNS} FROM ${TABLE} WHERE id = ?`,
    [id],
  );
  if (row === null) {
    throw new Error(
      `[stock_movements] INSERT succeeded but SELECT returned null for id=${id}.`,
    );
  }
  return toDomain(row);
}

// ─── Read ─────────────────────────────────────────────────────────────────────

/**
 * Returns the current stock quantity for a product by reading the
 * denormalized `inventory_items.quantity` column (O(1)).
 *
 * Returns `null` when the product does not exist or is soft-deleted.
 *
 * For an audit-accurate computation, use `reconcileStock` which sums
 * the movement ledger directly.
 */
export async function getCurrentStock(productId: string): Promise<number | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ quantity: number }>(
    `SELECT quantity FROM inventory_items WHERE id = ? AND deleted_at IS NULL`,
    [productId],
  );
  return row?.quantity ?? null;
}

/**
 * Returns the current stock by summing all movement deltas for a product.
 *
 * This is the audit-accurate path: it recomputes the running total from the
 * immutable ledger and is useful for:
 *   - Data integrity checks after a sync conflict.
 *   - Verifying that inventory_items.quantity has not drifted.
 *   - Batch reconciliation jobs.
 *
 * It is more expensive than `getCurrentStock` (a full table scan over
 * stock_movements for this product) and should NOT be used on every render.
 *
 * Returns 0 when no movement rows exist (new product with no stock yet).
 */
export async function reconcileStock(productId: string): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ total: number | null }>(
    `SELECT SUM(quantity_delta) AS total
     FROM ${TABLE}
     WHERE product_id = ?`,
    [productId],
  );
  return row?.total ?? 0;
}

/**
 * Returns paginated movement history for a product, ordered newest first.
 *
 * All filter fields are optional. When none are provided, all movements
 * across all products are returned (use with a limit).
 */
export async function getStockMovements(
  opts: GetStockMovementsOptions = {},
): Promise<StockMovement[]> {
  const db = await getDatabase();

  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (opts.productId !== undefined) {
    conditions.push('product_id = ?');
    params.push(opts.productId);
  }
  if (opts.movementType !== undefined) {
    conditions.push('movement_type = ?');
    params.push(opts.movementType);
  }
  if (opts.fromDate !== undefined) {
    conditions.push('moved_at >= ?');
    params.push(opts.fromDate);
  }
  if (opts.toDate !== undefined) {
    conditions.push('moved_at <= ?');
    params.push(opts.toDate);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit  = opts.limit  !== undefined ? `LIMIT ${opts.limit}`   : '';
  const offset = opts.offset !== undefined ? `OFFSET ${opts.offset}` : '';

  const rows = await db.getAllAsync<StockMovementRow>(
    `SELECT ${COLUMNS}
     FROM ${TABLE}
     ${where}
     ORDER BY moved_at DESC, created_at DESC
     ${limit} ${offset}`,
    params,
  );

  return rows.map(toDomain);
}

/**
 * Returns all movements for a specific product, newest first.
 * Sugar over `getStockMovements` — kept as a named export for call-site clarity.
 */
export async function getStockMovementsByProduct(
  productId: string,
  limit = 50,
  offset = 0,
): Promise<StockMovement[]> {
  return getStockMovements({ productId, limit, offset });
}

/**
 * Returns a single movement row by its primary key, or null if not found.
 */
export async function getStockMovementById(
  id: string,
): Promise<StockMovement | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<StockMovementRow>(
    `SELECT ${COLUMNS} FROM ${TABLE} WHERE id = ?`,
    [id],
  );
  return row !== null ? toDomain(row) : null;
}

/**
 * Returns a per-type breakdown of movement totals for a product.
 * Useful for a stock history summary card.
 */
export async function getStockMovementSummary(
  productId: string,
): Promise<Array<{ movementType: StockMovementType; totalDelta: number; eventCount: number }>> {
  const db = await getDatabase();

  const rows = await db.getAllAsync<{
    movement_type: StockMovementType;
    total_delta:   number;
    event_count:   number;
  }>(
    `SELECT movement_type,
            SUM(quantity_delta) AS total_delta,
            COUNT(*)            AS event_count
     FROM ${TABLE}
     WHERE product_id = ?
     GROUP BY movement_type
     ORDER BY movement_type ASC`,
    [productId],
  );

  return rows.map((r) => ({
    movementType: r.movement_type,
    totalDelta:   r.total_delta,
    eventCount:   r.event_count,
  }));
}

/**
 * Marks a batch of movement rows as synced after a successful remote write.
 */
export async function markMovementsSynced(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const db           = await getDatabase();
  const placeholders = ids.map(() => '?').join(', ');
  await db.runAsync(
    `UPDATE ${TABLE} SET is_synced = 1 WHERE id IN (${placeholders})`,
    ids,
  );
}

/**
 * Returns all movement rows that have not yet been pushed to the remote API.
 * Used by the background sync worker.
 */
export async function getUnsyncedMovements(): Promise<StockMovement[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<StockMovementRow>(
    `SELECT ${COLUMNS}
     FROM ${TABLE}
     WHERE is_synced = 0
     ORDER BY created_at ASC
     LIMIT 500`,
    [],
  );
  return rows.map(toDomain);
}
