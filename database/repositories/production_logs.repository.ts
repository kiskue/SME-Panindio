/**
 * production_logs.repository.ts
 *
 * All SQLite access for `production_logs` and `production_log_ingredients`.
 * No SQL may appear in screens, hooks, or Zustand stores — they call
 * these functions exclusively.
 *
 * Creating a production log is always a two-step atomic write:
 *   1. Insert the `production_logs` header row.
 *   2. Insert one `production_log_ingredients` row per ingredient consumed.
 * Both steps run inside a single `withTransactionAsync` so a failure in
 * step 2 rolls back the header, leaving the DB in a consistent state.
 */

import { getDatabase } from '../database';
import type {
  ProductionLogRow,
  ProductionLogIngredientRow,
} from '../schemas/production_logs.schema';
import type {
  ProductionLog,
  ProductionLogIngredient,
  ProductionLogWithDetails,
  ProductionLogIngredientDetail,
} from '@/types';
import { batchInsertConsumptionLogsInTx } from './ingredient_consumption_logs.repository';

// ─── UUID helper ──────────────────────────────────────────────────────────────

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ─── Domain mapping ───────────────────────────────────────────────────────────

function logToDomain(row: ProductionLogRow): ProductionLog {
  return {
    id:            row.id,
    productId:     row.product_id,
    unitsProduced: row.units_produced,
    totalCost:     row.total_cost,
    producedAt:    row.produced_at,
    createdAt:     row.created_at,
    ...(row.notes !== null ? { notes: row.notes } : {}),
  };
}

function ingredientToDomain(row: ProductionLogIngredientRow): ProductionLogIngredient {
  return {
    id:               row.id,
    productionLogId:  row.production_log_id,
    ingredientId:     row.ingredient_id,
    quantityConsumed: row.quantity_consumed,
    unit:             row.unit,
    lineCost:         row.line_cost,
    createdAt:        row.created_at,
    ...(row.cost_price !== null ? { costPrice: row.cost_price } : {}),
  };
}

// ─── Input type ───────────────────────────────────────────────────────────────

export interface ProductionLogIngredientInput {
  ingredientId:     string;
  quantityConsumed: number;
  unit:             string;
  costPrice?:       number;
  lineCost:         number;
}

// ─── Repository functions ─────────────────────────────────────────────────────

/**
 * Creates a complete production log — header + all ingredient line items —
 * inside a single transaction. Returns the persisted header row.
 *
 * `productName` is optional for backward compatibility but should always be
 * supplied so the consumption audit logs carry the denormalized product name
 * without a JOIN at query time.
 */
export async function createProductionLog(
  productId:     string,
  unitsProduced: number,
  totalCost:     number,
  ingredients:   ProductionLogIngredientInput[],
  notes?:        string,
  productName?:  string,
): Promise<ProductionLog> {
  const db         = await getDatabase();
  const id         = generateUUID();
  const now        = new Date().toISOString();
  const producedAt = now;

  await db.withTransactionAsync(async () => {
    // Insert header
    await db.runAsync(
      `INSERT INTO production_logs
         (id, product_id, units_produced, total_cost, notes, produced_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, productId, unitsProduced, totalCost, notes ?? null, producedAt, now],
    );

    // Insert ingredient line items
    for (const ing of ingredients) {
      await db.runAsync(
        `INSERT INTO production_log_ingredients
           (id, production_log_id, ingredient_id, quantity_consumed, unit, cost_price, line_cost, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          generateUUID(),
          id,
          ing.ingredientId,
          ing.quantityConsumed,
          ing.unit,
          ing.costPrice ?? null,
          ing.lineCost,
          now,
        ],
      );
    }

    // Write immutable consumption audit log for each ingredient (same transaction)
    await batchInsertConsumptionLogsInTx(
      db,
      ingredients.map((ing) => ({
        ingredientId:     ing.ingredientId,
        quantityConsumed: ing.quantityConsumed,
        unit:             ing.unit,
        triggerType:      'PRODUCTION' as const,
        referenceId:      id,
        referenceType:    'production_log',
        totalCost:        ing.lineCost,
        ...(ing.costPrice  !== undefined ? { costPrice:   ing.costPrice } : {}),
        ...(notes          !== undefined ? { notes }                      : {}),
        ...(productName    !== undefined ? { productName }                : {}),
        productId:        productId,
        consumedAt:       producedAt,
      })),
      now,
    );
  });

  const row = await db.getFirstAsync<ProductionLogRow>(
    `SELECT id, product_id, units_produced, total_cost, notes, produced_at, created_at
     FROM production_logs WHERE id = ?`,
    [id],
  );

  if (row === null) {
    throw new Error(`[production_logs] INSERT succeeded but SELECT returned null for id=${id}`);
  }

  return logToDomain(row);
}

/**
 * Returns production logs, optionally filtered by product and/or date range.
 * Results include product name and ingredient line items with ingredient names.
 */
