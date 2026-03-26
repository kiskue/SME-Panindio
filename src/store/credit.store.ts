/**
 * credit.store.ts
 *
 * Zustand v5 store for the Receivables (Utang) module.
 * SQLite is the source of truth — this store is an in-memory cache.
 *
 * Responsibilities:
 *   - Holds the list of active credit customers.
 *   - Holds per-customer summaries (balance, totalCredit, totalPaid).
 *   - Holds the transaction history for the currently-selected customer.
 *   - Exposes actions for all CRUD operations and payment recording.
 *   - Does NOT compute balances — the repository does that in SQL.
 *
 * Boot sequence:
 *   1. `initDatabase()` runs in `_layout.tsx` (tables and indexes exist).
 *   2. `initializeCreditStore()` hydrates customer summaries from SQLite.
 *   3. Screens call `loadCustomerDetail(customerId)` on demand to load
 *      the full transaction history for a customer without pre-loading
 *      every customer's history on boot.
 *
 * Design decisions:
 *   - `customerSummaries` is sorted by balance DESC in the selector so the
 *     leaderboard view requires no extra sort at render time.
 *   - `selectedCustomerSales` and `selectedCustomerPayments` are loaded
 *     on demand — not eagerly — because a typical SME has 10–50 credit
 *     customers and loading all their transactions at boot is wasteful.
 *   - `addCreditSale` and `recordPayment` both refresh the affected
 *     customer's summary after writing so the leaderboard stays live.
 *   - `totalOutstandingBalance` is a scalar KPI for the dashboard.
 *     It is recomputed after every write action.
 *
 * TypeScript strict-mode notes:
 *   - exactOptionalPropertyTypes: optional input fields use conditional spread.
 *   - noUncheckedIndexedAccess: all array/record access uses ?? fallbacks.
 *   - noUnusedLocals: unused vars prefixed with _.
 */

import { create } from 'zustand';
import type {
  CreditCustomer,
  CreditSale,
  CreditSaleWithItems,
  CreditPayment,
  CustomerCreditSummary,
  CreateCreditCustomerInput,
  UpdateCreditCustomerInput,
  CreateCreditSaleInput,
  CreateCreditPaymentInput,
} from '@/types';
import {
  createCreditCustomer,
  updateCreditCustomer,
  deactivateCreditCustomer,
  getActiveCreditCustomers,
  getCustomerSummaries,
  getCustomerBalance,
  getTotalOutstandingBalance,
  createCreditSaleFromPOS,
  getCreditSalesByCustomer,
  recordCreditPayment,
  getCreditPaymentsByCustomer,
} from '../../database/repositories/credit.repository';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Sort summaries by balance descending (highest debt first). */
function sortSummaries(list: CustomerCreditSummary[]): CustomerCreditSummary[] {
  return [...list].sort((a, b) => b.balance - a.balance);
}

/** Derive the three pre-computed summary views from a raw list. */
function deriveViews(summaries: CustomerCreditSummary[]) {
  const sorted = sortSummaries(summaries);
  return {
    customerSummaries:    sorted,
    customersWithBalance: sorted.filter((c) => c.balance > 0),
    fullyPaidCustomers:   sorted.filter((c) => c.isFullyPaid),
  };
}

// ─── State shape ──────────────────────────────────────────────────────────────

interface CreditState {
  /** Active customers — for the customer picker in POS and the customer list screen. */
  customers:               CreditCustomer[];
  /** Customer summaries sorted by balance DESC — for the leaderboard. */
  customerSummaries:       CustomerCreditSummary[];
  /** Customers with a non-zero balance, sorted by balance DESC. */
  customersWithBalance:    CustomerCreditSummary[];
  /** Customers who have fully paid, sorted by balance DESC. */
  fullyPaidCustomers:      CustomerCreditSummary[];
  /** Total outstanding balance across all active customers — dashboard KPI. */
  totalOutstandingBalance: number;

  /** Transaction detail for the currently-viewed customer (with POS line items). */
  selectedCustomerSales:    CreditSaleWithItems[];
  selectedCustomerPayments: CreditPayment[];
  selectedCustomerId:       string | null;

  isLoading:      boolean;
  isDetailLoading: boolean;
  error:          string | null;

  // ── Boot ───────────────────────────────────────────────────────────────────

  /**
   * Loads customer summaries and total balance from SQLite.
   * Called once from `initializeStores()` at app launch.
   */
  initializeCreditStore: () => Promise<void>;

  // ── Customer management ────────────────────────────────────────────────────

  /**
   * Adds a new credit customer and refreshes the summaries list.
   * Returns the created customer.
   */
  addCustomer: (input: CreateCreditCustomerInput) => Promise<CreditCustomer>;

  /**
   * Updates an existing credit customer and refreshes the summaries list.
   * Returns the updated customer.
   */
  editCustomer: (id: string, input: UpdateCreditCustomerInput) => Promise<CreditCustomer>;

