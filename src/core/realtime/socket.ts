/**
 * Socket.IO client singleton.
 *
 * One shared connection for the whole app. The origin is derived from the REST
 * base URL (`@/core/api` `API_BASE_URL`) so it automatically tracks the same
 * Metro-host auto-derive logic used for HTTP in dev — no second URL to keep in
 * sync, no hardcoded LAN IP.
 *
 * Auth model (mirrors the REST layer):
 *   - Customer (Suki): opaque session token from expo-secure-store +
 *     `customerId` sent in the Socket.IO handshake `auth`. The backend gateway
 *     validates the session and joins the client to its owner room.
 *   - Owner (business JWT): stubbed for future order events — not wired yet.
 *
 * The gateway path is the default `/socket.io` (NOT under `/api/v1` — the Nest
 * `setGlobalPrefix('api/v1')` does not affect the websocket path).
 */

import { io, type Socket } from 'socket.io-client';
import { API_BASE_URL } from '@/core/api';
import {
  getSessionToken,
} from '@/features/customer/services/customer.service';
import { useSukiStore } from '@/features/customer/store/suki.store';
import { getAccessToken } from '@/core/api';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from './events';

type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/**
 * Origin the socket connects to, e.g. `http://192.168.1.5:3000`.
 * Strips the trailing `/api/v1` REST prefix — the websocket lives at the root.
 */
export function getSocketOrigin(): string {
  return API_BASE_URL.replace(/\/api\/v1$/, '');
}

// ── Singleton state ──────────────────────────────────────────────────────────
//
// The customer and owner connections are INDEPENDENT singletons. They
// authenticate differently (customer session vs owner JWT) and serve different
// app sections, so they must never share one socket — connecting/​disconnecting
// one must not tear down the other.

let socket: AppSocket | null = null;
/** The customer the live customer socket was opened for (detects identity swaps). */
let connectedCustomerId: string | null = null;

let ownerSocket: AppSocket | null = null;
/** The owner the live owner socket was opened for (detects identity swaps). */
let connectedOwnerId: string | null = null;

function log(...args: unknown[]): void {
  if (__DEV__) console.log('[socket]', ...args);
}

