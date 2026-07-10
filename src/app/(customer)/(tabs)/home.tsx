import React from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Text } from '@/components/atoms/Text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useSukiStore, selectCurrentCustomer } from '@/store';
import { useThemeMode } from '@/core/theme';
import { theme as staticTheme } from '@/core/theme';
import type { CustomerVerificationStatus } from '@/types';

const NAVY  = '#1E4D8C';
const AMBER = '#F5A623';
const GREEN = '#27AE60';

function VerificationBadge({ status, isDark }: { status: CustomerVerificationStatus; isDark: boolean }) {
  const configs: Record<CustomerVerificationStatus, { label: string; lightBg: string; lightColor: string; darkBg: string; darkColor: string }> = {
    UNVERIFIED: { label: 'Unverified',    lightBg: '#FEF3C7', lightColor: '#92400E', darkBg: 'rgba(251,191,36,0.20)', darkColor: '#FCD34D' },
    PENDING:    { label: 'Pending Review', lightBg: '#EFF6FF', lightColor: '#1E40AF', darkBg: 'rgba(147,197,253,0.20)', darkColor: '#93C5FD' },
    VERIFIED:   { label: 'Verified',       lightBg: '#ECFDF5', lightColor: '#065F46', darkBg: 'rgba(61,214,140,0.20)', darkColor: '#3DD68C' },
    REJECTED:   { label: 'Rejected',       lightBg: '#FEF2F2', lightColor: '#991B1B', darkBg: 'rgba(255,107,107,0.20)', darkColor: '#FF6B6B' },
  };
  const cfg = configs[status];
  return (
    <View style={[badgeStyles.badge, { backgroundColor: isDark ? cfg.darkBg : cfg.lightBg }]}>
      <Text style={[badgeStyles.text, { color: isDark ? cfg.darkColor : cfg.lightColor }]}>{cfg.label}</Text>
    </View>
  );
}
const badgeStyles = StyleSheet.create({
  badge: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },
  text: { fontSize: 11, fontWeight: '700' },
});

export default function CustomerHomeScreen() {
  const router = useRouter();
  const mode = useThemeMode();
  const isDark = mode === 'dark';

  const customer = useSukiStore(selectCurrentCustomer);
  const { logoutCustomer } = useSukiStore();

  if (!customer) return null;

  const isUnverified = customer.verificationStatus === 'UNVERIFIED';

  const handleLogout = async () => {
    await logoutCustomer();
    router.replace('/(auth)/login');
  };

  // ── Dynamic tokens ────────────────────────────────────────────────────────────
  const rootBg           = isDark ? '#0F1117' : '#F0F4F8';
  const verifyBannerBg   = isDark ? 'rgba(251,191,36,0.10)' : '#FEF9C3';
  const verifyBannerBorderLeft = AMBER;
  const verifyBannerText: string = isDark ? '#FCD34D' : '#78350F';
  const verifyBannerCta  = isDark ? '#4F9EFF' : NAVY;
  const logoutBorderColor = isDark ? 'rgba(255,255,255,0.12)' : '#DDE3EE';
  const logoutTextColor: string  = isDark ? 'rgba(255,255,255,0.55)' : staticTheme.colors.textSecondary;

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
          <View style={styles.headerContent}>
            <View>
              <Text style={styles.greeting}>Hello, {customer.fullName.split(' ')[0]}!</Text>
              <Text style={styles.greetingSub}>Welcome to your Suki account</Text>
            </View>
            <VerificationBadge status={customer.verificationStatus} isDark={isDark} />
          </View>
        </View>

        {/* Unverified banner */}
        {isUnverified && (
          <TouchableOpacity
            style={[styles.verifyBanner, { backgroundColor: verifyBannerBg, borderLeftColor: verifyBannerBorderLeft }]}
            onPress={() => router.push('/(customer)/profile')}
            activeOpacity={0.85}
          >
            <View style={[styles.verifyBannerDot, { backgroundColor: AMBER }]} />
            <Text style={[styles.verifyBannerText, { color: verifyBannerText }]}>
              Complete your profile to unlock{' '}
              <Text style={{ fontWeight: '700' }}>Pay Later</Text> orders.{' '}
              <Text style={{ color: verifyBannerCta, fontWeight: '700' }}>Verify Now →</Text>
            </Text>
          </TouchableOpacity>
        )}

        {/* Action cards */}
        <View style={styles.cardsGrid}>
          <ActionCard
            title="Browse Products"
            desc="Order from available items"
            color={NAVY}
            isDark={isDark}
            onPress={() => router.push('/(customer)/products')}
          />
          <ActionCard
            title="My Orders"
            desc="Track your order history"
            color="#7C3AED"
            isDark={isDark}
            onPress={() => router.push('/(customer)/orders')}
          />
          <ActionCard
            title="My Profile"
            desc="Edit info & verify account"
            color={GREEN}
            isDark={isDark}
            onPress={() => router.push('/(customer)/profile')}
          />
        </View>

        {/* Logout */}
        <TouchableOpacity
          style={[styles.logoutBtn, { borderColor: logoutBorderColor }]}
          onPress={handleLogout}
          activeOpacity={0.7}
        >
          <Text style={[styles.logoutText, { color: logoutTextColor }]}>Sign Out</Text>
        </TouchableOpacity>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function ActionCard({ title, desc, color, isDark, onPress }: {
  title: string; desc: string; color: string; isDark: boolean; onPress: () => void;
}) {
  const cardBg: string   = isDark ? '#1A2235' : '#FFFFFF';
  const titleColor: string = isDark ? '#F1F5F9' : '#111111';
  const descColor: string  = isDark ? 'rgba(255,255,255,0.50)' : staticTheme.colors.textSecondary;

  return (
    <TouchableOpacity style={[cardStyles.card, { borderTopColor: color, backgroundColor: cardBg }]} onPress={onPress} activeOpacity={0.85}>
      <View style={[cardStyles.colorBar, { backgroundColor: color }]} />
      <Text style={[cardStyles.title, { color: titleColor }]}>{title}</Text>
      <Text style={[cardStyles.desc, { color: descColor }]}>{desc}</Text>
    </TouchableOpacity>
  );
}
const cardStyles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    borderTopWidth: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  colorBar: { width: 32, height: 4, borderRadius: 2, marginBottom: 10 },
  title: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  desc: { fontSize: 11 },
});

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flexGrow: 1 },

  header: {
    backgroundColor: NAVY,
    paddingTop: 20,
    paddingBottom: 28,
    paddingHorizontal: 24,
    overflow: 'hidden',
  },
  brandStripe: { position: 'absolute', top: 0, left: 0, right: 0, height: 3, flexDirection: 'row' },
  stripe: { flex: 1 },
  headerContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  greeting: { fontSize: 22, fontWeight: '800', color: '#FFFFFF' },
  greetingSub: { fontSize: 12, color: 'rgba(255,255,255,0.70)', marginTop: 2 },

  verifyBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 12,
    padding: 14,
    borderLeftWidth: 3,
  },
  verifyBannerDot: { width: 8, height: 8, borderRadius: 4, marginTop: 2 },
  verifyBannerText: { flex: 1, fontSize: 12, lineHeight: 18 },

  cardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingHorizontal: 20,
    marginTop: 16,
  },

  logoutBtn: {
    marginHorizontal: 20,
    marginTop: 24,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  logoutText: { fontSize: 14, fontWeight: '600' },
});
