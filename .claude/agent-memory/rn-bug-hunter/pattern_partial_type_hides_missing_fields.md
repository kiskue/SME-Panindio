---
name: partial-type-hides-missing-fields
description: Typing an Edge Function response as Partial<T> masks runtime shape mismatches when the payload is later cast to T with `as T`
metadata:
  type: feedback
---

When an Edge Function response is typed as `Partial<Customer>`, every field including required ones becomes optional in TypeScript. A downstream `as Customer` cast then suppresses the compiler error even though the object may be missing `status`, `updatedAt`, or other required fields.

**Why:** `suki.store.ts::consumeQrToken` typed the `consume-customer-qr` response as `Partial<Customer> & { id?: string }`. The `as Customer` cast on the fallback path let a runtime-incomplete object enter `loginCustomer` and persist to AsyncStorage. On the next cold start, the hydrated `currentCustomer` had `undefined` for required fields, making downstream guards like `customer.status === 'ACTIVE'` silently fail.

**How to apply:** Always type an Edge Function response as the full domain interface when the function guarantees the full shape. Use `Partial<T>` only when the response is intentionally a subset. Never use `as T` to cast a known-`Partial` into a full type without a runtime shape guard.
