export type ProductPriceBasis = 'container' | 'unit'

export interface ProductPricingInput {
  sellingPrice?: number | null
  costPrice?: number | null
  containerCapacity?: number | null
  canSellLoose?: boolean | null
  sellingPriceBasis?: ProductPriceBasis | null
  costPriceBasis?: ProductPriceBasis | null
}

export function roundMoney(value: number): number {
  const rounded = Math.round((value + Number.EPSILON) * 100) / 100
  return Object.is(rounded, -0) ? 0 : rounded
}

export function roundUnitMoney(value: number): number {
  const rounded = Math.round((value + Number.EPSILON) * 10000) / 10000
  return Object.is(rounded, -0) ? 0 : rounded
}

export function normalizeProductPrice(
  value: number | null | undefined,
  basis: ProductPriceBasis | null | undefined,
  containerCapacity: number | null | undefined,
): number | undefined {
  if (value == null || Number.isNaN(value)) return undefined
  const cap = containerCapacity && containerCapacity > 1 ? containerCapacity : 1
  return basis === 'unit' ? roundMoney(value * cap) : roundMoney(value)
}

export function getProductPricePreview(input: ProductPricingInput) {
  const cap = input.containerCapacity && input.containerCapacity > 1 ? input.containerCapacity : 1
  const sellingPrice = normalizeProductPrice(input.sellingPrice, input.sellingPriceBasis, cap)
  const costPrice = normalizeProductPrice(input.costPrice, input.costPriceBasis, cap)
  return {
    sellingPrice,
    costPrice,
    sellingPricePerUnit: sellingPrice == null ? undefined : roundUnitMoney(sellingPrice / cap),
    costPricePerUnit: costPrice == null ? undefined : roundUnitMoney(costPrice / cap),
  }
}

export function formatLooseUnitPrice(value: number): string {
  if (value > 0 && Math.abs(value) < 0.01) return value.toFixed(4)
  return value.toFixed(2)
}
