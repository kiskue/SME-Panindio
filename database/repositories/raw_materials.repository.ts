/**
 * raw_materials.repository.ts
 *
 * All SQLite access for `raw_materials`, `product_raw_materials`, and
 * `raw_material_consumption_logs` tables lives here.
 * No SQL may appear in screens, hooks, or Zustand stores.
 *
 * ID generation:
 *   Uses the same Math.random-based UUID helper as other repositories — the
 *   Hermes engine bundled with Expo SDK 54 / RN 0.81 does NOT expose
 *   `crypto.randomUUID()`, so we use a pure-JS RFC 4122 v4 implementation.
 */

import { getDatabase } from '../database';
import type { RawMaterialRow } from '../schemas/raw_materials.schema';
import { RAW_MATERIAL_COLUMNS } from '../schemas/raw_materials.schema';
import type { ProductRawMaterialRow } from '../schemas/product_raw_materials.schema';
import type { RawMaterialConsumptionLogRow } from '../schemas/raw_material_consumption_logs.schema';
import type {
  RawMaterial,
  CreateRawMaterialInput,
  UpdateRawMaterialInput,
  ProductRawMaterial,
  ProductRawMaterialInput,
  RawMaterialConsumptionLog,
  CreateRawMaterialConsumptionLogInput,
  RawMaterialUnit,
  RawMaterialCategory,
  RawMaterialReason,
  RawMaterialConsumptionLogDetail,
  RawMaterialConsumptionSummary,
  RawMaterialConsumptionTrend,
  GetRawMaterialLogsOptions,
  RawMaterialConsumedDetail,
} from '@/types';

// ─── UUID helper ──────────────────────────────────────────────────────────────

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ─── Column projection ────────────────────────────────────────────────────────

const RM_COLS = RAW_MATERIAL_COLUMNS.join(', ');
const RM_TABLE = 'raw_materials';

// ─── Domain mapping ───────────────────────────────────────────────────────────

function rowToDomain(row: RawMaterialRow): RawMaterial {
  return {
    id:                row.id,
    name:              row.name,
    unit:              row.unit as RawMaterialUnit,
    quantityInStock:   row.quantity_in_stock,
    minimumStockLevel: row.minimum_stock_level,
    costPerUnit:       row.cost_per_unit,
    isActive:          row.is_active === 1,
    isSynced:          row.is_synced === 1,
    createdAt:         row.created_at,
    updatedAt:         row.updated_at,
    ...(row.description !== null ? { description: row.description } : {}),
    ...(row.category    !== null ? { category:    row.category as RawMaterialCategory } : {}),
  };
}

function prmRowToDomain(row: ProductRawMaterialRow, material?: RawMaterial): ProductRawMaterial {
  return {
    id:               row.id,
    productId:        row.product_id,
    rawMaterialId:    row.raw_material_id,
    quantityRequired: row.quantity_required,
    unit:             row.unit as RawMaterialUnit,
    createdAt:        row.created_at,
    updatedAt:        row.updated_at,
    ...(material !== undefined ? { rawMaterial: material } : {}),
  };
}

function logRowToDomain(row: RawMaterialConsumptionLogRow): RawMaterialConsumptionLog {
  return {
    id:            row.id,
    rawMaterialId: row.raw_material_id,
    quantityUsed:  row.quantity_used,
    reason:        row.reason as RawMaterialReason,
    consumedAt:    row.consumed_at,
    createdAt:     row.created_at,
    ...(row.reference_id !== null ? { referenceId: row.reference_id } : {}),
    ...(row.notes        !== null ? { notes:       row.notes        } : {}),
  };
}

// ─── Raw Materials CRUD ───────────────────────────────────────────────────────

/**
 * Fetch all raw materials.
 * @param activeOnly — when true (default), only returns is_active = 1 rows.
 */
