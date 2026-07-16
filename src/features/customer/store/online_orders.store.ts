import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { api, extractApiError } from '@/core/api';
import type { OrderStatusUpdatedPayload } from '@/core/realtime/events';
import type { OnlineCatalogItem, OnlineCartItem, OnlineOrder } from '@/types';

const SECURE_SESSION_KEY = 'suki_customer_session_token';

/**
 * Coerce an order's money fields to numbers.
 *
 * The backend stores subtotal/vat/total as DECIMAL columns, which the driver
 * serializes as STRINGS (e.g. "120.00"). The domain type declares them as
 * numbers, so normalize here at the boundary — otherwise screens that call
 * `totalAmount.toFixed()` crash.
 */
function normalizeOrder(o: OnlineOrder): OnlineOrder {
  return {
    ...o,
    subtotal: Number(o.subtotal ?? 0),
    vatAmount: Number(o.vatAmount ?? 0),
    totalAmount: Number(o.totalAmount ?? 0),
  };
}

interface OnlineOrdersState {
  customerCart: OnlineCartItem[];
  customerOrders: OnlineOrder[];
  isLoading: boolean;
  isPlacingOrder: boolean;
  error: string | null;
}

interface OnlineOrdersActions {
  addToCart: (catalogItem: OnlineCatalogItem, qty: number) => void;
  removeFromCart: (catalogItemId: string) => void;
  updateCartQty: (catalogItemId: string, qty: number) => void;
  clearCart: () => void;
  placeOrder: (customerId: string, paymentMethod: 'PAY_NOW' | 'PAY_LATER', vatEnabled: boolean, customerNotes?: string) => Promise<OnlineOrder>;
  loadCustomerOrders: (customerId: string) => Promise<void>;
  /**
   * Apply a realtime `order:status_updated` patch to the matching order in place.
   * Returns `true` when the order is present (patched, or intentionally skipped
   * as a stale/duplicate update); returns `false` ONLY when the order isn't in
   * the local list, signalling the caller to refetch. Immutable + monotonic:
   * an update whose `updatedAt` is not newer than the current one is ignored.
   */
  applyOrderStatusUpdate: (payload: OrderStatusUpdatedPayload) => boolean;
  clearError: () => void;
}

export type OnlineOrdersStore = OnlineOrdersState & OnlineOrdersActions;

const initialState: OnlineOrdersState = {
  customerCart: [],
  customerOrders: [],
  isLoading: false,
  isPlacingOrder: false,
  error: null,
};

