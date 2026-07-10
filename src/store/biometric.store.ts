/**
 * Biometric Store
 * ================
 * Reactive, persisted ENROLLMENT FLAGS only — one per auth system. The actual
 * secrets (refresh token / session token) live in the encrypted keychain via
 * `@/core/biometric` and are never kept here or in AsyncStorage.
 *
 * Also holds a TRANSIENT "pending enroll offer" (the in-memory secret captured
 * right after a password login, awaiting the user's "Enable biometric?" answer).
 * This field is deliberately EXCLUDED from `partialize` so a secret never lands
 * in AsyncStorage.
 *
 * UI (login screen, both profile screens, the root enroll prompt) subscribes to
 * this store to decide what to show.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  BiometricAccountType,
  BusinessBiometricSecret,
  CustomerBiometricSecret,
} from '@/types';

/**
 * A captured-but-not-yet-confirmed enrollment. Discriminated by accountType so
 * the secret is correctly typed without casts at the save site.
 */
export type PendingEnroll =
  | { accountType: 'business'; secret: BusinessBiometricSecret; label: string }
  | { accountType: 'customer'; secret: CustomerBiometricSecret; label: string };

interface BiometricState {
  businessEnrolled: boolean;
  customerEnrolled: boolean;
  /** Whether we've already offered enrollment once (don't nag every login). */
  businessOffered: boolean;
  customerOffered: boolean;
  /** Transient (never persisted): a post-login offer awaiting the user's answer. */
  pendingEnroll: PendingEnroll | null;

  setEnrolled: (accountType: BiometricAccountType, value: boolean) => void;
  setOffered: (accountType: BiometricAccountType, value: boolean) => void;
  setPendingEnroll: (pending: PendingEnroll | null) => void;
}

export const useBiometricStore = create<BiometricState>()(
  persist(
    (set) => ({
      businessEnrolled: false,
      customerEnrolled: false,
      businessOffered: false,
      customerOffered: false,
      pendingEnroll: null,

      setEnrolled: (accountType, value) =>
        set(
          accountType === 'business'
            ? { businessEnrolled: value }
            : { customerEnrolled: value },
        ),

      setOffered: (accountType, value) =>
        set(
          accountType === 'business'
            ? { businessOffered: value }
            : { customerOffered: value },
        ),

      setPendingEnroll: (pending) => set({ pendingEnroll: pending }),
    }),
    {
      name: 'biometric-prefs',
      storage: createJSONStorage(() => AsyncStorage),
      // Persist ONLY the boolean flags — never the transient secret.
      partialize: (state) => ({
        businessEnrolled: state.businessEnrolled,
        customerEnrolled: state.customerEnrolled,
        businessOffered: state.businessOffered,
        customerOffered: state.customerOffered,
      }),
    },
  ),
);

// ── Selectors ──────────────────────────────────────────────────────────────

export const selectBusinessEnrolled = (s: BiometricState) => s.businessEnrolled;
export const selectCustomerEnrolled = (s: BiometricState) => s.customerEnrolled;
export const selectPendingEnroll = (s: BiometricState) => s.pendingEnroll;

/** Reactive enrollment flag for the given account type. */
export const selectBiometricEnrolled =
  (accountType: BiometricAccountType) => (s: BiometricState) =>
    accountType === 'business' ? s.businessEnrolled : s.customerEnrolled;
