---
name: Ingredient Consumption Logs Module
description: Architecture decisions for the ingredient_consumption_logs table and related store/screen
type: project
---

Ingredient consumption logs table added as an immutable audit ledger (migration 004). Every ingredient quantity reduction — regardless of trigger source — writes an append-only row here.

**Key design decisions:**

- `cancelled_at` is the only mutable column. No UPDATE on data columns; corrections go in as a new RETURN row with negative quantity.
- `trigger_type` enum: PRODUCTION | MANUAL_ADJUSTMENT | WASTAGE | RETURN | TRANSFER
- `reference_id` + `reference_type` form a polymorphic pointer back to the source document (e.g. production_log_id / 'production_log').
- Production integration: `batchInsertConsumptionLogsInTx()` is called inside the **same** `withTransactionAsync` block as `createProductionLog()`. This avoids nested transactions (expo-sqlite does not support them). Never open a second transaction from within an existing one.
- Store uses LIMIT/OFFSET pagination (PAGE_SIZE=30). `logs` array accumulates on `loadMore`; `refreshLogs`/`setFilters` reset to page 0.
- `setFilters` pattern uses destructuring + conditional spread to satisfy `exactOptionalPropertyTypes`: `const { triggerType: _removed, ...rest } = filters; setFilters(t !== undefined ? { ...rest, triggerType: t } : rest)`.

**Why:** Production logs only recorded ingredient consumption as line items linked to a production run. There was no cross-source queryable audit trail. The new table enables period-end reconciliation, wastage tracking, and per-ingredient consumption reports.

**How to apply:** Future stock-affecting operations (manual adjustments, warehouse transfers, stock write-offs) must call `createConsumptionLog()` or `batchInsertConsumptionLogsInTx()` with the appropriate `trigger_type`. Never skip the consumption log when deducting ingredient stock.
