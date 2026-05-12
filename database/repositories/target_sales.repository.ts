/**
 * target_sales.repository.ts
 *
 * All SQLite access for the Target Sales feature:
 *   - target_sales_plans  — daily header: date, total units, strategy
 *   - target_sales_items  — per-product allocation within a plan
 *   - daily_sales_summary — historical per-product-per-day sales aggregates
 *                           used by the WEIGHTED / SMART_NEXT_DAY strategies
 *
 * No SQL may appear in screens, hooks, or Zustand stores — they call
 * these functions exclusively.
 *
 * Key invariants:
 *   - One active plan per calendar date. The UNIQUE index on
 *     target_sales_plans(plan_date) WHERE deleted_at IS NULL enforces this.
 *     `createTargetSalesPlan` will throw if a live plan for the date already
 *     exists; callers should check first with `getTargetSalesPlanByDate`.
 *
 *   - `replaceTargetSalesItems` replaces ALL items for a plan in a single
 *     BEGIN/COMMIT transaction (DELETE existing + INSERT new set). This is
 *     the canonical write path for item allocation updates.
 *
 *   - `daily_sales_summary` rows are keyed on (summary_date, product_id).
 *     All writes use INSERT … ON CONFLICT DO UPDATE so callers never need to
 *     check for row existence.
 *
 *   - `getPreviousDaySalesSummary` walks backwards from `beforeDate` to find
 *     the most recent calendar day that actually has summary rows. This is
 *     important for SMART_NEXT_DAY: if there were no sales yesterday the
 *     algorithm must fall back to the most recent non-zero day.
 *
 * TypeScript strict-mode notes:
 *   - exactOptionalPropertyTypes: optional fields use conditional spread.
 *   - noUncheckedIndexedAccess: all array accesses use ?? fallbacks where
 *     the compiler cannot narrow to a definite element.
 */

import { getDatabase } from '../database';
import type {
  TargetSalesPlanRow,
  TargetSalesItemRow,
  CreateTargetSalesPlanInput,
  UpdateTargetSalesPlanInput,
  UpsertTargetSalesItemInput,
} from '../schemas/target_sales_plans.schema';
import type {
  DailySalesSummaryRow,
  UpsertDailySalesSummaryInput,
} from '../schemas/daily_sales_summary.schema';
import type {
  TargetSalesPlanRecord,
  TargetSalesItemRecord,
  DailySalesSummaryRecord,
} from '@/types';

// ─── UUID helper ──────────────────────────────────────────────────────────────

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ─── Column lists (never SELECT *) ───────────────────────────────────────────

const PLAN_COLS =
  'id, plan_date, total_target_units, strategy, status, created_at, updated_at, is_synced, deleted_at';

const ITEM_COLS =
  'id, plan_id, product_id, product_name, allocated_units, actual_units_sold, weight, created_at, updated_at';

const SUMMARY_COLS =
  'id, summary_date, product_id, product_name, units_sold, revenue, created_at, updated_at, is_synced';

// ─── Domain mappers ───────────────────────────────────────────────────────────

function planToDomain(row: TargetSalesPlanRow): TargetSalesPlanRecord {
  return {
    id:               row.id,
    planDate:         row.plan_date,
    totalTargetUnits: row.total_target_units,
    strategy:         row.strategy,
    status:           row.status,
    createdAt:        row.created_at,
    updatedAt:        row.updated_at,
    isSynced:         row.is_synced,
    ...(row.deleted_at !== null ? { deletedAt: row.deleted_at } : {}),
  };
}

function itemToDomain(row: TargetSalesItemRow): TargetSalesItemRecord {
  return {
    id:              row.id,
    planId:          row.plan_id,
    productId:       row.product_id,
    productName:     row.product_name,
    allocatedUnits:  row.allocated_units,
    actualUnitsSold: row.actual_units_sold,
    weight:          row.weight,
    createdAt:       row.created_at,
    updatedAt:       row.updated_at,
  };
}

function summaryToDomain(row: DailySalesSummaryRow): DailySalesSummaryRecord {
  return {
    id:          row.id,
    summaryDate: row.summary_date,
    productId:   row.product_id,
    productName: row.product_name,
    unitsSold:   row.units_sold,
    revenue:     row.revenue,
    createdAt:   row.created_at,
    updatedAt:   row.updated_at,
    isSynced:    row.is_synced,
  };
}

// ─── target_sales_plans ───────────────────────────────────────────────────────

