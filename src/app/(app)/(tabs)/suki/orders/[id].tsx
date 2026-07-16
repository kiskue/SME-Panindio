import React, { useEffect } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text } from '@/components/atoms/Text';
import { Card } from '@/components/atoms/Card';
import { Button } from '@/components/atoms/Button';
import { InfoRow, StatusBadge, EmptyState, LoadingSpinner } from '@/components/molecules';
import { PackageX } from 'lucide-react-native';
import { useAppDialog } from '@/hooks';
import { useScreenTitle } from '@/store';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  useBusinessOrdersStore,
  selectBusinessSelectedOrder,
  selectBusinessOrdersLoading,
  selectBusinessOrdersUpdating,
} from '@/store';
import { useAppTheme, useThemeMode } from '@/core/theme';
import { paymentStatusColor } from '@/core/theme/statusColors';
import { formatCurrency } from '@/core/utils/format';
import { formatDateTime } from '@/core/utils/date';
import type { OrderStatus } from '@/types';
import {
  ORDER_STATUS_COLORS,
  ORDER_STATUS_LABEL,
  ALLOWED_NEXT_STATUSES,
  PAYMENT_STATUS_LABEL,
} from '@/features/business-suki/order-status';

/** Label shown on the button that advances an order INTO each status. */
const ADVANCE_LABEL: Record<OrderStatus, string> = {
  PENDING:   'Confirm Order',
  CONFIRMED: 'Confirm Order',
  PREPARING: 'Start Preparing',
  READY:     'Mark as Ready',
  COMPLETED: 'Mark as Completed',
  CANCELLED: 'Cancel Order',
};

/** The single natural "next step" for the linear fulfilment flow. */
const PRIMARY_NEXT: Record<OrderStatus, OrderStatus | null> = {
  PENDING:   'CONFIRMED',
  CONFIRMED: 'PREPARING',
  PREPARING: 'READY',
  READY:     'COMPLETED',
  COMPLETED: null,
  CANCELLED: null,
};

