import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Text } from '@/components/atoms/Text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useOnlineOrdersStore, selectCustomerOrders } from '@/store';
import { useThemeMode } from '@/core/theme';
import { theme as staticTheme } from '@/core/theme';

const NAVY  = '#1E4D8C';
const AMBER = '#F5A623';
const GREEN = '#27AE60';

const STATUS_STEPS = ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'COMPLETED'];

export default function OrderDetailScreen() {
  const router = useRouter();
  const mode = useThemeMode();
  const isDark = mode === 'dark';

  const { id } = useLocalSearchParams<{ id: string }>();
  const orders = useOnlineOrdersStore(selectCustomerOrders);
  const order = orders.find((o) => o.id === id);

  // ── Dynamic tokens ────────────────────────────────────────────────────────────
  const rootBg       = isDark ? '#0F1117' : '#F0F4F8';
  const primaryColor = isDark ? '#4F9EFF' : NAVY;
  const cardBg       = isDark ? '#1A2235' : '#FFFFFF';
  const cardBorder   = isDark ? 'rgba(255,255,255,0.07)' : 'transparent';
  const textPrimary: string    = isDark ? '#F1F5F9' : '#111111';
  const textSecondary: string  = isDark ? 'rgba(255,255,255,0.55)' : staticTheme.colors.textSecondary;
  const dividerColor: string   = isDark ? 'rgba(255,255,255,0.07)' : '#F0F4F8';
  const backLinkColor = isDark ? '#4F9EFF' : NAVY;

  const timelineDotDefault = isDark ? '#374151' : '#E5E7EB';
  const timelineLineDefault = isDark ? '#374151' : '#E5E7EB';

  const cancelledBoxBg   = isDark ? 'rgba(239,68,68,0.10)' : '#FEF2F2';
  const cancelledText    = isDark ? '#FF6B6B' : '#991B1B';
  const cancelledReason  = isDark ? '#FF8A8A' : '#B91C1C';

  if (!order) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: rootBg }]} edges={['top', 'bottom']}>
        <View style={styles.notFound}>
          <Text style={[styles.notFoundText, { color: textPrimary }]}>Order not found</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={[styles.backLink, { color: backLinkColor }]}>← Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const currentStepIndex = STATUS_STEPS.indexOf(order.orderStatus);

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
        <Text style={styles.headerTitle}>Order #{order.orderNumber}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Order status timeline */}
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <Text style={[styles.cardTitle, { color: textPrimary }]}>Order Status</Text>
          {STATUS_STEPS.map((step, index) => {
            const isDone = index < currentStepIndex;
            const isActive = index === currentStepIndex;
            const isCancelled = order.orderStatus === 'CANCELLED';
            return (
              <View key={step} style={styles.timelineRow}>
                <View style={[
                  styles.timelineDot,
                  { backgroundColor: timelineDotDefault },
                  isDone && { backgroundColor: GREEN },
                  isActive && !isCancelled && { backgroundColor: AMBER },
                  isCancelled && index === 0 && { backgroundColor: '#EF4444' },
                ]} />
                {index < STATUS_STEPS.length - 1 && (
                  <View style={[
                    styles.timelineLine,
                    { backgroundColor: timelineLineDefault },
                    isDone && { backgroundColor: GREEN },
                  ]} />
                )}
                <Text style={[
                  styles.timelineLabel,
                  { color: textSecondary },
                  isActive && { fontWeight: '700', color: textPrimary },
                ]}>
                  {step.charAt(0) + step.slice(1).toLowerCase()}
                </Text>
              </View>
            );
          })}
          {order.orderStatus === 'CANCELLED' && (
            <View style={[styles.cancelledBadge, { backgroundColor: cancelledBoxBg }]}>
              <Text style={[styles.cancelledText, { color: cancelledText }]}>CANCELLED</Text>
              {order.cancellationReason && (
                <Text style={[styles.cancelledReason, { color: cancelledReason }]}>{order.cancellationReason}</Text>
              )}
            </View>
          )}
        </View>

        {/* Order summary */}
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <Text style={[styles.cardTitle, { color: textPrimary }]}>Order Summary</Text>
          <InfoRow label="Order Date" value={new Date(order.orderDate).toLocaleString('en-PH')} textSecondary={textSecondary} primaryColor={primaryColor} />
          <InfoRow label="Payment" value={order.paymentMethod === 'PAY_LATER' ? 'Pay Later (Credit)' : 'Pay Now'} textSecondary={textSecondary} primaryColor={primaryColor} />
          <InfoRow label="Payment Status" value={order.paymentStatus} textSecondary={textSecondary} primaryColor={primaryColor} />
          <View style={[styles.divider, { backgroundColor: dividerColor }]} />
          <InfoRow label="Subtotal" value={`₱${order.subtotal.toFixed(2)}`} textSecondary={textSecondary} primaryColor={primaryColor} />
          {order.vatAmount > 0 && <InfoRow label="VAT" value={`₱${order.vatAmount.toFixed(2)}`} textSecondary={textSecondary} primaryColor={primaryColor} />}
          <InfoRow label="Total" value={`₱${order.totalAmount.toFixed(2)}`} bold textSecondary={textSecondary} primaryColor={primaryColor} />
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

interface InfoRowProps {
  label: string; value: string; bold?: boolean;
  textSecondary: string; primaryColor: string;
}
function InfoRow({ label, value, bold, textSecondary, primaryColor }: InfoRowProps) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
      <Text style={{ fontSize: 12, color: textSecondary }}>{label}</Text>
      <Text style={[{ fontSize: 13 }, bold && { fontWeight: '800', color: primaryColor, fontSize: 15 }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { backgroundColor: NAVY, paddingTop: 16, paddingBottom: 20, paddingHorizontal: 20 },
  brandStripe: { position: 'absolute', top: 0, left: 0, right: 0, height: 3, flexDirection: 'row' },
  stripe: { flex: 1 },
  backBtn: { marginBottom: 8 },
  backText: { color: 'rgba(255,255,255,0.80)', fontSize: 13, fontWeight: '600' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#FFFFFF' },
  scroll: { padding: 16 },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', marginBottom: 14 },
  timelineRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  timelineDot: { width: 16, height: 16, borderRadius: 8 },
  timelineLine: { width: 2, height: 16, position: 'absolute', left: 7, top: 16 },
  timelineLabel: { fontSize: 13 },
  cancelledBadge: { borderRadius: 8, padding: 10, marginTop: 8 },
  cancelledText: { fontSize: 12, fontWeight: '800' },
  cancelledReason: { fontSize: 11, marginTop: 4 },
  divider: { height: 1, marginVertical: 8 },
  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  notFoundText: { fontSize: 16 },
  backLink: { fontWeight: '700' },
});
