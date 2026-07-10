import { useCallback, useMemo } from 'react';
import {
  useSukiStore,
  selectCurrentCustomer,
  useFavoritesStore,
  selectFavoritesByCustomer,
} from '@/store';

export interface UseFavoritesResult {
  /** productIds favorited by the current customer (stable Set for O(1) membership). */
  favoriteIds: Set<string>;
  /** Whether the given productId is favorited by the current customer. */
  isFavorite: (productId: string) => boolean;
  /** Toggle favorite for the given productId. No-ops when no customer is logged in. */
  toggle: (productId: string) => void;
}

/**
 * Binds the local favorites store to the CURRENT customer, so screens and cards
 * never re-derive the customer scope. This is the single integration seam: if a
 * backend `/favorites` endpoint is added later, only this hook changes —
 * ProductCard and the screens keep calling `isFavorite` / `toggle` unchanged.
 */
export function useFavorites(): UseFavoritesResult {
  const customerId = useSukiStore(selectCurrentCustomer)?.id;
  const byCustomer = useFavoritesStore(selectFavoritesByCustomer);
  const toggleFavorite = useFavoritesStore((s) => s.toggleFavorite);

  const favoriteIds = useMemo(
    () => new Set(customerId ? byCustomer[customerId] ?? [] : []),
    [customerId, byCustomer],
  );

  const isFavorite = useCallback((productId: string) => favoriteIds.has(productId), [favoriteIds]);

  const toggle = useCallback(
    (productId: string) => {
      if (!customerId) return;
      toggleFavorite(customerId, productId);
    },
    [customerId, toggleFavorite],
  );

  return { favoriteIds, isFavorite, toggle };
}
