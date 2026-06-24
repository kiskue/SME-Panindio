/**
 * Migration 024 — Create target_sales_plans, target_sales_items, and
 *                 daily_sales_summary tables for the Target Sales feature.
 *
 * target_sales_plans:
 *   Header record for a daily unit-sales target. One live plan per calendar
 *   date (enforced by the UNIQUE partial index on plan_date WHERE deleted_at
 *   IS NULL). Supports three allocation strategies:
 *     EVEN         — divide total_target_units equally across all selected products
 *     WEIGHTED     — allocate proportionally to each product's historical share
 *     SMART_NEXT_DAY — same as WEIGHTED but using the previous selling day's
 *                      data rather than a longer lookback
 *
 * target_sales_items:
 *   Per-product allocation within a plan. Stores the computed allocated_units,
 *   the weight used during allocation (0.0–1.0; all items in a plan sum to 1.0),
 *   and actual_units_sold (updated incrementally as sales are recorded).
 *   UNIQUE on (plan_id, product_id) so each product appears at most once per plan.
 *
 * daily_sales_summary:
 *   One-row-per-product-per-date aggregate used by the weighting engine.
 *   Updated via upsert each time a sales order is completed.
 *   UNIQUE on (summary_date, product_id).
 */

import type { SQLiteDatabase } from 'expo-sqlite';
import {
  targetSalesPlansSchema,
  targetSalesPlansIndexes,
  targetSalesItemsSchema,
  targetSalesItemsIndexes,
} from '../schemas/target_sales_plans.schema';
import {
  dailySalesSummarySchema,
  dailySalesSummaryIndexes,
} from '../schemas/daily_sales_summary.schema';

export const version     = 24;
export const description = 'Add target_sales_plans, target_sales_items, and daily_sales_summary tables';

export async function up(db: SQLiteDatabase): Promise<void> {
  // Parent table first — target_sales_items has an FK REFERENCES on plan id
  await db.execAsync(targetSalesPlansSchema);
  for (const index of targetSalesPlansIndexes) {
    await db.execAsync(index);
  }

  await db.execAsync(targetSalesItemsSchema);
  for (const index of targetSalesItemsIndexes) {
    await db.execAsync(index);
  }

  await db.execAsync(dailySalesSummarySchema);
  for (const index of dailySalesSummaryIndexes) {
    await db.execAsync(index);
  }
}

export async function down(db: SQLiteDatabase): Promise<void> {
  // Drop child table before parent to avoid FK constraint errors
  await db.execAsync('DROP TABLE IF EXISTS target_sales_items;');
  await db.execAsync('DROP TABLE IF EXISTS target_sales_plans;');
  await db.execAsync('DROP TABLE IF EXISTS daily_sales_summary;');
}