function attachDiagnostics(s: AppSocket, tag = 'socket'): void {
  if (!__DEV__) return;
  s.on('connect', () => log(`[${tag}] connected`, s.id, '→', getSocketOrigin()));
  s.on('disconnect', (reason) => log(`[${tag}] disconnected:`, reason));
  s.on('connect_error', (err) => log(`[${tag}] connect_error:`, err.message));
  s.io.on('reconnect', (n) => log(`[${tag}] reconnected after`, n, 'attempts'));
  s.io.on('reconnect_error', (err) => log(`[${tag}] reconnect_error:`, err.message));
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Connect (or reuse a connection) as the currently logged-in customer.
 *
 * Reads `currentCustomer` from the Suki store and the session token from the
 * encrypted keychain. Returns the live socket, or `null` when there is no
 * logged-in customer / no session token (nothing to authenticate with).
 *
 * Idempotent: if a socket is already live for the same customer it is reused; if
 * a DIFFERENT customer is now logged in, the old socket is torn down first.
 */
export async function connectAsCustomer(): Promise<AppSocket | null> {
  const customer = useSukiStore.getState().currentCustomer;
  const customerId = customer?.id;
  if (!customerId) {
    log('connectAsCustomer skipped — no logged-in customer');
    return null;
  }

  const sessionToken = await getSessionToken();
  if (!sessionToken) {
    log('connectAsCustomer skipped — no session token');
    return null;
  }

  // Reuse a live socket for the same customer.
  if (socket && connectedCustomerId === customerId) {
    if (!socket.connected) socket.connect();
    return socket;
  }

  // A different principal (or a stale socket) — tear it down first.
  if (socket) disconnect();

  connectedCustomerId = customerId;
  socket = io(getSocketOrigin(), {
    // Session-in-handshake: the gateway reads `handshake.auth`.
    auth: { sessionToken, customerId },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
    timeout: 20000,
    autoConnect: true,
  });
  attachDiagnostics(socket);
  return socket;
}

/**
 * Connect (or reuse a connection) as the logged-in business owner using the JWT
 * access token. The gateway joins the owner to `owner:<id>` (shared with their
 * customers) AND `owner-admin:<id>` (owner-only), so this socket receives both
 * customer-facing catalog events and owner-only order events.
 *
 * Uses its OWN singleton (`ownerSocket`), fully independent of the customer
 * socket. Returns `null` when there is no owner access token.
 *
 * Idempotent: reuses a live owner socket for the same owner; tears down and
 * reconnects when a different owner is passed.
 */
export async function connectAsOwner(ownerId?: string): Promise<AppSocket | null> {
  const token = getAccessToken();
  if (!token) {
    log('connectAsOwner skipped — no access token');
    return null;
  }

  // Reuse a live socket for the same owner.
  if (ownerSocket && (ownerId === undefined || connectedOwnerId === ownerId)) {
    if (!ownerSocket.connected) ownerSocket.connect();
    return ownerSocket;
  }

  // A different owner (or a stale socket) — tear it down first.
  if (ownerSocket) disconnectOwner();

  connectedOwnerId = ownerId ?? null;
  ownerSocket = io(getSocketOrigin(), {
    // JWT-in-handshake: the gateway verifies the owner access token.
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
    timeout: 20000,
    autoConnect: true,
  });
  attachDiagnostics(ownerSocket, 'owner');
  return ownerSocket;
}

/** Subscribe to a typed event on the OWNER socket. No-op if not connected. */
export function onOwner<E extends keyof ServerToClientEvents>(
  event: E,
  listener: ServerToClientEvents[E],
): void {
  ownerSocket?.on(event, listener as never);
}

/** Remove a listener (or all for the event) from the OWNER socket. */
export function offOwner<E extends keyof ServerToClientEvents>(
  event: E,
  listener?: ServerToClientEvents[E],
): void {
  if (!ownerSocket) return;
  if (listener) ownerSocket.off(event, listener as never);
  else ownerSocket.off(event);
}

/** Disconnect and dispose the OWNER socket. Safe when already disconnected. */
export function disconnectOwner(): void {
  if (!ownerSocket) return;
  log('disconnecting owner');
  ownerSocket.removeAllListeners();
  ownerSocket.disconnect();
  ownerSocket = null;
  connectedOwnerId = null;
}

/** The live socket, or `null` if not connected. */
export function getSocket(): AppSocket | null {
  return socket;
}

/** Whether the socket exists and is currently connected. */
export function isConnected(): boolean {
  return socket?.connected ?? false;
}

/** Subscribe to a typed server → client event. No-op if there is no socket. */
export function on<E extends keyof ServerToClientEvents>(
  event: E,
  listener: ServerToClientEvents[E],
): void {
  socket?.on(event, listener as never);
}

/** Remove a listener (or all listeners for the event). No-op without a socket. */
export function off<E extends keyof ServerToClientEvents>(
  event: E,
  listener?: ServerToClientEvents[E],
): void {
  if (!socket) return;
  if (listener) socket.off(event, listener as never);
  else socket.off(event);
}

/**
 * Emit a client → server event. Loosely typed on purpose — the client→server map
 * is empty today (customers only listen); this is reserved for the future
 * owner/ack channel.
 */
export function emit(event: string, ...args: unknown[]): void {
  if (!socket) return;
  (socket.emit as unknown as (ev: string, ...a: unknown[]) => void)(event, ...args);
}

/** Disconnect and dispose the singleton. Safe to call when already disconnected. */
export function disconnect(): void {
  if (!socket) return;
  log('disconnecting');
  socket.removeAllListeners();
  socket.disconnect();
  socket = null;
  connectedCustomerId = null;
}
