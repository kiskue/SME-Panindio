/**
 * pos.store.ts
 *
 * Zustand v5 store for POS (Point of Sale).
 *
 * Responsibilities:
 *   - Manages the in-memory cart (transient — not persisted to SQLite or
 *     AsyncStorage because a cart is session-scoped: it starts empty, the user
 *     adds items, then checks out; if the app restarts mid-session the cart
 *     being cleared is acceptable POS behaviour).
 *   - Exposes a `checkout` action that delegates to `createSalesOrder` from
 *     the SQLite repository, then clears the cart on success.
 *   - Surfaces the most-recent completed `SalesOrder` so the receipt screen
 *     can display it without a separate DB round-trip.
 *
 * Cart invariants:
 *   - A product appears at most once; `addToCart` increments qty if the
 *     product is already present.
 *   - `quantity` is always >= 1; `removeFromCart` removes the row entirely.
 *   - `updateCartQty(id, 0)` is treated identically to `removeFromCart(id)`.
 *   - Prices are snapshotted from `product.price` at add-to-cart time.
 *     Changing the product price in Inventory does NOT affect an open cart.
 *
 * Checkout flow:
 *   1. UI calls `checkout(paymentMethod, options?)`.
 *   2. Store validates cart is non-empty.
 *   3. Delegates to `createSalesOrder` (atomic SQLite write).
 *   4. On success: stores `lastOrder`, clears cart, sets `isCheckoutLoading = false`.
 *   5. On failure: sets `checkoutError`, leaves cart intact so the user can retry.
 *
 * The store does NOT refresh the inventory store — callers should call
 * `useInventoryStore.getState().initializeInventory()` after checkout if
 * they need updated stock levels reflected in the UI immediately.
 */

import { create } from 'zustand';
import type { InventoryItem, CartItem, SalesOrder, PaymentMethod } from '@/types';
import {
  createSalesOrder,
  getTodaySalesTotal,
} from '../../database/repositories/sales.repository';

// ─── State shape ──────────────────────────────────────────────────────────────

interface PosState {
  cartItems:          CartItem[];
  isCheckoutLoading:  boolean;
  checkoutError:      string | null;
  /** The most recently completed order — populated after a successful checkout. */
  lastOrder:          SalesOrder | null;
  /** Today's aggregated revenue — loaded on demand via `loadTodaySummary`. */
  todayTotal:         number;
  todayOrderCount:    number;
  isSummaryLoading:   boolean;

  // ── Cart mutations ─────────────────────────────────────────────────────────

  /**
   * Adds a product to the cart. If the product is already present, increments
   * the quantity by 1. Unit price is snapshotted from `product.price`.
   * Products with no price default to 0.
   */
  addToCart: (product: InventoryItem) => void;

  /**
   * Removes a product from the cart entirely, regardless of quantity.
   */
  removeFromCart: (productId: string) => void;

  /**
   * Sets the quantity for a cart item. Passing qty <= 0 removes the item.
   */
  updateCartQty: (productId: string, quantity: number) => void;

  /** Empties the cart without creating an order. */
  clearCart: () => void;

  // ── Checkout ───────────────────────────────────────────────────────────────

  /**
   * Persists the current cart as a completed sales order.
   *
   * @param paymentMethod  Payment instrument used.
   * @param options        Optional: amountTendered (cash), discount, notes,
   *                       consumeIngredients flag.
   *
   * Returns the created `SalesOrder` on success, null on failure.
   * Always check `checkoutError` after a null return.
   */
  checkout: (
    paymentMethod:    PaymentMethod,
    options?: {
      amountTendered?:     number;
      discountAmount?:     number;
      notes?:              string;
      consumeIngredients?: boolean;
    },
  ) => Promise<SalesOrder | null>;

  /** Clears the last checkout error. */
  clearCheckoutError: () => void;

  // ── Dashboard summary ─────────────────────────────────────────────────────

