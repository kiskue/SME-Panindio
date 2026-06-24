-- =============================================================================
-- SUKI MODULE — Supabase Schema
-- =============================================================================
-- Purpose : Loyal-customer (Suki) management for the SME Panindio ERP.
-- Audience : Backend/infra engineer applying migrations on the Supabase project.
--
-- What is Suki?
--   "Suki" (Filipino: loyal customer) lets a business owner register and manage
--   repeat customers, offer Pay Later (credit) purchasing, and publish an online
--   catalog for ordering.
--
-- Authentication model:
--   Customers are NOT Supabase Auth users (auth.users).
--   They use an app-level session token (see customer_sessions).
--   Password hashing (bcrypt cost 12) is handled by Edge Functions.
--   Login method: username + password ONLY (no QR login).
--
-- Apply order (each migration is idempotent via IF NOT EXISTS):
--   1. Extensions            (uuid-ossp — shared with main schema)
--   2. Customers             (025)
--   3. Customer Sessions     (027)
--   4. Business Codes        (032)
--   5. Businesses Public     (032b view)
--   6. Online Catalog        (029)
--   7. Online Orders         (030)
--   8. Online Order Items    (031)
--   9. RLS Policies          (after all tables exist)
--   10. Storage Buckets      (manual in Supabase dashboard or via CLI)
--
-- Conventions:
--   - All PKs are UUID (gen_random_uuid())
--   - Soft deletes via deleted_at TIMESTAMPTZ NULL
--   - Audit columns: created_at, updated_at (auto via trigger), created_by
--   - snake_case for all column names
--   - status column = TEXT with CHECK constraint (not an enum — easier to migrate)
-- =============================================================================


-- =============================================================================
-- SECTION 1 — EXTENSIONS
-- =============================================================================
-- Note: uuid-ossp is already enabled in the main schema.sql.
-- Included here for completeness if applying this file to a fresh database.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- =============================================================================
-- SECTION 2 — HELPER: auto-update updated_at
-- =============================================================================
-- Shared trigger function. Skip if already created by main schema.sql.
-- =============================================================================

CREATE OR REPLACE FUNCTION handle_updated_at_suki()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


