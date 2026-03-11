/**
 * Supabase client — singleton for the entire app.
 *
 * session persistence : AsyncStorage (React Native safe)
 * URL polyfill        : imported in _layout.tsx (must load before this module)
 * fetch               : explicitly bound to globalThis so Supabase uses React
 *                       Native's native fetch instead of its whatwg-fetch
 *                       polyfill — avoids "TypeError: Network request failed"
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
     */
    fetch: fetch.bind(globalThis),
  },
});
