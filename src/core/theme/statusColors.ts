/**
 * Centralized status → color maps.
 *
 * These soft-pill color pairs (tinted background + readable foreground) were
 * previously duplicated verbatim across the suki and customer order/profile
 * screens. Source them from here so light/dark tints stay consistent.
 *
 * Pair these with the `StatusBadge` molecule for rendering.
 */

import type { CustomerVerificationStatus, OrderStatus } from '@/types';

export interface StatusColor {
  bg:   string;
  text: string;
}

// ─── Customer verification status ───────────────────────────────────────────

const VERIFICATION_LIGHT: Record<CustomerVerificationStatus, StatusColor> = {
  UNVERIFIED: { bg: '#FEF9C3', text: '#78350F' },
  PENDING:    { bg: '#EFF6FF', text: '#1E40AF' },
  VERIFIED:   { bg: '#ECFDF5', text: '#065F46' },
  REJECTED:   { bg: '#FEF2F2', text: '#991B1B' },
};

const VERIFICATION_DARK: Record<CustomerVerificationStatus, StatusColor> = {
  UNVERIFIED: { bg: 'rgba(251,191,36,0.15)', text: '#FCD34D' },
  PENDING:    { bg: 'rgba(79,158,255,0.15)', text: '#93C5FD' },
  VERIFIED:   { bg: 'rgba(61,214,140,0.15)', text: '#3DD68C' },
  REJECTED:   { bg: 'rgba(255,107,107,0.15)', text: '#FF6B6B' },
};

export function verificationStatusColor(
  status: CustomerVerificationStatus,
  isDark: boolean,
): StatusColor {
  return (isDark ? VERIFICATION_DARK : VERIFICATION_LIGHT)[status];
}

// ─── Online order status ────────────────────────────────────────────────────

const ORDER_LIGHT: Record<OrderStatus, StatusColor> = {
  PENDING:   { bg: '#FEF9C3', text: '#78350F' },
  CONFIRMED: { bg: '#EFF6FF', text: '#1E40AF' },
  PREPARING: { bg: '#FEF3C7', text: '#92400E' },
  READY:     { bg: '#ECFDF5', text: '#065F46' },
  COMPLETED: { bg: '#F3F4F6', text: '#374151' },
  CANCELLED: { bg: '#FEF2F2', text: '#991B1B' },
};

const ORDER_DARK: Record<OrderStatus, StatusColor> = {
  PENDING:   { bg: 'rgba(251,191,36,0.15)',  text: '#FCD34D' },
  CONFIRMED: { bg: 'rgba(79,158,255,0.15)',  text: '#93C5FD' },
  PREPARING: { bg: 'rgba(251,191,36,0.15)',  text: '#FCD34D' },
  READY:     { bg: 'rgba(61,214,140,0.15)',  text: '#3DD68C' },
  COMPLETED: { bg: 'rgba(255,255,255,0.08)', text: 'rgba(255,255,255,0.60)' },
  CANCELLED: { bg: 'rgba(255,107,107,0.15)', text: '#FF6B6B' },
};

/** Full order-status → color record for the active theme. */
export function orderStatusColors(isDark: boolean): Record<OrderStatus, StatusColor> {
  return isDark ? ORDER_DARK : ORDER_LIGHT;
}

export function orderStatusColor(status: OrderStatus, isDark: boolean): StatusColor {
  return orderStatusColors(isDark)[status];
}
