---
name: Consumption Log and Stock Deduction Are Separate Operations
description: createConsumptionLog only writes an audit row — it never touches inventory_items.quantity. Any trigger that changes stock must also call adjustItemQuantity.
type: project
---

The `ingredient_consumption_logs` table is a pure immutable audit ledger. Writing a row there does NOT mutate `inventory_items.quantity`.

Any code path that records a consumption event and should affect real stock levels must explicitly call `adjustItemQuantity(ingredientId, delta)` from `inventory_items.repository.ts`:
- Negative delta: WASTAGE, MANUAL_ADJUSTMENT, TRANSFER, PRODUCTION
- Positive delta: RETURN (quantityConsumed is already stored as negative, so the negation in the store cancels out correctly)

The `adjustItemQuantity` repository function uses `SET quantity = MAX(quantity + ?, 0)` — a single atomic SQL update with no race condition and a floor of zero.

After calling `adjustItemQuantity`, the inventory store in-memory cache must be updated via `useInventoryStore.getState().updateItem(id, { quantity: newQuantity })` so picker UIs reflect the change immediately.

**Why:** The `logManualEntry` store action previously only inserted the audit row and called `refreshLogs()`. No stock was ever deducted. The fix adds a sequential `adjustItemQuantity` call between the audit insert and the log refresh.

**How to apply:** Any future feature that records ingredient consumption (batch adjustments, transfers, etc.) must follow this three-step sequence: (1) insert audit log, (2) adjust stock atomically, (3) update inventory store cache.
