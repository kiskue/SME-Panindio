/**
 * Edge Function: upload-customer-id
 * ===================================
 * Accepts a customer ID document upload (photo) and saves it to
 * the `customer-documents` storage bucket.
 *
 * Called by: `src/app/(customer)/verify-id.tsx`
 *
 * Auth:    App-level session token (customer_sessions table).
 *
 * Payload (multipart/form-data):
 *   sessionToken:  string   — Customer session token
 *   customerId:    string   — Customer UUID
 *   documentType:  string   — 'NATIONAL_ID' | 'PASSPORT' | 'DRIVERS_LICENSE' | 'OTHER'
 *   file:          File     — The image (JPEG or PNG, max 10 MB)
 *
 * Response 201:
 *   { documentId: string, imageUrl: string }
 *
 * Error codes:
 *   MISSING_PARAMS     — Required field absent (400)
 *   INVALID_FILE_TYPE  — Not a JPEG or PNG (400)
 *   FILE_TOO_LARGE     — Exceeds 10 MB limit (400)
 *   SESSION_EXPIRED    — Token invalid or expired (401)
 *   UNAUTHORIZED       — Session does not belong to this customer (403)
 *   UPLOAD_FAILED      — Storage bucket write failed (500)
 *   SERVER_ERROR       — Unhandled exception (500)
 *
 * Storage path pattern: {businessOwnerId}/{customerId}/{documentType}_{timestamp}.jpg
 *
 * TODO: Implement this function.
 * TODO: Run on-device Google MLKit OCR result through server-side validation
 *       before inserting the customer_id_documents row (see SUPABASE_SUKI_SCHEMA.md §028).
 * TODO: Trigger the verify-customer-liveness function after successful upload
 *       to complete the 2-step verification flow.
 */

import { serve }        from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsResponse, errorResponse } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse()

  // TODO: Implement upload-customer-id
  console.warn('[upload-customer-id] Not yet implemented')
  return errorResponse('NOT_IMPLEMENTED', 501)
})
