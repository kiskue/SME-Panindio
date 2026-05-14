# Supabase Schema — Suki (Loyal Customer) Module

> **Version:** 1.0 — 2026-05-15
> **Applies to:** SME-Panindio, Supabase (PostgreSQL 15)
> Run each migration block in the Supabase SQL Editor **in order**.
> All migrations are idempotent (`CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`).

---

## Conventions

All tables follow the project-standard audit columns:

```sql
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
created_by  UUID REFERENCES auth.users(id)
updated_by  UUID REFERENCES auth.users(id)
status      TEXT NOT NULL DEFAULT 'ACTIVE'
deleted_at  TIMESTAMPTZ  -- soft delete; NULL = active
```

The `update_updated_at()` trigger is assumed to exist from prior migrations. If not present, add it once:

```sql
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;
```

---

## Migration 025 — `customers` table

> Core customer profile. Linked to a business owner via `business_owner_id`.
> Authentication is handled by this table directly (not Supabase Auth) because customers
> are sub-users of a business, not independent Supabase Auth users.
> Password is stored as a bcrypt hash (cost 12) — computed in an Edge Function, never in client code.

```sql
-- Migration 025: customers
CREATE TABLE IF NOT EXISTS public.customers (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_owner_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,

  -- Credentials
  username              TEXT NOT NULL,
  password_hash         TEXT NOT NULL,  -- bcrypt hash, cost 12, set by Edge Function

  -- Profile
  full_name             TEXT NOT NULL,
  phone_number          TEXT NOT NULL,
  email                 TEXT,
  profile_picture_url   TEXT,           -- Supabase Storage signed URL path (selfie)

  -- Verification
  verification_status   TEXT NOT NULL DEFAULT 'UNVERIFIED',
  -- Allowed values: 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'REJECTED'
  verified_at           TIMESTAMPTZ,
  verified_by           UUID REFERENCES auth.users(id),  -- the business owner who approved
  rejection_reason      TEXT,

  -- Pay Later gate (manual override by business owner)
  pay_later_enabled     BOOLEAN NOT NULL DEFAULT FALSE,

  -- QR first-login tracking
  first_login_completed BOOLEAN NOT NULL DEFAULT FALSE,
  first_login_at        TIMESTAMPTZ,

  -- Standard audit
  status                TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by            UUID REFERENCES auth.users(id),
  updated_by            UUID REFERENCES auth.users(id),
  deleted_at            TIMESTAMPTZ
);

-- Uniqueness: username must be unique per business (not globally)
CREATE UNIQUE INDEX IF NOT EXISTS uq_customers_username_per_business
  ON public.customers (business_owner_id, username)
  WHERE deleted_at IS NULL;

-- Index: business owner lookups (the most frequent query)
CREATE INDEX IF NOT EXISTS idx_customers_business_owner
  ON public.customers (business_owner_id)
  WHERE deleted_at IS NULL;

-- Index: verification status filter
CREATE INDEX IF NOT EXISTS idx_customers_verification_status
  ON public.customers (business_owner_id, verification_status)
  WHERE deleted_at IS NULL;

-- Index: phone lookup (for future SMS notifications)
CREATE INDEX IF NOT EXISTS idx_customers_phone
  ON public.customers (phone_number)
  WHERE deleted_at IS NULL;

-- Auto-update updated_at
CREATE TRIGGER trg_customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Constraint: verification_status values
ALTER TABLE public.customers
  ADD CONSTRAINT chk_customers_verification_status
  CHECK (verification_status IN ('UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED'));
```

### RLS Policies — `customers`

```sql
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- Business owner can SELECT their own customers only
CREATE POLICY customers_select_own
  ON public.customers FOR SELECT
  USING (business_owner_id = auth.uid());

-- Business owner can INSERT new customers (registration is done via Edge Function
-- which runs with service_role key — this policy is a fallback)
CREATE POLICY customers_insert_own
  ON public.customers FOR INSERT
  WITH CHECK (business_owner_id = auth.uid());

-- Business owner can UPDATE their own customers (e.g., verify, toggle pay_later)
CREATE POLICY customers_update_own
  ON public.customers FOR UPDATE
  USING (business_owner_id = auth.uid())
  WITH CHECK (business_owner_id = auth.uid());

-- Service role bypass (Edge Functions use service_role — they bypass RLS by default)
-- No additional policy needed for Edge Functions using service_role.

-- Customer self-select: a customer can read their own row.
-- NOTE: Customers are NOT Supabase Auth users — their session is managed by the app
-- using a custom JWT or a stored customer_id in SecureStore. The Edge Function
-- generate-customer-session returns a signed app-level token, not a Supabase JWT.
-- Therefore, there is no auth.uid() equivalent for customers in standard RLS.
-- Customer-facing SELECT queries must go through Edge Functions (service_role).
```

---

## Migration 026 — `customer_qr_tokens` table

> One-time-use QR login tokens. Each token is generated at registration time.
> Once scanned (`consumed_at IS NOT NULL`), the token is permanently invalidated.
> Token value is a cryptographically random 64-character hex string.

```sql
-- Migration 026: customer_qr_tokens
CREATE TABLE IF NOT EXISTS public.customer_qr_tokens (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id     UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,

  -- The raw token embedded in the QR code (64-char hex, crypto random)
  token           TEXT NOT NULL UNIQUE,

  -- Expiry: 15 minutes from generation (enforced server-side in Edge Function)
  expires_at      TIMESTAMPTZ NOT NULL,

  -- Consumption tracking (one-time use)
  consumed_at     TIMESTAMPTZ,                    -- NULL = not yet used
  consumed_ip     TEXT,                           -- IP that consumed the token
  consumed_device TEXT,                           -- device fingerprint string

  -- Standard audit (no updated_by / status needed — this is append-only)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      UUID REFERENCES auth.users(id)  -- the business owner or system
);

-- Index: token lookup is the hot path (scan → validate)
CREATE UNIQUE INDEX IF NOT EXISTS uq_customer_qr_tokens_token
  ON public.customer_qr_tokens (token);

-- Index: list tokens by customer (e.g., regenerate flow)
CREATE INDEX IF NOT EXISTS idx_customer_qr_tokens_customer
  ON public.customer_qr_tokens (customer_id);

-- Index: find unconsumed, non-expired tokens for a customer
CREATE INDEX IF NOT EXISTS idx_customer_qr_tokens_active
  ON public.customer_qr_tokens (customer_id, consumed_at, expires_at);
```

