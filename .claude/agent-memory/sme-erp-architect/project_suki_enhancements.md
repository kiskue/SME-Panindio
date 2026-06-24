---
name: project-suki-enhancements
description: Phase 15-16 Suki module enhancements — business-side registration with QR, and customer business search by name replacing manual code entry
metadata:
  type: project
---

## Business-Side Customer Registration (Phase 15) and Business Search (Phase 16)

Two targeted enhancements added to the existing Suki module on 2026-05-15.

### Feature 1: Business-side registration with QR

The business owner can register a new customer from the Suki tab directly, without handing out a business code for the customer to type. After submitting, a QR code is shown in-sheet immediately.

**Why:** Reduces friction for less tech-savvy customers who would struggle to type the code correctly. Enables the business owner to handle onboarding face-to-face.

**How to apply:** `registerCustomerByBusiness()` in `suki_business.store.ts` reuses the existing `generate-customer-qr` Edge Function. The discriminant is `registeredByOwner: true` in the request body. The Edge Function resolves `business_owner_id` from `auth.uid()` (JWT), not a typed code. The `businessOwnerId` field in the request body is informational only and MUST NOT be trusted for the INSERT.

### Feature 2: Business search by name on CustomerLoginSheet (Phase 16)

The "Business Code" plain TextInput in `CustomerLoginSheet`'s password tab is replaced by a `BusinessSearchInput` molecule that queries `businesses_public` view and resolves the code behind the scenes.

**Why:** Customers should not have to memorise an opaque 8-character code like "PANIN123". Searching by store name (like an app store search) is a far lower-friction UX.

**How to apply:** `business_search.store.ts` queries `businesses_public` view (anon-accessible, ilike on business_name). The `authenticateCustomer(businessCode, username, password)` signature in `suki.store` is unchanged — the resolved code is passed transparently.

### Schema changes

**Migration 032b** — `businesses_public` VIEW (new):
- Joins `business_codes` + `auth.users` to expose only `(business_name, business_code)`
- No PII, no owner UUIDs
- `GRANT SELECT ON public.businesses_public TO anon` is required — must be run in Supabase dashboard
- `business_name` is derived from `raw_user_meta_data->>'business_name'` — update the JOIN if the name lives elsewhere

**Migration 032c** — `customers` table (alter):
- `ADD COLUMN IF NOT EXISTS registered_by_owner BOOLEAN NOT NULL DEFAULT FALSE`
- Index on `(business_owner_id, registered_by_owner)` WHERE deleted_at IS NULL

### New/modified files

- `src/types/index.ts` — added `BusinessRegisterCustomerInput`, `BusinessSearchResult`
- `src/store/suki_business.store.ts` — added `registerCustomerByBusiness()` action + `selectRegisterCustomerByBusiness` selector
- `src/store/business_search.store.ts` — rewritten (was draft with wrong join); now queries `businesses_public` view; selectors: `selectBusinessSearchResults`, `selectBusinessSearching`, `selectBusinessSearchError`
- `SUPABASE_SUKI_SCHEMA.md` — appended Migration 032b, 032c, and Edge Function contract diff
- `src/app/(app)/(tabs)/suki/SUKI_TODO.md` — new feature-scoped TODO (Phase 15 + 16 checklists)

### UI still to build (not implemented by this session)

- `RegisterCustomerSheet` organism (Phase 15)
- QR display within the sheet on success (Phase 15)
- "Register New Customer" FAB in suki/index.tsx (Phase 15)
- `registered_by_owner` badge on CustomerSummary card (Phase 15)
- `BusinessSearchInput` molecule (Phase 16)
- Replace TextInput in CustomerLoginSheet password tab (Phase 16)

See `[[project-suki-module]]` for the base Suki architecture.
