import { useCallback, useEffect, useMemo, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { api, extractApiError } from '@/core/api';
import { useRefreshControl } from '@/hooks';
import { useSukiStore, selectCurrentCustomer } from '@/store';
import { onCatalogRefresh } from '@/core/realtime/catalogRefreshBus';
import type { OnlineCatalogItem } from '@/types';

/**
 * Shared customer catalog data hook.
 *
 * Owns the single source of truth for the buyable catalog: fetch from
 * `POST /catalog/for-customer`, camel/snake mapping, client-side search filter,
 * loading/error state, manual reload and pull-to-refresh. Consumed by both the
 * customer home (primary product grid) and the dedicated products browse screen
 * so the fetch + mapping logic is never duplicated.
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

export function useCustomerCatalog(): UseCustomerCatalogResult {
  const customer = useSukiStore(selectCurrentCustomer);
  const customerId = customer?.id;
  const businessOwnerId = customer?.businessOwnerId;

  const [items, setItems] = useState<OnlineCatalogItem[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCatalog = useCallback(async () => {
    if (!customerId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      // POST /catalog/for-customer — the backend validates the customer session
      // and returns only available, non-deleted items for the business. The
      // session token authorizes the customer (they are not JWT users).
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
      // Backend returns camelCase; tolerate snake_case too for safety.
      const mapped: OnlineCatalogItem[] = rows.map((r) => ({
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
      }));
      setItems(mapped);
    } catch (err) {
      const { code, detail } = extractApiError(err);
      setError(detail ?? (code === 'NETWORK_ERROR' ? 'Network error. Please try again.' : code));
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, [customerId, businessOwnerId]);

  useEffect(() => {
    if (!customerId) return;
    void loadCatalog();
  }, [customerId, loadCatalog]);

  // Re-fetch when the realtime layer signals a catalog change (e.g. a
  // `catalog:product_created` event), so a newly published product appears in
  // the grid immediately without tight coupling to the socket.
  useEffect(() => onCatalogRefresh(() => void loadCatalog()), [loadCatalog]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.productName.toLowerCase().includes(q));
  }, [search, items]);

  const { refreshing, onRefresh } = useRefreshControl(loadCatalog);

  return {
    items,
    filtered,
    search,
    setSearch,
    isLoading,
    error,
    reload: loadCatalog,
    refreshing,
    onRefresh,
  };
}
