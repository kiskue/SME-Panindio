/**
 * Customer Service  (Suki — Customer-Side Module)
 * =================================================
 * Customer-facing Suki calls against the NestJS backend (replaces Supabase
 * Edge Functions + the supabase client).
 *
 * Auth model:
 *   - Customers are NOT JWT users. They authenticate with username + password
 *     and receive an opaque session token, stored in expo-secure-store and sent
 *     in the request body to customer endpoints.
 *   - Password hashing (bcrypt) happens server-side.
 *
 * Login flow (username + password only):
 *   1. Customer enters username + password
 *   2. authenticateCustomer() -> POST /customers/authenticate
 *   3. Backend validates, creates a customer_sessions row, returns { customer, sessionToken }
 *   4. saveSessionToken() writes the token to expo-secure-store
 */

import * as SecureStore from 'expo-secure-store';
import { api, extractApiError } from '@/core/api';
import type { Customer } from '@/types';

/** Key used to persist the customer session token in the device keychain. */
const SECURE_SESSION_KEY = 'suki_customer_session_token';

// ── Types ──────────────────────────────────────────────────────────────────

export interface AuthenticateCustomerResult {
  customer: Customer;
  sessionToken: string;
}

// ── Session Storage ────────────────────────────────────────────────────────

/** Reads the customer session token from the encrypted keychain. Returns null if absent. */
export async function getSessionToken(): Promise<string | null> {
  return SecureStore.getItemAsync(SECURE_SESSION_KEY).catch(() => null);
}

/** Persists the customer session token in the encrypted keychain. */
export async function saveSessionToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(SECURE_SESSION_KEY, token);
}

/** Deletes the customer session token from the encrypted keychain. */
export async function deleteSessionToken(): Promise<void> {
  await SecureStore.deleteItemAsync(SECURE_SESSION_KEY).catch(() => null);
}

// ── Authentication ─────────────────────────────────────────────────────────

/**
 * Authenticates a customer with username + password.
 *
 * Backend (POST /customers/authenticate) looks up the customer, bcrypt-compares
 * the password, creates a session row, and returns the full Customer object plus
 * a fresh session token.
 *
 * Error codes: INVALID_CREDENTIALS, MISSING_FIELDS, SERVER_ERROR.
 */
export async function authenticateCustomer(
  username: string,
  password: string,
): Promise<AuthenticateCustomerResult> {
  try {
    const { data } = await api.post<{ customer: Customer; sessionToken: string; sessionExpiry?: string }>(
      '/customers/authenticate',
      { username, password },
    );

    if (!data.customer || !data.sessionToken) {
      throw new Error('Unexpected response from authentication server.');
    }
    return { customer: data.customer, sessionToken: data.sessionToken };
  } catch (err) {
    const { code, detail } = extractApiError(err);
    const messages: Record<string, string> = {
      INVALID_CREDENTIALS: 'Invalid username or password.',
      MISSING_FIELDS: 'Please fill in all required fields.',
      SERVER_ERROR: 'Server error. Please try again later.',
      NETWORK_ERROR: 'Network error. Please check your connection.',
    };
    const base = messages[code] ?? `Login failed: ${code}`;
    throw new Error(detail ? `${base} (${detail})` : base);
  }
}

// ── Session Management ─────────────────────────────────────────────────────

/**
 * Marks the customer session as invalidated on the backend.
 * Non-critical: if this fails, the session expires naturally after 30 days.
 * Always also delete the local secure-store token regardless of outcome.
 */
export async function invalidateSession(sessionToken: string): Promise<void> {
  try {
    await api.post('/customers/logout', { sessionToken });
  } catch (err) {
    const { code } = extractApiError(err);
    console.warn('[CustomerService] Session invalidation failed:', code);
  }
}

// ── Profile Updates ────────────────────────────────────────────────────────

/**
 * Updates a customer's username and/or password.
 * Requires a valid session token to authorize the change server-side.
 */
export async function updateCustomerCredentials(
  customerId: string,
  sessionToken: string,
  username: string,
  password: string,
): Promise<void> {
  try {
    await api.patch('/customers/credentials', {
      customerId,
      sessionToken,
      username,
      password,
    });
  } catch (err) {
    const { code, detail } = extractApiError(err);
    const messages: Record<string, string> = {
      SESSION_EXPIRED: 'Your session has expired. Please log in again.',
      UNAUTHORIZED: 'You are not allowed to perform this action.',
      USERNAME_TAKEN: 'That username is already taken.',
    };
    throw new Error(messages[code] ?? detail ?? code);
  }
}
