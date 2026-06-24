/**
 * useRegistrationSetup
 *
 * Fetches the lookup data required to render the registration form:
 *   - business_types  (from public.business_types)
 *   - job_roles       (from public.job_roles)
 *
 * Strategy (stale-while-revalidate):
 *   1. Render immediately with the bundled fallback seed data — the form is
 *      usable with zero network wait, so a slow/cold backend never makes the
 *      user stare at a loading skeleton.
 *   2. Fetch live data from the API in the background and swap it in when it
 *      arrives. If the fetch fails or returns nothing, the fallback simply
 *      stays on screen.
 *
 * Feature gates:
 *   - 'services' category is excluded — not supported in this version.
 *   - Remaining types are grouped into two operation modes:
 *       production: 'food_beverage'
 *       reseller:   'retail' | 'digital' | 'other'
 */

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import {
  BusinessType,
  JobRole,
  BusinessOperationMode,
  getBusinessOperationMode,
  isSupportedBusinessCategory,
} from '@/types';

// The backend may serialize lookup rows in camelCase; the app's BusinessType /
// JobRole types use snake_case. Normalize so either casing works.
function normalizeBusinessType(r: Record<string, unknown>): BusinessType {
  return {
    id: Number(r['id']),
    name: String(r['name'] ?? ''),
    slug: String(r['slug'] ?? ''),
    description: (r['description'] as string | null | undefined) ?? null,
    category: String(r['category'] ?? ''),
    pos_enabled: Boolean(r['pos_enabled'] ?? r['posEnabled']),
    sort_order: Number(r['sort_order'] ?? r['sortOrder'] ?? 0),
    is_active: Boolean(r['is_active'] ?? r['isActive'] ?? true),
  };
}

function normalizeJobRole(r: Record<string, unknown>): JobRole {
  return {
    id: Number(r['id']),
    name: String(r['name'] ?? ''),
    slug: String(r['slug'] ?? ''),
    description: (r['description'] as string | null | undefined) ?? null,
    sort_order: Number(r['sort_order'] ?? r['sortOrder'] ?? 0),
    is_active: Boolean(r['is_active'] ?? r['isActive'] ?? true),
  };
}

// ─── Fallback seed data ───────────────────────────────────────────────────────
// Mirrors supabase/schema.sql exactly. Used when the DB tables are unavailable.