### RLS Policies — `customer_qr_tokens`

```sql
ALTER TABLE public.customer_qr_tokens ENABLE ROW LEVEL SECURITY;

-- Business owner can SELECT tokens for their own customers only
CREATE POLICY qr_tokens_select_own_customers
  ON public.customer_qr_tokens FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = customer_qr_tokens.customer_id
        AND c.business_owner_id = auth.uid()
    )
  );

-- All writes go through Edge Functions (service_role) — no direct client INSERT/UPDATE
-- Deny all direct client writes:
CREATE POLICY qr_tokens_no_direct_write
  ON public.customer_qr_tokens FOR INSERT
  WITH CHECK (FALSE);

CREATE POLICY qr_tokens_no_direct_update
  ON public.customer_qr_tokens FOR UPDATE
  USING (FALSE);
```

---

## Migration 027 — `customer_sessions` table

> Audit log of every customer login event. Immutable (append-only).
> Used for security monitoring and "last seen" display in the business owner's customer detail screen.

```sql
-- Migration 027: customer_sessions
CREATE TABLE IF NOT EXISTS public.customer_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id     UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,

  -- Session metadata
  session_token   TEXT NOT NULL UNIQUE,     -- app-level session token (stored in SecureStore)
  login_method    TEXT NOT NULL,            -- 'QR_SCAN' | 'PASSWORD'
  ip_address      TEXT,
  device_info     TEXT,                     -- JSON string: { platform, osVersion, deviceModel }

  -- Expiry (30 days rolling)
  expires_at      TIMESTAMPTZ NOT NULL,
  invalidated_at  TIMESTAMPTZ,              -- manual logout or forced invalidation

  -- Audit
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index: look up active sessions by token (auth middleware hot path)
CREATE UNIQUE INDEX IF NOT EXISTS uq_customer_sessions_token
  ON public.customer_sessions (session_token);

-- Index: list sessions by customer (security audit)
CREATE INDEX IF NOT EXISTS idx_customer_sessions_customer
  ON public.customer_sessions (customer_id, created_at DESC);

-- Constraint: login_method values
ALTER TABLE public.customer_sessions
  ADD CONSTRAINT chk_customer_sessions_login_method
  CHECK (login_method IN ('QR_SCAN', 'PASSWORD'));
```

### RLS Policies — `customer_sessions`

```sql
ALTER TABLE public.customer_sessions ENABLE ROW LEVEL SECURITY;

-- Business owner can view sessions for their customers
CREATE POLICY sessions_select_own_customers
  ON public.customer_sessions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = customer_sessions.customer_id
        AND c.business_owner_id = auth.uid()
    )
  );

-- All writes via Edge Functions only
CREATE POLICY sessions_no_direct_write
  ON public.customer_sessions FOR INSERT
  WITH CHECK (FALSE);
```

---

## Migration 028 — `customer_id_documents` table

> Stores references to uploaded ID images and selfies in Supabase Storage.
> This table holds metadata + OCR-extracted data; the actual images are in Storage buckets.
> One row per customer (UPSERT on second upload attempt).

```sql
-- Migration 028: customer_id_documents
CREATE TABLE IF NOT EXISTS public.customer_id_documents (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id         UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,

  -- Storage paths (relative to bucket root, NOT full URLs — generate signed URLs on demand)
  id_front_path       TEXT,     -- e.g. "{business_id}/{customer_id}/id_front.jpg"
  id_back_path        TEXT,     -- optional (some IDs are single-sided)
  selfie_path         TEXT,     -- e.g. "{business_id}/{customer_id}/selfie.jpg"

  -- OCR-extracted fields from the ID (client-side MLKit result, corrected by user)
  ocr_full_name       TEXT,
  ocr_birth_date      DATE,
  ocr_id_number       TEXT,     -- PCN / SSS / Driver's License number
  ocr_id_type         TEXT,     -- 'NATIONAL_ID' | 'DRIVERS_LICENSE' | 'SSS' | 'PHILHEALTH' | 'PASSPORT' | 'OTHER'
  ocr_raw_text        TEXT,     -- full raw OCR output (for audit/debugging)

  -- Liveness detection result
  liveness_passed     BOOLEAN NOT NULL DEFAULT FALSE,
  liveness_at         TIMESTAMPTZ,
  liveness_frames     INTEGER,  -- number of successful pose frames captured

  -- Review metadata
  reviewed_by         UUID REFERENCES auth.users(id),
  reviewed_at         TIMESTAMPTZ,
  review_notes        TEXT,

  -- Standard audit
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by          UUID REFERENCES auth.users(id),
  updated_by          UUID REFERENCES auth.users(id)
);

-- One document record per customer (UPSERT target)
CREATE UNIQUE INDEX IF NOT EXISTS uq_customer_id_documents_customer
  ON public.customer_id_documents (customer_id);

CREATE TRIGGER trg_customer_id_documents_updated_at
  BEFORE UPDATE ON public.customer_id_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Constraint: id_type values
ALTER TABLE public.customer_id_documents
  ADD CONSTRAINT chk_id_type
  CHECK (ocr_id_type IN (
    'NATIONAL_ID', 'DRIVERS_LICENSE', 'SSS', 'PHILHEALTH', 'PASSPORT', 'OTHER'
  ) OR ocr_id_type IS NULL);
```

