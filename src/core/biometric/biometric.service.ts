/**
 * Biometric Service  (device-local, account-agnostic)
 * =====================================================
 * Thin wrapper over `expo-local-authentication`. Knows nothing about the two
 * auth systems — it only reports device capability and runs the OS biometric
 * prompt (Face ID on iOS, fingerprint/face on Android).
 *
 * Secret storage lives in `./biometricSecret.ts`; session restore lives in the
 * per-system stores. This file is the only place that imports the native module.
 */

import { Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';

/** The kind of biometric a device uses — drives icon + copy selection in the UI. */
export type BiometricKind = 'face' | 'fingerprint' | 'iris';

export interface BiometricDescriptor {
  /** Platform-correct display name, e.g. "Face ID" (iOS), "Fingerprint" (Android). */
  label: string;
  /** Underlying modality, so the UI can pick the right icon reliably. */
  kind: BiometricKind;
}

/**
 * True when the device has biometric hardware AND the user has enrolled at
 * least one biometric in the OS. Both are required for `authenticateAsync` to
 * use biometrics rather than silently falling back.
 */
export async function isBiometricAvailable(): Promise<boolean> {
  try {
    const [hasHardware, isEnrolled] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
    ]);
    return hasHardware && isEnrolled;
  } catch {
    return false;
  }
}

/**
 * Three-state device capability, for UI that needs to explain WHY biometrics is
 * unavailable rather than just hiding the control:
 *   - 'unsupported'  → no biometric hardware (or none Expo can use).
 *   - 'not_enrolled' → hardware present, but no fingerprint/face enrolled in the OS.
 *   - 'ready'        → hardware present AND at least one biometric enrolled.
 *
 * `isBiometricAvailable()` above is intentionally kept as the simple `ready`
 * boolean for the login/enroll hot paths; this richer variant powers the
 * settings/profile "unavailable" notice. We deliberately do NOT consult
 * `getEnrolledLevelAsync()` / SecurityLevel: `promptBiometric` accepts WEAK
 * biometrics, so gating on STRONG would report `not_enrolled` for devices whose
 * biometric would actually work.
 */
export type BiometricAvailability = 'ready' | 'not_enrolled' | 'unsupported';

export interface BiometricAvailabilityResult {
  status: BiometricAvailability;
  /** Platform-correct label, e.g. "Face ID" / "Fingerprint" — usable in all states. */
  label: string;
  /** Underlying modality, so the UI can pick the right icon. */
  kind: BiometricKind;
}

export async function getBiometricAvailability(): Promise<BiometricAvailabilityResult> {
  const isIOS = Platform.OS === 'ios';
  try {
    const [hasHardware, isEnrolled, descriptor] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
      getBiometricDescriptor(),
    ]);
    const status: BiometricAvailability = !hasHardware
      ? 'unsupported'
      : !isEnrolled
        ? 'not_enrolled'
        : 'ready';
    return { status, label: descriptor.label, kind: descriptor.kind };
  } catch {
    return {
      status: 'unsupported',
      label: isIOS ? 'Face ID' : 'Fingerprint',
      kind: isIOS ? 'face' : 'fingerprint',
    };
  }
}

/**
 * Resolve the platform-correct label + modality for the device's biometric.
 *
 * Terminology is OS-specific: iOS uses Apple's "Face ID" / "Touch ID"; Android
 * uses generic "Fingerprint" / "Face Unlock". We also prioritise per the
 * platform's primary modality (fingerprint-first on Android, face-first on iOS)
 * and fall back to the platform default so copy is never wrong.
 */
export async function getBiometricDescriptor(): Promise<BiometricDescriptor> {
  const isIOS = Platform.OS === 'ios';
  try {
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    const hasFace = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
    const hasFingerprint = types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT);
    const hasIris = types.includes(LocalAuthentication.AuthenticationType.IRIS);

    if (isIOS) {
      if (hasFace) return { label: 'Face ID', kind: 'face' };
      if (hasFingerprint) return { label: 'Touch ID', kind: 'fingerprint' };
    } else {
      if (hasFingerprint) return { label: 'Fingerprint', kind: 'fingerprint' };
      if (hasFace) return { label: 'Face Unlock', kind: 'face' };
    }
    if (hasIris) return { label: 'Iris scan', kind: 'iris' };
  } catch {
    // fall through to platform default
  }
  // Default to each platform's primary modality so the label is still sensible.
  return isIOS ? { label: 'Face ID', kind: 'face' } : { label: 'Fingerprint', kind: 'fingerprint' };
}

/**
 * Convenience: just the platform-correct label (e.g. "Face ID" / "Fingerprint").
 */
export async function getBiometricLabel(): Promise<string> {
  return (await getBiometricDescriptor()).label;
}

/**
 * Runs the OS biometric prompt. Returns true only on a successful match.
 * `disableDeviceFallback` is false so users can fall back to their device
 * passcode if biometrics fail repeatedly.
 */
export async function promptBiometric(promptMessage: string): Promise<boolean> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      disableDeviceFallback: false,
      cancelLabel: 'Cancel',
    });
    return result.success;
  } catch {
    return false;
  }
}
