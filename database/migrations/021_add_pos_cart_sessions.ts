/**
 * 021_add_pos_cart_sessions.ts
 *
 * Creates the `pos_cart_sessions` and `pos_cart_items` tables for
 * offline-persistent draft POS carts.
 *
 * Why a separate table (not sales_orders)?
 *   `sales_orders` is the immutable completed-sale ledger. Draft carts are
 *   transient working state — they must never appear in sales reporting or
 *   revenue calculations. Keeping them separate prevents schema pollution and
 *   lets the POS flow distinguish "in progress" from "committed" without
 *   introducing a 'draft' status into the sales audit trail.
 */

import type { SQLiteDatabase } from 'expo-sqlite';
import {
  posCartSessionsSchema,
  posCartSessionsIndexes,
  posCartItemsSchema,
  posCartItemsIndexes,
} from '../schemas/pos_cart_sessions.schema';

export const version     = 21;
export const description = 'add_pos_cart_sessions';

export async function up(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(posCartSessionsSchema);
  for (const index of posCartSessionsIndexes) {
    await db.execAsync(index);
  }

  await db.execAsync(posCartItemsSchema);
  for (const index of posCartItemsIndexes) {
    await db.execAsync(index);
  }
}

export async function down(db: SQLiteDatabase): Promise<void> {
  // Drop items first to satisfy the FK reference to sessions.
  await db.execAsync('DROP TABLE IF EXISTS pos_cart_items;');
  await db.execAsync('DROP TABLE IF EXISTS pos_cart_sessions;');
}