### RLS Policies — `customer_id_documents`

```sql
ALTER TABLE public.customer_id_documents ENABLE ROW LEVEL SECURITY;

-- Business owner can SELECT documents for their customers
CREATE POLICY id_docs_select_own_customers
  ON public.customer_id_documents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = customer_id_documents.customer_id
        AND c.business_owner_id = auth.uid()
    )
  );

-- Business owner can UPDATE (set reviewed_by, reviewed_at, review_notes)
CREATE POLICY id_docs_update_own_customers
  ON public.customer_id_documents FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = customer_id_documents.customer_id
        AND c.business_owner_id = auth.uid()
    )
  );

-- Uploads go through Edge Functions (service_role)
CREATE POLICY id_docs_no_direct_insert
  ON public.customer_id_documents FOR INSERT
  WITH CHECK (FALSE);
```

---

## Migration 028b — `customer_verification_audit` table

> Immutable audit log of every verification action. Required for SEC-08.

```sql
-- Migration 028b: customer_verification_audit
CREATE TABLE IF NOT EXISTS public.customer_verification_audit (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id     UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  actor_id        UUID NOT NULL REFERENCES auth.users(id),
  action          TEXT NOT NULL,  -- 'APPROVED' | 'REJECTED' | 'PENDING_SET' | 'PAY_LATER_ENABLED' | 'PAY_LATER_DISABLED'
  previous_status TEXT,
  new_status      TEXT,
  reason          TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_verification_audit_customer
  ON public.customer_verification_audit (customer_id, created_at DESC);

ALTER TABLE public.customer_verification_audit
  ADD CONSTRAINT chk_verification_audit_action
  CHECK (action IN ('APPROVED', 'REJECTED', 'PENDING_SET', 'PAY_LATER_ENABLED', 'PAY_LATER_DISABLED'));
```

---

## Migration 025b — Add `customer_suki_id` to Credit Module

> Bridge between the online Suki customer and the existing offline credit ledger.
> This allows a verified Suki customer to accumulate Pay Later balance tracked
> in the existing `credit_customers` table.

```sql
-- Migration 025b: link suki customers to credit_customers
ALTER TABLE public.credit_customers
  ADD COLUMN IF NOT EXISTS customer_suki_id UUID
    REFERENCES public.customers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_credit_customers_suki_id
  ON public.credit_customers (customer_suki_id)
  WHERE customer_suki_id IS NOT NULL;
```

---

## Migration 029 — `online_catalog` table

> The business-curated subset of products available for online ordering.
> Sourced from the existing `products` table (or the local SQLite equivalent —
> the `product_id` is the SQLite UUID that is also synced to Supabase).

```sql
-- Migration 029: online_catalog
CREATE TABLE IF NOT EXISTS public.online_catalog (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Reference to the product (must match the product UUID in both SQLite and Supabase)
  product_id        UUID NOT NULL,
  product_name      TEXT NOT NULL,       -- denormalized for read performance (avoid joins in customer app)
  product_barcode   TEXT,                -- denormalized for barcode scan lookup
  product_image_url TEXT,               -- Supabase Storage path or external URL

  -- Catalog-specific overrides (can differ from the base product price)
  custom_price      NUMERIC(12, 2),     -- NULL = use the product's current price
  is_available      BOOLEAN NOT NULL DEFAULT TRUE,
  display_order     INTEGER NOT NULL DEFAULT 0,

  -- Standard audit
  status            TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by        UUID REFERENCES auth.users(id),
  updated_by        UUID REFERENCES auth.users(id),
  deleted_at        TIMESTAMPTZ
);

-- Uniqueness: one catalog entry per product per business
CREATE UNIQUE INDEX IF NOT EXISTS uq_online_catalog_product_per_business
  ON public.online_catalog (business_owner_id, product_id)
  WHERE deleted_at IS NULL;

-- Index: customer browsing (business + available)
CREATE INDEX IF NOT EXISTS idx_online_catalog_browse
  ON public.online_catalog (business_owner_id, is_available, display_order)
  WHERE deleted_at IS NULL;

-- Index: barcode scan lookup
CREATE INDEX IF NOT EXISTS idx_online_catalog_barcode
  ON public.online_catalog (business_owner_id, product_barcode)
  WHERE product_barcode IS NOT NULL AND deleted_at IS NULL;

CREATE TRIGGER trg_online_catalog_updated_at
  BEFORE UPDATE ON public.online_catalog
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

### RLS Policies — `online_catalog`

```sql
ALTER TABLE public.online_catalog ENABLE ROW LEVEL SECURITY;

-- Business owner full access to their own catalog
CREATE POLICY catalog_all_own
  ON public.online_catalog FOR ALL
  USING (business_owner_id = auth.uid())
  WITH CHECK (business_owner_id = auth.uid());

