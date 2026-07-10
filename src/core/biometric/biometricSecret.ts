/**
 * Biometric Secret Storage
 * =========================
 * Persists the long-lived credential that a biometric unlock restores, in the
 * encrypted device keychain (`expo-secure-store`). One key per auth system.
 *
 * Mirrors the get/save/delete wrapper shape used for the customer session token
 * in `customer.service.ts`. Secrets NEVER touch AsyncStorage; only the boolean
 * enrollment flags do (see `biometric.store.ts`).
 *
 * Payloads:
 *   business  → { refreshToken }
 *   customer  → { sessionToken, customer }
 */

import * as SecureStore from 'expo-secure-store';
import { APP_CONSTANTS } from '@/core/constants';
import type {
  BiometricAccountType,
  BusinessBiometricSecret,
  CustomerBiometricSecret,
} from '@/types';

type SecretFor<T extends BiometricAccountType> = T extends 'business'
  ? BusinessBiometricSecret
  : CustomerBiometricSecret;

function keyFor(accountType: BiometricAccountType): string {
  return accountType === 'business'
    ? APP_CONSTANTS.BIOMETRIC_BUSINESS_SECRET_KEY
    : APP_CONSTANTS.BIOMETRIC_CUSTOMER_SECRET_KEY;
}

/** Writes the biometric secret for an account type to the keychain. */
export async function saveBiometricSecret<T extends BiometricAccountType>(
  accountType: T,
  payload: SecretFor<T>,
): Promise<void> {
  await SecureStore.setItemAsync(keyFor(accountType), JSON.stringify(payload));
}

/** Reads + parses the biometric secret, or null if absent/corrupt. */
export async function getBiometricSecret<T extends BiometricAccountType>(
  accountType: T,
): Promise<SecretFor<T> | null> {
  try {
    const raw = await SecureStore.getItemAsync(keyFor(accountType));
    if (!raw) return null;
    return JSON.parse(raw) as SecretFor<T>;
  } catch {
    return null;
  }
}

/** Removes the biometric secret for an account type. */
export async function deleteBiometricSecret(
  accountType: BiometricAccountType,
): Promise<void> {
  await SecureStore.deleteItemAsync(keyFor(accountType)).catch(() => undefined);
}
