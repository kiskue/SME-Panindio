import { create } from 'zustand';
import { api, extractApiError } from '@/lib/api';
import type { BusinessSearchResult } from '@/types';

// ─── State & Actions ─────────────────────────────────────────────────────────

interface BusinessSearchState {
  results: BusinessSearchResult[];
  isSearching: boolean;
  error: string | null;
  /** Default page of stores shown before the user types (cached after first load). */
  initialResults: BusinessSearchResult[];
  isLoadingInitial: boolean;
  hasLoadedInitial: boolean;
}

interface BusinessSearchActions {
  /**
   * Search for businesses by display name.
   *
   * Queries the `businesses_public` view — a read-only, anon-accessible view
   * that exposes { business_id, business_name, business_code }.
   * See Migration 032b in SUPABASE_SUKI_SCHEMA.md for the view definition.
   *
   * Matches are case-insensitive substring (ilike '%query%').
   * Returns up to 20 results to keep the dropdown manageable.
   * Requires at least 2 characters to avoid full-table scans.
   *
   * The resolved `businessId` UUID is passed to the `register-customer` edge function —
   * the customer never sees the raw code or internal ID.
   */
  searchBusinesses: (query: string) => Promise<BusinessSearchResult[]>;
  /**
   * Load the default page of stores (no query) so the picker can show a few
   * businesses immediately. Cached after the first successful load; pass
   * `force` to refetch.
   */
  loadInitialBusinesses: (force?: boolean) => Promise<BusinessSearchResult[]>;
  clearResults: () => void;
  clearError: () => void;
}

export type BusinessSearchStore = BusinessSearchState & BusinessSearchActions;

// ─── Initial State ────────────────────────────────────────────────────────────

const initialState: BusinessSearchState = {
  results: [],
  isSearching: false,
  error: null,
  initialResults: [],
  isLoadingInitial: false,
  hasLoadedInitial: false,
};

// ─── Store ────────────────────────────────────────────────────────────────────

export const useBusinessSearchStore = create<BusinessSearchStore>()((set, get) => ({
  ...initialState,

  searchBusinesses: async (query) => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      // Avoid flooding the DB on single-keystroke input.
      set({ results: [], isSearching: false });
      return [];
    }

    set({ isSearching: true, error: null });
    try {
      // GET /businesses/search?q= — public endpoint backed by the
      // businesses_public view. Returns up to 20 { businessId, businessCode, businessName }.
      const { data } = await api.get<BusinessSearchResult[]>('/businesses/search', {
        params: { q: trimmed },
      });

      const mapped: BusinessSearchResult[] = (data ?? []).map((row) => ({
        businessId: String(row.businessId ?? ''),
        businessCode: String(row.businessCode ?? ''),
        businessName: String(row.businessName ?? ''),
      }));

      set({ results: mapped, isSearching: false });
      return mapped;
    } catch (err) {
      const { code } = extractApiError(err);
      const message = code === 'NETWORK_ERROR' ? 'Search failed. Please try again.' : code;
      set({ isSearching: false, error: message, results: [] });
      return [];
    }
  },

  loadInitialBusinesses: async (force = false) => {
    const { hasLoadedInitial, initialResults, isLoadingInitial } = get();
    if (isLoadingInitial) return initialResults;
    if (hasLoadedInitial && !force) return initialResults;

    set({ isLoadingInitial: true, error: null });
    try {
      // GET /businesses/search with no `q` — the server returns the default
      // alphabetical page (up to 20) of discoverable stores.
      const { data } = await api.get<BusinessSearchResult[]>('/businesses/search');

      const mapped: BusinessSearchResult[] = (data ?? []).map((row) => ({
        businessId: String(row.businessId ?? ''),
        businessCode: String(row.businessCode ?? ''),
        businessName: String(row.businessName ?? ''),
      }));

      set({ initialResults: mapped, isLoadingInitial: false, hasLoadedInitial: true });
      return mapped;
    } catch (err) {
      const { code } = extractApiError(err);
      const message = code === 'NETWORK_ERROR' ? 'Could not load stores. Please try again.' : code;
      set({ isLoadingInitial: false, error: message });
      return [];
    }
  },

  clearResults: () => set({ results: [], error: null }),
  clearError: () => set({ error: null }),
}));

// ─── Selectors ────────────────────────────────────────────────────────────────

export const selectBusinessSearchResults = (s: BusinessSearchStore) => s.results;
export const selectBusinessSearching = (s: BusinessSearchStore) => s.isSearching;
export const selectBusinessSearchError = (s: BusinessSearchStore) => s.error;
export const selectBusinessInitialResults = (s: BusinessSearchStore) => s.initialResults;
export const selectBusinessLoadingInitial = (s: BusinessSearchStore) => s.isLoadingInitial;
