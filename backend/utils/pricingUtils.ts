/**
 * Centralized pricing utilities.
 * Keep in sync with: frontend/src/lib/pricing.ts
 *
 * Why this file exists: `Product.costPrice` and `Product.sellingPrice` are
 * stored PER CONTAINER on the schema (a 1000 ml bottle with costPrice=80 means
 * $80 for the bottle, not per ml). Anything that wants a per-base-unit value
 * (blend ingredient cost, per-ml UI, POS 'volume' pricing) MUST go through a
 * helper here — never inline `costPrice / containerCapacity` at a call site.
 *
 * Branded types (PerContainerPrice / PerUnitPrice) make unit mix-ups surface
 * at compile time instead of at invoice time.
 */

type Brand<T, B extends string> = T & { readonly __brand: B };

/** A monetary value attached to a whole container (e.g. a 1000 ml bottle). */
export type PerContainerPrice = Brand<number, 'PerContainerPrice'>;

/** A monetary value per base unit (per ml, per g, per piece). */
export type PerUnitPrice = Brand<number, 'PerUnitPrice'>;

/** Minimal shape needed by pricing helpers — narrower than IProduct on purpose. */
export interface PricingInput {
  costPrice?: number | null;
  sellingPrice?: number | null;
  /** Base units per container (e.g. 1000 for a 1000 ml bottle). */
  containerCapacity?: number | null;
}

/**
 * Returns the effective containerCapacity, clamped to a minimum of 1.
 * Used to avoid division-by-zero and defensively coerce bad data.
 */
export function safeContainerCapacity(containerCapacity: number | undefined | null): number {
  return containerCapacity && containerCapacity >= 1 ? containerCapacity : 1;
}

/**
 * Per-base-unit cost derived from the product's per-container costPrice.
 * Returns `undefined` when no costPrice is recorded (so callers can distinguish
 * "unknown" from "legitimately zero"). Does NOT fall back to sellingPrice.
 */
export function perUnitCost(product: PricingInput): PerUnitPrice | undefined {
  if (product.costPrice == null) return undefined;
  return (product.costPrice / safeContainerCapacity(product.containerCapacity)) as PerUnitPrice;
}

/** Per-base-unit selling price derived the same way. */
export function perUnitSellingPrice(product: PricingInput): PerUnitPrice | undefined {
  if (product.sellingPrice == null) return undefined;
  return (product.sellingPrice / safeContainerCapacity(product.containerCapacity)) as PerUnitPrice;
}

/** Per-unit cost with a caller-supplied fallback for missing costPrice. */
export function perUnitCostOr(product: PricingInput, fallback: number): PerUnitPrice {
  return (perUnitCost(product) ?? fallback) as PerUnitPrice;
}

/**
 * Compute the correct unitPrice for a transaction line item.
 *
 *  - saleType 'quantity' → unitPrice is the per-container sellingPrice
 *  - saleType 'volume'   → unitPrice is sellingPrice ÷ containerCapacity  (per base-unit)
 *
 * Volume prices keep 4 decimal places so very small per-base-unit prices do
 * not collapse to zero while bad legacy data is being repaired.
 */
export function computeUnitPrice(
  sellingPrice: number,
  containerCapacity: number | undefined | null,
  saleType: 'quantity' | 'volume',
): number {
  if (saleType === 'volume') {
    const cap = safeContainerCapacity(containerCapacity);
    return Math.round((sellingPrice / cap) * 10000) / 10000;
  }
  return sellingPrice;
}
