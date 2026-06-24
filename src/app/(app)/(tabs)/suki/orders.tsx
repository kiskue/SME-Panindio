import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Text } from '@/components/atoms/Text';
import { useRouter } from 'expo-router';
import {
  useBusinessOrdersStore,
  selectBusinessOrders,
  selectBusinessOrdersLoading,
} from '@/store';
import { useAppTheme, useThemeMode } from '@/core/theme';
import { theme as staticTheme } from '@/core/theme';
import type { BusinessOrder, OrderStatus } from '@/types';
import { ORDER_STATUS_COLORS, ORDER_STATUS_LABEL } from '@/features/business-suki/order-status';

const TABS: { key: OrderStatus | 'ALL'; label: string }[] = [
  { key: 'ALL',       label: 'All' },
  { key: 'PENDING',   label: 'New' },
  { key: 'CONFIRMED', label: 'Confirmed' },
  { key: 'READY',     label: 'Ready' },
  { key: 'COMPLETED', label: 'Done' },
];

export default function BusinessOrdersScreen() {
  const router = useRouter();
  const appTheme = useAppTheme();
  const isDark = useThemeMode() === 'dark';

  const orders = useBusinessOrdersStore(selectBusinessOrders);
  const isLoading = useBusinessOrdersStore(selectBusinessOrdersLoading);
  const { loadOrders } = useBusinessOrdersStore();

  const [activeTab, setActiveTab] = useState<OrderStatus | 'ALL'>('ALL');

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  const filtered = useMemo(
    () => (activeTab === 'ALL' ? orders : orders.filter((o) => o.orderStatus === activeTab)),
    [orders, activeTab],
  );

  // ── Dynamic tokens ────────────────────────────────────────────────────────────
  const rootBg        = isDark ? '#0F1117' : '#F0F4F8';
  const cardBg        = isDark ? '#1A2235' : '#FFFFFF';
  const cardBorder    = isDark ? 'rgba(255,255,255,0.07)' : 'transparent';
  const primaryColor  = isDark ? '#4F9EFF' : appTheme.colors.primary[500];
  const tabInactiveBg = isDark ? '#1E2435' : '#E5E7EB';
  const tabInactiveText: string = isDark ? 'rgba(255,255,255,0.50)' : '#6B7280';
  const nameColor: string       = isDark ? '#F1F5F9' : '#111111';
  const subColor: string        = isDark ? 'rgba(255,255,255,0.55)' : staticTheme.colors.textSecondary;
  const headerBg      = isDark ? '#151A27' : appTheme.colors.primary[500];

  const renderItem = ({ item }: { item: BusinessOrder }) => {
    const sc = ORDER_STATUS_COLORS(isDark)[item.orderStatus];
    const unpaid = item.paymentStatus === 'UNPAID';
    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}
        onPress={() => router.push({ pathname: '/(app)/(tabs)/suki/orders/[id]', params: { id: item.id } })}
        activeOpacity={0.85}
      >
        <View style={styles.cardTop}>
          <Text style={[styles.orderNum, { color: nameColor }]}>#{item.orderNumber}</Text>
          <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
            <Text style={[styles.statusText, { color: sc.text }]}>{ORDER_STATUS_LABEL[item.orderStatus]}</Text>
          </View>
        </View>
        <Text style={[styles.customer, { color: nameColor }]} numberOfLines={1}>
          {item.customerName ?? 'Customer'}
        </Text>
        <View style={styles.cardBottom}>
          <Text style={[styles.meta, { color: subColor }]}>
            {new Date(item.orderDate).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
            {'  ·  '}
            {item.paymentMethod === 'PAY_LATER' ? 'Pay Later' : 'Pay Now'}
            {unpaid ? ' · Unpaid' : ' · Paid'}
          </Text>
          <Text style={[styles.total, { color: primaryColor }]}>₱{item.totalAmount.toFixed(2)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const dyn = useMemo(() => StyleSheet.create({
    tab: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: tabInactiveBg },
    tabActive: { backgroundColor: primaryColor },
    tabText: { fontSize: 11, fontWeight: '600' as const, color: tabInactiveText },
    tabTextActive: { color: '#FFFFFF' },
  }), [isDark]);

  return (
    <View style={[styles.root, { backgroundColor: rootBg }]}>
      <View style={[styles.header, { backgroundColor: headerBg }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Online Orders</Text>
      </View>

      <View style={styles.tabs}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[dyn.tab, activeTab === tab.key && dyn.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[dyn.tabText, activeTab === tab.key && dyn.tabTextActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading && orders.length === 0 ? (
        <ActivityIndicator color={primaryColor} size="large" style={{ marginTop: 40 }} />
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyTitle, { color: nameColor }]}>No orders</Text>
          <Text style={[styles.emptySub, { color: subColor }]}>
            Orders your customers place online will appear here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={() => loadOrders()} tintColor={primaryColor} />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingTop: 52, paddingBottom: 16, paddingHorizontal: 20 },
  backBtn: { marginBottom: 8 },
  backText: { color: 'rgba(255,255,255,0.80)', fontSize: 13, fontWeight: '600' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#FFFFFF' },
  tabs: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 12, gap: 6, flexWrap: 'wrap' },
  list: { padding: 16, paddingBottom: 100 },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  orderNum: { fontSize: 13, fontWeight: '700' },
  statusBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  statusText: { fontSize: 10, fontWeight: '700' },
  customer: { fontSize: 14, fontWeight: '600', marginBottom: 6 },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  meta: { fontSize: 11, flex: 1 },
  total: { fontSize: 16, fontWeight: '800' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  emptySub: { fontSize: 13, textAlign: 'center' },
});
