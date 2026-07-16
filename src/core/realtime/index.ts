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
  onOwner,
  offOwner,
  emit,
  disconnect,
  disconnectOwner,
} from './socket';

export {
  REALTIME_EVENTS,
  type RealtimeEventName,
  type ProductCreatedPayload,
  type StockUpdatedItem,
  type StockUpdatedPayload,
  type OrderPlacedPayload,
  type OrderCompletedPayload,
  type OrderStatusUpdatedPayload,
  type ServerToClientEvents,
  type ClientToServerEvents,
} from './events';

export {
  onCatalogRefresh,
  requestCatalogRefresh,
  requestCatalogStockPatch,
} from './catalogRefreshBus';

export { RealtimeProvider } from './RealtimeProvider';
