import React, { useEffect } from 'react';
import {
  View, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { Text } from '@/components/atoms/Text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useSukiStore, selectCurrentCustomer } from '@/store';
import { useOnlineOrdersStore, selectCustomerOrders, selectOnlineOrdersLoading } from '@/store';
import { useThemeMode } from '@/core/theme';
import { theme as staticTheme } from '@/core/theme';
import type { OnlineOrder } from '@/types';

const NAVY  = '#1E4D8C';
const AMBER = '#F5A623';
const GREEN = '#27AE60';

const STATUS_COLOR_LIGHT: Record<string, { bg: string; text: string }> = {
  PENDING:    { bg: '#FEF9C3', text: '#78350F' },
  CONFIRMED:  { bg: '#EFF6FF', text: '#1E40AF' },
  PREPARING:  { bg: '#FEF3C7', text: '#92400E' },
  READY:      { bg: '#ECFDF5', text: '#065F46' },
  COMPLETED:  { bg: '#F3F4F6', text: '#374151' },
  CANCELLED:  { bg: '#FEF2F2', text: '#991B1B' },
};

const STATUS_COLOR_DARK: Record<string, { bg: string; text: string }> = {
  PENDING:    { bg: 'rgba(251,191,36,0.15)',  text: '#FCD34D' },
  CONFIRMED:  { bg: 'rgba(79,158,255,0.15)',  text: '#93C5FD' },
  PREPARING:  { bg: 'rgba(251,191,36,0.15)',  text: '#FCD34D' },
  READY:      { bg: 'rgba(61,214,140,0.15)',  text: '#3DD68C' },
  COMPLETED:  { bg: 'rgba(255,255,255,0.08)', text: 'rgba(255,255,255,0.60)' },
  CANCELLED:  { bg: 'rgba(255,107,107,0.15)', text: '#FF6B6B' },
};

export default function CustomerOrdersScreen() {
  const router = useRouter();
  const mode = useThemeMode();
  const isDark = mode === 'dark';

  const customer = useSukiStore(selectCurrentCustomer);
  const orders = useOnlineOrdersStore(selectCustomerOrders);
  const isLoading = useOnlineOrdersStore(selectOnlineOrdersLoading);
  const { loadCustomerOrders } = useOnlineOrdersStore();

  useEffect(() => {
    if (customer) loadCustomerOrders(customer.id);
  }, [customer]);

  // ── Dynamic tokens ────────────────────────────────────────────────────────────
  const rootBg      = isDark ? '#0F1117' : '#F0F4F8';
  const primaryColor = isDark ? '#4F9EFF' : NAVY;
  const cardBg      = isDark ? '#1A2235' : '#FFFFFF';
  const cardBorder  = isDark ? 'rgba(255,255,255,0.07)' : 'transparent';
  const textPrimary: string   = isDark ? '#F1F5F9' : '#111111';
  const textSecondary: string = isDark ? 'rgba(255,255,255,0.55)' : staticTheme.colors.textSecondary;
  const emptyTitleColor: string = isDark ? '#F1F5F9' : '#111111';
  const shopBtnBg   = isDark ? '#2D4A7A' : NAVY;
  const statusColorMap = isDark ? STATUS_COLOR_DARK : STATUS_COLOR_LIGHT;
  const fallbackStatus = isDark
    ? { bg: 'rgba(255,255,255,0.08)', text: 'rgba(255,255,255,0.60)' }
    : { bg: '#F3F4F6', text: '#374151' };

  const renderItem = ({ item }: { item: OnlineOrder }) => {
    const sc = statusColorMap[item.orderStatus] ?? fallbackStatus;
    return (
      <TouchableOpacity
        style={[styles.orderCard, { backgroundColor: cardBg, borderColor: cardBorder }]}
        onPress={() => router.push({ pathname: '/(customer)/orders/[id]', params: { id: item.id } })}
        activeOpacity={0.85}
      >
        <View style={styles.orderHeader}>
          <Text style={[styles.orderNum, { color: textPrimary }]}>#{item.orderNumber}</Text>
          <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
            <Text style={[styles.statusText, { color: sc.text }]}>{item.orderStatus}</Text>
          </View>
        </View>
        <View style={styles.orderMeta}>
          <Text style={[styles.metaText, { color: textSecondary }]}>
            {new Date(item.orderDate).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
          </Text>
          <Text style={[styles.metaTotal, { color: primaryColor }]}>₱{item.totalAmount.toFixed(2)}</Text>
        </View>
        <Text style={[styles.payMethod, { color: textSecondary }]}>
          {item.paymentMethod === 'PAY_LATER' ? 'Pay Later (Credit)' : 'Pay Now'}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: rootBg }]} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <View style={styles.brandStripe}>
          <View style={[styles.stripe, { backgroundColor: NAVY }]} />
          <View style={[styles.stripe, { backgroundColor: AMBER }]} />
          <View style={[styles.stripe, { backgroundColor: GREEN }]} />
        </View>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Orders</Text>
      </View>

      {isLoading ? (
        <ActivityIndicator color={primaryColor} size="large" style={{ marginTop: 40 }} />
      ) : orders.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyTitle, { color: emptyTitleColor }]}>No orders yet</Text>
          <TouchableOpacity style={[styles.shopBtn, { backgroundColor: shopBtnBg }]} onPress={() => router.push('/(customer)/products')}>
            <Text style={styles.shopBtnText}>Browse Products</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={renderItem}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { backgroundColor: NAVY, paddingTop: 16, paddingBottom: 20, paddingHorizontal: 20 },
  brandStripe: { position: 'absolute', top: 0, left: 0, right: 0, height: 3, flexDirection: 'row' },
  stripe: { flex: 1 },
  backBtn: { marginBottom: 8 },
  backText: { color: 'rgba(255,255,255,0.80)', fontSize: 13, fontWeight: '600' },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#FFFFFF' },
  list: { padding: 16 },
  orderCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  orderNum: { fontSize: 14, fontWeight: '700' },
  statusBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  statusText: { fontSize: 11, fontWeight: '700' },
  orderMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  metaText: { fontSize: 12 },
  metaTotal: { fontSize: 16, fontWeight: '800' },
  payMethod: { fontSize: 11, marginTop: 4 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '700', marginBottom: 16 },
  shopBtn: { borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  shopBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
});