export async function getAllRawMaterials(activeOnly = true): Promise<RawMaterial[]> {
  const db = await getDatabase();
  const sql = activeOnly
    ? `SELECT ${RM_COLS} FROM ${RM_TABLE} WHERE is_active = 1 ORDER BY name ASC`
    : `SELECT ${RM_COLS} FROM ${RM_TABLE} ORDER BY name ASC`;
  const rows = await db.getAllAsync<RawMaterialRow>(sql);
  return rows.map(rowToDomain);
}

/** Fetch a single raw material by ID. Returns null when not found. */
export async function getRawMaterialById(id: string): Promise<RawMaterial | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<RawMaterialRow>(
    `SELECT ${RM_COLS} FROM ${RM_TABLE} WHERE id = ?`,
    [id],
  );
  return row ? rowToDomain(row) : null;
}

/** Insert a new raw material and return the created domain object. */
export async function createRawMaterial(data: CreateRawMaterialInput): Promise<RawMaterial> {
  const db  = await getDatabase();
  const now = new Date().toISOString();
  const id  = generateUUID();

  await db.runAsync(
    `INSERT INTO ${RM_TABLE}
       (id, name, description, unit, quantity_in_stock, minimum_stock_level,
        cost_per_unit, category, is_active, created_at, updated_at, is_synced)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, 0)`,
    [
      id,
      data.name,
      data.description ?? null,
      data.unit,
      data.quantityInStock,
      data.minimumStockLevel,
      data.costPerUnit,
      data.category ?? null,
      now,
      now,
    ],
  );

  const created = await getRawMaterialById(id);
  if (!created) throw new Error(`Failed to read back raw material ${id} after insert`);
  return created;
}

/** Patch an existing raw material and return the updated domain object. */
export async function updateRawMaterial(
  id: string,
  data: UpdateRawMaterialInput,
): Promise<RawMaterial> {
  const db  = await getDatabase();
  const now = new Date().toISOString();

  const setClauses: string[] = ['updated_at = ?'];
  const params: (string | number | null)[] = [now];

  if (data.name               !== undefined) { setClauses.push('name = ?');                params.push(data.name); }
  if (data.description        !== undefined) { setClauses.push('description = ?');         params.push(data.description ?? null); }
  if (data.unit               !== undefined) { setClauses.push('unit = ?');                params.push(data.unit); }
  if (data.quantityInStock    !== undefined) { setClauses.push('quantity_in_stock = ?');   params.push(data.quantityInStock); }
  if (data.minimumStockLevel  !== undefined) { setClauses.push('minimum_stock_level = ?'); params.push(data.minimumStockLevel); }
  if (data.costPerUnit        !== undefined) { setClauses.push('cost_per_unit = ?');       params.push(data.costPerUnit); }
  if (data.category           !== undefined) { setClauses.push('category = ?');            params.push(data.category ?? null); }

  params.push(id);

  await db.runAsync(
    `UPDATE ${RM_TABLE} SET ${setClauses.join(', ')} WHERE id = ?`,
    params,
  );

  const updated = await getRawMaterialById(id);
  if (!updated) throw new Error(`Raw material ${id} not found after update`);
  return updated;
}

/**
 * Soft-delete a raw material by setting is_active = 0.
 * The row is never hard-deleted so audit trails and product links remain intact.
 */
export async function deleteRawMaterial(id: string): Promise<void> {
  const db  = await getDatabase();
  const now = new Date().toISOString();
  await db.runAsync(
    `UPDATE ${RM_TABLE} SET is_active = 0, updated_at = ? WHERE id = ?`,
    [now, id],
  );
}

/**
 * Apply a signed quantity delta to `quantity_in_stock`.
 * Positive delta = stock added; negative delta = stock consumed.
 * The caller is responsible for writing a consumption log entry separately
 * when needed (see `logRawMaterialConsumption`).
 */
export async function updateRawMaterialStock(id: string, delta: number): Promise<void> {
  const db  = await getDatabase();
  const now = new Date().toISOString();
  await db.runAsync(
    `UPDATE ${RM_TABLE}
     SET quantity_in_stock = MAX(0, quantity_in_stock + ?),
         updated_at = ?
     WHERE id = ?`,
    [delta, now, id],
  );
}

