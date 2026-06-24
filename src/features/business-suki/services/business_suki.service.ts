/**
 * Business Suki Service  (Suki — Business-Owner Module)
 * =======================================================
 * Business-owner Suki management against the NestJS backend (replaces the
 * Supabase client queries + the register-customer Edge Function).
 *
 * Covers:
 *   1. Customer management — list, detail, verify, reject, pay-later toggle
 *   2. Online catalog management — list, add/upsert, toggle availability, remove
 *   3. Customer registration by the business owner (username + password)
 *
 * Auth: the owner JWT is attached automatically by the axios client. The backend
 * scopes every query to business_owner_id = the authenticated owner (the
 * application-layer replacement for Supabase RLS), so the legacy `businessId`
 * parameters are accepted for call-site compatibility but no longer required.
 *
 * The backend already returns camelCase DTOs matching the domain types, so
 * responses are consumed directly with no row mapping.
 */

import { api, extractApiError } from '@/lib/api';
import type {
  CustomerSummary,
  CustomerDetail,
  OnlineCatalogItem,
  BusinessRegisterCustomerInput,
  BusinessOrder,
  BusinessOrderItem,
  OrderStatus,
  PaymentStatus,
} from '@/types';

// ── Customer Queries ───────────────────────────────────────────────────────

/** Loads all active, non-deleted customers for the authenticated business, newest first. */
export async function fetchLoyalCustomers(_businessId?: string): Promise<CustomerSummary[]> {
  const { data } = await api.get<CustomerSummary[]>('/customers');
  return data ?? [];
}

/** Loads the full detail view for a single customer. */
export async function fetchCustomerDetail(customerId: string): Promise<CustomerDetail> {
  const { data } = await api.get<CustomerDetail>(`/customers/${customerId}`);
  return data;
}

// ── Customer Mutations ─────────────────────────────────────────────────────

/** Sets a customer's verification status to VERIFIED. */
export async function approveCustomer(customerId: string): Promise<void> {
  await api.patch(`/customers/${customerId}/approve`);
}

/** Sets a customer's verification status to REJECTED with a reason. */
export async function rejectCustomer(customerId: string, reason: string): Promise<void> {
  await api.patch(`/customers/${customerId}/reject`, { reason });
}

/** Toggles the Pay Later (credit purchasing) flag for a customer. */
export async function setCustomerPayLater(customerId: string, enabled: boolean): Promise<void> {
  await api.patch(`/customers/${customerId}/pay-later`, { enabled });
}

// ── Catalog Queries ────────────────────────────────────────────────────────

/**
 * Normalizes a catalog item from the backend.
 *
 * `custom_price` is a Postgres DECIMAL(12,2) column, which the driver serializes
 * as a STRING (e.g. "100.00"), not a number. The domain type declares
 * `customPrice` as a number, so coerce here at the boundary — otherwise callers
 * that do `customPrice.toFixed()` crash. `displayOrder` gets the same treatment
 * for safety. A null/empty price is dropped so the field stays optional.
 */
function normalizeCatalogItem(raw: OnlineCatalogItem): OnlineCatalogItem {
  const cp = (raw as { customPrice?: unknown }).customPrice;
  const hasPrice = cp !== null && cp !== undefined && cp !== '';
  const dn = (raw as { displayOrder?: unknown }).displayOrder;
  const sq = (raw as { stockQuantity?: unknown }).stockQuantity;
  const { customPrice: _drop, ...rest } = raw;
  return {
    ...rest,
    ...(hasPrice ? { customPrice: Number(cp) } : {}),
    stockQuantity: sq !== null && sq !== undefined ? Number(sq) : 0,
    displayOrder: dn !== null && dn !== undefined ? Number(dn) : raw.displayOrder,
  };
}

/** Loads the online catalog for the authenticated business, ordered by display_order. */
export async function fetchCatalog(_businessId?: string): Promise<OnlineCatalogItem[]> {
  const { data } = await api.get<OnlineCatalogItem[]>('/catalog');
  return (data ?? []).map(normalizeCatalogItem);
}

// ── Catalog Mutations ──────────────────────────────────────────────────────

/**
 * Toggles is_available for a catalog item by product id. Optionally pushes a
 * fresh stock snapshot so re-enabling a product also refreshes the stock
 * customers see.
 */
export async function setCatalogItemAvailability(
  productId: string,
  isAvailable: boolean,
  _businessId?: string,
  stockQuantity?: number,
): Promise<void> {
  await api.patch('/catalog/availability', {
    productId,
    isAvailable,
    ...(stockQuantity !== undefined ? { stockQuantity } : {}),
  });
}

/**
 * Adds a product to the catalog or updates the existing active entry.
 * The backend handles the soft-delete-aware upsert.
 */
export async function upsertCatalogItem(
  productId: string,
  productName: string,
  _businessId?: string,
  options: {
    productBarcode?: string;
    productImageUrl?: string;
    customPrice?: number;
    stockQuantity?: number;
  } = {},
): Promise<OnlineCatalogItem> {
  const { data } = await api.post<OnlineCatalogItem>('/catalog', {
    productId,
    productName,
    ...(options.productBarcode !== undefined ? { productBarcode: options.productBarcode } : {}),
    ...(options.productImageUrl !== undefined ? { productImageUrl: options.productImageUrl } : {}),
    ...(options.customPrice !== undefined ? { customPrice: options.customPrice } : {}),
    ...(options.stockQuantity !== undefined ? { stockQuantity: options.stockQuantity } : {}),
  });
  return normalizeCatalogItem(data);
}