  /** Loads today's sales total from SQLite. */
  loadTodaySummary: () => Promise<void>;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const usePosStore = create<PosState>()((set, get) => ({
  cartItems:         [],
  isCheckoutLoading: false,
  checkoutError:     null,
  lastOrder:         null,
  todayTotal:        0,
  todayOrderCount:   0,
  isSummaryLoading:  false,

  // ── Cart mutations ─────────────────────────────────────────────────────────

  addToCart: (product) => {
    const unitPrice = product.price ?? 0;

    set((state) => {
      const existing = state.cartItems.find((c) => c.product.id === product.id);

      if (existing !== undefined) {
        // Increment quantity for existing item
        return {
          cartItems: state.cartItems.map((c) => {
            if (c.product.id !== product.id) return c;
            const newQty     = c.quantity + 1;
            const newSubtotal = newQty * c.unitPrice;
            return { ...c, quantity: newQty, subtotal: newSubtotal };
          }),
        };
      }

      // New item
      const newItem: CartItem = {
        product,
        quantity:  1,
        unitPrice,
        subtotal:  unitPrice,
      };
      return { cartItems: [...state.cartItems, newItem] };
    });
  },

  removeFromCart: (productId) => {
    set((state) => ({
      cartItems: state.cartItems.filter((c) => c.product.id !== productId),
    }));
  },

  updateCartQty: (productId, quantity) => {
    if (quantity <= 0) {
      get().removeFromCart(productId);
      return;
    }

    set((state) => ({
      cartItems: state.cartItems.map((c) => {
        if (c.product.id !== productId) return c;
        return { ...c, quantity, subtotal: quantity * c.unitPrice };
      }),
    }));
  },

  clearCart: () => set({ cartItems: [] }),

  // ── Checkout ───────────────────────────────────────────────────────────────

  checkout: async (paymentMethod, options) => {
    const { cartItems } = get();

    if (cartItems.length === 0) {
      set({ checkoutError: 'Cart is empty.' });
      return null;
    }

    set({ isCheckoutLoading: true, checkoutError: null });

    try {
      const subtotal       = cartItems.reduce((sum, c) => sum + c.subtotal, 0);
      const discountAmount = options?.discountAmount ?? 0;
      const totalAmount    = Math.max(0, subtotal - discountAmount);

      const changeAmount =
        paymentMethod === 'cash' && options?.amountTendered !== undefined
          ? Math.max(0, options.amountTendered - totalAmount)
          : undefined;

      const order = await createSalesOrder({
        items: cartItems.map((c) => ({
          productId:   c.product.id,
          productName: c.product.name,
          quantity:    c.quantity,
          unitPrice:   c.unitPrice,
          subtotal:    c.subtotal,
        })),
        paymentMethod,
        subtotal,
        discountAmount,
        totalAmount,
        ...(options?.amountTendered !== undefined ? { amountTendered: options.amountTendered } : {}),
        ...(changeAmount            !== undefined ? { changeAmount }                            : {}),
        ...(options?.notes          !== undefined ? { notes: options.notes }                    : {}),
        ...(options?.consumeIngredients !== undefined
          ? { consumeIngredients: options.consumeIngredients }
          : {}),
      });

      set({ lastOrder: order, cartItems: [], isCheckoutLoading: false });
      return order;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Checkout failed. Please try again.';
      set({ isCheckoutLoading: false, checkoutError: message });
      return null;
    }
  },

  clearCheckoutError: () => set({ checkoutError: null }),

  // ── Dashboard summary ─────────────────────────────────────────────────────

  loadTodaySummary: async () => {
    set({ isSummaryLoading: true });
    try {
      const { total, orderCount } = await getTodaySalesTotal();
      set({ todayTotal: total, todayOrderCount: orderCount, isSummaryLoading: false });
    } catch {
      // Non-fatal: summary display is optional; leave existing values in place
      set({ isSummaryLoading: false });
    }
  },
}));

// ─── Selectors ────────────────────────────────────────────────────────────────

/** The current cart item array. */
export const selectCartItems = (s: PosState): CartItem[] => s.cartItems;

/** Total number of individual units across all cart lines. */
export const selectCartCount = (s: PosState): number =>
  s.cartItems.reduce((sum, c) => sum + c.quantity, 0);

/** Sum of all cart line subtotals (pre-discount). */
export const selectCartSubtotal = (s: PosState): number =>
  s.cartItems.reduce((sum, c) => sum + c.subtotal, 0);

/**
 * Alias for `selectCartSubtotal` — `cartTotal` is the more natural name in POS
 * UI contexts where no discount has been applied yet.
 */
export const selectCartTotal = selectCartSubtotal;

/** Whether a checkout is currently in progress. */
export const selectCheckoutLoading = (s: PosState): boolean => s.isCheckoutLoading;

/** The last checkout error message, or null. */
export const selectCheckoutError = (s: PosState): string | null => s.checkoutError;

/** The most recently completed order (populated after successful checkout). */
export const selectLastOrder = (s: PosState): SalesOrder | null => s.lastOrder;

/** Today's total revenue from completed orders. */
export const selectTodayTotal = (s: PosState): number => s.todayTotal;

/** Today's completed order count. */
export const selectTodayOrderCount = (s: PosState): number => s.todayOrderCount;
