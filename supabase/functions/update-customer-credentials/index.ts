/**
 * Edge Function: update-customer-credentials
 * ============================================
 * Updates a customer's username and/or password.
 *
 * Called by: `customer.service.ts` → `updateCustomerCredentials()`
 *
 * Auth:    App-level session token (customer_sessions table).
 *
 * Payload:
 *   {
 *     customerId:   string   — Customer UUID
 *     sessionToken: string   — Must match an active session for this customer
 *     username:     string   — New username (must be unique within the business)
 *     password:     string   — New plaintext password; hashed server-side
 *   }
 *
 * Response 200:
 *   { success: true }
 *
 * Error codes:
 *   MISSING_PARAMS      — Required field absent (400)
 *   SESSION_EXPIRED     — Token not found, expired, or invalidated (401)
 *   UNAUTHORIZED        — Session does not belong to this customer (403)
 *   USERNAME_TAKEN      — New username already exists in this business (409)
 *   UPDATE_FAILED       — DB update failed (500)
 *   SERVER_ERROR        — Unhandled exception (500)
 *
 * TODO: Implement this function.
 * TODO: Support partial update — allow changing username OR password independently.
 * TODO: Re-validate current password before allowing the change (confirmation step).
 */

import { serve }        from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as bcrypt      from 'https://deno.land/x/bcrypt@v0.4.1/mod.ts'
import { corsResponse, errorResponse, jsonResponse } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse()

  try {
    const { customerId, sessionToken, username, password } = await req.json() as {
      customerId?:   string
      sessionToken?: string
      username?:     string
      password?:     string
    }

    if (!customerId || !sessionToken || !username || !password) {
      return errorResponse('MISSING_PARAMS', 400)
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Validate session.
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

    const passwordHash = bcrypt.hashSync(password, 10)

    const { error: updateErr } = await supabase
      .from('customers')
      .update({
        username:      username.trim().toLowerCase(),
        password_hash: passwordHash,
      })
      .eq('id', customerId)

    if (updateErr) {
      if (updateErr.code === '23505') return errorResponse('USERNAME_TAKEN', 409)
      console.error('[update-customer-credentials] update error:', updateErr)
      return errorResponse('UPDATE_FAILED', 500, updateErr.message)
    }

    return jsonResponse({ success: true })

  } catch (err) {
    console.error('[update-customer-credentials] unhandled error:', err)
    return errorResponse('SERVER_ERROR', 500, String(err))
  }
})
