import { safeContainerCapacity } from './pricingUtils.js';

type DisplayContainerType = string | { name?: string | null } | null | undefined;

interface TransactionQuantityDisplayProduct {
  sellingPrice?: number | null;
  containerCapacity?: number | null;
  containerType?: DisplayContainerType;
  unitOfMeasurement?: { abbreviation?: string; name?: string } | string | null;
  unitName?: string | null;
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

function getUnitLabel(
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

  const productSellingPrice = input.product?.sellingPrice;
  if (isApproximatelyEqual(input.unitPrice, productSellingPrice)) {
    return true;
  }

  const expectedConvertedQuantity = input.quantity * containerCapacity;
  return isApproximatelyEqual(input.convertedQuantity, expectedConvertedQuantity);
}

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

  const baseUnit = input.baseUnit || input.product?.unitName || getUnitLabel(input.product?.unitOfMeasurement);
  return {
    quantityText,
    unitLabel: input.saleType === 'volume' ? baseUnit : pluralizeUnitLabel(baseUnit, input.quantity),
  };
}

export function formatTransactionQuantityDisplay(input: TransactionQuantityDisplayInput): string {
  const { quantityText, unitLabel } = getTransactionQuantityDisplayParts(input);
  return unitLabel ? `${quantityText} ${unitLabel}` : quantityText;
}
