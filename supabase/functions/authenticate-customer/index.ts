import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as bcrypt from 'https://deno.land/x/bcrypt@v0.4.1/mod.ts'
import { crypto } from 'https://deno.land/std@0.168.0/crypto/mod.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS })
  }
 
  try {
    const { businessCode, username, password, deviceInfo } = await req.json() as {
      businessCode?: string
      username?: string
      password?: string
      deviceInfo?: string
    }
    const clientIp = req.headers.get('x-forwarded-for') ?? 'unknown'

    if (!businessCode || !username || !password) {
      return new Response(
        JSON.stringify({ error: 'MISSING_FIELDS' }),
        { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } },
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Resolve business_owner_id from the 8-char code.
    // Returning INVALID_CREDENTIALS (not INVALID_BUSINESS_CODE) to prevent
    // business code enumeration attacks.
    const { data: bizCode } = await supabase
      .from('business_codes')
      .select('business_owner_id')
      .eq('code', businessCode.toUpperCase())
      .single()

    if (!bizCode) {
      return new Response(
        JSON.stringify({ error: 'INVALID_CREDENTIALS' }),
        { status: 401, headers: { ...CORS, 'Content-Type': 'application/json' } },
      )
    }

    // Fetch customer — scope by business to prevent cross-business username collisions.
    // Include business_owner_id so the client can query the correct catalog partition
    // without a second round-trip.
    const { data: customer } = await supabase
      .from('customers')
      .select(
        'id, business_owner_id, password_hash, full_name, username, phone_number, email, ' +
        'profile_picture_url, verification_status, verified_at, rejection_reason, ' +
        'pay_later_enabled, first_login_completed, first_login_at, status, created_at, updated_at',
      )
      .eq('business_owner_id', bizCode.business_owner_id)
      .eq('username', username)
      .eq('status', 'ACTIVE')
      .is('deleted_at', null)
      .single()

    if (!customer) {
      // Same error as wrong password — prevents username enumeration.
      return new Response(
        JSON.stringify({ error: 'INVALID_CREDENTIALS' }),
        { status: 401, headers: { ...CORS, 'Content-Type': 'application/json' } },
      )
    }

    const c = customer as Record<string, unknown>

    // Enforce QR first-login requirement.
    if (!c['first_login_completed']) {
      return new Response(
        JSON.stringify({ error: 'QR_LOGIN_REQUIRED' }),
        { status: 403, headers: { ...CORS, 'Content-Type': 'application/json' } },
      )
    }

    const passwordMatch = await bcrypt.compare(password, c['password_hash'] as string)
    if (!passwordMatch) {
      return new Response(
        JSON.stringify({ error: 'INVALID_CREDENTIALS' }),
        { status: 401, headers: { ...CORS, 'Content-Type': 'application/json' } },
      )
    }

    // Generate session token (30 days).
    const sessionBytes = crypto.getRandomValues(new Uint8Array(32))
    const sessionToken = Array.from(sessionBytes).map(b => b.toString(16).padStart(2, '0')).join('')
    const sessionExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

    await supabase.from('customer_sessions').insert({
      customer_id: c['id'],
      session_token: sessionToken,
      login_method: 'PASSWORD',
      ip_address: clientIp,
      device_info: deviceInfo ?? null,
      expires_at: sessionExpiry,
    })

    // Map to camelCase Customer interface (omit password_hash).
    const customerPublic = {
      id: String(c['id'] ?? ''),
      businessOwnerId: String(c['business_owner_id'] ?? ''),
      username: String(c['username'] ?? ''),
      fullName: String(c['full_name'] ?? ''),
      phoneNumber: String(c['phone_number'] ?? ''),
      ...(c['email'] != null ? { email: String(c['email']) } : {}),
      ...(c['profile_picture_url'] != null
        ? { profilePictureUrl: String(c['profile_picture_url']) }
        : {}),
      verificationStatus: String(c['verification_status'] ?? 'UNVERIFIED'),
      ...(c['verified_at'] != null ? { verifiedAt: String(c['verified_at']) } : {}),
      ...(c['rejection_reason'] != null ? { rejectionReason: String(c['rejection_reason']) } : {}),
      payLaterEnabled: Boolean(c['pay_later_enabled']),
      firstLoginCompleted: Boolean(c['first_login_completed']),
      ...(c['first_login_at'] != null ? { firstLoginAt: String(c['first_login_at']) } : {}),
      status: (c['status'] as string) === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE',
      createdAt: String(c['created_at'] ?? ''),
      updatedAt: String(c['updated_at'] ?? ''),
    }

    return new Response(
      JSON.stringify({ customer: customerPublic, sessionToken, sessionExpiry }),
      { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('authenticate-customer unhandled error:', err)
    return new Response(
      JSON.stringify({ error: 'SERVER_ERROR' }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } },
    )
  }
})
