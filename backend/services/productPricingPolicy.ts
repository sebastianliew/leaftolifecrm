import { ValidationError } from '../middlewares/errorHandler.middleware.js';
import { safeContainerCapacity } from '../utils/pricingUtils.js';

export const PRODUCT_PRICE_BASES = ['container', 'unit'] as const;
export type ProductPriceBasis = typeof PRODUCT_PRICE_BASES[number];

export interface ProductPricingInput {
  sellingPrice?: number | null;
  costPrice?: number | null;
  containerCapacity?: number | null;
  canSellLoose?: boolean | null;
  sellingPriceBasis?: ProductPriceBasis | string | null;
  costPriceBasis?: ProductPriceBasis | string | null;
}

export interface NormalizedProductPricing {
  sellingPrice?: number;
  costPrice?: number;
  sellingPriceBasis: ProductPriceBasis;
  costPriceBasis: ProductPriceBasis;
  sellingPricePerUnit?: number;
  costPricePerUnit?: number;
}

const isPriceBasis = (value: unknown): value is ProductPriceBasis =>
  value === 'container' || value === 'unit';

export const roundMoney = (value: number): number => {
  const rounded = Math.round((value + Number.EPSILON) * 100) / 100;
  return Object.is(rounded, -0) ? 0 : rounded;
};

export const roundUnitMoney = (value: number): number => {
  const rounded = Math.round((value + Number.EPSILON) * 10000) / 10000;
  return Object.is(rounded, -0) ? 0 : rounded;
};

export function resolveProductPriceBasis(value: unknown, fieldName: string): ProductPriceBasis {
  if (value == null || value === '') return 'container';
  if (isPriceBasis(value)) return value;
  throw new ValidationError(`${fieldName} must be either "container" or "unit"`);
}

function normalizeOnePrice(
  value: number | null | undefined,
  basis: ProductPriceBasis,
  containerCapacity: number,
  canSellLoose: boolean,
  fieldName: string,
): number | undefined {
  if (value == null) return undefined;
  if (typeof value !== 'number' || Number.isNaN(value) || value < 0) {
    throw new ValidationError(`${fieldName} must be a non-negative number`);
  }
  if (basis === 'unit') {
    if (!canSellLoose || containerCapacity <= 1) {
      throw new ValidationError(`${fieldName}Basis="unit" requires loose selling with container capacity greater than 1`);
    }
    return roundMoney(value * containerCapacity);
  }
  return roundMoney(value);
}

export function normalizeProductPricing(input: ProductPricingInput): NormalizedProductPricing {
  const containerCapacity = safeContainerCapacity(input.containerCapacity);
  const canSellLoose = input.canSellLoose === true;
  const sellingPriceBasis = resolveProductPriceBasis(input.sellingPriceBasis, 'sellingPriceBasis');
  const costPriceBasis = resolveProductPriceBasis(input.costPriceBasis, 'costPriceBasis');
  const sellingPrice = normalizeOnePrice(input.sellingPrice, sellingPriceBasis, containerCapacity, canSellLoose, 'sellingPrice');
  const costPrice = normalizeOnePrice(input.costPrice, costPriceBasis, containerCapacity, canSellLoose, 'costPrice');

  return {
    ...(sellingPrice !== undefined ? { sellingPrice } : {}),
    ...(costPrice !== undefined ? { costPrice } : {}),
    sellingPriceBasis,
    costPriceBasis,
    ...(sellingPrice !== undefined ? { sellingPricePerUnit: roundUnitMoney(sellingPrice / containerCapacity) } : {}),
    ...(costPrice !== undefined ? { costPricePerUnit: roundUnitMoney(costPrice / containerCapacity) } : {}),
  };
}

export function addDerivedProductPricing<T extends Record<string, unknown>>(product: T): T & {
  sellingPricePerUnit?: number;
  costPricePerUnit?: number;
} {
  const containerCapacity = safeContainerCapacity(product.containerCapacity as number | undefined);
  return {
    ...product,
    ...(
      typeof product.sellingPrice === 'number'
        ? { sellingPricePerUnit: roundUnitMoney(product.sellingPrice / containerCapacity) }
        : {}
    ),
    ...(
      typeof product.costPrice === 'number'
        ? { costPricePerUnit: roundUnitMoney(product.costPrice / containerCapacity) }
        : {}
    ),
  };
}
