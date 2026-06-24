/**
 * Migration 016 — Create Receivables (Utang) tables
 *
 * Adds three tables for the credit sales / receivables module:
 *   - credit_customers  — master data of individuals who buy on credit
 *   - credit_sales      — append-only ledger of credit transactions
 *   - credit_payments   — append-only payment records
 *
 * Design decisions:
 *   - Tables are created in dependency order: credit_customers first so that
 *     credit_sales and credit_payments can declare REFERENCES constraints.
 *   - All three tables are append-only ledgers. The running balance is always
 *     derived by summing the ledgers, never stored as a mutable column — this
 *     is the same pattern the project uses for inventory movements.
 *   - `credit_customers.status` allows soft-deletion so historical ledger rows
 *     retain their foreign-key integrity after a customer is deactivated.
 *   - `credit_sales.pos_transaction_id` is nullable — a credit sale can exist
 *     without a POS record (manually entered after-the-fact credit).
 *
 * Depends on: migration 007 (sales_orders, for pos_transaction_id cross-ref).
 *   Note: no FK constraint is declared to sales_orders because SQLite FK
 *   enforcement only applies when PRAGMA foreign_keys = ON and even then a
 *   nullable TEXT column referencing a separate table would silently fail if
 *   the POS table is unavailable. The cross-table reference is an application-
 *   level concern only.
 */

import type { SQLiteDatabase } from 'expo-sqlite';
import {
  creditCustomersSchema,
  creditCustomersIndexes,
  creditSalesSchema,
  creditSalesIndexes,
  creditPaymentsSchema,
  creditPaymentsIndexes,
} from '../schemas/credit.schema';

export const version     = 16;
export const description = 'Create credit_customers, credit_sales, credit_payments tables for Receivables (Utang) module';

export async function up(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(creditCustomersSchema);
  for (const index of creditCustomersIndexes) {
    await db.execAsync(index);
  }

  await db.execAsync(creditSalesSchema);
  for (const index of creditSalesIndexes) {
    await db.execAsync(index);
  }

  await db.execAsync(creditPaymentsSchema);
  for (const index of creditPaymentsIndexes) {
    await db.execAsync(index);
  }
}

export async function down(db: SQLiteDatabase): Promise<void> {
  // Drop in reverse dependency order
  await db.execAsync('DROP TABLE IF EXISTS credit_payments;');
  await db.execAsync('DROP TABLE IF EXISTS credit_sales;');
  await db.execAsync('DROP TABLE IF EXISTS credit_customers;');
}
