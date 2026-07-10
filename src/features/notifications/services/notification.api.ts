/**
 * Customer Notifications API  (Suki — Customer-Side Module)
 * =========================================================
 * REST calls for the customer notification inbox + push-token registration.
 * Follows the same public + session-in-body pattern as the rest of the customer
 * surface (`POST /catalog/for-customer`, `POST /orders/list`): the customer is
 * NOT a JWT user, so every request carries `{ customerId, sessionToken }` in the
 * body and the backend validates the session before acting.
 *
 * Contract (backend built to match exactly, all under `/api/v1`):
 *   POST /notifications/list        { customerId, sessionToken }                       -> { notifications: Notification[] }
 *   POST /notifications/push-token  { customerId, sessionToken, expoPushToken, platform } -> { success: true }
 *   POST /notifications/mark-read   { customerId, sessionToken, ids?: string[] }        -> { success: true }
 *
 * NOTE: imports the Suki store directly (not the `@/store` barrel) to avoid a
 * circular import — the barrel re-exports the notification store, which imports
 * this file.
 */

import { Platform } from 'react-native';
import { api, extractApiError } from '@/core/api';
import { getSessionToken } from '@/features/customer/services/customer.service';
import { useSukiStore } from '@/features/customer/store/suki.store';
import type { Notification } from '@/types';

export type PushPlatform = 'ios' | 'android';

interface CustomerAuth {
  customerId: string;
  sessionToken: string;
}

/**
 * Build the `{ customerId, sessionToken }` auth pair from the current Suki
 * session + secure store. Returns `null` when there is no logged-in customer or
 * no stored session token (caller should skip the request quietly).
 */
async function buildCustomerAuth(): Promise<CustomerAuth | null> {
  const customerId = useSukiStore.getState().currentCustomer?.id;
  if (!customerId) return null;
  const sessionToken = await getSessionToken();
  if (!sessionToken) return null;
  return { customerId, sessionToken };
}

/**
 * Fetch the customer's server-persisted notification history. Returns already in
 * the app's `Notification` shape. Returns `[]` (never throws) when there is no
 * active session, so callers can fire it unconditionally on app open.
 */
export async function fetchNotifications(): Promise<Notification[]> {
  const auth = await buildCustomerAuth();
  if (!auth) return [];
  try {
    const { data } = await api.post<{ notifications?: Notification[] }>(
      '/notifications/list',
      auth,
    );
    return data.notifications ?? [];
  } catch (err) {
    const { code } = extractApiError(err);
    if (__DEV__) console.warn('[notification.api] fetchNotifications failed:', code);
    return [];
  }
}

/**
 * Associate an Expo push token with the logged-in customer so the backend can
 * target remote push at them. Best-effort: swallows errors (a failed upload must
 * never break login). Returns whether the upload succeeded.
 */
export async function uploadPushToken(
  expoPushToken: string,
  platform: PushPlatform = Platform.OS === 'ios' ? 'ios' : 'android',
): Promise<boolean> {
  const auth = await buildCustomerAuth();
  if (!auth) return false;
  try {
    await api.post('/notifications/push-token', {
      ...auth,
      expoPushToken,
      platform,
    });
    return true;
  } catch (err) {
    const { code } = extractApiError(err);
    if (__DEV__) console.warn('[notification.api] uploadPushToken failed:', code);
    return false;
  }
}

/**
 * Mark notifications read server-side. Omit `ids` to mark ALL as read.
 * Best-effort: local state is the source of truth for the UI; this keeps the
 * server in sync for cross-device consistency and remote-push badge counts.
 */
export async function markNotificationsRead(ids?: string[]): Promise<boolean> {
  const auth = await buildCustomerAuth();
  if (!auth) return false;
  try {
    await api.post('/notifications/mark-read', {
      ...auth,
      ...(ids !== undefined ? { ids } : {}),
    });
    return true;
  } catch (err) {
    const { code } = extractApiError(err);
    if (__DEV__) console.warn('[notification.api] markNotificationsRead failed:', code);
    return false;
  }
}
