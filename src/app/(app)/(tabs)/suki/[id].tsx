import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Switch, Image } from 'react-native';
import { Text } from '@/components/atoms/Text';
import { Card } from '@/components/atoms/Card';
import { Button } from '@/components/atoms/Button';
import { Avatar } from '@/components/atoms/Avatar';
import { Input } from '@/components/atoms/Input';
import { SectionHeader, InfoRow, StatusBadge, EmptyState, LoadingSpinner } from '@/components/molecules';
import { BottomSheet } from '@/components/organisms/BottomSheet';
import { UserX } from 'lucide-react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { api } from '@/core/api';
import {
  useSukiBusinessStore,
  selectSelectedCustomer,
  selectSukiBusinessLoading,
  selectSukiBusinessError,
} from '@/store';
import { useAppTheme, useThemeMode } from '@/core/theme';
import { verificationStatusColor } from '@/core/theme/statusColors';
import { formatLongDate } from '@/core/utils/date';
import { useAppDialog } from '@/hooks';

/**
 * Resolve a short-lived signed URL for a customer document path.
 * GET /customers/:id/documents/signed-url?path=... (owner JWT required).
 */
async function getSignedUrl(customerId: string, path: string): Promise<string | null> {
  try {
    const { data } = await api.get<{ url?: string }>(
      `/customers/${customerId}/documents/signed-url`,
      { params: { path } },
    );
    return data?.url ?? null;
  } catch {
    return null;
  }
}

