/**
 * RealtimeProvider
 * ================
 * Headless controller (renders `null`) that owns the app's realtime + OS
 * notification plumbing. Mounted UNDER `ThemeProvider` in `src/app/_layout.tsx`
 * as a sibling of `RootNavigator` — deliberately NOT inside `RootLayout`'s body,
 * where a Zustand subscription would race the Fabric commit and trigger the
 * documented "Unable to find viewState for tag" crash. Rendering `null` also
 * keeps its login/logout re-renders off the `RootNavigator` subtree.
 *
 * Responsibilities:
 *   1. Once on mount — configure the OS notification foreground handler + Android
 *      channels, register the tap-response listener (route on tap), and handle a
 *      cold-start launch-from-notification.
 *   2. While a customer is logged in — open the authenticated socket, listen for
 *      `catalog:product_created`, and on each event: add the notification
 *      (idempotent by id), raise an in-app toast, and ask the catalog hook to
 *      re-fetch. Also refreshes server history + uploads the push token on login.
 *
 * NOTE: no local OS notification is fired here — the remote push owns the OS
 * banner (app background/closed); foreground shows the toast. The shared server
 * notification id de-duplicates the socket entry against the push entry.
 */

import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import {
  useSukiStore,
  selectIsCustomerLoggedIn,
  selectCurrentCustomer,
} from '@/features/customer/store/suki.store';
import { useAuthStore, selectCurrentUser } from '@/features/auth/store/auth.store';
import { useBusinessOrdersStore } from '@/features/business-suki/store/business_orders.store';
import { useSukiBusinessStore } from '@/features/business-suki/store/suki_business.store';
import { useOnlineOrdersStore } from '@/features/customer/store/online_orders.store';
import { useOnlineSalesStore } from '@/store/online_sales.store';
import { useNotificationStore } from '@/features/notifications/store/notification.store';
import { uploadPushToken } from '@/features/notifications/services/notification.api';
import { notificationService } from '@/features/notifications/services/notification.service';
import { playNewProductSound } from '@/features/notifications/services/notificationSound';
import { useToast } from '@/components/molecules';
import type { Notification } from '@/types';
import {
  connectAsCustomer,
  connectAsOwner,
  disconnect,
  disconnectOwner,
  on,
  off,
  onOwner,
  offOwner,
} from './socket';
import {
  REALTIME_EVENTS,
  type ProductCreatedPayload,
  type StockUpdatedPayload,
  type OrderPlacedPayload,
  type OrderStatusUpdatedPayload,
} from './events';
import { requestCatalogRefresh, requestCatalogStockPatch } from './catalogRefreshBus';

/** Deep-link the owner app opens from an order alert (mirrors the server route). */
const OWNER_ORDERS_ROUTE = '/(app)/(tabs)/suki/orders';

/** Map a `catalog:product_created` payload onto the app's `Notification` shape. */
function mapProductCreated(
  payload: ProductCreatedPayload,
  customerId: string,
): Notification {
  const d = payload.data;
  const data: Record<string, string | number | boolean> = {
    route: d.route,
    catalogItemId: d.catalogItemId,
    productId: d.productId,
    productName: d.productName,
    businessOwnerId: d.businessOwnerId,
    ...(d.productImageUrl !== undefined ? { productImageUrl: d.productImageUrl } : {}),
    ...(d.customPrice !== undefined ? { customPrice: d.customPrice } : {}),
  };
  return {
    id: payload.id, // server eventId — the de-dup key
    userId: customerId,
    title: payload.title,
    body: payload.body,
    type: payload.type,
    data,
    isRead: false,
    createdAt: payload.createdAt,
  };
}

/** Map an `order:status_updated` payload onto the app's `Notification` shape. */
function mapOrderStatus(
  payload: OrderStatusUpdatedPayload,
  customerId: string,
): Notification {
  const d = payload.data;
  const data: Record<string, string | number | boolean> = {
    route: d.route,
    orderId: d.orderId,
    orderNumber: d.orderNumber,
    orderStatus: d.orderStatus,
    businessOwnerId: d.businessOwnerId,
  };
  return {
    id: payload.id, // server eventId — the de-dup key
    userId: customerId,
    title: payload.title,
    body: payload.body,
    type: payload.type,
    data,
    isRead: false,
    createdAt: payload.createdAt,
  };
}

/** Ensure an Expo push token exists and is associated with this customer. */
async function syncPushTokenForCustomer(): Promise<void> {
  try {
    const store = useNotificationStore.getState();
    let token = store.pushToken;
    if (!token) {
      await store.registerPushToken();
      token = useNotificationStore.getState().pushToken;
    }
    if (token) {
      await uploadPushToken(token, Platform.OS === 'ios' ? 'ios' : 'android');
    }
  } catch (err) {
    if (__DEV__) console.warn('[realtime] push token sync failed:', err);
  }
}

