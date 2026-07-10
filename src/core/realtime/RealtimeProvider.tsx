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
import { useNotificationStore } from '@/features/notifications/store/notification.store';
import { uploadPushToken } from '@/features/notifications/services/notification.api';
import { notificationService } from '@/features/notifications/services/notification.service';
import { useToast } from '@/components/molecules';
import type { Notification } from '@/types';
import { connectAsCustomer, disconnect, on, off } from './socket';
import { REALTIME_EVENTS, type ProductCreatedPayload } from './events';
import { requestCatalogRefresh } from './catalogRefreshBus';

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
      // (b) foreground toast (the OS banner is owned by the remote push).
      const route = payload.data.route;
      show({
        message: payload.title,
        variant: 'info',
        action: { label: 'View', onPress: () => notificationService.routeTo(route) },
      });
      // (c) refresh the catalog grid so the new product shows immediately.
      requestCatalogRefresh();
    };

    void (async () => {
      const socket = await connectAsCustomer();
      if (!socket || !active) return;
      on(REALTIME_EVENTS.CATALOG_PRODUCT_CREATED, handleProductCreated);
    })();

    // Catch up on anything missed while the app was closed + associate push token.
    void useNotificationStore.getState().refreshNotifications();
    void syncPushTokenForCustomer();

    return () => {
      active = false;
      off(REALTIME_EVENTS.CATALOG_PRODUCT_CREATED, handleProductCreated);
      disconnect();
    };
  }, [isCustomerLoggedIn, customerId, show]);

  return null;
};
