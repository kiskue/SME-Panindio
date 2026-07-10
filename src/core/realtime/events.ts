/**
 * Realtime event contract (shared, namespaced).
 *
 * These names + payload shapes are the SINGLE SOURCE OF TRUTH the backend
 * (`Sme-Server` RealtimeModule / EventsGateway) is built to match exactly. Keep
 * this file in lockstep with the server's emit signatures. Adding a new realtime
 * feature = add its event name + payload type here, then handle it in the
 * `RealtimeProvider` — never scatter raw event-name string literals across the app.
 */

/** Server → client event names. Namespaced `<domain>:<action>`. */
export const REALTIME_EVENTS = {
  /** A business owner published a NEW product to their online catalog. */
  CATALOG_PRODUCT_CREATED: 'catalog:product_created',
} as const;

export type RealtimeEventName =
  (typeof REALTIME_EVENTS)[keyof typeof REALTIME_EVENTS];

/**
 * Payload for `catalog:product_created`.
 *
 * `id` is the server-generated notification id — it is carried in BOTH this
 * socket payload and the remote-push `data`, and is the de-duplication key for
 * `addNotification` (a socket-delivered entry and a push-delivered entry must
 * never double-insert).
 *
 * `data` is intentionally flat primitives so it maps 1:1 onto the app's
 * `Notification.data` (`Record<string, string | number | boolean>`).
 */
export interface ProductCreatedPayload {
  id: string;
  type: 'INFO';
  title: string;
  body: string;
  data: {
    /** Deep-link target the tap/route handler navigates to. */
    route: string;
    catalogItemId: string;
    productId: string;
    productName: string;
    productImageUrl?: string;
    customPrice?: number;
    businessOwnerId: string;
  };
  /** ISO 8601 creation timestamp. */
  createdAt: string;
}

/**
 * Typed server → client event map for `socket.io-client`'s `Socket` generic.
 * Each key is a listenable event; the value is the listener signature.
 */
export interface ServerToClientEvents {
  'catalog:product_created': (payload: ProductCreatedPayload) => void;
}

/**
 * Typed client → server event map. Empty for now — customers only listen. Owner
 * order events / acks land here when that half is wired.
 */
export type ClientToServerEvents = Record<string, never>;
