import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { PackageX } from 'lucide-react-native';
import { Text } from '@/components/atoms/Text';
import { Card } from '@/components/atoms/Card';
import { Divider } from '@/components/atoms/Divider';
import { EmptyState } from '@/components/molecules/EmptyState';
import { StatusBadge } from '@/components/molecules/StatusBadge';
import { InfoRow } from '@/components/molecules/InfoRow';
import { StatusTimeline, type StatusTimelineStep } from '@/components/molecules/StatusTimeline';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useOnlineOrdersStore, selectCustomerOrders } from '@/store';
import { useThemeMode, useAppTheme } from '@/core/theme';
import { orderStatusColor } from '@/core/theme/statusColors';
import { formatCurrency } from '@/core/utils/format';
import { formatDateTime } from '@/core/utils/date';
import { CustomerHeader } from '@/features/customer/components/CustomerHeader';
import type { OrderStatus } from '@/types';

const STATUS_STEPS: OrderStatus[] = ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'COMPLETED'];

function titleCase(status: string): string {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

export default function OrderDetailScreen() {
  const router = useRouter();
  const isDark = useThemeMode() === 'dark';
  const theme = useAppTheme();

  const { id } = useLocalSearchParams<{ id: string }>();
  const orders = useOnlineOrdersStore(selectCustomerOrders);
  const order = orders.find((o) => o.id === id);

  const rootBg = isDark ? theme.colors.background : '#F0F4F8';
  const dividerColor = isDark ? 'rgba(255,255,255,0.07)' : '#F0F4F8';

  if (!order) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: rootBg }]} edges={['top', 'bottom']}>
        <StatusBar style="light" />
        <CustomerHeader title="Order" onBack={() => router.back()} />
        <EmptyState
          style={styles.fill}
          title="Order not found"
          description="This order is no longer available."
          icon={<PackageX size={28} color={theme.colors.gray[400]} />}
          action={{ label: 'Go Back', onPress: () => router.back(), variant: 'outline' }}
        />
      </SafeAreaView>
    );
  }

  const isCancelled = order.orderStatus === 'CANCELLED';
  const currentStepIndex = isCancelled ? -1 : STATUS_STEPS.indexOf(order.orderStatus);
  const activeColor = orderStatusColor(order.orderStatus, isDark);

  const timelineSteps: StatusTimelineStep[] = STATUS_STEPS.map((step) => ({
    label: titleCase(step),
  }));

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: rootBg }]} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <CustomerHeader title={`Order #${order.orderNumber}`} onBack={() => router.back()} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Status */}
        <Card variant="elevated" shadow="sm" style={styles.card}>
          <Text variant="body" weight="bold" style={[styles.cardTitle, { color: theme.colors.text }]}>
            Order Status
          </Text>

          {isCancelled ? (
            <View style={[styles.cancelledBox, { backgroundColor: activeColor.bg }]}>
              <StatusBadge size="md" label="Cancelled" backgroundColor={activeColor.bg} textColor={activeColor.text} />
              {order.cancellationReason && (
                <Text variant="body-xs" style={[styles.cancelledReason, { color: activeColor.text }]}>
                  {order.cancellationReason}
                </Text>
              )}
            </View>
          ) : (
            <StatusTimeline
              steps={timelineSteps}
              currentIndex={currentStepIndex}
              getStepColor={(_index, state) =>
                state === 'active' ? activeColor.text : undefined
              }
            />
          )}
        </Card>

        {/* Summary */}
        <Card variant="elevated" shadow="sm" style={styles.card}>
          <Text variant="body" weight="bold" style={[styles.cardTitle, { color: theme.colors.text }]}>
            Order Summary
          </Text>
          <InfoRow label="Order Date" value={formatDateTime(order.orderDate)} />
          <InfoRow label="Payment" value={order.paymentMethod === 'PAY_LATER' ? 'Pay Later (Credit)' : 'Pay Now'} />
          <InfoRow label="Payment Status" value={titleCase(order.paymentStatus)} />
          <Divider color={dividerColor} spacing="sm" />
          <InfoRow label="Subtotal" value={formatCurrency(order.subtotal)} />
          {order.vatAmount > 0 && <InfoRow label="VAT" value={formatCurrency(order.vatAmount)} />}
          <InfoRow label="Total" value={formatCurrency(order.totalAmount)} emphasis />
        </Card>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fill: { flex: 1 },
  scroll: { padding: 16 },
  card: { marginBottom: 12 },
  cardTitle: { marginBottom: 14 },
  cancelledBox: {
    borderRadius: 10,
    padding: 12,
    gap: 6,
  },
  cancelledReason: { marginTop: 2 },
});
