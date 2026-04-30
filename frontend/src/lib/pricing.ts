/**
 * Centralized pricing utilities.
 * Keep in sync with: backend/utils/pricingUtils.ts
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

/** Minimal shape needed by pricing helpers. */
export interface PricingInput {
  costPrice?: number | null;
  sellingPrice?: number | null;
  containerCapacity?: number | null;
}

/**
 * Returns the effective containerCapacity, clamped to a minimum of 1 to avoid
 * division-by-zero and nonsensical prices.
 */
export function safeContainerCapacity(containerCapacity: number | undefined | null): number {
  return containerCapacity && containerCapacity >= 1 ? containerCapacity : 1;
}

/**
 * Per-base-unit cost derived from the product's per-container costPrice.
 * Returns `undefined` when no costPrice is recorded. Does NOT fall back to sellingPrice.
 */
export function perUnitCost(product: PricingInput): PerUnitPrice | undefined {
  if (product.costPrice == null) return undefined;
  return (product.costPrice / safeContainerCapacity(product.containerCapacity)) as PerUnitPrice;
}

/** Per-base-unit selling price. */
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
 * not display as 0.00 while bad legacy data is being repaired.
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

type DisplayContainerType = string | { name?: string | null } | null | undefined;

interface TransactionQuantityDisplayProduct {
  sellingPrice?: number | null;
  containerCapacity?: number | null;
  containerType?: DisplayContainerType;
  unitOfMeasurement?: { abbreviation?: string; name?: string } | string | null;
}

export interface TransactionQuantityDisplayInput {
  quantity: number;
  saleType: 'quantity' | 'volume';
  baseUnit?: string | null;
  convertedQuantity?: number | null;
  unitPrice?: number | null;
  containerCapacity?: number | null;
  containerCapacityAtSale?: number | null;
  containerType?: DisplayContainerType;
  product?: TransactionQuantityDisplayProduct | null;
}

export interface TransactionQuantityDisplayParts {
  quantityText: string;
  unitLabel: string;
}

function formatQuantityValue(quantity: number): string {
  if (!Number.isFinite(quantity)) return '0';
  return Number.isInteger(quantity) ? String(quantity) : String(+quantity.toFixed(2));
}

function getContainerTypeName(input: TransactionQuantityDisplayInput): string | undefined {
  const containerType = input.containerType ?? input.product?.containerType;
  if (typeof containerType === 'string') return containerType;
  return containerType?.name || undefined;
}

function pluralizeUnitLabel(label: string, quantity: number): string {
  const normalized = label.trim();
  if (!normalized) return '';

  const lower = normalized.toLowerCase();
  if (Math.abs(quantity) === 1) return lower;
  if (/(ss|x|z|ch|sh)$/.test(lower)) return `${lower}es`;
  if (lower.endsWith('s')) return lower;
  if (/[^aeiou]y$/.test(lower)) return `${lower.slice(0, -1)}ies`;
  return `${lower}s`;
}

function isApproximatelyEqual(a: number | null | undefined, b: number | null | undefined): boolean {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  return Math.abs((a ?? 0) - (b ?? 0)) <= 0.01;
}

function shouldDisplayAsContainerSale(input: TransactionQuantityDisplayInput, containerCapacity: number): boolean {
  if (containerCapacity <= 1) return false;
  if (input.saleType === 'quantity') return true;

  if (isApproximatelyEqual(input.unitPrice, input.product?.sellingPrice)) {
    return true;
  }

  const expectedConvertedQuantity = input.quantity * containerCapacity;
  return isApproximatelyEqual(input.convertedQuantity, expectedConvertedQuantity);
}

/**
 * Format the client-facing quantity for a transaction line.
 * This preserves sold quantity while convertedQuantity remains the stock unit.
 */
export function getTransactionQuantityDisplayParts(
  input: TransactionQuantityDisplayInput,
): TransactionQuantityDisplayParts {
  const quantityText = formatQuantityValue(input.quantity);
  const containerCapacity =
    input.containerCapacityAtSale ??
    input.product?.containerCapacity ??
    input.containerCapacity;
  const cap = safeContainerCapacity(containerCapacity);

  if (shouldDisplayAsContainerSale(input, cap)) {
    const containerLabel = getContainerTypeName(input) || 'container';
    return {
      quantityText,
      unitLabel: pluralizeUnitLabel(containerLabel, input.quantity),
    };
  }

  const baseUnit = input.baseUnit || getUnitLabel(input.product?.unitOfMeasurement);
  return {
    quantityText,
    unitLabel: input.saleType === 'volume' ? baseUnit : pluralizeUnitLabel(baseUnit, input.quantity),
  };
}

export function formatTransactionQuantityDisplay(input: TransactionQuantityDisplayInput): string {
  const { quantityText, unitLabel } = getTransactionQuantityDisplayParts(input);
  return unitLabel ? `${quantityText} ${unitLabel}` : quantityText;
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
