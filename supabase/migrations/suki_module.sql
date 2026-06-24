-- ============================================================================
-- SME Panindio — Suki (Loyal Customer) Module
-- Run this entire file in Supabase Dashboard → SQL Editor → New query.
-- All statements are idempotent — safe to run multiple times.
-- ============================================================================

-- Ensure the updated_at trigger function exists (may already be present).
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ============================================================================
-- Migration 025 — customers
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.customers (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_owner_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  username              TEXT NOT NULL,
  password_hash         TEXT NOT NULL,
  full_name             TEXT NOT NULL,
  phone_number          TEXT NOT NULL,
  email                 TEXT,
  profile_picture_url   TEXT,
  verification_status   TEXT NOT NULL DEFAULT 'UNVERIFIED',
  verified_at           TIMESTAMPTZ,
  verified_by           UUID REFERENCES auth.users(id),
  rejection_reason      TEXT,
  pay_later_enabled     BOOLEAN NOT NULL DEFAULT FALSE,
  first_login_completed BOOLEAN NOT NULL DEFAULT FALSE,
  first_login_at        TIMESTAMPTZ,
  status                TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by            UUID REFERENCES auth.users(id),
  updated_by            UUID REFERENCES auth.users(id),
  deleted_at            TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_customers_username_per_business
  ON public.customers (business_owner_id, username) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customers_business_owner
  ON public.customers (business_owner_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customers_verification_status
  ON public.customers (business_owner_id, verification_status) WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_customers_updated_at ON public.customers;
CREATE TRIGGER trg_customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE public.customers
  DROP CONSTRAINT IF EXISTS chk_customers_verification_status;
ALTER TABLE public.customers
  ADD CONSTRAINT chk_customers_verification_status
  CHECK (verification_status IN ('UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED'));

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS customers_select_own ON public.customers;
CREATE POLICY customers_select_own ON public.customers FOR SELECT
  USING (business_owner_id = auth.uid());

DROP POLICY IF EXISTS customers_insert_own ON public.customers;
CREATE POLICY customers_insert_own ON public.customers FOR INSERT
  WITH CHECK (business_owner_id = auth.uid());

DROP POLICY IF EXISTS customers_update_own ON public.customers;
CREATE POLICY customers_update_own ON public.customers FOR UPDATE
  USING (business_owner_id = auth.uid())
  WITH CHECK (business_owner_id = auth.uid());

-- ============================================================================
-- Migration 026 — customer_qr_tokens
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.customer_qr_tokens (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id     UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  token           TEXT NOT NULL UNIQUE,
  expires_at      TIMESTAMPTZ NOT NULL,
  consumed_at     TIMESTAMPTZ,
  consumed_ip     TEXT,
  consumed_device TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      UUID REFERENCES auth.users(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_customer_qr_tokens_token
  ON public.customer_qr_tokens (token);
CREATE INDEX IF NOT EXISTS idx_customer_qr_tokens_customer
  ON public.customer_qr_tokens (customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_qr_tokens_active
  ON public.customer_qr_tokens (customer_id, consumed_at, expires_at);

ALTER TABLE public.customer_qr_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS qr_tokens_select_own_customers ON public.customer_qr_tokens;
CREATE POLICY qr_tokens_select_own_customers ON public.customer_qr_tokens FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = customer_qr_tokens.customer_id
        AND c.business_owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS qr_tokens_no_direct_write ON public.customer_qr_tokens;
CREATE POLICY qr_tokens_no_direct_write ON public.customer_qr_tokens FOR INSERT
  WITH CHECK (FALSE);

DROP POLICY IF EXISTS qr_tokens_no_direct_update ON public.customer_qr_tokens;
CREATE POLICY qr_tokens_no_direct_update ON public.customer_qr_tokens FOR UPDATE
  USING (FALSE);

-- ============================================================================
-- Migration 027 — customer_sessions
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.customer_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id     UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  session_token   TEXT NOT NULL UNIQUE,
  login_method    TEXT NOT NULL,
  ip_address      TEXT,
  device_info     TEXT,
  expires_at      TIMESTAMPTZ NOT NULL,
  invalidated_at  TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_customer_sessions_token
  ON public.customer_sessions (session_token);
CREATE INDEX IF NOT EXISTS idx_customer_sessions_customer
  ON public.customer_sessions (customer_id, created_at DESC);

ALTER TABLE public.customer_sessions
  DROP CONSTRAINT IF EXISTS chk_customer_sessions_login_method;
ALTER TABLE public.customer_sessions
  ADD CONSTRAINT chk_customer_sessions_login_method
  CHECK (login_method IN ('QR_SCAN', 'PASSWORD'));

ALTER TABLE public.customer_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sessions_select_own_customers ON public.customer_sessions;
CREATE POLICY sessions_select_own_customers ON public.customer_sessions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = customer_sessions.customer_id
        AND c.business_owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS sessions_no_direct_write ON public.customer_sessions;
CREATE POLICY sessions_no_direct_write ON public.customer_sessions FOR INSERT
  WITH CHECK (FALSE);

-- ============================================================================
-- Migration 029 — online_catalog
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.online_catalog (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id        UUID NOT NULL,
  product_name      TEXT NOT NULL,
  product_barcode   TEXT,
  product_image_url TEXT,
  custom_price      NUMERIC(12, 2),
  is_available      BOOLEAN NOT NULL DEFAULT TRUE,
  display_order     INTEGER NOT NULL DEFAULT 0,
  status            TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by        UUID REFERENCES auth.users(id),
  updated_by        UUID REFERENCES auth.users(id),
  deleted_at        TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_online_catalog_product_per_business
  ON public.online_catalog (business_owner_id, product_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_online_catalog_browse
  ON public.online_catalog (business_owner_id, is_available, display_order) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_online_catalog_barcode
  ON public.online_catalog (business_owner_id, product_barcode)
  WHERE product_barcode IS NOT NULL AND deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_online_catalog_updated_at ON public.online_catalog;
CREATE TRIGGER trg_online_catalog_updated_at
  BEFORE UPDATE ON public.online_catalog
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE public.online_catalog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS catalog_all_own ON public.online_catalog;
CREATE POLICY catalog_all_own ON public.online_catalog FOR ALL
  USING (business_owner_id = auth.uid())
  WITH CHECK (business_owner_id = auth.uid());

-- ============================================================================
-- Migration 032 — business_codes
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.business_codes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code              TEXT NOT NULL UNIQUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_business_codes_owner
  ON public.business_codes (business_owner_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_business_codes_code
  ON public.business_codes (code);

CREATE OR REPLACE FUNCTION generate_business_code()
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code  TEXT := '';
  i     INTEGER;
BEGIN
  FOR i IN 1..8 LOOP
    code := code || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN code;
END;
$$;

ALTER TABLE public.business_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS business_codes_select_own ON public.business_codes;
CREATE POLICY business_codes_select_own ON public.business_codes FOR SELECT
  USING (business_owner_id = auth.uid());

DROP POLICY IF EXISTS business_codes_no_direct_insert ON public.business_codes;
CREATE POLICY business_codes_no_direct_insert ON public.business_codes FOR INSERT
  WITH CHECK (FALSE);

-- ============================================================================
-- Migration 032b — businesses_public view
-- Lets customers search for a business by name during registration.
-- ============================================================================
CREATE OR REPLACE VIEW public.businesses_public AS
SELECT
  u.id                       AS business_id,
  COALESCE(bc.code, '')      AS business_code,
  b.name                     AS business_name
FROM public.businesses b
JOIN public.users u   ON u.business_id       = b.id
LEFT JOIN public.business_codes bc ON bc.business_owner_id = u.id;

GRANT SELECT ON public.businesses_public TO anon;

-- ============================================================================
-- consume_qr_token PostgreSQL function (called by consume-customer-qr Edge Fn)
-- ============================================================================
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

  UPDATE public.customer_qr_tokens
     SET consumed_at     = NOW(),
         consumed_ip     = p_ip,
         consumed_device = p_device
   WHERE id = v_token_row.id;

  RETURN jsonb_build_object('result', 'OK', 'customer_id', v_token_row.customer_id);
END;
$$;

