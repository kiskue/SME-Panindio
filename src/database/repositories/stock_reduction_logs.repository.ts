/**
 * stock_reduction_logs.repository.ts
 *
 * All SQLite access for `stock_reduction_logs`.
 * No SQL may appear in screens, hooks, or Zustand stores — they call
 * these functions exclusively.
 *
 * Key design contracts:
 *   - Rows are NEVER updated after insert. The table is an immutable audit
 *     ledger. If a reduction was recorded in error, correct the inventory_items
 *     quantity directly — do NOT delete or update rows here.
 *   - `units_reduced` is always POSITIVE.
 *   - `item_name` must be passed by the caller as a denormalised snapshot
 *     so the audit log remains readable after renames or deletions.
 *   - `reducedAt` defaults to the current ISO 8601 timestamp when omitted.
 *   - Product rows must supply `productId` + `productName` in addition to
 *     `itemName`. Ingredient rows omit `productId` / `productName`.
 */

import { getDatabase } from '../database';
import type { StockReductionLogRow } from '../schemas/stock_reduction_logs.schema';
import type {
  StockReductionLog,
  CreateStockReductionLogInput,
  GetStockReductionLogsOptions,
} from '@/types';

// ─── UUID helper ──────────────────────────────────────────────────────────────

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ─── Domain mapping ───────────────────────────────────────────────────────────

