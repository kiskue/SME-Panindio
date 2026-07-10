import React from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import { ShoppingCart } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { Badge } from '@/components/atoms/Badge';
import { useOnlineOrdersStore, selectCartItemCount } from '@/store';

export interface CartButtonProps {
  /** Icon color. Defaults to white (for use on the brand-navy header). */
  color?: string;
  /** Icon size in px. Default `24`. */
  size?: number;
}

/**
 * Header cart entry point: a tappable cart icon with a live item-count badge.
 * Subscribes to the online-orders store directly so it updates the moment an
 * item is added, and navigates to the customer cart on press. Used in the
 * customer home + products headers.
 */
export const CartButton: React.FC<CartButtonProps> = ({ color = '#FFFFFF', size = 24 }) => {
  const router = useRouter();
  const count = useOnlineOrdersStore(selectCartItemCount);

  return (
    <Pressable
      onPress={() => router.push('/(customer)/cart')}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={`Cart, ${count} item${count === 1 ? '' : 's'}`}
      style={styles.button}
    >
      <ShoppingCart size={size} color={color} />
      {count > 0 && (
        <View style={styles.badge}>
          <Badge count={count} variant="warning" size="sm" />
        </View>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 2,
  },
});