export const RealtimeProvider: React.FC = () => {
  const isCustomerLoggedIn = useSukiStore(selectIsCustomerLoggedIn);
  const customer = useSukiStore(selectCurrentCustomer);
  const customerId = customer?.id;
  const owner = useAuthStore(selectCurrentUser);
  const ownerId = owner?.id;
  const { show } = useToast();

  // ── 1. OS notification bootstrap (once) ──────────────────────────────────────
  useEffect(() => {
    notificationService.setNotificationHandler();
    void notificationService.createNotificationChannels();

    // Tap on a delivered OS notification → route to its data.route.
    const sub = notificationService.addNotificationResponseReceivedListener(
      (response) => notificationService.handleNotificationResponse(response),
    );

    // Cold start: app launched by tapping a notification.
    void notificationService
      .getInitialRouteFromLastResponse()
      .then((route) => {
        if (route) notificationService.routeTo(route);
      });

    return () => sub.remove();
  }, []);

  // ── 2. Customer socket + realtime handling (login-scoped) ────────────────────
  useEffect(() => {
    if (!isCustomerLoggedIn || !customerId) return;

    let active = true;

    const handleProductCreated = (payload: ProductCreatedPayload) => {
      if (!active) return;
      // (a) persist to the in-app inbox — idempotent by server id.
      useNotificationStore.getState().addNotification(
        mapProductCreated(payload, customerId),
      );
      // (b) foreground toast + audible cue (the OS banner/sound is owned by the
      //     remote push, which only fires when backgrounded/closed).
      const route = payload.data.route;
      show({
        message: payload.title,
        variant: 'info',
        action: { label: 'View', onPress: () => notificationService.routeTo(route) },
      });
      playNewProductSound();
      // (c) refresh the catalog grid so the new product shows immediately.
      requestCatalogRefresh();
    };

    // A stock/availability change — merge the changed rows into the grid IN PLACE
    // (no re-fetch, no loading flash). No inbox entry / toast: stock churn is
    // noisy and only the displayed numbers need to update.
    const handleStockUpdated = (payload: StockUpdatedPayload) => {
      if (!active) return;
      requestCatalogStockPatch(payload.items);
    };

    // One of THIS customer's orders changed status (any transition). Patch the
    // order in place (both the Orders list + detail derive from it), add an inbox
    // entry (idempotent by server id), toast, and play the audible cue. The OS
    // banner is owned by the remote push (fires only when backgrounded/closed).
    const handleOrderStatusUpdated = (payload: OrderStatusUpdatedPayload) => {
      if (!active) return;
      // (a) patch the in-memory order; refetch only if it isn't loaded locally.
      const applied = useOnlineOrdersStore.getState().applyOrderStatusUpdate(payload);
      if (!applied) {
        void useOnlineOrdersStore.getState().loadCustomerOrders(customerId);
      }
      // (b) persist to the in-app inbox — idempotent by server id.
      useNotificationStore.getState().addNotification(
        mapOrderStatus(payload, customerId),
      );
      // (c) foreground toast + audible cue.
      show({
        message: payload.body,
        variant: payload.orderStatus === 'CANCELLED' ? 'warning' : 'info',
        action: {
          label: 'View',
          onPress: () => notificationService.routeTo(payload.data.route),
        },
      });
      playNewProductSound();
    };

    void (async () => {
      const socket = await connectAsCustomer();
      if (!socket || !active) return;
      on(REALTIME_EVENTS.CATALOG_PRODUCT_CREATED, handleProductCreated);
      on(REALTIME_EVENTS.CATALOG_STOCK_UPDATED, handleStockUpdated);
      on(REALTIME_EVENTS.ORDER_STATUS_UPDATED, handleOrderStatusUpdated);
    })();

    // Catch up on anything missed while the app was closed + associate push token.
    void useNotificationStore.getState().refreshNotifications();
    void syncPushTokenForCustomer();

    return () => {
      active = false;
      off(REALTIME_EVENTS.CATALOG_PRODUCT_CREATED, handleProductCreated);
      off(REALTIME_EVENTS.CATALOG_STOCK_UPDATED, handleStockUpdated);
      off(REALTIME_EVENTS.ORDER_STATUS_UPDATED, handleOrderStatusUpdated);
      disconnect();
    };
  }, [isCustomerLoggedIn, customerId, show]);

  // ── 3. Owner socket + realtime handling (login-scoped) ───────────────────────
  useEffect(() => {
    if (!ownerId) return;

    let active = true;

    const handleOrderPlaced = (payload: OrderPlacedPayload) => {
      if (!active) return;
      const who = payload.customerName ? ` from ${payload.customerName}` : '';
      show({
        message: `New order ${payload.orderNumber}${who}`,
        variant: 'info',
        action: {
          label: 'View',
          onPress: () => notificationService.routeTo(OWNER_ORDERS_ROUTE),
        },
      });
      playNewProductSound();
      void useBusinessOrdersStore.getState().loadOrders();
    };

    const handleOrderCompleted = () => {
      if (!active) return;
      // No dashboard refresh here on purpose: at echo time the online_sales
      // row may not exist yet (recordSale runs after the PATCH resolves;
      // reconciliation runs after loadOrders' fetch). recordSale refreshes the
      // dashboard itself right after a fresh ledger write.
      void useBusinessOrdersStore.getState().loadOrders();
      void useOnlineSalesStore.getState().loadTodaySummary();
    };

    // Owner's own catalog view updates in place when stock/availability changes
    // (e.g. an order-completion deduction, or an edit from another device) —
    // no reload.
    const handleStockUpdated = (payload: StockUpdatedPayload) => {
      if (!active) return;
      useSukiBusinessStore.getState().patchCatalogItems(payload.items);
    };

    void (async () => {
      const s = await connectAsOwner(ownerId);
      if (!s || !active) return;
      onOwner(REALTIME_EVENTS.ORDER_PLACED, handleOrderPlaced);
      onOwner(REALTIME_EVENTS.ORDER_COMPLETED, handleOrderCompleted);
      onOwner(REALTIME_EVENTS.CATALOG_STOCK_UPDATED, handleStockUpdated);
    })();

    return () => {
      active = false;
      offOwner(REALTIME_EVENTS.ORDER_PLACED, handleOrderPlaced);
      offOwner(REALTIME_EVENTS.ORDER_COMPLETED, handleOrderCompleted);
      offOwner(REALTIME_EVENTS.CATALOG_STOCK_UPDATED, handleStockUpdated);
      disconnectOwner();
    };
  }, [ownerId, show]);

  return null;
};
