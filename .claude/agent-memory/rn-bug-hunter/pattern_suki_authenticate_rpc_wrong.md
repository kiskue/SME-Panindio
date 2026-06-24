---
name: pattern-suki-authenticate-rpc-wrong
description: suki.store.ts authenticateCustomer called supabase.rpc('authenticate_customer') — there is no such RPC; must call the authenticate-customer Edge Function via fetch
metadata:
  type: feedback
---

`authenticateCustomer` must call the `authenticate-customer` Edge Function via `fetch()`, NOT `supabase.rpc('authenticate_customer')`.

**Why:** No `authenticate_customer` PostgreSQL function exists in the schema. Password verification requires bcrypt comparison which only runs server-side in the Edge Function. The RPC call always returns a `function does not exist` error, silently blocking all password-login attempts.

**How to apply:** Any store action that needs to verify passwords or run server-side-only logic must use `fetch()` against the appropriate Edge Function. Never assume a Supabase RPC exists without checking `SUPABASE_SUKI_SCHEMA.md` or the Supabase Dashboard first.
