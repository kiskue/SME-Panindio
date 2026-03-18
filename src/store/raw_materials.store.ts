/**
 * raw_materials.store.ts
 *
 * Zustand v5 store for the Raw Materials module.
 *
 * Architecture:
 *   - SQLite (via repository) is the source of truth.
 *   - `rawMaterials` is an in-memory cache hydrated on boot and kept in sync
 *     with every mutation.
 *   - Filtering (search + category) is performed client-side on the cached
 *     array via a derived selector so the store never re-fetches for UI state.
 *
 * Selector stability:
 *   All selectors that could return arrays use module-level EMPTY_* constants
 *   as fallbacks — NEVER inline `?? []` which would create a new array
 *   reference on every call and cause an infinite useSyncExternalStore loop.
 *
 * Business rules:
 *   - waste | adjustment → updateRawMaterialStock + logRawMaterialConsumption
 *   - sale | production  → updateRawMaterialStock only (upstream store logs)
 *   - delete             → soft delete (is_active = 0), never hard delete
 */

import { create } from 'zustand';
import type {
  RawMaterial,
  CreateRawMaterialInput,
  UpdateRawMaterialInput,
  RawMaterialReason,
  RawMaterialCategory,
} from '@/types';
import {
  getAllRawMaterials,
  getRawMaterialById,
  createRawMaterial as dbCreate,
  updateRawMaterial as dbUpdate,
  deleteRawMaterial as dbDelete,
  updateRawMaterialStock,
  getLowStockRawMaterials,
  logRawMaterialConsumption,
} from '../../database/repositories/raw_materials.repository';
import { useRawMaterialConsumptionLogsStore } from './raw_material_consumption_logs.store';

// ─── Stable empty-array constants ────────────────────────────────────────────
// NEVER use inline `?? []` in selectors — it creates a new reference each call
// and triggers the useSyncExternalStore infinite-loop bug.

const EMPTY_MATERIALS: RawMaterial[] = [];

// ─── State shape ─────────────────────────────────────────────────────────────

interface RawMaterialsState {
  // Data
  rawMaterials:        RawMaterial[];
  lowStockMaterials:   RawMaterial[];
  selectedMaterial:    RawMaterial | null;

  // UI state
  isLoading:           boolean;
  isSaving:            boolean;
  error:               string | null;
  searchQuery:         string;
  selectedCategory:    RawMaterialCategory | 'all';

  // ── Init ───────────────────────────────────────────────────────────────────
  initializeRawMaterials: () => Promise<void>;

  // ── Queries ────────────────────────────────────────────────────────────────
  fetchRawMaterials:  () => Promise<void>;
  fetchLowStock:      () => Promise<void>;

  // ── Mutations ──────────────────────────────────────────────────────────────
  createRawMaterial:  (data: CreateRawMaterialInput) => Promise<void>;
  updateRawMaterial:  (id: string, data: UpdateRawMaterialInput) => Promise<void>;
  deleteRawMaterial:  (id: string) => Promise<void>;
  /**
   * Adjust stock for a raw material.
   * `quantity` is the signed delta (positive = add, negative = remove).
   * For waste and adjustment reasons, a consumption log entry is also created.
   */
  adjustStock:        (
    id: string,
    quantity: number,
    reason: RawMaterialReason,
    notes?: string,
  ) => Promise<void>;

