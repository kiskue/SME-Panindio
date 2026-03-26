---
name: Receivables (Utang) Module
description: Architecture decisions, schema design, and integration points for the Credit Sales / Receivables module (migration 016)
type: project
---

The module is named "Receivables" (code namespace: `credit`). UI shows "Receivables" in headers and "Utang" as contextual label in POS. Justified by ERP convention (SAP/Odoo/QuickBooks all use Accounts Receivable terminology).

## Three-table schema (migration 016)

- `credit_customers` — master data with soft-delete via `status = 'inactive'`; this preserves FK integrity on historical ledger rows
- `credit_sales` — append-only credit transaction ledger; `pos_transaction_id` (nullable) links to `sales_orders.id`
- `credit_payments` — append-only payment ledger; partial payments are individual rows

**Why:** Balance is ALWAYS computed as SUM(credit_sales) - SUM(credit_payments). Never stored as a mutable column — same pattern as inventory movements throughout this project.

**How to apply:** Never add a `balance` or `outstanding_amount` column to these tables. Always recompute from ledger sums.

## Repository (`database/repositories/credit.repository.ts`)

- `getCustomerSummaries()` — single SQL round-trip with LEFT JOIN + GROUP BY; returns `CustomerCreditSummary[]`
- `getTotalOutstandingBalance()` — dashboard KPI; single SQL aggregate
- `createCreditSaleFromPOS()` — NOT wrapped in transaction (same no-nested-transaction rule as overhead_expenses.repository.ts)
- `getCustomerBalance(customerId)` — per-customer recompute after writes

## Zustand store (`src/store/credit.store.ts`)

- `initializeCreditStore()` — registered in `initializeStores()` in `src/store/index.ts`
- `addCreditSale()` — refreshes only the affected customer's summary + total KPI (not a full reload)
- `recordPayment()` — same targeted refresh pattern
- `loadCustomerDetail()` — lazy-loaded on demand; not eager-loaded at boot
- Selectors: `selectCustomerSummaries` returns sorted by balance DESC (leaderboard-ready)
- `selectCustomersWithBalance` and `selectFullyPaidCustomers` for filtered views

## POS Integration (`src/app/(app)/(tabs)/pos.tsx`)

- `PaymentMethod` type extended to include `'credit'` (`src/types/index.ts`)
- `CheckoutPayload` extended with `creditCustomerId?: string`
- `CheckoutSheet` gains `creditCustomers: CreditCustomer[]` prop
- New 5th payment option "Utang" (red color, Users icon) in payment grid
- Inline customer picker with search opens below the selector button when "Utang" is selected
- `canConfirm` for credit requires `selectedCustomerId !== null`
- `handleConfirmCheckout` in POSScreen calls `useCreditStore.getState().addCreditSale()` after `checkout()` returns a non-null order when method is 'credit'
- Credit customers loaded via `useCreditStore(useShallow(selectCreditCustomers))`

## Types (`src/types/index.ts`)

Added: `CreditCustomer`, `CreditSale`, `CreditPayment`, `CustomerCreditSummary`, `CreateCreditCustomerInput`, `UpdateCreditCustomerInput`, `CreateCreditSaleInput`, `CreateCreditPaymentInput` — all inline in index.ts (not a separate types file, consistent with most domain types in this project).

## File locations

- `database/schemas/credit.schema.ts` — schema SQL + row types
- `database/migrations/016_add_receivables.ts` — migration version 16
- `database/repositories/credit.repository.ts` — all SQL for the module
- `src/store/credit.store.ts` — Zustand store + selectors
- `src/store/index.ts` — exports + initializeCreditStore wired in
- `src/types/index.ts` — all new domain interfaces added inline