/**
 * Returns all active raw materials where quantity_in_stock <= minimum_stock_level.
 */
export async function getLowStockRawMaterials(): Promise<RawMaterial[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<RawMaterialRow>(
    `SELECT ${RM_COLS} FROM ${RM_TABLE}
     WHERE is_active = 1 AND quantity_in_stock <= minimum_stock_level
     ORDER BY quantity_in_stock ASC`,
  );
  return rows.map(rowToDomain);
}

// ─── Product–RawMaterial links ────────────────────────────────────────────────

/**
 * Returns all raw material requirements for a given product, joined with
 * raw material details.
 */
export async function getRawMaterialsByProduct(productId: string): Promise<ProductRawMaterial[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<ProductRawMaterialRow & RawMaterialRow>(
    `SELECT
       prm.id, prm.product_id, prm.raw_material_id, prm.quantity_required,
       prm.unit, prm.created_at, prm.updated_at,
       rm.id               AS rm_id,
       rm.name             AS rm_name,
       rm.description      AS rm_description,
       rm.unit             AS rm_unit,
       rm.quantity_in_stock,
       rm.minimum_stock_level,
       rm.cost_per_unit,
       rm.category,
       rm.is_active,
       rm.created_at       AS rm_created_at,
       rm.updated_at       AS rm_updated_at,
       rm.is_synced        AS rm_is_synced
     FROM product_raw_materials prm
     LEFT JOIN raw_materials rm ON rm.id = prm.raw_material_id
     WHERE prm.product_id = ?
     ORDER BY COALESCE(rm.name, '') ASC`,
    [productId],
  );

  return rows.map((r) => {
    // After a LEFT JOIN, rm.* columns are NULL when the raw_material row no longer
    // exists (e.g. a hard-delete that bypassed the soft-delete path). We build a
    // safe fallback so the link row is still returned rather than crashing the mapper.
    const rec = r as unknown as Record<string, string | number | null>;
    const rmId   = (rec['rm_id']  as string | null)  ?? r.raw_material_id;
    const rmName = (rec['rm_name'] as string | null) ?? '';
    const rmUnit = (rec['rm_unit'] as string | null) ?? r.unit;

    const material: RawMaterial = {
      id:                rmId,
      name:              rmName,
      unit:              rmUnit as RawMaterialUnit,
      quantityInStock:   (r.quantity_in_stock   as number | null) ?? 0,
      minimumStockLevel: (r.minimum_stock_level as number | null) ?? 0,
      costPerUnit:       (r.cost_per_unit       as number | null) ?? 0,
      isActive:          (rec['is_active']    as number | null) === 1,
      isSynced:          (rec['rm_is_synced'] as number | null) === 1,
      createdAt:         (rec['rm_created_at'] as string | null) ?? r.created_at,
      updatedAt:         (rec['rm_updated_at'] as string | null) ?? r.updated_at,
      ...((rec['rm_description'] as string | null) !== null
        ? { description: rec['rm_description'] as string }
        : {}),
      ...((rec['category'] as string | null) !== null
        ? { category: rec['category'] as RawMaterialCategory }
        : {}),
    };
    return prmRowToDomain(
      {
        id:                r.id,
        product_id:        r.product_id,
        raw_material_id:   r.raw_material_id,
        quantity_required: r.quantity_required,
        unit:              r.unit,
        created_at:        r.created_at,
        updated_at:        r.updated_at,
      },
      material,
    );
  });
}

/**
 * Replace the entire set of raw material requirements for a product.
 * Deletes existing rows then inserts the new set in a single transaction.
 */
