import React, { useState } from 'react';
import { View, StyleSheet, FlatList, Pressable } from 'react-native';
import { ShoppingCart, Trash2 } from 'lucide-react-native';
import { Text } from '@/components/atoms/Text';
import { Card } from '@/components/atoms/Card';
import { Divider } from '@/components/atoms/Divider';
import { Tag } from '@/components/atoms/Tag';
import { Button } from '@/components/atoms/Button/Button';
import { RadioGroup } from '@/components/atoms/Radio';
import { QuantityStepper } from '@/components/atoms/QuantityStepper';
import { EmptyState } from '@/components/molecules/EmptyState';
import { InfoRow } from '@/components/molecules/InfoRow';
import { useAppDialog } from '@/hooks';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useSukiStore, selectCurrentCustomer } from '@/store';
import {
  useOnlineOrdersStore,
  selectCustomerCart,
  selectOnlineCartSubtotal,
  selectIsPlacingOrder,
} from '@/store';
import { useVatStore, selectVatEnabled } from '@/store';
import { VAT_RATE } from '@/core/vat';
import { canUsePayLater } from '@/types';
import { useThemeMode, useAppTheme } from '@/core/theme';
import { formatCurrency } from '@/core/utils/format';
import { CustomerHeader } from '@/features/customer/components/CustomerHeader';
import type { OnlineCartItem } from '@/types';

export default function CustomerCartScreen() {
  const router = useRouter();
  const dialog = useAppDialog();
  const isDark = useThemeMode() === 'dark';
  const theme = useAppTheme();

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

  const rootBg = isDark ? theme.colors.background : '#F0F4F8';
  const primaryColor = theme.colors.primary[500];

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
      router.replace({
        pathname: '/(customer)/order-confirm',
        params: { orderId: order.id, orderNumber: order.orderNumber, total: String(order.totalAmount) },
      });
    } catch (err) {
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

  if (cart.length === 0) {
    return (

      <SafeAreaView style={[styles.root, { backgroundColor: rootBg }]} edges={['top', 'bottom']}>
        <StatusBar style="light" />
        <CustomerHeader title="My Cart" onBack={() => router.back()} />
        <EmptySt  ate
          style={styles.fill}
          title="Your cart is empty"
          description="Browse the catalog and add items to
           get started."
          icon={<ShoppingCart size={28} color={theme.colors.gray[400]} />}
          action={{ label: 'Browse Products', onPress: () => router.replace('/(customer)/products'), variant: 'primary' }}
        />
        {dialog.Dialog}
      </SafeAreaView>
    );
  }

  const renderItem = ({ item }: { item: OnlineCartItem }) => {
    const stock = item.catalogItem.stockQuantity;
    const atMax = item.quantity >= stock;
    return (
      <Card variant="elevated" shadow="sm" style={styles.cartCard}>
        <View style={styles.cartTop}>
          <View style={styles.cartInfo}>
            <Text variant="body-sm" weight="semibold" style={{ color: theme.colors.text }} numberOfLines={1}>
              {item.catalogItem.productName}
            </Text>
            <Text variant="body-xs" color="textSecondary" style={styles.cartUnit}>
              {formatCurrency(item.unitPrice)} each
            </Text>
            <Tag
              size="sm"
              color={atMax ? 'warning' : 'gray'}
              variant="subtle"
              label={atMax ? `${stock} in stock · max` : `${stock} in stock`}
              style={styles.stockTag}
            />
          </View>

          <Pressable
            onPress={() => removeFromCart(item.catalogItem.id)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Remove item"
            style={styles.removeBtn}
          >
            <Trash2 size={18} color={theme.colors.gray[400]} />
          </Pressable>
        </View>

        <View style={styles.cartBottom}>
          <QuantityStepper
            value={item.quantity}
            min={1}
            max={stock}
            size="sm"
            onChange={(next) => updateCartQty(item.catalogItem.id, next)}
            onAtMax={() =>
              dialog.show({ variant: 'error', title: 'Stock limit reached', message: `Only ${stock} available.` })
            }
          />
          <Text variant="body-sm" weight="bold" style={{ color: primaryColor }}>
            {formatCurrency(item.lineTotal)}
          </Text>
        </View>
      </Card>
    );
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: rootBg }]} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <CustomerHeader title="My Cart" subtitle={`${cart.length} item${cart.length !== 1 ? 's' : ''}`} onBack={() => router.back()} />

      <FlatList
        data={cart}
        keyExtractor={(item) => item.catalogItem.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        renderItem={renderItem}
        ListFooterComponent={
          <Card variant="elevated" shadow="md" padding="lg" style={styles.summaryCard}>
            <InfoRow label="Subtotal" value={formatCurrency(subtotal)} />
            {vatEnabled && <InfoRow label="VAT (12%)" value={formatCurrency(vatAmount)} />}
            <Divider color={isDark ? 'rgba(255,255,255,0.07)' : '#F0F4F8'} spacing="sm" />
            <InfoRow label="Total" value={formatCurrency(total)} emphasis />

            <Text variant="body-sm" weight="bold" style={[styles.payLabel, { color: theme.colors.text }]}>
              Payment Method
            </Text>
            <RadioGroup
              value={paymentMethod}
              onChange={(v) => {
                if (v === 'PAY_LATER' && !payLaterAllowed) {
                  dialog.show({ variant: 'info', title: 'Verification required', message: 'Complete your identity verification to use Pay Later.' });
                  return;
                }
                setPaymentMethod(v as 'PAY_NOW' | 'PAY_LATER');
              }}
              options={[
                { value: 'PAY_NOW', label: 'Pay Now' },
                {
                  value: 'PAY_LATER',
                  label: 'Pay Later',
                  disabled: !payLaterAllowed,
                  ...(!payLaterAllowed ? { description: 'Verify your account to unlock Pay Later orders.' } : {}),
                },
              ]}
            />

            {!payLaterAllowed && (
              <Text variant="body-xs" style={[styles.verifyLink, { color: primaryColor }]} onPress={() => router.push('/(customer)/profile')}>
                Verify Now →
              </Text>
            )}

            <Button
              title={`Place Order · ${formatCurrency(total)}`}
              fullWidth
              loading={isPlacing}
              onPress={handlePlaceOrder}
              style={styles.placeBtn}
            />
          </Card>
        }
      />
      {dialog.Dialog}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fill: { flex: 1 },
  list: { padding: 16 },

  cartCard: { marginBottom: 10 },
  cartTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  cartInfo: { flex: 1 },
  cartUnit: { marginTop: 2 },
  stockTag: { marginTop: 6 },
  removeBtn: { padding: 4, marginLeft: 8 },
  cartBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },

  summaryCard: { marginTop: 8 },
  payLabel: { marginTop: 16, marginBottom: 10 },
  verifyLink: { marginTop: 8, fontWeight: '700' },
  placeBtn: { marginTop: 16 },
});
