import {
  formatLooseUnitPrice,
  getProductPricePreview,
  normalizeProductPrice,
} from '@/lib/productPricing'

describe('product pricing basis utilities', () => {
  it('normalizes per-unit loose prices to canonical per-container prices', () => {
    expect(normalizeProductPrice(0.4, 'unit', 500)).toBe(200)
    expect(getProductPricePreview({
      sellingPrice: 0.4,
      costPrice: 0.13,
      sellingPriceBasis: 'unit',
      costPriceBasis: 'unit',
      containerCapacity: 500,
      canSellLoose: true,
    })).toMatchObject({
      sellingPrice: 200,
      costPrice: 65,
      sellingPricePerUnit: 0.4,
      costPricePerUnit: 0.13,
    })
  })

  it('keeps existing container-price workflows unchanged', () => {
    expect(normalizeProductPrice(200, 'container', 500)).toBe(200)
    expect(getProductPricePreview({
      sellingPrice: 200,
      sellingPriceBasis: 'container',
      containerCapacity: 500,
      canSellLoose: true,
    })).toMatchObject({
      sellingPrice: 200,
      sellingPricePerUnit: 0.4,
    })
  })

  it('displays tiny loose unit prices with enough precision to avoid 0.00', () => {
    expect(formatLooseUnitPrice(0.0008)).toBe('0.0008')
    expect(formatLooseUnitPrice(0.4)).toBe('0.40')
  })
})
