/**
 * useBiometricAuth
 * =================
 * The single reusable surface for biometric login, consumed by the login screen
 * and both profile/settings screens. It bridges the device biometric prompt
 * (`@/core/biometric`), the encrypted secret store, and the two auth systems.
 *
 * Design (see plan): tokens-at-rest, login-only, no server changes.
 *   - enroll  → re-verify password live, confirm biometric, store a long-lived
 *               token behind the keychain, flip the reactive enrollment flag.
 *   - login   → biometric prompt → read token → restore session
 *               (owner: POST /auth/refresh; customer: re-use sessionToken).
 *   - disable → wipe secret + flag.
 */

import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import {
  isBiometricAvailable,
  getBiometricAvailability,
  getBiometricLabel,
  promptBiometric,
  saveBiometricSecret,
  getBiometricSecret,
  deleteBiometricSecret,
  type BiometricKind,
  type BiometricAvailability,
} from '@/core/biometric';
import { getRefreshToken } from '@/core/api';
import { authService } from '@/features/auth/services/auth.service';
import {
  authenticateCustomer,
  getSessionToken,
  validateCustomerSession,
} from '@/features/customer/services/customer.service';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { useSukiStore } from '@/features/customer/store/suki.store';
import {
  useBiometricStore,
  selectBusinessEnrolled,
  selectCustomerEnrolled,
} from '@/store/biometric.store';
import type { BiometricAccountType } from '@/types';

export interface BiometricCredentials {
  username: string;
  password: string;
}

export interface BiometricActionResult {
  ok: boolean;
  /** User-facing message when `ok` is false due to a failure (not a cancel). */
  error?: string;
}

/**
 * Device biometric capability. `'checking'` is the transient state before the
 * async capability probe resolves — callers should render nothing (not an
 * "unavailable" notice) while checking, to avoid a flash on capable devices.
 */
export type BiometricStatus = BiometricAvailability | 'checking';

export interface UseBiometricAuth {
  /** Three-state capability: 'checking' → 'ready' | 'not_enrolled' | 'unsupported'. */
  status: BiometricStatus;
  /** Device has biometric hardware + at least one enrolled biometric (status === 'ready'). */
  isAvailable: boolean;
  /** Platform-correct label, e.g. "Face ID" (iOS) / "Fingerprint" (Android). */
  biometricLabel: string;
  /** Underlying modality, so callers pick the right icon (face vs fingerprint). */
  biometricKind: BiometricKind;
  /** Reactive: is this account type currently enrolled on this device? */
  isEnrolled: (accountType: BiometricAccountType) => boolean;
  /** Verify password, confirm biometric, and store the secret. */
  enroll: (
    accountType: BiometricAccountType,
    credentials: BiometricCredentials,
  ) => Promise<BiometricActionResult>;
  /** Remove the stored secret + enrollment flag. */
  disable: (accountType: BiometricAccountType) => Promise<void>;
  /** Prompt biometric and restore the session for an enrolled account. */
  authenticateAndLogin: (
    accountType: BiometricAccountType,
  ) => Promise<BiometricActionResult>;
}

/**
 * Called from the login handlers right after a successful PASSWORD login. If the
 * device supports biometrics and this account is neither enrolled nor already
 * offered, it captures the long-lived token JUST obtained by the login (no
 * password re-entry, no password stored) and stashes a transient offer in the
 * biometric store. The root-mounted BiometricEnrollPrompt then asks the user.
 *
 * Safe to call unconditionally — it self-checks and no-ops when not applicable.
 */
export async function captureAndOfferEnrollment(
  accountType: BiometricAccountType,
): Promise<void> {
  const store = useBiometricStore.getState();
  const alreadyEnrolled =
    accountType === 'business' ? store.businessEnrolled : store.customerEnrolled;
  const alreadyOffered =
    accountType === 'business' ? store.businessOffered : store.customerOffered;
  if (alreadyEnrolled || alreadyOffered) return;
  if (!(await isBiometricAvailable())) return;

  const label = await getBiometricLabel();

  if (accountType === 'business') {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return;
    store.setPendingEnroll({ accountType: 'business', secret: { refreshToken }, label });
    return;
  }

  const sessionToken = await getSessionToken();
  const { currentCustomer: customer, currentSessionExpiry } = useSukiStore.getState();
  if (!sessionToken || !customer) return;
  store.setPendingEnroll({
    accountType: 'customer',
    secret: {
      sessionToken,
      customer,
      ...(currentSessionExpiry ? { expiresAt: currentSessionExpiry } : {}),
    },
    label,
  });
}

/**
 * True only for a definite auth rejection (expired/revoked refresh token), not a
 * transient network/server error — so biometric login never unenrolls on a blip.
 */
function isAuthRejection(err: unknown): boolean {
  const e = err as { status?: number; code?: string } | null;
  return e?.status === 401 || e?.status === 403 || e?.code === 'REFRESH_FAILED';
}