export default function SukiCustomerDetailScreen() {
  const router = useRouter();
  const dialog = useAppDialog();
  const theme = useAppTheme();
  const isDark = useThemeMode() === 'dark';

  const { id } = useLocalSearchParams<{ id: string }>();
  const customer = useSukiBusinessStore(selectSelectedCustomer);
  const isLoading = useSukiBusinessStore(selectSukiBusinessLoading);
  const error = useSukiBusinessStore(selectSukiBusinessError);
  const { loadCustomerDetail, approveCustomer, rejectCustomer, togglePayLater } = useSukiBusinessStore();

  const [idSignedUrl, setIdSignedUrl] = useState<string | null>(null);
  const [selfieSignedUrl, setSelfieSignedUrl] = useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    if (id) void loadCustomerDetail(id);
  }, [id, loadCustomerDetail]);

  useEffect(() => {
    if (customer?.idDocument && id) {
      if (customer.idDocument.idFrontPath) {
        getSignedUrl(id, customer.idDocument.idFrontPath).then(setIdSignedUrl);
      }
      if (customer.idDocument.selfiePath) {
        getSignedUrl(id, customer.idDocument.selfiePath).then(setSelfieSignedUrl);
      }
    }
  }, [customer?.idDocument, id]);

  const handleApprove = () => {
    dialog.confirm({
      title: 'Approve Customer',
      message: `Approve ${customer?.fullName} as a verified Suki?`,
      confirmText: 'Approve',
      onConfirm: () => id && void approveCustomer(id),
    });
  };

  // Cross-platform reject flow. `Alert.prompt` is iOS-only (it silently no-ops on
  // Android), so capture the optional reason in a themed bottom sheet instead.
  const confirmReject = async () => {
    setRejectOpen(false);
    if (id) await rejectCustomer(id, rejectReason.trim());
    setRejectReason('');
  };

  const handlePayLaterToggle = (val: boolean) => {
    if (id) void togglePayLater(id, val);
  };

  if (isLoading && !customer) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <LoadingSpinner color={theme.colors.tintPrimary} />
      </View>
    );
  }

  if (!customer) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <EmptyState
          size="md"
          title="Customer not found"
          description={error ?? 'This customer may no longer be available.'}
          icon={<UserX size={28} color={theme.colors.textSecondary} />}
          action={{ label: 'Go Back', onPress: () => router.back(), variant: 'outline' }}
        />
      </View>
    );
  }

  const badge = verificationStatusColor(customer.verificationStatus, isDark);
  const isPending = customer.verificationStatus === 'PENDING';
  const isUnverified = customer.verificationStatus === 'UNVERIFIED';

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Profile hero */}
        <Card variant="elevated" padding="lg" borderRadius="lg">
          <View style={styles.profileRow}>
            <Avatar initials={customer.fullName.charAt(0).toUpperCase()} size="lg" />
            <View style={styles.profileInfo}>
              <Text variant="h5" weight="bold" numberOfLines={1} style={{ color: theme.colors.text }}>
                {customer.fullName}
              </Text>
              <Text variant="body-sm" style={{ color: theme.colors.textSecondary }}>@{customer.username}</Text>
              <StatusBadge
                size="md"
                label={customer.verificationStatus}
                backgroundColor={badge.bg}
                textColor={badge.text}
                style={styles.profileBadge}
              />
            </View>
          </View>
        </Card>

        {/* Contact */}
        <View style={styles.section}>
          <SectionHeader title="Contact" />
          <Card variant="elevated" padding="md" borderRadius="lg">
            <InfoRow label="Phone" value={customer.phoneNumber} />
            {!!customer.email && <InfoRow label="Email" value={customer.email} />}
            <InfoRow label="Joined" value={formatLongDate(customer.createdAt)} />
            {!!customer.firstLoginAt && <InfoRow label="First Login" value={formatLongDate(customer.firstLoginAt)} />}
          </Card>
        </View>

        {/* Pay Later */}
        <View style={styles.section}>
          <SectionHeader title="Pay Later Access" />
          <Card variant="elevated" padding="md" borderRadius="lg">
            <View style={styles.toggleRow}>
              <View style={styles.toggleText}>
                <Text variant="body" weight="medium" style={{ color: theme.colors.text }}>Enable Pay Later</Text>
                <Text variant="body-xs" style={{ color: theme.colors.textSecondary }}>
                  {customer.verificationStatus === 'VERIFIED'
                    ? 'Customer can use credit on orders.'
                    : 'Requires VERIFIED status first.'}
                </Text>
              </View>
              <Switch
                value={customer.payLaterEnabled}
                onValueChange={handlePayLaterToggle}
                disabled={customer.verificationStatus !== 'VERIFIED'}
                trackColor={{ false: theme.colors.border, true: theme.colors.accent[500] }}
                thumbColor="#FFFFFF"
                accessibilityLabel="Enable Pay Later for this customer"
              />
            </View>
          </Card>
        </View>

        {/* Verification documents */}
        {(idSignedUrl || selfieSignedUrl || customer.idDocument) && (
          <View style={styles.section}>
            <SectionHeader title="Verification Documents" />
            <Card variant="elevated" padding="md" borderRadius="lg">
              {idSignedUrl && (
                <View style={styles.docRow}>
                  <Text variant="body-sm" weight="medium" style={[styles.docLabel, { color: theme.colors.textSecondary }]}>
                    Government ID
                  </Text>
                  <Image
                    source={{ uri: idSignedUrl }}
                    style={[styles.docImage, { backgroundColor: theme.colors.surfaceSubtle }]}
                    resizeMode="contain"
                    accessibilityLabel="Government ID document"
                  />
                </View>
              )}
              {selfieSignedUrl && (
                <View style={styles.docRow}>
                  <Text variant="body-sm" weight="medium" style={[styles.docLabel, { color: theme.colors.textSecondary }]}>
                    Selfie
                  </Text>
                  <Image
                    source={{ uri: selfieSignedUrl }}
                    style={[styles.docImage, { backgroundColor: theme.colors.surfaceSubtle }]}
                    resizeMode="cover"
                    accessibilityLabel="Customer selfie"
                  />
                </View>
              )}
              {customer.idDocument?.ocrFullName && (
                <InfoRow label="Name on ID" value={customer.idDocument.ocrFullName} />
              )}
              {customer.idDocument?.ocrIdNumber && (
                <InfoRow label="ID Number" value={customer.idDocument.ocrIdNumber} />
              )}
              <InfoRow
                label="Liveness Check"
                value={customer.idDocument?.livenessPassed ? 'Passed' : 'Not completed'}
              />
            </Card>
          </View>
        )}

        {/* Verification actions */}
        {(isUnverified || isPending) && (
          <View style={styles.section}>
            <SectionHeader title="Verification Action" />
            <Card variant="elevated" padding="md" borderRadius="lg">
              <Text variant="body-sm" style={[styles.actionHint, { color: theme.colors.textSecondary }]}>
                {isPending
                  ? 'Review the submitted ID and selfie above, then approve or reject this customer.'
                  : 'Verify this customer to grant them access to orders and Pay Later.'}
              </Text>
              <View style={styles.actionRow}>
                <Button title="Verify Customer" variant="primary" tone="success" onPress={handleApprove} style={styles.flexBtn} />
                <Button title="Reject" variant="outline" tone="danger" onPress={() => setRejectOpen(true)} style={styles.flexBtn} />
              </View>
            </Card>
          </View>
        )}

        {/* Verified note */}
        {customer.verificationStatus === 'VERIFIED' && (
          <View style={styles.section}>
            <SectionHeader title="Verification Status" />
            <Card variant="elevated" padding="md" borderRadius="lg">
              <Text variant="body-sm" style={{ color: theme.colors.tintAccent }}>
                ✓ This customer is verified. They can place orders and use Pay Later if enabled.
              </Text>
            </Card>
          </View>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Reject reason — cross-platform (replaces iOS-only Alert.prompt) */}
      <BottomSheet
        visible={rejectOpen}
        onClose={() => setRejectOpen(false)}
        title="Reject Verification"
        footer={
          <View style={styles.sheetFooter}>
            <Button title="Cancel" variant="outline" onPress={() => setRejectOpen(false)} style={styles.flexBtn} />
            <Button title="Reject" variant="primary" tone="danger" onPress={() => void confirmReject()} style={styles.flexBtn} />
          </View>
        }
      >
        <Text variant="body-sm" style={[styles.sheetHint, { color: theme.colors.textSecondary }]}>
          Add an optional reason. The customer will need to resubmit their verification.
        </Text>
        <Input
          value={rejectReason}
          onChangeText={setRejectReason}
          placeholder="Reason (optional)"
          multiline
          numberOfLines={3}
          accessibilityLabel="Rejection reason"
        />
      </BottomSheet>

      {dialog.Dialog}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  scroll: { padding: 16, gap: 12 },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  profileInfo: { flex: 1, gap: 2 },
  profileBadge: { marginTop: 2 },
  section: { gap: 8 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  toggleText: { flex: 1, gap: 2 },
  docRow: { marginBottom: 12 },
  docLabel: { marginBottom: 6 },
  docImage: { width: '100%', height: 180, borderRadius: 10 },
  actionHint: { marginBottom: 12 },
  actionRow: { flexDirection: 'row', gap: 12 },
  flexBtn: { flex: 1 },
  sheetHint: { marginBottom: 10 },
  sheetFooter: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24 },
  bottomSpacer: { height: 16 },
});
