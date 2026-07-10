import React, { useCallback } from 'react';
import { useAppDialog } from '@/hooks';
import { useOnlineOrdersStore, selectCustomerCart } from '@/store';
import type { OnlineCatalogItem } from '@/types';

export interface UseAddToCartGuardedResult {
  /**
   * Add one unit to the cart, guarding against out-of-stock and cart-limit.
   * Returns `true` when the item was added, `false` when a guard blocked it —
   * so a caller (e.g. the card's add button) can confirm only on real success.
   */
  handleAddToCart: (item: OnlineCatalogItem) => boolean;
  /** The dialog element to render once in the screen tree. */
  Dialog: React.ReactElement;
}

/**
 * The single source of truth for "add one to cart" from a product card.
 *
 * Extracted from the byte-identical `handleAddToCart` that previously lived in
 * both the home screen and the browse screen. Now that the numeric stock badge
 * is gone from the card, these guards are the correctness backstop — they must
 * not diverge between call sites, so both screens consume this hook:
 *   1. out-of-stock  -> error dialog, no add
 *   2. cart already at the item's stock ceiling -> "Stock limit reached", no add
 *   3. otherwise -> addToCart(item, 1) (the store also clamps to stock)
 */
export function useAddToCartGuarded(): UseAddToCartGuardedResult {
  const cart = useOnlineOrdersStore(selectCustomerCart);
  const addToCart = useOnlineOrdersStore((s) => s.addToCart);
  const dialog = useAppDialog();

  const handleAddToCart = useCallback(
    (item: OnlineCatalogItem): boolean => {
      if (item.stockQuantity <= 0) {
        dialog.show({
          variant: 'error',
          title: 'Out of stock',
          message: 'This product is currently unavailable.',
        });
        return false;
      }
      const inCart = cart.find((c) => c.catalogItem.id === item.id)?.quantity ?? 0;
      if (inCart >= item.stockQuantity) {
        dialog.show({
          variant: 'error',
          title: 'Stock limit reached',
          message: `Only ${item.stockQuantity} in stock. You already have ${inCart} in your cart.`,
        });
        return false;
      }
      addToCart(item, 1);
      return true;
    },
    [cart, addToCart, dialog],
  );

  return { handleAddToCart, Dialog: dialog.Dialog };
}