const FALLBACK_BUSINESS_TYPES: BusinessType[] = [
  { id: 1,  name: 'Sari-Sari Store',              slug: 'sari-sari-store',           description: 'A neighbourhood convenience store selling everyday goods', category: 'retail',       pos_enabled: true,  sort_order: 1,  is_active: true },
  { id: 2,  name: 'Grocery Store',                slug: 'grocery-store',             description: 'A store selling fresh and packaged food items',           category: 'retail',       pos_enabled: true,  sort_order: 2,  is_active: true },
  { id: 3,  name: 'Food Cart',                    slug: 'food-cart',                 description: 'A mobile or stall-based food vending unit',               category: 'food_beverage',pos_enabled: true,  sort_order: 3,  is_active: true },
  { id: 4,  name: 'Food Stall',                   slug: 'food-stall',                description: 'A fixed stall selling prepared food',                     category: 'food_beverage',pos_enabled: true,  sort_order: 4,  is_active: true },
  { id: 5,  name: 'Restaurant / Eatery',          slug: 'restaurant-eatery',         description: 'A dine-in establishment serving food and beverages',      category: 'food_beverage',pos_enabled: true,  sort_order: 5,  is_active: true },
  { id: 6,  name: 'Bakery',                       slug: 'bakery',                    description: 'A shop producing and selling baked goods',                category: 'food_beverage',pos_enabled: true,  sort_order: 6,  is_active: true },
  { id: 7,  name: 'Pharmacy / Drugstore',         slug: 'pharmacy-drugstore',        description: 'A retail outlet selling medicines and health products',   category: 'retail',       pos_enabled: true,  sort_order: 7,  is_active: true },
  { id: 8,  name: 'Hardware Store',               slug: 'hardware-store',            description: 'A store selling construction and home improvement goods', category: 'retail',       pos_enabled: true,  sort_order: 8,  is_active: true },
  { id: 9,  name: 'Clothing / Apparel',           slug: 'clothing-apparel',          description: 'A boutique or shop selling garments and accessories',     category: 'retail',       pos_enabled: true,  sort_order: 9,  is_active: true },
  { id: 10, name: 'Beauty Salon / Barbershop',    slug: 'beauty-salon-barbershop',   description: 'A personal grooming and styling service business',        category: 'services',     pos_enabled: false, sort_order: 10, is_active: true },
  { id: 11, name: 'Laundry Shop',                 slug: 'laundry-shop',              description: 'A self-service or full-service laundry business',         category: 'services',     pos_enabled: false, sort_order: 11, is_active: true },
  { id: 12, name: 'Computer Shop / Internet Cafe',slug: 'computer-shop-internet-cafe',description: 'A shop selling computer peripherals or offering internet access', category: 'retail', pos_enabled: true, sort_order: 12, is_active: true },
  { id: 13, name: 'Printing Shop',                slug: 'printing-shop',             description: 'A shop providing printing and reproduction services',     category: 'services',     pos_enabled: false, sort_order: 13, is_active: true },
  { id: 14, name: 'Repair Shop',                  slug: 'repair-shop',               description: 'A shop offering repair services for appliances or devices',category: 'services',    pos_enabled: false, sort_order: 14, is_active: true },
  { id: 15, name: 'Water Refilling Station',      slug: 'water-refilling-station',   description: 'A business selling purified drinking water',              category: 'retail',       pos_enabled: true,  sort_order: 15, is_active: true },
  { id: 16, name: 'Carwash',                      slug: 'carwash',                   description: 'A vehicle cleaning and detailing service',                category: 'services',     pos_enabled: false, sort_order: 16, is_active: true },
  { id: 17, name: 'Convenience Store',            slug: 'convenience-store',         description: 'A small store open long hours selling everyday items',    category: 'retail',       pos_enabled: true,  sort_order: 17, is_active: true },
  { id: 18, name: 'Ukay-Ukay',                    slug: 'ukay-ukay',                 description: 'A store selling second-hand clothing',                    category: 'retail',       pos_enabled: true,  sort_order: 18, is_active: true },
  { id: 19, name: 'Catering Services',            slug: 'catering-services',         description: 'A business providing food for events and gatherings',     category: 'food_beverage',pos_enabled: false, sort_order: 19, is_active: true },
  { id: 20, name: 'Online Seller',                slug: 'online-seller',             description: 'A business selling goods via online marketplaces',        category: 'digital',      pos_enabled: false, sort_order: 20, is_active: true },
  { id: 21, name: 'Others',                       slug: 'others',                    description: 'Other types of business not listed above',                category: 'other',        pos_enabled: false, sort_order: 21, is_active: true },
];

const FALLBACK_JOB_ROLES: JobRole[] = [
  { id: 1,  name: 'CEO / Owner',             slug: 'ceo-owner',           description: 'The business owner or chief executive officer',                   sort_order: 1,  is_active: true },
  { id: 2,  name: 'General Manager',         slug: 'general-manager',     description: 'Oversees day-to-day operations of the entire business',          sort_order: 2,  is_active: true },
  { id: 3,  name: 'Store Manager',           slug: 'store-manager',       description: 'Manages a single store or outlet',                               sort_order: 3,  is_active: true },
  { id: 4,  name: 'Cashier',                 slug: 'cashier',             description: 'Handles cash and payment transactions at point of sale',          sort_order: 4,  is_active: true },
  { id: 5,  name: 'Sales Associate',         slug: 'sales-associate',     description: 'Assists customers and processes sales (Sales Lady / Boy)',        sort_order: 5,  is_active: true },
  { id: 6,  name: 'Inventory Manager',       slug: 'inventory-manager',   description: 'Manages stock levels, receiving, and inventory records',          sort_order: 6,  is_active: true },
  { id: 7,  name: 'Purchasing Officer',      slug: 'purchasing-officer',  description: 'Handles procurement and supplier relationships',                  sort_order: 7,  is_active: true },
  { id: 8,  name: 'Accountant / Bookkeeper', slug: 'accountant',          description: 'Manages financial records, accounts, and bookkeeping',            sort_order: 8,  is_active: true },
  { id: 9,  name: 'Delivery Personnel',      slug: 'delivery-personnel',  description: 'Handles delivery and logistics of goods',                        sort_order: 9,  is_active: true },
  { id: 10, name: 'Kitchen Staff',           slug: 'kitchen-staff',       description: 'Prepares food in a restaurant, eatery, or food stall',           sort_order: 10, is_active: true },
  { id: 11, name: 'Security Guard',          slug: 'security-guard',      description: 'Provides security and access control for the business premises', sort_order: 11, is_active: true },
  { id: 12, name: 'Others',                  slug: 'others',              description: 'Other roles not listed above',                                    sort_order: 12, is_active: true },
];

