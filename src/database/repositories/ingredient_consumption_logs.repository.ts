/**
 * ingredient_consumption_logs.repository.ts
 *
 * All SQLite access for `ingredient_consumption_logs`.
 * No SQL may appear in screens, hooks, or Zustand stores — they call
 * these functions exclusively.
 *
 * Key design contracts:
 *   - Rows are NEVER updated after insert. Corrections use a RETURN entry
 *     with a negative quantity_consumed.
 *   - `cancelConsumptionLog` is the only mutation — it stamps `cancelled_at`
 *     on an existing row so aggregate queries can exclude it.
 *   - All aggregate queries exclude cancelled rows by default.
 *   - `batchCreateConsumptionLogs` is designed to run inside an existing
 *     `withTransactionAsync` block (production_logs.repository uses it).
 */

import { getDatabase } from '../database';
import type { IngredientConsumptionLogRow } from '../schemas/ingredient_consumption_logs.schema';
import type {
  IngredientConsumptionLog,
  IngredientConsumptionLogDetail,
  IngredientConsumptionSummary,
  IngredientConsumptionTrigger,
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

function toDomain(row: IngredientConsumptionLogRow): IngredientConsumptionLog {
  return {
    id:               row.id,
    ingredientId:     row.ingredient_id,
    quantityConsumed: row.quantity_consumed,
    unit:             row.unit,
    triggerType:      row.trigger_type as IngredientConsumptionTrigger,
    totalCost:        row.total_cost,
    consumedAt:       row.consumed_at,
    createdAt:        row.created_at,
    ...(row.reference_id   !== null ? { referenceId:   row.reference_id   } : {}),
    ...(row.reference_type !== null ? { referenceType: row.reference_type } : {}),
    ...(row.notes          !== null ? { notes:         row.notes          } : {}),
    ...(row.cost_price     !== null ? { costPrice:     row.cost_price     } : {}),
    ...(row.performed_by   !== null ? { performedBy:   row.performed_by   } : {}),
    ...(row.cancelled_at   !== null ? { cancelledAt:   row.cancelled_at   } : {}),
    ...(row.product_id     !== null ? { productId:     row.product_id     } : {}),
    ...(row.product_name   !== null ? { productName:   row.product_name   } : {}),
  };
}

// ─── Input types ──────────────────────────────────────────────────────────────

export interface CreateConsumptionLogInput {
  ingredientId:     string;
  quantityConsumed: number;
  unit:             string;
  triggerType:      IngredientConsumptionTrigger;
  referenceId?:     string;
  referenceType?:   string;
  notes?:           string;
  /** Snapshot of cost_price at the time of the event. */
  costPrice?:       number;
  /** Derived: quantity_consumed × costPrice. Pass 0 when costPrice is unknown. */
  totalCost:        number;
  performedBy?:     string;
  /** Defaults to now() when omitted. */
  consumedAt?:      string;
  /** FK to inventory_items.id — the finished product this ingredient was consumed for. */
  productId?:       string;
  /** Denormalized snapshot of the product name at time of consumption. */
  productName?:     string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TABLE = 'ingredient_consumption_logs';

const INSERT_SQL = `
  INSERT INTO ${TABLE}
    (id, ingredient_id, quantity_consumed, unit, trigger_type,
     reference_id, reference_type, notes, cost_price, total_cost,
     performed_by, consumed_at, created_at, cancelled_at,
     product_id, product_name)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)
`;

// ─── Repository functions ─────────────────────────────────────────────────────

/**
 * Inserts a single consumption log row.
 * Returns the persisted domain object.
 */
export async function createConsumptionLog(
  input: CreateConsumptionLogInput,
): Promise<IngredientConsumptionLog> {
  const db  = await getDatabase();
  const id  = generateUUID();
  const now = new Date().toISOString();
  const consumedAt = input.consumedAt ?? now;

  await db.runAsync(INSERT_SQL, [
    id,
    input.ingredientId,
    input.quantityConsumed,
    input.unit,
    input.triggerType,
    input.referenceId   ?? null,
    input.referenceType ?? null,
    input.notes         ?? null,
    input.costPrice     ?? null,
    input.totalCost,
    input.performedBy   ?? null,
    consumedAt,
    now,
    input.productId     ?? null,
    input.productName   ?? null,
  ]);

  const row = await db.getFirstAsync<IngredientConsumptionLogRow>(
    `SELECT id, ingredient_id, quantity_consumed, unit, trigger_type,
            reference_id, reference_type, notes, cost_price, total_cost,
            performed_by, consumed_at, created_at, cancelled_at,
            product_id, product_name
     FROM ${TABLE} WHERE id = ?`,
    [id],
  );

  if (row === null) {
    throw new Error(
      `[ingredient_consumption_logs] INSERT succeeded but SELECT returned null for id=${id}`,
    );
  }

  return toDomain(row);
}

/**
 * Inserts multiple consumption log rows in a single transaction.
 *
 * Intended to be called from `production_logs.repository.createProductionLog`
 * so that the production header, ingredient line items, and consumption logs
 * all commit or roll back together.
 *
 * IMPORTANT: This function opens its OWN transaction. Do NOT call it from
 * inside an existing `withTransactionAsync` — SQLite (expo-sqlite) does not
 * support nested transactions. Instead call `batchCreateConsumptionLogsRaw`
 * (below) when you need to insert inside a caller-owned transaction.
 */
export async function batchCreateConsumptionLogs(
  inputs: CreateConsumptionLogInput[],
): Promise<IngredientConsumptionLog[]> {
  if (inputs.length === 0) return [];

  const db  = await getDatabase();
  const now = new Date().toISOString();
  const ids: string[] = inputs.map(() => generateUUID());

  await db.withTransactionAsync(async () => {
    for (let i = 0; i < inputs.length; i++) {
      const input      = inputs[i] ?? (inputs[0] as CreateConsumptionLogInput);
      const id         = ids[i]    ?? ids[0] as string;
      const consumedAt = input.consumedAt ?? now;

      await db.runAsync(INSERT_SQL, [
        id,
        input.ingredientId,
        input.quantityConsumed,
        input.unit,
        input.triggerType,
        input.referenceId   ?? null,
        input.referenceType ?? null,
        input.notes         ?? null,
        input.costPrice     ?? null,
        input.totalCost,
        input.performedBy   ?? null,
        consumedAt,
        now,
        input.productId     ?? null,
        input.productName   ?? null,
      ]);
    }
  });

  // Fetch all inserted rows in one query
  const placeholders = ids.map(() => '?').join(', ');
  const rows = await db.getAllAsync<IngredientConsumptionLogRow>(
    `SELECT id, ingredient_id, quantity_consumed, unit, trigger_type,
            reference_id, reference_type, notes, cost_price, total_cost,
            performed_by, consumed_at, created_at, cancelled_at,
            product_id, product_name
     FROM ${TABLE} WHERE id IN (${placeholders}) ORDER BY consumed_at ASC`,
    ids,
  );

  return rows.map(toDomain);
}

/**
 * Low-level batch insert — does NOT open its own transaction.
 * Use this when you need to insert consumption logs inside a caller-owned
 * `withTransactionAsync` block (e.g. from production_logs.repository).
 *
 * Returns the generated IDs so the caller can fetch the rows afterwards
 * if needed. Returns void for simplicity since callers typically do not
 * need the inserted domain objects mid-transaction.
 */
export async function batchInsertConsumptionLogsInTx(
  db: import('expo-sqlite').SQLiteDatabase,
  inputs: CreateConsumptionLogInput[],
  now: string,
): Promise<void> {
  for (const input of inputs) {
    const id         = generateUUID();
    const consumedAt = input.consumedAt ?? now;

    await db.runAsync(INSERT_SQL, [
      id,
      input.ingredientId,
      input.quantityConsumed,
      input.unit,
      input.triggerType,
      input.referenceId   ?? null,
      input.referenceType ?? null,
      input.notes         ?? null,
      input.costPrice     ?? null,
      input.totalCost,
      input.performedBy   ?? null,
      consumedAt,
      now,
      input.productId     ?? null,
      input.productName   ?? null,
    ]);
  }
}

/**
 * Soft-cancels a log row by stamping `cancelled_at`.
 * Use when the parent production log is voided.
 */
export async function cancelConsumptionLog(id: string): Promise<void> {
  const db  = await getDatabase();
  const now = new Date().toISOString();

  await db.runAsync(
    `UPDATE ${TABLE} SET cancelled_at = ? WHERE id = ? AND cancelled_at IS NULL`,
    [now, id],
  );
}

/**
 * Soft-cancels all consumption logs associated with a reference document.
 * Typical use: voiding a production log cancels all its consumption entries.
 */
export async function cancelConsumptionLogsByReference(
  referenceId:   string,
  referenceType: string,
): Promise<void> {
  const db  = await getDatabase();
  const now = new Date().toISOString();

  await db.runAsync(
    `UPDATE ${TABLE}
     SET cancelled_at = ?
     WHERE reference_id = ? AND reference_type = ? AND cancelled_at IS NULL`,
    [now, referenceId, referenceType],
  );
}

// ─── Query functions ──────────────────────────────────────────────────────────

export interface GetConsumptionLogsOptions {
  ingredientId?:  string;
  triggerType?:   IngredientConsumptionTrigger;
  referenceId?:   string;
  referenceType?: string;
  /** ISO 8601 date prefix, e.g. '2026-03-01' */
  fromDate?:      string;
  toDate?:        string;
  includeCancelled?: boolean;
  limit?:         number;
  offset?:        number;
}

/**
 * Returns consumption logs with the ingredient name joined in,
 * filtered by the supplied options. Cancelled rows excluded by default.
 */
export async function getConsumptionLogs(
  options?: GetConsumptionLogsOptions,
): Promise<IngredientConsumptionLogDetail[]> {
  const db = await getDatabase();

  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (options?.ingredientId !== undefined) {
    conditions.push('cl.ingredient_id = ?');
    params.push(options.ingredientId);
  }
  if (options?.triggerType !== undefined) {
    conditions.push('cl.trigger_type = ?');
    params.push(options.triggerType);
  }
  if (options?.referenceId !== undefined) {
    conditions.push('cl.reference_id = ?');
    params.push(options.referenceId);
  }
  if (options?.referenceType !== undefined) {
    conditions.push('cl.reference_type = ?');
    params.push(options.referenceType);
  }
  if (options?.fromDate !== undefined) {
    conditions.push('cl.consumed_at >= ?');
    params.push(options.fromDate);
  }
  if (options?.toDate !== undefined) {
    conditions.push('cl.consumed_at <= ?');
    params.push(options.toDate + 'T23:59:59.999Z');
  }
  if (!(options?.includeCancelled === true)) {
    conditions.push('cl.cancelled_at IS NULL');
  }

  const where   = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limitQ  = options?.limit  !== undefined ? `LIMIT ${options.limit}`           : '';
  const offsetQ = options?.offset !== undefined ? `OFFSET ${options.offset}`         : '';

  const rows = await db.getAllAsync<IngredientConsumptionLogRow & { ingredient_name: string | null }>(
    `SELECT cl.id, cl.ingredient_id, cl.quantity_consumed, cl.unit,
            cl.trigger_type, cl.reference_id, cl.reference_type, cl.notes,
            cl.cost_price, cl.total_cost, cl.performed_by,
            cl.consumed_at, cl.created_at, cl.cancelled_at,
            cl.product_id, cl.product_name,
            ii.name AS ingredient_name
     FROM ${TABLE} cl
     LEFT JOIN inventory_items ii ON ii.id = cl.ingredient_id
     ${where}
     ORDER BY cl.consumed_at DESC
     ${limitQ}
     ${offsetQ}`,
    params,
  );

  return rows.map((r) => ({
    ...toDomain(r),
    // Fallback to the ingredient_id when the inventory item has been hard-deleted
    ingredientName: r.ingredient_name ?? r.ingredient_id,
  }));
}

/**
 * Returns the count of active (non-cancelled) consumption log rows
 * matching the given filters. Used for pagination UI.
 */
export async function getConsumptionLogCount(
  options?: Omit<GetConsumptionLogsOptions, 'limit' | 'offset'>,
): Promise<number> {
  const db = await getDatabase();

  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (options?.ingredientId  !== undefined) { conditions.push('ingredient_id = ?');      params.push(options.ingredientId);  }
  if (options?.triggerType   !== undefined) { conditions.push('trigger_type = ?');        params.push(options.triggerType);   }
  if (options?.referenceId   !== undefined) { conditions.push('reference_id = ?');        params.push(options.referenceId);   }
  if (options?.referenceType !== undefined) { conditions.push('reference_type = ?');      params.push(options.referenceType); }
  if (options?.fromDate      !== undefined) { conditions.push('consumed_at >= ?');        params.push(options.fromDate);      }
  if (options?.toDate        !== undefined) { conditions.push('consumed_at <= ?');        params.push(options.toDate + 'T23:59:59.999Z'); }
  if (!(options?.includeCancelled === true)) { conditions.push('cancelled_at IS NULL');   }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const row = await db.getFirstAsync<{ total: number | null }>(
    `SELECT COUNT(*) AS total FROM ${TABLE} ${where}`,
    params,
  );

  return row?.total ?? 0;
}

/**
 * Returns per-ingredient consumption totals for the given date range.
 * Excludes cancelled rows and groups by ingredient.
 * Useful for the summary header of the ingredient-logs screen.
 */
export async function getIngredientConsumptionSummary(options?: {
  fromDate?: string;
  toDate?:   string;
  triggerType?: IngredientConsumptionTrigger;
}): Promise<IngredientConsumptionSummary[]> {
  const db = await getDatabase();

  const conditions: string[] = ['cl.cancelled_at IS NULL'];
  const params: (string | number)[] = [];

  if (options?.fromDate    !== undefined) { conditions.push('cl.consumed_at >= ?'); params.push(options.fromDate); }
  if (options?.toDate      !== undefined) { conditions.push('cl.consumed_at <= ?'); params.push(options.toDate + 'T23:59:59.999Z'); }
  if (options?.triggerType !== undefined) { conditions.push('cl.trigger_type = ?'); params.push(options.triggerType); }

  const where = `WHERE ${conditions.join(' AND ')}`;

  const rows = await db.getAllAsync<{
    ingredient_id:   string;
    ingredient_name: string | null;
    total_consumed:  number;
    unit:            string;
    total_cost:      number;
    event_count:     number;
  }>(
    `SELECT cl.ingredient_id,
            ii.name              AS ingredient_name,
            SUM(cl.quantity_consumed) AS total_consumed,
            cl.unit,
            SUM(cl.total_cost)   AS total_cost,
            COUNT(cl.id)         AS event_count
     FROM ${TABLE} cl
     LEFT JOIN inventory_items ii ON ii.id = cl.ingredient_id
     ${where}
     GROUP BY cl.ingredient_id
     ORDER BY total_consumed DESC`,
    params,
  );

  return rows.map((r) => ({
    ingredientId:   r.ingredient_id,
    // Fallback to the ingredient_id when the inventory item has been hard-deleted
    ingredientName: r.ingredient_name ?? r.ingredient_id,
    totalConsumed:  r.total_consumed,
    unit:           r.unit,
    totalCost:      r.total_cost,
    eventCount:     r.event_count,
  }));
}

/**
 * Returns a daily aggregate of consumption quantity and cost for the last
 * `days` days across all ingredients (or a specific one).
 * Used for trend charts on the ingredient-logs screen.
 */
export async function getDailyConsumptionTrend(
  days:          number,
  ingredientId?: string,
): Promise<{ date: string; totalConsumed: number; totalCost: number }[]> {
  const db = await getDatabase();

  const from = new Date();
  from.setDate(from.getDate() - (days - 1));
  const fromPrefix = from.toISOString().slice(0, 10);

  const conditions = ['cancelled_at IS NULL', 'consumed_at >= ?'];
  const params: (string | number)[] = [fromPrefix];

  if (ingredientId !== undefined) {
    conditions.push('ingredient_id = ?');
    params.push(ingredientId);
  }

  const where = `WHERE ${conditions.join(' AND ')}`;

  const rows = await db.getAllAsync<{
    date:            string;
    total_consumed:  number;
    total_cost:      number;
  }>(
    `SELECT substr(consumed_at, 1, 10) AS date,
            SUM(quantity_consumed)      AS total_consumed,
            SUM(total_cost)             AS total_cost
     FROM ${TABLE}
     ${where}
     GROUP BY date
     ORDER BY date ASC`,
    params,
  );

  return rows.map((r) => ({
    date:          r.date,
    totalConsumed: r.total_consumed,
    totalCost:     r.total_cost,
  }));
}

/**
 * Returns the all-time total monetary cost of ingredient consumption events
 * where trigger_type = 'WASTAGE'. Cancelled rows are excluded.
 *
 * Used by the dashboard to surface ingredient waste cost as a standalone KPI.
 * The result is not period-filtered — it represents the lifetime waste spend
 * so the dashboard can compare it against other all-time cost figures.
 */
export async function getIngredientWasteCost(): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ total: number | null }>(
    `SELECT SUM(total_cost) AS total
     FROM ${TABLE}
     WHERE trigger_type = 'WASTAGE'
       AND cancelled_at IS NULL`,
  );
  return row?.total ?? 0;
}

/**
 * Returns the total quantity consumed for a specific ingredient within an
 * optional date range. Excludes cancelled rows.
 */
export async function getIngredientTotalConsumed(
  ingredientId: string,
  fromDate?:    string,
  toDate?:      string,
): Promise<number> {
  const db = await getDatabase();

  const conditions = ['ingredient_id = ?', 'cancelled_at IS NULL'];
  const params: (string | number)[] = [ingredientId];

  if (fromDate !== undefined) { conditions.push('consumed_at >= ?'); params.push(fromDate); }
  if (toDate   !== undefined) { conditions.push('consumed_at <= ?'); params.push(toDate + 'T23:59:59.999Z'); }

  const row = await db.getFirstAsync<{ total: number | null }>(
    `SELECT SUM(quantity_consumed) AS total FROM ${TABLE} WHERE ${conditions.join(' AND ')}`,
    params,
  );

  return row?.total ?? 0;
}
