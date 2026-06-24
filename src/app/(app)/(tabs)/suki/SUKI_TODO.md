# Suki Module — Feature Enhancement TODO

> **Blueprint version:** 2026-05-15 (revised 2026-05-15)
> **Parent blueprint:** /SUKI_TODO.md (Phase 0–14)
> **Scope:** Suki module enhancements, architectural corrections, and Supabase DDL cleanup.

---

## Architecture Decision (2026-05-15)

**Customer registration is self-service only.**

Customers register themselves at `/(auth)/customer-register` (standalone screen).
They enter a business code to select their store — the business owner hands out their 8-character code.

The business owner does NOT register customers from inside the Suki screen.
The `register-customer.tsx` route inside `suki/` has been removed.
The FAB "Register Customer" button has been removed from `suki/index.tsx`.

The `CustomerLoginSheet` (QR scan + password login) has been removed from the login screen.
Customer login flows through `/(auth)/customer-register` → `/(auth)/customer-qr-result` → `/(customer)/home`.

**Rationale:** Centralising registration in one standalone flow avoids duplicated logic,
makes the customer journey self-directed, and keeps the business owner's Suki screen
focused on managing and verifying existing customers.

---

## Phase 15 — Supabase Schema & Edge Function Updates

> Required for the standalone customer registration flow to work end-to-end.

### Supabase Schema Changes

- [ ] **[DB-17]** Run Migration 032b — create `businesses_public` view (see SUPABASE_SUKI_SCHEMA.md §Migration 032b)
- [ ] **[DB-18]** Run Migration 032c — add `registered_by_owner BOOLEAN NOT NULL DEFAULT FALSE` column to `customers` table (see SUPABASE_SUKI_SCHEMA.md §Migration 032c)
- [ ] **[DB-19]** Update Edge Function `generate-customer-qr` to handle `registeredByOwner: true` path:
  - When `registeredByOwner === true`: resolve `business_owner_id` from `auth.uid()` (JWT claim) instead of looking up `businessCode` in `business_codes` table
  - Set `registered_by_owner = TRUE` on the inserted `customers` row
  - No `businessCode` field is required in the request body for this path
  - All other logic (bcrypt hash, QR token insert, response shape) is identical
- [ ] **[DB-20]** Grant `anon` role SELECT on `businesses_public` view in Supabase dashboard (required for unauthenticated customer search)

---

## Phase 16 — Customer Login Screen (Standalone)

> Replace the removed `CustomerLoginSheet` on the login page with a dedicated
> customer-facing login screen at `/(auth)/customer-login` or `/(customer)/login`.

### UI Changes

- [ ] **[UI-60]** Create `/(auth)/customer-login.tsx` — standalone customer login screen:
  - Fields: Business search picker (uses `BusinessSearchInput` molecule), Username, Password
  - "Sign In" button → calls `authenticateCustomer(businessCode, username, password)` from `useSukiStore`
  - On success → `router.replace('/(customer)/home')`
  - Link to `/(auth)/customer-register` for new customers
  - Back button → `/(auth)/login`
- [ ] **[UI-61]** Update `/(auth)/customer-register.tsx` "Already registered? Back to Login" link to point to `/(auth)/customer-login` once that screen exists (currently points to `/(auth)/login` as a fallback)
- [ ] **[UI-62]** Update `/(auth)/login.tsx` "Customer portal" button to navigate to `/(auth)/customer-login` instead of `/(auth)/customer-register` once `customer-login.tsx` exists
- [ ] **[UI-63]** Register `customer-login` in `/(auth)/_layout.tsx` Stack screens

---

## Phase 16b — Business Search Input Molecule

- [ ] **[UI-56]** Create `BusinessSearchInput` molecule at `src/components/molecules/BusinessSearchInput/index.tsx`:
  - Controlled text input with a debounce of 300ms before calling `searchBusinesses()`
  - Renders a dropdown list below the input when `results.length > 0`
  - Each row: business name (bold) — tapping selects it and hides the dropdown
  - When a result is selected: display the business name in the input field, store the resolved `businessCode` internally (not shown to user)
  - Loading spinner inside the input (right side) when `isSearching === true`
  - "No businesses found" row when results are empty and query length >= 3
  - Clears results and resolved code when input is manually cleared
- [ ] **[UI-57]** Use `BusinessSearchInput` in `/(auth)/customer-login.tsx` (replaces the current inline implementation inside `CustomerLoginSheet`)
- [ ] **[UI-58]** Add Storybook story `BusinessSearchInput.stories.tsx`:
  - Story: loading state
  - Story: results list
  - Story: empty results
  - Story: selected state

---

## Phase 17 — Business-Owner QR Regeneration

> The business owner may need to regenerate a QR for a customer whose first-login QR expired.
> This is NOT a re-registration — it reuses the existing customer row and generates a new token.

- [ ] **[UI-64]** Add "Regenerate QR" action to the customer detail screen `/(app)/(tabs)/suki/[id].tsx`:
  - Only shown when `customer.firstLoginCompleted === false` (customer never completed first login)
  - Calls a new `regenerateCustomerQr(customerId)` action on `useSukiBusinessStore`
  - On success: show the new QR in a bottom sheet (reuse QrSheet from the now-removed `register-customer.tsx`)
- [ ] **[STORE-17]** Add `regenerateCustomerQr(customerId)` to `suki_business.store.ts`:
  - Calls a new Edge Function `regenerate-customer-qr` (or extends `generate-customer-qr` with a regenerate path)
  - Returns `{ token, expiresAt }` on success
- [ ] **[DB-21]** Deploy new/updated `regenerate-customer-qr` Edge Function:
  - Authenticates via JWT (business owner must own the customer)
  - Generates a new 64-char hex token
  - Inserts a new row in `customer_qr_tokens` — does NOT delete old rows (they are already consumed/expired)
  - Returns `{ token, expiresAt }`

