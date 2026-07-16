/**
 * Business Suki Store  (Suki — Business-Owner Module)
 * =====================================================
 * Manages the business owner's view of their Suki (loyal customer) data.
 *
 * What this store does:
 *   - Holds the list of loyal customers and the currently selected customer detail
 *   - Holds the online catalog items for the business
 *   - Delegates all Supabase calls to `business_suki.service.ts` (service layer)
 *   - Applies optimistic UI updates for mutations where possible
 *
 * This store is NOT persisted — it is loaded fresh on each relevant screen mount.
 * Reason: customer verification status, pay-later flags, and catalog availability
 * can be changed from multiple devices; stale persisted data would be misleading.
 *
 * TODO: Add real-time subscriptions (Supabase Realtime) to the `customers` table so
 *       the list updates automatically when another device changes verification status.
 * TODO: Add pagination to `loadLoyalCustomers` — large customer lists should be
 *       fetched in pages of 50 rather than loading all rows at once.
 * TODO: Separate catalog management into its own store (`catalog.store.ts`) once
 *       the online ordering module grows. The combined store is acceptable for now.
 */

import { create } from 'zustand';
import type { StockUpdatedItem } from '@/core/realtime/events';
import type {
  CustomerSummary,
  CustomerDetail,
  CustomerVerificationStatus,
  OnlineCatalogItem,
  BusinessRegisterCustomerInput,
} from '@/types';

/** Map a realtime stock-updated row to the catalog domain shape (price → number). */
function stockItemToCatalogItem(it: StockUpdatedItem): OnlineCatalogItem {
  return {
    id: it.id,
    businessOwnerId: it.businessOwnerId,
    productId: it.productId,
    productName: it.productName,
    ...(it.productBarcode != null ? { productBarcode: it.productBarcode } : {}),
    ...(it.productImageUrl != null ? { productImageUrl: it.productImageUrl } : {}),
    ...(it.customPrice != null ? { customPrice: Number(it.customPrice) } : {}),
    isAvailable: it.isAvailable,
    stockQuantity: it.stockQuantity,
    displayOrder: it.displayOrder,
    createdAt: it.createdAt,
    updatedAt: it.updatedAt,
  };
}
import {
  fetchLoyalCustomers,
  fetchCustomerDetail,
  approveCustomer,
  rejectCustomer,
  setCustomerPayLater,
  fetchCatalog,
  setCatalogItemAvailability,
  upsertCatalogItem,
  softDeleteCatalogItem,
  registerCustomerByBusiness,
} from '@/features/business-suki/services/business_suki.service';

// ── State & Actions ────────────────────────────────────────────────────────

interface SukiBusinessState {
  /** Flat list shown in the customer management screen. */
  loyalCustomers: CustomerSummary[];
  /** Full detail for the currently open customer profile. */
  selectedCustomer: CustomerDetail | null;
  /** Products the business has enabled for online ordering. */
  catalogItems: OnlineCatalogItem[];
  /** Loading flag for customer-related operations. */
  isLoading: boolean;
  /** Separate loading flag for catalog operations (avoids blocking the customer list). */
  isCatalogLoading: boolean;
  error: string | null;
}

interface SukiBusinessActions {
  /** Loads all active customers for the given business. */
  loadLoyalCustomers: (businessId: string) => Promise<void>;

  /** Loads full detail for a single customer (includes username and timestamps). */
  loadCustomerDetail: (customerId: string) => Promise<void>;

  /** Approves a customer's verification status (VERIFIED). */
  approveCustomer: (customerId: string) => Promise<void>;

  /** Rejects a customer's verification status with a reason (REJECTED). */
  rejectCustomer: (customerId: string, reason: string) => Promise<void>;

  /** Enables or disables Pay Later (credit purchasing) for a customer. */
  togglePayLater: (customerId: string, enabled: boolean) => Promise<void>;

  /** Loads the online catalog for the given business. */
  loadCatalog: (businessId: string) => Promise<void>;

  /**
   * Sets is_available for a catalog item. Optionally refreshes the stock
   * snapshot customers see (pass the product's current on-hand quantity).
   */
  toggleCatalogItem: (
    productId: string,
    isAvailable: boolean,
    businessId: string,
    stockQuantity?: number,
  ) => Promise<void>;

  /**
   * Adds a product to the catalog or restores a previously removed one.
   * Handles the unique-constraint / soft-delete edge case internally.
   */
  addProductToCatalog: (
    productId: string,
    productName: string,
    productBarcode: string | undefined,
    productImageUrl: string | undefined,
    businessId: string,
    customPrice?: number,
    stockQuantity?: number,
  ) => Promise<void>;

