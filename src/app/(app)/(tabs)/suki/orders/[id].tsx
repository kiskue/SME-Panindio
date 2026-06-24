import React, { useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Text } from '@/components/atoms/Text';
import { useAppDialog } from '@/hooks';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  useBusinessOrdersStore,
  selectBusinessSelectedOrder,
  selectBusinessOrdersLoading,
  selectBusinessOrdersUpdating,
} from '@/store';
import { useAppTheme, useThemeMode } from '@/core/theme';
import { theme as staticTheme } from '@/core/theme';
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
  const appTheme = useAppTheme();
  const isDark = useThemeMode() === 'dark';

  const { id } = useLocalSearchParams<{ id: string }>();
  const order = useBusinessOrdersStore(selectBusinessSelectedOrder);
  const isLoading = useBusinessOrdersStore(selectBusinessOrdersLoading);
  const isUpdating = useBusinessOrdersStore(selectBusinessOrdersUpdating);
  const { loadOrder, changeStatus, changePaymentStatus } = useBusinessOrdersStore();

  useEffect(() => {
    if (id) void loadOrder(id);
  }, [id, loadOrder]);

  // ── Dynamic tokens ────────────────────────────────────────────────────────────
  const rootBg       = isDark ? '#0F1117' : '#F0F4F8';
  const cardBg       = isDark ? '#1A2235' : '#FFFFFF';
  const cardBorder   = isDark ? 'rgba(255,255,255,0.07)' : 'transparent';
  const primaryColor = isDark ? '#4F9EFF' : appTheme.colors.primary[500];
  const headerBg     = isDark ? '#151A27' : appTheme.colors.primary[500];
  const textPrimary: string   = isDark ? '#F1F5F9' : '#111111';
  const textSecondary: string = isDark ? 'rgba(255,255,255,0.55)' : staticTheme.colors.textSecondary;
  const dividerColor: string  = isDark ? 'rgba(255,255,255,0.07)' : '#F0F4F8';

  if (isLoading && !order) {
    return (
      <View style={[styles.root, { backgroundColor: rootBg }]}>
        <ActivityIndicator color={primaryColor} size="large" style={{ marginTop: 80 }} />
      </View>
    );
  }

  if (!order) {
    return (
      <View style={[styles.root, { backgroundColor: rootBg, alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ color: textPrimary, fontWeight: '700', marginBottom: 12 }}>Order not found</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: primaryColor, fontWeight: '700' }}>← Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const sc = ORDER_STATUS_COLORS(isDark)[order.orderStatus];
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

  return (
    <View style={[styles.root, { backgroundColor: rootBg }]}>
      <View style={[styles.header, { backgroundColor: headerBg }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Order #{order.orderNumber}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Status + customer */}
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <View style={styles.statusRow}>
            <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
              <Text style={[styles.statusText, { color: sc.text }]}>{ORDER_STATUS_LABEL[order.orderStatus]}</Text>
            </View>
            <View style={[styles.payBadge, { backgroundColor: unpaid ? (isDark ? 'rgba(255,107,107,0.15)' : '#FEF2F2') : (isDark ? 'rgba(61,214,140,0.15)' : '#ECFDF5') }]}>
              <Text style={[styles.payText, { color: unpaid ? '#EF4444' : '#27AE60' }]}>
                {PAYMENT_STATUS_LABEL[order.paymentStatus]}
              </Text>
            </View>
          </View>
          <Text style={[styles.customerName, { color: textPrimary }]}>{order.customerName ?? 'Customer'}</Text>
          {!!order.customerPhone && <Text style={[styles.customerPhone, { color: textSecondary }]}>{order.customerPhone}</Text>}
          <Text style={[styles.orderMeta, { color: textSecondary }]}>
            {new Date(order.orderDate).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
            {'  ·  '}{order.paymentMethod === 'PAY_LATER' ? 'Pay Later' : 'Pay Now'}
          </Text>
          {!!order.customerNotes && (
            <Text style={[styles.notes, { color: textSecondary }]}>“{order.customerNotes}”</Text>
          )}
          {order.orderStatus === 'CANCELLED' && !!order.cancellationReason && (
            <Text style={[styles.notes, { color: '#EF4444' }]}>Reason: {order.cancellationReason}</Text>
          )}
        </View>

        {/* Items */}
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <Text style={[styles.sectionTitle, { color: textPrimary }]}>Items</Text>
          {(order.items ?? []).map((it, idx) => (
            <View
              key={it.id}
              style={[styles.itemRow, idx > 0 && { borderTopWidth: 1, borderTopColor: dividerColor }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.itemName, { color: textPrimary }]} numberOfLines={1}>{it.productName}</Text>
                <Text style={[styles.itemMeta, { color: textSecondary }]}>
                  ₱{it.unitPrice.toFixed(2)} × {it.quantity}
                </Text>
              </View>
              <Text style={[styles.itemTotal, { color: textPrimary }]}>₱{it.lineTotal.toFixed(2)}</Text>
            </View>
          ))}

          <View style={[styles.divider, { backgroundColor: dividerColor }]} />
          <SummaryRow label="Subtotal" value={`₱${order.subtotal.toFixed(2)}`} c={textSecondary} cv={textPrimary} />
          {order.vatAmount > 0 && <SummaryRow label="VAT" value={`₱${order.vatAmount.toFixed(2)}`} c={textSecondary} cv={textPrimary} />}
          <SummaryRow label="Total" value={`₱${order.totalAmount.toFixed(2)}`} bold c={textSecondary} cv={primaryColor} />
        </View>
      </ScrollView>

      {/* Action bar — linear stepper + complete/cancel + payment */}
      {(!isTerminal || (unpaid && order.orderStatus !== 'CANCELLED')) && (
        <View style={[styles.actionBar, { backgroundColor: cardBg, borderTopColor: dividerColor }]}>
          {unpaid && order.orderStatus !== 'CANCELLED' && (
            <TouchableOpacity
              style={[styles.fullOutlineBtn, { borderColor: primaryColor }]}
              onPress={() => doMarkPaid(true)}
              disabled={isUpdating}
            >
              <Text style={[styles.outlineBtnText, { color: primaryColor }]}>Mark as Paid</Text>
            </TouchableOpacity>
          )}

          {primaryNext && (
            <TouchableOpacity
              style={[
                styles.advanceBtn,
                { backgroundColor: primaryNext === 'COMPLETED' ? '#27AE60' : primaryColor },
                isUpdating && styles.btnDisabled,
              ]}
              onPress={() => doChangeStatus(primaryNext)}
              disabled={isUpdating}
            >
              {isUpdating ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.advanceBtnText}>{ADVANCE_LABEL[primaryNext]}</Text>
              )}
            </TouchableOpacity>
          )}

          {(showQuickComplete || canCancel) && (
            <View style={styles.secondaryRow}>
              {showQuickComplete && (
                <TouchableOpacity
                  style={[styles.fullOutlineBtn, { borderColor: '#27AE60', flex: 1 }]}
                  onPress={() => doChangeStatus('COMPLETED')}
                  disabled={isUpdating}
                >
                  <Text style={[styles.outlineBtnText, { color: '#27AE60' }]}>Complete Now</Text>
                </TouchableOpacity>
              )}
              {canCancel && (
                <TouchableOpacity
                  style={[styles.fullOutlineBtn, { borderColor: '#EF4444', flex: 1 }]}
                  onPress={() => doChangeStatus('CANCELLED')}
                  disabled={isUpdating}
                >
                  <Text style={[styles.outlineBtnText, { color: '#EF4444' }]}>Cancel Order</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      )}
      {dialog.Dialog}
    </View>
  );
}

interface SummaryRowProps { label: string; value: string; bold?: boolean; c: string; cv: string }
function SummaryRow({ label, value, bold, c, cv }: SummaryRowProps) {
  return (
    <View style={styles.summaryRow}>
      <Text style={[{ fontSize: 13, color: c }, bold && { fontWeight: '700' }]}>{label}</Text>
      <Text style={[{ fontSize: 13, color: cv }, bold && { fontWeight: '800', fontSize: 16 }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingTop: 52, paddingBottom: 16, paddingHorizontal: 20 },
  backBtn: { marginBottom: 8 },
  backText: { color: 'rgba(255,255,255,0.80)', fontSize: 13, fontWeight: '600' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#FFFFFF' },
  scroll: { padding: 16, paddingBottom: 24 },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  statusRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  statusBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  statusText: { fontSize: 11, fontWeight: '700' },
  payBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  payText: { fontSize: 11, fontWeight: '700' },
  customerName: { fontSize: 17, fontWeight: '800' },
  customerPhone: { fontSize: 13, marginTop: 2 },
  orderMeta: { fontSize: 12, marginTop: 6 },
  notes: { fontSize: 12, marginTop: 8, fontStyle: 'italic' },
  sectionTitle: { fontSize: 14, fontWeight: '800', marginBottom: 8 },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  itemName: { fontSize: 14, fontWeight: '600' },
  itemMeta: { fontSize: 12, marginTop: 2 },
  itemTotal: { fontSize: 14, fontWeight: '700' },
  divider: { height: 1, marginVertical: 10 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  actionBar: {
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 28,
    borderTopWidth: 1,
  },
  secondaryRow: { flexDirection: 'row', gap: 10 },
  advanceBtn: { borderRadius: 12, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  advanceBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  fullOutlineBtn: { borderWidth: 1.5, borderRadius: 12, paddingVertical: 13, alignItems: 'center', justifyContent: 'center' },
  outlineBtnText: { fontWeight: '700', fontSize: 14 },
  btnDisabled: { opacity: 0.6 },
});
