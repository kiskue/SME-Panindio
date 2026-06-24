import type { OrderStatus, PaymentStatus } from '@/types';
import { orderStatusColors } from '@/core/theme/statusColors';

/** Short, owner-friendly labels for each order status. */
export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING:   'New',
  CONFIRMED: 'Confirmed',
  PREPARING: 'Preparing',
  READY:     'Ready',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

/**
 * Badge colors per status, themed for light/dark.
 * Delegates to the canonical map in `@/core/theme/statusColors` so order
 * badge tints stay identical across the business and customer portals.
 */
export function ORDER_STATUS_COLORS(isDark: boolean): Record<OrderStatus, { bg: string; text: string }> {
  return orderStatusColors(isDark);
}

/**
 * Allowed forward/cancel transitions per status — mirrors the server contract.
 * Used to decide which action buttons to show the owner.
 */
export const ALLOWED_NEXT_STATUSES: Record<OrderStatus, OrderStatus[]> = {
  PENDING:   ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PREPARING', 'READY', 'COMPLETED', 'CANCELLED'],
  PREPARING: ['READY', 'COMPLETED', 'CANCELLED'],
  READY:     ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  UNPAID:         'Unpaid',
  PAID:           'Paid',
  PARTIALLY_PAID: 'Partially Paid',
};