export function useBiometricAuth(): UseBiometricAuth {
  const [status, setStatus] = useState<BiometricStatus>('checking');
  const [biometricLabel, setBiometricLabel] = useState(
    Platform.OS === 'ios' ? 'Face ID' : 'Fingerprint',
  );
  const [biometricKind, setBiometricKind] = useState<BiometricKind>(
    Platform.OS === 'ios' ? 'face' : 'fingerprint',
  );

  const businessEnrolled = useBiometricStore(selectBusinessEnrolled);
  const customerEnrolled = useBiometricStore(selectCustomerEnrolled);
  const setEnrolled = useBiometricStore((s) => s.setEnrolled);
  const setOffered = useBiometricStore((s) => s.setOffered);

  useEffect(() => {
    let active = true;
    void (async () => {
      const result = await getBiometricAvailability();
      if (!active) return;
      setStatus(result.status);
      setBiometricLabel(result.label);
      setBiometricKind(result.kind);
    })();
    return () => {
      active = false;
    };
  }, []);

  const isEnrolled = useCallback(
    (accountType: BiometricAccountType) =>
      accountType === 'business' ? businessEnrolled : customerEnrolled,
    [businessEnrolled, customerEnrolled],
  );

  const disable = useCallback(
    async (accountType: BiometricAccountType) => {
      await deleteBiometricSecret(accountType);
      setEnrolled(accountType, false);
    },
    [setEnrolled],
  );

  const enroll = useCallback(
    async (
      accountType: BiometricAccountType,
      { username, password }: BiometricCredentials,
    ): Promise<BiometricActionResult> => {
      try {
        if (accountType === 'business') {
          const uname = username.trim();
          // When the username is on record, re-verify the password live (confirms
          // identity + rotates to a fresh token pair). Older/restored sessions may
          // not carry a username; in that case the owner is ALREADY authenticated,
          // so we capture the existing valid refresh token and rely on the device
          // biometric prompt below as the gate. This keeps enrollment working
          // regardless of whether user.username was populated.
          if (uname.length >= 3) {
            await authService.login({ username: uname, password });
          }
          const refreshToken = getRefreshToken();
          if (!refreshToken) {
            return {
              ok: false,
              error: 'No active session found. Please sign out, sign in again, then retry.',
            };
          }
          const confirmed = await promptBiometric(`Confirm to enable ${biometricLabel} sign-in`);
          if (!confirmed) return { ok: false, error: 'Biometric confirmation was cancelled.' };
          await saveBiometricSecret('business', { refreshToken });
          setEnrolled('business', true);
          return { ok: true };
        }

        const { customer, sessionToken, sessionExpiry } = await authenticateCustomer(username, password);
        const confirmed = await promptBiometric(`Confirm to enable ${biometricLabel} sign-in`);
        if (!confirmed) return { ok: false, error: 'Biometric confirmation was cancelled.' };
        await saveBiometricSecret('customer', {
          sessionToken,
          customer,
          ...(sessionExpiry ? { expiresAt: sessionExpiry } : {}),
        });
        setEnrolled('customer', true);
        return { ok: true };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : 'Could not enable biometric sign-in.',
        };
      }
    },
    [biometricLabel, setEnrolled],
  );

  const authenticateAndLogin = useCallback(
    async (accountType: BiometricAccountType): Promise<BiometricActionResult> => {
      const ok = await promptBiometric(`Sign in with ${biometricLabel}`);
      // Cancelled / failed prompt: stay on login silently, no error surfaced.
      if (!ok) return { ok: false };

      try {
        if (accountType === 'business') {
          const secret = await getBiometricSecret('business');
          if (!secret?.refreshToken) {
            await disable('business');
            setOffered('business', false);
            return {
              ok: false,
              error: 'Your saved sign-in is no longer valid. Please log in with your password.',
            };
          }
          try {
            await useAuthStore.getState().restoreFromBiometric(secret.refreshToken);
          } catch (err) {
            if (isAuthRejection(err)) {
              // Refresh token genuinely rejected — clear enrollment + re-allow
              // the offer so the next password login re-enrolls a fresh token.
              await disable('business');
              setOffered('business', false);
              return {
                ok: false,
                error: 'Your saved sign-in is no longer valid. Please log in with your password.',
              };
            }
            // Transient network/server error — keep enrollment so the user can retry.
            return {
              ok: false,
              error: 'Couldn’t reach the server. Please check your connection and try again.',
            };
          }
          // Session restored. Best-effort persist of the rotated refresh token;
          // its failure must NOT unenroll a now-valid session.
          try {
            const rotated = getRefreshToken();
            if (rotated && rotated !== secret.refreshToken) {
              await saveBiometricSecret('business', { refreshToken: rotated });
            }
          } catch {
            // keep enrollment intact
          }
          return { ok: true };
        }

        const secret = await getBiometricSecret('customer');
        if (!secret?.sessionToken || !secret.customer) throw new Error('NO_SECRET');
        // The customer session token IS the credential (no refresh endpoint), and
        // it can be expired OR revoked server-side. Check expiry locally first
        // (cheap), then confirm with the backend — otherwise a dead token would
        // "log in" the user but every authed call (e.g. the catalog) would fail.
        if (secret.expiresAt && Date.parse(secret.expiresAt) <= Date.now()) {
          throw new Error('SESSION_EXPIRED');
        }
        const status = await validateCustomerSession(
          secret.customer.id,
          secret.customer.businessOwnerId,
          secret.sessionToken,
        );
        // Only bail on a definite rejection; 'unknown' (network/server blip)
        // proceeds optimistically so we never unenroll on a transient error.
        if (status === 'invalid') throw new Error('SESSION_INVALID');
        await useSukiStore.getState().loginCustomer(
          secret.customer,
          secret.sessionToken,
          secret.expiresAt ?? null,
        );
        return { ok: true };
      } catch {
        // Stored credential is invalid/expired/revoked — clear it, and re-allow
        // the post-login enrollment offer so the next password sign-in can
        // transparently re-enroll a fresh (logout-protected) token.
        await disable(accountType);
        setOffered(accountType, false);
        return {
          ok: false,
          error: 'Your saved sign-in is no longer valid. Please log in with your password.',
        };
      }
    },
    [biometricLabel, disable, setOffered],
  );

  return {
    status,
    isAvailable: status === 'ready',
    biometricLabel,
    biometricKind,
    isEnrolled,
    enroll,
    disable,
    authenticateAndLogin,
  };
}
