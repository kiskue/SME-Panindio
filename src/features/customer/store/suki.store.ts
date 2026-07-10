/**
 * Customer Store  (Suki — Customer-Side)
 * ========================================
 * Manages the logged-in customer's session state.
 *
 * What this store does:
 *   - Stores the current Customer profile and login flag in memory (Zustand)
 *   - Persists { currentCustomer, isCustomerLoggedIn } to AsyncStorage for
 *     app-restart hydration (non-sensitive — no tokens here)
 *   - Delegates all Supabase calls to `customer.service.ts` (service layer)
 *   - Session token is stored in expo-secure-store (AES-256 encrypted keychain)
 *     via the service layer — never in AsyncStorage or Zustand state
 *
 * Login method: username + password ONLY.
 * QR-based login has been removed. See customer.service.ts for the auth flow.
 *
 * TODO: Add a `refreshCustomerProfile()` action to re-fetch the Customer object
 *       from the DB so stale profile data (e.g. verificationStatus) is kept fresh.
 * TODO: Expose a `getSessionToken()` helper for other stores that need to attach
 *       the customer session to Edge Function calls (e.g. online_orders.store.ts).
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Customer } from '@/types';
import {
  authenticateCustomer,
  invalidateSession,
  saveSessionToken,
  getSessionToken,
  deleteSessionToken,
  updateCustomerCredentials,
} from '@/features/customer/services/customer.service';
import { getBiometricSecret } from '@/core/biometric';
import { useBiometricStore } from '@/store/biometric.store';

// ── State & Actions ────────────────────────────────────────────────────────

interface SukiState {
  currentCustomer: Customer | null;
  isCustomerLoggedIn: boolean;
  /** ISO expiry of the active session token (used to seed biometric enrollment). */
  currentSessionExpiry: string | null;
  isLoading: boolean;
  error: string | null;
}

interface SukiActions {
  /** Persists the session token securely and marks the customer as logged in. */
  loginCustomer: (
    customer: Customer,
    sessionToken: string,
    sessionExpiry?: string | null,
  ) => Promise<void>;

  /** Invalidates the session server-side, clears secure store, and resets state. */
  logoutCustomer: () => Promise<void>;

  /** Authenticates with username + password and calls loginCustomer on success. */
  authenticateCustomer: (username: string, password: string) => Promise<void>;

  /** Updates the customer's username and password server-side. */
  updateCustomerCredentials: (username: string, password: string) => Promise<void>;

  clearError: () => void;
}

export type SukiStore = SukiState & SukiActions;

// ── Initial State ──────────────────────────────────────────────────────────

const initialState: SukiState = {
  currentCustomer: null,
  isCustomerLoggedIn: false,
  currentSessionExpiry: null,
  isLoading: false,
  error: null,
};

// ── Store ──────────────────────────────────────────────────────────────────

export const useSukiStore = create<SukiStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      loginCustomer: async (customer, sessionToken, sessionExpiry = null) => {
        await saveSessionToken(sessionToken);
        set({
          currentCustomer: customer,
          isCustomerLoggedIn: true,
          currentSessionExpiry: sessionExpiry,
          error: null,
        });
      },

      logoutCustomer: async () => {
        // Offline-first: clear the local session immediately so logout never
        // hangs or fails when the server is unreachable. Server-side
        // invalidation is best-effort (non-critical — the session expires
        // naturally after 30 days) and self-catches its own errors, so it is
        // fired-and-forgotten rather than awaited.
        const sessionToken = await getSessionToken();
        await deleteSessionToken();
        set({ ...initialState });

        // Don't invalidate the token reserved for biometric re-login — otherwise
        // the next biometric sign-in restores a dead session and the catalog
        // (POST /catalog/for-customer, which validates the session) fails to load.
        // Fail SAFE: if biometric is enrolled but the secret can't be read, skip
        // invalidation rather than risk revoking the biometric session. Other
        // (non-biometric) sessions are still revoked normally.
        let preserveForBiometric = false;
        if (sessionToken && useBiometricStore.getState().customerEnrolled) {
          const secret = await getBiometricSecret('customer');
          preserveForBiometric = !secret || secret.sessionToken === sessionToken;
        }
        if (sessionToken && !preserveForBiometric) {
          void invalidateSession(sessionToken);
        }
      },

      authenticateCustomer: async (username, password) => {
        set({ isLoading: true, error: null });
        try {
          const { customer, sessionToken, sessionExpiry } = await authenticateCustomer(username, password);
          await get().loginCustomer(customer, sessionToken, sessionExpiry);
          set({ isLoading: false });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Network error. Please try again.';
          console.error('[SukiStore] authenticateCustomer:', message);
          set({ isLoading: false, error: message });
        }
      },

      updateCustomerCredentials: async (username, password) => {
        const customer = get().currentCustomer;
        if (!customer) return;

        set({ isLoading: true, error: null });
        try {
          const sessionToken = await getSessionToken();
          if (!sessionToken) throw new Error('No active session. Please log in again.');

          await updateCustomerCredentials(customer.id, sessionToken, username, password);
          set({ currentCustomer: { ...customer, username }, isLoading: false });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Update failed. Please try again.';
          set({ isLoading: false, error: message });
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'suki-customer-session',
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist non-sensitive profile data.
      // The session token lives in expo-secure-store (see customer.service.ts).
      partialize: (state) => ({
        currentCustomer: state.currentCustomer,
        isCustomerLoggedIn: state.isCustomerLoggedIn,
      }),
    },
  ),
);

// ── Selectors ──────────────────────────────────────────────────────────────

export const selectCurrentCustomer    = (s: SukiStore) => s.currentCustomer;
export const selectIsCustomerLoggedIn = (s: SukiStore) => s.isCustomerLoggedIn;
export const selectSukiLoading        = (s: SukiStore) => s.isLoading;
export const selectSukiError          = (s: SukiStore) => s.error;
