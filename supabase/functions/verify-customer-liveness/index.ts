/**
 * Edge Function: verify-customer-liveness
 * =========================================
 * Runs liveness detection on a customer selfie to prevent ID fraud.
 * Sets verification_status to 'PENDING' when liveness passes (awaiting
 * manual business-owner review).
 *
 * Called by: `src/app/(customer)/verify-liveness.tsx`
 *
 * Auth:    App-level session token (customer_sessions table).
 *
 * Payload:
 *   {
 *     customerId:    string   — Customer UUID
 *     sessionToken:  string   — Must match active session for this customer
 *     selfieBase64?: string   — Base64 selfie image for server-side validation
 *     livenessScore?: number  — On-device score from expo-face-detector (0–1)
 *   }
 *
 * Response 200:
 *   { passed: boolean, verificationStatus: string }
 *
 * Error codes:
 *   MISSING_PARAMS     — Required field absent (400)
 *   SESSION_EXPIRED    — Token invalid or expired (401)
 *   UNAUTHORIZED       — Session does not belong to this customer (403)
 *   LIVENESS_FAILED    — Face not detected or score below threshold (422)
 *   SERVER_ERROR       — Unhandled exception (500)
 *
 * Third-party integrations (choose one before implementing):
 *   Option A: AWS Rekognition FaceDetection — best accuracy, requires AWS credentials
 *   Option B: Azure Face API — good accuracy, GDPR-friendly EU region available
 *   Option C: Nyckel — no-code ML API, easiest to integrate
 *   Option D: expo-face-detector client score only — no server call, lowest friction
 *
 * TODO: Implement this function once a liveness provider is chosen.
 * TODO: Insert into customer_verification_audit table on every call (pass AND fail).
 * TODO: Set verification_status to 'PENDING' on pass (not 'VERIFIED' — requires manual review).
 */

import { serve }        from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsResponse, errorResponse } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse()

  // TODO: Implement verify-customer-liveness
  console.warn('[verify-customer-liveness] Not yet implemented')
  return errorResponse('NOT_IMPLEMENTED', 501)
})
