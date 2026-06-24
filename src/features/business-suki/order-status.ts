import type { OrderStatus, PaymentStatus } from '@/types';

/** Short, owner-friendly labels for each order status. */
export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING:   'New',
  CONFIRMED: 'Confirmed',
  PREPARING: 'Preparing',
  READY:     'Ready',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

/** Badge colors per status, themed for light/dark. */
export function ORDER_STATUS_COLORS(isDark: boolean): Record<OrderStatus, { bg: string; text: string }> {
  return isDark
    ? {
        PENDING:   { bg: 'rgba(251,191,36,0.15)', text: '#FCD34D' },
        CONFIRMED: { bg: 'rgba(79,158,255,0.15)', text: '#93C5FD' },
        PREPARING: { bg: 'rgba(251,191,36,0.15)', text: '#FCD34D' },
        READY:     { bg: 'rgba(61,214,140,0.15)', text: '#3DD68C' },
        COMPLETED: { bg: 'rgba(255,255,255,0.08)', text: 'rgba(255,255,255,0.65)' },
        CANCELLED: { bg: 'rgba(255,107,107,0.15)', text: '#FF6B6B' },
      }
    : {
        PENDING:   { bg: '#FEF9C3', text: '#78350F' },
        CONFIRMED: { bg: '#EFF6FF', text: '#1E40AF' },
        PREPARING: { bg: '#FEF3C7', text: '#92400E' },
        READY:     { bg: '#ECFDF5', text: '#065F46' },
        COMPLETED: { bg: '#F3F4F6', text: '#374151' },
        CANCELLED: { bg: '#FEF2F2', text: '#991B1B' },
      };
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