// ─── Business type filtering & grouping ───────────────────────────────────────

/**
 * Remove unsupported categories (e.g. 'services') from the DB or fallback list.
 *
 * Category matching is delegated to `isSupportedBusinessCategory`, which
 * normalizes casing/spacing so it works for both the live backend's
 * capitalized values ('Services') and the bundled fallback ('services').
 */
function filterSupportedTypes(types: BusinessType[]): BusinessType[] {
  return types.filter((t) => isSupportedBusinessCategory(t.category));
}

/** A flat BusinessType annotated with its resolved operation mode. */
export interface BusinessTypeWithMode extends BusinessType {
  operationMode: BusinessOperationMode;
}

/** Result of grouping for the two-section registration picker. */
export interface GroupedBusinessTypes {
  production: BusinessTypeWithMode[];
  reseller:   BusinessTypeWithMode[];
}

/** Group supported business types into production vs reseller sections. */
export function groupBusinessTypes(types: BusinessType[]): GroupedBusinessTypes {
  const production: BusinessTypeWithMode[] = [];
  const reseller:   BusinessTypeWithMode[] = [];

  for (const t of filterSupportedTypes(types)) {
    const mode = getBusinessOperationMode(t.category);
    const entry: BusinessTypeWithMode = { ...t, operationMode: mode };
    if (mode === 'production') {
      production.push(entry);
    } else {
      reseller.push(entry);
    }
  }

  return { production, reseller };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface RegistrationSetup {
  /** All supported business types (services filtered out), flat list. */
  businessTypes: BusinessType[];
  /** The same list split into production vs reseller groups for the picker UI. */
  groupedBusinessTypes: GroupedBusinessTypes;
  jobRoles: JobRole[];
  /**
   * Always false — the form renders instantly with fallback data and is never
   * gated behind the network. Kept for API compatibility.
   */
  loading: boolean;
  /** True while the background API refresh is in flight (form already usable). */
  refreshing: boolean;
  /** Non-null only when using fallback data (DB unavailable). */
  error: string | null;
}

export function useRegistrationSetup(): RegistrationSetup {
  // Seed synchronously from the bundled fallback so the pickers are populated on
  // the very first render — no skeleton, no network wait.
  const [businessTypes, setBusinessTypes] = useState<BusinessType[]>(
    () => filterSupportedTypes(FALLBACK_BUSINESS_TYPES),
  );
  const [jobRoles, setJobRoles] = useState<JobRole[]>(() => FALLBACK_JOB_ROLES);
  // Background refresh in progress. The form is already usable, so consumers
  // should treat this as a soft "refreshing" hint, not a blocking gate.
  const [refreshing, setRefreshing] = useState(true);

  // Derived: group the filtered types whenever businessTypes changes.
  // useMemo is not available outside a component, so we compute it inline
  // and include it in the return value. The grouping is cheap (one pass).
  const groupedBusinessTypes = groupBusinessTypes(businessTypes);

  useEffect(() => {
    let cancelled = false;

    // Revalidate against the API in the background. Failures are non-fatal:
    // the fallback data is already on screen, so we never block or surface an
    // error to the user here.
    const revalidate = async (): Promise<void> => {
      try {
        const [typesResp, rolesResp] = await Promise.all([
          api.get<Record<string, unknown>[]>('/business-types'),
          api.get<Record<string, unknown>[]>('/job-roles'),
        ]);

        if (cancelled) return;

        const fetchedTypes = (typesResp.data ?? []).map(normalizeBusinessType);
        const fetchedRoles = (rolesResp.data ?? []).map(normalizeJobRole);

        // Only swap in live data when it's actually present; if the tables are
        // empty (seed not run) keep the fallback already being shown.
        if (fetchedTypes.length > 0) {
          setBusinessTypes(filterSupportedTypes(fetchedTypes));
        }
        if (fetchedRoles.length > 0) {
          setJobRoles(fetchedRoles);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        console.warn(
          '[useRegistrationSetup] background refresh failed, keeping fallback data:',
          message,
        );
      } finally {
        if (!cancelled) {
          setRefreshing(false);
        }
      }
    };

    void revalidate();

    return () => {
      cancelled = true;
    };
  }, []);

  // `loading` is intentionally always false: the form renders instantly with
  // fallback data, so it must never be gated behind the network. `refreshing`
  // exposes the background-refresh state for any optional soft indicator.
  return {
    businessTypes,
    groupedBusinessTypes,
    jobRoles,
    loading: false,
    refreshing,
    error: null,
  };
}
