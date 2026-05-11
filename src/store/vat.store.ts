/**
 * vat.store.ts
 *
 * Zustand v5 persisted store for global Philippine VAT (12%) settings.
 *
 * Persisted via AsyncStorage so the merchant's VAT preference survives
 * app restarts. The store is intentionally minimal — VAT computation
 * logic lives in src/lib/vat.ts.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { VatType } from '@/lib/vat';

// ─── State shape ──────────────────────────────────────────────────────────────

interface VatState {
  /** Global on/off toggle. Default true — Philippine businesses are VAT-registered by default. */
  vatEnabled:       boolean;
  /** Default vat_type for new products. */
  defaultVatType:   VatType;
  /** Whether displayed prices already include 12% VAT (retail) or are exclusive (B2B). */
  isVatInclusive:   boolean;

  // ── Actions ────────────────────────────────────────────────────────────────
  setVatEnabled:      (enabled:   boolean)  => void;
  setDefaultVatType:  (type:      VatType)  => void;
  setIsVatInclusive:  (inclusive: boolean)  => void;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useVatStore = create<VatState>()(
  persist(
    (set) => ({
      vatEnabled:      true,
      defaultVatType:  'vatable',
      isVatInclusive:  false,

      setVatEnabled:     (enabled)   => set({ vatEnabled:     enabled   }),
      setDefaultVatType: (type)      => set({ defaultVatType: type      }),
      setIsVatInclusive: (inclusive) => set({ isVatInclusive: inclusive }),
    }),
    {
      name:    'vat-settings',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

// ─── Selectors ────────────────────────────────────────────────────────────────

export const selectVatEnabled      = (s: VatState): boolean  => s.vatEnabled;
export const selectDefaultVatType  = (s: VatState): VatType  => s.defaultVatType;
export const selectIsVatInclusive  = (s: VatState): boolean  => s.isVatInclusive;
