# Suki — Business-Owner Order Management — Change Tracker

> **Goal:** When a customer places an online order, the business owner can see it,
> **confirm** it, advance its **status** (preparing → ready → completed) or
> **cancel** it, and record **payment**. **Completing an order deducts the ordered
> quantities from catalog stock** (idempotently). Follows standard order-fulfilment
> practice.
>
> **Status:** Code complete on both backend (Sme-Server) and app (SME-Panindio).
> **No schema change required** — all needed columns already exist (order statuses,
> the `confirmed_at/ready_at/completed_at/cancelled_at/cancellation_reason`
> timestamps, `online_order_items.stock_reduced/stock_reduced_at`, and
> `online_catalog.stock_quantity` from the stock feature).

---

## Order lifecycle (best-practice state machine)

```
PENDING ──▶ CONFIRMED ──▶ PREPARING ──▶ READY ──▶ COMPLETED   (terminal)
   │            │             │            │
   └────────────┴─────────────┴────────────┴────▶ CANCELLED   (terminal)
```

- Forward-only; cancel allowed from any active state. COMPLETED / CANCELLED are terminal.
- **COMPLETED** → deduct each item's qty from the owner's catalog `stock_quantity`
  (floored at 0), flag each `online_order_items.stock_reduced=true` so re-runs never
  double-deduct. Done inside one DB transaction with the status write.
- **COMPLETED** on a **PAY_NOW** order auto-marks `payment_status = PAID` (cash collected
  at handover). **PAY_LATER** stays UNPAID (credit, settled later).

### New API error codes
- `INVALID_STATUS_TRANSITION` — disallowed status change.
- `ORDER_NOT_FOUND` — order missing or not owned by the caller.
- `ORDER_CANCELLED` — payment change attempted on a cancelled order.

---

## Backend (Sme-Server) — DONE

- [x] `dto/update-order-status.dto.ts` — `{ status, cancellationReason? }` (status restricted to settable values).
- [x] `dto/update-payment-status.dto.ts` — `{ paymentStatus }`.
- [x] `orders.controller.ts` — new owner-scoped routes (JWT):
  - [x] `GET  /orders/business/:id` — single order with items.
  - [x] `PATCH /orders/:id/status` — confirm / advance / complete / cancel.
  - [x] `PATCH /orders/:id/payment` — record payment.
- [x] `orders.service.ts`
  - [x] `ALLOWED_TRANSITIONS` state machine + validation.
  - [x] `getForBusiness`, `updateStatus`, `updatePayment`, `loadOwnerOrder`, `deductStock`.
  - [x] `deductStock()` — idempotent, transactional, floors at 0 (`GREATEST(0, stock_quantity - qty)`).
  - [x] `OrderResponse` + `toResponse` now include `customerName` / `customerPhone`
        (customer relation loaded for owner reads).
  - [x] `listForBusiness` loads the customer relation.

---

## Frontend (SME-Panindio) — DONE

- [x] `types/index.ts` — `OrderStatus`, `PaymentStatus`, `BusinessOrder`, `BusinessOrderItem`.
- [x] `features/business-suki/services/business_suki.service.ts`
  - [x] `normalizeBusinessOrder()` (DECIMAL strings → numbers, maps items).
  - [x] `fetchBusinessOrders(status?)`, `fetchBusinessOrder(id)`,
        `updateOrderStatus(id, status, reason?)`, `updatePaymentStatus(id, paymentStatus)`.
- [x] `features/business-suki/order-status.ts` — shared labels, badge colors,
      `ALLOWED_NEXT_STATUSES`, payment labels (kept OUT of the `app/` dir so Expo
      Router doesn't treat it as a route).
- [x] `store/business_orders.store.ts` — list / detail / status / payment actions,
      optimistic merge of the updated order. Exported from `store/index.ts`.
- [x] `app/(app)/(tabs)/suki/_layout.tsx` — registered `orders` + `orders/[id]`.
- [x] `app/(app)/(tabs)/suki/index.tsx` — added an **Orders** button.
- [x] `app/(app)/(tabs)/suki/orders.tsx` — order list with status-filter tabs,
      customer name, total, status + payment indicators, pull-to-refresh.
- [x] `app/(app)/(tabs)/suki/orders/[id].tsx` — detail with items + totals and a
      linear action bar: **Confirm → Start Preparing → Mark Ready → Mark Completed**,
      plus **Complete Now**, **Cancel Order**, and **Mark as Paid**. Confirm dialogs;
      completing warns that stock will be deducted.

---

## Verification checklist (manual)

- [ ] Place an order as a customer → it appears under the owner's **Orders → New** tab.
- [ ] Confirm → Preparing → Ready → Completed; verify status + timestamps update.
- [ ] On **Completed**, the product's `stock_quantity` drops by the ordered qty and the
      customer's **Browse Products** stock reflects it (after reload).
- [ ] Completing a PAY_NOW order flips payment to **Paid**; PAY_LATER stays **Unpaid**
      until "Mark as Paid".
- [ ] Cancelling a non-terminal order works; a completed/cancelled order shows no actions.
- [ ] Re-completing (or any bounce) never deducts stock twice (`stock_reduced` guard).

---

## Known limitations / future work

- [ ] **Cancellation reason input:** the app currently cancels without prompting for a
      free-text reason (cross-platform `Alert.prompt` is iOS-only). Add a small reason
      modal to capture `cancellationReason`.
- [ ] **No restock on cancel:** stock is only deducted on COMPLETED, and completed
      orders can't be cancelled, so no restock path is needed today. If a "refund /
      reopen completed order" flow is ever added, restore stock there.
- [ ] **Owner inventory sync:** completing an order decrements the *catalog* snapshot on
      the server, not the owner's local SQLite POS inventory. Reconcile the two if the
      POS and online stock must stay in lockstep (tracked also in `SUKI_STOCK_TODO.md`).
- [ ] **Realtime:** owner order list is pull-to-refresh; consider push/polling so new
      orders surface without manual refresh.
