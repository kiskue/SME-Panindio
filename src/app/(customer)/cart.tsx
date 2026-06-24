import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Text } from '@/components/atoms/Text';
import { useAppDialog } from '@/hooks';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useSukiStore, selectCurrentCustomer } from '@/store';
import { useOnlineOrdersStore, selectCustomerCart, selectOnlineCartSubtotal, selectIsPlacingOrder } from '@/store';
import { useVatStore, selectVatEnabled } from '@/store';
import { VAT_RATE } from '@/core/vat';
import { canUsePayLater } from '@/types';
import { useThemeMode } from '@/core/theme';
import { theme as staticTheme } from '@/core/theme';
import type { OnlineCartItem } from '@/types';

const NAVY  = '#1E4D8C';
const AMBER = '#F5A623';
const GREEN = '#27AE60';

export default function CustomerCartScreen() {
  const router = useRouter();
  const dialog = useAppDialog();
  const mode = useThemeMode();
  const isDark = mode === 'dark';

  const customer = useSukiStore(selectCurrentCustomer);
  const cart = useOnlineOrdersStore(selectCustomerCart);
  const subtotal = useOnlineOrdersStore(selectOnlineCartSubtotal);
  const isPlacing = useOnlineOrdersStore(selectIsPlacingOrder);
  const vatEnabled = useVatStore(selectVatEnabled);
  const { removeFromCart, updateCartQty, placeOrder } = useOnlineOrdersStore();

  const [paymentMethod, setPaymentMethod] = useState<'PAY_NOW' | 'PAY_LATER'>('PAY_NOW');

  const vatAmount = vatEnabled ? Math.round(subtotal * VAT_RATE * 100) / 100 : 0;
  const total = subtotal + vatAmount;

  const payLaterAllowed = customer ? canUsePayLater(customer) : false;

  const handlePlaceOrder = async () => {
    if (!customer) return;
    if (cart.length === 0) {
      dialog.show({ variant: 'error', title: 'Empty cart', message: 'Add items before placing an order.' });
      return;
    }
    if (paymentMethod === 'PAY_LATER' && !payLaterAllowed) {
      dialog.show({ variant: 'error', title: 'Not allowed', message: 'Verify your account to use Pay Later.' });
      return;
    }
    try {
      const order = await placeOrder(customer.id, paymentMethod, vatEnabled);
      router.replace({ pathname: '/(customer)/order-confirm', params: { orderId: order.id, orderNumber: order.orderNumber, total: String(order.totalAmount) } });
    } catch (err) {
      // placeOrder throws the backend error code; map the ones worth explaining.
      const code = err instanceof Error ? err.message : '';
      if (code === 'INSUFFICIENT_STOCK') {
        dialog.show({
          variant: 'error',
          title: 'Not enough stock',
          message: 'One or more items exceed the available stock. Please lower the quantity and try again.',
        });
      } else if (code === 'CATALOG_ITEM_UNAVAILABLE') {
        dialog.show({ variant: 'error', title: 'Item unavailable', message: 'One or more items are no longer available. Please review your cart.' });
      } else if (code === 'PAY_LATER_NOT_ALLOWED') {
        dialog.show({ variant: 'error', title: 'Pay Later not allowed', message: 'Verify your account to use Pay Later.' });
      } else {
        dialog.show({ variant: 'error', title: 'Order failed', message: 'Could not place your order. Please try again.' });
      }
    }
  };

  // ── Dynamic tokens ────────────────────────────────────────────────────────────
  const rootBg       = isDark ? '#0F1117' : '#F0F4F8';
  const primaryColor = isDark ? '#4F9EFF' : NAVY;
  const cardBg       = isDark ? '#1A2235' : '#FFFFFF';
  const cardBorder   = isDark ? 'rgba(255,255,255,0.07)' : 'transparent';
  const textPrimary: string    = isDark ? '#F1F5F9' : '#111111';
  const textSecondary: string  = isDark ? 'rgba(255,255,255,0.55)' : staticTheme.colors.textSecondary;
  const dividerColor: string   = isDark ? 'rgba(255,255,255,0.07)' : '#F0F4F8';
  const qtyBtnBg     = isDark ? '#1E2435' : '#F0F4F8';
  const removeBtnColor: string = isDark ? 'rgba(255,255,255,0.30)' : '#9CA3AF';
  const placeOrderBg = isDark ? '#2D4A7A' : NAVY;
  const payLaterLinkColor = isDark ? '#4F9EFF' : NAVY;
  const shopBtnBg    = isDark ? '#2D4A7A' : NAVY;
  const emptyTitleColor: string = isDark ? '#F1F5F9' : '#111111';

  if (cart.length === 0) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: rootBg }]} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <View style={styles.brandStripe}>
            <View style={[styles.stripe, { backgroundColor: NAVY }]} />
            <View style={[styles.stripe, { backgroundColor: AMBER }]} />
            <View style={[styles.stripe, { backgroundColor: GREEN }]} />
          </View>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Cart</Text>
        </View>
        <View style={styles.emptyState}>
          <Text style={[styles.emptyTitle, { color: emptyTitleColor }]}>Your cart is empty</Text>
          <TouchableOpacity style={[styles.shopBtn, { backgroundColor: shopBtnBg }]} onPress={() => router.replace('/(customer)/products')}>
            <Text style={styles.shopBtnText}>Browse Products</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const renderItem = ({ item }: { item: OnlineCartItem }) => {
    const atMax = item.quantity >= item.catalogItem.stockQuantity;
    return (
      <View style={[styles.cartRow, { backgroundColor: cardBg, borderColor: cardBorder }]}>
        <View style={styles.cartInfo}>
          <Text style={[styles.cartName, { color: textPrimary }]} numberOfLines={1}>{item.catalogItem.productName}</Text>
          <Text style={[styles.cartPrice, { color: textSecondary }]}>₱{item.unitPrice.toFixed(2)} each</Text>
          <Text style={[styles.cartStock, { color: atMax ? AMBER : textSecondary }]}>
            {item.catalogItem.stockQuantity} in stock{atMax ? ' · max' : ''}
          </Text>
        </View>
        <View style={styles.cartQty}>
          <TouchableOpacity onPress={() => updateCartQty(item.catalogItem.id, item.quantity - 1)} style={[styles.qtyBtn, { backgroundColor: qtyBtnBg }]}>
            <Text style={[styles.qtyBtnText, { color: primaryColor }]}>−</Text>
          </TouchableOpacity>
          <Text style={[styles.qtyText, { color: textPrimary }]}>{item.quantity}</Text>
          <TouchableOpacity
            onPress={() => {
              if (atMax) {
                dialog.show({ variant: 'error', title: 'Stock limit reached', message: `Only ${item.catalogItem.stockQuantity} available.` });
                return;
              }
              updateCartQty(item.catalogItem.id, item.quantity + 1);
            }}
            style={[styles.qtyBtn, { backgroundColor: qtyBtnBg }, atMax && styles.qtyBtnDisabled]}
            disabled={atMax}
          >
            <Text style={[styles.qtyBtnText, { color: primaryColor }]}>+</Text>
          </TouchableOpacity>
        </View>
        <Text style={[styles.lineTotal, { color: primaryColor }]}>₱{item.lineTotal.toFixed(2)}</Text>
        <TouchableOpacity onPress={() => removeFromCart(item.catalogItem.id)} style={styles.removeBtn}>
          <Text style={[styles.removeBtnText, { color: removeBtnColor }]}>✕</Text>
        </TouchableOpacity>
      </View>
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
        <Text style={styles.headerTitle}>My Cart ({cart.length} item{cart.length !== 1 ? 's' : ''})</Text>
      </View>

      <FlatList
        data={cart}
        keyExtractor={(item) => item.catalogItem.id}
        contentContainerStyle={styles.list}
        renderItem={renderItem}
        ListFooterComponent={
          <View style={[styles.summaryCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <SummaryRow label="Subtotal" value={`₱${subtotal.toFixed(2)}`} textSecondary={textSecondary} textPrimary={textPrimary} primaryColor={primaryColor} />
            {vatEnabled && <SummaryRow label="VAT (12%)" value={`₱${vatAmount.toFixed(2)}`} textSecondary={textSecondary} textPrimary={textPrimary} primaryColor={primaryColor} />}
            <View style={[styles.divider, { backgroundColor: dividerColor }]} />
            <SummaryRow label="Total" value={`₱${total.toFixed(2)}`} bold textSecondary={textSecondary} textPrimary={textPrimary} primaryColor={primaryColor} />

            <Text style={[styles.payLabel, { color: textPrimary }]}>Payment Method</Text>
            <View style={styles.payOptions}>
              <PayOption
                label="Pay Now"
                active={paymentMethod === 'PAY_NOW'}
                isDark={isDark}
                primaryColor={primaryColor}
                onPress={() => setPaymentMethod('PAY_NOW')}
              />
              <PayOption
                label="Pay Later"
                active={paymentMethod === 'PAY_LATER'}
                disabled={!payLaterAllowed}
                isDark={isDark}
                primaryColor={primaryColor}
                onPress={() => {
                  if (!payLaterAllowed) {
                    dialog.show({ variant: 'info', title: 'Verification required', message: 'Complete your identity verification to use Pay Later.' });
                  } else {
                    setPaymentMethod('PAY_LATER');
                  }
                }}
              />
            </View>
            {!payLaterAllowed && (
              <Text style={[styles.payLaterHint, { color: textSecondary }]}>
                Verify your account to unlock Pay Later orders.{' '}
                <Text style={{ color: payLaterLinkColor, fontWeight: '700' }} onPress={() => router.push('/(customer)/profile')}>
                  Verify Now
                </Text>
              </Text>
            )}

            <TouchableOpacity
              style={[styles.placeBtn, { backgroundColor: placeOrderBg }, isPlacing && styles.placeBtnDisabled]}
              onPress={handlePlaceOrder}
              disabled={isPlacing}
              activeOpacity={0.85}
            >
              {isPlacing ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.placeBtnText}>Place Order · ₱{total.toFixed(2)}</Text>
              )}
            </TouchableOpacity>
          </View>
        }
      />
      {dialog.Dialog}
    </SafeAreaView>
  );
}

