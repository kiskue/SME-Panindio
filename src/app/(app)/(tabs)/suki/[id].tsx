import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Switch,
  Image,
} from 'react-native';
import { Text } from '@/components/atoms/Text';
import { useLocalSearchParams } from 'expo-router';
import { api } from '@/core/api';
import { useSukiBusinessStore, selectSelectedCustomer, selectSukiBusinessLoading } from '@/store';
import { useAppTheme, useThemeMode } from '@/core/theme';
import { theme as staticTheme } from '@/core/theme';
import { verificationStatusColor } from '@/core/theme/statusColors';
import { StatusBadge } from '@/components/molecules/StatusBadge';
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
  const dialog = useAppDialog();
  const appTheme = useAppTheme();
  const mode = useThemeMode();
  const isDark = mode === 'dark';

  const { id } = useLocalSearchParams<{ id: string }>();
  const customer = useSukiBusinessStore(selectSelectedCustomer);
  const isLoading = useSukiBusinessStore(selectSukiBusinessLoading);
  const { loadCustomerDetail, approveCustomer, rejectCustomer, togglePayLater } = useSukiBusinessStore();
  const [idSignedUrl, setIdSignedUrl] = useState<string | null>(null);
  const [selfieSignedUrl, setSelfieSignedUrl] = useState<string | null>(null);

  useEffect(() => {
    if (id) loadCustomerDetail(id);
  }, [id]);

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
      onConfirm: () => id && approveCustomer(id),
    });
  };

  const handleReject = () => {
    Alert.prompt?.(
      'Reject Verification',
      'Reason for rejection (optional):',
      async (reason) => {
        if (id) await rejectCustomer(id, reason ?? '');
      },
      'plain-text',
      '',
    );
  };

  const handlePayLaterToggle = async (val: boolean) => {
    if (id) await togglePayLater(id, val);
  };

  // ── Dynamic tokens ────────────────────────────────────────────────────────────
  const rootBg      = isDark ? '#0F1117' : '#F0F4F8';
  const headerBg    = isDark ? '#151A27' : appTheme.colors.primary[500];
  const cardBg      = isDark ? '#1A2235' : '#FFFFFF';
  const cardBorder  = isDark ? 'rgba(255,255,255,0.07)' : 'transparent';
  const primaryColor = isDark ? '#4F9EFF' : appTheme.colors.primary[500];
  const accentColor  = isDark ? '#3DD68C' : appTheme.colors.accent[500];
  const nameColor: string   = isDark ? '#F1F5F9' : '#FFFFFF';
  const usernameColor: string = isDark ? 'rgba(255,255,255,0.60)' : 'rgba(255,255,255,0.70)';
  const textPrimary: string = isDark ? '#F1F5F9' : '#111111';
  const textSecondary: string = isDark ? 'rgba(255,255,255,0.55)' : staticTheme.colors.textSecondary;
  const dividerColor: string  = isDark ? 'rgba(255,255,255,0.07)' : '#F0F4F8';
  const sectionTitleColor: string = isDark ? 'rgba(255,255,255,0.45)' : staticTheme.colors.textSecondary;
  const docImageBg   = isDark ? '#1E2435' : '#F0F4F8';
  const avatarBg     = isDark ? 'rgba(79,158,255,0.20)' : 'rgba(255,255,255,0.2)';
  const avatarBorder = isDark ? 'rgba(79,158,255,0.40)' : 'rgba(255,255,255,0.4)';

  if (isLoading || !customer) {
    return (
      <View style={[styles.loading, { backgroundColor: rootBg }]}>
        <ActivityIndicator color={primaryColor} size="large" />
      </View>
    );
  }

  const badge = verificationStatusColor(customer.verificationStatus, isDark);

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: rootBg }]}
      contentContainerStyle={styles.scroll}
    >
      {/* Header */}
      <View style={[styles.header, { backgroundColor: headerBg }]}>
        <View style={styles.headerProfile}>
          <View style={[styles.bigAvatar, { backgroundColor: avatarBg, borderColor: avatarBorder }]}>
            <Text style={styles.bigAvatarText}>{customer.fullName.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.customerName, { color: nameColor }]}>{customer.fullName}</Text>
            <Text style={[styles.customerUsername, { color: usernameColor }]}>@{customer.username}</Text>
            <StatusBadge
              size="md"
              label={customer.verificationStatus}
              backgroundColor={badge.bg}
              textColor={badge.text}
            />
          </View>
        </View>
      </View>

      {/* Profile info */}
      <Section title="Contact" titleColor={sectionTitleColor} cardBg={cardBg} cardBorder={cardBorder}>
        <InfoRow label="Phone" value={customer.phoneNumber} textPrimary={textPrimary} textSecondary={textSecondary} dividerColor={dividerColor} />
        {!!customer.email && <InfoRow label="Email" value={customer.email} textPrimary={textPrimary} textSecondary={textSecondary} dividerColor={dividerColor} />}
        <InfoRow label="Joined" value={new Date(customer.createdAt).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })} textPrimary={textPrimary} textSecondary={textSecondary} dividerColor={dividerColor} />
        {!!customer.firstLoginAt && (
          <InfoRow label="First Login" value={new Date(customer.firstLoginAt).toLocaleDateString('en-PH')} textPrimary={textPrimary} textSecondary={textSecondary} dividerColor={dividerColor} isLast />
        )}
      </Section>

      {/* Pay Later toggle */}
      <Section title="Pay Later Access" titleColor={sectionTitleColor} cardBg={cardBg} cardBorder={cardBorder}>
        <View style={styles.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.toggleLabel, { color: textPrimary }]}>Enable Pay Later</Text>
            <Text style={[styles.toggleHint, { color: textSecondary }]}>
              {customer.verificationStatus === 'VERIFIED'
                ? 'Customer can use credit on orders.'
                : 'Requires VERIFIED status first.'}
            </Text>
          </View>
          <Switch
            value={customer.payLaterEnabled}
            onValueChange={handlePayLaterToggle}
            disabled={customer.verificationStatus !== 'VERIFIED'}
            trackColor={{ false: isDark ? '#374151' : '#E5E7EB', true: accentColor }}
            thumbColor="#FFFFFF"
          />
        </View>
      </Section>

      {/* Verification documents */}
      {(idSignedUrl || selfieSignedUrl || customer.idDocument) && (
        <Section title="Verification Documents" titleColor={sectionTitleColor} cardBg={cardBg} cardBorder={cardBorder}>
          {idSignedUrl && (
            <View style={styles.docRow}>
              <Text style={[styles.docLabel, { color: textSecondary }]}>Government ID</Text>
              <Image source={{ uri: idSignedUrl }} style={[styles.docImage, { backgroundColor: docImageBg }]} resizeMode="contain" />
            </View>
          )}
          {selfieSignedUrl && (
            <View style={styles.docRow}>
              <Text style={[styles.docLabel, { color: textSecondary }]}>Selfie</Text>
              <Image source={{ uri: selfieSignedUrl }} style={[styles.docImage, { backgroundColor: docImageBg }]} resizeMode="cover" />
            </View>
          )}
          {customer.idDocument?.ocrFullName && (
            <InfoRow label="Name on ID" value={customer.idDocument.ocrFullName} textPrimary={textPrimary} textSecondary={textSecondary} dividerColor={dividerColor} />
          )}
          {customer.idDocument?.ocrIdNumber && (
            <InfoRow label="ID Number" value={customer.idDocument.ocrIdNumber} textPrimary={textPrimary} textSecondary={textSecondary} dividerColor={dividerColor} />
          )}
          <InfoRow label="Liveness Check" value={customer.idDocument?.livenessPassed ? '✓ Passed' : '✗ Not completed'} textPrimary={textPrimary} textSecondary={textSecondary} dividerColor={dividerColor} isLast />
        </Section>
      )}

      {/* Verification actions */}
      {(customer.verificationStatus === 'UNVERIFIED' || customer.verificationStatus === 'PENDING') && (
        <Section title="Verification Action" titleColor={sectionTitleColor} cardBg={cardBg} cardBorder={cardBorder}>
          <Text style={[styles.actionHint, { color: textSecondary }]}>
            {customer.verificationStatus === 'PENDING'
              ? 'Review the submitted ID and selfie above, then approve or reject this customer.'
              : 'Verify this customer to grant them access to orders and Pay Later.'}
          </Text>
          <View style={styles.actionRow}>
            <TouchableOpacity style={[styles.approveBtn, { backgroundColor: accentColor }]} onPress={handleApprove} activeOpacity={0.85}>
              <Text style={styles.approveBtnText}>Verify Customer</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.rejectBtn, {
                backgroundColor: isDark ? 'rgba(239,68,68,0.08)' : '#FEF2F2',
                borderColor: isDark ? 'rgba(239,68,68,0.25)' : '#FECACA',
              }]}
              onPress={handleReject}
              activeOpacity={0.85}
            >
              <Text style={[styles.rejectBtnText, { color: isDark ? '#FF6B6B' : '#B91C1C' }]}>Reject</Text>
            </TouchableOpacity>
          </View>
        </Section>
      )}

      {/* Verified note */}
      {customer.verificationStatus === 'VERIFIED' && (
        <Section title="Verification Status" titleColor={sectionTitleColor} cardBg={cardBg} cardBorder={cardBorder}>
          <Text style={[styles.actionHint, { color: isDark ? '#3DD68C' : '#065F46' }]}>
            ✓ This customer is verified. They can place orders and use Pay Later if enabled.
          </Text>
        </Section>
      )}

      <View style={{ height: 32 }} />
      {dialog.Dialog}
    </ScrollView>
  );
}

