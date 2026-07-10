import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ShoppingCart } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { Button } from '@/components/atoms/Button/Button';
import { useAppTheme } from '@/core/theme';
import { formatCurrency } from '@/core/utils/format';
import {
  useOnlineOrdersStore,
  selectCartItemCount,
  selectOnlineCartSubtotal,
} from '@/store';

export interface CartBarProps {
  /**
   * Distance from the bottom of the screen to float the bar, in px. Pass the
   * tab bar height + safe-area inset so the bar sits ABOVE the liquid-glass tab
   * bar instead of behind it.
   * @default 0
   */
  bottomOffset?: number;
}

/**
 * Foodpanda-style floating "View Cart" bar.
 *
 * Subscribes to the online-orders cart directly and shows a persistent
 * call-to-action — "View Cart · N items · ₱total" — that navigates to the
 * customer cart. Hidden entirely when the cart is empty. Position it above the
 * liquid-glass tab bar by passing `bottomOffset` (tab bar height + safe-area
 * inset) from the host screen.
 */
export const CartBar: React.FC<CartBarProps> = ({ bottomOffset = 0 }) => {
  const router = useRouter();
  const theme = useAppTheme();
  const count = useOnlineOrdersStore(selectCartItemCount);
  const subtotal = useOnlineOrdersStore(selectOnlineCartSubtotal);

  if (count <= 0) return null;

  const itemLabel = `${count} item${count === 1 ? '' : 's'}`;

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { bottom: bottomOffset }]}
    >
      <Button
        title={`View Cart  ·  ${itemLabel}  ·  ${formatCurrency(subtotal)}`}
        onPress={() => router.push('/(customer)/cart')}
        variant="primary"
        size="lg"
        fullWidth
        leftIcon={<ShoppingCart size={20} color={theme.colors.white} style={styles.icon} />}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    // Lift the bar a little off whatever sits below it (tab bar / screen edge).
    marginBottom: 8,
  },
  icon: { marginRight: 8 },
});
