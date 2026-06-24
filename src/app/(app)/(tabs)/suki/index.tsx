import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  RefreshControl,
} from 'react-native';
import { Text } from '@/components/atoms/Text';
import { useRouter } from 'expo-router';
import { useAuthStore, selectCurrentUser } from '@/store';
import { useSukiBusinessStore, selectLoyalCustomers, selectSukiBusinessLoading } from '@/store';
import { useAppTheme, useThemeMode } from '@/core/theme';
import { theme as staticTheme } from '@/core/theme';
import type { CustomerSummary, CustomerVerificationStatus } from '@/types';

const TABS: { key: CustomerVerificationStatus | 'ALL'; label: string }[] = [
  { key: 'ALL',        label: 'All' },
  { key: 'UNVERIFIED', label: 'Unverified' },
  { key: 'PENDING',    label: 'Pending' },
  { key: 'VERIFIED',   label: 'Verified' },
];

const STATUS_COLOR_LIGHT: Record<CustomerVerificationStatus, { bg: string; text: string }> = {
  UNVERIFIED: { bg: '#FEF9C3', text: '#78350F' },
  PENDING:    { bg: '#EFF6FF', text: '#1E40AF' },
  VERIFIED:   { bg: '#ECFDF5', text: '#065F46' },
  REJECTED:   { bg: '#FEF2F2', text: '#991B1B' },
};

const STATUS_COLOR_DARK: Record<CustomerVerificationStatus, { bg: string; text: string }> = {
  UNVERIFIED: { bg: 'rgba(251,191,36,0.15)',  text: '#FCD34D' },
  PENDING:    { bg: 'rgba(79,158,255,0.15)',   text: '#93C5FD' },
  VERIFIED:   { bg: 'rgba(61,214,140,0.15)',   text: '#3DD68C' },
  REJECTED:   { bg: 'rgba(255,107,107,0.15)',  text: '#FF6B6B' },
};