/** Soft-deletes a catalog item (hidden from catalog, recoverable via upsert). */
export async function softDeleteCatalogItem(catalogItemId: string): Promise<void> {
  await api.delete(`/catalog/${catalogItemId}`);
}

// ── Business Order Management ───────────────────────────────────────────────

/** Coerce a server order (DECIMALs as strings) into the numeric domain shape. */
function normalizeBusinessOrder(raw: Record<string, unknown>): BusinessOrder {
  const items = Array.isArray(raw['items']) ? (raw['items'] as Record<string, unknown>[]) : [];
  return {
    id: String(raw['id'] ?? ''),
    orderNumber: String(raw['orderNumber'] ?? ''),
    customerId: String(raw['customerId'] ?? ''),
    businessOwnerId: String(raw['businessOwnerId'] ?? ''),
    subtotal: Number(raw['subtotal'] ?? 0),
    vatAmount: Number(raw['vatAmount'] ?? 0),
    totalAmount: Number(raw['totalAmount'] ?? 0),
    paymentMethod: (raw['paymentMethod'] as BusinessOrder['paymentMethod']) ?? 'PAY_NOW',
    paymentStatus: (raw['paymentStatus'] as PaymentStatus) ?? 'UNPAID',
    orderStatus: (raw['orderStatus'] as OrderStatus) ?? 'PENDING',
    customerNotes: (raw['customerNotes'] as string | null) ?? null,
    customerName: (raw['customerName'] as string | null) ?? null,
    customerPhone: (raw['customerPhone'] as string | null) ?? null,
    orderDate: String(raw['orderDate'] ?? ''),
    confirmedAt: (raw['confirmedAt'] as string | null) ?? null,
    readyAt: (raw['readyAt'] as string | null) ?? null,
    completedAt: (raw['completedAt'] as string | null) ?? null,
    cancelledAt: (raw['cancelledAt'] as string | null) ?? null,
    cancellationReason: (raw['cancellationReason'] as string | null) ?? null,
    createdAt: String(raw['createdAt'] ?? ''),
    updatedAt: String(raw['updatedAt'] ?? ''),
    items: items.map((i): BusinessOrderItem => ({
      id: String(i['id'] ?? ''),
      productId: String(i['productId'] ?? ''),
      productName: String(i['productName'] ?? ''),
      productBarcode: (i['productBarcode'] as string | null) ?? null,
      unitPrice: Number(i['unitPrice'] ?? 0),
      quantity: Number(i['quantity'] ?? 0),
      lineTotal: Number(i['lineTotal'] ?? 0),
      catalogItemId: (i['catalogItemId'] as string | null) ?? null,
    })),
  };
}

/** Loads the authenticated owner's online orders, newest first. Optional status filter. */
export async function fetchBusinessOrders(
  status?: OrderStatus,
): Promise<BusinessOrder[]> {
  const { data } = await api.get<{ orders?: Record<string, unknown>[] }>('/orders/business', {
    ...(status !== undefined ? { params: { status } } : {}),
  });
  return (data.orders ?? []).map(normalizeBusinessOrder);
}

/** Loads a single owner order with its line items. */
export async function fetchBusinessOrder(orderId: string): Promise<BusinessOrder> {
  const { data } = await api.get<Record<string, unknown>>(`/orders/business/${orderId}`);
  return normalizeBusinessOrder(data);
}

/**
 * Advances / confirms / completes / cancels an order. Completing it deducts stock
 * server-side. Returns the updated order.
 */
export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus,
  cancellationReason?: string,
): Promise<BusinessOrder> {
  const { data } = await api.patch<Record<string, unknown>>(`/orders/${orderId}/status`, {
    status,
    ...(cancellationReason !== undefined ? { cancellationReason } : {}),
  });
  return normalizeBusinessOrder(data);
}

/** Records payment collection for an order. Returns the updated order. */
export async function updatePaymentStatus(
  orderId: string,
  paymentStatus: PaymentStatus,
): Promise<BusinessOrder> {
  const { data } = await api.patch<Record<string, unknown>>(`/orders/${orderId}/payment`, {
    paymentStatus,
  });
  return normalizeBusinessOrder(data);
}

// ── Customer Registration ──────────────────────────────────────────────────

export interface RegisterCustomerResult {
  customerId: string;
}

/**
 * Registers a new customer on behalf of the authenticated business owner.
 * business_owner_id is resolved server-side from the owner JWT; the password is
 * hashed server-side. No QR token is generated.
 */
export async function registerCustomerByBusiness(
  input: BusinessRegisterCustomerInput,
  _businessId?: string,
): Promise<RegisterCustomerResult> {
  try {
    const { data } = await api.post<{ customerId: string }>('/customers', {
      username: input.username,
      password: input.password,
      fullName: input.fullName,
      phoneNumber: input.phoneNumber,
      ...(input.email !== undefined ? { email: input.email } : {}),
    });
    if (!data.customerId) throw new Error('Registration failed: no customer ID returned.');
    return { customerId: data.customerId };
  } catch (err) {
    const { code, detail } = extractApiError(err);
    const messages: Record<string, string> = {
      USERNAME_TAKEN: 'This username is already taken for your business.',
      REGISTRATION_FAILED: 'Customer registration failed. Please try again.',
      MISSING_FIELDS: 'Please fill in all required fields.',
    };
    throw new Error(messages[code] ?? detail ?? 'Something went wrong.');
  }
}
