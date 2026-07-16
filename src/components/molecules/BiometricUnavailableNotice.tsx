/**
 * BiometricUnavailableNotice
 * ==========================
 * Inline callout shown in place of the biometric-login toggle when the device
 * can't use it — so the user understands WHY the toggle isn't there instead of
 * seeing blank space (e.g. Samsung Galaxy A06 with no enrolled fingerprint/face).
 *
 * Instructional text only (no action button, per product decision): opening the
 * OS settings page lands on app-info, not the enrollment screen, so we just tell
 * the user where to go. Reuses the `Alert` molecule for the visual.
 *
 * Render nothing for 'ready' and never pass 'checking' here — the caller gates on
 * a resolved status so capable devices don't flash this notice on first mount.
 */

import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { Fingerprint, ScanFace } from 'lucide-react-native';
import { Alert } from './Alert';
import { theme } from '../../core/theme';
import type { BiometricAvailability, BiometricKind } from '@/core/biometric';

export interface BiometricUnavailableNoticeProps {
  /** From useBiometricAuth/useBiometricToggle. 'ready' renders null. */
  status: BiometricAvailability;
  /** Platform-correct label, e.g. "Fingerprint" / "Face ID". */
  label: string;
  /** Underlying modality, so the icon matches the device. */
  kind: BiometricKind;
  style?: StyleProp<ViewStyle>;
}

export const BiometricUnavailableNotice: React.FC<BiometricUnavailableNoticeProps> = ({
  status,
  label,
  kind,
  style,
}) => {
  if (status === 'ready') return null;

  const Icon = kind === 'fingerprint' ? Fingerprint : ScanFace;

  if (status === 'not_enrolled') {
    return (
      <Alert
        variant="info"
        size="sm"
        icon={<Icon size={18} color={theme.colors.info[600]} />}
        message={
          `${label} isn't set up on this phone yet. Open your phone's Settings ` +
          `→ Security to add a fingerprint or face, then come back here to ` +
          `turn on ${label} login.`
        }
        style={style}
      />
    );
  }

  // 'unsupported' — no biometric hardware Expo can use.
  return (
    <Alert
      variant="info"
      size="sm"
      icon={<Icon size={18} color={theme.colors.info[600]} />}
      message="Biometric login isn't available on this device. You can keep signing in with your username and password."
      style={style}
    />
  );
};