export const useOnlineOrdersStore = create<OnlineOrdersStore>()((set, get) => ({
  ...initialState,

  addToCart: (catalogItem, qty) => {
    // Never let the cart exceed the owner's last-synced stock. The server also
    // enforces this at checkout, but clamping here keeps the UI honest.
    const stock = catalogItem.stockQuantity ?? 0;
    const existing = get().customerCart.find((i) => i.catalogItem.id === catalogItem.id);
    if (existing) {
      const nextQty = Math.min(existing.quantity + qty, stock);
      if (nextQty <= existing.quantity) return; // already at the stock cap
      set((s) => ({
        customerCart: s.customerCart.map((i) =>
          i.catalogItem.id === catalogItem.id
            ? { ...i, quantity: nextQty, lineTotal: nextQty * i.unitPrice }
            : i
        ),
      }));
    } else {
      const nextQty = Math.min(qty, stock);
      if (nextQty <= 0) return; // out of stock — nothing to add
      const unitPrice = catalogItem.customPrice ?? 0;
      set((s) => ({
        customerCart: [
          ...s.customerCart,
          { catalogItem, quantity: nextQty, unitPrice, lineTotal: nextQty * unitPrice },
        ],
      }));
    }
  },

  removeFromCart: (catalogItemId) => {
    set((s) => ({ customerCart: s.customerCart.filter((i) => i.catalogItem.id !== catalogItemId) }));
  },

  updateCartQty: (catalogItemId, qty) => {
    if (qty <= 0) {
      get().removeFromCart(catalogItemId);
      return;
    }
    set((s) => ({
      customerCart: s.customerCart.map((i) => {
        if (i.catalogItem.id !== catalogItemId) return i;
        // Clamp to the item's stock so the customer can't exceed availability.
        const clamped = Math.min(qty, i.catalogItem.stockQuantity ?? 0);
        const nextQty = clamped > 0 ? clamped : i.quantity;
        return { ...i, quantity: nextQty, lineTotal: nextQty * i.unitPrice };
      }),
    }));
  },

  clearCart: () => set({ customerCart: [] }),

  placeOrder: async (customerId, paymentMethod, vatEnabled, customerNotes) => {
    set({ isPlacingOrder: true, error: null });
    try {
      const sessionToken = await SecureStore.getItemAsync(SECURE_SESSION_KEY).catch(() => null);
      const cart = get().customerCart;
      const items = cart.map((i) => ({
        catalogItemId: i.catalogItem.id,
        productId: i.catalogItem.productId,
        productName: i.catalogItem.productName,
        ...(i.catalogItem.productBarcode !== undefined ? { productBarcode: i.catalogItem.productBarcode } : {}),
        unitPrice: i.unitPrice,
        quantity: i.quantity,
      }));

      let data: { orderId?: string; orderNumber?: string; totalAmount?: number };
      try {
        const resp = await api.post<{ orderId?: string; orderNumber?: string; totalAmount?: number }>(
          '/orders',
          {
            customerId,
            sessionToken,
            items,
            paymentMethod,
            vatEnabled,
            ...(customerNotes !== undefined ? { customerNotes } : {}),
          },
        );
        data = resp.data;
      } catch (err) {
        const { code } = extractApiError(err);
        set({ isPlacingOrder: false, error: code });
        throw new Error(code);
      }

      const subtotal = cart.reduce((sum, i) => sum + i.lineTotal, 0);
      const vatAmount = vatEnabled ? Math.round(subtotal * 0.12 * 100) / 100 : 0;

      const newOrder: OnlineOrder = {
        id: data.orderId ?? '',
        businessOwnerId: '',
        customerId,
        orderNumber: data.orderNumber ?? '',
        orderDate: new Date().toISOString(),
        orderStatus: 'PENDING',
        paymentMethod,
        paymentStatus: 'UNPAID',
        subtotal,
        vatAmount,
        totalAmount: Number(data.totalAmount ?? subtotal + vatAmount),
        ...(customerNotes !== undefined ? { customerNotes } : {}),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      set((s) => ({
        isPlacingOrder: false,
        customerCart: [],
        customerOrders: [newOrder, ...s.customerOrders],
      }));

      return newOrder;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Order failed.';
      set({ isPlacingOrder: false, error: msg });
      throw err;
    }
  },

  loadCustomerOrders: async (customerId) => {
    set({ isLoading: true, error: null });
    try {
      const sessionToken = await SecureStore.getItemAsync(SECURE_SESSION_KEY).catch(() => null);
      const { data } = await api.post<{ orders?: OnlineOrder[]; total?: number }>('/orders/list', {
        customerId,
        sessionToken,
      });
      set({ customerOrders: (data.orders ?? []).map(normalizeOrder), isLoading: false });
    } catch (err) {
      set({ isLoading: false, error: err instanceof Error ? err.message : 'Failed to load orders' });
    }
  },

  applyOrderStatusUpdate: (payload) => {
    const orders = get().customerOrders;
    const idx = orders.findIndex((o) => o.id === payload.data.orderId);
    if (idx === -1) return false; // not loaded locally → caller refetches
    const prev = orders[idx];
    if (!prev) return false; // noUncheckedIndexedAccess guard (unreachable)

    // Duplicate guard: ignore only an EXACT replay of the same server update. A
    // `>=` comparison is unsafe here — `placeOrder` stamps the optimistic local
    // order's `updatedAt` with the CLIENT clock, so a device clock running ahead
    // of the server would make `prev.updatedAt > payload.updatedAt` and silently
    // drop a real status change. Equality only skips a true duplicate delivery.
    // The order IS present, so no refetch is needed.
    if (prev.updatedAt === payload.updatedAt) return true;

    // Immutable patch. Money fields are unchanged by a status transition, so no
    // normalizeOrder is needed. Optional timestamp/reason fields are conditionally
    // spread (never assigned null) to satisfy exactOptionalPropertyTypes.
    const next: OnlineOrder = {
      ...prev,
      orderStatus: payload.orderStatus,
      paymentStatus: payload.paymentStatus,
      updatedAt: payload.updatedAt,
      ...(payload.confirmedAt !== null ? { confirmedAt: payload.confirmedAt } : {}),
      ...(payload.readyAt !== null ? { readyAt: payload.readyAt } : {}),
      ...(payload.completedAt !== null ? { completedAt: payload.completedAt } : {}),
      ...(payload.cancelledAt !== null ? { cancelledAt: payload.cancelledAt } : {}),
      ...(payload.cancellationReason !== null
        ? { cancellationReason: payload.cancellationReason }
        : {}),
    };

    const nextOrders = orders.slice();
    nextOrders[idx] = next;
    set({ customerOrders: nextOrders });
    return true;
  },

  clearError: () => set({ error: null }),
}));

export const selectCustomerCart = (s: OnlineOrdersStore) => s.customerCart;
export const selectCartItemCount = (s: OnlineOrdersStore) =>
  s.customerCart.reduce((sum, i) => sum + i.quantity, 0);
export const selectCartSubtotal = (s: OnlineOrdersStore) =>
  s.customerCart.reduce((sum, i) => sum + i.lineTotal, 0);
export const selectCustomerOrders = (s: OnlineOrdersStore) => s.customerOrders;
export const selectOnlineOrdersLoading = (s: OnlineOrdersStore) => s.isLoading;
export const selectIsPlacingOrder = (s: OnlineOrdersStore) => s.isPlacingOrder;
export const selectOnlineOrdersError = (s: OnlineOrdersStore) => s.error;
