---
name: Cost Snapshot in Audit Log Rows
description: Audit log tables must store cost_per_unit as a snapshot at insert time; computing cost at query time via JOIN gives wrong totals when the master price is 0 or has changed.
type: feedback
---

Never compute monetary cost at query time by JOIN-ing the master catalog's `cost_per_unit` column in an aggregate query over audit log rows. If any material has `cost_per_unit = 0` in the catalog at query time (the column default), those log rows contribute ₱0 to the aggregate — even if the material had a non-zero cost when the event was recorded.

**Why:** `raw_material_consumption_logs` originally had no `cost_per_unit` column and `getWasteRawMaterialCost()` used `SUM(cl.quantity_used * COALESCE(rm.cost_per_unit, 0))` via JOIN. Materials whose catalog price was 0 were silently excluded from the waste cost total, producing a wrong stat (₱1.40 instead of ₱8.20).

**How to apply:**
- Every audit/consumption log table must store `cost_per_unit REAL NOT NULL DEFAULT 0` (or equivalent, e.g. `cost_price` + `total_cost` as in `ingredient_consumption_logs`) as a frozen snapshot at INSERT time.
- The inserting layer (store action or repository function) is responsible for reading the current price from the in-memory cache or the master table and passing it through to the INSERT.
- All aggregate queries (`SUM(cl.quantity_used * cl.cost_per_unit)`) and per-row detail queries must read from the log column, not the JOIN column.
- A `LEFT JOIN` to the master table is still needed for display name and unit (which can change without affecting historical cost) but NEVER for cost arithmetic.
- New columns added to existing tables require BOTH a schema file update (for fresh installs via `CREATE TABLE IF NOT EXISTS`) AND a new numbered migration file (`ALTER TABLE ADD COLUMN`) for existing devices. The schema file and migration must be kept in sync — see `pattern_sqlite_migration_schema_drift.md`.
- `ingredient_consumption_logs` is the reference implementation: it stores `cost_price` and `total_cost` as snapshots and never re-derives them from the inventory catalog.
