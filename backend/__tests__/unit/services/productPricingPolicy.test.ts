import {
  addDerivedProductPricing,
  normalizeProductPricing,
  roundMoney,
} from '../../../services/productPricingPolicy.js';

describe('productPricingPolicy', () => {
  it('preserves container-basis prices and derives per-unit display values', () => {
    const pricing = normalizeProductPricing({
      sellingPrice: 200,
      costPrice: 65,
      containerCapacity: 500,
      canSellLoose: true,
      sellingPriceBasis: 'container',
      costPriceBasis: 'container',
    });

    expect(pricing.sellingPrice).toBe(200);
    expect(pricing.costPrice).toBe(65);
    expect(pricing.sellingPricePerUnit).toBe(0.4);
    expect(pricing.costPricePerUnit).toBe(0.13);
  });

  it('normalizes unit-basis prices to canonical per-container fields', () => {
    const pricing = normalizeProductPricing({
      sellingPrice: 0.4,
      costPrice: 0.13,
      containerCapacity: 500,
      canSellLoose: true,
      sellingPriceBasis: 'unit',
      costPriceBasis: 'unit',
    });

    expect(pricing.sellingPrice).toBe(200);
    expect(pricing.costPrice).toBe(65);
    expect(pricing.sellingPricePerUnit).toBe(0.4);
    expect(pricing.costPricePerUnit).toBe(0.13);
  });

  it('defaults omitted price bases to container', () => {
    expect(normalizeProductPricing({
      sellingPrice: 15,
      containerCapacity: 60,
      canSellLoose: true,
    }).sellingPrice).toBe(15);
  });

  it('rejects unit basis when loose container semantics are unavailable', () => {
    expect(() => normalizeProductPricing({
      sellingPrice: 0.4,
      containerCapacity: 1,
      canSellLoose: true,
      sellingPriceBasis: 'unit',
    })).toThrow(/requires loose selling/i);

    expect(() => normalizeProductPricing({
      sellingPrice: 0.4,
      containerCapacity: 500,
      canSellLoose: false,
      sellingPriceBasis: 'unit',
    })).toThrow(/requires loose selling/i);
  });

  it('rounds money safely and avoids negative zero', () => {
    expect(roundMoney(0.105)).toBe(0.11);
    expect(Object.is(roundMoney(-0.001), -0)).toBe(false);
  });

  it('adds read-only derived per-unit prices', () => {
    expect(addDerivedProductPricing({
      sellingPrice: 200,
      costPrice: 65,
      containerCapacity: 500,
    })).toMatchObject({
      sellingPricePerUnit: 0.4,
      costPricePerUnit: 0.13,
    });
  });
});