/**
 * Creates a new daily sales plan. Each plan_date may have at most ONE live plan
 * (enforced by the UNIQUE partial index on plan_date WHERE deleted_at IS NULL).
 * Callers should check getTargetSalesPlanByDate first to avoid a constraint
 * violation.
 */
export async function createTargetSalesPlan(
  input: CreateTargetSalesPlanInput,
): Promise<TargetSalesPlanRecord> {
  const db  = await getDatabase();
  const now = new Date().toISOString();
  const id  = generateUUID();

  const status: 'DRAFT' | 'ACTIVE' | 'COMPLETED' = input.status ?? 'DRAFT';

  await db.runAsync(
    `INSERT INTO target_sales_plans
       (id, plan_date, total_target_units, strategy, status, created_at, updated_at, is_synced, deleted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, NULL)`,
    [id, input.plan_date, input.total_target_units, input.strategy, status, now, now],
  );

  const record: TargetSalesPlanRecord = {
    id,
    planDate:         input.plan_date,
    totalTargetUnits: input.total_target_units,
    strategy:         input.strategy,
    status,
    createdAt:        now,
    updatedAt:        now,
    isSynced:         0,
  };
  return record;
}

/**
 * Returns the active (non-deleted) plan for the given calendar date, or null
 * if no plan exists for that date.
 */
export async function getTargetSalesPlanByDate(
  date: string,
): Promise<TargetSalesPlanRecord | null> {
  const db  = await getDatabase();
  const row = await db.getFirstAsync<TargetSalesPlanRow>(
    `SELECT ${PLAN_COLS}
     FROM   target_sales_plans
     WHERE  plan_date = ? AND deleted_at IS NULL
     LIMIT  1`,
    [date],
  );
  return row != null ? planToDomain(row) : null;
}

/**
 * Returns all non-deleted plans ordered by plan_date descending.
 * Optionally filtered by status.
 */
export async function getTargetSalesPlans(
  status?: 'DRAFT' | 'ACTIVE' | 'COMPLETED',
): Promise<TargetSalesPlanRecord[]> {
  const db = await getDatabase();

  const rows = status !== undefined
    ? await db.getAllAsync<TargetSalesPlanRow>(
        `SELECT ${PLAN_COLS}
         FROM   target_sales_plans
         WHERE  deleted_at IS NULL AND status = ?
         ORDER  BY plan_date DESC`,
        [status],
      )
    : await db.getAllAsync<TargetSalesPlanRow>(
        `SELECT ${PLAN_COLS}
         FROM   target_sales_plans
         WHERE  deleted_at IS NULL
         ORDER  BY plan_date DESC`,
        [],
      );

  return rows.map(planToDomain);
}

/**
 * Updates mutable fields on an existing plan (total units, strategy, status).
 * Automatically marks is_synced = 0 and bumps updated_at.
 */
export async function updateTargetSalesPlan(
  id: string,
  input: UpdateTargetSalesPlanInput,
): Promise<void> {
  const db  = await getDatabase();
  const now = new Date().toISOString();

  const fields: string[] = ['updated_at = ?', 'is_synced = 0'];
  const params: (string | number)[] = [now];

  if (input.total_target_units !== undefined) {
    fields.push('total_target_units = ?');
    params.push(input.total_target_units);
  }
  if (input.strategy !== undefined) {
    fields.push('strategy = ?');
    params.push(input.strategy);
  }
  if (input.status !== undefined) {
    fields.push('status = ?');
    params.push(input.status);
  }

  params.push(id);

  await db.runAsync(
    `UPDATE target_sales_plans SET ${fields.join(', ')} WHERE id = ?`,
    params,
  );
}

/**
 * Soft-deletes a plan by setting deleted_at to now.
 * Associated items remain on disk for historical reference.
 */
export async function deleteTargetSalesPlan(id: string): Promise<void> {
  const db  = await getDatabase();
  const now = new Date().toISOString();
  await db.runAsync(
    `UPDATE target_sales_plans
     SET    deleted_at = ?, updated_at = ?, is_synced = 0
     WHERE  id = ?`,
    [now, now, id],
  );
}

// ─── target_sales_items ───────────────────────────────────────────────────────

/**
 * Returns all items allocated within a given plan, ordered by weight descending
 * (highest-weight product first — best seller leads the list).
 */