export async function getProductionLogs(options?: {
  productId?: string;
  fromDate?:  string; // ISO 8601 date prefix e.g. '2026-03-01'
  toDate?:    string;
  limit?:     number;
}): Promise<ProductionLogWithDetails[]> {
  const db = await getDatabase();

  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (options?.productId !== undefined) {
    conditions.push('pl.product_id = ?');
    params.push(options.productId);
  }
  if (options?.fromDate !== undefined) {
    conditions.push("pl.produced_at >= ?");
    params.push(options.fromDate);
  }
  if (options?.toDate !== undefined) {
    conditions.push("pl.produced_at <= ?");
    params.push(options.toDate + 'T23:59:59.999Z');
  }

  const where  = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limitQ = options?.limit !== undefined ? `LIMIT ${options.limit}` : '';

  const logRows = await db.getAllAsync<ProductionLogRow & { product_name: string }>(
    `SELECT pl.id, pl.product_id, pl.units_produced, pl.total_cost,
            pl.notes, pl.produced_at, pl.created_at,
            ii.name AS product_name
     FROM production_logs pl
     JOIN inventory_items ii ON ii.id = pl.product_id
     ${where}
     ORDER BY pl.produced_at DESC
     ${limitQ}`,
    params,
  );

  const results: ProductionLogWithDetails[] = [];

  for (const logRow of logRows) {
    const ingRows = await db.getAllAsync<ProductionLogIngredientRow & { ingredient_name: string }>(
      `SELECT pli.id, pli.production_log_id, pli.ingredient_id,
              pli.quantity_consumed, pli.unit, pli.cost_price, pli.line_cost,
              pli.created_at, ii.name AS ingredient_name
       FROM production_log_ingredients pli
       JOIN inventory_items ii ON ii.id = pli.ingredient_id
       WHERE pli.production_log_id = ?
       ORDER BY pli.created_at ASC`,
      [logRow.id],
    );

    const ingredients: ProductionLogIngredientDetail[] = ingRows.map((r) => ({
      ...ingredientToDomain(r),
      ingredientName: r.ingredient_name,
    }));

    results.push({
      ...logToDomain(logRow),
      productName: logRow.product_name,
      ingredients,
    });
  }

  return results;
}

/**
 * Returns a summary of today's production grouped by product.
 * "Today" is determined by the device's local date in ISO format.
 */
export async function getTodayProductionSummary(): Promise<
  { productId: string; productName: string; totalUnits: number; totalCost: number }[]
> {
  const db      = await getDatabase();
  const todayPrefix = new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'

  const rows = await db.getAllAsync<{
    product_id:   string;
    product_name: string;
    total_units:  number;
    total_cost:   number;
  }>(
    `SELECT pl.product_id,
            ii.name  AS product_name,
            SUM(pl.units_produced) AS total_units,
            SUM(pl.total_cost)     AS total_cost
     FROM production_logs pl
     JOIN inventory_items ii ON ii.id = pl.product_id
     WHERE pl.produced_at LIKE ?
     GROUP BY pl.product_id
     ORDER BY total_units DESC`,
    [`${todayPrefix}%`],
  );

  return rows.map((r) => ({
    productId:   r.product_id,
    productName: r.product_name,
    totalUnits:  r.total_units,
    totalCost:   r.total_cost,
  }));
}

/**
 * Returns daily aggregated production totals for the last `days` days.
 * Useful for dashboard charts and trend lines.
 */
export async function getDailyProduction(days: number): Promise<
  { date: string; totalUnits: number; totalCost: number }[]
> {
  const db = await getDatabase();

  const from = new Date();
  from.setDate(from.getDate() - (days - 1));
  const fromPrefix = from.toISOString().slice(0, 10);

  const rows = await db.getAllAsync<{
    date:        string;
    total_units: number;
    total_cost:  number;
  }>(
    `SELECT substr(produced_at, 1, 10) AS date,
            SUM(units_produced)        AS total_units,
            SUM(total_cost)            AS total_cost
     FROM production_logs
     WHERE produced_at >= ?
     GROUP BY date
     ORDER BY date ASC`,
    [fromPrefix],
  );

  return rows.map((r) => ({
    date:       r.date,
    totalUnits: r.total_units,
    totalCost:  r.total_cost,
  }));
}

/**
 * Returns the total units of a specific product produced within an optional
 * date range. Useful for per-product production counts.
 */
export async function getProductTotalProduced(
  productId: string,
  fromDate?: string,
  toDate?:   string,
): Promise<number> {
  const db = await getDatabase();

  const conditions = ['product_id = ?'];
  const params: (string | number)[] = [productId];

  if (fromDate !== undefined) { conditions.push('produced_at >= ?'); params.push(fromDate); }
  if (toDate   !== undefined) { conditions.push('produced_at <= ?'); params.push(toDate + 'T23:59:59.999Z'); }

  const row = await db.getFirstAsync<{ total: number | null }>(
    `SELECT SUM(units_produced) AS total FROM production_logs WHERE ${conditions.join(' AND ')}`,
    params,
  );

  return row?.total ?? 0;
}
