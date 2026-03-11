-- ============================================================================
-- SME Panindio — Supabase Schema
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query).
--
-- Table creation order respects foreign key dependencies:
--   1. business_types  (lookup, no deps)
--   2. job_roles       (lookup, no deps)
--   3. businesses      (depends on business_types)
--   4. users           (depends on businesses, job_roles, auth.users)
-- ============================================================================

-- ── Extensions ───────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- LOOKUP TABLE: public.business_types
-- Seeded once; never mutated by application code.
-- pos_enabled = true means the business type can access the POS module.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.business_types (
  id          SERIAL      PRIMARY KEY,
  name        TEXT        NOT NULL UNIQUE,
  -- kebab-case machine identifier, e.g. 'sari-sari-store'
  slug        TEXT        NOT NULL UNIQUE,
  description TEXT,
  -- Grouping: 'food_beverage' | 'retail' | 'services' | 'digital' | 'other'
  category    TEXT        NOT NULL,
  -- Whether this business type may use the POS module
  pos_enabled BOOLEAN     NOT NULL DEFAULT false,
  sort_order  INTEGER     NOT NULL DEFAULT 0,
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed business types
INSERT INTO public.business_types (name, slug, description, category, pos_enabled, sort_order) VALUES
  ('Sari-Sari Store',            'sari-sari-store',        'A neighbourhood convenience store selling everyday goods', 'retail',       true,  1),
  ('Grocery Store',              'grocery-store',           'A store selling fresh and packaged food items',           'retail',       true,  2),
  ('Food Cart',                  'food-cart',               'A mobile or stall-based food vending unit',               'food_beverage', true,  3),
  ('Food Stall',                 'food-stall',              'A fixed stall selling prepared food',                     'food_beverage', true,  4),
  ('Restaurant / Eatery',        'restaurant-eatery',       'A dine-in establishment serving food and beverages',      'food_beverage', true,  5),
  ('Bakery',                     'bakery',                  'A shop producing and selling baked goods',                'food_beverage', true,  6),
  ('Pharmacy / Drugstore',       'pharmacy-drugstore',      'A retail outlet selling medicines and health products',   'retail',       true,  7),
  ('Hardware Store',             'hardware-store',          'A store selling construction and home improvement goods', 'retail',       true,  8),
  ('Clothing / Apparel',         'clothing-apparel',        'A boutique or shop selling garments and accessories',     'retail',       true,  9),
  ('Beauty Salon / Barbershop',  'beauty-salon-barbershop', 'A personal grooming and styling service business',        'services',     false, 10),
  ('Laundry Shop',               'laundry-shop',            'A self-service or full-service laundry business',         'services',     false, 11),
  ('Computer Shop / Internet Cafe', 'computer-shop-internet-cafe', 'A shop selling computer peripherals or offering internet access', 'retail', true, 12),
  ('Printing Shop',              'printing-shop',           'A shop providing printing and reproduction services',     'services',     false, 13),
  ('Repair Shop',                'repair-shop',             'A shop offering repair services for appliances or devices', 'services',   false, 14),
  ('Water Refilling Station',    'water-refilling-station', 'A business selling purified drinking water',              'retail',       true,  15),
  ('Carwash',                    'carwash',                 'A vehicle cleaning and detailing service',                'services',     false, 16),
  ('Convenience Store',          'convenience-store',       'A small store open long hours selling everyday items',    'retail',       true,  17),
  ('Ukay-Ukay',                  'ukay-ukay',               'A store selling second-hand clothing',                    'retail',       true,  18),
  ('Catering Services',          'catering-services',       'A business providing food for events and gatherings',     'food_beverage', false, 19),
  ('Online Seller',              'online-seller',           'A business selling goods via online marketplaces',        'digital',      false, 20),
  ('Others',                     'others',                  'Other types of business not listed above',                'other',        false, 21)
ON CONFLICT (slug) DO NOTHING;

-- ── RLS for business_types ────────────────────────────────────────────────────

ALTER TABLE public.business_types ENABLE ROW LEVEL SECURITY;

-- Public read-only: anon users need this during registration (before login).
-- No sensitive data is exposed — this is seed/lookup data only.
CREATE POLICY "business_types: select public"
  ON public.business_types
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- ============================================================================
-- LOOKUP TABLE: public.job_roles
-- Describes the user's position within their business.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.job_roles (
  id          SERIAL      PRIMARY KEY,
  name        TEXT        NOT NULL UNIQUE,
  -- kebab-case machine identifier, e.g. 'ceo-owner'
  slug        TEXT        NOT NULL UNIQUE,
  description TEXT,
  sort_order  INTEGER     NOT NULL DEFAULT 0,
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed job roles
INSERT INTO public.job_roles (name, slug, description, sort_order) VALUES
  ('CEO / Owner',            'ceo-owner',           'The business owner or chief executive officer',                     1),
  ('General Manager',        'general-manager',     'Oversees day-to-day operations of the entire business',            2),
  ('Store Manager',          'store-manager',       'Manages a single store or outlet',                                  3),
  ('Cashier',                'cashier',             'Handles cash and payment transactions at point of sale',            4),
  ('Sales Associate',        'sales-associate',     'Assists customers and processes sales (Sales Lady / Boy)',          5),
  ('Inventory Manager',      'inventory-manager',   'Manages stock levels, receiving, and inventory records',            6),
  ('Purchasing Officer',     'purchasing-officer',  'Handles procurement and supplier relationships',                    7),
  ('Accountant / Bookkeeper','accountant',          'Manages financial records, accounts, and bookkeeping',              8),
  ('Delivery Personnel',     'delivery-personnel',  'Handles delivery and logistics of goods',                           9),
  ('Kitchen Staff',          'kitchen-staff',       'Prepares food in a restaurant, eatery, or food stall',             10),
  ('Security Guard',         'security-guard',      'Provides security and access control for the business premises',   11),
  ('Others',                 'others',              'Other roles not listed above',                                      12)
ON CONFLICT (slug) DO NOTHING;

-- ── RLS for job_roles ─────────────────────────────────────────────────────────

ALTER TABLE public.job_roles ENABLE ROW LEVEL SECURITY;

-- Public read-only: anon users need this during registration (before login).
CREATE POLICY "job_roles: select public"
  ON public.job_roles
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- ============================================================================
-- TABLE: public.businesses
-- Represents the actual business entity registered by the owner.
-- owner_id is nullable to avoid a circular dependency: the user row must exist
-- before we can set owner_id, but the user row references business_id.
-- The register_business_owner RPC sets both atomically.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.businesses (
  id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name             TEXT        NOT NULL,
  business_type_id INTEGER     NOT NULL REFERENCES public.business_types (id),
  -- 'small' = 1–9 employees, 'medium' = 10–99 employees (MSME definition)
  enterprise_type  TEXT        NOT NULL DEFAULT 'small'
                     CHECK (enterprise_type IN ('small', 'medium')),
  -- Set after the user profile row is created (see register_business_owner RPC).
  -- Nullable intentionally — avoids circular foreign key dependency.
  owner_id         UUID,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── RLS for businesses ────────────────────────────────────────────────────────

ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;

-- Only the business owner may read their own business record.
CREATE POLICY "businesses: select own"
  ON public.businesses
  FOR SELECT
  USING (owner_id = auth.uid());

-- Only the business owner may update their own business record.
CREATE POLICY "businesses: update own"
  ON public.businesses
  FOR UPDATE
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- The register_business_owner RPC uses SECURITY DEFINER so it bypasses RLS
-- when creating the initial business row on behalf of the new user.

-- ── Auto-update updated_at on businesses ─────────────────────────────────────

-- Reusable trigger function for updated_at columns.
-- Uses the column name 'updated_at' (snake_case — new tables).
CREATE OR REPLACE FUNCTION public.handle_updated_at_snake()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER businesses_updated_at
  BEFORE UPDATE ON public.businesses
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at_snake();

-- ============================================================================
-- TABLE: public.users
-- Stores the application profile for every authenticated user.
-- Linked 1-to-1 with auth.users via the id column.
--
-- Column naming: existing quoted camelCase columns are preserved for backwards
-- compatibility. New columns use unquoted snake_case (PostgreSQL standard).
--
-- Passwords are hashed by Supabase Auth (bcrypt). Never store passwords in public.users.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.users (
  id          UUID        PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email       TEXT        NOT NULL UNIQUE,
  "firstName" TEXT        NOT NULL DEFAULT '',
  "lastName"  TEXT        NOT NULL DEFAULT '',
  username    TEXT        NOT NULL UNIQUE,
  -- App-level permission role
  role        TEXT        NOT NULL DEFAULT 'user'
                CHECK (role IN ('admin', 'user', 'viewer')),
  -- Foreign key to the business this user belongs to.
  -- SET NULL on delete so the user record is not lost if the business is deleted.
  business_id UUID        REFERENCES public.businesses (id) ON DELETE SET NULL,
  -- Foreign key to the user's job role within the business.
  -- SET NULL on delete so the user record is not lost if the role is deleted.
  job_role_id INTEGER     REFERENCES public.job_roles (id) ON DELETE SET NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── RLS for users ─────────────────────────────────────────────────────────────

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Users may read their own profile only.
CREATE POLICY "users: select own"
  ON public.users
  FOR SELECT
  USING (auth.uid() = id);

-- Users may update their own profile (including business_id and job_role_id).
-- id and email changes are blocked at the application layer.
CREATE POLICY "users: update own"
  ON public.users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Service role (used by server-side code) bypasses RLS automatically.

-- ── Auto-update "updatedAt" on users ─────────────────────────────────────────
-- Kept as a separate function from handle_updated_at_snake because this table
-- uses the legacy quoted camelCase column name "updatedAt".

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW."updatedAt" = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ── Auto-create minimal profile row on sign-up ────────────────────────────────
-- Fires when Supabase Auth creates a new auth.users row.
-- Inserts only the fields available at sign-up time (name, username).
-- business_id and job_role_id are set later by register_business_owner RPC.
-- The RPC also handles the ON CONFLICT upsert for cases where the trigger
-- fires before the RPC runs.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.users (
    id,
    email,
    "firstName",
    "lastName",
    username
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'firstName', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'lastName',  ''),
    COALESCE(NEW.raw_user_meta_data ->> 'username',  '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- RPC: public.register_business_owner
-- Atomically creates the business record and upserts the user profile in a
-- single database round-trip, avoiding partial state if one INSERT fails.
--
-- Called by the React Native app immediately after supabase.auth.signUp().
-- Runs as SECURITY DEFINER so it can INSERT into businesses on behalf of the
-- newly created user (who has no RLS INSERT policy yet).
--
-- Passwords are hashed by Supabase Auth (bcrypt). Never store passwords in public.users.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.register_business_owner(
  p_user_id          UUID,
  p_email            TEXT,
  p_first_name       TEXT,
  p_last_name        TEXT,
  p_username         TEXT,
  p_business_name    TEXT,
  p_business_type_id INTEGER,
  p_enterprise_type  TEXT,
  p_job_role_id      INTEGER
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_business_id UUID;
BEGIN
  -- 1. Validate enterprise_type to prevent invalid values sneaking through
  IF p_enterprise_type NOT IN ('small', 'medium') THEN
    RAISE EXCEPTION 'Invalid enterprise_type: %. Must be small or medium.', p_enterprise_type;
  END IF;

  -- 2. Create the business record; owner_id is set immediately
  INSERT INTO public.businesses (name, business_type_id, enterprise_type, owner_id)
  VALUES (p_business_name, p_business_type_id, p_enterprise_type, p_user_id)
  RETURNING id INTO v_business_id;

  -- 3. Upsert user profile row.
  --    The on_auth_user_created trigger may have already inserted a minimal row
  --    (id, email, firstName, lastName, username with empty business_id/job_role_id).
  --    ON CONFLICT updates all fields so the profile is always complete.
  INSERT INTO public.users (
    id,
    email,
    "firstName",
    "lastName",
    username,
    business_id,
    job_role_id,
    role
  )
  VALUES (
    p_user_id,
    p_email,
    p_first_name,
    p_last_name,
    p_username,
    v_business_id,
    p_job_role_id,
    'admin'
  )
  ON CONFLICT (id) DO UPDATE SET
    email       = EXCLUDED.email,
    "firstName" = EXCLUDED."firstName",
    "lastName"  = EXCLUDED."lastName",
    username    = EXCLUDED.username,
    business_id = EXCLUDED.business_id,
    job_role_id = EXCLUDED.job_role_id,
    role        = EXCLUDED.role,
    "updatedAt" = NOW();

  -- 4. Return the created IDs to the caller for immediate local state update
  RETURN json_build_object(
    'businessId', v_business_id,
    'userId',     p_user_id
  );
END;
$$;

-- Grant execute to authenticated users (called client-side after signUp)
GRANT EXECUTE ON FUNCTION public.register_business_owner TO authenticated;

-- ============================================================================
-- RPC: public.get_email_by_username
-- Resolves a username to an email address so the app can call
-- supabase.auth.signInWithPassword() (which only accepts email).
--
-- SECURITY DEFINER: runs as the function owner (postgres), bypassing the RLS
-- policy on public.users that would otherwise block anon SELECT.
-- Only the email column is returned — no other user data is exposed.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_email_by_username(p_username TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT;
BEGIN
  SELECT email INTO v_email
  FROM public.users
  WHERE lower(username) = lower(trim(p_username))
  LIMIT 1;

  -- Returns NULL when username not found; caller treats NULL as "not found".
  RETURN v_email;
END;
$$;

-- Grant to anon so it can be called before the user is authenticated (login screen).
GRANT EXECUTE ON FUNCTION public.get_email_by_username TO anon, authenticated;

-- ============================================================================
-- Future modules (placeholder tables)
-- Uncomment and extend as each module is built.
-- ============================================================================

/*
-- products
CREATE TABLE IF NOT EXISTS public.products (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id  UUID        NOT NULL REFERENCES public.businesses (id) ON DELETE CASCADE,
  name         TEXT        NOT NULL,
  sku          TEXT        UNIQUE,
  price        NUMERIC     NOT NULL DEFAULT 0,
  cost         NUMERIC     NOT NULL DEFAULT 0,
  created_by   UUID        REFERENCES public.users (id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- inventory
CREATE TABLE IF NOT EXISTS public.inventory (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id  UUID        NOT NULL REFERENCES public.products (id) ON DELETE CASCADE,
  quantity    INTEGER     NOT NULL DEFAULT 0,
  min_stock   INTEGER     NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- sales
CREATE TABLE IF NOT EXISTS public.sales (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID        NOT NULL REFERENCES public.businesses (id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES public.users (id),
  total       NUMERIC     NOT NULL DEFAULT 0,
  status      TEXT        NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'completed', 'refunded', 'cancelled')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- sale_items  (POS transaction lines)
CREATE TABLE IF NOT EXISTS public.sale_items (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  sale_id     UUID        NOT NULL REFERENCES public.sales (id) ON DELETE CASCADE,
  product_id  UUID        NOT NULL REFERENCES public.products (id),
  quantity    INTEGER     NOT NULL,
  unit_price  NUMERIC     NOT NULL,
  subtotal    NUMERIC     GENERATED ALWAYS AS (quantity * unit_price) STORED
);
*/
