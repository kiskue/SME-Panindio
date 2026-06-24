/**
 * Edge Function: place-online-order
 * ===================================
 * Creates an online order for a Suki customer.
 *
 * Called by: `src/store/online_orders.store.ts` → `placeOrder()`
 *
 * Auth:    App-level session token (customer_sessions table).
 *
 * Payload:
 *   {
 *     customerId:     string
 *     sessionToken:   string
 *     paymentMethod:  'PAY_NOW' | 'PAY_LATER'
 *     vatEnabled:     boolean
 *     customerNotes?: string
 *     items: Array<{
 *       catalogItemId: string
 *       productId:     string
 *       productName:   string
 *       quantity:      number
 *       unitPrice:     number
 *     }>
 *   }
 *
 * Response 201:
 *   { orderId: string, orderNumber: string, totalAmount: number }
 *
 * Error codes:
 *   MISSING_PARAMS         — Required field absent (400)
 *   EMPTY_CART             — items array is empty (400)
 *   SESSION_EXPIRED        — Token invalid or expired (401)
 *   UNAUTHORIZED           — Session does not belong to this customer (403)
 *   PAY_LATER_NOT_ALLOWED  — pay_later_enabled = false OR not VERIFIED (403)
 *   ORDER_FAILED           — DB insert failed (500)
 *   SERVER_ERROR           — Unhandled exception (500)
 *
 * TODO: Implement this function.
 * TODO: Validate each catalogItemId still exists and is_available before accepting the order.
 * TODO: Snapshot catalog prices at order time — do not trust client-sent unitPrice for total calc.
 * TODO: Generate order_number in a deterministic, human-readable format (e.g. ORD-YYYYMMDD-NNN).
 */

import { serve }        from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsResponse, errorResponse } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse()

  // TODO: Implement place-online-order
  console.warn('[place-online-order] Not yet implemented')
  return errorResponse('NOT_IMPLEMENTED', 501)
})
