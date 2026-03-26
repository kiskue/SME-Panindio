---
name: Credit Ledger Module ("Utang")
description: Architecture and design decisions for the credit/accounts-receivable module
type: project
---

## Credit Ledger Module ("Utang")
- Screens: `src/app/(app)/(tabs)/credit.tsx` (list) + `src/app/(app)/(tabs)/credit/[id].tsx` (detail)
- Module accent: `#7C3AED` dark / `#6D28D9` light (violet — distinct from all other modules)
- `isNestedScreen` regex in `_layout.tsx` extended: `/^\/credit\/.+/` → back button, title `'Customer Detail'`
- ROUTE_TITLES: `'/credit': 'Credit Ledger'` + `Drawer.Screen name="credit"` added to `_layout.tsx`
- AppDrawer: `Wallet` icon (lucide) + `#7C3AED`; added after overhead entry
- Leaderboard ranking: sorted by `balance` desc; top-3 get medal colors `#FFD700 / #C0C0C0 / #CD7F32`
- Progress bar: `total_paid / total_credit` fill ratio; GREEN when fully paid, violet when has balance
- `CustomerCreditSummary`: `total_credit`, `total_paid`, `balance`, `is_fully_paid` fields
- Timeline: unified `TimelineEntry = { kind: 'credit'; data: CreditSale } | { kind: 'payment'; data: CreditPayment }` sorted newest-first
- RecordPaymentSheet: quick-amount preset chips (Full/75%/50%/25% of balance); validates amount <= balance
- Local stub store pattern: `useCreditStoreLocal` in credit.tsx / `useDetailStoreLocal` in [id].tsx — swap for real `useCreditStore` when ERP agent delivers
