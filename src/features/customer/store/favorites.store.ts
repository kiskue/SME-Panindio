/**
 * Customer Favorites Store  (Suki — Customer-Side)
 * ================================================
 * Local-first, per-customer product favorites for the ordering experience.
 *
 * There is NO backend favorites endpoint today (customer routes are @Public and
 * the catalog carries no favorite flag), so favorites live on-device only. This
 * mirrors the persisted-flag pattern used by `biometric.store.ts` /
 * `onboarding.store.ts`: a plain Zustand slice persisted to AsyncStorage (the
 * data is non-sensitive — no tokens here).
 *
 * KEYING: `byCustomer` maps a `customerId` -> the list of favorited **productId**
 * values. We key on `productId` (stable across catalog-row edits), never on the
 * volatile `OnlineCatalogItem.id`. Arrays (not Sets) so the state serializes to
 * JSON cleanly. This shape maps 1:1 onto a future `customer_favorites(customer_id,
 * product_id)` table, so a backend swap is an additive load-and-merge with no
 * change to consumers.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface FavoritesState {
  /** customerId -> favorited productId[]. */
  byCustomer: Record<string, string[]>;
  /** Add/remove a productId from the given customer's favorites. */
  toggleFavorite: (customerId: string, productId: string) => void;
  /** Drop a customer's favorites entirely (call on logout). */
  clearForCustomer: (customerId: string) => void;
}

export const useFavoritesStore = create<FavoritesState>()(
  persist(
    (set) => ({
      byCustomer: {},

      toggleFavorite: (customerId, productId) =>
        set((s) => {
          const current = s.byCustomer[customerId] ?? [];
          const next = current.includes(productId)
            ? current.filter((id) => id !== productId)
            : [...current, productId];
          return { byCustomer: { ...s.byCustomer, [customerId]: next } };
        }),

      clearForCustomer: (customerId) =>
        set((s) => {
          if (!(customerId in s.byCustomer)) return s;
          const next = { ...s.byCustomer };
          delete next[customerId];
          return { byCustomer: next };
        }),
    }),
    {
      name: 'customer-favorites',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ byCustomer: state.byCustomer }),
    },
  ),
);

// ── Selectors ──────────────────────────────────────────────────────────────

/** The whole map — a STABLE reference; derive per-customer views in the hook. */
export const selectFavoritesByCustomer = (s: FavoritesState) => s.byCustomer;
