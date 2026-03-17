/**
 * database.ts
 *
 * Expo SQLite connection singleton.
 * Opens (or creates) the app database once and returns the same instance
 * on every subsequent call. This prevents multiple file handles and
 * WAL-mode conflicts across the lifetime of the app process.
 *
 * Usage:
 *   import { getDatabase } from '@/database/database';
 *   const db = await getDatabase();
 */

import * as SQLite from 'expo-sqlite';

const DB_NAME = 'sme_panindio.db';

let _db: SQLite.SQLiteDatabase | null = null;
// Pending open promise — prevents concurrent callers from each issuing their
// own openDatabaseAsync call before _db is assigned.
let _opening: Promise<SQLite.SQLiteDatabase> | null = null;

/**
 * Returns the singleton SQLiteDatabase instance, opening it on first call.
 * Safe to call concurrently — the in-flight promise guard ensures only one
 * openDatabaseAsync call is ever issued, even if two callers race before the
 * first open completes.
 */
export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (_db !== null) {
    return _db;
  }

  // If an open is already in flight, wait for it rather than issuing a second.
  if (_opening !== null) {
    return _opening;
  }

  _opening = (async () => {
    const db = await SQLite.openDatabaseAsync(DB_NAME, {
      useNewConnection: false,
    });

    // Enable WAL mode for better concurrent read performance on mobile.
    await db.execAsync('PRAGMA journal_mode = WAL;');
    await db.execAsync('PRAGMA foreign_keys = ON;');

    _db = db;
    _opening = null;
    return db;
  })();

  return _opening;
}
