import { useCallback, useEffect, useMemo, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { api, extractApiError } from '@/core/api';
import { useRefreshControl } from '@/hooks';
import { useSukiStore, selectCurrentCustomer } from '@/store';
import { onCatalogRefresh } from '@/core/realtime/catalogRefreshBus';
import type { StockUpdatedItem } from '@/core/realtime/events';
import type { OnlineCatalogItem } from '@/types';

/**
 * Shared customer catalog data hook.
 *
 * Owns the single source of truth for the buyable catalog: fetch from
 * `POST /catalog/for-customer`, camel/snake mapping, client-side search filter,
 * loading/error state, manual reload and pull-to-refresh. Consumed by both the
 * customer home (primary product grid) and the dedicated products browse screen
 * so the fetch + mapping logic is never duplicated.
 *
 * Realtime updates are applied WITHOUT a visible reload:
 *   - `catalog:stock_updated` carries the changed rows → patched in place (no
 *     fetch, no loading state) so stock/price/availability just change live.
 *   - `catalog:product_created` (no row data) → a SILENT background re-fetch that
 *     keeps the current grid on screen until the new data arrives.
 */
export interface UseCustomerCatalogResult {
  /** All available catalog items returned by the backend. */
  items: OnlineCatalogItem[];
  /** Items after the current search query is applied. */
  filtered: OnlineCatalogItem[];
  /** Current search query. */
  search: string;
  /** Update the search query. */
  setSearch: (q: string) => void;
  /** True during the initial (blocking) load. */
  isLoading: boolean;
  /** Human-readable load error, or null. */
  error: string | null;
  /** Re-run the catalog fetch (used by the empty/error retry CTA). */
  reload: () => Promise<void>;
  /** True while a pull-to-refresh is in flight. */
  refreshing: boolean;
  /** Pull-to-refresh handler for a FlatList/ScrollView RefreshControl. */
  onRefresh: () => Promise<void>;
}

/**
 * Map one backend/socket row to the domain shape. Backend returns camelCase; we
 * tolerate snake_case too, and it also accepts a `StockUpdatedItem` (same keys),
 * so both the REST fetch and the realtime patch share one mapping.
 */
function mapRow(r: Record<string, unknown>): OnlineCatalogItem {
  return {
    id: String(r['id'] ?? ''),
    businessOwnerId: String(r['businessOwnerId'] ?? r['business_owner_id'] ?? ''),
    productId: String(r['productId'] ?? r['product_id'] ?? ''),
    productName: String(r['productName'] ?? r['product_name'] ?? ''),
    ...((r['productBarcode'] ?? r['product_barcode']) != null
      ? { productBarcode: String(r['productBarcode'] ?? r['product_barcode']) }
      : {}),
    ...((r['productImageUrl'] ?? r['product_image_url']) != null
      ? { productImageUrl: String(r['productImageUrl'] ?? r['product_image_url']) }
      : {}),
    ...((r['customPrice'] ?? r['custom_price']) != null
      ? { customPrice: Number(r['customPrice'] ?? r['custom_price']) }
      : {}),
    isAvailable: Boolean(r['isAvailable'] ?? r['is_available']),
    stockQuantity: Number(r['stockQuantity'] ?? r['stock_quantity'] ?? 0),
    displayOrder: Number(r['displayOrder'] ?? r['display_order'] ?? 0),
    createdAt: String(r['createdAt'] ?? r['created_at'] ?? ''),
    updatedAt: String(r['updatedAt'] ?? r['updated_at'] ?? ''),
  };
}

export function useCustomerCatalog(): UseCustomerCatalogResult {
  const customer = useSukiStore(selectCurrentCustomer);
  const customerId = customer?.id;
  const businessOwnerId = customer?.businessOwnerId;

  const [items, setItems] = useState<OnlineCatalogItem[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch the catalog. When `silent`, the current grid stays on screen: no
   * loading flag is raised and a failure keeps the last-good data instead of
   * blanking it — used for socket-triggered background refreshes.
   */
  const loadCatalog = useCallback(
    async (silent = false) => {
      if (!customerId) {
        setIsLoading(false);
        return;
      }
      if (!silent) {
        setIsLoading(true);
        setError(null);
      }
      try {
        // POST /catalog/for-customer — the backend validates the customer session
        // and returns only available, non-deleted items for the business.
        const sessionToken = await SecureStore.getItemAsync(
          'suki_customer_session_token',
        ).catch(() => null);

        const { data: payload } = await api.post<{ items?: Record<string, unknown>[] }>(
          '/catalog/for-customer',
          {
            ...(businessOwnerId ? { businessOwnerId } : {}),
            customerId,
            ...(sessionToken ? { sessionToken } : {}),
          },
        );

        const rows = payload.items ?? [];
        setItems(rows.map(mapRow));
        if (silent) setError(null);
      } catch (err) {
        if (!silent) {
          const { code, detail } = extractApiError(err);
          setError(detail ?? (code === 'NETWORK_ERROR' ? 'Network error. Please try again.' : code));
          setItems([]);
        } else if (__DEV__) {
          console.warn('[useCustomerCatalog] silent refresh failed:', err);
        }
      } finally {
        if (!silent) setIsLoading(false);
      }
    },
    [customerId, businessOwnerId],
  );

  /**
   * Merge changed rows into the grid IN PLACE (no fetch, no loading state):
   * available rows are upserted (existing keep their position), rows that became
   * unavailable are removed, and a row that just became available is appended.
   */
  const applyPatch = useCallback((changed: StockUpdatedItem[]) => {
    const mapped = changed.map((c) => mapRow(c as unknown as Record<string, unknown>));
    setItems((prev) => {
      const changeByProduct = new Map(mapped.map((m) => [m.productId, m]));
      const presentIds = new Set(prev.map((i) => i.productId));
      const next: OnlineCatalogItem[] = [];
      for (const item of prev) {
        const ch = changeByProduct.get(item.productId);
        if (!ch) {
          next.push(item); // unchanged
        } else if (ch.isAvailable) {
          next.push(ch); // updated in place (position preserved)
        }
        // ch && !isAvailable → dropped from the customer grid
      }
      for (const m of mapped) {
        if (m.isAvailable && !presentIds.has(m.productId)) next.push(m);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (!customerId) return;
    void loadCatalog();
  }, [customerId, loadCatalog]);

  // Realtime: patch in place when the event carries the changed rows; otherwise
  // (e.g. `catalog:product_created`) do a SILENT background re-fetch.
  useEffect(
    () =>
      onCatalogRefresh((patch) => {
        if (patch) applyPatch(patch);
        else void loadCatalog(true);
      }),
    [applyPatch, loadCatalog],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.productName.toLowerCase().includes(q));
  }, [search, items]);

  // Wrap so a caller's event arg (e.g. onPress) can never leak into `silent`.
  const reload = useCallback(() => loadCatalog(false), [loadCatalog]);
  const { refreshing, onRefresh } = useRefreshControl(reload);

  return {
    items,
    filtered,
    search,
    setSearch,
    isLoading,
    error,
    reload,
    refreshing,
    onRefresh,
  };
}
