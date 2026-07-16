/**
 * Realtime event contract (shared, namespaced).
 *
 * These names + payload shapes are the SINGLE SOURCE OF TRUTH the backend
 * (`Sme-Server` RealtimeModule / EventsGateway) is built to match exactly. Keep
 * this file in lockstep with the server's emit signatures. Adding a new realtime
 * feature = add its event name + payload type here, then handle it in the
 * `RealtimeProvider` — never scatter raw event-name string literals across the app.
 */

import type { OrderStatus, PaymentStatus } from '@/types';

/** Server → client event names. Namespaced `<domain>:<action>`. */
export const REALTIME_EVENTS = {
  /** A business owner published a NEW product to their online catalog. */
  CATALOG_PRODUCT_CREATED: 'catalog:product_created',
  /**
   * A catalog row's stock or availability changed (owner edit OR an
   * order-completion deduction). Delivered to the owner AND all their customers;
   * the client reacts by re-fetching the catalog.
   */
  CATALOG_STOCK_UPDATED: 'catalog:stock_updated',
  /** A customer placed a new order. OWNER-ONLY (owner-admin room). */
  ORDER_PLACED: 'order:placed',
  /** An order was completed. OWNER-ONLY (owner-admin room). */
  ORDER_COMPLETED: 'order:completed',
  /**
   * An owner advanced/cancelled one of THIS customer's orders. CUSTOMER-ONLY
   * (per-customer `customer:<id>` room) — the client patches the order in place,
   * adds an inbox entry, toasts, and plays a sound.
   */
  ORDER_STATUS_UPDATED: 'order:status_updated',
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
 * One changed catalog row carried in `catalog:stock_updated`. Mirrors the public
 * catalog item shape so the client patches its grid in place (update stock/price,
 * show a row that became available, remove one that became unavailable) with NO
 * re-fetch. `customPrice` is the DECIMAL string as the REST endpoints return it.
 * Mirrors the server `StockUpdatedItem`.
 */
export interface StockUpdatedItem {
  id: string;
  businessOwnerId: string;
  productId: string;
  productName: string;
  productBarcode: string | null;
  productImageUrl: string | null;
  customPrice: string | null;
  isAvailable: boolean;
  stockQuantity: number;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Payload for `catalog:stock_updated`. Carries the fresh state of every changed
 * row so the client merges in place instead of reloading. Mirrors the server
 * `StockUpdatedPayload`.
 */
export interface StockUpdatedPayload {
  businessOwnerId: string;
  items: StockUpdatedItem[];
}

/**
 * Payload for `order:placed` (owner-facing). `id` is a per-publish eventId (uuid).
 * Mirrors the server `OrderPlacedPayload`.
 */
export interface OrderPlacedPayload {
  id: string;
  orderId: string;
  orderNumber: string;
  customerName: string | null;
  /** DECIMAL(12,2) money as a fixed-2 string. */
  totalAmount: string;
  itemCount: number;
  /** ISO 8601 creation timestamp. */
  createdAt: string;
}

/** Payload for `order:completed` (owner-facing). Same shape as `order:placed`. */
export type OrderCompletedPayload = OrderPlacedPayload;

/**
 * Payload for `order:status_updated` (customer-facing, per-customer room).
 *
 * `id` is the server-generated eventId carried in BOTH this socket payload and
 * the remote-push `data`, and is the de-duplication key for `addNotification`.
 *
 * `data` is flat primitives so it maps 1:1 onto `Notification.data`. The
 * top-level order-patch fields let the client update its in-memory order in
 * place (no re-fetch).
 *
 * LOCKSTEP: mirrors the server `Sme-Server/src/modules/realtime/realtime.types.ts`
 * `OrderStatusUpdatedPayload` EXACTLY. Any field change must be made in both.
 */
export interface OrderStatusUpdatedPayload {
  id: string;
  type: 'INFO';
  title: string;
  body: string;
  data: {
    /** Deep-link target the tap/route handler navigates to (`/(customer)/orders/<id>`). */
    route: string;
    orderId: string;
    orderNumber: string;
    orderStatus: OrderStatus;
    businessOwnerId: string;
    [key: string]: unknown;
  };
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
  confirmedAt: string | null;
  readyAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  /** ISO 8601 — monotonic ordering guard for the client patch. */
  updatedAt: string;
  /** ISO 8601 — notification creation timestamp. */
  createdAt: string;
}

/**
 * Typed server → client event map for `socket.io-client`'s `Socket` generic.
 * Each key is a listenable event; the value is the listener signature.
 */
export interface ServerToClientEvents {
  'catalog:product_created': (payload: ProductCreatedPayload) => void;
  'catalog:stock_updated': (payload: StockUpdatedPayload) => void;
  'order:placed': (payload: OrderPlacedPayload) => void;
  'order:completed': (payload: OrderCompletedPayload) => void;
  'order:status_updated': (payload: OrderStatusUpdatedPayload) => void;
}

/**
 * Typed client → server event map. Empty for now — the app only listens. Owner
 * acks land here when that half is wired.
 */
export type ClientToServerEvents = Record<string, never>;