interface SummaryRowProps {
  label: string; value: string; bold?: boolean;
  textSecondary: string; textPrimary: string; primaryColor: string;
}
function SummaryRow({ label, value, bold, textSecondary, textPrimary, primaryColor }: SummaryRowProps) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
      <Text style={[{ fontSize: 13 }, { color: bold ? textPrimary : textSecondary }, bold && { fontWeight: '700' }]}>{label}</Text>
      <Text style={[{ fontSize: 13 }, bold && { fontWeight: '800', color: primaryColor, fontSize: 16 }]}>{value}</Text>
    </View>
  );
}

interface PayOptionProps {
  label: string; active: boolean; disabled?: boolean;
  isDark: boolean; primaryColor: string; onPress: () => void;
}
function PayOption({ label, active, disabled, isDark, primaryColor, onPress }: PayOptionProps) {
  const borderColor = active ? primaryColor : (isDark ? 'rgba(255,255,255,0.12)' : '#DDE3EE');
  const bg          = active ? (isDark ? 'rgba(79,158,255,0.10)' : '#EFF6FF') : (disabled ? (isDark ? 'rgba(255,255,255,0.04)' : '#F5F5F5') : 'transparent');
  const radioFill   = active ? primaryColor : 'transparent';
  const labelColor: string  = active ? primaryColor : (disabled ? (isDark ? 'rgba(255,255,255,0.30)' : '#9CA3AF') : (isDark ? 'rgba(255,255,255,0.55)' : '#6B7280'));

  return (
    <TouchableOpacity
      style={[payStyles.option, { borderColor, backgroundColor: bg }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={[payStyles.radio, { borderColor, backgroundColor: radioFill }]} />
      <Text style={[payStyles.label, { color: labelColor }, active && { fontWeight: '700' }]}>{label}</Text>
      {disabled && <Text style={payStyles.lock}>🔒</Text>}
    </TouchableOpacity>
  );
}
const payStyles = StyleSheet.create({
  option: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderRadius: 10, padding: 12 },
  radio: { width: 16, height: 16, borderRadius: 8, borderWidth: 2 },
  label: { flex: 1, fontSize: 13, fontWeight: '500' },
  lock: { fontSize: 12 },
});

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    backgroundColor: NAVY,
    paddingTop: 16,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  brandStripe: { position: 'absolute', top: 0, left: 0, right: 0, height: 3, flexDirection: 'row' },
  stripe: { flex: 1 },
  backBtn: { marginBottom: 8 },
  backText: { color: 'rgba(255,255,255,0.80)', fontSize: 13, fontWeight: '600' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#FFFFFF' },

  list: { padding: 16 },

  cartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cartInfo: { flex: 1 },
  cartName: { fontSize: 13, fontWeight: '600' },
  cartPrice: { fontSize: 11, marginTop: 2 },
  cartStock: { fontSize: 10, marginTop: 2, fontWeight: '600' },
  cartQty: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qtyBtn: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  qtyBtnDisabled: { opacity: 0.4 },
  qtyBtnText: { fontSize: 16, fontWeight: '700' },
  qtyText: { fontSize: 14, fontWeight: '700', minWidth: 20, textAlign: 'center' },
  lineTotal: { fontSize: 13, fontWeight: '700', minWidth: 64, textAlign: 'right' },
  removeBtn: { padding: 4 },
  removeBtnText: { fontSize: 12 },

  summaryCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  divider: { height: 1, marginVertical: 10 },
  payLabel: { fontSize: 13, fontWeight: '700', marginTop: 16, marginBottom: 8 },
  payOptions: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  payLaterHint: { fontSize: 11, marginBottom: 8 },

  placeBtn: {
    marginTop: 8,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  placeBtnDisabled: { opacity: 0.6 },
  placeBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '700', marginBottom: 16 },
  shopBtn: { borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  shopBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
});
