/**
 * useBiometricToggle
 * ===================
 * Reusable controller for the "enable/disable biometric login" toggle that
 * appears on BOTH the customer profile and business settings screens. It owns
 * the password-confirmation Modal and the disable-confirmation dialog, so each
 * screen only renders its own native toggle row in its local style and drops in
 * the returned `element`.
 *
 * Follows the same "returns an element to render" convention as `useAppDialog`.
 *
 * Enabling requires the account password (verified live by `enroll`), matching
 * the requirement that the first link is password-gated.
 */

import React, { useCallback, useState } from 'react';
import { Modal } from '@/components/organisms/Modal';
import { Input } from '@/components/atoms';
import { useAppDialog } from './useAppDialog';
import { useBiometricAuth } from './useBiometricAuth';
import type { BiometricKind } from '@/core/biometric';
import type { BiometricAccountType } from '@/types';

export interface UseBiometricToggle {
  /** Device supports biometrics — hide the whole row when false. */
  isAvailable: boolean;
  /** Whether this account is currently enrolled (reactive). */
  enabled: boolean;
  /** Platform-correct label, e.g. "Face ID" / "Fingerprint" — for row copy. */
  biometricLabel: string;
  /** Underlying modality so the row picks the right icon (face vs fingerprint). */
  biometricKind: BiometricKind;
  /** Enrollment in progress (password being verified). */
  busy: boolean;
  /** Call from the row's switch: true → password modal, false → confirm + disable. */
  requestToggle: (next: boolean) => void;
  /** Render once in the screen tree (password Modal + dialog). */
  element: React.ReactNode;
}

export function useBiometricToggle(
  accountType: BiometricAccountType,
  username: string,
): UseBiometricToggle {
  const dialog = useAppDialog();
  const { isAvailable, isEnrolled, biometricLabel, biometricKind, enroll, disable } =
    useBiometricAuth();
  const enabled = isEnrolled(accountType);

  const [modalVisible, setModalVisible] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const closeModal = useCallback(() => {
    setModalVisible(false);
    setPassword('');
  }, []);

  const submit = useCallback(async () => {
    if (!password.trim()) {
      dialog.show({
        variant: 'error',
        title: 'Password required',
        message: 'Please enter your password to continue.',
      });
      return;
    }
    setBusy(true);
    try {
      const result = await enroll(accountType, { username, password });
      if (result.ok) {
        closeModal();
        dialog.show({
          variant: 'success',
          title: 'Biometric sign-in enabled',
          message: `You can now sign in with ${biometricLabel}.`,
        });
      } else if (result.error) {
        dialog.show({ variant: 'error', title: 'Could not enable', message: result.error });
      }
    } finally {
      setBusy(false);
    }
  }, [password, enroll, accountType, username, biometricLabel, closeModal, dialog]);

  const requestToggle = useCallback(
    (next: boolean) => {
      if (next) {
        setPassword('');
        setModalVisible(true);
      } else {
        dialog.confirm({
          title: 'Disable biometric sign-in?',
          message: `You'll need your password to sign in until you re-enable ${biometricLabel}.`,
          confirmText: 'Disable',
          cancelText: 'Cancel',
          onConfirm: async () => {
            await disable(accountType);
          },
        });
      }
    },
    [dialog, biometricLabel, disable, accountType],
  );

  const element = (
    <>
      <Modal
        visible={modalVisible}
        onClose={closeModal}
        title="Confirm your password"
        primaryAction={{
          label: `Enable ${biometricLabel}`,
          onPress: () => {
            void submit();
          },
          loading: busy,
        }}
        secondaryAction={{ label: 'Cancel', onPress: closeModal }}
      >
        <Input
          label="Password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          placeholder="Enter your password"
          autoCapitalize="none"
          autoCorrect={false}
        />
      </Modal>
      {dialog.Dialog}
    </>
  );

  return { isAvailable, enabled, biometricLabel, biometricKind, busy, requestToggle, element };
}
