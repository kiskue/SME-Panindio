/**
 * Shared number / currency / percentage formatting utilities.
 *
 * Consolidates the 25+ local `formatCurrency` definitions that previously
 * lived in individual screens and components with inconsistent logic
 * (`toFixed(2) + regex` vs `toLocaleString('en-PH')`). Use these helpers
 * everywhere instead of redefining formatting locally.
 */

const PESO = '₱';
const LOCALE = 'en-PH';

export interface FormatCurrencyOptions {
  /** Number of decimal places. Default `2`. */
  decimals?: number;
  /** Format the absolute value (drops the negative sign). Default `false`. */
  abs?: boolean;
  /** Returned for non-finite values (and, with `dashOnZero`, for values <= 0). Default `'—'`. */
  fallback?: string;
  /** Treat values <= 0 as empty (returns `fallback`). Default `false`. */
  dashOnZero?: boolean;
}

/**
 * Formats a number as Philippine Peso currency with thousands separators.
 *
 * @example
 * formatCurrency(1234.5)                    // '₱1,234.50'
 * formatCurrency(1234.5, { decimals: 0 })   // '₱1,235'
 * formatCurrency(-50, { abs: true })        // '₱50.00'
 * formatCurrency(0, { dashOnZero: true })   // '—'
 * formatCurrency(NaN)                        // '—'
 */
export function formatCurrency(value: number, opts: FormatCurrencyOptions = {}): string {
  const { decimals = 2, abs = false, fallback = '—', dashOnZero = false } = opts;
  if (!Number.isFinite(value)) return fallback;
  if (dashOnZero && value <= 0) return fallback;
  const n = abs ? Math.abs(value) : value;
  return `${PESO}${n.toLocaleString(LOCALE, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

/**
 * Formats a plain number with thousands separators (no currency symbol).
 *
 * @example
 * formatNumber(1234)        // '1,234'
 * formatNumber(1234.5, 2)   // '1,234.50'
 */
export function formatNumber(value: number, decimals = 0): string {
  if (!Number.isFinite(value)) return '—';
  return value.toLocaleString(LOCALE, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Formats a number as a percentage string (value is the percentage, not a ratio).
 *
 * @example
 * formatPercent(42.5)      // '42%'
 * formatPercent(42.5, 1)   // '42.5%'
 */
export function formatPercent(value: number, decimals = 0): string {
  if (!Number.isFinite(value)) return '—';
  return `${value.toLocaleString(LOCALE, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}%`;
}
