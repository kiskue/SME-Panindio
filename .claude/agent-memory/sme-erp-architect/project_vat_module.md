---
name: Philippine VAT Module
description: Global 12% VAT toggle, VAT utility lib, POS checkout VAT breakdown, dashboard P&L VAT rows
type: project
---

Philippine VAT (12%) is implemented as a global toggle stored in a persisted Zustand store, with pure calculation logic in a utility module.

**Why:** TRAIN Law / BIR standard requires VAT-registered businesses to charge 12% output VAT. SME owners need a simple on/off toggle since not all micro-businesses are VAT-registered.

**How to apply:** Use `useVatStore` / `selectVatEnabled` when any feature needs to respect the VAT setting.

## Files

- `src/lib/vat.ts` — pure VAT functions: `calculateVAT()`, `computeCartVAT()`, `VAT_RATE = 0.12`, `VatType` union
- `src/store/vat.store.ts` — Zustand v5 persisted store; no `initialize` function needed (AsyncStorage persist middleware handles hydration on first access)
- `src/store/index.ts` — exports `useVatStore`, `selectVatEnabled`, `selectDefaultVatType`, `selectIsVatInclusive`

## Business rules

- VAT-exclusive (default, B2B PH standard): `vat_amount = price × 0.12`, `total = price × 1.12`
- VAT-inclusive (retail): `vat_amount = price − (price / 1.12)`, `base = price / 1.12`
- Per-product `vat_type`: `'vatable' | 'vat_exempt' | 'zero_rated'` — defined in vat.ts, NOT yet on InventoryItem (no schema migration yet)
- Until per-product vat_type is on the DB row, `computeCartVAT()` defaults all items to `'vatable'`

## Dashboard integration

- `DashboardKPIs.outputVAT?: number` added to `src/types/dashboard.types.ts`
- `dashboard.store.ts` computes `outputVAT` via dynamic import of `useVatStore` after `getDashboardData()` resolves
- APPROXIMATION comment in dashboard.store.ts: assumes all sales are vatable; replace with per-transaction SUM when vat_type is on sales_order_items
- `PLWaterfallCard` in `index.tsx` receives `vatEnabled` prop and renders "Output VAT (12%)" and "VAT-Exclusive Revenue" rows between Gross Income and COGS

## POS integration

- `CheckoutPayload.vatAmount?: number` added to local type in pos.tsx
- `computeCartVAT()` called in CheckoutSheet; VAT rows shown between Subtotal and Total when `vatEnabled`
- `finalTotal` in CheckoutSheet adds `vatOnDiscounted` when exclusive VAT is on
- `pos.store.ts` checkout options accepts `vatAmount?: number` (threaded through for future DB persistence)
- `createSalesOrder` in sales.repository.ts does NOT yet accept vatAmount — it will be added when the schema migration lands

## Profile screen

- "VAT Settings" card section with two Switch rows: "Apply VAT (12%)" and (conditional) "VAT-Inclusive Prices"
- Switch track/thumb uses `theme.colors.warning[400/500]` for amber accent
- No new `initializeStores()` entry needed — vat.store self-hydrates from AsyncStorage