export async function setProductRawMaterials(
  productId: string,
  materials: ProductRawMaterialInput[],
): Promise<void> {
  const db  = await getDatabase();
  const now = new Date().toISOString();

  await db.execAsync('BEGIN');
  try {
    await db.runAsync(
      `DELETE FROM product_raw_materials WHERE product_id = ?`,
      [productId],
    );

    for (const m of materials) {
      const rmRow = await getRawMaterialById(m.rawMaterialId);
      if (!rmRow) continue; // skip unknown references silently

      await db.runAsync(
        `INSERT INTO product_raw_materials
           (id, product_id, raw_material_id, quantity_required, unit, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          generateUUID(),
          productId,
          m.rawMaterialId,
          m.quantityRequired,
          rmRow.unit,
          now,
          now,
        ],
      );
    }

    await db.execAsync('COMMIT');
  } catch (err) {
    await db.execAsync('ROLLBACK');
    throw err;
  }
}

// ─── In-transaction batch deduction ──────────────────────────────────────────

/**
 * One entry in a raw-material production deduction batch.
 * `quantityUsed` is always a positive number — it represents what is consumed.
 */
export interface RawMaterialDeductionInput {
  rawMaterialId: string;
  quantityUsed:  number;
  referenceId:   string; // production_log id
  notes?:        string;
}

/**
 * Deduct stock for each raw material AND insert a consumption log row, all
 * within the caller's already-open transaction.
 *
 * Call this from inside a `db.withTransactionAsync` block — do NOT open a
 * nested transaction here. The caller owns the transaction boundary.
 *
 * Each row uses `reason = 'production'` and links back to the production log
 * via `reference_id`.
 */
export async function batchDeductRawMaterialsInTx(
  db:      import('expo-sqlite').SQLiteDatabase,
  inputs:  RawMaterialDeductionInput[],
  now:     string,
): Promise<void> {
  for (const input of inputs) {
    // 1. Apply signed delta (negative = consume)
    await db.runAsync(
      `UPDATE raw_materials
       SET quantity_in_stock = MAX(0, quantity_in_stock - ?),
           updated_at = ?
       WHERE id = ?`,
      [input.quantityUsed, now, input.rawMaterialId],
    );

    // 2. Write the immutable audit log row
    await db.runAsync(
      `INSERT INTO raw_material_consumption_logs
         (id, raw_material_id, quantity_used, reason, reference_id, notes,
          consumed_at, created_at, is_synced)
       VALUES (?, ?, ?, 'production', ?, ?, ?, ?, 0)`,
      [
        generateUUID(),
        input.rawMaterialId,
        input.quantityUsed,
        input.referenceId,
        input.notes ?? null,
        now,
        now,
      ],
    );
  }
}

// ─── Consumption log ─────────────────────────────────────────────────────────

/**
 * Insert a consumption log entry.
 * Call this alongside `updateRawMaterialStock` when you need an audit trail.
 */
export async function logRawMaterialConsumption(
  input: CreateRawMaterialConsumptionLogInput,
): Promise<RawMaterialConsumptionLog> {
  const db  = await getDatabase();
  const now = new Date().toISOString();
  const id  = generateUUID();

  await db.runAsync(
    `INSERT INTO raw_material_consumption_logs
       (id, raw_material_id, quantity_used, reason, reference_id, notes,
        consumed_at, created_at, is_synced)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    [
      id,
      input.rawMaterialId,
      input.quantityUsed,
      input.reason,
      input.referenceId ?? null,
      input.notes       ?? null,
      now,
      now,
    ],
  );

  const row = await db.getFirstAsync<RawMaterialConsumptionLogRow>(
    `SELECT id, raw_material_id, quantity_used, reason, reference_id, notes,
            consumed_at, created_at, is_synced
     FROM raw_material_consumption_logs WHERE id = ?`,
    [id],
  );
  if (!row) throw new Error(`Failed to read back consumption log ${id}`);
  return logRowToDomain(row);
}

// ─── Consumption log queries ──────────────────────────────────────────────────

/**
 * Paginated list of consumption logs joined with raw material name, unit, and
 * cost. Ordered by consumed_at DESC. Filter by reason when supplied.
 *
 * Returns `RawMaterialConsumptionLogDetail[]` — each entry includes
 * `rawMaterialName`, `unit`, `costPerUnit`, and `totalCost` derived from the
 * JOIN to `raw_materials`.
 */
export async function getRawMaterialConsumptionLogs(
  options: GetRawMaterialLogsOptions,
): Promise<RawMaterialConsumptionLogDetail[]> {
  const db = await getDatabase();

  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (options.reason !== undefined) {
    conditions.push('cl.reason = ?');
    params.push(options.reason);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const rows = await db.getAllAsync<
    RawMaterialConsumptionLogRow & {
      rm_name: string | null;
      rm_unit: string | null;
      rm_cost: number | null;
    }
  >(
    `SELECT cl.id, cl.raw_material_id, cl.quantity_used, cl.reason,
            cl.reference_id, cl.notes, cl.consumed_at, cl.created_at, cl.is_synced,
            rm.name          AS rm_name,
            rm.unit          AS rm_unit,
            rm.cost_per_unit AS rm_cost
     FROM raw_material_consumption_logs cl
     LEFT JOIN raw_materials rm ON rm.id = cl.raw_material_id
     ${where}
     ORDER BY cl.consumed_at DESC
     LIMIT ? OFFSET ?`,
    [...params, options.limit, options.offset],
  );

  return rows.map((r) => {
    const costPerUnit = r.rm_cost ?? 0;
    return {
      ...logRowToDomain(r),
      rawMaterialName: r.rm_name ?? r.raw_material_id,
      unit:            (r.rm_unit ?? 'piece') as RawMaterialUnit,
      costPerUnit,
      totalCost:       r.quantity_used * costPerUnit,
    };
  });
}

/**
 * Returns all raw materials consumed for a specific production log.
 * Joins with `raw_materials` to get the display name and unit.
 * Used to enrich `ProductionLogWithDetails` for the production screen.
 */
export async function getRawMaterialsConsumedByProductionLog(
  productionLogId: string,
): Promise<RawMaterialConsumedDetail[]> {
  const db = await getDatabase();

  const rows = await db.getAllAsync<{
    raw_material_id:   string;
    rm_name:           string | null;
    quantity_used:     number;
    rm_unit:           string | null;
    rm_cost:           number | null;
  }>(
    `SELECT cl.raw_material_id,
            rm.name          AS rm_name,
            cl.quantity_used,
            rm.unit          AS rm_unit,
            rm.cost_per_unit AS rm_cost
     FROM raw_material_consumption_logs cl
     LEFT JOIN raw_materials rm ON rm.id = cl.raw_material_id
     WHERE cl.reference_id = ? AND cl.reason = 'production'
     ORDER BY cl.created_at ASC`,
    [productionLogId],
  );

  return rows.map((r) => ({
    rawMaterialId:   r.raw_material_id,
    rawMaterialName: r.rm_name ?? r.raw_material_id,
    quantityUsed:    r.quantity_used,
    unit:            r.rm_unit ?? 'piece',
    totalCost:       r.quantity_used * (r.rm_cost ?? 0),
  }));
}

/**
 * COUNT(*) of consumption log rows, optionally filtered by reason.
 * Used to drive pagination in the consumption logs screen.
 */
export async function getRawMaterialConsumptionLogCount(
  reason?: RawMaterialReason,
): Promise<number> {
  const db = await getDatabase();

  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (reason !== undefined) {
    conditions.push('reason = ?');
    params.push(reason);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const sql   = `SELECT COUNT(*) AS total FROM raw_material_consumption_logs ${where}`;

  // Never pass an empty array to getFirstAsync — the two-argument overload routes
  // through prepareAsync + bindAsync and the native module rejects when there are
  // zero bind markers in the SQL (Expo SQLite v14 / SDK 54 known issue).
  const row = params.length > 0
    ? await db.getFirstAsync<{ total: number | null }>(sql, params)
    : await db.getFirstAsync<{ total: number | null }>(sql);
  return row?.total ?? 0;
}

/**
 * Returns the total monetary cost of all raw material consumption events
 * where reason = 'waste'. Used to surface waste cost separately from the
 * aggregate total on the Usage Logs screen.
 */
export async function getWasteRawMaterialCost(): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ total: number | null }>(
    `SELECT SUM(cl.quantity_used * COALESCE(rm.cost_per_unit, 0)) AS total
     FROM raw_material_consumption_logs cl
     LEFT JOIN raw_materials rm ON rm.id = cl.raw_material_id
     WHERE cl.reason = 'waste'`,
  );
  return row?.total ?? 0;
}

/**
 * Per-material consumption aggregate across all recorded events.
 * Ordered by total_consumed DESC. Used for the summary section of the
 * consumption logs screen.
 */
export async function getRawMaterialConsumptionSummary(): Promise<RawMaterialConsumptionSummary[]> {
  const db = await getDatabase();

  const rows = await db.getAllAsync<{
    raw_material_id:   string;
    raw_material_name: string | null;
    unit:              string | null;
    total_consumed:    number;
    total_cost:        number;
    event_count:       number;
  }>(
    `SELECT cl.raw_material_id,
            rm.name                                              AS raw_material_name,
            rm.unit                                              AS unit,
            SUM(cl.quantity_used)                                AS total_consumed,
            SUM(cl.quantity_used * COALESCE(rm.cost_per_unit, 0)) AS total_cost,
            COUNT(cl.id)                                         AS event_count
     FROM raw_material_consumption_logs cl
     LEFT JOIN raw_materials rm ON rm.id = cl.raw_material_id
     GROUP BY cl.raw_material_id
     ORDER BY total_consumed DESC`,
  );

  return rows.map((r) => ({
    rawMaterialId:   r.raw_material_id,
    rawMaterialName: r.raw_material_name ?? r.raw_material_id,
    unit:            (r.unit ?? 'piece') as RawMaterialUnit,
    totalConsumed:   r.total_consumed,
    totalCost:       r.total_cost,
    eventCount:      r.event_count,
  }));
}

/**
 * Daily consumption totals for the past `days` calendar days (including today).
 * Days with no recorded events are filled in with zeroes so the caller always
 * receives exactly `days` entries — ready for a bar or line chart.
 * Ordered by date ASC.
 */
export async function getRawMaterialConsumptionTrend(
  days: number,
): Promise<RawMaterialConsumptionTrend[]> {
  const db = await getDatabase();

  // Build the inclusive start date for the window.
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - (days - 1));
  const fromDateStr = startDate.toISOString().slice(0, 10);

  const rows = await db.getAllAsync<{
    date:           string;
    total_consumed: number;
    total_cost:     number;
  }>(
    `SELECT date(cl.consumed_at)                                     AS date,
            SUM(cl.quantity_used)                                     AS total_consumed,
            SUM(cl.quantity_used * COALESCE(rm.cost_per_unit, 0))     AS total_cost
     FROM raw_material_consumption_logs cl
     LEFT JOIN raw_materials rm ON rm.id = cl.raw_material_id
     WHERE date(cl.consumed_at) >= ?
     GROUP BY date(cl.consumed_at)
     ORDER BY date ASC`,
    [fromDateStr],
  );

  // Index DB results by date for O(1) lookup during gap-fill.
  const byDate = new Map<string, { totalConsumed: number; totalCost: number }>();
  for (const r of rows) {
    byDate.set(r.date, { totalConsumed: r.total_consumed, totalCost: r.total_cost });
  }

  // Emit one entry per calendar day, zeroing out days with no events.
  const result: RawMaterialConsumptionTrend[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    const dateStr = d.toISOString().slice(0, 10);
    const entry = byDate.get(dateStr);
    result.push({
      date:          dateStr,
      totalConsumed: entry?.totalConsumed ?? 0,
      totalCost:     entry?.totalCost     ?? 0,
    });
  }

  return result;
}