-- Customers (via Edge Function service_role) can SELECT available items only
-- No direct customer RLS needed — Edge Function handles the WHERE is_available = TRUE filter
```

---

## Migration 030 — `online_orders` table

> Header record for a customer's online order.
> Status lifecycle: PENDING → CONFIRMED → PREPARING → READY → COMPLETED | CANCELLED

```sql
-- Migration 030: online_orders
CREATE TABLE IF NOT EXISTS public.online_orders (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  customer_id       UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,

  -- Order identity
  order_number      TEXT NOT NULL UNIQUE,  -- human-readable, e.g. "ORD-20260515-0001"
  order_date        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Status
  order_status      TEXT NOT NULL DEFAULT 'PENDING',
  -- Lifecycle: 'PENDING' → 'CONFIRMED' → 'PREPARING' → 'READY' → 'COMPLETED' | 'CANCELLED'
  confirmed_at      TIMESTAMPTZ,
  ready_at          TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  cancelled_at      TIMESTAMPTZ,
  cancellation_reason TEXT,

  -- Payment
  payment_method    TEXT NOT NULL,  -- 'PAY_NOW' | 'PAY_LATER'
  payment_status    TEXT NOT NULL DEFAULT 'UNPAID',
  -- 'UNPAID' | 'PAID' | 'PARTIALLY_PAID'

  -- Financials
  subtotal          NUMERIC(12, 2) NOT NULL,
  vat_amount        NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_amount      NUMERIC(12, 2) NOT NULL,

  -- Credit ledger reference (populated when payment_method = 'PAY_LATER')
  credit_sale_id    UUID,  -- references credit_sales(id) — no FK to avoid circular dep issue on migration order

  -- Notes
  customer_notes    TEXT,

  -- Standard audit
  status            TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by        UUID REFERENCES auth.users(id),
  updated_by        UUID REFERENCES auth.users(id)
);

-- Index: business owner dashboard (list + count pending)
CREATE INDEX IF NOT EXISTS idx_online_orders_business_status
  ON public.online_orders (business_owner_id, order_status, created_at DESC);

-- Index: customer order history
CREATE INDEX IF NOT EXISTS idx_online_orders_customer
  ON public.online_orders (customer_id, created_at DESC);

-- Index: unique order number
CREATE UNIQUE INDEX IF NOT EXISTS uq_online_orders_order_number
  ON public.online_orders (order_number);

CREATE TRIGGER trg_online_orders_updated_at
  BEFORE UPDATE ON public.online_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Constraint: order_status values
ALTER TABLE public.online_orders
  ADD CONSTRAINT chk_online_orders_status
  CHECK (order_status IN ('PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED'));

-- Constraint: payment_method values
ALTER TABLE public.online_orders
  ADD CONSTRAINT chk_online_orders_payment_method
  CHECK (payment_method IN ('PAY_NOW', 'PAY_LATER'));

-- Constraint: payment_status values
ALTER TABLE public.online_orders
  ADD CONSTRAINT chk_online_orders_payment_status
  CHECK (payment_status IN ('UNPAID', 'PAID', 'PARTIALLY_PAID'));
```

### RLS Policies — `online_orders`

```sql
ALTER TABLE public.online_orders ENABLE ROW LEVEL SECURITY;

-- Business owner can see and modify all orders for their business
CREATE POLICY orders_all_own_business
  ON public.online_orders FOR ALL
  USING (business_owner_id = auth.uid())
  WITH CHECK (business_owner_id = auth.uid());

-- Customer order creation goes through Edge Function (service_role)
-- Customer read of own orders also goes through Edge Function
```

---

## Migration 031 — `online_order_items` table

> Line items for each online order.
> `unit_price` is snapshotted at order time from `online_catalog.custom_price ?? product.price`.

```sql
-- Migration 031: online_order_items
CREATE TABLE IF NOT EXISTS public.online_order_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID NOT NULL REFERENCES public.online_orders(id) ON DELETE CASCADE,
  catalog_item_id UUID REFERENCES public.online_catalog(id) ON DELETE SET NULL,

  -- Snapshotted at order time (immune to future price changes)
  product_id      UUID NOT NULL,
  product_name    TEXT NOT NULL,
  product_barcode TEXT,
  unit_price      NUMERIC(12, 2) NOT NULL,
  quantity        INTEGER NOT NULL CHECK (quantity > 0),
  line_total      NUMERIC(12, 2) GENERATED ALWAYS AS (unit_price * quantity) STORED,

  -- Stock reduction tracking
  stock_reduced           BOOLEAN NOT NULL DEFAULT FALSE,
  stock_reduced_at        TIMESTAMPTZ,
  stock_reduction_failed  BOOLEAN NOT NULL DEFAULT FALSE,

  -- Audit
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index: items by order
CREATE INDEX IF NOT EXISTS idx_online_order_items_order
  ON public.online_order_items (order_id);

-- Index: find items where stock reduction is pending (for sync queue processing)
CREATE INDEX IF NOT EXISTS idx_online_order_items_stock_pending
  ON public.online_order_items (order_id)
  WHERE stock_reduced = FALSE AND stock_reduction_failed = FALSE;
```

### RLS Policies — `online_order_items`

```sql
ALTER TABLE public.online_order_items ENABLE ROW LEVEL SECURITY;

-- Business owner can see all items for their orders
CREATE POLICY order_items_select_own_business
  ON public.online_order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.online_orders o
      WHERE o.id = online_order_items.order_id
        AND o.business_owner_id = auth.uid()
    )
  );

-- All writes via Edge Function (service_role)
CREATE POLICY order_items_no_direct_insert
  ON public.online_order_items FOR INSERT
  WITH CHECK (FALSE);
```

---

## Migration 032 — `business_codes` table

> Each business owner is assigned a unique alphanumeric code (8 chars, uppercase).
> Customers enter this code during registration to link to the correct business.

```sql
-- Migration 032: business_codes
CREATE TABLE IF NOT EXISTS public.business_codes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code              TEXT NOT NULL UNIQUE,  -- 8-char uppercase alphanumeric, e.g. "PANIN123"
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One code per business owner
CREATE UNIQUE INDEX IF NOT EXISTS uq_business_codes_owner
  ON public.business_codes (business_owner_id);

-- Lookup by code (customer registration)
CREATE UNIQUE INDEX IF NOT EXISTS uq_business_codes_code
  ON public.business_codes (code);

-- Helper function: generate a random 8-char code (retry on collision handled by the caller)
CREATE OR REPLACE FUNCTION generate_business_code()
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';  -- no O/0, I/1 to avoid confusion
  code TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..8 LOOP
    code := code || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN code;
