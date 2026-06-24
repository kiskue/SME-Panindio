---
name: pattern-customer-business-owner-id
description: consume-customer-qr Edge Function did not return business_owner_id — customer.businessOwnerId was always empty string, breaking the catalog query partition filter
metadata:
  type: feedback
---

The `consume-customer-qr` Edge Function's SELECT must include `business_owner_id`. Without it, `customer.businessOwnerId` is empty/undefined in the Zustand store. Any query that filters by `businessOwnerId` (e.g. the catalog browse) silently returns zero rows.

**Why:** The `Customer` TypeScript interface has `businessOwnerId: string` as a required field, but the original Edge Function only selected `id, full_name, username, phone_number, email, verification_status, pay_later_enabled, profile_picture_url` — omitting `business_owner_id`. When `loginCustomer` persisted the response, `businessOwnerId` was `''`.

**How to apply:** Whenever adding new fields to `Customer` interface that come from the DB `customers` table, always audit both the `consume-customer-qr` and `authenticate-customer` Edge Functions to ensure the SELECT lists include those fields. After login, validate `customer.businessOwnerId` is non-empty before allowing any catalog/order queries.

**Related:** [[pattern-customer-rls-bypass]]
