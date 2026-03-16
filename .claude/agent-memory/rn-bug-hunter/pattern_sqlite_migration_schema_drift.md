---
name: SQLite Migration vs Schema Registry Drift
description: ALTER TABLE migrations must not re-add columns that are already in the canonical schema file; the schema registry runs before migrations on every launch.
type: feedback
---

The `initDatabase()` boot sequence runs in this order on every launch:

1. **Schema registry loop** — executes every `CREATE TABLE IF NOT EXISTS` from `schemaRegistry.ts`. Because the schemas include `IF NOT EXISTS`, this is always idempotent for the table itself, but it creates the table with ALL currently-defined columns on a fresh install.
2. **Pending migrations** — runs each migration whose version is not yet in `schema_migrations`.

**The trap:** If a migration's `up()` function uses `ALTER TABLE ADD COLUMN` for a column that was later added directly to the schema file (e.g. to keep the schema file as the readable "current state"), a fresh install crashes because:
- Step 1 creates the table with that column already present.
- The migration then tries to `ADD COLUMN` for a column that exists → SQLite: "duplicate column name".

**How to apply:** When adding columns to an existing table:
- If this is a new feature and the app has never shipped (or a dev reset is acceptable), add the column to the schema file and make the migration's `up()` a no-op with a clear comment explaining why.
- If existing user databases are in the wild without the column, the migration's `ALTER TABLE ADD COLUMN` is still needed for those users — but the schema file must also be updated. Both must be in sync.
- Never remove a migration entry from `MIGRATIONS[]` in `initDatabase.ts` even if its `up()` becomes a no-op; the `schema_migrations` tracking row is needed so future migrations know the correct baseline version.

**Why:** Root-caused during the `duplicate column name: product_id` crash at startup (migration 005 tried to ALTER TABLE ADD COLUMN product_id, but the column was already in the ingredientConsumptionLogsSchema CREATE TABLE). Fixed by making migration 005's `up()` a no-op.
