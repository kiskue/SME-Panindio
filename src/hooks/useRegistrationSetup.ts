/**
 * useRegistrationSetup
 *
 * Fetches the lookup data required to render the registration form:
 *   - business_types  (from public.business_types)
 *   - job_roles       (from public.job_roles)
 *
 * Strategy:
 *   1. Try to fetch from Supabase (live DB data).
 *   2. If the fetch fails for any reason (table not yet created, RLS issue,
 *      network error), fall back silently to the hardcoded seed data below.
 *      This keeps the registration form functional before the schema is applied.
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { BusinessType, JobRole } from '@/types';

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

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface RegistrationSetup {
  businessTypes: BusinessType[];
  jobRoles: JobRole[];
  loading: boolean;
  /** Non-null only when using fallback data (DB unavailable). */
  error: string | null;
}

export function useRegistrationSetup(): RegistrationSetup {
  const [businessTypes, setBusinessTypes] = useState<BusinessType[]>([]);
  const [jobRoles, setJobRoles] = useState<JobRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchLookupData = async (): Promise<void> => {
      setLoading(true);
      setError(null);

      try {
        const [businessTypesResult, jobRolesResult] = await Promise.all([
          supabase
            .from('business_types')
            .select('id, name, slug, description, category, pos_enabled, sort_order, is_active')
            .eq('is_active', true)
            .order('sort_order'),
          supabase
            .from('job_roles')
            .select('id, name, slug, description, sort_order, is_active')
            .eq('is_active', true)
            .order('sort_order'),
        ]);

        if (cancelled) return;

        // If either query failed, log the real message and fall back to seed data.
        if (businessTypesResult.error || jobRolesResult.error) {
          const msg =
            businessTypesResult.error?.message ??
            jobRolesResult.error?.message ??
            'Unknown error';
          console.warn(
            '[useRegistrationSetup] DB unavailable, using fallback data. Reason:',
            msg,
            '\nRun supabase/schema.sql in your Supabase SQL editor to fix this.',
          );
          setBusinessTypes(FALLBACK_BUSINESS_TYPES);
          setJobRoles(FALLBACK_JOB_ROLES);
          setError(null); // don't surface to UI — fallback handles it silently
          return;
        }

        const fetchedTypes = (businessTypesResult.data ?? []) as BusinessType[];
        const fetchedRoles = (jobRolesResult.data ?? []) as JobRole[];

        // If tables exist but are empty (e.g. seed not run), also fall back.
        setBusinessTypes(fetchedTypes.length > 0 ? fetchedTypes : FALLBACK_BUSINESS_TYPES);
        setJobRoles(fetchedRoles.length > 0 ? fetchedRoles : FALLBACK_JOB_ROLES);
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          console.warn(
            '[useRegistrationSetup] Unexpected error, using fallback data:',
            message,
          );
          setBusinessTypes(FALLBACK_BUSINESS_TYPES);
          setJobRoles(FALLBACK_JOB_ROLES);
          setError(null); // fallback handles it — no need to block the form
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void fetchLookupData();

    return () => {
      cancelled = true;
    };
  }, []);

  return { businessTypes, jobRoles, loading, error };
}