export async function getTargetSalesItemsByPlan(
  planId: string,
): Promise<TargetSalesItemRecord[]> {
  const db   = await getDatabase();
  const rows = await db.getAllAsync<TargetSalesItemRow>(
    `SELECT ${ITEM_COLS}
     FROM   target_sales_items
     WHERE  plan_id = ?
     ORDER  BY weight DESC, product_name ASC`,
    [planId],
  );
  return rows.map(itemToDomain);
}

/**
 * Inserts or updates a single item within a plan.
 * Upsert key: (plan_id, product_id) — enforced by the UNIQUE index.
 * When the row already exists, allocated_units, weight, and updated_at are
 * overwritten. actual_units_sold is only updated when explicitly passed.
 */
export async function upsertTargetSalesItem(
  input: UpsertTargetSalesItemInput,
): Promise<TargetSalesItemRecord> {
  const db  = await getDatabase();
  const now = new Date().toISOString();

  const actualUnitsSold = input.actual_units_sold ?? 0;

  const existing = await db.getFirstAsync<{ id: string }>(
    `SELECT id FROM target_sales_items WHERE plan_id = ? AND product_id = ?`,
    [input.plan_id, input.product_id],
  );

  if (existing != null) {
    const setClauses = input.actual_units_sold !== undefined
      ? 'allocated_units = ?, weight = ?, actual_units_sold = ?, updated_at = ?'
      : 'allocated_units = ?, weight = ?, updated_at = ?';

    const updateParams: (string | number)[] = input.actual_units_sold !== undefined
      ? [input.allocated_units, input.weight, input.actual_units_sold, now, existing.id]
      : [input.allocated_units, input.weight, now, existing.id];

    await db.runAsync(
      `UPDATE target_sales_items SET ${setClauses} WHERE id = ?`,
      updateParams,
    );

    const updated = await db.getFirstAsync<TargetSalesItemRow>(
      `SELECT ${ITEM_COLS} FROM target_sales_items WHERE id = ?`,
      [existing.id],
    );
    if (updated == null) {
      throw new Error(`target_sales_items: row ${existing.id} vanished after UPDATE`);
    }
    return itemToDomain(updated);
  }

  const id = generateUUID();
  await db.runAsync(
    `INSERT INTO target_sales_items
       (id, plan_id, product_id, product_name, allocated_units, actual_units_sold, weight, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, input.plan_id, input.product_id, input.product_name,
     input.allocated_units, actualUnitsSold, input.weight, now, now],
  );

  return {
    id,
    planId:          input.plan_id,
    productId:       input.product_id,
    productName:     input.product_name,
    allocatedUnits:  input.allocated_units,
    actualUnitsSold: actualUnitsSold,
    weight:          input.weight,
    createdAt:       now,
    updatedAt:       now,
  };
}

/**
 * Replaces the complete set of items for a plan atomically.
 *
 * Canonical write path for allocation updates:
 *   1. DELETEs every existing item for the plan.
 *   2. INSERTs the full new set.
 *
 * Uses explicit BEGIN / COMMIT (not withTransactionAsync — see project-wide
 * no-nested-transaction rule: withTransactionAsync deadlocks Expo SQLite when
 * inner runAsync calls are queued behind the same lock).
 */
export async function replaceTargetSalesItems(
  planId: string,
  items: UpsertTargetSalesItemInput[],
): Promise<TargetSalesItemRecord[]> {
  const db  = await getDatabase();
  const now = new Date().toISOString();

  await db.execAsync('BEGIN');
  try {
    await db.runAsync(
      `DELETE FROM target_sales_items WHERE plan_id = ?`,
      [planId],
    );

    for (const item of items) {
      const id = generateUUID();
      await db.runAsync(
        `INSERT INTO target_sales_items
           (id, plan_id, product_id, product_name, allocated_units, actual_units_sold, weight, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, planId, item.product_id, item.product_name,
         item.allocated_units, item.actual_units_sold ?? 0, item.weight, now, now],
      );
    }

    await db.execAsync('COMMIT');
  } catch (err) {
    await db.execAsync('ROLLBACK');
    throw err;
  }

  return getTargetSalesItemsByPlan(planId);
}

/**
 * Increments actual_units_sold for a specific item by the given delta.
 * Useful for real-time progress tracking as individual sales come in.
 */
