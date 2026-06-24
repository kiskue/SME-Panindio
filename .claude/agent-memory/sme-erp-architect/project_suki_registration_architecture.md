---
name: project_suki_registration_architecture
description: Architectural decision — Suki customer registration is self-service only; removed from Suki screen and login; standalone /(auth)/customer-register is the single entry point
metadata:
  type: project
---

Customer registration for the Suki module is self-service only (decided 2026-05-15).

**The canonical registration flow is:**
1. Customer taps "Customer? Register or Log In here" on `/(auth)/login`
2. Navigates to `/(auth)/customer-register` (standalone screen, always had `businessCode` as first field)
3. Enters the 8-character business code they get from the business owner
4. After successful registration, navigates to `/(auth)/customer-qr-result` (QR code display)
5. Scans QR on first login → `/(customer)/home`

**Removed:**
- The "Customer" mode toggle and `CustomerLoginSheet` (QR scan camera + password login) from `/(auth)/login.tsx` — the business owner login screen is now business-only
- The "Register Customer" FAB from `src/app/(app)/(tabs)/suki/index.tsx`
- The `register-customer.tsx` route from `src/app/(app)/(tabs)/suki/` (it was doing business-owner-initiated registration which is no longer the model)
- `register-customer` removed from `suki/_layout.tsx` Stack

**Still in place:**
- `/(auth)/customer-register.tsx` — standalone self-service registration
- `/(auth)/customer-qr-result.tsx` — QR display after registration
- `src/store/suki_business.store.ts` → `registerCustomerByBusiness()` action is STILL in the store (kept, may be used for QR regeneration flows)
- `customer_qr_tokens` Supabase table — still required; do NOT drop it
- `CustomerLoginSheet` organism file still exists (not deleted) — may be repurposed for a future `/(auth)/customer-login.tsx` screen

**Pending work (tracked in SUKI_TODO.md):**
- Create `/(auth)/customer-login.tsx` — dedicated customer login screen that uses `BusinessSearchInput` + username/password (replaces the removed `CustomerLoginSheet` on the login page)
- Update login screen "Customer portal" button to navigate to `/(auth)/customer-login` once that exists (currently goes to `/(auth)/customer-register`)

**Why:**
User clarified that registration should only exist as a standalone customer-facing flow where the customer selects the store/business themselves. Business-owner-initiated registration from inside the Suki screen creates duplicated logic and scatters the registration flow.

**How to apply:**
Never add registration forms/buttons back into the Suki business-owner screens. The Suki screen is for managing and verifying existing customers only. New customers always enter through `/(auth)/customer-register`.
