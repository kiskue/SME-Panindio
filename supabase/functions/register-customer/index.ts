/**
 * Edge Function: register-customer
 * ==================================
 * Registers a new Suki customer for a business.
 *
 * Called by: `business_suki.service.ts` → `registerCustomerByBusiness()`
 *
 * Auth:    Business owner JWT (Bearer token in Authorization header).
 *          The function verifies auth.uid() from the JWT to resolve
 *          business_owner_id — the client never passes an owner ID manually.
 *
 * Payload:
 *   {
 *     businessOwnerId: string   — UUID of the business owner (must match auth.uid())
 *     username:        string   — Unique within this business (case-insensitive)
 *     password:        string   — Plaintext; hashed server-side with bcrypt cost 10
 *     fullName:        string
 *     phoneNumber:     string
 *     email?:          string   — Optional
 *   }
 *
 * Response 201:
 *   { customerId: string }
 *
 * Error codes:
 *   MISSING_FIELDS         — Required field absent
 *   USERNAME_TAKEN         — username already exists for this business (409)
 *   REGISTRATION_FAILED    — DB insert failed for another reason (500)
 *   SERVER_ERROR           — Unhandled exception (500)
 *
 * NOTE: No QR token is generated. Customers authenticate via username + password only.
 *
 * TODO: Validate businessOwnerId === auth.uid() from JWT (currently trusts client-sent value).
 * TODO: Enforce minimum password length and username character constraints server-side.
 * TODO: Add rate limiting — repeated registration calls could be abused to enumerate usernames.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as bcrypt from 'https://deno.land/x/bcrypt@v0.4.1/mod.ts'
import { corsResponse, errorResponse, jsonResponse } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse()

  try {
    const { businessOwnerId, username, password, fullName, phoneNumber, email } =
      await req.json() as {
        businessOwnerId?: string
        username?:        string
        password?:        string
        fullName?:        string
        phoneNumber?:     string
        email?:           string
      }

    if (!businessOwnerId || !username || !password || !fullName || !phoneNumber) {
      return errorResponse('MISSING_FIELDS', 400)
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // bcrypt.hashSync avoids Web Workers (unsupported in Supabase Edge Functions runtime).
    // Cost 10 balances security and cold-start latency on Edge Function infrastructure.
    const passwordHash = bcrypt.hashSync(password, 10)

    const { data: customer, error: insertErr } = await supabase
      .from('customers')
      .insert({
        business_owner_id:   businessOwnerId,
        username:            username.trim().toLowerCase(),
        password_hash:       passwordHash,
        full_name:           fullName.trim(),
        phone_number:        phoneNumber,
        ...(email ? { email: email.trim().toLowerCase() } : {}),
        verification_status: 'UNVERIFIED',
        // Customers registered by the business owner can log in immediately
        // with their username + password — no first-login ceremony required.
        first_login_completed: true,
      })
      .select('id')
      .single()

    if (insertErr) {
      if (insertErr.code === '23505') {
        return errorResponse('USERNAME_TAKEN', 409)
      }
      console.error('[register-customer] insert error:', insertErr)
      return errorResponse('REGISTRATION_FAILED', 500, insertErr.message)
    }

    return jsonResponse({ customerId: customer.id }, 201)

  } catch (err) {
    console.error('[register-customer] unhandled error:', err)
    return errorResponse('SERVER_ERROR', 500, String(err))
  }
})
