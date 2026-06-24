import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
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
    const { token, deviceInfo } = await req.json()
    const clientIp = req.headers.get('x-forwarded-for') ?? 'unknown'

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'MISSING_TOKEN' }),
        { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } },
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Atomic consume via PostgreSQL function (SELECT FOR UPDATE prevents double-scan)
    const { data, error } = await supabase.rpc('consume_qr_token', {
      p_token: token,
      p_ip: clientIp,
      p_device: deviceInfo ?? null,
    })

    if (error) {
      return new Response(
        JSON.stringify({ error: 'SERVER_ERROR', detail: error.message }),
        { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } },
      )
    }

    // consume_qr_token returns: { result: 'OK'|'NOT_FOUND'|'ALREADY_USED'|'EXPIRED', customer_id: uuid|null }
    const result = data as { result: string; customer_id: string | null }
    if (result.result !== 'OK') {
      const statusMap: Record<string, number> = {
        NOT_FOUND: 404, ALREADY_USED: 409, EXPIRED: 410,
      }
      return new Response(
        JSON.stringify({ error: result.result }),
        { status: statusMap[result.result] ?? 400, headers: { ...CORS, 'Content-Type': 'application/json' } },
      )
    }

    const customerId = result.customer_id!

    // Mark first login complete
    await supabase
      .from('customers')
      .update({ first_login_completed: true, first_login_at: new Date().toISOString() })
      .eq('id', customerId)

    // Generate session token
    const sessionBytes = crypto.getRandomValues(new Uint8Array(32))
    const sessionToken = Array.from(sessionBytes).map(b => b.toString(16).padStart(2, '0')).join('')
    const sessionExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days

    await supabase.from('customer_sessions').insert({
      customer_id: customerId,
      session_token: sessionToken,
      login_method: 'QR_SCAN',
      ip_address: clientIp,
      device_info: deviceInfo ?? null,
      expires_at: sessionExpiry,
    })
 
    // Fetch the full customer profile — include business_owner_id so the
    // customer app can query the correct online_catalog partition without
    // needing an additional round-trip.
    const { data: customer } = await supabase
      .from('customers')
      .select(
        'id, business_owner_id, full_name, username, phone_number, email, ' +
        'profile_picture_url, verification_status, verified_at, rejection_reason, ' +
        'pay_later_enabled, first_login_completed, first_login_at, status, created_at, updated_at',
      )
      .eq('id', customerId)
      .single()
    // Map snake_case DB columns to the camelCase Customer interface expected
    // by the React Native client so the store can persist it directly.
    const customerRow = customer as Record<string, unknown> | null
    const mappedCustomer = customerRow
      ? {
          id: String(customerRow['id'] ?? ''),
          businessOwnerId: String(customerRow['business_owner_id'] ?? ''),
          username: String(customerRow['username'] ?? ''),
          fullName: String(customerRow['full_name'] ?? ''),
          phoneNumber: String(customerRow['phone_number'] ?? ''),
          ...(customerRow['email'] != null ? { email: String(customerRow['email']) } : {}),
          ...(customerRow['profile_picture_url'] != null
            ? { profilePictureUrl: String(customerRow['profile_picture_url']) }
            : {}),
          verificationStatus: String(customerRow['verification_status'] ?? 'UNVERIFIED'),
          ...(customerRow['verified_at'] != null ? { verifiedAt: String(customerRow['verified_at']) } : {}),
          ...(customerRow['rejection_reason'] != null
            ? { rejectionReason: String(customerRow['rejection_reason']) }
            : {}),
          payLaterEnabled: Boolean(customerRow['pay_later_enabled']),
          firstLoginCompleted: Boolean(customerRow['first_login_completed']),
          ...(customerRow['first_login_at'] != null
            ? { firstLoginAt: String(customerRow['first_login_at']) }
            : {}),
          status: (customerRow['status'] as string) === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE',
          createdAt: String(customerRow['created_at'] ?? ''),
          updatedAt: String(customerRow['updated_at'] ?? ''),
        }
      : null

    return new Response(
      JSON.stringify({ customer: mappedCustomer, sessionToken, sessionExpiry }),
      { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('consume-customer-qr unhandled error:', err)
    return new Response(
      JSON.stringify({ error: 'SERVER_ERROR' }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } },
    )
  }
})
