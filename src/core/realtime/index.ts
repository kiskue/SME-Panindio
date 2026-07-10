/**
 * Realtime layer barrel.
 *
 * Socket.IO client singleton, the shared event contract, the catalog-refresh
 * bus, and the `RealtimeProvider` controller. Import from `@/core/realtime`
 * rather than reaching into individual files.
 */
export {
  getSocketOrigin,
  connectAsCustomer,
  connectAsOwner,
  getSocket,
  isConnected,
  on,
  off,
  emit,
  disconnect,
} from './socket';

export {
  REALTIME_EVENTS,
  type RealtimeEventName,
  type ProductCreatedPayload,
  type ServerToClientEvents,
  type ClientToServerEvents,
} from './events';

export { onCatalogRefresh, requestCatalogRefresh } from './catalogRefreshBus';

export { RealtimeProvider } from './RealtimeProvider';