  /**
   * Manual catalog-listing management (the "manage listing" sheet): set the
   * allocated online stock, availability, and optional price for a product in one
   * call. Works whether or not the product is already on the catalog — updates the
   * existing active row, or creates it. Unlike `toggleCatalogItem`/first-time
   * enable, the caller supplies the exact stock allocation (it is NOT auto-derived
   * from on-hand inventory).
   */
  updateCatalogListing: (
    productId: string,
    input: {
      isAvailable: boolean;
      stockQuantity: number;
      customPrice?: number;
      productName?: string;
      productBarcode?: string;
    },
    businessId: string,
  ) => Promise<void>;

  /** Soft-deletes a catalog item (hidden from catalog, recoverable via addProduct). */
  removeProductFromCatalog: (catalogItemId: string) => Promise<void>;

  /**
   * Merges realtime `catalog:stock_updated` rows into the catalog list IN PLACE
   * (upsert by productId; the owner keeps unavailable rows visible) so the owner's
   * catalog view updates live without a reload.
   */
  patchCatalogItems: (items: StockUpdatedItem[]) => void;

  /**
   * Registers a new customer under the logged-in business owner.
   * Password is hashed server-side. No QR token is generated.
   * Returns { customerId } on success, null on failure (error is set on state).
   */
  registerCustomerByBusiness: (
    input: BusinessRegisterCustomerInput,
    businessId: string,
  ) => Promise<{ customerId: string } | null>;

  clearError: () => void;
}

export type SukiBusinessStore = SukiBusinessState & SukiBusinessActions;

// ── Initial State ──────────────────────────────────────────────────────────

const initialState: SukiBusinessState = {
  loyalCustomers:   [],
  selectedCustomer: null,
  catalogItems:     [],
  isLoading:        false,
  isCatalogLoading: false,
  error:            null,
};

// ── Store ──────────────────────────────────────────────────────────────────