  /**
   * Soft-deletes a customer (status → inactive) and removes them from the
   * active customers list. Their balance summary is retained in history.
   */
  removeCustomer: (id: string) => Promise<void>;

  // ── Credit sales ───────────────────────────────────────────────────────────

  /**
   * Records a credit sale (from POS or manual entry) and refreshes the
   * affected customer's balance summary and the total outstanding KPI.
   * Returns the created CreditSale.
   */
  addCreditSale: (input: CreateCreditSaleInput) => Promise<CreditSale>;

  // ── Payments ───────────────────────────────────────────────────────────────

  /**
   * Records a payment against a customer's balance and refreshes their
   * balance summary and the total outstanding KPI.
   * Returns the created CreditPayment.
   */
  recordPayment: (input: CreateCreditPaymentInput) => Promise<CreditPayment>;

  // ── Detail view ────────────────────────────────────────────────────────────

  /**
   * Loads the full transaction history (sales + payments) for a customer.
   * Called when the user opens the Customer Detail screen.
   */
  loadCustomerDetail: (customerId: string) => Promise<void>;

  /** Clears the selected customer's detail data when leaving the detail screen. */
  clearCustomerDetail: () => void;

  // ── Utilities ──────────────────────────────────────────────────────────────

  /** Re-fetches customer summaries and total balance from SQLite. */
  refreshAll: () => Promise<void>;

  /** Clears the last error. */
  clearError: () => void;
}

// ─── Initial state values ─────────────────────────────────────────────────────

const initialState = {
  customers:               [] as CreditCustomer[],
  customerSummaries:       [] as CustomerCreditSummary[],
  customersWithBalance:    [] as CustomerCreditSummary[],
  fullyPaidCustomers:      [] as CustomerCreditSummary[],
  totalOutstandingBalance: 0,
  selectedCustomerSales:    [] as CreditSaleWithItems[],
  selectedCustomerPayments: [] as CreditPayment[],
  selectedCustomerId:       null as string | null,
  isLoading:               false,
  isDetailLoading:         false,
  error:                   null as string | null,
};

// ─── Store ────────────────────────────────────────────────────────────────────