END;
$$;
```

### RLS Policies — `business_codes`

```sql
ALTER TABLE public.business_codes ENABLE ROW LEVEL SECURITY;

-- Business owner can read their own code
CREATE POLICY business_codes_select_own
  ON public.business_codes FOR SELECT
  USING (business_owner_id = auth.uid());

-- Customer registration (code lookup) goes through Edge Function (service_role)
-- The Edge Function validates the code exists and returns the business_owner_id

CREATE POLICY business_codes_no_direct_insert
  ON public.business_codes FOR INSERT
  WITH CHECK (FALSE);  -- inserted by the register-business Edge Function
```

---

## Storage Buckets

Run these in the Supabase Dashboard → Storage → New bucket, or via the Management API.

### Bucket: `customer-documents` (private)

```sql
-- Via Supabase Dashboard SQL (storage schema)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'customer-documents',
  'customer-documents',
  FALSE,                          -- PRIVATE — never public URLs
  10485760,                       -- 10 MB max per file
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;
```

**Storage RLS — `customer-documents`:**

```sql
-- Business owner can read documents for their own customers
CREATE POLICY storage_customer_docs_read
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'customer-documents'
    AND (
      -- The path format is: {business_owner_id}/{customer_id}/{filename}
      -- auth.uid() must match the first path segment
      (storage.foldername(name))[1] = auth.uid()::text
    )
  );

-- Uploads only via Edge Function (service_role bypasses this policy)
CREATE POLICY storage_customer_docs_no_direct_upload
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id != 'customer-documents');
```

### Bucket: `online-catalog-images` (public)

```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'online-catalog-images',
  'online-catalog-images',
  TRUE,                           -- PUBLIC — product images are not sensitive
  5242880,                        -- 5 MB max
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Business owner can upload to their own folder: {business_owner_id}/{filename}
CREATE POLICY storage_catalog_images_upload
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'online-catalog-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY storage_catalog_images_update
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'online-catalog-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY storage_catalog_images_delete
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'online-catalog-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
```

---

## Edge Function Stubs

> Deploy these via `supabase functions deploy <name>`.
> All functions use `SUPABASE_SERVICE_ROLE_KEY` — they bypass RLS.

### `generate-customer-qr`

**Purpose:** Atomically register a new customer + generate a one-time QR token.

```typescript
// supabase/functions/generate-customer-qr/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { crypto } from 'https://deno.land/std@0.168.0/crypto/mod.ts'
import * as bcrypt from 'https://deno.land/x/bcrypt@v0.4.1/mod.ts'

serve(async (req) => {
  const { businessCode, username, password, fullName, phoneNumber, email } = await req.json()

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // 1. Resolve business code → business_owner_id
  const { data: bizCode, error: bizErr } = await supabase
    .from('business_codes')
    .select('business_owner_id')
    .eq('code', businessCode.toUpperCase())
    .single()
  if (bizErr || !bizCode) {
    return new Response(JSON.stringify({ error: 'INVALID_BUSINESS_CODE' }), { status: 400 })
  }

  // 2. Hash password (bcrypt cost 12)
  const passwordHash = await bcrypt.hash(password, 12)

  // 3. Insert customer
  const { data: customer, error: custErr } = await supabase
    .from('customers')
    .insert({
      business_owner_id: bizCode.business_owner_id,
      username,
      password_hash: passwordHash,
      full_name: fullName,
      phone_number: phoneNumber,
      ...(email !== undefined ? { email } : {}),
      verification_status: 'UNVERIFIED',
      first_login_completed: false,
    })
    .select('id')
    .single()
  if (custErr) {
    if (custErr.code === '23505') {
      return new Response(JSON.stringify({ error: 'USERNAME_TAKEN' }), { status: 409 })
    }
    return new Response(JSON.stringify({ error: 'REGISTRATION_FAILED', detail: custErr.message }), { status: 500 })
  }

  // 4. Generate 64-char hex token (32 random bytes → hex)
  const tokenBytes = crypto.getRandomValues(new Uint8Array(32))
  const token = Array.from(tokenBytes).map(b => b.toString(16).padStart(2, '0')).join('')
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString() // 15 minutes

  // 5. Insert QR token
  const { error: tokenErr } = await supabase
    .from('customer_qr_tokens')
    .insert({
      customer_id: customer.id,
      token,
      expires_at: expiresAt,
    })
  if (tokenErr) {
    return new Response(JSON.stringify({ error: 'TOKEN_GENERATION_FAILED' }), { status: 500 })
  }

  return new Response(
    JSON.stringify({ customerId: customer.id, token, expiresAt }),
    { status: 201, headers: { 'Content-Type': 'application/json' } }
  )
})
```

---

### `consume-customer-qr`

**Purpose:** Validate a one-time QR token, mark it consumed, return customer data + session token.
Uses a PostgreSQL advisory lock to prevent concurrent double-scan.

```typescript
// supabase/functions/consume-customer-qr/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { crypto } from 'https://deno.land/std@0.168.0/crypto/mod.ts'

