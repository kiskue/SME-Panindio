---
name: Supabase Network Request Failed Repeating on Startup
description: TypeError: Network request failed fires multiple times on app start due to Supabase auto-refresh ticker on stale/expired session with paused project
type: project
---

The repeating `TypeError: Network request failed (whatwg-fetch/dist/fetch.umd.js, setTimeout$argument_0)` on startup is caused by the Supabase GoTrueClient internal auto-refresh loop, NOT by any app code.

**Exact chain:**
1. `createClient()` in `src/lib/supabase.ts` calls the GoTrueClient constructor.
2. Constructor calls `this.initialize()` immediately (fires async, does not await).
3. `initialize()` → `_recoverAndRefresh()`: if an expired session is in AsyncStorage, it calls `POST /auth/v1/token?grant_type=refresh_token`.
4. Because React Native is not a browser (`isBrowser() = false`), `_handleVisibilityChange()` calls `startAutoRefresh()` immediately after init, starting a `setInterval` every 30 seconds.
5. `_refreshAccessToken()` uses `retryable()` with exponential back-off (200ms, 400ms, 800ms…) up to 30 seconds — each attempt logs `console.error`.
6. Session is NOT removed from AsyncStorage when the error is `AuthRetryableFetchError` (network error), so the cycle repeats every 30 seconds.

**Root cause of the unreachable endpoint:**
- Free-tier Supabase projects pause after 7 days of inactivity → TCP refused → `TypeError: Network request failed`
- OR the `.env` credentials point to a different project than the one that issued the session

**Fix:**
1. Go to https://supabase.com/dashboard and restore the paused project.
2. Verify `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` in `.env` are correct and match the same active project.
3. Restart Metro with `npx expo start --clear` after editing `.env`.

**Key detail:** `whatwg-fetch` IS React Native's fetch — installed by `polyfillGlobal('fetch', () => require('../Network/fetch').fetch)` in `react-native/Libraries/Core/setUpXHR.js`. The error trace showing `whatwg-fetch` is expected; it does NOT indicate the wrong fetch implementation is being used.

**Why:** `fetch.bind(globalThis)` in `supabase.ts` correctly captures the lazy-resolved native fetch via the polyfillGlobal getter. The error is about network reachability, not fetch implementation.