export const useCreditStore = create<CreditState>((set, _get) => ({
  ...initialState,

  // ── Boot ──────────────────────────────────────────────────────────────────

  initializeCreditStore: async () => {
    set({ isLoading: true, error: null });
    try {
      const [customers, summaries, totalBalance] = await Promise.all([
        getActiveCreditCustomers(),
        getCustomerSummaries(),
        getTotalOutstandingBalance(),
      ]);
      set({
        customers,
        ...deriveViews(summaries),
        totalOutstandingBalance: totalBalance,
        isLoading:               false,
      });
    } catch (err) {
      set({
        error:     err instanceof Error ? err.message : 'Failed to load receivables data',
        isLoading: false,
      });
    }
  },

  // ── Customer management ───────────────────────────────────────────────────

  addCustomer: async (input) => {
    try {
      const customer = await createCreditCustomer(input);
      const [customers, summaries, totalBalance] = await Promise.all([
        getActiveCreditCustomers(),
        getCustomerSummaries(),
        getTotalOutstandingBalance(),
      ]);
      set({
        customers,
        ...deriveViews(summaries),
        totalOutstandingBalance: totalBalance,
      });
      return customer;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add customer';
      set({ error: message });
      throw err;
    }
  },

  editCustomer: async (id, input) => {
    try {
      const customer = await updateCreditCustomer(id, input);
      const [customers, summaries, totalBalance] = await Promise.all([
        getActiveCreditCustomers(),
        getCustomerSummaries(),
        getTotalOutstandingBalance(),
      ]);
      set({
        customers,
        ...deriveViews(summaries),
        totalOutstandingBalance: totalBalance,
      });
      return customer;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update customer';
      set({ error: message });
      throw err;
    }
  },

  removeCustomer: async (id) => {
    try {
      await deactivateCreditCustomer(id);
      const [customers, summaries, totalBalance] = await Promise.all([
        getActiveCreditCustomers(),
        getCustomerSummaries(),
        getTotalOutstandingBalance(),
      ]);
      set({
        customers,
        ...deriveViews(summaries),
        totalOutstandingBalance: totalBalance,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to remove customer';
      set({ error: message });
      throw err;
    }
  },

  // ── Credit sales ──────────────────────────────────────────────────────────

  addCreditSale: async (input) => {
    try {
      const sale = await createCreditSaleFromPOS(input);
      // Refresh just the affected customer's summary and the total KPI
      const [summary, totalBalance] = await Promise.all([
        getCustomerBalance(input.customerId),
        getTotalOutstandingBalance(),
      ]);
      set((state) => {
        const updated = state.customerSummaries.map((s) =>
          s.customer.id === input.customerId ? summary : s,
        );
        return {
          totalOutstandingBalance: totalBalance,
          ...deriveViews(updated),
          // Optimistically prepend to the detail view if that customer is open.
          // items is left empty — loadCustomerDetail will re-fetch with full
          // JOIN data when the screen is next focused.
          ...(state.selectedCustomerId === input.customerId
            ? { selectedCustomerSales: [{ ...sale, items: [] }, ...state.selectedCustomerSales] }
            : {}),
        };
      });
      return sale;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to record credit sale';
      set({ error: message });
      throw err;
    }
  },

  // ── Payments ─────────────────────────────────────────────────────────────

  recordPayment: async (input) => {
    try {
      const payment = await recordCreditPayment(input);
      const [summary, totalBalance] = await Promise.all([
        getCustomerBalance(input.customerId),
        getTotalOutstandingBalance(),
      ]);
      set((state) => {
        const updated = state.customerSummaries.map((s) =>
          s.customer.id === input.customerId ? summary : s,
        );
        return {
          totalOutstandingBalance: totalBalance,
          ...deriveViews(updated),
          ...(state.selectedCustomerId === input.customerId
            ? { selectedCustomerPayments: [payment, ...state.selectedCustomerPayments] }
            : {}),
        };
      });
      return payment;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to record payment';
      set({ error: message });
      throw err;
    }
  },

  // ── Detail view ───────────────────────────────────────────────────────────

  loadCustomerDetail: async (customerId) => {
    set({ isDetailLoading: true, selectedCustomerId: customerId, error: null });
    try {
      const [sales, payments] = await Promise.all([
        getCreditSalesByCustomer(customerId),
        getCreditPaymentsByCustomer(customerId),
      ]);
      set({
        selectedCustomerSales:    sales,
        selectedCustomerPayments: payments,
        isDetailLoading:          false,
      });
    } catch (err) {
      set({
        error:           err instanceof Error ? err.message : 'Failed to load customer detail',
        isDetailLoading: false,
      });
    }
  },

  clearCustomerDetail: () => {
    set({
      selectedCustomerSales:    [],
      selectedCustomerPayments: [],
      selectedCustomerId:       null,
    });
  },

  // ── Utilities ─────────────────────────────────────────────────────────────

  refreshAll: async () => {
    set({ isLoading: true, error: null });
    try {
      const [customers, summaries, totalBalance] = await Promise.all([
        getActiveCreditCustomers(),
        getCustomerSummaries(),
        getTotalOutstandingBalance(),
      ]);
      set({
        customers,
        ...deriveViews(summaries),
        totalOutstandingBalance: totalBalance,
        isLoading:               false,
      });
    } catch (err) {
      set({
        error:     err instanceof Error ? err.message : 'Failed to refresh receivables data',
        isLoading: false,
      });
    }
  },

  clearError: () => set({ error: null }),
}));

// ─── Standalone initializer (called by initializeStores) ─────────────────────

export async function initializeCreditStore(): Promise<void> {
  return useCreditStore.getState().initializeCreditStore();
}

// ─── Selectors ────────────────────────────────────────────────────────────────

/** All active credit customers — for the POS customer picker and customer list. */
export const selectCreditCustomers = (s: CreditState): CreditCustomer[] =>
  s.customers;

/**
 * Customer summaries sorted by balance descending (highest debt first).
 * Pre-sorted when stored — returns a stable reference.
 */
export const selectCustomerSummaries = (s: CreditState): CustomerCreditSummary[] =>
  s.customerSummaries;

/** Total outstanding balance across all active customers — dashboard KPI. */
export const selectTotalOutstandingBalance = (s: CreditState): number =>
  s.totalOutstandingBalance;

/** Credit sales for the currently-selected customer (with POS line items). */
export const selectSelectedCustomerSales = (s: CreditState): CreditSaleWithItems[] =>
  s.selectedCustomerSales;

/** Payments for the currently-selected customer. */
export const selectSelectedCustomerPayments = (s: CreditState): CreditPayment[] =>
  s.selectedCustomerPayments;

/** ID of the currently-selected customer. */
export const selectSelectedCustomerId = (s: CreditState): string | null =>
  s.selectedCustomerId;

/** True while loading the customer list or summaries. */
export const selectCreditLoading = (s: CreditState): boolean =>
  s.isLoading;

/** True while loading a customer's transaction detail. */
export const selectCreditDetailLoading = (s: CreditState): boolean =>
  s.isDetailLoading;

/** Last error message, or null. */
export const selectCreditError = (s: CreditState): string | null =>
  s.error;

/**
 * Customers with a non-zero balance (still owe money), sorted by balance DESC.
 * Pre-computed when stored — returns a stable reference.
 */
export const selectCustomersWithBalance = (s: CreditState): CustomerCreditSummary[] =>
  s.customersWithBalance;

/**
 * Customers who have fully paid their balance.
 * Pre-computed when stored — returns a stable reference.
 */
export const selectFullyPaidCustomers = (s: CreditState): CustomerCreditSummary[] =>
  s.fullyPaidCustomers;