// ── Section ───────────────────────────────────────────────────────────────────

interface SectionProps {
  title: string;
  titleColor: string;
  cardBg: string;
  cardBorder: string;
  children: React.ReactNode;
}

function Section({ title, titleColor, cardBg, cardBorder, children }: SectionProps) {
  return (
    <View style={sectionStyles.container}>
      <Text style={[sectionStyles.title, { color: titleColor }]}>{title}</Text>
      <View style={[sectionStyles.body, { backgroundColor: cardBg, borderColor: cardBorder }]}>
        {children}
      </View>
    </View>
  );
}

const sectionStyles = StyleSheet.create({
  container: { marginHorizontal: 16, marginTop: 12 },
  title: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  body: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
});

// ── InfoRow ───────────────────────────────────────────────────────────────────

interface InfoRowProps {
  label: string;
  value: string;
  textPrimary: string;
  textSecondary: string;
  dividerColor: string;
  isLast?: boolean;
}

function InfoRow({ label, value, textPrimary, textSecondary, dividerColor, isLast }: InfoRowProps) {
  return (
    <View style={[infoRowStyles.row, !isLast && { borderBottomColor: dividerColor, borderBottomWidth: 1 }]}>
      <Text style={[infoRowStyles.label, { color: textSecondary }]}>{label}</Text>
      <Text style={[infoRowStyles.value, { color: textPrimary }]}>{value}</Text>
    </View>
  );
}

const infoRowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  label: { fontSize: 12 },
  value: { fontSize: 13, fontWeight: '600', maxWidth: '60%', textAlign: 'right' },
});

// ── Screen styles ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flexGrow: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    paddingTop: 16,
    paddingBottom: 24,
    paddingHorizontal: 20,
  },
  headerProfile: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  bigAvatar: {
    width: 60, height: 60, borderRadius: 30,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2,
  },
  bigAvatarText: { fontSize: 26, fontWeight: '800', color: '#FFFFFF' },
  customerName: { fontSize: 18, fontWeight: '800' },
  customerUsername: { fontSize: 12, marginBottom: 6 },
  statusBadge: { alignSelf: 'flex-start', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  statusText: { fontSize: 11, fontWeight: '700' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  toggleLabel: { fontSize: 14, fontWeight: '600' },
  toggleHint: { fontSize: 11, marginTop: 2 },
  docRow: { marginBottom: 12 },
  docLabel: { fontSize: 12, fontWeight: '600', marginBottom: 6 },
  docImage: { width: '100%', height: 180, borderRadius: 10 },
  actionHint: { fontSize: 12, marginBottom: 12 },
  actionRow: { flexDirection: 'row', gap: 12 },
  approveBtn: { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  approveBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  rejectBtn: { flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  rejectBtnText: { fontWeight: '700', fontSize: 14 },
});
