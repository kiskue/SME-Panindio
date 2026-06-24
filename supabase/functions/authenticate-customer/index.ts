/**
 * Edge Function: authenticate-customer
 * ======================================
 * Authenticates a Suki customer with username + password.
 *
 * Called by: `customer.service.ts` → `authenticateCustomer()`
 *
 * Auth:    None (anon key). Customers are NOT Supabase Auth users.
 *
 * Payload:
 *   {
 *     username:    string   — Must match an active customer row (case-insensitive)
 *     password:    string   — Plaintext; compared against bcrypt hash in DB
 *     deviceInfo?: string   — Optional device identifier for the session audit log
 *   }
 *
 * Response 200:
 *   { customer: Customer, sessionToken: string, sessionExpiry: string }
 *
 * Error codes:
 *   MISSING_FIELDS      — username or password absent (400)
 *   INVALID_CREDENTIALS — username not found OR password mismatch (401)
 *   SERVER_ERROR        — DB error or unhandled exception (500)
 *
 * Security notes:
 *   - Returns INVALID_CREDENTIALS for both "not found" and "wrong password" cases
 *     to prevent username enumeration attacks.
 *   - Usernames are unique per-business but can repeat across businesses.
 *     bcrypt.compare is tried on each match until one succeeds.
 *   - Session token is 64-char hex (32 random bytes) — stored in expo-secure-store.
 *   - Sessions expire after 30 days; invalidated_at enables manual logout.
 *
 * TODO: Add brute-force protection — lock the account after N failed attempts per IP.
 * TODO: Accept an optional businessCode to scope username lookup to one business,
 *       preventing timing-based enumeration when the same username exists in multiple.
 */

import { serve }        from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { crypto }       from 'https://deno.land/std@0.168.0/crypto/mod.ts'
import * as bcrypt      from 'https://deno.land/x/bcrypt@v0.4.1/mod.ts'
import { corsResponse, errorResponse, jsonResponse } from '../_shared/cors.ts'

// Full customer columns returned on successful login.
const CUSTOMER_COLS =
  'id, business_owner_id, password_hash, full_name, username, phone_number, email, ' +
  'profile_picture_url, verification_status, verified_at, rejection_reason, ' +
  'pay_later_enabled, first_login_completed, first_login_at, status, created_at, updated_at'

serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse()

  try {
    const { username, password, deviceInfo } = await req.json() as {
      username?:   string
      password?:   string
      deviceInfo?: string
    }
    const clientIp = req.headers.get('x-forwarded-for') ?? 'unknown'

    if (!username || !password) {
      return errorResponse('MISSING_FIELDS', 400)
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Fetch all active customers with this username across all businesses.
    // Usernames are unique per-business so there may be at most one per business,
    // but the same username can appear in multiple businesses.
    const { data: candidates, error: fetchErr } = await supabase
      .from('customers')
      .select(CUSTOMER_COLS)
      .eq('username', username.trim().toLowerCase())
      .eq('status', 'ACTIVE')
      .is('deleted_at', null)

    if (fetchErr) {
      console.error('[authenticate-customer] fetch error:', fetchErr)
      return errorResponse('SERVER_ERROR', 500, fetchErr.message)
    }

    if (!candidates || candidates.length === 0) {
      return errorResponse('INVALID_CREDENTIALS', 401)
    }

    // Try bcrypt.compare against each candidate — stops on first match.
    let matched: Record<string, unknown> | null = null
    for (const c of candidates as Record<string, unknown>[]) {
      if (bcrypt.compareSync(password, c['password_hash'] as string)) {
        matched = c
        break
      }
    }

    if (!matched) {
      return errorResponse('INVALID_CREDENTIALS', 401)
    }

    // Generate a 30-day session token (64-char hex).
    const sessionBytes  = crypto.getRandomValues(new Uint8Array(32))
    const sessionToken  = Array.from(sessionBytes).map((b) => b.toString(16).padStart(2, '0')).join('')
    const sessionExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

    const { error: sessionErr } = await supabase.from('customer_sessions').insert({
      customer_id:   matched['id'],
      session_token: sessionToken,
      login_method:  'PASSWORD',
      ip_address:    clientIp,
      device_info:   deviceInfo ?? null,
      expires_at:    sessionExpiry,
    })

    if (sessionErr) {
      console.error('[authenticate-customer] session insert error:', sessionErr)
      return errorResponse('SERVER_ERROR', 500, sessionErr.message)
    }

    // Map DB row to camelCase Customer shape expected by the React Native client.
    const customer = mapCustomerRow(matched)

    return jsonResponse({ customer, sessionToken, sessionExpiry })

  } catch (err) {
    console.error('[authenticate-customer] unhandled error:', err)
    return errorResponse('SERVER_ERROR', 500, String(err))
  }
})

// ── Helpers ────────────────────────────────────────────────────────────────

function mapCustomerRow(r: Record<string, unknown>): Record<string, unknown> {
  return {
    id:                  String(r['id'] ?? ''),
    businessOwnerId:     String(r['business_owner_id'] ?? ''),
    username:            String(r['username'] ?? ''),
    fullName:            String(r['full_name'] ?? ''),
    phoneNumber:         String(r['phone_number'] ?? ''),
    ...(r['email'] != null ? { email: String(r['email']) } : {}),
    ...(r['profile_picture_url'] != null
      ? { profilePictureUrl: String(r['profile_picture_url']) } : {}),
    verificationStatus:  String(r['verification_status'] ?? 'UNVERIFIED'),
    ...(r['verified_at'] != null ? { verifiedAt: String(r['verified_at']) } : {}),
    ...(r['rejection_reason'] != null ? { rejectionReason: String(r['rejection_reason']) } : {}),
    payLaterEnabled:     Boolean(r['pay_later_enabled']),
    firstLoginCompleted: Boolean(r['first_login_completed']),
    ...(r['first_login_at'] != null ? { firstLoginAt: String(r['first_login_at']) } : {}),
    status:    (r['status'] as string) === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE',
    createdAt: String(r['created_at'] ?? ''),
    updatedAt: String(r['updated_at'] ?? ''),
  }
}