  // ── UI helpers ─────────────────────────────────────────────────────────────
  setSearchQuery:      (q: string) => void;
  setSelectedCategory: (cat: RawMaterialCategory | 'all') => void;
  setSelectedMaterial: (m: RawMaterial | null) => void;
  clearError:          () => void;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useRawMaterialsStore = create<RawMaterialsState>()((set, _get) => ({
  // ── Initial state ──────────────────────────────────────────────────────────
  rawMaterials:      [],
  lowStockMaterials: [],
  selectedMaterial:  null,
  isLoading:         false,
  isSaving:          false,
  error:             null,
  searchQuery:       '',
  selectedCategory:  'all',

  // ── Init ───────────────────────────────────────────────────────────────────
  initializeRawMaterials: async () => {
    set({ isLoading: true, error: null });
    try {
      const [all, low] = await Promise.all([
        getAllRawMaterials(true),
        getLowStockRawMaterials(),
      ]);
      set({ rawMaterials: all, lowStockMaterials: low });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to load raw materials' });
    } finally {
      set({ isLoading: false });
    }
  },

  // ── Queries ────────────────────────────────────────────────────────────────
  fetchRawMaterials: async () => {
    set({ isLoading: true, error: null });
    try {
      const all = await getAllRawMaterials(true);
      set({ rawMaterials: all });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to fetch raw materials' });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchLowStock: async () => {
    try {
      const low = await getLowStockRawMaterials();
      set({ lowStockMaterials: low });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to fetch low stock' });
    }
  },

  // ── Mutations ──────────────────────────────────────────────────────────────
  createRawMaterial: async (data) => {
    set({ isSaving: true, error: null });
    try {
      const created = await dbCreate(data);
      set((s) => ({ rawMaterials: [created, ...s.rawMaterials] }));
      // Refresh low stock in background
      getLowStockRawMaterials()
        .then((low) => set({ lowStockMaterials: low }))
        .catch(() => undefined);
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to create raw material' });
      throw err;
    } finally {
      set({ isSaving: false });
    }
  },

  updateRawMaterial: async (id, data) => {
    set({ isSaving: true, error: null });
    try {
      const updated = await dbUpdate(id, data);
      set((s) => ({
        rawMaterials:     s.rawMaterials.map((m) => (m.id === id ? updated : m)),
        selectedMaterial: s.selectedMaterial?.id === id ? updated : s.selectedMaterial,
      }));
      getLowStockRawMaterials()
        .then((low) => set({ lowStockMaterials: low }))
        .catch(() => undefined);
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to update raw material' });
      throw err;
    } finally {
      set({ isSaving: false });
    }
  },

  deleteRawMaterial: async (id) => {
    set({ isSaving: true, error: null });
    try {
      await dbDelete(id); // soft delete — sets is_active = 0
      set((s) => ({
        rawMaterials:     s.rawMaterials.filter((m) => m.id !== id),
        lowStockMaterials: s.lowStockMaterials.filter((m) => m.id !== id),
        selectedMaterial: s.selectedMaterial?.id === id ? null : s.selectedMaterial,
      }));
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to deactivate raw material' });
      throw err;
    } finally {
      set({ isSaving: false });
    }
  },

  adjustStock: async (id, quantity, reason, notes) => {
    set({ isSaving: true, error: null });
    try {
      // 1. Apply stock delta
      await updateRawMaterialStock(id, quantity);

      // 2. Log consumption for waste / manual adjustments only.
      //    sale and production upstream stores own their own log entries.
      if (reason === 'waste' || reason === 'adjustment') {
        await logRawMaterialConsumption({
          rawMaterialId: id,
          quantityUsed:  Math.abs(quantity),   // always positive — sign is conveyed by reason
          reason,
          ...(notes !== undefined ? { notes } : {}),
        });
        // Notify the logs store so the logs screen updates without requiring navigation
        useRawMaterialConsumptionLogsStore.getState().refreshLogs().catch(() => undefined);
      }

      // 3. Refresh the affected item in cache
      const refreshed = await getRawMaterialById(id);
      if (refreshed) {
        set((s) => ({
          rawMaterials:     s.rawMaterials.map((m) => (m.id === id ? refreshed : m)),
          selectedMaterial: s.selectedMaterial?.id === id ? refreshed : s.selectedMaterial,
        }));
      }

      // 4. Refresh low-stock list
      getLowStockRawMaterials()
        .then((low) => set({ lowStockMaterials: low }))
        .catch(() => undefined);
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to adjust stock' });
      throw err;
    } finally {
      set({ isSaving: false });
    }
  },

  // ── UI helpers ─────────────────────────────────────────────────────────────
  setSearchQuery:      (q)   => set({ searchQuery: q }),
  setSelectedCategory: (cat) => set({ selectedCategory: cat }),
  setSelectedMaterial: (m)   => set({ selectedMaterial: m }),
  clearError:          ()    => set({ error: null }),
}));

// ─── Bootstrap ────────────────────────────────────────────────────────────────

export async function initializeRawMaterials(): Promise<void> {
  await useRawMaterialsStore.getState().initializeRawMaterials();
}

// ─── Selectors ────────────────────────────────────────────────────────────────
// All selectors returning arrays use module-level EMPTY_* constants as fallbacks.
// NEVER write: (s) => s.items ?? []  — that creates a new [] each call.

export const selectRawMaterials        = (s: RawMaterialsState): RawMaterial[] =>
  s.rawMaterials.length > 0 ? s.rawMaterials : EMPTY_MATERIALS;

export const selectLowStockMaterials   = (s: RawMaterialsState): RawMaterial[] =>
  s.lowStockMaterials.length > 0 ? s.lowStockMaterials : EMPTY_MATERIALS;

export const selectSelectedMaterial    = (s: RawMaterialsState) => s.selectedMaterial;
export const selectRawMaterialsLoading = (s: RawMaterialsState) => s.isLoading;
export const selectRawMaterialsSaving  = (s: RawMaterialsState) => s.isSaving;
export const selectRawMaterialsError   = (s: RawMaterialsState) => s.error;
export const selectRawMaterialsSearch  = (s: RawMaterialsState) => s.searchQuery;
export const selectRawMaterialsCategory = (s: RawMaterialsState) => s.selectedCategory;

/**
 * Derived selector: applies search and category filter client-side.
 * Returns the stored array reference when no filter is active (avoids
 * unnecessary new array allocations on every render).
 *
 * WARNING — DO NOT call this as a naked Zustand selector:
 *   const filtered = useRawMaterialsStore(selectFilteredRawMaterials); // BAD
 *
 * When any filter is active, `.filter()` returns a new array reference on
 * every call. Zustand's useSyncExternalStore compares snapshots with ===,
 * so it schedules a re-render → selector runs again → new array → infinite loop.
 *
 * Correct usage:
 *   const rawMaterials = useRawMaterialsStore(selectRawMaterials);       // stable ref
 *   const searchQuery  = useRawMaterialsStore(selectRawMaterialsSearch); // primitive
 *   const selectedCat  = useRawMaterialsStore(selectRawMaterialsCategory); // primitive
 *   const filtered = useMemo(() => selectFilteredRawMaterials({ ...storeSnapshot }),
 *                             [rawMaterials, searchQuery, selectedCat]);
 *
 * Or wrap with useShallow if you must use it as a direct selector:
 *   const filtered = useRawMaterialsStore(useShallow(selectFilteredRawMaterials));
 */
export const selectFilteredRawMaterials = (s: RawMaterialsState): RawMaterial[] => {
  const { rawMaterials, searchQuery, selectedCategory } = s;
  const noFilter = !searchQuery && selectedCategory === 'all';
  if (noFilter) return rawMaterials.length > 0 ? rawMaterials : EMPTY_MATERIALS;

  const q = searchQuery.toLowerCase();
  return rawMaterials.filter((m) => {
    const matchesSearch   = !q || m.name.toLowerCase().includes(q) ||
      (m.description?.toLowerCase().includes(q) ?? false);
    const matchesCategory = selectedCategory === 'all' || m.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });
};

export const selectLowStockCount = (s: RawMaterialsState) => s.lowStockMaterials.length;
