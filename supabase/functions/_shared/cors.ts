/**
 * Shared CORS headers for all Supabase Edge Functions.
 *
 * Every function must return these headers on OPTIONS pre-flight requests
 * and on all real responses so the React Native app (and any browser-based
 * testing tools) can reach the function.
 *
 * Usage:
 *   import { CORS, corsResponse } from '../_shared/cors.ts'
 *
 *   serve(async (req) => {
 *     if (req.method === 'OPTIONS') return corsResponse()
 *     return new Response(body, { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } })
 *   })
 */

export const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export const JSON_HEADERS: Record<string, string> = {
  ...CORS,
  'Content-Type': 'application/json',
};

/** Returns the standard 200 OK response for OPTIONS pre-flight requests. */
export function corsResponse(): Response {
  return new Response('ok', { headers: CORS });
}

/** Returns a JSON error response with CORS headers included. */
export function errorResponse(
  code: string,
  status: number,
  detail?: string,
): Response {
  return new Response(
    JSON.stringify({ error: code, ...(detail ? { detail } : {}) }),
    { status, headers: JSON_HEADERS },
  );
}

/** Returns a JSON success response with CORS headers included. */
export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}
