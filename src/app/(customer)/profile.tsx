import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Text } from '@/components/atoms/Text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useSukiStore, selectCurrentCustomer, selectSukiLoading } from '@/store';
import { useThemeMode } from '@/core/theme';
import { theme as staticTheme } from '@/core/theme';
import type { CustomerVerificationStatus } from '@/types';

const NAVY  = '#1E4D8C';
const AMBER = '#F5A623';
const GREEN = '#27AE60';

const STATUS_STEPS: { status: CustomerVerificationStatus; label: string; desc: string }[] = [
  { status: 'UNVERIFIED', label: '1. Upload ID',         desc: 'Photo of your government ID' },
  { status: 'PENDING',    label: '2. Selfie & Liveness', desc: 'Face detection to confirm identity' },
  { status: 'VERIFIED',   label: '3. Business Approval', desc: 'Awaiting merchant verification' },
];

function stepState(current: CustomerVerificationStatus, step: CustomerVerificationStatus) {
  const order: CustomerVerificationStatus[] = ['UNVERIFIED', 'PENDING', 'VERIFIED'];
  const ci = order.indexOf(current);
  const si = order.indexOf(step);
  if (current === 'VERIFIED') return 'done';
  if (current === 'REJECTED') return si === 0 ? 'done' : 'error';
  if (ci > si) return 'done';
  if (ci === si) return 'active';
  return 'pending';
}