serve(async (req) => {
  const { token, deviceInfo } = await req.json()
  const clientIp = req.headers.get('x-forwarded-for') ?? 'unknown'

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Atomic: SELECT FOR UPDATE + mark consumed in a single RPC
  const { data, error } = await supabase.rpc('consume_qr_token', {
    p_token: token,
    p_ip: clientIp,
    p_device: deviceInfo ?? null,
  })

  if (error) {
    return new Response(JSON.stringify({ error: 'SERVER_ERROR', detail: error.message }), { status: 500 })
  }

  // consume_qr_token returns: { result: 'OK' | 'NOT_FOUND' | 'ALREADY_USED' | 'EXPIRED', customer_id: uuid | null }
  if (data.result !== 'OK') {
    const statusMap: Record<string, number> = {
      NOT_FOUND: 404, ALREADY_USED: 409, EXPIRED: 410,
    }
    return new Response(
      JSON.stringify({ error: data.result }),
      { status: statusMap[data.result] ?? 400 }
    )
  }

  // Mark first login complete on customer row
  await supabase
    .from('customers')
    .update({ first_login_completed: true, first_login_at: new Date().toISOString() })
    .eq('id', data.customer_id)

  // Generate session token
  const sessionBytes = crypto.getRandomValues(new Uint8Array(32))
  const sessionToken = Array.from(sessionBytes).map(b => b.toString(16).padStart(2, '0')).join('')
  const sessionExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days

  await supabase.from('customer_sessions').insert({
    customer_id: data.customer_id,
    session_token: sessionToken,
    login_method: 'QR_SCAN',
    ip_address: clientIp,
    device_info: deviceInfo ?? null,
    expires_at: sessionExpiry,
  })

  // Fetch customer profile to return to client
  const { data: customer } = await supabase
    .from('customers')
    .select('id, full_name, username, phone_number, email, verification_status, pay_later_enabled, profile_picture_url')
    .eq('id', data.customer_id)
    .single()

  return new Response(
    JSON.stringify({ customer, sessionToken, sessionExpiry }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  )
})
```

### `consume_qr_token` PostgreSQL Function (called by Edge Function via RPC)

```sql
-- Run in Supabase SQL Editor
CREATE OR REPLACE FUNCTION public.consume_qr_token(
  p_token  TEXT,
  p_ip     TEXT,
  p_device TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_token_row public.customer_qr_tokens%ROWTYPE;
BEGIN
  -- Lock the row to prevent concurrent double-scan
  SELECT * INTO v_token_row
    FROM public.customer_qr_tokens
   WHERE token = p_token
     FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('result', 'NOT_FOUND', 'customer_id', NULL);
  END IF;

  IF v_token_row.consumed_at IS NOT NULL THEN
    RETURN jsonb_build_object('result', 'ALREADY_USED', 'customer_id', NULL);
  END IF;

  IF v_token_row.expires_at < NOW() THEN
    RETURN jsonb_build_object('result', 'EXPIRED', 'customer_id', NULL);
  END IF;

  -- Mark as consumed
  UPDATE public.customer_qr_tokens
     SET consumed_at     = NOW(),
         consumed_ip     = p_ip,
         consumed_device = p_device
   WHERE id = v_token_row.id;

  RETURN jsonb_build_object('result', 'OK', 'customer_id', v_token_row.customer_id);
END;
$$;
```

---

### `authenticate-customer` (password login)

```typescript
// supabase/functions/authenticate-customer/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as bcrypt from 'https://deno.land/x/bcrypt@v0.4.1/mod.ts'
import { crypto } from 'https://deno.land/std@0.168.0/crypto/mod.ts'

serve(async (req) => {
  const { businessCode, username, password, deviceInfo } = await req.json()
  const clientIp = req.headers.get('x-forwarded-for') ?? 'unknown'

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Resolve business_owner_id from business code
  const { data: bizCode } = await supabase
    .from('business_codes')
    .select('business_owner_id')
    .eq('code', businessCode.toUpperCase())
    .single()
  if (!bizCode) {
    return new Response(JSON.stringify({ error: 'INVALID_CREDENTIALS' }), { status: 401 })
  }

  // Fetch customer — scope by business to prevent cross-business username collisions
  const { data: customer } = await supabase
    .from('customers')
    .select('id, password_hash, full_name, username, phone_number, email, verification_status, pay_later_enabled, profile_picture_url, first_login_completed')
    .eq('business_owner_id', bizCode.business_owner_id)
    .eq('username', username)
    .eq('status', 'ACTIVE')
    .is('deleted_at', null)
    .single()
  if (!customer) {
    // Return same error as wrong password — prevents username enumeration
    return new Response(JSON.stringify({ error: 'INVALID_CREDENTIALS' }), { status: 401 })
  }

  // Enforce QR first-login requirement
  if (!customer.first_login_completed) {
    return new Response(JSON.stringify({ error: 'QR_LOGIN_REQUIRED' }), { status: 403 })
  }

  const passwordMatch = await bcrypt.compare(password, customer.password_hash)
  if (!passwordMatch) {
    return new Response(JSON.stringify({ error: 'INVALID_CREDENTIALS' }), { status: 401 })
  }

  // Generate session token
  const sessionBytes = crypto.getRandomValues(new Uint8Array(32))
  const sessionToken = Array.from(sessionBytes).map(b => b.toString(16).padStart(2, '0')).join('')
  const sessionExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

  await supabase.from('customer_sessions').insert({
    customer_id: customer.id,
    session_token: sessionToken,
    login_method: 'PASSWORD',
    ip_address: clientIp,
    device_info: deviceInfo ?? null,
    expires_at: sessionExpiry,
  })

  const { password_hash: _removed, ...customerPublic } = customer
  return new Response(
    JSON.stringify({ customer: customerPublic, sessionToken, sessionExpiry }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  )
})
```

---

### `verify-customer-liveness` (stub)

```typescript
// supabase/functions/verify-customer-liveness/index.ts
// STUB — Replace with actual liveness provider integration
// Options: AWS Rekognition FaceLiveness, Azure Face API, Nyckel.com
// For MVP: client-side expo-face-detector is sufficient; this function stores the result.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const { customerId, livenessFrameCount } = await req.json()

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // MVP: trust the client's liveness result (expo-face-detector completed all poses)
  // Production: validate server-side with a liveness API before marking passed
  await supabase
    .from('customer_id_documents')
    .upsert({
      customer_id: customerId,
      liveness_passed: true,
      liveness_at: new Date().toISOString(),
      liveness_frames: livenessFrameCount,
    }, { onConflict: 'customer_id' })

  // Update customer verification_status to PENDING (ready for business owner review)
  await supabase
    .from('customers')
    .update({ verification_status: 'PENDING' })
    .eq('id', customerId)
    .eq('verification_status', 'UNVERIFIED')  // only upgrade from UNVERIFIED

  return new Response(JSON.stringify({ success: true }), { status: 200 })
})
```

---

### `place-online-order`

```typescript
// supabase/functions/place-online-order/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const { customerId, sessionToken, items, paymentMethod, customerNotes, vatEnabled } = await req.json()

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Validate session
  const { data: session } = await supabase
    .from('customer_sessions')
    .select('customer_id, expires_at')
    .eq('session_token', sessionToken)
    .is('invalidated_at', null)
    .single()
  if (!session || new Date(session.expires_at) < new Date()) {
    return new Response(JSON.stringify({ error: 'SESSION_EXPIRED' }), { status: 401 })
  }
  if (session.customer_id !== customerId) {
    return new Response(JSON.stringify({ error: 'UNAUTHORIZED' }), { status: 403 })
  }

  // Fetch customer
  const { data: customer } = await supabase
    .from('customers')
    .select('id, business_owner_id, verification_status, pay_later_enabled')
    .eq('id', customerId)
    .single()
  if (!customer) {
    return new Response(JSON.stringify({ error: 'CUSTOMER_NOT_FOUND' }), { status: 404 })
  }

  // Gate Pay Later
  if (paymentMethod === 'PAY_LATER') {
    if (customer.verification_status !== 'VERIFIED' || !customer.pay_later_enabled) {
      return new Response(JSON.stringify({ error: 'PAY_LATER_NOT_AUTHORIZED' }), { status: 403 })
    }
  }

  // Compute totals
  const subtotal: number = items.reduce((sum: number, item: { unit_price: number; quantity: number }) =>
    sum + item.unit_price * item.quantity, 0)
  const vatAmount = vatEnabled ? Math.round(subtotal * 0.12 * 100) / 100 : 0
  const totalAmount = subtotal + vatAmount

  // Generate order number
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const { count } = await supabase
    .from('online_orders')
    .select('*', { count: 'exact', head: true })
    .eq('business_owner_id', customer.business_owner_id)
  const orderNumber = `ORD-${today}-${String((count ?? 0) + 1).padStart(4, '0')}`

  // Insert order header
  const { data: order, error: orderErr } = await supabase
    .from('online_orders')
    .insert({
      business_owner_id: customer.business_owner_id,
      customer_id: customerId,
      order_number: orderNumber,
      payment_method: paymentMethod,
      subtotal,
      vat_amount: vatAmount,
      total_amount: totalAmount,
      ...(customerNotes !== undefined ? { customer_notes: customerNotes } : {}),
    })
    .select('id')
    .single()
  if (orderErr || !order) {
    return new Response(JSON.stringify({ error: 'ORDER_FAILED' }), { status: 500 })
  }

  // Insert line items
  const lineItems = items.map((item: {
    catalog_item_id: string; product_id: string; product_name: string;
    product_barcode?: string; unit_price: number; quantity: number
  }) => ({
    order_id: order.id,
    catalog_item_id: item.catalog_item_id,
    product_id: item.product_id,
    product_name: item.product_name,
    ...(item.product_barcode !== undefined ? { product_barcode: item.product_barcode } : {}),
    unit_price: item.unit_price,
    quantity: item.quantity,
  }))
  await supabase.from('online_order_items').insert(lineItems)

  return new Response(
    JSON.stringify({ orderId: order.id, orderNumber, totalAmount }),
    { status: 201, headers: { 'Content-Type': 'application/json' } }
  )
})
```

---

## Entity Relationship Overview

```
auth.users (Supabase Auth — business owners)
  │
  ├── business_codes (1:1 — each business owner has one code)
  │
  ├── customers (1:many — a business has many suki customers)
  │     ├── customer_qr_tokens (1:few — one per registration attempt)
  │     ├── customer_sessions (1:many — audit trail of every login)
  │     ├── customer_id_documents (1:1 — one verification record)
  │     ├── customer_verification_audit (1:many — every approve/reject action)
  │     └── online_orders (1:many — customer's order history)
  │                └── online_order_items (1:many — line items per order)
  │
  ├── online_catalog (1:many — business's curated product list)
  │     └── (references product_id from local SQLite — synced UUID)
  │
  └── credit_customers (existing — extended with customer_suki_id FK)
        └── credit_sales (existing — linked when Pay Later order placed)

SQLite (local, offline)
  └── products → stock_movements (reduced via ONLINE_ORDER movement type)
```

---

## One-Time QR Token Flow (Architecture Notes)

### Token Generation
1. Client calls `generate-customer-qr` Edge Function with registration data.
2. Edge Function hashes the password (bcrypt, cost 12), inserts the `customers` row, then generates 32 cryptographically random bytes (`crypto.getRandomValues`), hex-encodes them to a 64-char string.
3. Token is stored in `customer_qr_tokens` with `expires_at = NOW() + 15 minutes`.
4. Edge Function returns `{ token, expiresAt }` to the client.
5. Client renders `react-native-qrcode-svg` with `value={token}`.

### Token Consumption (First Login)
1. Client scans QR with `expo-camera` → extracts raw string.
2. Client calls `consume-customer-qr` Edge Function with `{ token, deviceInfo }`.
3. Edge Function calls the `consume_qr_token()` PostgreSQL function via RPC.
4. The PG function uses `SELECT ... FOR UPDATE` — this is a row-level lock that prevents two simultaneous scans from both succeeding (only one transaction can hold the lock; the second waits and then sees `consumed_at IS NOT NULL`).
5. If `consumed_at IS NOT NULL` → return `ALREADY_USED`. The token is dead permanently.
6. If `expires_at < NOW()` → return `EXPIRED`.
7. Otherwise: set `consumed_at = NOW()`, set `customer.first_login_completed = true`, create a `customer_sessions` row, return `{ customer, sessionToken }`.
8. Client stores `sessionToken` in `expo-secure-store` (AES-256 encrypted keychain).

### Replay Prevention
- **Database level:** `consumed_at IS NOT NULL` check is atomic and enforced by the row lock.
- **Expiry:** 15-minute window limits the attack surface — a QR screenshot is useless after 15 minutes.
- **No re-use:** once consumed, the token cannot be reset — a new registration generates a new token.
- **Rate limiting:** the `consume-customer-qr` Edge Function should rate-limit to 5 attempts per IP per minute (implement with a Redis counter or a DB-backed counter in a `rate_limit_log` table).

### Subsequent Logins (Password)
- After first QR login, `first_login_completed = TRUE`.
- `authenticate-customer` Edge Function rejects password attempts when `first_login_completed = FALSE` — forcing the QR first-login path.
- Password login returns a new `customer_sessions` row each time.
- The app stores the session token in `expo-secure-store`.

### Session Validation
- Every customer-facing Edge Function (place order, upload document, etc.) accepts `{ customerId, sessionToken }` in the request body.
- The function looks up the `customer_sessions` row, checks `expires_at > NOW()` and `invalidated_at IS NULL`.
- On logout: set `invalidated_at = NOW()` on the active session row.

---

## Open-Source Library Recommendations

### QR Code Generation (display)
- **Package:** `react-native-qrcode-svg`
- **Install:** `npx expo install react-native-qrcode-svg react-native-svg`
- **Expo SDK 54:** fully compatible — `react-native-svg` is an Expo-managed package
- **Usage:** `<QRCode value={token} size={240} color="#1E4D8C" backgroundColor="#FFFFFF" />`
- **Caveat:** requires `react-native-svg` as a peer dep; it is already in many Expo projects — check before installing twice.

### QR Code + Barcode Scanning (camera)
- **Package:** `expo-camera` (v15, ships with SDK 54)
- **Install:** `npx expo install expo-camera`
- **Expo SDK 54:** first-class support; the `CameraView` component (new API in v15) replaces the old `Camera` component and has built-in `onBarcodeScanned` prop.
- **Supported types via `barCodeTypes`:** `qr`, `ean13`, `ean8`, `code128`, `code39`, `upc_a`, `upc_e`, `pdf417`, `aztec`, `datamatrix`
- **Caveat:** Requires a development build (Expo Go does not support the camera barcode API in all configurations). Request `CAMERA` permission at runtime via `Camera.requestCameraPermissionsAsync()`.

### Philippine ID Card OCR
- **Package:** `@react-native-ml-kit/text-recognition`
- **Install:** `npm install @react-native-ml-kit/text-recognition`
- **Expo SDK 54:** compatible via expo-build-properties (configure android/ios build settings). Requires a development build (not compatible with Expo Go).
- **How it works:** On-device Google MLKit Text Recognition (no network call, free, offline). Pass a local image URI, get back a `Text` object with blocks/lines/elements.
- **Philippine ID parsing strategy:** The extracted text will contain name, birthdate, and PCN in known positions. Write a regex parser:
  - PCN: `/\b\d{4}-\d{7}-\d{5}\b/` (PhilSys format)
  - Birthdate: `/\b\d{2}\s+(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s+\d{4}\b/i` or `YYYY-MM-DD` format
  - Name: typically on lines 3-5 of the card
- **Caveat:** adds ~6 MB to binary. Android requires `minSdkVersion: 21` (set in `expo-build-properties`). iOS requires iOS 13+.
- **Alternative (server-side):** Google Cloud Vision API — more accurate, but costs money and requires network. Use as a fallback if on-device OCR confidence is low.

### Face Liveness Detection
- **Package:** `expo-face-detector` (built into Expo SDK 54) combined with `expo-camera`
- **Install:** `npx expo install expo-face-detector expo-camera`
- **Expo SDK 54:** `expo-face-detector` is a first-party Expo package that wraps Google MLKit FaceDetection (Android) and Apple Vision (iOS).
- **How it works:**
  - Enable `trackingEnabled: true`, `classifyFaces: true`, `detectLandmarks: 'all'` in `FaceDetector.detectFacesAsync()`.
  - Use `rollAngle` and `yawAngle` to detect head rotation (left/right).
  - Use `pitchAngle` (iOS) or infer from landmark positions (Android) for down tilt.
  - Use `leftEyeOpenProbability` and `rightEyeOpenProbability` (both > 0.7) for "eyes open" check at the selfie step.
- **Liveness sequence:** straight → yaw left (>25°) → yaw right (<-25°) → down tilt → selfie capture.
- **Caveat:** `expo-face-detector` is client-side only — it cannot detect deepfakes or photo spoofing. For higher assurance, integrate AWS Rekognition FaceLiveness or iProov at the server level (stub provided in Edge Function above). For SME MVP, client-side detection is a sufficient deterrent.
- **Alternative (server-side liveness):** `@aws-sdk/client-rekognition` + Amazon Rekognition FaceLiveness — ~$0.004/session, very accurate. Recommended for production if budget allows.

### Barcode Scanning for Products
- **Same package:** `expo-camera` (v15) — see QR scanner above.
- **No additional package needed.** Use the same `CameraView` component with `barCodeTypes: ['ean13', 'ean8', 'code128', 'code39', 'upc_a']`.
- **Reuse:** the existing `BarcodeScannerModal` molecule in `src/components/molecules/BarcodeScannerModal/` already wraps `expo-camera`. Extend it with an `onRawScan` prop that returns the raw string, so the online catalog screen can do its own lookup instead of the POS lookup.
