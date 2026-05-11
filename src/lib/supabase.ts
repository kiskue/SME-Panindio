/**
 * Supabase client — singleton for the entire app.
 *
 * session persistence : AsyncStorage (React Native safe)
 * URL polyfill        : imported in _layout.tsx (must load before this module)
 * fetch               : explicitly bound to globalThis so Supabase uses React
 *                       Native's native fetch instead of its whatwg-fetch
 *                       polyfill — avoids "TypeError: Network request failed"
 *
 * ─── "TypeError: Network request failed" repeating on startup ───────────────
 *
 * Root cause chain:
 *   1. createClient() calls the GoTrueClient constructor, which immediately
 *      calls initialize() without waiting for any external trigger.
 *   2. initialize() → _recoverAndRefresh(): if an expired/near-expiry session
 *      is stored in AsyncStorage from a previous login, it attempts to refresh
 *      the token via POST /auth/v1/token?grant_type=refresh_token.
 *   3. Because React Native is not a browser (isBrowser() = false),
 *      _handleVisibilityChange() also starts the setInterval auto-refresh
 *      ticker immediately after initialize() completes.
 *   4. Every failed HTTP attempt throws "TypeError: Network request failed"
 *      (via whatwg-fetch's xhr.onerror → setTimeout → reject) and the
 *      retryable() loop inside _refreshAccessToken() retries with exponential
 *      back-off (200ms, 400ms, 800ms, …) until the 30-second window closes.
 *   5. This repeats every 30 seconds via the autoRefresh setInterval ticker.
 *
 * Why the HTTP request fails:
 *   The most common cause in development is a PAUSED Supabase free-tier
 *   project. Free-tier projects are automatically paused after 7 days of
 *   inactivity. When paused, the API endpoint (https://<ref>.supabase.co)
 *   is unreachable — TCP connections are refused, which surfaces as
 *   "TypeError: Network request failed" rather than an HTTP error code.
 *
 * Fix checklist (in order):
 *   1. Go to https://supabase.com/dashboard and check if the project is paused.
 *      If it is, click "Restore project" and wait ~30 seconds for it to wake.
 *   2. Verify EXPO_PUBLIC_SUPABASE_URL matches the project ref exactly:
 *      https://<project-ref>.supabase.co  (no trailing slash)
 *   3. Verify EXPO_PUBLIC_SUPABASE_ANON_KEY is the correct anon key for that
 *      project. Get it from: Dashboard → Project Settings → API → anon key.
 *      The key must belong to the SAME project as the URL.
 *   4. After editing .env, restart Metro with `npx expo start --clear` to
 *      force Expo to re-read the environment variables.
 *   5. If the error only appears on a physical device (not simulator), check
 *      that the device has internet connectivity and can reach supabase.co.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

if (__DEV__ && (!supabaseUrl || !supabaseAnonKey)) {
  console.warn(
    '[Supabase] EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY is not set. ' +
      'Auth calls will fail until you add them to your .env file.',
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    /**
     * React Native has no localStorage — AsyncStorage is the correct
     * persistence layer. The Supabase client reads/writes the session
     * here so tokens survive app restarts without us managing them manually.
     */
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    /**
     * detectSessionInUrl must be false for React Native apps; deep-link
     * based OAuth callbacks are handled separately via Linking.
     */
    detectSessionInUrl: false,
  },
  global: {
    /**
     * Force Supabase to use React Native's built-in fetch instead of its
     * bundled whatwg-fetch polyfill. Without this, all HTTP calls throw
     * "TypeError: Network request failed" on physical devices and emulators.
     *
     * Technical detail: `fetch` at module evaluation time resolves through
     * the lazy getter installed by React Native's polyfillGlobal(), so
     * .bind(globalThis) produces a wrapper that correctly delegates to the
     * native XHR-backed implementation at call time.
     */
    fetch: fetch.bind(globalThis),
  },
});
