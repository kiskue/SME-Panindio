import React, { useCallback, useEffect } from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { ClipboardList } from 'lucide-react-native';
import { Text } from '@/components/atoms/Text';
import { Card } from '@/components/atoms/Card';
import { EmptyState } from '@/components/molecules/EmptyState';
import { StatusBadge } from '@/components/molecules/StatusBadge';
import { LoadingSpinner } from '@/components/molecules/LoadingSpinner';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useSukiStore, selectCurrentCustomer } from '@/store';
import { useOnlineOrdersStore, selectCustomerOrders, selectOnlineOrdersLoading } from '@/store';
import { useThemeMode, useAppTheme } from '@/core/theme';
import { orderStatusColor } from '@/core/theme/statusColors';
import { formatCurrency } from '@/core/utils/format';
import { formatDate } from '@/core/utils/date';
import { useRefreshControl } from '@/hooks';
import { CustomerHeader } from '@/features/customer/components/CustomerHeader';
import { CartButton } from '@/features/customer/components/CartButton';
import { CUSTOMER_TAB_BAR_HEIGHT } from '@/features/customer/constants/tabBar';
import type { OnlineOrder } from '@/types';

export default function CustomerOrdersScreen() {
  const router = useRouter();
  const isDark = useThemeMode() === 'dark';
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const listBottomPad = CUSTOMER_TAB_BAR_HEIGHT + insets.bottom + 16;

  const customer = useSukiStore(selectCurrentCustomer);
  const orders = useOnlineOrdersStore(selectCustomerOrders);
  const isLoading = useOnlineOrdersStore(selectOnlineOrdersLoading);
  const loadCustomerOrders = useOnlineOrdersStore((s) => s.loadCustomerOrders);

  const reload = useCallback(async () => {
    if (customer) await loadCustomerOrders(customer.id);
  }, [customer, loadCustomerOrders]);

  const { refreshing, onRefresh } = useRefreshControl(reload);

  useEffect(() => {
    void reload();
  }, [reload]);

  const rootBg = isDark ? theme.colors.background : '#F0F4F8';
  const primaryColor = theme.colors.primary[500];

  const renderItem = ({ item }: { item: OnlineOrder }) => {
    const sc = orderStatusColor(item.orderStatus, isDark);
    return (
      <Card
        variant="elevated"
        shadow="sm"
        style={styles.orderCard}
        onPress={() => router.push({ pathname: '/(customer)/orders/[id]', params: { id: item.id } })}
      >
        <View style={styles.orderHeader}>
          <Text variant="body-sm" weight="bold" style={{ color: theme.colors.text }}>
            #{item.orderNumber}
          </Text>
          <StatusBadge size="md" label={item.orderStatus} backgroundColor={sc.bg} textColor={sc.text} />
        </View>
        <View style={styles.orderMeta}>
          <Text variant="body-xs" color="textSecondary">
            {formatDate(item.orderDate)}
          </Text>
          <Text variant="body" weight="bold" style={{ color: primaryColor }}>
            {formatCurrency(item.totalAmount)}
          </Text>
        </View>
        <Text variant="body-xs" color="textSecondary" style={styles.payMethod}>
          {item.paymentMethod === 'PAY_LATER' ? 'Pay Later (Credit)' : 'Pay Now'}
        </Text>
      </Card>
    );
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: rootBg }]} edges={['top']}>
      <StatusBar style="light" />

      <CustomerHeader title="My Orders" rightAction={<CartButton />} />

      {isLoading && orders.length === 0 ? (
        <View style={styles.center}>
          <LoadingSpinner color={primaryColor} />
        </View>
      ) : orders.length === 0 ? (
        <EmptyState
          style={styles.fill}
          title="No orders yet"
          description="When you place an order it will show up here."
          icon={<ClipboardList size={28} color={theme.colors.gray[400]} />}
          action={{
            label: 'Browse Products',
            onPress: () => router.push('/(customer)/products'),
            variant: 'primary',
          }}
        />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.list, { paddingBottom: listBottomPad }]}
          showsVerticalScrollIndicator={false}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primaryColor} />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fill: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16 },
  orderCard: { marginBottom: 10 },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  orderMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  payMethod: { marginTop: 4 },
});
