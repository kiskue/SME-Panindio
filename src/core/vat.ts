/**
 * vat.ts — Philippine VAT (12%) calculation utilities.
 *
 * TRAIN Law / BIR standard rate: 12%.
 * VAT-exclusive (B2B default): vat_amount = price × 0.12, total = price × 1.12
 * VAT-inclusive (retail):      vat_amount = price − (price / 1.12), base = price / 1.12
 */

import type { CartItem } from '@/types';

export const VAT_RATE = 0.12;

export type VatType = 'vatable' | 'vat_exempt' | 'zero_rated';

export interface VatCalculation {
  basePrice:  number;
  vatAmount:  number;
  totalPrice: number;
  vatType:    VatType;
}

export interface CartVatSummary {
  vatableSales:   number;  // base price sum of vatable items
  vatExemptSales: number;  // sum of vat_exempt items (no VAT)
  zeroRatedSales: number;  // sum of zero_rated items (0% VAT)
  outputVAT:      number;  // 12% of vatableSales
  grossTotal:     number;  // total including VAT
  netTotal:       number;  // total excluding VAT
}

/**
 * Calculates VAT for a single price point.
 * When vatEnabled is checked at the call site — pass vatType 'vat_exempt'
 * to short-circuit VAT when the global toggle is off.
 */
export function calculateVAT(
  price:       number,
  vatType:     VatType,
  isInclusive: boolean,
): VatCalculation {
  if (vatType === 'vat_exempt' || vatType === 'zero_rated') {
    return { basePrice: price, vatAmount: 0, totalPrice: price, vatType };
  }

  if (isInclusive) {
    // Price already contains VAT: extract the base
    const basePrice = price / (1 + VAT_RATE);
    const vatAmount = price - basePrice;
    return { basePrice, vatAmount, totalPrice: price, vatType };
  }

  // VAT-exclusive: add VAT on top
  const vatAmount  = price * VAT_RATE;
  const totalPrice = price + vatAmount;
  return { basePrice: price, vatAmount, totalPrice, vatType };
}

/**
 * Summarises VAT across all cart items.
 * When vatEnabled === false every item is treated as vat_exempt so no VAT
 * is added and the rows simply do not show in the UI.
 *
 * NOTE: Until per-product vat_type is persisted in the DB all cart items
 * default to 'vatable'.  The isVatInclusive flag comes from the global VAT
 * settings store.
 */
export function computeCartVAT(
  items:      CartItem[],
  vatEnabled: boolean,
): CartVatSummary {
  let vatableSales   = 0;
  let vatExemptSales = 0;
  let zeroRatedSales = 0;

  for (const item of items) {
    if (!vatEnabled) {
      vatExemptSales += item.subtotal;
      continue;
    }
    // Default all products to 'vatable' until per-product vat_type is stored.
    vatableSales += item.subtotal;
  }

  const outputVAT  = vatableSales * VAT_RATE;
  const grossTotal = vatableSales + outputVAT + vatExemptSales + zeroRatedSales;
  const netTotal   = vatableSales + vatExemptSales + zeroRatedSales;

  return { vatableSales, vatExemptSales, zeroRatedSales, outputVAT, grossTotal, netTotal };
}