-- =============================================================================
-- SECTION 3 — CUSTOMERS TABLE  (Migration 025)
-- =============================================================================
-- Core customer profile for a business.
--
-- Key design decisions:
--   - business_owner_id links to auth.users (the business owner's Supabase UID).
--   - username is scoped PER BUSINESS (unique within a business, not globally).
--   - password_hash stores bcrypt output — never the raw password.
--   - verification_status tracks ID/liveness verification for Pay Later gating.
--   - pay_later_enabled is only meaningful when verification_status = 'VERIFIED'.
--   - first_login_completed is set true on the customer's first successful login.
--   - status = 'ACTIVE' | 'SUSPENDED' (soft-suspend without deleting the row).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.customers (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  business_owner_id     UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Credentials (stored securely)
  username              TEXT          NOT NULL,
  password_hash         TEXT          NOT NULL,

  -- Profile
  full_name             TEXT          NOT NULL,
  phone_number          TEXT          NOT NULL,
  email                 TEXT,
  profile_picture_url   TEXT,

  -- Verification for Pay Later gating
  -- UNVERIFIED → PENDING (ID submitted) → VERIFIED | REJECTED
  verification_status   TEXT          NOT NULL DEFAULT 'UNVERIFIED'
                          CHECK (verification_status IN ('UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED')),
  verified_at           TIMESTAMPTZ,
  rejection_reason      TEXT,

  -- Pay Later (credit purchasing)
  pay_later_enabled     BOOLEAN       NOT NULL DEFAULT FALSE,

  -- Login tracking
  first_login_completed BOOLEAN       NOT NULL DEFAULT FALSE,
  first_login_at        TIMESTAMPTZ,

  -- Soft delete + status
  status                TEXT          NOT NULL DEFAULT 'ACTIVE'
                          CHECK (status IN ('ACTIVE', 'SUSPENDED')),
  deleted_at            TIMESTAMPTZ,

  -- Audit
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  created_by            UUID          REFERENCES auth.users(id)
);

-- Username must be unique within a business (not globally).
-- Partial index excludes soft-deleted rows.
CREATE UNIQUE INDEX IF NOT EXISTS customers_username_business_uidx
  ON public.customers (business_owner_id, username)
  WHERE deleted_at IS NULL;

-- Fast lookup: all customers for a business (used in the customer list screen).
CREATE INDEX IF NOT EXISTS customers_business_owner_idx
  ON public.customers (business_owner_id)
  WHERE deleted_at IS NULL AND status = 'ACTIVE';

-- Auto-update updated_at
CREATE TRIGGER customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at_suki();


-- =============================================================================
-- SECTION 4 — CUSTOMER SESSIONS TABLE  (Migration 027)
-- =============================================================================
-- Audit log of every customer login. Used to validate session tokens on each
-- Edge Function call and to invalidate sessions on logout.
--
-- Key design decisions:
--   - session_token is a 64-char cryptographically random hex string (32 bytes).
--     Generated server-side in the authenticate-customer Edge Function.
--   - Sessions expire after 30 days (enforced by expires_at check in Edge Functions).
--   - Logout sets invalidated_at to NOW(); subsequent calls are rejected.
--   - device_info is optional — stored for debugging, not for auth.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.customer_sessions (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id     UUID          NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,

  -- The opaque session token stored on the device (expo-secure-store).
  session_token   TEXT          NOT NULL UNIQUE,

  -- Session window
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ   NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  invalidated_at  TIMESTAMPTZ,               -- NULL means the session is still live

  -- Optional device metadata for debugging
  device_info     TEXT
);

-- Fast lookup to validate a token on each Edge Function call.
CREATE INDEX IF NOT EXISTS customer_sessions_token_idx
  ON public.customer_sessions (session_token)
  WHERE invalidated_at IS NULL;

-- Fast lookup to find all active sessions for a customer (useful for logout-all).
CREATE INDEX IF NOT EXISTS customer_sessions_customer_idx
  ON public.customer_sessions (customer_id)
  WHERE invalidated_at IS NULL;

-- TODO: Add a scheduled job (pg_cron or Supabase Cron) to delete rows older
--       than 90 days to prevent this table from growing unbounded.


-- =============================================================================
-- SECTION 5 — BUSINESS CODES TABLE  (Migration 032)
-- =============================================================================
-- Each business owner gets one unique 8-character alphanumeric code.
-- Used by the `businesses_public` view so customers can identify a business
-- without exposing the internal UUID.
--
-- Generated automatically when a business is created (via the
-- register_business_owner RPC in schema.sql).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.business_codes (
  id               UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  business_owner_id UUID   NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 8-char alphanumeric, excluding confusable chars (O, 0, I, 1).
  code             TEXT    NOT NULL UNIQUE
                     CHECK (code ~ '^[A-HJ-NP-Z2-9]{8}$'),

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- No trigger needed — business_codes rows are insert-only (codes never change).


-- =============================================================================
-- SECTION 6 — BUSINESSES PUBLIC VIEW  (Migration 032b)
-- =============================================================================
-- Read-only, anon-accessible view for customer-side business search.
-- Exposes only: business_id UUID, business_code TEXT, business_name TEXT.
--
-- The `businesses` table is defined in schema.sql (business owner auth schema).
-- This view joins it with business_codes to surface the display code.
--
-- Used by:
--   - The business search screen (customer self-registration flow)
--   - The `authenticate-customer` Edge Function (to resolve business_owner_id
--     from a business_code when the customer logs in)
-- =============================================================================

CREATE OR REPLACE VIEW public.businesses_public AS
SELECT
  b.owner_id         AS business_id,
  b.name             AS business_name,
  bc.code            AS business_code
FROM public.businesses b
JOIN public.business_codes bc ON bc.business_owner_id = b.owner_id
WHERE b.owner_id IS NOT NULL;

-- Grant anon SELECT so customers can search without being authenticated.
GRANT SELECT ON public.businesses_public TO anon;
GRANT SELECT ON public.businesses_public TO authenticated;


-- =============================================================================
-- SECTION 7 — ONLINE CATALOG TABLE  (Migration 029)
-- =============================================================================
-- Products a business has enabled for online ordering by their Suki customers.
--
-- Key design decisions:
--   - product_id links to the local SQLite inventory_items by SKU or UUID.
--     It is stored as TEXT (not a FK to Supabase) because inventory lives offline.
--   - custom_price overrides the standard price for this business's catalog.
--     NULL means use the product's default price.
--   - display_order allows the business owner to sort their catalog.
--   - Soft delete via deleted_at — preserves historical order line items.
--   - Unique partial index prevents duplicate active entries per business+product.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.online_catalog (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  business_owner_id UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Product reference (mirrors inventory_items in local SQLite)
  product_id        TEXT          NOT NULL,
  product_name      TEXT          NOT NULL,
  product_barcode   TEXT,
  product_image_url TEXT,

  -- Pricing (NULL = use inventory default price)
  custom_price      NUMERIC(12,2) CHECK (custom_price > 0),

  -- Visibility
  is_available      BOOLEAN       NOT NULL DEFAULT TRUE,
  display_order     INTEGER       NOT NULL DEFAULT 0,

  -- Soft delete + audit
  deleted_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- One active catalog row per business+product (allows multiple soft-deleted rows).
CREATE UNIQUE INDEX IF NOT EXISTS online_catalog_business_product_uidx
  ON public.online_catalog (business_owner_id, product_id)
  WHERE deleted_at IS NULL;

-- Fast lookup for loadCatalog (available items only).
CREATE INDEX IF NOT EXISTS online_catalog_business_available_idx
  ON public.online_catalog (business_owner_id, display_order)
  WHERE deleted_at IS NULL AND is_available = TRUE;

CREATE TRIGGER online_catalog_updated_at
  BEFORE UPDATE ON public.online_catalog
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at_suki();

-- TODO: Add a product_snapshot JSONB column to snapshot price/name at time of order
--       so historical order data stays accurate when catalog prices change.


-- =============================================================================
-- SECTION 8 — ONLINE ORDERS TABLE  (Migration 030)
-- =============================================================================
-- Order headers created when a Suki customer places an online order.
--
-- Status lifecycle:
--   PENDING → CONFIRMED → PREPARING → READY → COMPLETED
--           ↘ CANCELLED (from any non-terminal state)
--
-- Payment methods:
--   CASH     — pay on pickup/delivery
--   PAY_LATER — credit (requires pay_later_enabled = true and verification)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.online_orders (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number      TEXT          NOT NULL UNIQUE,  -- human-readable, e.g. "ORD-20240601-001"
  customer_id       UUID          NOT NULL REFERENCES public.customers(id),
  business_owner_id UUID          NOT NULL REFERENCES auth.users(id),

  -- Totals (snapshotted at time of order; not recomputed from items)
  subtotal          NUMERIC(12,2) NOT NULL CHECK (subtotal >= 0),
  vat_amount        NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (vat_amount >= 0),
  total_amount      NUMERIC(12,2) NOT NULL CHECK (total_amount >= 0),

  -- Payment
  payment_method    TEXT          NOT NULL DEFAULT 'CASH'
                      CHECK (payment_method IN ('CASH', 'PAY_LATER')),

  -- Status
  status            TEXT          NOT NULL DEFAULT 'PENDING'
                      CHECK (status IN ('PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED')),

  -- Notes from the customer
  notes             TEXT,

  -- Audit
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Fast lookup for the order history screen (customer's own orders).
CREATE INDEX IF NOT EXISTS online_orders_customer_idx
  ON public.online_orders (customer_id, created_at DESC);

-- Fast lookup for the business owner's order dashboard.
CREATE INDEX IF NOT EXISTS online_orders_business_status_idx
  ON public.online_orders (business_owner_id, status, created_at DESC);

CREATE TRIGGER online_orders_updated_at
  BEFORE UPDATE ON public.online_orders
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at_suki();

-- TODO: Add a cancelled_at column so cancellation timestamps can be reported separately.
-- TODO: Add a completed_at column to track fulfillment time for analytics.


-- =============================================================================
-- SECTION 9 — ONLINE ORDER ITEMS TABLE  (Migration 031)
-- =============================================================================
-- Line items for each online order. Prices are snapshotted at order time
-- so historical order data remains accurate if catalog prices change later.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.online_order_items (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID          NOT NULL REFERENCES public.online_orders(id) ON DELETE CASCADE,

  -- Product snapshot (copied from online_catalog at time of order)
  product_id      TEXT          NOT NULL,
  product_name    TEXT          NOT NULL,
  product_barcode TEXT,

  -- Quantity and price at time of order
  quantity        INTEGER       NOT NULL CHECK (quantity > 0),
  unit_price      NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0),
  line_total      NUMERIC(12,2) NOT NULL CHECK (line_total >= 0),  -- quantity * unit_price

  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Fast lookup for loading a single order's items.
CREATE INDEX IF NOT EXISTS online_order_items_order_idx
  ON public.online_order_items (order_id);


-- =============================================================================
-- SECTION 10 — ROW LEVEL SECURITY (RLS)
-- =============================================================================
-- Enable RLS on all Suki tables. Policies use auth.uid() for business owners
-- and customer_id (validated via session token) for customers.
--
-- IMPORTANT: Customer operations (login, place order) go through Edge Functions
-- with service_role key — they bypass RLS. The policies below cover direct
-- Supabase client access from the business owner app.
-- =============================================================================

ALTER TABLE public.customers           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_sessions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.online_catalog      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.online_orders       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.online_order_items  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_codes      ENABLE ROW LEVEL SECURITY;

-- ── customers ──────────────────────────────────────────────────────────────

-- Business owner can read, insert, and update their own customers.
CREATE POLICY IF NOT EXISTS "business_owner_select_customers"
  ON public.customers FOR SELECT
  TO authenticated
  USING (business_owner_id = auth.uid());

CREATE POLICY IF NOT EXISTS "business_owner_insert_customers"
  ON public.customers FOR INSERT
  TO authenticated
  WITH CHECK (business_owner_id = auth.uid());

CREATE POLICY IF NOT EXISTS "business_owner_update_customers"
  ON public.customers FOR UPDATE
  TO authenticated
  USING (business_owner_id = auth.uid());

-- Customers (app-level users) cannot access this table directly;
-- all their DB access goes through Edge Functions with service_role.

-- ── customer_sessions ──────────────────────────────────────────────────────

-- Only Edge Functions (service_role) write to this table.
-- Business owner can read sessions for their customers (for audit/support).
CREATE POLICY IF NOT EXISTS "business_owner_select_sessions"
  ON public.customer_sessions FOR SELECT
  TO authenticated
  USING (
    customer_id IN (
      SELECT id FROM public.customers WHERE business_owner_id = auth.uid()
    )
  );

-- ── online_catalog ─────────────────────────────────────────────────────────

-- Business owner manages their own catalog.
CREATE POLICY IF NOT EXISTS "business_owner_manage_catalog"
  ON public.online_catalog FOR ALL
  TO authenticated
  USING (business_owner_id = auth.uid())
  WITH CHECK (business_owner_id = auth.uid());

-- Authenticated customers can read the catalog (via client SDK, not Edge Function).
-- TODO: Narrow this to only verified customers once the mobile customer app is built.
CREATE POLICY IF NOT EXISTS "customer_read_catalog"
  ON public.online_catalog FOR SELECT
  TO authenticated
  USING (is_available = TRUE AND deleted_at IS NULL);

-- ── online_orders ──────────────────────────────────────────────────────────

-- Business owner can read and update orders for their business.
CREATE POLICY IF NOT EXISTS "business_owner_manage_orders"
  ON public.online_orders FOR ALL
  TO authenticated
  USING (business_owner_id = auth.uid())
  WITH CHECK (business_owner_id = auth.uid());

-- ── online_order_items ─────────────────────────────────────────────────────

-- Business owner can read line items for their orders.
CREATE POLICY IF NOT EXISTS "business_owner_read_order_items"
  ON public.online_order_items FOR SELECT
  TO authenticated
  USING (
    order_id IN (
      SELECT id FROM public.online_orders WHERE business_owner_id = auth.uid()
    )
  );

-- ── business_codes ─────────────────────────────────────────────────────────

-- Business owners can read their own code.
CREATE POLICY IF NOT EXISTS "business_owner_read_own_code"
  ON public.business_codes FOR SELECT
  TO authenticated
  USING (business_owner_id = auth.uid());


-- =============================================================================
-- SECTION 11 — EDGE FUNCTIONS (Reference)
-- =============================================================================
-- These are Deno/TypeScript functions deployed to Supabase Edge Functions.
-- They are NOT defined in SQL — listed here for documentation and discoverability.
--
-- authenticate-customer
--   POST { username, password }
--   → looks up customer by business_code + username
--   → bcrypt.compare(password, password_hash)
--   → inserts customer_sessions row
--   → returns { customer: Customer, sessionToken: string }
--
-- register-customer          ← REPLACES legacy generate-customer-qr
--   POST { businessOwnerId, username, password, fullName, phoneNumber, email? }
--   → hashes password with bcrypt cost 12
--   → inserts customers row
--   → returns { customerId: string }
--   NOTE: Does NOT generate a QR token. Customers log in via password only.
--
-- update-customer-credentials
--   POST { customerId, sessionToken, username, password }
--   → validates sessionToken against customer_sessions
--   → hashes new password
--   → updates customers row
--   → returns { success: true }
--
-- place-online-order
--   POST { customerId, sessionToken, items: [{productId, quantity}], paymentMethod }
--   → validates session + verification status for PAY_LATER
--   → inserts online_orders + online_order_items rows
--   → returns { orderId, orderNumber, totalAmount }
--
-- TODO: Deploy authenticate-customer Edge Function (Deno/TypeScript).
-- TODO: Create register-customer Edge Function (stripped from generate-customer-qr).
-- TODO: Deploy update-customer-credentials Edge Function.
-- TODO: Deploy place-online-order Edge Function.
-- =============================================================================


-- =============================================================================
-- SECTION 12 — STORAGE BUCKETS
-- =============================================================================
-- Apply via the Supabase dashboard (Storage → New bucket) or via the CLI:
--   supabase storage create customer-documents --no-public --file-size-limit 10MB
--   supabase storage create online-catalog-images --public --file-size-limit 5MB
--
-- customer-documents  (PRIVATE, 10 MB max)
--   → Stores customer ID photos and selfies for verification.
--   → Access via Edge Functions only (service_role signed URLs).
--   → Path pattern: {businessOwnerId}/{customerId}/{document_type}.jpg
--
-- online-catalog-images  (PUBLIC, 5 MB max)
--   → Product images for the online catalog (served as CDN URLs).
--   → Path pattern: {businessOwnerId}/{productId}.jpg
--
-- TODO: Add RLS policies on the storage buckets via the Supabase dashboard.
-- TODO: Add image compression/resizing via an Edge Function before upload.
-- =============================================================================