export default function BusinessOrderDetailScreen() {
  const router = useRouter();
  const dialog = useAppDialog();
  const { t } = useTranslation();
  const theme = useAppTheme();
  const isDark = useThemeMode() === 'dark';

  const { id } = useLocalSearchParams<{ id: string }>();
  const order = useBusinessOrdersStore(selectBusinessSelectedOrder);
  const isLoading = useBusinessOrdersStore(selectBusinessOrdersLoading);
  const isUpdating = useBusinessOrdersStore(selectBusinessOrdersUpdating);
  const { loadOrder, changeStatus, changePaymentStatus } = useBusinessOrdersStore();

  useEffect(() => {
    if (id) void loadOrder(id);
  }, [id, loadOrder]);

  useScreenTitle(order ? `Order #${order.orderNumber}` : t('nav.orderDetail'));

  if (isLoading && !order) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <LoadingSpinner color={theme.colors.tintPrimary} />
      </View>
    );
  }

  if (!order) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <EmptyState
          size="md"
          title="Order not found"
          description="This order may have been removed or is no longer available."
          icon={<PackageX size={28} color={theme.colors.textSecondary} />}
          action={{ label: 'Go Back', onPress: () => router.back(), variant: 'outline' }}
        />
      </View>
    );
  }

  const sc = ORDER_STATUS_COLORS(isDark)[order.orderStatus];
  const pc = paymentStatusColor(order.paymentStatus, isDark);
  const nextStatuses = ALLOWED_NEXT_STATUSES[order.orderStatus];
  const isTerminal = nextStatuses.length === 0;
  const unpaid = order.paymentStatus === 'UNPAID';
  const primaryNext = PRIMARY_NEXT[order.orderStatus];
  const canCancel = nextStatuses.includes('CANCELLED');
  // Offer a "Complete Now" shortcut only when completing isn't already the
  // primary step (i.e. the order is still mid-flow).
  const showQuickComplete = nextStatuses.includes('COMPLETED') && primaryNext !== 'COMPLETED';

  const doChangeStatus = (status: OrderStatus) => {
    const completing = status === 'COMPLETED';
    const cancelling = status === 'CANCELLED';
    const confirmMsg = completing
      ? 'Mark this order as completed? This will deduct the ordered quantities from your stock.'
      : cancelling
        ? 'Cancel this order? This cannot be undone.'
        : `Move this order to "${ORDER_STATUS_LABEL[status]}"?`;

    dialog.confirm({
      title: ADVANCE_LABEL[status],
      message: confirmMsg,
      confirmText: cancelling ? 'Cancel Order' : 'Confirm',
      onConfirm: () => {
        void changeStatus(order.id, status).catch((err) => {
          const code = err instanceof Error ? err.message : '';
          dialog.show({
            variant: 'error',
            title: 'Could not update order',
            message: code === 'INVALID_STATUS_TRANSITION'
              ? 'That status change is no longer allowed for this order.'
              : 'Please try again.',
          });
        });
      },
    });
  };

  const doMarkPaid = (paid: boolean) => {
    void changePaymentStatus(order.id, paid ? 'PAID' : 'UNPAID').catch(() => {
      dialog.show({ variant: 'error', title: 'Could not update payment', message: 'Please try again.' });
    });
  };

  const showActionBar = !isTerminal || (unpaid && order.orderStatus !== 'CANCELLED');

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Status + customer */}
        <Card variant="elevated" padding="lg" borderRadius="lg">
          <View style={styles.section}>
            <View style={styles.statusRow}>
              <StatusBadge label={ORDER_STATUS_LABEL[order.orderStatus]} backgroundColor={sc.bg} textColor={sc.text} />
              <StatusBadge label={PAYMENT_STATUS_LABEL[order.paymentStatus]} backgroundColor={pc.bg} textColor={pc.text} />
            </View>
            <Text variant="h5" weight="bold" style={{ color: theme.colors.text }}>
              {order.customerName ?? 'Customer'}
            </Text>
            {!!order.customerPhone && (
              <Text variant="body-sm" style={{ color: theme.colors.textSecondary }}>{order.customerPhone}</Text>
            )}
            <Text variant="body-sm" style={{ color: theme.colors.textSecondary }}>
              {formatDateTime(order.orderDate)}
              {'  ·  '}{order.paymentMethod === 'PAY_LATER' ? 'Pay Later' : 'Pay Now'}
            </Text>
            {!!order.customerNotes && (
              <Text variant="body-sm" style={[styles.notes, { color: theme.colors.textSecondary }]}>
                “{order.customerNotes}”
              </Text>
            )}
            {order.orderStatus === 'CANCELLED' && !!order.cancellationReason && (
              <Text variant="body-sm" style={[styles.notes, { color: theme.colors.error[500] }]}>
                Reason: {order.cancellationReason}
              </Text>
            )}
          </View>
        </Card>

        {/* Items */}
        <Card variant="elevated" padding="lg" borderRadius="lg">
          <View style={styles.section}>
            <Text variant="h6" weight="bold" style={{ color: theme.colors.text }}>Items</Text>
            {(order.items ?? []).map((it) => (
              <View key={it.id} style={styles.itemRow}>
                <View style={styles.itemInfo}>
                  <Text variant="body-sm" weight="medium" numberOfLines={1} style={{ color: theme.colors.text }}>
                    {it.productName}
                  </Text>
                  <Text variant="body-xs" style={{ color: theme.colors.textSecondary }}>
                    {it.quantity} × {formatCurrency(it.unitPrice)}
                  </Text>
                </View>
                <Text variant="body-sm" weight="semibold" style={{ color: theme.colors.text }}>
                  {formatCurrency(it.lineTotal)}
                </Text>
              </View>
            ))}

            <View style={[styles.divider, { backgroundColor: theme.colors.borderSubtle }]} />
            <InfoRow label="Subtotal" value={formatCurrency(order.subtotal)} />
            {order.vatAmount > 0 && <InfoRow label="VAT" value={formatCurrency(order.vatAmount)} />}
            <InfoRow label="Total" value={formatCurrency(order.totalAmount)} emphasis />
          </View>
        </Card>
      </ScrollView>

      {/* Action bar — linear stepper + complete/cancel + payment */}
      {showActionBar && (
        <View style={[styles.actionBar, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.borderSubtle }]}>
          {unpaid && order.orderStatus !== 'CANCELLED' && (
            <Button
              title="Mark as Paid"
              variant="outline"
              tone="success"
              onPress={() => doMarkPaid(true)}
              disabled={isUpdating}
              fullWidth
            />
          )}

          {primaryNext && (
            <Button
              title={ADVANCE_LABEL[primaryNext]}
              variant="primary"
              tone={primaryNext === 'COMPLETED' ? 'success' : 'brand'}
              onPress={() => doChangeStatus(primaryNext)}
              loading={isUpdating}
              disabled={isUpdating}
              fullWidth
            />
          )}

          {(showQuickComplete || canCancel) && (
            <View style={styles.secondaryRow}>
              {showQuickComplete && (
                <Button
                  title="Complete Now"
                  variant="outline"
                  tone="success"
                  onPress={() => doChangeStatus('COMPLETED')}
                  disabled={isUpdating}
                  style={styles.flexBtn}
                />
              )}
              {canCancel && (
                <Button
                  title="Cancel Order"
                  variant="outline"
                  tone="danger"
                  onPress={() => doChangeStatus('CANCELLED')}
                  disabled={isUpdating}
                  style={styles.flexBtn}
                />
              )}
            </View>
          )}
        </View>
      )}
      {dialog.Dialog}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  scroll: { padding: 16, paddingBottom: 24, gap: 12 },
  section: { gap: 6 },
  statusRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  notes: { fontStyle: 'italic', marginTop: 2 },
  itemRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 4 },
  itemInfo: { flex: 1, gap: 2 },
  divider: { height: 1, marginVertical: 8 },
  actionBar: {
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    borderTopWidth: 1,
  },
  secondaryRow: { flexDirection: 'row', gap: 10 },
  flexBtn: { flex: 1 },
});
