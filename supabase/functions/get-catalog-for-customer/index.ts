/**
 * Edge Function: get-catalog-for-customer
 * =========================================
 * Returns the available online catalog items for a business.
 *
 * Called by: `src/app/(customer)/products.tsx`
 *
 * Auth:    App-level session token (customer_sessions table).
 *          Customers are NOT Supabase Auth users — RLS cannot use auth.uid() for them.
 *          This function uses service_role to bypass RLS and validates the session manually.
 *
 * Payload:
 *   {
 *     businessOwnerId?: string   — UUID of the business (required if customerId absent)
 *     customerId?:      string   — Customer UUID (used to validate session + auto-derive businessOwnerId)
 *     sessionToken?:    string   — Required when customerId is provided
 *   }
 *
 * At least one of `businessOwnerId` or `customerId` must be present.
 * When both are present, session is validated against customerId first.
 * When only businessOwnerId is present, the catalog is returned without session validation
 * (allows unauthenticated browsing — suitable for the customer registration preview flow).
 *
 * Response 200:
 *   { items: OnlineCatalogItem[] }
 *
 * Error codes:
 *   MISSING_BUSINESS_OWNER_ID — Neither businessOwnerId nor customerId provided (400)
 *   SESSION_EXPIRED           — Token found but expired or invalidated (401)
 *   UNAUTHORIZED              — Session token does not belong to the given customerId (403)
 *   CUSTOMER_NOT_FOUND        — Could not derive businessOwnerId from customerId (404)
 *   QUERY_FAILED              — DB error on catalog fetch (500)
 *   SERVER_ERROR              — Unhandled exception (500)
 *
 * TODO: Enforce session validation for all requests once the customer app is stable.
 * TODO: Add pagination — large catalogs should be paged (limit/offset or cursor).
 */

import { serve }        from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsResponse, errorResponse, jsonResponse } from '../_shared/cors.ts'

const CATALOG_COLS =
  'id, business_owner_id, product_id, product_name, product_barcode, ' +
  'product_image_url, custom_price, is_available, display_order, created_at, updated_at'

serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse()

  try {
    const { businessOwnerId: rawBusinessOwnerId, customerId, sessionToken } =
      await req.json() as {
        businessOwnerId?: string
        customerId?:      string
        sessionToken?:    string
      }

    if (!rawBusinessOwnerId && !customerId) {
      return errorResponse('MISSING_BUSINESS_OWNER_ID', 400)
    }

    // service_role bypasses RLS — required because customers have no auth.uid().
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Validate session when a customer is identified.
    if (customerId && sessionToken) {
      const { data: session } = await supabase
        .from('customer_sessions')
        .select('customer_id, expires_at')
        .eq('session_token', sessionToken)
        .is('invalidated_at', null)
        .single()

      if (!session || new Date(session.expires_at as string) < new Date()) {
        return errorResponse('SESSION_EXPIRED', 401)
      }
      if ((session.customer_id as string) !== customerId) {
        return errorResponse('UNAUTHORIZED', 403)
      }
    }

    // Resolve businessOwnerId — prefer client-supplied value, fall back to DB lookup.
    let businessOwnerId = rawBusinessOwnerId?.trim() || null

    if (!businessOwnerId && customerId) {
      const { data: custRow, error: custErr } = await supabase
        .from('customers')
        .select('business_owner_id')
        .eq('id', customerId)
        .is('deleted_at', null)
        .single()

      if (custErr || !custRow) {
        return errorResponse('CUSTOMER_NOT_FOUND', 404)
      }
      businessOwnerId = custRow.business_owner_id as string
    }

    if (!businessOwnerId) {
      return errorResponse('MISSING_BUSINESS_OWNER_ID', 400)
    }

    const { data, error } = await supabase
      .from('online_catalog')
      .select(CATALOG_COLS)
      .eq('business_owner_id', businessOwnerId)
      .eq('is_available', true)
      .is('deleted_at', null)
      .order('display_order', { ascending: true })

    if (error) {
      return errorResponse('QUERY_FAILED', 500, error.message)
    }

    return jsonResponse({ items: data ?? [] })

  } catch (err) {
    console.error('[get-catalog-for-customer] unhandled error:', err)
    return errorResponse('SERVER_ERROR', 500, String(err))
  }
})
