/**
 * Edge Function: get-customer-orders
 * =====================================
 * Returns the order history for a Suki customer.
 *
 * Called by: `src/store/online_orders.store.ts` → `loadCustomerOrders()`
 *
 * Auth:    App-level session token (customer_sessions table).
 *
 * Payload:
 *   {
 *     customerId:   string
 *     sessionToken: string
 *     limit?:       number   — Default 20, max 50
 *     offset?:      number   — For pagination
 *   }
 *
 * Response 200:
 *   { orders: OnlineOrder[], total: number }
 *
 * Error codes:
 *   MISSING_PARAMS   — Required field absent (400)
 *   SESSION_EXPIRED  — Token invalid or expired (401)
 *   UNAUTHORIZED     — Session does not belong to this customer (403)
 *   SERVER_ERROR     — Unhandled exception (500)
 *
 * TODO: Implement this function.
 * TODO: Include order_items in each order response to avoid N+1 round trips.
 * TODO: Support filtering by status (PENDING, COMPLETED, CANCELLED).
 */

import { serve }        from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsResponse, errorResponse } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse()

  // TODO: Implement get-customer-orders
  console.warn('[get-customer-orders] Not yet implemented')
  return errorResponse('NOT_IMPLEMENTED', 501)
})
