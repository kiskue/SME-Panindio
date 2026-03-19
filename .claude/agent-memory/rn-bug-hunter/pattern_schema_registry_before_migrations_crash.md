---
name: Schema Registry Must Run After Migrations
description: Running the schema registry before pending migrations causes "no such column" crashes on existing installs when an index references a column added by a pending migration.
type: feedback
---

In `initDatabase.ts`, the schema registry must execute AFTER all pending migrations, not before.

**Why:** The schema registry always reflects the post-migration (latest) table shape. If a migration adds a new column AND the schema file adds an index on that column, the index creation (`CREATE INDEX IF NOT EXISTS idx_srl_item_type ON stock_reduction_logs (item_type)`) runs against the old table on existing installs. SQLite validates column references at `CREATE INDEX` time even for `IF NOT EXISTS` indexes, producing `no such column: item_type` immediately — before the migration that adds the column ever gets to run. Fresh installs are unaffected because the schema registry creates the full table shape on first run.

**How to apply:**
- In `initDatabase.ts` the order is: (1) create `schema_migrations`, (2) query applied versions, (3) run pending migrations, (4) apply schema registry.
- When writing a migration that introduces a new column that also has an index in the schema file, always add an idempotency guard (`PRAGMA table_info(table_name)` check) at the top of `up()` so a re-run after partial failure is safe.
- For table-rebuild migrations (rename-copy-drop-rename), also `DROP TABLE IF EXISTS table_name_new` before the CREATE TABLE step to clean up any half-built table from a previous failed attempt.
