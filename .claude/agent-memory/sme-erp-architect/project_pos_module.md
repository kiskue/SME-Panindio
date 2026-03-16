---
name: POS Module Architecture
description: Design decisions, schema, and integration patterns for the POS sales module (migration 007)
type: project
---

The POS module was implemented as of 2026-03-16. It comprises:

**Why:** SME businesses need a simple POS flow — browse products, add to cart, record a sale with stock deduction — all offline-first with SQLite.

**How to apply:** When extending POS (e.g. adding receipts, order history screen, refunds), follow the established patterns documented here rather than introducing new conventions.

## Database (migration 007)

Tables:
- `sales_orders` — header: `order_number TEXT UNIQUE` (format "ORD-0001"), `status` (completed/pending/cancelled), `subtotal`, `discount_amount`, `total_amount`, `payment_method` (cash/gcash/maya/card), `amount_tendered`, `change_amount`, `notes`, `is_synced`
- `sales_order_items` — lines: FK to sales_orders and inventory_items, `product_name` + `unit_price` are immutable snapshots at sale time

No `deleted_at` on sales_orders — cancellation uses `status='cancelled'` to preserve audit history.

Schema file: `database/schemas/sales_orders.schema.ts`
Migration file: `database/migrations/007_add_sales_orders.ts`

## Repository (`database/repositories/sales.repository.ts`)

Key functions:
- `createSalesOrder(input)` — single `withTransactionAsync`: generates order number, inserts header, inserts lines, deducts `inventory_items.quantity` (floored at 0). Optional `consumeIngredients` flag runs ingredient deduction AFTER the transaction (cannot nest transactions).
- `getSalesOrders(limit, offset)` — paginated, newest first
- `getSalesOrderById(id)` — returns `SalesOrderDetail` with items array
- `getTodaySalesTotal()` — completed orders only, uses `created_at LIKE 'YYYY-MM-DD%'`
- `cancelSalesOrder(id)` — sets status='cancelled', restores stock quantities

Order number generation: `MAX(order_number)` → parse numeric suffix → increment → `padStart(4, '0')`. Runs inside the order insert transaction to prevent races.

Stock deduction uses `MAX(0, quantity - sold)` — never goes negative.

## Zustand Store (`src/store/pos.store.ts`)

Cart is transient (not AsyncStorage persisted — session-scoped by design).
CartItem shape uses `product: InventoryItem`, `quantity: number`, `unitPrice: number`, `subtotal: number`.

Selectors exported: `selectCartItems`, `selectCartCount`, `selectCartSubtotal`, `selectCartTotal`, `selectCheckoutLoading`, `selectCheckoutError`, `selectLastOrder`, `selectTodayTotal`, `selectTodayOrderCount`.

`checkout(paymentMethod, options?)` — computes subtotal, discount, changeAmount (for cash), then calls `createSalesOrder`. On success: stores `lastOrder`, clears cart.

## Types (`src/types/index.ts`)

Added: `PaymentMethod`, `SalesOrderStatus`, `SalesOrder`, `SalesOrderItem`, `SalesOrderDetail`, `CartItem`.

## Screen wiring (`src/app/(app)/(tabs)/pos.tsx`)

The screen was pre-built with a local stub `usePosStoreLocal()`. Replaced with real `usePosStore` selectors. Key field renames vs. local stub:
- `CartItem.id` (stub) → `CartItem.product.id` (domain)
- `CartItem.qty` (stub) → `CartItem.quantity` (domain)
- Local `type PaymentMethod` removed (now imported from `@/types`)
- `checkout(payload)` (stub) → `checkout(paymentMethod, options)` (domain)
