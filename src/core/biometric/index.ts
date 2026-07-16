export {
  isBiometricAvailable,
  getBiometricAvailability,
  getBiometricLabel,
  getBiometricDescriptor,
  promptBiometric,
} from './biometric.service';
export type {
  BiometricKind,
  BiometricDescriptor,
  BiometricAvailability,
  BiometricAvailabilityResult,
} from './biometric.service';
export {
  saveBiometricSecret,
  getBiometricSecret,
  deleteBiometricSecret,
} from './biometricSecret';
