---
name: feedback_no_with_transaction_async_in_migrations
description: Never use db.withTransactionAsync() to wrap migration.up() — it deadlocks Expo SQLite. Use explicit BEGIN/COMMIT/ROLLBACK instead.
type: feedback
---

Never wrap `migration.up(db)` calls inside `db.withTransactionAsync()` in `initDatabase.ts` or anywhere that calls multiple `db.runAsync`/`db.execAsync` operations in sequence.

**Why:** `withTransactionAsync` acquires an exclusive lock on Expo SQLite's internal serialized operation queue. Any `db.runAsync` or `db.execAsync` calls made on the same `db` instance inside the callback are then queued behind that held lock — a deadlock. This means the migration seeds never committed on first install, and `INSERT OR IGNORE` rows appear to succeed but are never written to disk.

**How to apply:** Always use explicit manual transactions in `initDatabase.ts`:
```ts
await db.execAsync('BEGIN');
try {
  await migration.up(db);
  await db.runAsync('INSERT INTO schema_migrations ...', [...]);
  await db.execAsync('COMMIT');
} catch (err) {
  await db.execAsync('ROLLBACK');
  throw err;
}
```
This pattern is already in place as of 2026-03-16. Do not revert it to `withTransactionAsync` for any migration.