---

## Phase 18 — Suki Customer List Enhancements

- [ ] **[STORE-14]** Add optional `registeredByOwner?: boolean` field to `CustomerSummary` interface in `src/types/index.ts`
  - Update `mapCustomerRow()` in `suki_business.store.ts` to map `registered_by_owner` column (requires DB-18 first)
- [ ] **[UI-55]** Show "Registered by owner" badge (small amber chip) on customer rows in `suki/index.tsx` when `registeredByOwner === true`

---

## Supabase DDL Cleanup (Run in Supabase SQL Editor)

> These statements clean up schema artifacts created during development that are no longer needed,
> or fix issues identified in the schema.
> DO NOT run these in application code. Run each block in the Supabase SQL Editor manually.
> Always take a database backup before running DROP statements.

### 1. customer_qr_tokens — no cleanup needed

The `customer_qr_tokens` table is still required. It stores the one-time QR login tokens
generated when a customer registers. The `consume-customer-qr` Edge Function reads from it.
**DO NOT drop this table.**

The QR scan feature was removed from the *business owner login screen*, not from the
customer onboarding flow. Customers still receive a QR code after registering at
`/(auth)/customer-register` and must scan it on first login via `/(customer)/home`.

### 2. customer_sessions — login_method constraint update (future)

If the QR first-login requirement is removed in the future (i.e., customers can log in
with password only, without ever scanning a QR), the following changes would be needed:

```sql
-- Remove QR_LOGIN_REQUIRED enforcement in authenticate-customer Edge Function
-- Update first_login_completed to default TRUE for new registrations
-- Optionally loosen the login_method constraint:
ALTER TABLE public.customer_sessions
  DROP CONSTRAINT chk_customer_sessions_login_method;

ALTER TABLE public.customer_sessions
  ADD CONSTRAINT chk_customer_sessions_login_method
  CHECK (login_method IN ('QR_SCAN', 'PASSWORD', 'DIRECT'));
```

**Status: NOT REQUIRED YET.** The QR first-login flow is still active.

### 3. SUPABASE_SUKI_SCHEMA.md — TODOS artifact cleanup (DONE)

The `SUPABASE_SUKI_SCHEMA.md` file contained stray `TODOS` text before several trigger
creation statements. These have been removed (committed 2026-05-15).

### 4. Migration 025b — credit_customers bridge (pending)

```sql
-- Run this AFTER confirming the Suki customer module is live and customers exist.
-- Links a verified suki customer to their credit (utang) ledger entry.
ALTER TABLE public.credit_customers
  ADD COLUMN IF NOT EXISTS customer_suki_id UUID
    REFERENCES public.customers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_credit_customers_suki_id
  ON public.credit_customers (customer_suki_id)
  WHERE customer_suki_id IS NOT NULL;
```

**Status: PENDING — run after Suki customers are live in production.**

---

## Store Changes (completed)

- [x] **[STORE-11]** `BusinessRegisterCustomerInput` type added to `src/types/index.ts`
- [x] **[STORE-12]** `registerCustomerByBusiness(input, businessId)` action added to `suki_business.store.ts`
- [x] **[STORE-13]** `selectRegisterCustomerByBusiness` selector added to `suki_business.store.ts`
- [x] **[STORE-15]** `BusinessSearchResult` type added to `src/types/index.ts`
- [x] **[STORE-16]** `src/store/business_search.store.ts` created with `searchBusinesses(query)` action

---

## Removed Items (architectural correction 2026-05-15)

These items from the original Phase 15 plan have been superseded by the self-service
registration architecture decision above:

- ~~**[UI-52]** Create `RegisterCustomerSheet` organism~~ — business-owner registration removed
- ~~**[UI-53]** QR display within `RegisterCustomerSheet`~~ — superseded by QR bottom sheet in `register-customer.tsx` (itself now removed; the QrSheet component should be extracted to a molecule if needed again)
- ~~**[UI-54]** "Register New Customer" FAB in `suki/index.tsx`~~ — FAB removed; registration is self-service only
- ~~**[UI-57]** Replace Business Code input in `CustomerLoginSheet`~~ — `CustomerLoginSheet` removed from login screen; business search will live in the new `/(auth)/customer-login.tsx` screen

---

## Testing Checklist

### Customer Self-Registration Flow

- [ ] Customer taps "Customer? Register or Log In here" on `/(auth)/login`
- [ ] Navigates to `/(auth)/customer-register`
- [ ] Business code field is first — customer enters code from business owner
- [ ] Validation blocks submit on invalid phone, short username, password mismatch
- [ ] Invalid business code shows "Business code not found" error
- [ ] Duplicate username shows "Username already taken" error
- [ ] On success: navigates to `/(auth)/customer-qr-result` with QR displayed
- [ ] QR countdown timer counts down from 15 minutes
- [ ] "Scan Now → Log In" button navigates to `/(auth)/login` after clearing SecureStore
- [ ] After QR expires: "QR Code Expired" state shown with contact-owner message
- [ ] TypeScript: `npx tsc --noEmit` passes with zero errors in modified files

### Business Owner Suki Screen

- [ ] Suki index screen loads loyal customer list correctly
- [ ] Status filter tabs work (All / Unverified / Pending / Verified)
- [ ] Search by name and phone number works
- [ ] Pull-to-refresh reloads the list
- [ ] Tapping a customer navigates to `/(app)/(tabs)/suki/[id]`
- [ ] No "Register Customer" FAB is visible (removed)
- [ ] Empty state message correctly says "Customers can register themselves using the Customer Portal"
- [ ] TypeScript: `npx tsc --noEmit` passes with zero errors in modified files