function toDomain(row: StockReductionLogRow): StockReductionLog {
  return {
    id:           row.id,
    itemType:     row.item_type as StockReductionLog['itemType'],
    itemName:     row.item_name,
    unitsReduced: row.units_reduced,
    reason:       row.reason as StockReductionLog['reason'],
    reducedAt:    row.reduced_at,
    createdAt:    row.created_at,
    isSynced:     row.is_synced === 1,
    ...(row.product_id   !== null ? { productId:   row.product_id   } : {}),
    ...(row.product_name !== null ? { productName: row.product_name } : {}),
    ...(row.notes        !== null ? { notes:       row.notes        } : {}),
    ...(row.performed_by !== null ? { performedBy: row.performed_by } : {}),
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TABLE = 'stock_reduction_logs';

const SELECT_COLUMNS = `
  id, item_type, item_name, product_id, product_name,
  units_reduced, reason, notes, performed_by,
  reduced_at, created_at, is_synced
`;

const INSERT_SQL = `
  INSERT INTO ${TABLE}
    (id, item_type, item_name, product_id, product_name,
     units_reduced, reason, notes, performed_by,
     reduced_at, created_at, is_synced)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
`;

// ─── Write functions ──────────────────────────────────────────────────────────

/**
 * Inserts a single stock reduction log row and returns the persisted domain
 * object. The caller is responsible for also decrementing the item's
 * quantity in `inventory_items` within the same operation.
 *
 * For ingredient reductions, also insert a corresponding entry in
 * `ingredient_consumption_logs` with trigger_type = 'WASTAGE' or
 * 'MANUAL_ADJUSTMENT' as appropriate — that is handled by the service layer,
 * not here.
 */
export async function createStockReductionLog(
  input: CreateStockReductionLogInput,
): Promise<StockReductionLog> {
  const db        = await getDatabase();
  const id        = generateUUID();
  const now       = new Date().toISOString();
  const reducedAt = input.reducedAt ?? now;

  // Discriminate product vs ingredient to determine nullable FK columns.
  const productId   = input.itemType === 'product' ? input.productId   : null;
  const productName = input.itemType === 'product' ? input.productName : null;

  await db.runAsync(INSERT_SQL, [
    id,
    input.itemType,
    input.itemName,
    productId,
    productName,
    input.unitsReduced,
    input.reason,
    input.notes       ?? null,
    input.performedBy ?? null,
    reducedAt,
    now,
  ]);

  const row = await db.getFirstAsync<StockReductionLogRow>(
    `SELECT ${SELECT_COLUMNS} FROM ${TABLE} WHERE id = ?`,
    [id],
  );

  if (row === null) {
    throw new Error(
      `[stock_reduction_logs] INSERT succeeded but SELECT returned null for id=${id}`,
    );
  }

  return toDomain(row);
}

// ─── Query functions ──────────────────────────────────────────────────────────

/**
 * Returns stock reduction logs ordered newest-first.
 * Optionally filtered by item type, product, date range, and reason.
 * Supports limit/offset pagination.
 */
export async function getStockReductionLogs(
  options?: GetStockReductionLogsOptions,
): Promise<StockReductionLog[]> {
  const db = await getDatabase();

  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (options?.itemType !== undefined) {
    conditions.push('item_type = ?');
    params.push(options.itemType);
  }
  if (options?.productId !== undefined) {
    conditions.push('product_id = ?');
    params.push(options.productId);
  }
  if (options?.reason !== undefined) {
    conditions.push('reason = ?');
    params.push(options.reason);
  }
  if (options?.fromDate !== undefined) {
    conditions.push('reduced_at >= ?');
    params.push(options.fromDate);
  }
  if (options?.toDate !== undefined) {
    conditions.push('reduced_at <= ?');
    params.push(options.toDate + 'T23:59:59.999Z');
  }

  const where   = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limitQ  = options?.limit  !== undefined ? `LIMIT ${options.limit}`   : '';
  const offsetQ = options?.offset !== undefined ? `OFFSET ${options.offset}` : '';

  const rows = await db.getAllAsync<StockReductionLogRow>(
    `SELECT ${SELECT_COLUMNS}
     FROM ${TABLE}
     ${where}
     ORDER BY reduced_at DESC
     ${limitQ}
     ${offsetQ}`,
    params,
  );

  return rows.map(toDomain);
}

/**
 * Returns the total count of stock reduction logs matching the given filters.
 * Used to drive pagination controls on the audit screen.
 */
export async function getStockReductionLogCount(
  options?: Omit<GetStockReductionLogsOptions, 'limit' | 'offset'>,
): Promise<number> {
  const db = await getDatabase();

  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (options?.itemType  !== undefined) { conditions.push('item_type = ?');   params.push(options.itemType);  }
  if (options?.productId !== undefined) { conditions.push('product_id = ?');  params.push(options.productId); }
  if (options?.reason    !== undefined) { conditions.push('reason = ?');      params.push(options.reason);    }
  if (options?.fromDate  !== undefined) { conditions.push('reduced_at >= ?'); params.push(options.fromDate);  }
  if (options?.toDate    !== undefined) {
    conditions.push('reduced_at <= ?');
    params.push(options.toDate + 'T23:59:59.999Z');
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const row = await db.getFirstAsync<{ total: number | null }>(
    `SELECT COUNT(*) AS total FROM ${TABLE} ${where}`,
    params,
  );

  return row?.total ?? 0;
}

/**
 * Marks a batch of rows as synced after a successful API push.
 * Called by the background sync service — not by UI screens.
 */
export async function markStockReductionLogsSynced(ids: string[]): Promise<void> {
  if (ids.length === 0) return;

  const db = await getDatabase();
  const placeholders = ids.map(() => '?').join(', ');

  await db.runAsync(
    `UPDATE ${TABLE} SET is_synced = 1 WHERE id IN (${placeholders})`,
    ids,
  );
}

/**
 * Returns all unsynced log rows. Used by the background sync queue to
 * determine which records need to be pushed to the remote API.
 */
export async function getUnsyncedStockReductionLogs(): Promise<StockReductionLog[]> {
  const db = await getDatabase();

  const rows = await db.getAllAsync<StockReductionLogRow>(
    `SELECT ${SELECT_COLUMNS}
     FROM ${TABLE}
     WHERE is_synced = 0
     ORDER BY created_at ASC`,
    [],
  );

  return rows.map(toDomain);
}
