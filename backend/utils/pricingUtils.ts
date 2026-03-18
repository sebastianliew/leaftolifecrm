/**
 * Centralized pricing utilities for transaction items.
 * Keep in sync with: frontend/src/lib/pricing.ts
 *
 * The system stores sellingPrice as a **per-container** price on the Product model.
 * When selling loose (saleType === 'volume'), the unit price must be divided by
 * containerCapacity so that quantity × unitPrice yields the correct total.
 */

/**
 * Returns the effective containerCapacity, clamped to a minimum of 1.
 */
export function safeContainerCapacity(containerCapacity: number | undefined | null): number {
  return containerCapacity && containerCapacity >= 1 ? containerCapacity : 1;
}

/**
 * Compute the correct unitPrice for a transaction line item.
 *
 *  - saleType 'quantity' → unitPrice is the per-container sellingPrice
 *  - saleType 'volume'   → unitPrice is sellingPrice ÷ containerCapacity  (per base-unit)
 *
 * The result is rounded to 2 decimal places.
 */
export function computeUnitPrice(
  sellingPrice: number,
  containerCapacity: number | undefined | null,
  saleType: 'quantity' | 'volume',
): number {
  if (saleType === 'volume') {
    const cap = safeContainerCapacity(containerCapacity);
    return Math.round((sellingPrice / cap) * 100) / 100;
  }
  return sellingPrice;
}
