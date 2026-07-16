import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TextInput } from 'react-native';
import { LogOut, Moon, Sun, Fingerprint, ScanFace } from 'lucide-react-native';
import { Text } from '@/components/atoms/Text';
import { Button } from '@/components/atoms/Button/Button';
import { Card } from '@/components/atoms/Card';
import { Switch } from '@/components/atoms/Switch';
import { ThemeToggle } from '@/components/atoms/ThemeToggle';
import { Avatar } from '@/components/atoms/Avatar';
import { Divider } from '@/components/atoms/Divider';
import { InfoRow } from '@/components/molecules/InfoRow';
import { StatusBadge } from '@/components/molecules/StatusBadge';
import { StatusTimeline, type StatusTimelineStep } from '@/components/molecules/StatusTimeline';
import { BiometricUnavailableNotice } from '@/components/molecules/BiometricUnavailableNotice';
import { useAppDialog } from '@/hooks';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useSukiStore, selectCurrentCustomer, selectSukiLoading } from '@/store';
import { useBiometricToggle } from '@/hooks';
import { useThemeMode, useAppTheme } from '@/core/theme';
import { verificationStatusColor } from '@/core/theme/statusColors';
import { CustomerHeader } from '@/features/customer/components/CustomerHeader';
import { CartButton } from '@/features/customer/components/CartButton';
import { CUSTOMER_TAB_BAR_HEIGHT } from '@/features/customer/constants/tabBar';
import type { CustomerVerificationStatus } from '@/types';

const VERIFICATION_STEPS: { label: string; desc: string }[] = [
  { label: '1. Upload ID', desc: 'Photo of your government ID' },
  { label: '2. Selfie & Liveness', desc: 'Face detection to confirm identity' },
  { label: '3. Business Approval', desc: 'Awaiting merchant verification' },
];

/** Maps the verification status onto the active step index of the 3-step timeline. */
function verificationStepIndex(status: CustomerVerificationStatus): number {
  switch (status) {
    case 'UNVERIFIED':
    case 'REJECTED':
      return 0;
    case 'PENDING':
      return 1;
    case 'VERIFIED':
      return 3; // all three steps complete
    default:
      return 0;
  }
}

const PILL_LABEL: Record<CustomerVerificationStatus, string> = {
  UNVERIFIED: 'Unverified',
  PENDING: 'Pending',
  VERIFIED: 'Verified',
  REJECTED: 'Rejected',
};

function initialsOf(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : '';
  return (first + last).toUpperCase() || '?';
}

