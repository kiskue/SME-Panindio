---
name: pattern-customer-rls-bypass
description: Customers (non-Supabase-Auth users) must always go through Edge Functions (service_role) to read RLS-protected tables — direct supabase-js client queries return [] silently
metadata:
  type: feedback
---

Customer-facing Supabase queries MUST use Edge Functions with `SUPABASE_SERVICE_ROLE_KEY`, never the anon-key supabase-js client directly.

**Why:** The `online_catalog` table has `catalog_all_own` RLS: `business_owner_id = auth.uid()`. Customers are NOT Supabase Auth users — they have no `auth.uid()`. A direct `.from('online_catalog').select(...)` with the anon client returns `[]` silently (PostgREST returns an empty array, not a 403). The schema doc explicitly states: "No direct customer RLS needed — Edge Function handles the WHERE is_available = TRUE filter."

**How to apply:** Any new screen in `src/app/(customer)/` that reads Supabase data must call an Edge Function via `fetch()` with `Authorization: Bearer <ANON_KEY>`. The Edge Function uses the service_role key internally. Never import `supabase` from `@/lib/supabase` in customer screens for data reads.

**Related bug:** `businessOwnerId` missing — see [[pattern-customer-business-owner-id]].
