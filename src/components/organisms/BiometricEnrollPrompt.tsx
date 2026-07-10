/**
 * BiometricEnrollPrompt
 * ======================
 * Mounted once at the root (a sibling of the navigator, OUTSIDE the route
 * groups) so it survives the (auth) → (app)/(customer) transition that unmounts
 * the login screen the instant the auth flag flips.
 *
 * When a password login stashes a `pendingEnroll` offer in the biometric store
 * (see `captureAndOfferEnrollment`), this asks "Enable Face ID / fingerprint?"
 * On confirm it runs the OS biometric prompt and, if it passes, persists the
 * already-captured token behind the keychain and flips the enrollment flag.
 *
 * It offers each account at most once (the offer setter also marks it offered).
 */

import React, { useEffect } from 'react';
import { promptBiometric, saveBiometricSecret } from '@/core/biometric';
import { useAppDialog } from '@/hooks/useAppDialog';
import { useBiometricStore, selectPendingEnroll } from '@/store/biometric.store';

export const BiometricEnrollPrompt: React.FC = () => {
  const dialog = useAppDialog();
  const pending = useBiometricStore(selectPendingEnroll);
  const setPendingEnroll = useBiometricStore((s) => s.setPendingEnroll);
  const setEnrolled = useBiometricStore((s) => s.setEnrolled);
  const setOffered = useBiometricStore((s) => s.setOffered);

  useEffect(() => {
    if (!pending) return;
    const { accountType, label } = pending;

    // Mark offered up front so a decline (or backgrounding) never re-prompts.
    setOffered(accountType, true);

    dialog.confirm({
      title: `Enable ${label} sign-in?`,
      message: `Use ${label} to sign in next time instead of typing your password.`,
      confirmText: 'Enable',
      cancelText: 'Not now',
      onConfirm: async () => {
        const ok = await promptBiometric(`Confirm to enable ${label} sign-in`);
        if (ok) {
          if (pending.accountType === 'business') {
            await saveBiometricSecret('business', pending.secret);
          } else {
            await saveBiometricSecret('customer', pending.secret);
          }
          setEnrolled(accountType, true);
        }
        setPendingEnroll(null);
      },
      onCancel: () => setPendingEnroll(null),
    });
    // Only re-run when a new offer arrives. `dialog.confirm`, setters are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  return <>{dialog.Dialog}</>;
};
