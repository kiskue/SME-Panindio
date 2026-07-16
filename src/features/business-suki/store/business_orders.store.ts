
/**
 * Business Orders Store  (Suki — Business-Owner Module)
 * =====================================================
 * The business owner's view of incoming online orders: list, detail, and the
 * fulfilment workflow (confirm → prepare → ready → complete, or cancel) plus
 * payment recording.
 *
 * Completing an order deducts catalog stock server-side; the returned order is
 * merged back into local state so the UI reflects the new status immediately.
 *
 * Not persisted — loaded fresh per screen mount (status can change from the POS
 * or another device).
 */

import { create } from 'zustand';
import type { BusinessOrder, OrderStatus, PaymentStatus } from '@/types';
import {
  fetchBusinessOrders,
  fetchBusinessOrder,
  updateOrderStatus,
  updatePaymentStatus,
} from '@/features/business-suki/services/business_suki.service';
import { hasOnlineSale } from '@/database/repositories/online_sales.repository';
import { useOnlineSalesStore } from '@/store/online_sales.store';

/**
 * How far back a `loadOrders` reconciliation pass will backfill missing local
 * sales. Recording a sale deducts local stock, so we deliberately DO NOT
 * retroactively process ancient completed orders (which predate this feature and
 * may already have been manually accounted for). The window only needs to cover
 * the realistic crash-gap: an order completed on this device whose local write
 * failed, before the owner reopens the app.
 */
const RECONCILE_WINDOW_MS = 2 * 24 * 60 * 60 * 1000; // 2 days

/**
 * Backfill local online sales for recently-COMPLETED orders that have no local
 * record yet (crash between the status PATCH succeeding and the local write).
 * Idempotent and best-effort — `recordSale` guards on the UNIQUE order_id and
 * never throws; a failure here is retried on the next load.
 */
async function reconcileOnlineSales(orders: BusinessOrder[]): Promise<void> {
  const cutoff = new Date(Date.now() - RECONCILE_WINDOW_MS).toISOString();
  for (const order of orders) {
    if (order.orderStatus !== 'COMPLETED') continue;
    // ISO-8601 strings compare lexicographically in chronological order.
    if (!order.completedAt || order.completedAt < cutoff) continue;
    try {
      if (await hasOnlineSale(order.id)) continue;
      await useOnlineSalesStore.getState().recordSale(order);
    } catch {
      // Best-effort; the next loadOrders pass retries.
    }
  }
}

interface BusinessOrdersState {
  orders: BusinessOrder[];
  selectedOrder: BusinessOrder | null;
  isLoading: boolean;
  isUpdating: boolean;
  error: string | null;
}

interface BusinessOrdersActions {
  loadOrders: (status?: OrderStatus) => Promise<void>;
  loadOrder: (orderId: string) => Promise<void>;
  changeStatus: (orderId: string, status: OrderStatus, cancellationReason?: string) => Promise<void>;
  changePaymentStatus: (orderId: string, paymentStatus: PaymentStatus) => Promise<void>;
  clearSelected: () => void;
  clearError: () => void;
}

export type BusinessOrdersStore = BusinessOrdersState & BusinessOrdersActions;

const initialState: BusinessOrdersState = {
  orders: [],
  selectedOrder: null,
  isLoading: false,
  isUpdating: false,
  error: null,
};

/** Replace an order in the list with the updated copy (drops it if absent). */
function mergeOrder(list: BusinessOrder[], updated: BusinessOrder): BusinessOrder[] {
  return list.map((o) => (o.id === updated.id ? updated : o));
}

export const useBusinessOrdersStore = create<BusinessOrdersStore>()((set) => ({
  ...initialState,

  loadOrders: async (status) => {
    set({ isLoading: true, error: null });
    try {
      const orders = await fetchBusinessOrders(status);
      set({ orders, isLoading: false });
      // Fire-and-forget: recover any completed order whose local sale/stock
      // deduction was missed (e.g. a crash right after the status PATCH).
      void reconcileOnlineSales(orders);
    } catch (err) {
      set({ isLoading: false, error: err instanceof Error ? err.message : 'Failed to load orders' });
    }
  },

  loadOrder: async (orderId) => {
    set({ isLoading: true, error: null });
    try {
      const order = await fetchBusinessOrder(orderId);
      set((s) => ({
        selectedOrder: order,
        orders: s.orders.some((o) => o.id === order.id) ? mergeOrder(s.orders, order) : s.orders,
        isLoading: false,
      }));
    } catch (err) {
      set({ isLoading: false, error: err instanceof Error ? err.message : 'Failed to load order' });
    }
  },

  changeStatus: async (orderId, status, cancellationReason) => {
    set({ isUpdating: true, error: null });
    try {
      const updated = await updateOrderStatus(orderId, status, cancellationReason);
      // On completion, record the sale into the LOCAL online ledger and deduct
      // local inventory (the server already deducted its catalog snapshot). The
      // returned order carries its items. Idempotent + non-throwing; a failure is
      // recovered by reconcileOnlineSales on the next loadOrders.
      if (updated.orderStatus === 'COMPLETED') {
        await useOnlineSalesStore.getState().recordSale(updated);
      }
      set((s) => ({
        isUpdating: false,
        orders: mergeOrder(s.orders, updated),
        selectedOrder: s.selectedOrder?.id === updated.id ? updated : s.selectedOrder,
      }));
    } catch (err) {
      set({ isUpdating: false, error: err instanceof Error ? err.message : 'Failed to update order' });
      throw err;
    }
  },

  changePaymentStatus: async (orderId, paymentStatus) => {
    set({ isUpdating: true, error: null });
    try {
      const updated = await updatePaymentStatus(orderId, paymentStatus);
      set((s) => ({
        isUpdating: false,
        orders: mergeOrder(s.orders, updated),
        selectedOrder: s.selectedOrder?.id === updated.id ? updated : s.selectedOrder,
      }));
    } catch (err) {
      set({ isUpdating: false, error: err instanceof Error ? err.message : 'Failed to update payment' });
      throw err;
    }
  },

  clearSelected: () => set({ selectedOrder: null }),
  clearError: () => set({ error: null }),
}));

export const selectBusinessOrders        = (s: BusinessOrdersStore) => s.orders;
export const selectBusinessSelectedOrder = (s: BusinessOrdersStore) => s.selectedOrder;
export const selectBusinessOrdersLoading = (s: BusinessOrdersStore) => s.isLoading;
export const selectBusinessOrdersUpdating = (s: BusinessOrdersStore) => s.isUpdating;
export const selectBusinessOrdersError   = (s: BusinessOrdersStore) => s.error;