export const useSukiBusinessStore = create<SukiBusinessStore>()((set, get) => ({
  ...initialState,

  // ── Customer Management ──────────────────────────────────────────────────

  loadLoyalCustomers: async (businessId) => {
    set({ isLoading: true, error: null });
    try {
      const customers = await fetchLoyalCustomers(businessId);
      set({ loyalCustomers: customers, isLoading: false });
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to load customers',
      });
    }
  },

  loadCustomerDetail: async (customerId) => {
    set({ isLoading: true, error: null });
    try {
      const detail = await fetchCustomerDetail(customerId);
      set({ selectedCustomer: detail, isLoading: false });
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to load customer',
      });
    }
  },

  approveCustomer: async (customerId) => {
    set({ isLoading: true, error: null });
    try {
      await approveCustomer(customerId);
      // Optimistic update: reflect the new status immediately in both lists.
      set((s) => ({
        isLoading: false,
        loyalCustomers: s.loyalCustomers.map((c) =>
          c.id === customerId
            ? { ...c, verificationStatus: 'VERIFIED' as CustomerVerificationStatus }
            : c,
        ),
        selectedCustomer:
          s.selectedCustomer?.id === customerId
            ? { ...s.selectedCustomer, verificationStatus: 'VERIFIED' as CustomerVerificationStatus }
            : s.selectedCustomer,
      }));
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to approve customer',
      });
    }
  },

  rejectCustomer: async (customerId, reason) => {
    set({ isLoading: true, error: null });
    try {
      await rejectCustomer(customerId, reason);
      set((s) => ({
        isLoading: false,
        loyalCustomers: s.loyalCustomers.map((c) =>
          c.id === customerId
            ? { ...c, verificationStatus: 'REJECTED' as CustomerVerificationStatus }
            : c,
        ),
        selectedCustomer:
          s.selectedCustomer?.id === customerId
            ? {
                ...s.selectedCustomer,
                verificationStatus: 'REJECTED' as CustomerVerificationStatus,
                rejectionReason: reason,
              }
            : s.selectedCustomer,
      }));
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to reject customer',
      });
    }
  },

  togglePayLater: async (customerId, enabled) => {
    try {
      await setCustomerPayLater(customerId, enabled);
      set((s) => ({
        loyalCustomers: s.loyalCustomers.map((c) =>
          c.id === customerId ? { ...c, payLaterEnabled: enabled } : c,
        ),
        selectedCustomer:
          s.selectedCustomer?.id === customerId
            ? { ...s.selectedCustomer, payLaterEnabled: enabled }
            : s.selectedCustomer,
      }));
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to update Pay Later' });
    }
  },

  // ── Catalog Management ───────────────────────────────────────────────────

  loadCatalog: async (businessId) => {
    set({ isCatalogLoading: true, error: null });
    try {
      const items = await fetchCatalog(businessId);
      set({ catalogItems: items, isCatalogLoading: false });
    } catch (err) {
      set({
        isCatalogLoading: false,
        error: err instanceof Error ? err.message : 'Failed to load catalog',
      });
    }
  },

  toggleCatalogItem: async (productId, isAvailable, businessId, stockQuantity) => {
    try {
      await setCatalogItemAvailability(productId, isAvailable, businessId, stockQuantity);
      set((s) => ({
        catalogItems: s.catalogItems.map((item) =>
          item.productId === productId
            ? { ...item, isAvailable, ...(stockQuantity !== undefined ? { stockQuantity } : {}) }
            : item,
        ),
      }));
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to update catalog item' });
      throw err;
    }
  },

  addProductToCatalog: async (productId, productName, productBarcode, productImageUrl, businessId, customPrice, stockQuantity) => {
    try {
      const newItem = await upsertCatalogItem(productId, productName, businessId, {
        ...(productBarcode !== undefined ? { productBarcode } : {}),
        ...(productImageUrl !== undefined ? { productImageUrl } : {}),
        ...(customPrice !== undefined ? { customPrice } : {}),
        ...(stockQuantity !== undefined ? { stockQuantity } : {}),
      });
      set((s) => ({
        catalogItems: s.catalogItems.some((i) => i.productId === productId)
          ? s.catalogItems.map((i) => (i.productId === productId ? newItem : i))
          : [...s.catalogItems, newItem],
      }));
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to add product to catalog' });
      throw err;
    }
  },

  updateCatalogListing: async (productId, input, businessId) => {
    const { isAvailable, stockQuantity, customPrice, productName, productBarcode } = input;
    try {
      const existing = get().catalogItems.find((i) => i.productId === productId);

      if (existing) {
        // Update stock / availability / price on the existing active row in one PATCH.
        await setCatalogItemAvailability(productId, isAvailable, businessId, stockQuantity, customPrice);
        set((s) => ({
          catalogItems: s.catalogItems.map((item) =>
            item.productId === productId
              ? {
                  ...item,
                  isAvailable,
                  stockQuantity,
                  ...(customPrice !== undefined ? { customPrice } : {}),
                }
              : item,
          ),
        }));
        return;
      }

      // New listing: upsert creates the row (server forces is_available = true).
      const newItem = await upsertCatalogItem(productId, productName ?? productId, businessId, {
        stockQuantity,
        ...(customPrice !== undefined ? { customPrice } : {}),
        ...(productBarcode !== undefined ? { productBarcode } : {}),
      });
      // Honor an explicit "unavailable" chosen at creation with a follow-up PATCH.
      let finalItem = newItem;
      if (!isAvailable) {
        await setCatalogItemAvailability(productId, false, businessId, stockQuantity, customPrice);
        finalItem = { ...newItem, isAvailable: false };
      }
      set((s) => ({
        catalogItems: s.catalogItems.some((i) => i.productId === productId)
          ? s.catalogItems.map((i) => (i.productId === productId ? finalItem : i))
          : [...s.catalogItems, finalItem],
      }));
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to update catalog listing' });
      throw err;
    }
  },

  removeProductFromCatalog: async (catalogItemId) => {
    try {
      await softDeleteCatalogItem(catalogItemId);
      set((s) => ({
        catalogItems: s.catalogItems.filter((item) => item.id !== catalogItemId),
      }));
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to remove product from catalog' });
    }
  },

  patchCatalogItems: (items) => {
    if (items.length === 0) return;
    const mapped = items.map(stockItemToCatalogItem);
    set((s) => {
      const byProduct = new Map(mapped.map((m) => [m.productId, m]));
      const present = new Set(s.catalogItems.map((i) => i.productId));
      const updated = s.catalogItems.map((i) => byProduct.get(i.productId) ?? i);
      const added = mapped.filter((m) => !present.has(m.productId));
      return { catalogItems: added.length ? [...updated, ...added] : updated };
    });
  },

  // ── Customer Registration ────────────────────────────────────────────────

  registerCustomerByBusiness: async (input, businessId) => {
    set({ isLoading: true, error: null });
    try {
      // The owner JWT is attached automatically by the API client.
      const result = await registerCustomerByBusiness(input, businessId);
      set({ isLoading: false });
      return result;
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : 'Network error. Please check your connection.',
      });
      return null;
    }
  },

  clearError: () => set({ error: null }),
}));

// ── Selectors ──────────────────────────────────────────────────────────────

export const selectLoyalCustomers             = (s: SukiBusinessStore) => s.loyalCustomers;
export const selectSelectedCustomer           = (s: SukiBusinessStore) => s.selectedCustomer;
export const selectCatalogItems               = (s: SukiBusinessStore) => s.catalogItems;
export const selectSukiBusinessLoading        = (s: SukiBusinessStore) => s.isLoading;
export const selectCatalogLoading             = (s: SukiBusinessStore) => s.isCatalogLoading;
export const selectSukiBusinessError          = (s: SukiBusinessStore) => s.error;
export const selectRegisterCustomerByBusiness = (s: SukiBusinessStore) => s.registerCustomerByBusiness;
