/**
 * Centralized pricing utilities for transaction items.
 * Keep in sync with: backend/utils/pricingUtils.ts
 *
 * The system stores sellingPrice as a **per-container** price on the Product model.
 * When selling loose (saleType === 'volume'), the unit price must be divided by
 * containerCapacity so that quantity × unitPrice yields the correct total.
 *
 * Every place that reads, writes, or compares a transaction item's unitPrice MUST
 * go through these helpers to keep the two pricing semantics consistent.
 */

/**
 * Returns the effective containerCapacity, clamped to a minimum of 1 to avoid
 * division-by-zero and nonsensical prices.
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

/**
 * Compare a transaction item's current unitPrice against what it *should* be
 * given the latest product data.  Returns the magnitude of the difference.
 *
 * A difference > 0.01 is considered a mismatch (to avoid floating-point noise).
 */
/**
 * Resolve the display label for a product's unit of measurement.
 * Handles object refs ({abbreviation, name}), plain strings, and missing values.
 */
export function getUnitLabel(
  unitOfMeasurement: { abbreviation?: string; name?: string } | string | null | undefined,
  fallback = 'units',
): string {
  if (typeof unitOfMeasurement === 'object' && unitOfMeasurement !== null) {
    return unitOfMeasurement.abbreviation || unitOfMeasurement.name || fallback;
  }
  if (typeof unitOfMeasurement === 'string' && unitOfMeasurement) {
    return unitOfMeasurement;
  }
  return fallback;
}

/**
 * Format a base-unit value as a container breakdown string.
 * e.g. formatContainerBreakdown(320, 75, 'ml') → "4 containers + 20ml"
 * Returns empty string when containerCapacity ≤ 1.
 */
export function formatContainerBreakdown(
  baseUnits: number,
  containerCapacity: number | undefined | null,
  unitLabel: string,
): string {
  const cap = safeContainerCapacity(containerCapacity);
  if (cap <= 1 || baseUnits <= 0) return '';
  const containers = Math.floor(baseUnits / cap);
  const remainder = +(baseUnits % cap).toFixed(2);
  const ctnLabel = containers === 1 ? 'container' : 'containers';
  if (remainder > 0) return `${containers} ${ctnLabel} + ${remainder} ${unitLabel}`;
  return `${containers} ${ctnLabel}`;
}

/**
 * Get the display quantity in base units for a transaction line item.
 *
 * The backend stores `quantity` differently per saleType:
 *   - 'volume' → quantity is already in base units (ml, g, etc.)
 *   - 'quantity' → quantity is in containers; multiply by containerCapacity
 *
 * This function normalizes to base units so the UI can always show
 * `${displayQuantity} ${baseUnit}` consistently.
 */
export function getDisplayQuantity(
  quantity: number,
  saleType: 'quantity' | 'volume',
  containerCapacity: number | undefined | null,
): number {
  if (saleType === 'volume') return quantity;
  const cap = safeContainerCapacity(containerCapacity);
  return cap > 1 ? quantity * cap : quantity;
}

export function detectPriceMismatch(
  itemUnitPrice: number,
  productSellingPrice: number,
  containerCapacity: number | undefined | null,
  saleType: 'quantity' | 'volume',
): { hasMismatch: boolean; currentPrice: number; difference: number } {
  const expectedUnitPrice = computeUnitPrice(productSellingPrice, containerCapacity, saleType);
  const difference = expectedUnitPrice - itemUnitPrice;
  return {
    hasMismatch: Math.abs(difference) > 0.01,
    currentPrice: expectedUnitPrice,
    difference,
  };
}