export default function CustomerProfileScreen() {
  const router = useRouter();
  const mode = useThemeMode();
  const isDark = mode === 'dark';

  const customer = useSukiStore(selectCurrentCustomer);
  const isLoading = useSukiStore(selectSukiLoading);
  const { updateCustomerCredentials } = useSukiStore();

  const [editMode, setEditMode] = useState(false);
  const [newUsername, setNewUsername] = useState(customer?.username ?? '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  if (!customer) return null;

  const handleSaveCredentials = async () => {
    if (newPassword && newPassword.length < 8) {
      Alert.alert('Invalid password', 'Password must be at least 8 characters.');
      return;
    }
    if (newPassword && newPassword !== confirmPassword) {
      Alert.alert('Mismatch', 'Passwords do not match.');
      return;
    }
    if (!newUsername.trim() || newUsername.trim().length < 4) {
      Alert.alert('Invalid username', 'Username must be at least 4 characters.');
      return;
    }
    await updateCustomerCredentials(newUsername.trim(), newPassword || customer.username);
    const state = useSukiStore.getState();
    if (!state.error) {
      setEditMode(false);
      setNewPassword('');
      setConfirmPassword('');
      Alert.alert('Saved', 'Your credentials have been updated.');
    }
  };

  const verStatus = customer.verificationStatus;
  const canGoToId = verStatus === 'UNVERIFIED' || verStatus === 'REJECTED';
  const canGoToLiveness = verStatus === 'PENDING';

  // ── Dynamic tokens ────────────────────────────────────────────────────────────
  const rootBg      = isDark ? '#0F1117' : '#F0F4F8';
  const cardBg      = isDark ? '#1A2235' : '#FFFFFF';
  const cardBorder  = isDark ? 'rgba(255,255,255,0.07)' : 'transparent';
  const inputBg     = isDark ? '#1E2435' : '#FFFFFF';
  const inputBorder = isDark ? 'rgba(255,255,255,0.12)' : '#DDE3EE';
  const inputText: string   = isDark ? 'rgba(255,255,255,0.90)' : staticTheme.colors.text;
  const placeholderColor = isDark ? 'rgba(255,255,255,0.35)' : staticTheme.colors.placeholder;
  const textPrimary: string   = isDark ? '#F1F5F9' : '#111111';
  const textSecondary: string = isDark ? 'rgba(255,255,255,0.55)' : staticTheme.colors.textSecondary;
  const dividerColor: string  = isDark ? 'rgba(255,255,255,0.07)' : '#F0F4F8';
  const sectionHeaderBorder = isDark ? 'rgba(255,255,255,0.07)' : '#F0F4F8';
  const fieldLabelColor = isDark ? '#4F9EFF' : NAVY;
  const editToggleColor = isDark ? '#4F9EFF' : NAVY;

  const rejectedBoxBg      = isDark ? 'rgba(239,68,68,0.08)' : '#FEF2F2';
  const rejectedTextColor  = isDark ? '#FF6B6B' : '#991B1B';

  const stepDotPendingBg = isDark ? '#374151' : '#E5E7EB';
  const stepDotText = '#FFFFFF';
  const stepBtnBg  = isDark ? '#2D4A7A' : NAVY;

  const verifiedPillBg      = isDark ? 'rgba(61,214,140,0.15)' : '#ECFDF5';
  const verifiedPillText    = isDark ? '#3DD68C' : '#065F46';
  const unverifiedPillBg    = isDark ? 'rgba(251,191,36,0.15)' : '#FEF9C3';
  const unverifiedPillText  = isDark ? '#FCD34D' : '#78350F';
  const rejectedPillBg      = isDark ? 'rgba(255,107,107,0.15)' : '#FEF2F2';
  const rejectedPillText    = isDark ? '#FF6B6B' : '#991B1B';

  const pillBg = verStatus === 'VERIFIED'
    ? verifiedPillBg
    : verStatus === 'REJECTED'
      ? rejectedPillBg
      : unverifiedPillBg;
  const pillText = verStatus === 'VERIFIED'
    ? verifiedPillText
    : verStatus === 'REJECTED'
      ? rejectedPillText
      : unverifiedPillText;
  const pillLabel = verStatus === 'VERIFIED' ? 'Verified' : verStatus === 'REJECTED' ? 'Rejected' : verStatus === 'PENDING' ? 'Pending' : 'Unverified';

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: rootBg }]} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header — brand-locked NAVY */}
        <View style={styles.header}>
          <View style={styles.brandStripe}>
            <View style={[styles.stripe, { backgroundColor: NAVY }]} />
            <View style={[styles.stripe, { backgroundColor: AMBER }]} />
            <View style={[styles.stripe, { backgroundColor: GREEN }]} />
          </View>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Profile</Text>
        </View>

        {/* Profile info */}
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <View style={styles.cardAccent}>
            <View style={[styles.accentSeg, { backgroundColor: NAVY, flex: 3 }]} />
            <View style={[styles.accentSeg, { backgroundColor: AMBER, flex: 1 }]} />
            <View style={[styles.accentSeg, { backgroundColor: GREEN, flex: 2 }]} />
          </View>
          <View style={styles.cardBody}>
            <InfoRow label="Full Name"    value={customer.fullName}    textPrimary={textPrimary} textSecondary={textSecondary} dividerColor={dividerColor} />
            <InfoRow label="Username"     value={customer.username}    textPrimary={textPrimary} textSecondary={textSecondary} dividerColor={dividerColor} />
            <InfoRow label="Phone"        value={customer.phoneNumber} textPrimary={textPrimary} textSecondary={textSecondary} dividerColor={dividerColor} />
            {customer.email ? <InfoRow label="Email" value={customer.email} textPrimary={textPrimary} textSecondary={textSecondary} dividerColor={dividerColor} /> : null}

            <TouchableOpacity
              style={styles.editToggle}
              onPress={() => setEditMode((e) => !e)}
              activeOpacity={0.7}
            >
              <Text style={[styles.editToggleText, { color: editToggleColor }]}>
                {editMode ? 'Cancel' : 'Edit Credentials'}
              </Text>
            </TouchableOpacity>

            {editMode && (
              <View style={styles.editForm}>
                <Text style={[styles.fieldLabel, { color: fieldLabelColor }]}>New Username</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: inputBg, borderColor: inputBorder, color: inputText }]}
                  value={newUsername}
                  onChangeText={setNewUsername}
                  autoCapitalize="none"
                  placeholder="At least 4 characters"
                  placeholderTextColor={placeholderColor}
                />
                <Text style={[styles.fieldLabel, { color: fieldLabelColor }]}>New Password</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: inputBg, borderColor: inputBorder, color: inputText }]}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry
                  placeholder="Leave blank to keep current"
                  placeholderTextColor={placeholderColor}
                />
                <Text style={[styles.fieldLabel, { color: fieldLabelColor }]}>Confirm New Password</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: inputBg, borderColor: inputBorder, color: inputText }]}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                  placeholder="Repeat new password"
                  placeholderTextColor={placeholderColor}
                />
                <TouchableOpacity
                  style={[styles.saveBtn, { backgroundColor: stepBtnBg }, isLoading && styles.saveBtnDisabled]}
                  onPress={handleSaveCredentials}
                  disabled={isLoading}
                  activeOpacity={0.85}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.saveBtnText}>Save Changes</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        {/* Verification section */}
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <View style={[styles.sectionHeader, { borderBottomColor: sectionHeaderBorder }]}>
            <Text style={[styles.sectionTitle, { color: textPrimary }]}>Identity Verification</Text>
            <View style={[styles.statusPill, { backgroundColor: pillBg }]}>
              <Text style={[styles.statusPillText, { color: pillText }]}>{pillLabel}</Text>
            </View>
          </View>

          {verStatus === 'REJECTED' && customer.rejectionReason && (
            <View style={[styles.rejectedBox, { backgroundColor: rejectedBoxBg }]}>
              <Text style={[styles.rejectedText, { color: rejectedTextColor }]}>
                Rejected: {customer.rejectionReason}. Please re-submit your ID.
              </Text>
            </View>
          )}

          {STATUS_STEPS.map((step) => {
            const state = stepState(verStatus, step.status);
            return (
              <View key={step.status} style={[styles.stepRow, { borderBottomColor: dividerColor }]}>
                <View style={[
                  styles.stepDot,
                  { backgroundColor: stepDotPendingBg },
                  state === 'done' && { backgroundColor: GREEN },
                  state === 'active' && { backgroundColor: AMBER },
                ]}>
                  <Text style={[styles.stepDotText, { color: stepDotText }]}>
                    {state === 'done' ? '✓' : step.status[0] ?? '?'}
                  </Text>
                </View>
                <View style={styles.stepInfo}>
                  <Text style={[styles.stepLabel, { color: textPrimary }]}>{step.label}</Text>
                  <Text style={[styles.stepDesc, { color: textSecondary }]}>{step.desc}</Text>
                </View>
                {(step.status === 'UNVERIFIED' && canGoToId) && (
                  <TouchableOpacity
                    style={[styles.stepBtn, { backgroundColor: stepBtnBg }]}
                    onPress={() => router.push('/(customer)/verify-id')}
                  >
                    <Text style={styles.stepBtnText}>Start</Text>
                  </TouchableOpacity>
                )}
                {(step.status === 'PENDING' && canGoToLiveness) && (
                  <TouchableOpacity
                    style={[styles.stepBtn, { backgroundColor: stepBtnBg }]}
                    onPress={() => router.push('/(customer)/verify-liveness')}
                  >
                    <Text style={styles.stepBtnText}>Start</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ label, value, textPrimary, textSecondary, dividerColor }: {
  label: string; value: string;
  textPrimary: string; textSecondary: string; dividerColor: string;
}) {
  return (
    <View style={[infoStyles.row, { borderBottomColor: dividerColor }]}>
      <Text style={[infoStyles.label, { color: textSecondary }]}>{label}</Text>
      <Text style={[infoStyles.value, { color: textPrimary }]}>{value}</Text>
    </View>
  );
}
const infoStyles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1 },
  label: { fontSize: 12 },
  value: { fontSize: 13, fontWeight: '600' },
});

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flexGrow: 1 },

  header: {
    backgroundColor: NAVY,
    paddingTop: 16,
    paddingBottom: 28,
    paddingHorizontal: 24,
    overflow: 'hidden',
  },
  brandStripe: { position: 'absolute', top: 0, left: 0, right: 0, height: 3, flexDirection: 'row' },
  stripe: { flex: 1 },
  backBtn: { marginBottom: 12 },
  backText: { color: 'rgba(255,255,255,0.80)', fontSize: 13, fontWeight: '600' },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#FFFFFF' },

  card: {
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cardAccent: { flexDirection: 'row', height: 4 },
  accentSeg: { height: 4 },
  cardBody: { padding: 20 },

  editToggle: { marginTop: 12 },
  editToggleText: { fontSize: 13, fontWeight: '700' },

  editForm: { marginTop: 12, gap: 4 },
  fieldLabel: { fontSize: 12, fontWeight: '600', marginBottom: 4, marginTop: 8 },
  input: {
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
  },
  saveBtn: {
    marginTop: 12,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700' },
  statusPill: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  statusPillText: { fontSize: 11, fontWeight: '700' },

  rejectedBox: {
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 8,
    padding: 10,
  },
  rejectedText: { fontSize: 12 },

  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
  },
  stepDot: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  stepDotText: { fontSize: 10, fontWeight: '800' },
  stepInfo: { flex: 1 },
  stepLabel: { fontSize: 13, fontWeight: '600' },
  stepDesc: { fontSize: 11, marginTop: 1 },
  stepBtn: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  stepBtnText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },
});
