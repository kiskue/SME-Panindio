export {
  isBiometricAvailable,
  getBiometricLabel,
  getBiometricDescriptor,
  promptBiometric,
} from './biometric.service';
export type { BiometricKind, BiometricDescriptor } from './biometric.service';
export {
  saveBiometricSecret,
  getBiometricSecret,
  deleteBiometricSecret,
} from './biometricSecret';