export default function SukiIndexScreen() {
  const router = useRouter();
  const appTheme = useAppTheme();
  const mode = useThemeMode();
  const isDark = mode === 'dark';

  const user = useAuthStore(selectCurrentUser);
  const customers = useSukiBusinessStore(selectLoyalCustomers);
  const isLoading = useSukiBusinessStore(selectSukiBusinessLoading);
  const { loadLoyalCustomers } = useSukiBusinessStore();

  const [activeTab, setActiveTab] = useState<CustomerVerificationStatus | 'ALL'>('ALL');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (user?.id) loadLoyalCustomers(user.id);
  }, [user?.id]);

  const filtered = customers.filter((c) => {
    if (activeTab !== 'ALL' && c.verificationStatus !== activeTab) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return c.fullName.toLowerCase().includes(q) || c.phoneNumber.includes(q);
    }
    return true;
  });

  // ── Dynamic tokens ────────────────────────────────────────────────────────────
  const rootBg       = isDark ? '#0F1117' : '#F0F4F8';
  const cardBg       = isDark ? '#1A2235' : '#FFFFFF';
  const cardBorder   = isDark ? 'rgba(255,255,255,0.07)' : 'transparent';
  const inputBg      = isDark ? '#1E2435' : '#FFFFFF';
  const inputBorder  = isDark ? 'rgba(255,255,255,0.12)' : '#DDE3EE';
  const inputText: string  = isDark ? 'rgba(255,255,255,0.90)' : staticTheme.colors.text;
  const tabInactiveBg = isDark ? '#1E2435' : '#E5E7EB';
  const tabInactiveText: string = isDark ? 'rgba(255,255,255,0.50)' : '#6B7280';
  const tabActiveBg  = appTheme.colors.primary[500];
  const primaryColor = isDark ? '#4F9EFF' : appTheme.colors.primary[500];
  const accentColor  = isDark ? '#3DD68C' : appTheme.colors.accent[500];
  const nameColor: string    = isDark ? '#F1F5F9' : '#111111';
  const phoneColor: string   = isDark ? 'rgba(255,255,255,0.55)' : staticTheme.colors.textSecondary;
  const dateColor: string    = isDark ? 'rgba(255,255,255,0.35)' : staticTheme.colors.placeholder;
  const emptyTitleColor: string = isDark ? '#F1F5F9' : '#111111';
  const statusColorMap = isDark ? STATUS_COLOR_DARK : STATUS_COLOR_LIGHT;

  const avatarBg     = isDark ? '#1E2D50' : appTheme.colors.primary[500];

  const renderItem = ({ item }: { item: CustomerSummary }) => {
    const sc = statusColorMap[item.verificationStatus];
    return (
      <TouchableOpacity
        style={[styles.customerRow, { backgroundColor: cardBg, borderColor: cardBorder }]}
        onPress={() => router.push({ pathname: '/(app)/(tabs)/suki/[id]', params: { id: item.id } })}
        activeOpacity={0.85}
      >
        <View style={[styles.customerAvatar, { backgroundColor: avatarBg }]}>
          <Text style={styles.avatarText}>{item.fullName.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.customerInfo}>
          <Text style={[styles.customerName, { color: nameColor }]}>{item.fullName}</Text>
          <Text style={[styles.customerPhone, { color: phoneColor }]}>{item.phoneNumber}</Text>
          <Text style={[styles.customerDate, { color: dateColor }]}>
            Joined {new Date(item.createdAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
          </Text>
        </View>
        <View style={styles.customerRight}>
          <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
            <Text style={[styles.statusText, { color: sc.text }]}>{item.verificationStatus}</Text>
          </View>
          {item.payLaterEnabled && (
            <View style={[styles.payLaterBadge, { backgroundColor: isDark ? 'rgba(124,58,237,0.15)' : '#F3E8FF' }]}>
              <Text style={[styles.payLaterText, { color: isDark ? '#C084FC' : '#7C3AED' }]}>Pay Later</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const dynStyles = useMemo(() => StyleSheet.create({
    root: { flex: 1, backgroundColor: rootBg },
    searchInput: {
      flex: 1,
      borderWidth: 1.5,
      borderColor: inputBorder,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 9,
      fontSize: 13,
      backgroundColor: inputBg,
      color: inputText,
    },
    tab: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
      backgroundColor: tabInactiveBg,
    },
    tabActive: { backgroundColor: tabActiveBg },
    tabText: { fontSize: 11, fontWeight: '600' as const, color: tabInactiveText },
    tabTextActive: { color: '#FFFFFF' },
  }), [isDark]);

  return (
    <View style={dynStyles.root}>
      {/* Search + Catalog */}
      <View style={styles.searchRow}>
        <TextInput
          style={dynStyles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search customers..."
          placeholderTextColor={isDark ? 'rgba(255,255,255,0.35)' : staticTheme.colors.placeholder}
        />
        <TouchableOpacity
          style={[styles.catalogBtn, { backgroundColor: primaryColor }]}
          onPress={() => router.push('/(app)/(tabs)/suki/orders')}
        >
          <Text style={styles.catalogBtnText}>Orders</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.catalogBtn, { backgroundColor: accentColor }]}
          onPress={() => router.push('/(app)/(tabs)/suki/catalog')}
        >
          <Text style={styles.catalogBtnText}>Catalog</Text>
        </TouchableOpacity>
      </View>

      {/* Status filter tabs */}
      <View style={styles.tabs}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[dynStyles.tab, activeTab === tab.key && dynStyles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[dynStyles.tabText, activeTab === tab.key && dynStyles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <ActivityIndicator color={primaryColor} size="large" style={{ marginTop: 40 }} />
      ) : filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyTitle, { color: emptyTitleColor }]}>No customers yet</Text>
          <Text style={[styles.emptySub, { color: phoneColor }]}>
            Customers can register themselves using the Customer Portal on the login screen.
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={() => user?.id && loadLoyalCustomers(user.id)}
              tintColor={primaryColor}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  searchRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 12 },
  catalogBtn: {
    borderRadius: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catalogBtnText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },

  tabs: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 10, gap: 6 },

  list: { padding: 16, paddingBottom: 100 },

  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  customerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },
  customerInfo: { flex: 1 },
  customerName: { fontSize: 14, fontWeight: '700' },
  customerPhone: { fontSize: 12, marginTop: 1 },
  customerDate: { fontSize: 11, marginTop: 2 },
  customerRight: { alignItems: 'flex-end', gap: 4 },
  statusBadge: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 10, fontWeight: '700' },
  payLaterBadge: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  payLaterText: { fontSize: 10, fontWeight: '700' },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  emptySub: { fontSize: 13, textAlign: 'center' },
});
