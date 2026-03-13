---
name: SQLite JOIN Safety for Audit/Log Tables
description: Audit log queries that JOIN inventory_items must use LEFT JOIN to avoid silently dropping rows when items are deleted
type: feedback
---

Any query that reads from an audit/log table (`ingredient_consumption_logs`, `production_log_ingredients`, etc.) and JOINs `inventory_items` for display names **must use LEFT JOIN**, never INNER JOIN.

**Why:** `inventory_items` uses soft-delete (`deleted_at` column). If an item is later hard-deleted (or if a future migration cleans up soft-deleted rows), an INNER JOIN will silently drop every audit log row that referenced that item. The audit log exists precisely to preserve history — dropping rows defeats its purpose.

**How to apply:**
- `LEFT JOIN inventory_items ii ON ii.id = cl.ingredient_id`
- Use `ii.name ?? cl.ingredient_id` (or `COALESCE(ii.name, cl.ingredient_id)` in SQL) as the display name fallback so deleted items still show a usable identifier.
- This applies to: `getConsumptionLogs`, `getIngredientConsumptionSummary`, and any future query on audit tables that joins catalog/master tables.

Discovered while debugging the Consumption Logs screen showing no data.
