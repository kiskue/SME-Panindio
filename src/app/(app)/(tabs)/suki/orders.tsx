import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { Text } from '@/components/atoms/Text';
import { Card } from '@/components/atoms/Card';
import { Chip } from '@/components/atoms/Chip';
import { StatTile, StatusBadge, EmptyState, CardRowSkeleton } from '@/components/molecules';
import { ShoppingBag } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import {
  useBusinessOrdersStore,
  selectBusinessOrders,
  selectBusinessOrdersLoading,
  selectBusinessOrdersError,
  useOnlineSalesStore,
  selectOnlineSalesTodayTotal,
  selectOnlineSalesTodayCount,
} from '@/store';
import { useAppTheme } from '@/core/theme';
import { useThemeMode } from '@/core/theme';
import { useRefreshControl } from '@/hooks';
import { formatCurrency } from '@/core/utils/format';
import { formatShortDate } from '@/core/utils/date';
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
  const { t } = useTranslation();
  const router = useRouter();
  const theme = useAppTheme();
  const isDark = useThemeMode() === 'dark';

  const orders = useBusinessOrdersStore(selectBusinessOrders);
  const isLoading = useBusinessOrdersStore(selectBusinessOrdersLoading);
  const error = useBusinessOrdersStore(selectBusinessOrdersError);
  const { loadOrders } = useBusinessOrdersStore();

  const onlineTodayTotal = useOnlineSalesStore(selectOnlineSalesTodayTotal);
  const onlineTodayCount = useOnlineSalesStore(selectOnlineSalesTodayCount);
  const loadTodaySummary = useOnlineSalesStore((s) => s.loadTodaySummary);

  const [activeTab, setActiveTab] = useState<OrderStatus | 'ALL'>('ALL');

  useEffect(() => {
    void loadOrders();
    void loadTodaySummary();
  }, [loadOrders, loadTodaySummary]);

  const { refreshing, onRefresh } = useRefreshControl(async () => {
    await Promise.all([loadOrders(), loadTodaySummary()]);
  });

  const filtered = useMemo(
    () => (activeTab === 'ALL' ? orders : orders.filter((o) => o.orderStatus === activeTab)),
    [orders, activeTab],
  );

  const accent = theme.colors.tintPrimary;

  const renderItem = ({ item }: { item: BusinessOrder }) => {
    const sc = ORDER_STATUS_COLORS(isDark)[item.orderStatus];
    const unpaid = item.paymentStatus === 'UNPAID';
    return (
      <Card
        variant="elevated"
        padding="md"
        borderRadius="lg"
        style={styles.card}
        onPress={() => router.push({ pathname: '/(app)/(tabs)/suki/orders/[id]', params: { id: item.id } })}
      >
        <View style={styles.cardInner}>
          <View style={styles.cardTop}>
            <Text variant="body-sm" weight="bold" style={{ color: theme.colors.text }}>
              #{item.orderNumber}
            </Text>
            <StatusBadge size="sm" label={ORDER_STATUS_LABEL[item.orderStatus]} backgroundColor={sc.bg} textColor={sc.text} />
          </View>
          <Text variant="body" weight="semibold" numberOfLines={1} style={{ color: theme.colors.text }}>
            {item.customerName ?? 'Customer'}
          </Text>
          <View style={styles.cardBottom}>
            <Text variant="body-xs" numberOfLines={1} style={[styles.meta, { color: theme.colors.textSecondary }]}>
              {formatShortDate(item.orderDate)}
              {'  ·  '}
              {item.paymentMethod === 'PAY_LATER' ? 'Pay Later' : 'Pay Now'}
              {unpaid ? ' · Unpaid' : ' · Paid'}
            </Text>
            <Text variant="h6" weight="bold" style={{ color: accent }}>
              {formatCurrency(item.totalAmount)}
            </Text>
          </View>
        </View>
      </Card>
    );
  };

  const listBody = () => {
    if (isLoading && orders.length === 0) {
      return (
        <View style={styles.listArea}>
          <CardRowSkeleton count={6} />
        </View>
      );
    }
    if (error && orders.length === 0) {
      return (
        <View style={styles.centerArea}>
          <EmptyState
            size="md"
            title="Couldn't load orders"
            description="Please check your connection and try again."
            icon={<ShoppingBag size={28} color={theme.colors.textSecondary} />}
            action={{ label: 'Retry', onPress: () => void loadOrders() }}
          />
        </View>
      );
    }
    if (filtered.length === 0) {
      return (
        <View style={styles.centerArea}>
          <EmptyState
            size="md"
            title={activeTab === 'ALL' ? 'No orders yet' : 'No orders here'}
            description={
              activeTab === 'ALL'
                ? 'Orders your customers place online will appear here.'
                : 'No orders currently match this filter.'
            }
            icon={<ShoppingBag size={28} color={theme.colors.textSecondary} />}
          />
        </View>
      );
    }
    return (
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        style={styles.listArea}
        contentContainerStyle={styles.list}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={accent} />}
      />
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      {/* Wrapper keeps StatTile's internal `flex: 1` from expanding to fill the
          column and overlapping the tabs/list — it sizes to content here. */}
      <View style={styles.summaryWrap}>
        <StatTile
          variant="hero"
          label={t('dashboard.todayOnlineSales')}
          value={formatCurrency(onlineTodayTotal)}
          subValue={t(
            onlineTodayCount === 1 ? 'dashboard.saleRecordedOne' : 'dashboard.salesRecordedMany',
            { n: onlineTodayCount },
          )}
          accentColor={accent}
          icon={<ShoppingBag size={18} color={accent} />}
          highlight
        />
      </View>

      <View style={styles.tabs}>
        {TABS.map((tab) => (
          <Chip
            key={tab.key}
            label={tab.label}
            selected={activeTab === tab.key}
            onPress={() => setActiveTab(tab.key)}
            size="sm"
          />
        ))}
      </View>

      {listBody()}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  // Row container: StatTile's internal `flex: 1` fills the width horizontally and
  // keeps its natural content height (a plain View would collapse it vertically,
  // overlapping the icon/value/label).
  summaryWrap: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 16 },
  listArea: { flex: 1 },
  centerArea: { flex: 1, justifyContent: 'center' },
  tabs: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 14, gap: 8, flexWrap: 'wrap' },
  list: { padding: 16, paddingBottom: 32 },
  card: { marginBottom: 10 },
  cardInner: { gap: 6 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  meta: { flex: 1 },
});