export default function CustomerProfileScreen() {
  const router = useRouter();
  const dialog = useAppDialog();
  const isDark = useThemeMode() === 'dark';
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const bottomSpacer = CUSTOMER_TAB_BAR_HEIGHT + insets.bottom + 16;

  const customer = useSukiStore(selectCurrentCustomer);
  const isLoading = useSukiStore(selectSukiLoading);
  // Select actions individually: Zustand action identities are stable, so this
  // avoids re-rendering the whole screen on every unrelated suki state change
  // (which a full `useSukiStore()` subscription would do).
  const updateCustomerCredentials = useSukiStore((s) => s.updateCustomerCredentials);
  const logoutCustomer = useSukiStore((s) => s.logoutCustomer);

  // Biometric enable/disable controller (password-gated enroll). Called before
  // the early return below so hook order stays stable.
  const biometric = useBiometricToggle('customer', customer?.username ?? '');

  const [editMode, setEditMode] = useState(false);
  const [newUsername, setNewUsername] = useState(customer?.username ?? '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  if (!customer) return null;

  const handleSaveCredentials = async () => {
    if (newPassword && newPassword.length < 8) {
      dialog.show({ variant: 'error', title: 'Invalid password', message: 'Password must be at least 8 characters.' });
      return;
    }
    if (newPassword && newPassword !== confirmPassword) {
      dialog.show({ variant: 'error', title: 'Mismatch', message: 'Passwords do not match.' });
      return;
    }
    if (!newUsername.trim() || newUsername.trim().length < 4) {
      dialog.show({ variant: 'error', title: 'Invalid username', message: 'Username must be at least 4 characters.' });
      return;
    }
    await updateCustomerCredentials(newUsername.trim(), newPassword || customer.username);
    const state = useSukiStore.getState();
    if (!state.error) {
      setEditMode(false);
      setNewPassword('');
      setConfirmPassword('');
      dialog.show({ variant: 'success', title: 'Saved', message: 'Your credentials have been updated.' });
    }
  };

  const handleLogout = () => {
    if (isLoggingOut) return; // guard against rapid double-taps while in flight
    // Reuse the shared confirm dialog (same pattern as the business sign-out in
    // AppDrawer / the owner profile). Logout only runs on confirm.
    dialog.confirm({
      title:       'Sign Out',
      message:     'Are you sure you want to sign out?',
      confirmText: 'Sign Out',
      cancelText:  'Cancel',
      onConfirm: async () => {
        setIsLoggingOut(true);
        await logoutCustomer(); // offline-first: never throws or hangs
        // No explicit navigation: clearing isCustomerLoggedIn flips the root
        // <Stack.Protected> guard, which removes the (customer) group and lets the
        // index anchor forward to /(auth)/login (same path as business logout).
        // Doing both caused the login screen to double-mount/flicker.
      },
    });
  };

  const verStatus = customer.verificationStatus;
  const canGoToId = verStatus === 'UNVERIFIED' || verStatus === 'REJECTED';
  const canGoToLiveness = verStatus === 'PENDING';
  const pillColor = verificationStatusColor(verStatus, isDark);
  const currentStep = verificationStepIndex(verStatus);

  // ── Dynamic tokens ────────────────────────────────────────────────────────────
  const rootBg = isDark ? theme.colors.background : '#F0F4F8';
  const inputBg = isDark ? '#1E2435' : '#FFFFFF';
  const inputBorder = theme.colors.border;
  const dividerColor = isDark ? 'rgba(255,255,255,0.07)' : '#F0F4F8';

  // Trailing "Start" actions for the verification timeline steps.
  const timelineSteps: StatusTimelineStep[] = VERIFICATION_STEPS.map((step, index) => {
    let trailing: React.ReactNode;
    if (index === 0 && canGoToId) {
      trailing = (
        <Button title="Start" size="sm" onPress={() => router.push('/(customer)/verify-id')} />
      );
    } else if (index === 1 && canGoToLiveness) {
      trailing = (
        <Button title="Start" size="sm" onPress={() => router.push('/(customer)/verify-liveness')} />
      );
    }
    return {
      label: step.label,
      description: step.desc,
      ...(trailing !== undefined ? { trailing } : {}),
    };
  });

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: rootBg }]} edges={['top']}>
      <StatusBar style="light" />

      <CustomerHeader title="My Profile" rightAction={<CartButton />} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Identity card */}
        <Card variant="elevated" shadow="sm" style={styles.card}>
          <View style={styles.identityRow}>
            <Avatar size="lg" initials={initialsOf(customer.fullName)} />
            <View style={styles.identityText}>
              <Text variant="h6" weight="bold" style={{ color: theme.colors.text }} numberOfLines={1}>
                {customer.fullName}
              </Text>
              <Text variant="body-sm" color="textSecondary" numberOfLines={1}>
                @{customer.username}
              </Text>
            </View>
          </View>

          <Divider color={dividerColor} spacing="md" />

          <InfoRow label="Phone" value={customer.phoneNumber} />
          {customer.email ? <InfoRow label="Email" value={customer.email} /> : null}

          <View style={styles.editToggleWrap}>
            <Button
              title={editMode ? 'Cancel' : 'Edit Credentials'}
              variant="ghost"
              size="sm"
              onPress={() => setEditMode((e) => !e)}
            />
          </View>

          {editMode && (
            <View style={styles.editForm}>
              <Text variant="body-xs" weight="semibold" style={[styles.fieldLabel, { color: theme.colors.primary[500] }]}>
                New Username
              </Text>
              <TextInput
                style={[styles.input, { backgroundColor: inputBg, borderColor: inputBorder, color: theme.colors.text }]}
                value={newUsername}
                onChangeText={setNewUsername}
                autoCapitalize="none"
                placeholder="At least 4 characters"
                placeholderTextColor={theme.colors.placeholder}
              />
              <Text variant="body-xs" weight="semibold" style={[styles.fieldLabel, { color: theme.colors.primary[500] }]}>
                New Password
              </Text>
              <TextInput
                style={[styles.input, { backgroundColor: inputBg, borderColor: inputBorder, color: theme.colors.text }]}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                placeholder="Leave blank to keep current"
                placeholderTextColor={theme.colors.placeholder}
              />
              <Text variant="body-xs" weight="semibold" style={[styles.fieldLabel, { color: theme.colors.primary[500] }]}>
                Confirm New Password
              </Text>
              <TextInput
                style={[styles.input, { backgroundColor: inputBg, borderColor: inputBorder, color: theme.colors.text }]}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                placeholder="Repeat new password"
                placeholderTextColor={theme.colors.placeholder}
              />
              <Button
                title="Save Changes"
                fullWidth
                loading={isLoading}
                onPress={handleSaveCredentials}
                style={styles.saveBtn}
              />
            </View>
          )}
        </Card>

        {/* Verification card */}
        <Card variant="elevated" shadow="sm" style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text variant="h6" weight="bold" style={{ color: theme.colors.text }}>
              Identity Verification
            </Text>
            <StatusBadge size="md" label={PILL_LABEL[verStatus]} backgroundColor={pillColor.bg} textColor={pillColor.text} />
          </View>

          {verStatus === 'REJECTED' && customer.rejectionReason && (
            <View style={[styles.rejectedBox, { backgroundColor: isDark ? 'rgba(239,68,68,0.08)' : '#FEF2F2' }]}>
              <Text variant="body-xs" style={{ color: isDark ? '#FF6B6B' : '#991B1B' }}>
                Rejected: {customer.rejectionReason}. Please re-submit your ID.
              </Text>
            </View>
          )}

          <View style={styles.timelineWrap}>
            <StatusTimeline steps={timelineSteps} currentIndex={currentStep} />
          </View>
        </Card>

        {/* Appearance — customer-scoped theme toggle */}
        <Card variant="elevated" shadow="sm" style={styles.card}>
          <View style={styles.appearanceRow}>
            <View style={[styles.appearanceIcon, { backgroundColor: theme.colors.surfaceSubtle }]}>
              {isDark
                ? <Moon size={18} color={theme.colors.tintPrimary} />
                : <Sun size={18} color={theme.colors.tintPrimary} />}
            </View>
            <View style={styles.appearanceText}>
              <Text variant="body-sm" weight="semibold" style={{ color: theme.colors.text }}>
                Dark Mode
              </Text>
              <Text variant="body-xs" color="textSecondary">
                Easier on the eyes at night
              </Text>
            </View>
            <ThemeToggle accessibilityLabel="Toggle dark mode" />
          </View>
        </Card>

        {/* Security — biometric login. Show the toggle when ready; explain why
            it's unavailable (no hardware / not enrolled) instead of hiding it.
            Render nothing while the capability probe is still 'checking'. */}
        {biometric.status === 'ready' ? (
          <Card variant="elevated" shadow="sm" style={styles.card}>
            <View style={styles.appearanceRow}>
              <View style={[styles.appearanceIcon, { backgroundColor: theme.colors.surfaceSubtle }]}>
                {biometric.biometricKind === 'fingerprint'
                  ? <Fingerprint size={18} color={theme.colors.tintPrimary} />
                  : <ScanFace size={18} color={theme.colors.tintPrimary} />}
              </View>
              <View style={styles.appearanceText}>
                <Text variant="body-sm" weight="semibold" style={{ color: theme.colors.text }}>
                  {biometric.biometricLabel} Login
                </Text>
                <Text variant="body-xs" color="textSecondary">
                  Sign in faster on this device
                </Text>
              </View>
              <Switch
                value={biometric.enabled}
                onValueChange={biometric.requestToggle}
                disabled={biometric.busy}
              />
            </View>
          </Card>
        ) : biometric.status === 'checking' ? null : (
          <BiometricUnavailableNotice
            status={biometric.status}
            label={biometric.biometricLabel}
            kind={biometric.biometricKind}
            style={styles.card}
          />
        )}

        {/* Sign Out */}
        <View style={styles.signOutWrap}>
          <Button
            title="Sign Out"
            onPress={handleLogout}
            variant="outline"
            fullWidth
            loading={isLoggingOut}
            disabled={isLoggingOut}
            leftIcon={<LogOut size={18} color={theme.colors.primary[500]} style={styles.signOutIcon} />}
          />
        </View>

        <View style={{ height: bottomSpacer }} />
      </ScrollView>
      {dialog.Dialog}
      {biometric.element}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 0 },

  card: { marginBottom: 16 },

  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  identityText: { flex: 1 },

  editToggleWrap: {
    alignItems: 'flex-start',
    marginTop: 4,
  },

  editForm: { marginTop: 4 },
  fieldLabel: { marginTop: 10, marginBottom: 4 },
  input: {
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
  },
  saveBtn: { marginTop: 14 },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  rejectedBox: {
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  timelineWrap: { marginTop: 4 },

  appearanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  appearanceIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appearanceText: { flex: 1 },

  signOutWrap: { marginTop: 4 },
  signOutIcon: { marginRight: 8 },
});