export async function incrementActualUnitsSold(
  itemId: string,
  delta: number,
): Promise<void> {
  const db  = await getDatabase();
  const now = new Date().toISOString();
  await db.runAsync(
    `UPDATE target_sales_items
     SET    actual_units_sold = actual_units_sold + ?, updated_at = ?
     WHERE  id = ?`,
    [delta, now, itemId],
  );
}

// ─── daily_sales_summary ──────────────────────────────────────────────────────

/**
 * Returns all product summaries for the given calendar date, ordered by
 * units_sold descending (fastest sellers first).
 * Returns an empty array when no sales were recorded for that date.
 */
export async function getDailySalesSummary(
  date: string,
): Promise<DailySalesSummaryRecord[]> {
  const db   = await getDatabase();
  const rows = await db.getAllAsync<DailySalesSummaryRow>(
    `SELECT ${SUMMARY_COLS}
     FROM   daily_sales_summary
     WHERE  summary_date = ?
     ORDER  BY units_sold DESC`,
    [date],
  );
  return rows.map(summaryToDomain);
}

/**
 * Writes or updates the sales summary for a (date, product) pair.
 * Upsert key: (summary_date, product_id) — the UNIQUE constraint on the table.
 * This is a full replacement of totals — callers are responsible for passing
 * the correct accumulated values.
 */
export async function upsertDailySalesSummary(
  input: UpsertDailySalesSummaryInput,
): Promise<DailySalesSummaryRecord> {
  const db  = await getDatabase();
  const now = new Date().toISOString();
  const id  = generateUUID();

  await db.runAsync(
    `INSERT INTO daily_sales_summary
       (id, summary_date, product_id, product_name, units_sold, revenue, created_at, updated_at, is_synced)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
     ON CONFLICT(summary_date, product_id) DO UPDATE SET
       product_name = excluded.product_name,
       units_sold   = excluded.units_sold,
       revenue      = excluded.revenue,
       updated_at   = excluded.updated_at,
       is_synced    = 0`,
    [id, input.summary_date, input.product_id, input.product_name,
     input.units_sold, input.revenue, now, now],
  );

  const row = await db.getFirstAsync<DailySalesSummaryRow>(
    `SELECT ${SUMMARY_COLS}
     FROM   daily_sales_summary
     WHERE  summary_date = ? AND product_id = ?`,
    [input.summary_date, input.product_id],
  );

  if (row == null) {
    throw new Error(`daily_sales_summary: row vanished after upsert for ${input.summary_date}/${input.product_id}`);
  }
  return summaryToDomain(row);
}

/**
 * Finds the most recent calendar day BEFORE beforeDate that has at least one
 * sales summary row, then returns all product summaries for that day.
 *
 * Used by the WEIGHTED and SMART_NEXT_DAY strategies to get the previous
 * selling day's product velocities. Returns an empty array when no historical
 * data exists at all.
 *
 * @param beforeDate - "YYYY-MM-DD"; search is strictly before this date.
 */
export async function getPreviousDaySalesSummary(
  beforeDate: string,
): Promise<DailySalesSummaryRecord[]> {
  const db = await getDatabase();

  const latestDateRow = await db.getFirstAsync<{ summary_date: string }>(
    `SELECT summary_date
     FROM   daily_sales_summary
     WHERE  summary_date < ?
     ORDER  BY summary_date DESC
     LIMIT  1`,
    [beforeDate],
  );

  if (latestDateRow == null) {
    return [];
  }

  return getDailySalesSummary(latestDateRow.summary_date);
}

/**
 * Returns the N most recent distinct dates that have sales summary rows,
 * ordered most-recent first.
 *
 * @param beforeDate - Search strictly before this date.
 * @param limit      - Maximum number of distinct dates (default: 7).
 */
export async function getRecentSalesSummaryDates(
  beforeDate: string,
  limit = 7,
): Promise<string[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ summary_date: string }>(
    `SELECT DISTINCT summary_date
     FROM   daily_sales_summary
     WHERE  summary_date < ?
     ORDER  BY summary_date DESC
     LIMIT  ?`,
    [beforeDate, limit],
  );
  return rows.map((r) => r.summary_date);
}

/**
 * Marks a batch of daily_sales_summary rows as synced after a successful
 * API push. Ids are primary key values from the table.
 */
export async function markDailySalesSummariesSynced(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const db           = await getDatabase();
  const placeholders = ids.map(() => '?').join(', ');
  await db.runAsync(
    `UPDATE daily_sales_summary SET is_synced = 1 WHERE id IN (${placeholders})`,
    ids,
  );
}
